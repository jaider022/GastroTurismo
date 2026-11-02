const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { comparisonPeriods, bogotaDate, validDate } = require('./lib/periods');
const { hashPassword, verifyPassword } = require('./lib/passwords');
const { ORDER_TRANSITIONS, RuleError, isAdmin, isOwnerRole, positiveInteger: isPositiveId, cleanText, integerInRange, money,
  validateReservationFields, restaurantFor, assertManagesRestaurant, sendRuleError } = require('./lib/reglas');
const { registerExtraRoutes, processReminders } = require('./lib/modulos-extra');
require('dotenv').config();

function createApp({ db = null, now = () => new Date() } = {}) {
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  const origin = req.get('origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origen no permitido.' });
    } catch { return res.status(403).json({ error: 'Origen no válido.' }); }
  }
  next();
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Estado de la conexión a la base de datos
let dbConnection = db;
let dbError = null;
const sessions = new Map();
const loginAttempts = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;
const cookieName = 'gt_session';
function createSession(res, user) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: now().getTime() + sessionDuration });
  res.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: sessionDuration, path: '/' });
}
app.use((req, res, next) => {
  const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const session = token && sessions.get(token);
  if (session && session.expires > now().getTime()) req.user = session.user;
  else if (token) sessions.delete(token);
  req.sessionToken = token;
  next();
});
const requireSession = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Debes iniciar sesión.' });
const requireStaff = (req, res, next) => ['administrador', 'restaurante'].includes(req.user?.tipo_usuario)
  ? next() : res.status(403).json({ error: 'Esta acción requiere una cuenta de administrador o restaurante.' });

// Función para inicializar conexión a MySQL
async function initDB() {
  try {
    dbConnection = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gastronomia_turistica_academica',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 3000,
      timezone: '-05:00',
      dateStrings: true
    });
    dbConnection.pool.on('connection', connection => connection.query("SET time_zone = '-05:00'"));
    // Test de conexión
    const [rows] = await dbConnection.query('SELECT 1');
    console.log(' Conectado exitosamente a la base de datos MySQL.');
    dbError = null;
  } catch (error) {
    dbConnection = null;
    dbError = 'No fue posible conectar. Revisa MySQL y la configuración local del servidor.';
    console.warn('\n⚠️  No se pudo conectar a MySQL. El servidor funcionará en modo DEMO (LocalStorage).');
    console.warn('Código de conexión:', error.code || 'CONNECTION_ERROR');
    console.warn('Asegúrate de iniciar MySQL y ejecutar el script "schema.sql" para habilitar el backend real.\n');
  }
}

// La conexión se inicia explícitamente al arrancar el servidor, no al importar para pruebas.

// --------------------------------------------------------------------
// MIDDLEWARE PARA PROTEGER RUTAS SI LA BASE DE DATOS NO ESTÁ CONECTADA
// --------------------------------------------------------------------
const checkDbConnection = (req, res, next) => {
  if (!dbConnection) {
    return res.status(503).json({
      error: 'Base de datos MySQL no disponible.',
      detail: dbError,
      mockMode: true
    });
  }
  next();
};

// --------------------------------------------------------------------
// ENDPOINTS DE CONTROL DE ESTADO DE BD
// --------------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    connected: dbConnection !== null,
    database: process.env.DB_NAME,
    error: dbError
  });
});

// Re-intentar conexión (útil si el usuario inicia MySQL después de encender el servidor)
app.post('/api/status/reconnect', async (req, res) => {
  // Las credenciales pertenecen a .env, nunca se cambian desde un navegador.
  if (dbConnection) return res.json({ connected: true, database: process.env.DB_NAME });
  await initDB();

  res.json({
    connected: dbConnection !== null,
    database: process.env.DB_NAME,
    error: dbError
  });
});

// --------------------------------------------------------------------
// ENDPOINTS DE AUTENTICACIÓN (LOGIN & REGISTRO)
// --------------------------------------------------------------------
app.post('/api/auth/login', checkDbConnection, async (req, res) => {
  const { correo, contrasena } = req.body;
  if (typeof correo !== 'string' || typeof contrasena !== 'string' || contrasena.length > 256) {
    return res.status(400).json({ error: 'Ingresa correo y contraseña válidos.' });
  }
  const attemptKey = `${req.ip}:${correo.trim().toLowerCase()}`;
  const attempt = loginAttempts.get(attemptKey);
  if (attempt && attempt.until > now().getTime() && attempt.count >= 10) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en quince minutos.' });
  }
  try {
    const [users] = await dbConnection.query(
      'SELECT id_usuario, nombre, correo, tipo_usuario, telefono, contrasena FROM usuarios WHERE correo = ?',
      [correo.trim().toLowerCase()]
    );

    if (!users.length || !verifyPassword(contrasena, users[0].contrasena)) {
      loginAttempts.set(attemptKey, { count: attempt && attempt.until > now().getTime() ? attempt.count + 1 : 1, until: now().getTime() + 15 * 60 * 1000 });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    const { contrasena: stored, ...user } = users[0];
    if (!stored.startsWith('scrypt$')) {
      await dbConnection.query('UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?', [hashPassword(contrasena), user.id_usuario]);
    }
    await dbConnection.query('INSERT INTO accesos_sistema (id_usuario, fecha_ingreso) VALUES (?, ?)', [user.id_usuario, colombianTimestamp(now())]);
    loginAttempts.delete(attemptKey);
    createSession(res, user);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo iniciar sesión. Comprueba que importaste el esquema actualizado.' });
  }
});

app.post('/api/auth/register', checkDbConnection, async (req, res) => {
  const { nombre, correo, contrasena, telefono } = req.body;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150 ||
      typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150 ||
      typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 256 ||
      (telefono != null && (typeof telefono !== 'string' || !/^[+\d\s()-]{7,20}$/.test(telefono)))) {
    return res.status(400).json({ error: 'Revisa nombre, correo, teléfono y contraseña (mínimo 8 caracteres).' });
  }
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO usuarios (nombre, correo, contrasena, telefono, tipo_usuario) VALUES (?, ?, ?, ?, ?)',
      [nombre.trim(), correo.trim().toLowerCase(), hashPassword(contrasena), telefono || null, 'cliente']
    );
    const user = { id_usuario: result.insertId, nombre: nombre.trim(), correo: correo.trim().toLowerCase(), tipo_usuario: 'cliente', telefono: telefono || null };
    await dbConnection.query('INSERT INTO accesos_sistema (id_usuario, fecha_ingreso) VALUES (?, ?)', [user.id_usuario, colombianTimestamp(now())]);
    createSession(res, user);
    res.status(201).json({
      success: true,
      userId: result.insertId,
      user
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }
    res.status(500).json({ error: 'No se pudo registrar la cuenta.' });
  }
});

app.get('/api/auth/me', requireSession, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', (req, res) => {
  if (req.sessionToken) sessions.delete(req.sessionToken);
  res.clearCookie(cookieName, { path: '/' });
  res.json({ success: true });
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/reportes') || !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return requireSession(req, res, next);
  next();
});

function colombianTimestamp(value) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(value);
  return parts.replace(',', '');
}

function positiveInteger(value) { return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647; }

app.get('/api/usuarios', checkDbConnection, requireSession, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT id_usuario, nombre, correo, telefono, tipo_usuario, fecha_registro FROM usuarios ORDER BY nombre');
    res.json(rows);
  } catch { res.status(500).json({ error: 'No se pudieron consultar los usuarios.' }); }
});

