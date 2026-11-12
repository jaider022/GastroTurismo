const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { comparisonPeriods, bogotaDate, validDate } = require('./lib/periods');
const { hashPassword, verifyPassword } = require('./lib/passwords');
const { catalogId } = require('./lib/catalogos');
const { managementPayload, sendManagementError, updateCapacity } = require('./lib/gestion');
const { registerReservations } = require('./lib/reservas');
const { registerExperiences } = require('./lib/experiencias');
const { processReservationReminders } = require('./lib/recordatorios');
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
    error: dbError,
    reservasMultiples: true
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

app.use('/api/reportes', requireStaff, (req, res, next) => {
  const number = Number(req.path.split('/')[1]);
  if (req.user.tipo_usuario !== 'administrador' && [2, 9, 12].includes(number)) {
    return res.status(403).json({ error: 'Este reporte general requiere una cuenta de administrador.' });
  }
  next();
});

function colombianTimestamp(value) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(value);
  return parts.replace(',', '');
}

function positiveInteger(value) { return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647; }

async function assertRestaurantOwner(db, user, id) {
  if (!positiveInteger(id)) throw Object.assign(new Error('Restaurante inválido.'), { status: 400 });
  const [[restaurant]] = await db.query('SELECT id_propietario FROM restaurantes WHERE id_restaurante=?', [Number(id)]);
  if (!restaurant) throw Object.assign(new Error('El restaurante no existe.'), { status: 404 });
  if (user.tipo_usuario !== 'administrador' && (user.tipo_usuario !== 'restaurante' || Number(restaurant.id_propietario) !== Number(user.id_usuario))) {
    throw Object.assign(new Error('Solo puedes gestionar tus propios restaurantes.'), { status: 403 });
  }
}

