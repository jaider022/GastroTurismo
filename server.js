const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { comparisonPeriods, bogotaDate, validDate } = require('./lib/periods');
const { hashPassword, verifyPassword } = require('./lib/passwords');
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurantes', checkDbConnection, async (req, res) => {
  const { nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO restaurantes (nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan || 1]
    );
    res.status(201).json({ id_restaurante: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/restaurantes/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan } = req.body;
  try {
    await dbConnection.query(
      'UPDATE restaurantes SET nombre = ?, direccion = ?, telefono = ?, email = ?, capacidad_total = ?, especialidad = ?, id_zona = ?, id_propietario = ?, id_plan = ? WHERE id_restaurante = ?',
      [nombre, direccion, telefono, email, capacidad_total, especialidad, id_zona, id_propietario, id_plan, id]
    );
    res.json({ message: 'Restaurante actualizado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/restaurantes/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM restaurantes WHERE id_restaurante = ?', [id]);
    res.json({ message: 'Restaurante eliminado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mesas/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { numero_mesa, capacidad, ubicacion, estado, id_restaurante } = req.body;
  try {
    await dbConnection.query(
      'UPDATE mesas SET numero_mesa = ?, capacidad = ?, ubicacion = ?, estado = ?, id_restaurante = ? WHERE id_mesa = ?',
      [numero_mesa, capacidad, ubicacion, estado, id_restaurante, id]
    );
    res.json({ message: 'Mesa actualizada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mesas/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM mesas WHERE id_mesa = ?', [id]);
    res.json({ message: 'Mesa eliminada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/platos/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('DELETE FROM platos WHERE id_plato = ?', [id]);
    res.json({ message: 'Plato eliminado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - RESERVAS
// --------------------------------------------------------------------
app.get('/api/reservas', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await dbConnection.query(`
      SELECT res.*, u.nombre AS nombre_usuario, u.correo AS correo_usuario,
             m.numero_mesa, m.ubicacion AS ubicacion_mesa, r.nombre AS nombre_restaurante, r.id_restaurante
      FROM reservas res
      INNER JOIN usuarios u ON res.id_usuario = u.id_usuario
      INNER JOIN mesas m ON res.id_mesa = m.id_mesa
      INNER JOIN restaurantes r ON m.id_restaurante = r.id_restaurante
      ORDER BY res.fecha_reserva DESC, res.hora_reserva DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservas', checkDbConnection, async (req, res) => {
  const { fecha_reserva, hora_reserva, cantidad_personas, estado_reserva, id_usuario, id_mesa } = req.body;
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO reservas (fecha_reserva, hora_reserva, cantidad_personas, estado_reserva, id_usuario, id_mesa) VALUES (?, ?, ?, ?, ?, ?)',
      [fecha_reserva, hora_reserva, cantidad_personas, estado_reserva || 'pendiente', id_usuario, id_mesa]
    );
    // Cambiar estado de la mesa a 'reservada'
    await dbConnection.query('UPDATE mesas SET estado = "reservada" WHERE id_mesa = ?', [id_mesa]);
    
    // Crear notificación para el cliente
    await dbConnection.query(
      'INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)',
      [`Tu reserva para el día ${fecha_reserva} a las ${hora_reserva} ha sido registrada.`, id_usuario]
    );

    res.status(201).json({ id_reserva: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservas/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { fecha_reserva, hora_reserva, cantidad_personas, estado_reserva, id_usuario, id_mesa, id_mesa_anterior } = req.body;
  try {
    await dbConnection.query(
      'UPDATE reservas SET fecha_reserva = ?, hora_reserva = ?, cantidad_personas = ?, estado_reserva = ?, id_usuario = ?, id_mesa = ? WHERE id_reserva = ?',
      [fecha_reserva, hora_reserva, cantidad_personas, estado_reserva, id_usuario, id_mesa, id]
    );

    // Ajustar estados de las mesas
    if (id_mesa_anterior && id_mesa_anterior !== id_mesa) {
      await dbConnection.query('UPDATE mesas SET estado = "disponible" WHERE id_mesa = ?', [id_mesa_anterior]);
    }
    if (estado_reserva === 'cancelada' || estado_reserva === 'finalizada') {
      await dbConnection.query('UPDATE mesas SET estado = "disponible" WHERE id_mesa = ?', [id_mesa]);
    } else {
      await dbConnection.query('UPDATE mesas SET estado = "reservada" WHERE id_mesa = ?', [id_mesa]);
    }

    res.json({ message: 'Reserva actualizada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reservas/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    // Obtener mesa antes de borrar para liberarla
    const [reserva] = await dbConnection.query('SELECT id_mesa FROM reservas WHERE id_reserva = ?', [id]);
    if (reserva.length > 0) {
      await dbConnection.query('UPDATE mesas SET estado = "disponible" WHERE id_mesa = ?', [reserva[0].id_mesa]);
    }
    await dbConnection.query('DELETE FROM reservas WHERE id_reserva = ?', [id]);
    res.json({ message: 'Reserva eliminada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------------------------
// ENDPOINTS CRUD - PEDIDOS Y DETALLE
// --------------------------------------------------------------------
app.get('/api/pedidos', checkDbConnection, async (req, res) => {
  try {
    const [pedidos] = await dbConnection.query(`
      SELECT p.*, u.nombre AS nombre_usuario, r.nombre AS nombre_restaurante
      FROM pedidos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
      INNER JOIN restaurantes r ON p.id_restaurante = r.id_restaurante
      ORDER BY p.fecha_pedido DESC
    `);
    
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

app.put('/api/pedidos/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { estado_pedido } = req.body;
  try {
    await dbConnection.query('UPDATE pedidos SET estado_pedido = ? WHERE id_pedido = ?', [estado_pedido, id]);
    res.json({ message: 'Estado del pedido actualizado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  const { monto, id_usuario, id_metodo, id_pedido, id_plan } = req.body;
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0 || !positiveInteger(id_usuario) || !positiveInteger(id_metodo) ||
      Boolean(id_pedido) === Boolean(id_plan) || (id_pedido && !positiveInteger(id_pedido)) || (id_plan && !positiveInteger(id_plan))) {
    return res.status(400).json({ error: 'El pago debe tener un monto positivo y corresponder a un pedido o a un plan, exclusivamente.' });
  }
  if (Number(id_usuario) !== Number(req.user.id_usuario) && req.user.tipo_usuario !== 'administrador') return res.status(403).json({ error: 'Solo puedes registrar tus propios pagos.' });
  try {
    const [result] = await dbConnection.query(
      'INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_pedido, id_plan) VALUES (?, "aprobado", ?, ?, ?, ?)',
      [monto, id_usuario, id_metodo, id_pedido || null, id_plan || null]
    );

    // Si es pago de suscripción de plan, actualizar el plan del restaurante del usuario dueño
    if (id_plan) {
      await dbConnection.query(
        'UPDATE restaurantes SET id_plan = ? WHERE id_propietario = ?',
        [id_plan, id_usuario]
      );
    }

    res.status(201).json({ id_pago: result.insertId, status: 'aprobado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------------------------
// ENDPOINT NOTIFICACIONES
// --------------------------------------------------------------------
app.get('/api/notificaciones/:userId', checkDbConnection, async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await dbConnection.query(
      'SELECT * FROM notificaciones WHERE id_usuario = ? ORDER BY fecha_envio DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notificaciones/leer/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnection.query('UPDATE notificaciones SET leido = TRUE WHERE id_notificacion = ?', [id]);
    res.json({ message: 'Notificación marcada como leída.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      GROUP BY u.id_usuario, u.nombre, u.correo 
      HAVING COUNT(r.id_reserva) > (
          SELECT AVG(total_res) FROM (SELECT COUNT(id_reserva) AS total_res FROM reservas GROUP BY id_usuario) AS sub
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
          SELECT AVG(cantidad_plato) FROM (
              SELECT p2.id_categoria, SUM(dp2.cantidad) AS cantidad_plato 
              FROM platos p2 
              INNER JOIN detalle_pedidos dp2 ON p2.id_plato = dp2.id_plato 
              GROUP BY p2.id_plato, p2.id_categoria
          ) AS sub2 WHERE sub2.id_categoria = p.id_categoria
      ) ORDER BY \`Vendidos\` DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.locals.initDB = initDB;
app.locals.closeDB = async () => { if (dbConnection?.end) await dbConnection.end(); };
return app;
}

async function start() {
  const app = createApp();
  await app.locals.initDB();
  const port = Number(process.env.PORT) || 3000;
  return app.listen(port, '127.0.0.1', () => console.log(`GastroTurismo disponible en http://localhost:${port}`));
}

if (require.main === module) start().catch(() => { console.error('No fue posible iniciar GastroTurismo.'); process.exitCode = 1; });
module.exports = { createApp, start };