app.get('/api/visitas', checkDbConnection, requireSession, requireStaff, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`SELECT v.*, r.nombre AS nombre_restaurante, u.nombre AS nombre_usuario
      FROM visitas v JOIN restaurantes r ON r.id_restaurante = v.id_restaurante
      LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario ORDER BY v.fecha_ingreso DESC`);
    res.json(rows);
  } catch { res.status(500).json({ error: 'No se pudieron consultar las visitas.' }); }
});

app.post('/api/visitas', checkDbConnection, requireStaff, async (req, res) => {
  const { id_restaurante, id_reserva, id_usuario, cantidad_personas } = req.body;
  const fecha_ingreso = req.body.fecha_ingreso || colombianTimestamp(now());
  if (!positiveInteger(id_restaurante) || !positiveInteger(cantidad_personas) ||
      (id_reserva != null && !positiveInteger(id_reserva)) || (id_usuario != null && !positiveInteger(id_usuario)) ||
      typeof fecha_ingreso !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(fecha_ingreso) ||
      !validDate(fecha_ingreso.slice(0, 10)) || !Number.isFinite(Date.parse(`${fecha_ingreso.replace(' ', 'T')}-05:00`)) ||
      Date.parse(`${fecha_ingreso.replace(' ', 'T')}-05:00`) > now().getTime()) {
    return res.status(400).json({ error: 'Revisa restaurante, cantidad positiva y fecha de ingreso válida que no esté en el futuro.' });
  }
  try {
    const [restaurants] = await dbConnection.query('SELECT id_restaurante, capacidad_total, id_propietario FROM restaurantes WHERE id_restaurante = ?', [id_restaurante]);
    if (!restaurants.length) return res.status(404).json({ error: 'El restaurante no existe.' });
    if (req.user.tipo_usuario === 'restaurante' && restaurants[0].id_propietario !== req.user.id_usuario) {
      return res.status(403).json({ error: 'Solo puedes registrar visitas de tu restaurante.' });
    }
    if (Number(cantidad_personas) > restaurants[0].capacidad_total) return res.status(400).json({ error: 'La cantidad supera el aforo del restaurante.' });
    let visitor = id_usuario || null;
    if (id_reserva != null) {
      const [reservations] = await dbConnection.query(`SELECT r.id_reserva, r.id_usuario, r.fecha_reserva, r.estado_reserva, m.id_restaurante, m.capacidad
        FROM reservas r JOIN mesas m ON m.id_mesa = r.id_mesa WHERE r.id_reserva = ?`, [id_reserva]);
      const reservation = reservations[0];
      if (!reservation || Number(reservation.id_restaurante) !== Number(id_restaurante) || reservation.estado_reserva === 'cancelada' ||
          Number(cantidad_personas) > reservation.capacidad || String(reservation.fecha_reserva).slice(0, 10) !== fecha_ingreso.slice(0, 10) ||
          (visitor && Number(visitor) !== Number(reservation.id_usuario))) {
        return res.status(400).json({ error: 'La reserva debe corresponder al restaurante, usuario y fecha; revisa el estado y capacidad de la mesa.' });
      }
      visitor = reservation.id_usuario;
    }
    const [result] = await dbConnection.query(`INSERT INTO visitas (id_restaurante, id_reserva, id_usuario, fecha_ingreso, cantidad_personas)
      VALUES (?, ?, ?, ?, ?)`, [id_restaurante, id_reserva || null, visitor, fecha_ingreso.replace('T', ' '), cantidad_personas]);
    res.status(201).json({ id_visita: result.insertId, id_restaurante: Number(id_restaurante), id_reserva: id_reserva || null, id_usuario: visitor, fecha_ingreso, cantidad_personas: Number(cantidad_personas) });
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Esta reserva ya tiene una visita registrada.' : 'No se pudo registrar la visita. Revisa los datos relacionados.' });
  }
});

for (const reportNumber of [11, 12]) {
  app.get(`/api/reportes/${reportNumber}`, checkDbConnection, async (req, res) => {
    let periods;
    try {
      periods = comparisonPeriods(req.query, now());
      if (req.query.id_restaurante && (!positiveInteger(req.query.id_restaurante) || reportNumber === 12)) throw new Error('El filtro de restaurante solo aplica a personas atendidas y debe ser un identificador válido.');
    } catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      const rows = [];
      for (const { hasta_exclusivo, ...period } of periods) {
        const params = [`${period.desde} 00:00:00`, `${hasta_exclusivo} 00:00:00`];
        let sql;
        if (reportNumber === 11) {
          sql = 'SELECT COALESCE(SUM(cantidad_personas), 0) AS personas_atendidas, COUNT(*) AS visitas FROM visitas WHERE fecha_ingreso >= ? AND fecha_ingreso < ?';
          if (req.query.id_restaurante) { sql += ' AND id_restaurante = ?'; params.push(Number(req.query.id_restaurante)); }
        } else {
          sql = 'SELECT COUNT(*) AS ingresos, COUNT(DISTINCT id_usuario) AS usuarios_unicos FROM accesos_sistema WHERE fecha_ingreso >= ? AND fecha_ingreso < ?';
        }
        const [counts] = await dbConnection.query(sql, params);
        rows.push({ ...period, ...Object.fromEntries(Object.entries(counts[0]).map(([key, value]) => [key, Number(value)])) });
      }
      res.json(rows);
    } catch { res.status(500).json({ error: 'No se pudo generar el reporte. Comprueba el esquema actualizado.' }); }
  });
}