for (const table of ['restaurantes', 'mesas', 'platos']) {
  app.use(`/api/${table}`, async (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
    if (!['administrador', 'restaurante'].includes(req.user?.tipo_usuario)) return res.status(403).json({ error: 'Esta operación requiere una cuenta de gestión.' });
    if (!dbConnection) return next();
    const key = { restaurantes: 'id_restaurante', mesas: 'id_mesa', platos: 'id_plato' }[table];
    try {
      const id = req.path.split('/').filter(Boolean)[0];
      if (req.method !== 'POST') {
        if (!positiveInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
        const [[row]] = await dbConnection.query(`SELECT id_restaurante FROM ${table} WHERE ${key}=?`, [Number(id)]);
        if (!row) return res.status(404).json({ error: 'El registro no existe.' });
        await assertRestaurantOwner(dbConnection, req.user, row.id_restaurante);
        if (table !== 'restaurantes' && req.method === 'PUT' && Number(req.body.id_restaurante) !== Number(row.id_restaurante)) {
          return res.status(400).json({ error: 'La mesa o plato debe conservar su restaurante.' });
        }
      } else if (table !== 'restaurantes') await assertRestaurantOwner(dbConnection, req.user, req.body.id_restaurante);
      if (table === 'restaurantes' && req.method !== 'DELETE' && req.user.tipo_usuario === 'restaurante') req.body.id_propietario = req.user.id_usuario;
      if (req.method !== 'DELETE') {
        req.body = managementPayload(table, req.body);
        if (table === 'restaurantes') {
          const [[owner]] = await dbConnection.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario=?', [req.body.id_propietario]);
          if (!owner || !['restaurante', 'administrador'].includes(owner.tipo_usuario)) return res.status(400).json({ error: 'Selecciona una cuenta de propietario o administrador.' });
        }
      }
      if (table === 'restaurantes' && req.method === 'DELETE') {
        const [[history]] = await dbConnection.query(`SELECT (
          EXISTS(SELECT 1 FROM pedidos WHERE id_restaurante=?) OR
          EXISTS(SELECT 1 FROM reserva_mesas rm JOIN mesas m ON m.id_mesa=rm.id_mesa WHERE m.id_restaurante=?) OR
          EXISTS(SELECT 1 FROM visitas WHERE id_restaurante=?)) AS ocupado`, [id, id, id]);
        if (history.ocupado) return res.status(409).json({ error: 'El restaurante tiene historial de reservas, pedidos o visitas.' });
      }
      next();
    } catch (error) {
      sendManagementError(res, error);
    }
  });
}

app.get('/api/usuarios', checkDbConnection, requireSession, async (req, res) => {
  try {
    const role = req.user.tipo_usuario;
    const scope = role === 'administrador' ? '' : role === 'restaurante' ? " WHERE tipo_usuario = 'cliente' OR id_usuario = ?" : ' WHERE id_usuario = ?';
    const fields = role === 'administrador' || role === 'cliente' ? 'id_usuario, nombre, correo, telefono, tipo_usuario, fecha_registro' : 'id_usuario, nombre, tipo_usuario';
    const [rows] = await dbConnection.query(`SELECT ${fields} FROM usuarios${scope} ORDER BY nombre`, scope ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch { res.status(500).json({ error: 'No se pudieron consultar los usuarios.' }); }
});

app.get('/api/visitas', checkDbConnection, requireSession, requireStaff, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`SELECT v.*, r.nombre AS nombre_restaurante, u.nombre AS nombre_usuario
      FROM visitas v JOIN restaurantes r ON r.id_restaurante = v.id_restaurante
      LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario ${req.user.tipo_usuario === 'restaurante' ? 'WHERE r.id_propietario=?' : ''} ORDER BY v.fecha_ingreso DESC`,
      req.user.tipo_usuario === 'restaurante' ? [req.user.id_usuario] : []);
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
      const [reservations] = await dbConnection.query(`SELECT r.id_reserva, r.id_usuario, r.fecha_reserva, er.codigo AS estado_reserva,
        MIN(m.id_restaurante) AS id_restaurante, LEAST(SUM(m.capacidad),?) AS capacidad
        FROM reservas r JOIN estados_reserva er ON er.id_estado_reserva=r.id_estado_reserva
        JOIN reserva_mesas rm ON rm.id_reserva=r.id_reserva JOIN mesas m ON m.id_mesa=rm.id_mesa WHERE r.id_reserva=?
        GROUP BY r.id_reserva,r.id_usuario,r.fecha_reserva,er.codigo HAVING COUNT(DISTINCT m.id_restaurante)=1`, [restaurants[0].capacidad_total, id_reserva]);
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
          if (req.user.tipo_usuario === 'restaurante') {
            sql += ' AND id_restaurante IN (SELECT id_restaurante FROM restaurantes WHERE id_propietario=?)';
            params.push(req.user.id_usuario);
          }
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
// --------------------------------------------------------------------
app.get('/api/restaurantes', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT r.id_restaurante, r.nombre, r.direccion, r.telefono, r.email,
             r.capacidad_total, r.especialidad, r.id_zona, r.id_propietario,
             z.nombre_zona, mu.nombre_municipio AS ciudad, z.id_municipio, u.nombre AS nombre_propietario
      FROM restaurantes r
      INNER JOIN zonas z ON r.id_zona = z.id_zona
      INNER JOIN municipios mu ON mu.id_municipio=z.id_municipio
      INNER JOIN usuarios u ON r.id_propietario = u.id_usuario
      ORDER BY r.nombre ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurantes', checkDbConnection, async (req, res) => {
  const { nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO restaurantes (nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario]
    );
    res.status(201).json({ id_restaurante: result.insertId, nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario });
  } catch (error) {
    sendManagementError(res, error);
  }
});

app.put('/api/restaurantes/:id', checkDbConnection, async (req, res) => {
  try {
    await updateCapacity(dbConnection, 'restaurantes', Number(req.params.id), req.body, colombianTimestamp(now()));
    res.json({ message: 'Restaurante actualizado con éxito.' });
  } catch (error) { sendManagementError(res, error); }
});

app.delete('/api/restaurantes/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM restaurantes WHERE id_restaurante = ?', [id]);
    res.json({ message: 'Restaurante eliminado con éxito.' });
  } catch (error) {
    sendManagementError(res, error);
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
    sendManagementError(res, error);
  }
});

app.post('/api/mesas', checkDbConnection, async (req, res) => {
  const { numero_mesa, capacidad, ubicacion, estado, id_restaurante } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO mesas (numero_mesa, capacidad, ubicacion, estado, id_restaurante) VALUES (?, ?, ?, ?, ?)',
      [numero_mesa, capacidad, ubicacion, estado || 'disponible', id_restaurante]
    );
    res.status(201).json({ id_mesa: result.insertId, ...req.body });
  } catch (error) {
    sendManagementError(res, error);
  }
});

app.put('/api/mesas/:id', checkDbConnection, async (req, res) => {
  try {
    await updateCapacity(dbConnection, 'mesas', Number(req.params.id), req.body, colombianTimestamp(now()));
    res.json({ message: 'Mesa actualizado con éxito.' });
  } catch (error) { sendManagementError(res, error); }
});