// --------------------------------------------------------------------
// ENDPOINTS CRUD - RESTAURANTES
// Consulta pública; registro, modificación y eliminación según rol y propiedad.
// --------------------------------------------------------------------
app.get('/api/restaurantes', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.*, z.nombre_zona, z.ciudad, u.nombre AS nombre_propietario, p.nombre_plan
      FROM restaurantes r
      INNER JOIN zonas z ON r.id_zona = z.id_zona
      INNER JOIN usuarios u ON r.id_propietario = u.id_usuario
      LEFT JOIN planes_suscripcion p ON r.id_plan = p.id_plan
      ORDER BY r.nombre ASC
    `);
    res.json(rows);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar los restaurantes.');
  }
});

function restaurantPayload(body, user) {
  const data = {
    nombre: cleanText(body.nombre, { max: 150, field: 'nombre' }),
    direccion: cleanText(body.direccion, { max: 200, field: 'dirección' }),
    telefono: cleanText(body.telefono, { max: 20, required: false, field: 'teléfono' }),
    email: cleanText(body.email, { max: 150, required: false, field: 'correo' }),
    capacidad_total: integerInRange(body.capacidad_total, { max: 2000, field: 'aforo' }),
    especialidad: cleanText(body.especialidad, { max: 100, required: false, field: 'especialidad' }),
    id_zona: integerInRange(body.id_zona, { field: 'zona' })
  };
  if (data.telefono && !/^[+\d\s()-]{7,20}$/.test(data.telefono)) throw new RuleError(400, 'El teléfono no es válido.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new RuleError(400, 'El correo no es válido.');
  // Un propietario siempre registra a su nombre; el administrador puede asignar otro propietario.
  data.id_propietario = isAdmin(user) && positiveInteger(body.id_propietario) ? Number(body.id_propietario) : Number(user.id_usuario);
  return data;
}

app.post('/api/restaurantes', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const data = restaurantPayload(req.body, req.user);
    const [owner] = await dbConnection.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [data.id_propietario]);
    if (!owner.length || owner[0].tipo_usuario === 'cliente') throw new RuleError(400, 'El propietario debe ser una cuenta de restaurante o administrador.');
    // Todo restaurante nuevo inicia en el plan Básico; los planes pagos se contratan en Planes y suscripción.
    const [result] = await dbConnection.query(
      'INSERT INTO restaurantes (nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [data.nombre, data.direccion, data.telefono, data.email, data.capacidad_total, data.especialidad, data.id_zona, data.id_propietario]
    );
    await dbConnection.query(
      "INSERT INTO suscripciones (id_restaurante, id_plan, fecha_inicio, fecha_fin, estado_suscripcion) VALUES (?, 1, ?, DATE_ADD(?, INTERVAL 12 MONTH), 'activa')",
      [result.insertId, bogotaDate(now()), bogotaDate(now())]
    );
    res.status(201).json({ id_restaurante: result.insertId, ...data, id_plan: 1 });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo registrar el restaurante.');
  }
});

app.put('/api/restaurantes/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const current = await assertManagesRestaurant(dbConnection, req.user, req.params.id);
    const data = restaurantPayload(req.body, req.user);
    if (!isAdmin(req.user)) data.id_propietario = Number(current.id_propietario);
    const [mesas] = await dbConnection.query('SELECT COALESCE(SUM(capacidad), 0) AS sillas FROM mesas WHERE id_restaurante = ?', [current.id_restaurante]);
    if (Number(mesas[0].sillas) > data.capacidad_total) throw new RuleError(400, `El aforo no puede ser menor que la capacidad de sus mesas (${mesas[0].sillas} personas).`);
    // El plan no se cambia desde aquí: depende de la suscripción vigente.
    await dbConnection.query(
      'UPDATE restaurantes SET nombre = ?, direccion = ?, telefono = ?, email = ?, capacidad_total = ?, especialidad = ?, id_zona = ?, id_propietario = ? WHERE id_restaurante = ?',
      [data.nombre, data.direccion, data.telefono, data.email, data.capacidad_total, data.especialidad, data.id_zona, data.id_propietario, current.id_restaurante]
    );
    res.json({ message: 'Restaurante actualizado con éxito.' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo actualizar el restaurante.');
  }
});

app.delete('/api/restaurantes/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const current = await assertManagesRestaurant(dbConnection, req.user, req.params.id);
    const [history] = await dbConnection.query(`SELECT
        (SELECT COUNT(*) FROM reservas r JOIN mesas m ON m.id_mesa = r.id_mesa WHERE m.id_restaurante = ?) AS reservas,
        (SELECT COUNT(*) FROM pedidos WHERE id_restaurante = ?) AS pedidos,
        (SELECT COUNT(*) FROM experiencias WHERE id_restaurante = ?) AS experiencias`, [current.id_restaurante, current.id_restaurante, current.id_restaurante]);
    const used = history[0];
    if (Number(used.reservas) || Number(used.pedidos) || Number(used.experiencias)) {
      throw new RuleError(409, `No se puede eliminar: tiene ${used.reservas} reservas, ${used.pedidos} pedidos y ${used.experiencias} experiencias registradas.`);
    }
    await dbConnection.query('DELETE FROM restaurantes WHERE id_restaurante = ?', [current.id_restaurante]);
    res.json({ message: 'Restaurante eliminado con éxito.' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo eliminar el restaurante.');
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - MESAS
// --------------------------------------------------------------------
app.get('/api/mesas', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT m.*, r.nombre AS nombre_restaurante
      FROM mesas m
      INNER JOIN restaurantes r ON m.id_restaurante = r.id_restaurante
      ORDER BY r.nombre, m.numero_mesa
    `);
    res.json(rows);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar las mesas.');
  }
});

// Disponibilidad de mesas para una fecha, sin exponer quién reservó.
app.get('/api/mesas/disponibilidad', checkDbConnection, async (req, res) => {
  try {
    const restaurant = await restaurantFor(dbConnection, req.query.id_restaurante);
    if (!validDate(req.query.fecha)) throw new RuleError(400, 'La fecha no es válida.');
    const exclude = positiveInteger(req.query.excluir_reserva) ? Number(req.query.excluir_reserva) : 0;
    const [rows] = await dbConnection.query(`
      SELECT m.id_mesa, m.numero_mesa, m.capacidad, m.ubicacion, m.estado,
             EXISTS (SELECT 1 FROM reservas r WHERE r.id_mesa = m.id_mesa AND r.fecha_reserva = ?
                     AND r.estado_reserva IN ('pendiente', 'confirmada') AND r.id_reserva <> ?) AS ocupada
      FROM mesas m WHERE m.id_restaurante = ? ORDER BY m.capacidad, m.numero_mesa`, [req.query.fecha, exclude, restaurant.id_restaurante]);
    res.json(rows.map(row => ({ ...row, ocupada: Boolean(Number(row.ocupada)) || row.estado === 'mantenimiento' })));
  } catch (error) {
    sendRuleError(res, error, 'No se pudo consultar la disponibilidad.');
  }
});

function mesaPayload(body) {
  const estado = body.estado || 'disponible';
  if (!['disponible', 'reservada', 'mantenimiento'].includes(estado)) throw new RuleError(400, 'El estado de la mesa no es válido.');
  return {
    numero_mesa: cleanText(body.numero_mesa, { max: 20, field: 'número de mesa' }),
    capacidad: integerInRange(body.capacidad, { max: 50, field: 'capacidad' }),
    ubicacion: cleanText(body.ubicacion, { max: 100, field: 'ubicación' }),
    estado
  };
}

async function assertSeatsFit(id_restaurante, capacidad, exceptMesa = 0) {
  const [[restaurant]] = await dbConnection.query('SELECT capacidad_total FROM restaurantes WHERE id_restaurante = ?', [id_restaurante]);
  const [[seats]] = await dbConnection.query('SELECT COALESCE(SUM(capacidad), 0) AS sillas FROM mesas WHERE id_restaurante = ? AND id_mesa <> ?', [id_restaurante, exceptMesa]);
  if (Number(seats.sillas) + capacidad > Number(restaurant.capacidad_total)) {
    throw new RuleError(400, `Las mesas superarían el aforo del restaurante (${restaurant.capacidad_total} personas).`);
  }
}

app.post('/api/mesas', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const restaurant = await assertManagesRestaurant(dbConnection, req.user, req.body.id_restaurante);
    const data = mesaPayload(req.body);
    if (data.estado === 'reservada') data.estado = 'disponible';
    await assertSeatsFit(restaurant.id_restaurante, data.capacidad);
    const [result] = await dbConnection.query(
      'INSERT INTO mesas (numero_mesa, capacidad, ubicacion, estado, id_restaurante) VALUES (?, ?, ?, ?, ?)',
      [data.numero_mesa, data.capacidad, data.ubicacion, data.estado, restaurant.id_restaurante]
    );
    res.status(201).json({ id_mesa: result.insertId, ...data, id_restaurante: restaurant.id_restaurante });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una mesa con ese número en el restaurante.' });
    sendRuleError(res, error, 'No se pudo registrar la mesa.');
  }
});

app.put('/api/mesas/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La mesa no es válida.');
    const [found] = await dbConnection.query('SELECT id_mesa, id_restaurante FROM mesas WHERE id_mesa = ?', [Number(req.params.id)]);
    if (!found.length) throw new RuleError(404, 'La mesa no existe.');
    await assertManagesRestaurant(dbConnection, req.user, found[0].id_restaurante);
    const data = mesaPayload(req.body);
    await assertSeatsFit(found[0].id_restaurante, data.capacidad, found[0].id_mesa);
    const [[larger]] = await dbConnection.query(`SELECT COALESCE(MAX(cantidad_personas), 0) AS maximo FROM reservas
      WHERE id_mesa = ? AND estado_reserva IN ('pendiente', 'confirmada') AND fecha_reserva >= ?`, [found[0].id_mesa, bogotaDate(now())]);
    if (Number(larger.maximo) > data.capacidad) throw new RuleError(400, `La mesa tiene reservas activas para ${larger.maximo} personas; no se puede reducir su capacidad.`);
    // El restaurante de la mesa no cambia: se conserva el historial de reservas.
    await dbConnection.query('UPDATE mesas SET numero_mesa = ?, capacidad = ?, ubicacion = ?, estado = ? WHERE id_mesa = ?',
      [data.numero_mesa, data.capacidad, data.ubicacion, data.estado, found[0].id_mesa]);
    if (data.estado !== 'mantenimiento') await syncMesaEstado(dbConnection, found[0].id_mesa);
    res.json({ message: 'Mesa actualizada con éxito.' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una mesa con ese número en el restaurante.' });
    sendRuleError(res, error, 'No se pudo actualizar la mesa.');
  }
});

app.delete('/api/mesas/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La mesa no es válida.');
    const [found] = await dbConnection.query('SELECT id_mesa, id_restaurante FROM mesas WHERE id_mesa = ?', [Number(req.params.id)]);
    if (!found.length) throw new RuleError(404, 'La mesa no existe.');
    await assertManagesRestaurant(dbConnection, req.user, found[0].id_restaurante);
    await dbConnection.query('DELETE FROM mesas WHERE id_mesa = ?', [found[0].id_mesa]);
    res.json({ message: 'Mesa eliminada con éxito.' });
  } catch (error) {
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'La mesa tiene reservas registradas. Puedes ponerla en mantenimiento para conservar el historial.' });
    sendRuleError(res, error, 'No se pudo eliminar la mesa.');
  }
});

// Estado visible de la mesa: reservada si tiene reservas activas desde hoy.
async function syncMesaEstado(db, id_mesa) {
  await db.query(`UPDATE mesas SET estado = CASE
      WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.id_mesa = ? AND r.estado_reserva IN ('pendiente', 'confirmada') AND r.fecha_reserva >= ?) THEN 'reservada'
      ELSE 'disponible' END
    WHERE id_mesa = ? AND estado <> 'mantenimiento'`, [id_mesa, bogotaDate(now()), id_mesa]);
}

// --------------------------------------------------------------------
// ENDPOINTS CRUD - PLATOS
// --------------------------------------------------------------------
app.get('/api/platos', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT p.*, c.nombre_categoria, r.nombre AS nombre_restaurante
      FROM platos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      INNER JOIN restaurantes r ON p.id_restaurante = r.id_restaurante
      ORDER BY r.nombre, p.nombre
    `);
    res.json(rows);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar los platos.');
  }
});

function platoPayload(body) {
  return {
    nombre: cleanText(body.nombre, { max: 150, field: 'nombre del plato' }),
    descripcion: cleanText(body.descripcion, { max: 4000, required: false, field: 'descripción' }),
    precio: money(body.precio, 'precio'),
    disponibilidad: body.disponibilidad === undefined ? 1 : (body.disponibilidad === true || body.disponibilidad === 1 || body.disponibilidad === '1' || body.disponibilidad === 'true') ? 1 : 0,
    id_categoria: integerInRange(body.id_categoria, { field: 'categoría' })
  };
}

app.post('/api/platos', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const restaurant = await assertManagesRestaurant(dbConnection, req.user, req.body.id_restaurante);
    const data = platoPayload(req.body);
    const [result] = await dbConnection.query(
      'INSERT INTO platos (nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante) VALUES (?, ?, ?, ?, ?, ?)',
      [data.nombre, data.descripcion, data.precio, data.disponibilidad, data.id_categoria, restaurant.id_restaurante]
    );
    res.status(201).json({ id_plato: result.insertId, ...data, id_restaurante: restaurant.id_restaurante });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo registrar el plato.');
  }
});

async function platoForStaff(req) {
  if (!positiveInteger(req.params.id)) throw new RuleError(400, 'El plato no es válido.');
  const [found] = await dbConnection.query('SELECT id_plato, id_restaurante FROM platos WHERE id_plato = ?', [Number(req.params.id)]);
  if (!found.length) throw new RuleError(404, 'El plato no existe.');
  await assertManagesRestaurant(dbConnection, req.user, found[0].id_restaurante);
  return found[0];
}

app.put('/api/platos/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const plato = await platoForStaff(req);
    const data = platoPayload(req.body);
    await dbConnection.query(
      'UPDATE platos SET nombre = ?, descripcion = ?, precio = ?, disponibilidad = ?, id_categoria = ? WHERE id_plato = ?',
      [data.nombre, data.descripcion, data.precio, data.disponibilidad, data.id_categoria, plato.id_plato]
    );
    res.json({ message: 'Plato actualizado con éxito.' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo actualizar el plato.');
  }
});

app.delete('/api/platos/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    const plato = await platoForStaff(req);
    await dbConnection.query('DELETE FROM platos WHERE id_plato = ?', [plato.id_plato]);
    res.json({ message: 'Plato eliminado con éxito.' });
  } catch (error) {
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'Este plato tiene pedidos registrados. Puedes marcarlo como no disponible para conservar el historial.' });
    sendRuleError(res, error, 'No se pudo eliminar el plato.');
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - RESERVAS
// Cliente: solo las suyas. Propietario: las de sus restaurantes. Administrador: todas.
// --------------------------------------------------------------------
app.get('/api/reservas', checkDbConnection, requireSession, async (req, res) => {
  try {
    const where = isAdmin(req.user) ? '' : isOwnerRole(req.user) ? 'WHERE r.id_propietario = ?' : 'WHERE res.id_usuario = ?';
    const [rows] = await dbConnection.query(`
      SELECT res.*, u.nombre AS nombre_usuario, u.correo AS correo_usuario,
             m.numero_mesa, m.ubicacion AS ubicacion_mesa, r.nombre AS nombre_restaurante, r.id_restaurante
      FROM reservas res
      INNER JOIN usuarios u ON res.id_usuario = u.id_usuario
      INNER JOIN mesas m ON res.id_mesa = m.id_mesa
      INNER JOIN restaurantes r ON m.id_restaurante = r.id_restaurante
      ${where}
      ORDER BY res.fecha_reserva DESC, res.hora_reserva DESC
    `, where ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar las reservas.');
  }
});

// Valida mesa, capacidad y que la mesa no tenga otra reserva activa el mismo día.
async function lockMesaForReservation(connection, id_mesa, fields, exceptReservation = 0) {
  if (!positiveInteger(id_mesa)) throw new RuleError(400, 'Selecciona una mesa válida.');
  const [mesas] = await connection.query(`SELECT m.id_mesa, m.capacidad, m.estado, m.numero_mesa, m.id_restaurante, r.id_propietario, r.nombre AS nombre_restaurante
    FROM mesas m JOIN restaurantes r ON r.id_restaurante = m.id_restaurante WHERE m.id_mesa = ? FOR UPDATE`, [Number(id_mesa)]);
  if (!mesas.length) throw new RuleError(404, 'La mesa no existe.');
  const mesa = mesas[0];
  if (mesa.estado === 'mantenimiento') throw new RuleError(400, 'La mesa está en mantenimiento.');
  if (fields.cantidad_personas > Number(mesa.capacidad)) throw new RuleError(400, `La ${mesa.numero_mesa} admite máximo ${mesa.capacidad} personas.`);
  const [busy] = await connection.query(`SELECT id_reserva FROM reservas WHERE id_mesa = ? AND fecha_reserva = ?
    AND estado_reserva IN ('pendiente', 'confirmada') AND id_reserva <> ? LIMIT 1`, [mesa.id_mesa, fields.fecha_reserva, exceptReservation]);
  if (busy.length) throw new RuleError(409, 'La mesa ya tiene una reserva activa ese día. Elige otra mesa o fecha.');
  return mesa;
}

async function addReminder(db, data) {
  // Solo se programa si todavía no ha pasado el momento del recordatorio.
  if (data.fecha_programada <= colombianTimestamp(now())) return;
  await db.query(`INSERT INTO recordatorios (id_usuario, tipo_recordatorio, titulo, mensaje, fecha_programada, id_reserva, id_inscripcion, id_suscripcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.id_usuario, data.tipo_recordatorio, data.titulo, data.mensaje, data.fecha_programada,
    data.id_reserva || null, data.id_inscripcion || null, data.id_suscripcion || null]);
}
app.locals.addReminder = addReminder;