app.delete('/api/mesas/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM mesas WHERE id_mesa = ?', [id]);
    res.json({ message: 'Mesa eliminada con éxito.' });
  } catch (error) {
    sendManagementError(res, error);
  }
});

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
    sendManagementError(res, error);
  }
});

app.post('/api/platos', checkDbConnection, async (req, res) => {
  const { nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO platos (nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, descripcion, precio, disponibilidad !== undefined ? disponibilidad : 1, id_categoria, id_restaurante]
    );
    res.status(201).json({ id_plato: result.insertId, ...req.body });
  } catch (error) {
    sendManagementError(res, error);
  }
});

app.put('/api/platos/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante } = req.body;
  try {
    await dbConnection.query(
      'UPDATE platos SET nombre = ?, descripcion = ?, precio = ?, disponibilidad = ?, id_categoria = ?, id_restaurante = ? WHERE id_plato = ?',
      [nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante, id]
    );
    res.json({ message: 'Plato actualizado con éxito.' });
  } catch (error) {
    sendManagementError(res, error);
  }
});

app.delete('/api/platos/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM platos WHERE id_plato = ?', [id]);
    res.json({ message: 'Plato eliminado con éxito.' });
  } catch (error) {
    sendManagementError(res, error);
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - RESERVAS
// --------------------------------------------------------------------
registerReservations(app, { getDb: () => dbConnection, checkDbConnection, requireSession, now });
registerExperiences(app, { getDb: () => dbConnection, checkDbConnection, requireSession, requireStaff, now, timestamp: colombianTimestamp });

// --------------------------------------------------------------------
// ENDPOINTS CRUD - PEDIDOS Y DETALLE
// --------------------------------------------------------------------
app.get('/api/pedidos', requireSession, checkDbConnection, async (req, res) => {
  try {
    const scope = req.user.tipo_usuario === 'administrador' ? '' : req.user.tipo_usuario === 'restaurante' ? 'WHERE r.id_propietario=?' : 'WHERE p.id_usuario=?';
    const [pedidos] = await dbConnection.query(`
      SELECT p.*, t.codigo AS tipo_servicio, ep.codigo AS estado_pedido, u.nombre AS nombre_usuario, r.nombre AS nombre_restaurante
      FROM pedidos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
      INNER JOIN restaurantes r ON p.id_restaurante = r.id_restaurante
      INNER JOIN tipos_servicio t ON t.id_tipo_servicio=p.id_tipo_servicio
      INNER JOIN estados_pedido ep ON ep.id_estado_pedido=p.id_estado_pedido
      ${scope}
      ORDER BY p.fecha_pedido DESC
    `, scope ? [req.user.id_usuario] : []);
    
    // Obtener detalles de cada pedido
    for (let p of pedidos) {
      const [detalles] = await dbConnection.query(`
        SELECT dp.*, plato.nombre AS nombre_plato
        FROM detalle_pedidos dp
        INNER JOIN platos plato ON dp.id_plato = plato.id_plato
        WHERE dp.id_pedido = ?
      `, [p.id_pedido]);
      p.detalles = detalles;
    }
    
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pedidos', checkDbConnection, async (req, res) => {
  const { tipo_servicio, direccion_entrega, id_usuario, id_restaurante, platos } = req.body;
  const address = typeof direccion_entrega === 'string' ? direccion_entrega.trim() : '';
  // platos es un array de { id_plato, cantidad, precio_unitario }
  
  if (!['delivery', 'comedor'].includes(tipo_servicio) || !positiveInteger(id_restaurante) ||
      !positiveInteger(id_usuario) || !Array.isArray(platos) || !platos.length || platos.length > 100 ||
      platos.some(p => !positiveInteger(p.id_plato) || !positiveInteger(p.cantidad) || p.cantidad > 1000) ||
      new Set(platos.map(p => Number(p.id_plato))).size !== platos.length ||
      (tipo_servicio === 'delivery' && (!address || address.length > 255))) {
    return res.status(400).json({ error: 'Revisa el tipo de servicio, restaurante, usuario y platos del pedido.' });
  }
  if (req.user.tipo_usuario === 'cliente' && Number(id_usuario) !== Number(req.user.id_usuario)) return res.status(403).json({ error: 'Solo puedes crear tus propios pedidos.' });
  let connection;
  try {
    connection = await dbConnection.getConnection();
    await connection.beginTransaction();
    if (req.user.tipo_usuario === 'restaurante') await assertRestaurantOwner(connection, req.user, id_restaurante);
    const service = await catalogId(connection, 'tipos_servicio', tipo_servicio);
    const state = await catalogId(connection, 'estados_pedido', 'en preparacion');
    if (!service || !state) throw Object.assign(new Error('Falta actualizar los catálogos de pedidos.'), { status: 503 });
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
      'INSERT INTO pedidos (id_tipo_servicio, id_estado_pedido, total_pago, direccion_entrega, id_usuario, id_restaurante) VALUES (?, ?, ?, ?, ?, ?)',
      [service, state, total_pago, tipo_servicio === 'delivery' ? address : null, id_usuario, id_restaurante]
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
    res.status(201).json({ id_pedido, tipo_servicio, total_pago, direccion_entrega: tipo_servicio === 'delivery' ? address : null, id_usuario, id_restaurante, platos: priced });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el pedido.' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/pedidos/:id', checkDbConnection, requireStaff, async (req, res) => {
  const { id } = req.params;
  const { estado_pedido } = req.body;
  try {
    const [[order]] = await dbConnection.query(`SELECT p.id_restaurante,p.id_estado_pedido,e.codigo AS estado,t.codigo AS servicio
      FROM pedidos p JOIN estados_pedido e ON e.id_estado_pedido=p.id_estado_pedido
      JOIN tipos_servicio t ON t.id_tipo_servicio=p.id_tipo_servicio WHERE p.id_pedido=?`, [id]);
    if (!order) return res.status(404).json({ error: 'El pedido no existe.' });
    await assertRestaurantOwner(dbConnection, req.user, order.id_restaurante);
    const allowed = { 'en preparacion': ['en camino', 'entregado', 'cancelado'], 'en camino': ['entregado', 'cancelado'], entregado: [], cancelado: [] };
    if (estado_pedido === order.estado) return res.json({ message: 'El pedido ya está en ese estado.' });
    if (!allowed[order.estado]?.includes(estado_pedido) || (estado_pedido === 'en camino' && order.servicio !== 'delivery')) {
      return res.status(409).json({ error: 'Ese cambio de estado no corresponde al pedido.' });
    }
    const state = await catalogId(dbConnection, 'estados_pedido', estado_pedido);
    if (!state) return res.status(503).json({ error: 'Falta actualizar los estados de pedido.' });
    const [result] = await dbConnection.query('UPDATE pedidos SET id_estado_pedido=? WHERE id_pedido=? AND id_estado_pedido=?', [state, id, order.id_estado_pedido]);
    if (!result.affectedRows) return res.status(409).json({ error: 'El estado cambió. Actualiza la lista de pedidos.' });
    res.json({ message: 'Estado del pedido actualizado.' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo actualizar el pedido.' });
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/resenas', checkDbConnection, async (req, res) => {
  const { calificacion, comentario, id_usuario, id_restaurante } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO resenas (calificacion, comentario, fecha_opinion, id_usuario, id_restaurante) VALUES (?, ?, CURDATE(), ?, ?) ON DUPLICATE KEY UPDATE calificacion = ?, comentario = ?, fecha_opinion = CURDATE()',
      [calificacion, comentario, id_usuario, id_restaurante, calificacion, comentario]
    );
    res.status(201).json({ success: true, message: 'Reseña enviada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------------------------
// ENDPOINTS AUXILIARES: ZONAS, CATEGORÍAS, PLANES, MÉTODOS PAGO
// --------------------------------------------------------------------
app.get('/api/zonas', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query('SELECT z.*, m.nombre_municipio AS ciudad FROM zonas z JOIN municipios m ON m.id_municipio=z.id_municipio ORDER BY z.nombre_zona');
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
  const { monto, id_usuario, id_metodo, id_pedido, referencia = null } = req.body;
  const cents = Math.round(Number(monto) * 100);
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0 || !positiveInteger(id_usuario) || !positiveInteger(id_metodo) ||
      !positiveInteger(id_pedido) || Object.hasOwn(req.body, 'id_plan') || cents < 1 || cents > 999999999999 ||
      Math.abs(Number(monto) * 100 - cents) > 0.0001 ||
      (referencia !== null && (typeof referencia !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(referencia)))) {
    return res.status(400).json({ error: 'El pago debe tener un monto positivo, un usuario, un medio de pago y un pedido válido. Solo se reciben pagos de pedidos.' });
  }
  if (Number(id_usuario) !== Number(req.user.id_usuario) && req.user.tipo_usuario !== 'administrador') return res.status(403).json({ error: 'Solo puedes registrar tus propios pagos.' });
  let connection;
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  try {
    connection = await dbConnection.getConnection();
    await connection.beginTransaction();
    const [[order]] = await connection.query(`SELECT p.id_pedido,p.id_usuario,p.total_pago,e.codigo AS estado_pedido
      FROM pedidos p JOIN estados_pedido e ON e.id_estado_pedido=p.id_estado_pedido WHERE p.id_pedido=? FOR UPDATE`, [id_pedido]);
    if (!order) fail(404, 'El pedido no existe.');
    if (Number(order.id_usuario) !== Number(id_usuario)) fail(403, 'El pago debe pertenecer al usuario que hizo el pedido.');
    if (referencia) {
      const [[previous]] = await connection.query('SELECT id_pago,monto,id_metodo,estado_pago FROM pagos WHERE id_pedido=? AND referencia=?', [id_pedido, referencia]);
      if (previous) {
        if (Math.round(Number(previous.monto) * 100) !== cents || Number(previous.id_metodo) !== Number(id_metodo)) fail(409, 'La referencia ya corresponde a otro importe o medio.');
        await connection.commit();
        return res.json({ id_pago: previous.id_pago, id_pedido: Number(id_pedido), status: previous.estado_pago });
      }
    }
    if (order.estado_pedido === 'cancelado') fail(400, 'No se puede pagar un pedido cancelado.');
    const [methods] = await connection.query('SELECT id_metodo FROM metodos_pago WHERE id_metodo = ?', [id_metodo]);
    if (!methods.length) fail(400, 'El medio de pago no existe.');
    const [[approved]] = await connection.query("SELECT COALESCE(SUM(monto),0) AS monto FROM pagos WHERE id_pedido=? AND estado_pago='aprobado'", [id_pedido]);
    if (cents + Math.round(Number(approved.monto) * 100) > Math.round(Number(order.total_pago) * 100)) fail(409, 'El importe supera el saldo del pedido.');
    const [result] = await connection.query(
      'INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_pedido, referencia) VALUES (?, "aprobado", ?, ?, ?, ?)',
      [cents / 100, id_usuario, id_metodo, id_pedido, referencia]
    );
    await connection.commit();
    res.status(201).json({ id_pago: result.insertId, id_pedido: Number(id_pedido), status: 'aprobado' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo registrar el pago.' });
  } finally { if (connection) connection.release(); }
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
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT nombre AS 'Restaurante', direccion AS 'Direccion', telefono AS 'Telefono', email AS 'Correo', capacidad_total AS 'Aforo' 
      FROM restaurantes ${owner ? 'WHERE id_propietario=?' : ''} ORDER BY nombre
    `, owner ? [req.user.id_usuario] : []);
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
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT nombre AS 'Plato', descripcion AS 'Descripcion', precio AS 'Precio', IF(disponibilidad, 'Sí', 'No') AS 'Disponible' 
      FROM platos WHERE disponibilidad = TRUE ${owner ? 'AND id_restaurante IN (SELECT id_restaurante FROM restaurantes WHERE id_propietario=?)' : ''} ORDER BY precio
    `, owner ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/4', checkDbConnection, async (req, res) => {
  try {
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(re.id_resena) AS 'Total Resenas', ROUND(AVG(re.calificacion), 1) AS 'Calificacion Promedio' 
      FROM restaurantes r LEFT JOIN resenas re ON r.id_restaurante = re.id_restaurante 
      ${owner ? 'WHERE r.id_propietario=?' : ''}
      GROUP BY r.id_restaurante, r.nombre ORDER BY AVG(re.calificacion) DESC
    `, owner ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/5', checkDbConnection, async (req, res) => {
  try {
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT z.nombre_zona AS 'Zona', mu.nombre_municipio AS 'Municipio', COUNT(DISTINCT res.id_reserva) AS 'Reservas'
      FROM zonas z 
      INNER JOIN municipios mu ON mu.id_municipio=z.id_municipio
      INNER JOIN restaurantes r ON z.id_zona = r.id_zona 
      INNER JOIN mesas m ON r.id_restaurante = m.id_restaurante 
      INNER JOIN reserva_mesas rm ON m.id_mesa=rm.id_mesa
      INNER JOIN reservas res ON rm.id_reserva=res.id_reserva
      ${owner ? 'WHERE r.id_propietario=?' : ''}
      GROUP BY z.id_zona, z.nombre_zona, mu.nombre_municipio ORDER BY Reservas DESC
    `, owner ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/6', checkDbConnection, async (req, res) => {
  try {
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(CASE WHEN ep.codigo='entregado' THEN p.id_pedido END) AS 'Pedidos',
      COALESCE(SUM(CASE WHEN ep.codigo='entregado' THEN p.total_pago END), 0) AS 'Ingresos Totales'
      FROM restaurantes r 
      LEFT JOIN pedidos p ON r.id_restaurante = p.id_restaurante
      LEFT JOIN estados_pedido ep ON ep.id_estado_pedido=p.id_estado_pedido
      ${owner ? 'WHERE r.id_propietario=?' : ''}
      GROUP BY r.id_restaurante, r.nombre ORDER BY \`Ingresos Totales\` DESC
    `, owner ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/7', checkDbConnection, async (req, res) => {
  try {
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', COUNT(m.id_mesa) AS 'Total Mesas', 
             SUM(CASE WHEN m.estado = 'disponible' THEN 1 ELSE 0 END) AS 'Disponibles', 
             SUM(CASE WHEN m.estado = 'reservada' THEN 1 ELSE 0 END) AS 'Reservadas' 
      FROM restaurantes r INNER JOIN mesas m ON r.id_restaurante = m.id_restaurante 
      ${owner ? 'WHERE r.id_propietario=?' : ''}
      GROUP BY r.id_restaurante, r.nombre
    `, owner ? [req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/8', checkDbConnection, async (req, res) => {
  try {
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT r.nombre AS 'Restaurante', ROUND(AVG(re.calificacion), 2) AS 'Calificacion' 
      FROM restaurantes r INNER JOIN resenas re ON r.id_restaurante = re.id_restaurante 
      ${owner ? 'WHERE r.id_propietario=?' : ''}
      GROUP BY r.id_restaurante, r.nombre 
      HAVING AVG(re.calificacion) > (SELECT AVG(calificacion) FROM resenas${owner ? ' WHERE id_restaurante IN (SELECT id_restaurante FROM restaurantes WHERE id_propietario=?)' : ''})
    `, owner ? [req.user.id_usuario, req.user.id_usuario] : []);
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
    const owner = req.user.tipo_usuario === 'restaurante';
    const [rows] = await dbConnection.query(`
      SELECT p.nombre AS 'Plato', c.nombre_categoria AS 'Categoria', SUM(dp.cantidad) AS 'Vendidos' 
      FROM platos p 
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria 
      INNER JOIN detalle_pedidos dp ON p.id_plato = dp.id_plato 
      ${owner ? 'WHERE p.id_restaurante IN (SELECT id_restaurante FROM restaurantes WHERE id_propietario=?)' : ''}
      GROUP BY p.id_plato, p.nombre, p.id_categoria, c.nombre_categoria 
      HAVING SUM(dp.cantidad) >= (
          SELECT AVG(cantidad_plato) FROM (
              SELECT p2.id_categoria, SUM(dp2.cantidad) AS cantidad_plato 
              FROM platos p2 
              INNER JOIN detalle_pedidos dp2 ON p2.id_plato = dp2.id_plato 
              ${owner ? 'WHERE p2.id_restaurante IN (SELECT id_restaurante FROM restaurantes WHERE id_propietario=?)' : ''}
              GROUP BY p2.id_plato, p2.id_categoria
          ) AS sub2 WHERE sub2.id_categoria = p.id_categoria
      ) ORDER BY \`Vendidos\` DESC
    `, owner ? [req.user.id_usuario, req.user.id_usuario] : []);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.locals.initDB = initDB;
let reminderTimer;
app.locals.processReminders = () => dbConnection ? processReservationReminders(dbConnection, colombianTimestamp(now())) : Promise.resolve(0);
app.locals.startReminders = () => {
  if (reminderTimer) return;
  const run = () => app.locals.processReminders().catch(() => console.warn('Los recordatorios se reintentarán en la siguiente revisión.'));
  run();
  reminderTimer = setInterval(run, 60000);
  reminderTimer.unref();
};
app.locals.closeDB = async () => {
  clearInterval(reminderTimer);
  if (dbConnection?.end) await dbConnection.end();
};
return app;
}

async function start() {
  const app = createApp();
  await app.locals.initDB();
  app.locals.startReminders();
  const port = Number(process.env.PORT) || 3000;
  return app.listen(port, '127.0.0.1', () => console.log(`GastroTurismo disponible en http://localhost:${port}`));
}

if (require.main === module) start().catch(() => { console.error('No fue posible iniciar GastroTurismo.'); process.exitCode = 1; });
module.exports = { createApp, start };