function dayBefore(date, time) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - 1);
  return `${value.toISOString().slice(0, 10)} ${time}`;
}

app.post('/api/reservas', checkDbConnection, requireSession, async (req, res) => {
  let connection;
  try {
    const fields = validateReservationFields(req.body, now());
    const id_usuario = isAdmin(req.user) && positiveInteger(req.body.id_usuario) ? Number(req.body.id_usuario) : Number(req.user.id_usuario);
    connection = await dbConnection.getConnection();
    await connection.beginTransaction();
    const mesa = await lockMesaForReservation(connection, req.body.id_mesa, fields);
    const [result] = await connection.query(
      "INSERT INTO reservas (fecha_reserva, hora_reserva, cantidad_personas, estado_reserva, id_usuario, id_mesa) VALUES (?, ?, ?, 'pendiente', ?, ?)",
      [fields.fecha_reserva, fields.hora_reserva, fields.cantidad_personas, id_usuario, mesa.id_mesa]
    );
    await syncMesaEstado(connection, mesa.id_mesa);
    await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)',
      [`Tu reserva en ${mesa.nombre_restaurante} para el ${fields.fecha_reserva} a las ${fields.hora_reserva.slice(0, 5)} quedó registrada y pendiente de confirmación.`, id_usuario]);
    await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)',
      [`Nueva reserva pendiente en ${mesa.nombre_restaurante}: ${fields.fecha_reserva} ${fields.hora_reserva.slice(0, 5)}, ${fields.cantidad_personas} personas.`, mesa.id_propietario]);
    const anticipacion = [1, 3, 24].includes(Number(req.body.recordatorio_horas)) ? Number(req.body.recordatorio_horas) : 24;
    const at = new Date(Date.parse(`${fields.fecha_reserva}T${fields.hora_reserva}-05:00`) - anticipacion * 3600000);
    if (req.body.recordatorio_horas !== 0) {
      await addReminder(connection, { id_usuario, tipo_recordatorio: 'reserva', id_reserva: result.insertId, fecha_programada: colombianTimestamp(at),
        titulo: `Reserva en ${mesa.nombre_restaurante}`, mensaje: `Te esperamos el ${fields.fecha_reserva} a las ${fields.hora_reserva.slice(0, 5)} para ${fields.cantidad_personas} personas (${mesa.numero_mesa}).` });
    }
    await connection.commit();
    res.status(201).json({ id_reserva: result.insertId, ...fields, estado_reserva: 'pendiente', id_usuario, id_mesa: mesa.id_mesa });
  } catch (error) {
    if (connection) await connection.rollback();
    sendRuleError(res, error, 'No se pudo registrar la reserva.');
  } finally {
    if (connection) connection.release();
  }
});

const RESERVATION_TRANSITIONS = { pendiente: ['pendiente', 'confirmada', 'cancelada'], confirmada: ['confirmada', 'cancelada', 'finalizada'], cancelada: ['cancelada'], finalizada: ['finalizada'] };

app.put('/api/reservas/:id', checkDbConnection, requireSession, async (req, res) => {
  let connection;
  try {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La reserva no es válida.');
    connection = await dbConnection.getConnection();
    await connection.beginTransaction();
    const [found] = await connection.query(`SELECT res.*, m.id_restaurante, r.id_propietario, r.nombre AS nombre_restaurante FROM reservas res
      JOIN mesas m ON m.id_mesa = res.id_mesa JOIN restaurantes r ON r.id_restaurante = m.id_restaurante WHERE res.id_reserva = ? FOR UPDATE`, [Number(req.params.id)]);
    if (!found.length) throw new RuleError(404, 'La reserva no existe.');
    const current = found[0];
    const isClient = Number(current.id_usuario) === Number(req.user.id_usuario) && !isAdmin(req.user);
    const manages = isAdmin(req.user) || (isOwnerRole(req.user) && Number(current.id_propietario) === Number(req.user.id_usuario));
    if (!isClient && !manages) throw new RuleError(403, 'No puedes modificar esta reserva.');
    const estado = req.body.estado_reserva || current.estado_reserva;
    if (!RESERVATION_TRANSITIONS[current.estado_reserva]?.includes(estado)) throw new RuleError(400, `Una reserva ${current.estado_reserva} no puede pasar a ${estado}.`);
    if (isClient && !manages && !['pendiente', 'cancelada', current.estado_reserva].includes(estado)) throw new RuleError(403, 'Solo el restaurante confirma o finaliza reservas.');
    const changingSchedule = ['pendiente', 'confirmada'].includes(estado) && (
      req.body.fecha_reserva !== undefined && req.body.fecha_reserva !== String(current.fecha_reserva).slice(0, 10) ||
      req.body.hora_reserva !== undefined && req.body.hora_reserva.slice(0, 5) !== String(current.hora_reserva).slice(0, 5) ||
      req.body.cantidad_personas !== undefined && Number(req.body.cantidad_personas) !== Number(current.cantidad_personas) ||
      req.body.id_mesa !== undefined && Number(req.body.id_mesa) !== Number(current.id_mesa));
    let fields = { fecha_reserva: String(current.fecha_reserva).slice(0, 10), hora_reserva: String(current.hora_reserva), cantidad_personas: Number(current.cantidad_personas) };
    let id_mesa = Number(current.id_mesa);
    if (changingSchedule) {
      if (current.estado_reserva !== 'pendiente' && !manages) throw new RuleError(400, 'Una reserva confirmada solo la reprograma el restaurante.');
      fields = validateReservationFields({ fecha_reserva: req.body.fecha_reserva ?? fields.fecha_reserva, hora_reserva: req.body.hora_reserva ?? fields.hora_reserva, cantidad_personas: req.body.cantidad_personas ?? fields.cantidad_personas }, now());
      const mesa = await lockMesaForReservation(connection, req.body.id_mesa ?? current.id_mesa, fields, current.id_reserva);
      if (Number(mesa.id_restaurante) !== Number(current.id_restaurante)) throw new RuleError(400, 'La nueva mesa debe pertenecer al mismo restaurante.');
      id_mesa = mesa.id_mesa;
    }
    await connection.query('UPDATE reservas SET fecha_reserva = ?, hora_reserva = ?, cantidad_personas = ?, estado_reserva = ?, id_mesa = ? WHERE id_reserva = ?',
      [fields.fecha_reserva, fields.hora_reserva, fields.cantidad_personas, estado, id_mesa, current.id_reserva]);
    await syncMesaEstado(connection, current.id_mesa);
    if (id_mesa !== Number(current.id_mesa)) await syncMesaEstado(connection, id_mesa);
    if (['cancelada', 'finalizada'].includes(estado)) await connection.query('DELETE FROM recordatorios WHERE id_reserva = ? AND enviado = FALSE', [current.id_reserva]);
    else if (changingSchedule) await connection.query('UPDATE recordatorios SET fecha_programada = ?, mensaje = ? WHERE id_reserva = ? AND enviado = FALSE',
      [dayBefore(fields.fecha_reserva, fields.hora_reserva), `Te esperamos el ${fields.fecha_reserva} a las ${fields.hora_reserva.slice(0, 5)} para ${fields.cantidad_personas} personas.`, current.id_reserva]);
    if (estado !== current.estado_reserva) {
      await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)',
        [`Tu reserva en ${current.nombre_restaurante} del ${fields.fecha_reserva} ahora está ${estado}.`, current.id_usuario]);
    }
    await connection.commit();
    res.json({ message: 'Reserva actualizada con éxito.' });
  } catch (error) {
    if (connection) await connection.rollback();
    sendRuleError(res, error, 'No se pudo actualizar la reserva.');
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/reservas/:id', checkDbConnection, requireStaff, async (req, res) => {
  try {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La reserva no es válida.');
    const [found] = await dbConnection.query('SELECT res.id_mesa, m.id_restaurante FROM reservas res JOIN mesas m ON m.id_mesa = res.id_mesa WHERE res.id_reserva = ?', [Number(req.params.id)]);
    if (!found.length) throw new RuleError(404, 'La reserva no existe.');
    await assertManagesRestaurant(dbConnection, req.user, found[0].id_restaurante);
    await dbConnection.query('DELETE FROM reservas WHERE id_reserva = ?', [Number(req.params.id)]);
    await syncMesaEstado(dbConnection, found[0].id_mesa);
    res.json({ message: 'Reserva eliminada con éxito.' });
  } catch (error) {
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'La reserva ya tiene asistencia registrada; cámbiala de estado en lugar de eliminarla.' });
    sendRuleError(res, error, 'No se pudo eliminar la reserva.');
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - PEDIDOS Y DETALLE
// --------------------------------------------------------------------
app.get('/api/pedidos', checkDbConnection, requireSession, async (req, res) => {
  try {
    const where = isAdmin(req.user) ? '' : isOwnerRole(req.user) ? 'WHERE r.id_propietario = ?' : 'WHERE p.id_usuario = ?';
    const [pedidos] = await dbConnection.query(`
      SELECT p.*, u.nombre AS nombre_usuario, r.nombre AS nombre_restaurante
      FROM pedidos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
      INNER JOIN restaurantes r ON p.id_restaurante = r.id_restaurante
      ${where}
      ORDER BY p.fecha_pedido DESC
    `, where ? [req.user.id_usuario] : []);
    if (pedidos.length) {
      // Una sola consulta para todos los detalles en lugar de una por pedido.
      const [detalles] = await dbConnection.query(`
        SELECT dp.*, plato.nombre AS nombre_plato
        FROM detalle_pedidos dp
        INNER JOIN platos plato ON dp.id_plato = plato.id_plato
        WHERE dp.id_pedido IN (?)
      `, [pedidos.map(p => p.id_pedido)]);
      const byOrder = new Map();
      detalles.forEach(d => { if (!byOrder.has(d.id_pedido)) byOrder.set(d.id_pedido, []); byOrder.get(d.id_pedido).push(d); });
      pedidos.forEach(p => { p.detalles = byOrder.get(p.id_pedido) || []; });
    }
    res.json(pedidos);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar los pedidos.');
  }
});

app.post('/api/pedidos', checkDbConnection, async (req, res) => {
  const { tipo_servicio, direccion_entrega, id_usuario, id_restaurante, platos } = req.body;
  // platos es un array de { id_plato, cantidad, precio_unitario }
  
  if (!['delivery', 'comedor'].includes(tipo_servicio) || !positiveInteger(id_restaurante) ||
      !positiveInteger(id_usuario) || !Array.isArray(platos) || !platos.length || platos.length > 100 ||
      platos.some(p => !positiveInteger(p.id_plato) || !positiveInteger(p.cantidad) || p.cantidad > 1000) ||
      new Set(platos.map(p => Number(p.id_plato))).size !== platos.length ||
      (tipo_servicio === 'delivery' && (!direccion_entrega || String(direccion_entrega).length > 255))) {
    return res.status(400).json({ error: 'Revisa el tipo de servicio, restaurante, usuario y platos del pedido.' });
  }
  if (req.user.tipo_usuario === 'cliente' && Number(id_usuario) !== Number(req.user.id_usuario)) return res.status(403).json({ error: 'Solo puedes crear tus propios pedidos.' });
  let connection;
  try {
    connection = await dbConnection.getConnection();
    await connection.beginTransaction();
    const priced = [];
    let totalCents = 0;
    for (const item of platos) {
      const [menu] = await connection.query('SELECT id_plato, id_restaurante, precio, disponibilidad FROM platos WHERE id_plato = ? FOR UPDATE', [item.id_plato]);
      if (!menu.length || !menu[0].disponibilidad || Number(menu[0].id_restaurante) !== Number(id_restaurante)) {
        const error = new Error('Todos los platos deben estar disponibles y pertenecer al restaurante del pedido.'); error.status = 400; throw error;
      }
      const cents = Math.round(Number(menu[0].precio) * 100);
      totalCents += cents * Number(item.cantidad);
      priced.push({ id_plato: Number(item.id_plato), cantidad: Number(item.cantidad), precio_unitario: cents / 100 });
    }
    const total_pago = totalCents / 100;
    
    // Insertar Pedido
    const [result] = await connection.query(
      'INSERT INTO pedidos (tipo_servicio, estado_pedido, total_pago, direccion_entrega, id_usuario, id_restaurante) VALUES (?, "en preparacion", ?, ?, ?, ?)',
      [tipo_servicio, total_pago, direccion_entrega || null, id_usuario, id_restaurante]
    );
    const id_pedido = result.insertId;
    
    // Insertar Detalles
    for (let plato of priced) {
      await connection.query(
        'INSERT INTO detalle_pedidos (id_pedido, id_plato, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [id_pedido, plato.id_plato, plato.cantidad, plato.precio_unitario]
      );
    }
    
    await connection.commit();
    res.status(201).json({ id_pedido, tipo_servicio, total_pago, direccion_entrega, id_usuario, id_restaurante, platos: priced });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el pedido.' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/pedidos/:id', checkDbConnection, requireSession, async (req, res) => {
  try {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'El pedido no es válido.');
    const { estado_pedido } = req.body;
    if (!Object.hasOwn(ORDER_TRANSITIONS, estado_pedido)) throw new RuleError(400, 'El estado del pedido no es válido.');
    const [found] = await dbConnection.query(`SELECT p.id_pedido, p.estado_pedido, p.tipo_servicio, p.id_usuario, r.id_propietario, r.nombre AS nombre_restaurante
      FROM pedidos p JOIN restaurantes r ON r.id_restaurante = p.id_restaurante WHERE p.id_pedido = ?`, [Number(req.params.id)]);
    if (!found.length) throw new RuleError(404, 'El pedido no existe.');
    const order = found[0];
    const manages = isAdmin(req.user) || (isOwnerRole(req.user) && Number(order.id_propietario) === Number(req.user.id_usuario));
    const ownClientCancel = Number(order.id_usuario) === Number(req.user.id_usuario) && estado_pedido === 'cancelado' && order.estado_pedido === 'en preparacion';
    if (!manages && !ownClientCancel) throw new RuleError(403, 'Solo el restaurante actualiza el estado; el cliente puede cancelar mientras está en preparación.');
    if (!ORDER_TRANSITIONS[order.estado_pedido].includes(estado_pedido)) throw new RuleError(400, `Un pedido ${order.estado_pedido} no puede pasar a ${estado_pedido}.`);
    if (estado_pedido === 'en camino' && order.tipo_servicio !== 'delivery') throw new RuleError(400, 'Solo los pedidos a domicilio pueden estar en camino.');
    await dbConnection.query('UPDATE pedidos SET estado_pedido = ? WHERE id_pedido = ?', [estado_pedido, order.id_pedido]);
    await dbConnection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)',
      [`Tu pedido #${order.id_pedido} de ${order.nombre_restaurante} ahora está: ${estado_pedido}.`, order.id_usuario]);
    res.json({ message: 'Estado del pedido actualizado.' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo actualizar el pedido.');
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - RESEÑAS
// --------------------------------------------------------------------
app.get('/api/resenas', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT re.*, u.nombre AS nombre_usuario, r.nombre AS nombre_restaurante
      FROM resenas re
      INNER JOIN usuarios u ON re.id_usuario = u.id_usuario
      INNER JOIN restaurantes r ON re.id_restaurante = r.id_restaurante
      ORDER BY re.fecha_opinion DESC
    `);
    res.json(rows);
  } catch (error) {
    sendRuleError(res, error, 'No se pudieron consultar las reseñas.');
  }
});

app.post('/api/resenas', checkDbConnection, requireSession, async (req, res) => {
  try {
    const calificacion = integerInRange(req.body.calificacion, { min: 1, max: 5, field: 'calificación' });
    const comentario = cleanText(req.body.comentario, { max: 2000, required: false, field: 'comentario' });
    const restaurant = await restaurantFor(dbConnection, req.body.id_restaurante);
    // La reseña siempre queda a nombre de quien inició sesión.
    await dbConnection.query(
      'INSERT INTO resenas (calificacion, comentario, fecha_opinion, id_usuario, id_restaurante) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), comentario = VALUES(comentario), fecha_opinion = VALUES(fecha_opinion)',
      [calificacion, comentario, bogotaDate(now()), req.user.id_usuario, restaurant.id_restaurante]
    );
    res.status(201).json({ success: true, message: 'Reseña enviada.' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo guardar la reseña.');
  }
});

// --------------------------------------------------------------------
// ENDPOINTS AUXILIARES: ZONAS, CATEGORÍAS, PLANES, MÉTODOS PAGO
// --------------------------------------------------------------------
app.get('/api/zonas', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT * FROM zonas ORDER BY nombre_zona');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categorias', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT * FROM categorias ORDER BY nombre_categoria');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/planes', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT * FROM planes_suscripcion ORDER BY costo');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metodos_pago', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT * FROM metodos_pago ORDER BY nombre_metodo');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------------------------
// ENDPOINT PAGOS
// --------------------------------------------------------------------
app.post('/api/pagos', checkDbConnection, async (req, res) => {
  const { monto, id_usuario, id_metodo, id_pedido, id_plan, id_inscripcion } = req.body;
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0 || !positiveInteger(id_usuario) || !positiveInteger(id_metodo) ||
      [id_pedido, id_plan, id_inscripcion].filter(Boolean).length !== 1 || (id_pedido && !positiveInteger(id_pedido)) || (id_plan && !positiveInteger(id_plan))) {
    return res.status(400).json({ error: 'El pago debe tener un monto positivo y corresponder a un pedido o a un plan, exclusivamente.' });
  }
  if (Number(id_usuario) !== Number(req.user.id_usuario) && req.user.tipo_usuario !== 'administrador') return res.status(403).json({ error: 'Solo puedes registrar tus propios pagos.' });
  // Planes y experiencias se pagan en su propio flujo, que también registra la suscripción o la inscripción.
  if (!id_pedido) return res.status(400).json({ error: 'Los planes se pagan desde Planes y suscripción, y las experiencias al inscribirse.' });
  try {
    const [orders] = await dbConnection.query('SELECT id_pedido, id_usuario, total_pago, estado_pedido FROM pedidos WHERE id_pedido = ?', [Number(id_pedido)]);
    if (!orders.length) throw new RuleError(404, 'El pedido no existe.');
    if (Number(orders[0].id_usuario) !== Number(id_usuario)) throw new RuleError(400, 'El pago debe registrarlo quien hizo el pedido.');
    if (orders[0].estado_pedido === 'cancelado') throw new RuleError(400, 'No se puede pagar un pedido cancelado.');
    if (Math.round(Number(monto) * 100) !== Math.round(Number(orders[0].total_pago) * 100)) throw new RuleError(400, 'El monto debe coincidir con el total del pedido.');
    const [paid] = await dbConnection.query("SELECT id_pago FROM pagos WHERE id_pedido = ? AND estado_pago = 'aprobado' LIMIT 1", [Number(id_pedido)]);
    if (paid.length) throw new RuleError(409, 'Este pedido ya tiene un pago aprobado.');
    const [methods] = await dbConnection.query('SELECT id_metodo FROM metodos_pago WHERE id_metodo = ?', [Number(id_metodo)]);
    if (!methods.length) throw new RuleError(400, 'El medio de pago no existe.');
    const [result] = await dbConnection.query(
      'INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_pedido) VALUES (?, "aprobado", ?, ?, ?)',
      [orders[0].total_pago, id_usuario, id_metodo, id_pedido]
    );
    res.status(201).json({ id_pago: result.insertId, status: 'aprobado' });
  } catch (error) {
    sendRuleError(res, error, 'No se pudo registrar el pago.');
  }
});

// --------------------------------------------------------------------
// ENDPOINT NOTIFICACIONES
// --------------------------------------------------------------------
app.get('/api/notificaciones/:userId', requireSession, checkDbConnection, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!/^[1-9]\d*$/.test(req.params.userId) || !positiveInteger(userId)) {
    return res.status(400).json({ error: 'El usuario debe tener un identificador válido.' });
  }
  if (userId !== Number(req.user.id_usuario)) {
    return res.status(403).json({ error: 'Solo puedes consultar tus propias notificaciones.' });
  }
  try {
    const [rows] = await dbConnection.query(
      'SELECT * FROM notificaciones WHERE id_usuario = ? ORDER BY fecha_envio DESC, id_notificacion DESC',
      [req.user.id_usuario]
    );
    res.json(rows);
  } catch (_) {
    res.status(500).json({ error: 'No se pudieron consultar las notificaciones.' });
  }
});

app.put('/api/notificaciones/leer/:id', requireSession, checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || !positiveInteger(id)) {
    return res.status(400).json({ error: 'La notificación debe tener un identificador válido.' });
  }
  try {
    const params = [id, req.user.id_usuario];
    const [result] = await dbConnection.query(
      'UPDATE notificaciones SET leido = TRUE WHERE id_notificacion = ? AND id_usuario = ?', params
    );
    if (!result.affectedRows) {
      // Algunos clientes cuentan solo cambios: una notificación propia ya leída sigue siendo válida.
      const [existing] = await dbConnection.query(
        'SELECT id_notificacion FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ? LIMIT 1', params
      );
      if (!existing.length) return res.status(404).json({ error: 'La notificación no está disponible.' });
    }
    res.json({ message: 'Notificación marcada como leída.' });
  } catch (_) {
    res.status(500).json({ error: 'No se pudo marcar la notificación como leída.' });
  }
});

// --------------------------------------------------------------------
// ENDPOINTS PARA LOS 10 REPORTES DEL SISTEMA
// --------------------------------------------------------------------
app.get('/api/reportes/1', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT nombre AS 'Restaurante', direccion AS 'Direccion', telefono AS 'Telefono', email AS 'Correo', capacidad_total AS 'Aforo' 
      FROM restaurantes ORDER BY nombre
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/2', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT nombre AS 'Cliente', correo AS 'Email', telefono AS 'Celular', DATE_FORMAT(fecha_registro, '%Y-%m-%d') AS 'Registro' 
      FROM usuarios WHERE tipo_usuario = 'cliente' ORDER BY fecha_registro DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/3', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT nombre AS 'Plato', descripcion AS 'Descripcion', precio AS 'Precio', IF(disponibilidad, 'Sí', 'No') AS 'Disponible' 
      FROM platos WHERE disponibilidad = TRUE ORDER BY precio
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/4', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(re.id_resena) AS 'Total Resenas', ROUND(AVG(re.calificacion), 1) AS 'Calificacion Promedio' 
      FROM restaurantes r LEFT JOIN resenas re ON r.id_restaurante = re.id_restaurante 
      GROUP BY r.id_restaurante, r.nombre ORDER BY AVG(re.calificacion) DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/5', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT z.nombre_zona AS 'Zona', z.ciudad AS 'Municipio', COUNT(res.id_reserva) AS 'Reservas' 
      FROM zonas z 
      INNER JOIN restaurantes r ON z.id_zona = r.id_zona 
      INNER JOIN mesas m ON r.id_restaurante = m.id_restaurante 
      INNER JOIN reservas res ON m.id_mesa = res.id_mesa 
      GROUP BY z.id_zona, z.nombre_zona, z.ciudad ORDER BY Reservas DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/6', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(p.id_pedido) AS 'Pedidos', COALESCE(SUM(p.total_pago), 0) AS 'Ingresos Totales' 
      FROM restaurantes r 
      LEFT JOIN pedidos p ON r.id_restaurante = p.id_restaurante AND p.estado_pedido = 'entregado' 
      GROUP BY r.id_restaurante, r.nombre ORDER BY \`Ingresos Totales\` DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/7', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(m.id_mesa) AS 'Total Mesas', 
             SUM(CASE WHEN m.estado = 'disponible' THEN 1 ELSE 0 END) AS 'Disponibles', 
             SUM(CASE WHEN m.estado = 'reservada' THEN 1 ELSE 0 END) AS 'Reservadas' 
      FROM restaurantes r INNER JOIN mesas m ON r.id_restaurante = m.id_restaurante 
      GROUP BY r.id_restaurante, r.nombre
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/8', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', ROUND(AVG(re.calificacion), 2) AS 'Calificacion' 
      FROM restaurantes r INNER JOIN resenas re ON r.id_restaurante = re.id_restaurante 
      GROUP BY r.id_restaurante, r.nombre 
      HAVING AVG(re.calificacion) > (SELECT AVG(calificacion) FROM resenas)
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/9', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT u.nombre AS 'Cliente', u.correo AS 'Email', COUNT(r.id_reserva) AS 'Total Reservas' 
      FROM usuarios u INNER JOIN reservas r ON u.id_usuario = r.id_usuario 
      WHERE u.tipo_usuario = 'cliente'
      GROUP BY u.id_usuario, u.nombre, u.correo 
      HAVING COUNT(r.id_reserva) > (
          SELECT AVG(total_res) FROM (
              SELECT COUNT(r2.id_reserva) AS total_res
              FROM usuarios u2 INNER JOIN reservas r2 ON u2.id_usuario = r2.id_usuario
              WHERE u2.tipo_usuario = 'cliente'
              GROUP BY u2.id_usuario
          ) AS sub
      ) ORDER BY \`Total Reservas\` DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/10', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT p.nombre AS 'Plato', c.nombre_categoria AS 'Categoria', SUM(dp.cantidad) AS 'Vendidos' 
      FROM platos p 
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria 
      INNER JOIN detalle_pedidos dp ON p.id_plato = dp.id_plato 
      GROUP BY p.id_plato, p.nombre, p.id_categoria, c.nombre_categoria 
      HAVING SUM(dp.cantidad) >= (
          -- Media de unidades vendidas por plato con ventas en la misma categoría (subconsulta correlacionada).
          -- Se evita una tabla derivada con referencia externa: MariaDB (XAMPP) la evalúa de forma incorrecta.
          SELECT SUM(dp2.cantidad) * 1.0 / COUNT(DISTINCT p2.id_plato)
          FROM platos p2
          INNER JOIN detalle_pedidos dp2 ON p2.id_plato = dp2.id_plato
          WHERE p2.id_categoria = p.id_categoria
      ) ORDER BY \`Vendidos\` DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

registerExtraRoutes(app, { getDb: () => dbConnection, checkDbConnection, requireSession, requireStaff, now, colombianTimestamp });

app.locals.initDB = initDB;
app.locals.processReminders = () => dbConnection ? processReminders(dbConnection, now) : Promise.resolve(0);
app.locals.closeDB = async () => { if (dbConnection?.end) await dbConnection.end(); };
return app;
}

async function start() {
  const app = createApp();
  await app.locals.initDB();
  const port = Number(process.env.PORT) || 3000;
  // Cada minuto se envían como notificación los recordatorios cuya hora ya llegó.
  const runReminders = () => app.locals.processReminders().catch(() => {});
  runReminders();
  setInterval(runReminders, 60 * 1000).unref();
  return app.listen(port, '127.0.0.1', () => console.log(`GastroTurismo disponible en http://localhost:${port}`));
}

if (require.main === module) start().catch(() => { console.error('No fue posible iniciar GastroTurismo.'); process.exitCode = 1; });
module.exports = { createApp, start };
