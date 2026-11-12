'use strict';
const { validDate } = require('./periods');
const id = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const money = value => ['string','number'].includes(typeof value) && /^\d+(?:\.\d{1,2})?$/.test(String(value)) && Number(value) <= 99999999.99;
class ExperienceError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(status, message) { throw new ExperienceError(status, message); }
function payload(body) {
  const fecha = typeof body.fecha_hora === 'string' ? body.fecha_hora.replace('T', ' ') : '';
  if (!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(fecha) || !validDate(fecha.slice(0, 10))) fail(400, 'Indica una fecha y hora válidas para la actividad.');
  if (!id(body.id_restaurante) || !id(body.cupos) || Number(body.cupos) > 100000 || !id(body.duracion_minutos) || Number(body.duracion_minutos) > 1440 || !money(body.precio) || body.precio === '' || body.precio == null) fail(400, 'Revisa restaurante, cupos, duración y precio por persona.');
  if (typeof body.nombre !== 'string' || !body.nombre.trim() || body.nombre.trim().length > 150 || (body.descripcion != null && (typeof body.descripcion !== 'string' || body.descripcion.length > 4000))) fail(400, 'Revisa el nombre y la descripción de la experiencia.');
  return { id_restaurante: Number(body.id_restaurante), nombre: body.nombre.trim(), descripcion: body.descripcion?.trim() || '', fecha_hora: fecha.length === 16 ? fecha + ':00' : fecha, duracion_minutos: Number(body.duracion_minutos), cupos: Number(body.cupos), precio: Number(body.precio) };
}
function canManage(user, restaurant) { return user?.tipo_usuario === 'administrador' || (user?.tipo_usuario === 'restaurante' && Number(user.id_usuario) === Number(restaurant.id_propietario)); }
const catalog = `SELECT e.*, r.nombre AS nombre_restaurante, r.direccion, z.nombre_zona, mu.nombre_municipio,
  COALESCE(o.reservados,0) AS cupos_reservados, e.cupos-COALESCE(o.reservados,0) AS cupos_disponibles
  FROM experiencias e JOIN restaurantes r ON r.id_restaurante=e.id_restaurante
  JOIN zonas z ON z.id_zona=r.id_zona JOIN municipios mu ON mu.id_municipio=z.id_municipio
  LEFT JOIN (SELECT id_experiencia,SUM(cantidad_personas) AS reservados FROM reservas_experiencias WHERE estado='confirmada' GROUP BY id_experiencia) o ON o.id_experiencia=e.id_experiencia`;
const bookings = `SELECT b.*, (b.cantidad_personas*b.precio_unitario) AS total,
  e.nombre AS nombre_experiencia,e.fecha_hora,e.duracion_minutos,e.estado AS estado_experiencia,
  r.id_restaurante,r.id_propietario,r.nombre AS nombre_restaurante,r.direccion,
  u.nombre AS nombre_usuario,u.correo AS correo_usuario,m.nombre_metodo
  FROM reservas_experiencias b JOIN experiencias e ON e.id_experiencia=b.id_experiencia
  JOIN restaurantes r ON r.id_restaurante=e.id_restaurante JOIN usuarios u ON u.id_usuario=b.id_usuario
  LEFT JOIN metodos_pago m ON m.id_metodo=b.id_metodo`;
async function transaction(db, action) {
  const connection = await db.getConnection();
  try { await connection.beginTransaction(); const result = await action(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function activity(connection, value) {
  if (!id(value)) fail(400, 'Experiencia inválida.');
  const [[row]] = await connection.query(`SELECT e.*,r.id_propietario,r.capacidad_total FROM experiencias e JOIN restaurantes r ON r.id_restaurante=e.id_restaurante WHERE e.id_experiencia=? FOR UPDATE`, [Number(value)]);
  if (!row) fail(404, 'La experiencia no existe.');
  return row;
}
async function booking(connection, value, user) {
  if (!id(value)) fail(400, 'Reserva de experiencia inválida.');
  // Todas las escrituras bloquean primero la actividad y después su reserva.
  const [[reference]] = await connection.query('SELECT id_experiencia FROM reservas_experiencias WHERE id_reserva_experiencia=?', [Number(value)]);
  if (!reference) fail(404, 'La reserva no existe.');
  const experience = await activity(connection, reference.id_experiencia);
  const [[row]] = await connection.query('SELECT * FROM reservas_experiencias WHERE id_reserva_experiencia=? FOR UPDATE', [Number(value)]);
  if (!(canManage(user, experience) || (user.tipo_usuario === 'cliente' && Number(row.id_usuario) === Number(user.id_usuario)))) fail(403, 'No puedes gestionar esta reserva.');
  return { row, experience };
}
function registerExperiences(app, { getDb, checkDbConnection, requireSession, requireStaff, now, timestamp }) {
  const handler = action => async (req, res) => {
    try { await action(getDb(), req, res); }
    catch (error) {
      const conflict = ['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','ER_DUP_ENTRY'].includes(error.code);
      res.status(error.status || (conflict ? 409 : 500)).json({ error: error.status ? error.message : conflict ? 'Los cupos se están actualizando. Vuelve a consultar e intenta de nuevo.' : 'No se pudo completar la operación de experiencias.' });
    }
  };
  app.get('/api/experiencias', checkDbConnection, handler(async (db, req, res) => {
    let filter = " WHERE e.estado='activa' AND e.fecha_hora>?", args = [timestamp(now())];
    if (req.query.gestion === '1') {
      if (!['administrador','restaurante'].includes(req.user?.tipo_usuario)) fail(403, 'La gestión de actividades requiere una cuenta de restaurante o administrador.');
      filter = req.user.tipo_usuario === 'restaurante' ? ' WHERE r.id_propietario=?' : '';
      args = filter ? [req.user.id_usuario] : [];
    }
    const [rows] = await db.query(catalog + filter + ' ORDER BY e.fecha_hora,e.id_experiencia', args); res.json(rows);
  }));
  app.post('/api/experiencias', requireSession, requireStaff, checkDbConnection, handler(async (db, req, res) => {
    const data = payload(req.body);
    if (data.fecha_hora <= timestamp(now())) fail(400, 'La experiencia debe empezar en el futuro.');
    const result = await transaction(db, async c => {
      const [[restaurant]] = await c.query('SELECT id_propietario,capacidad_total FROM restaurantes WHERE id_restaurante=? FOR UPDATE', [data.id_restaurante]);
      if (!restaurant) fail(400, 'Selecciona un restaurante existente.');
      if (!canManage(req.user, restaurant)) fail(403, 'Solo puedes publicar actividades de tus restaurantes.');
      if (data.cupos > Number(restaurant.capacidad_total)) fail(400, 'Los cupos no pueden superar la capacidad del restaurante.');
      const [saved] = await c.query('INSERT INTO experiencias(id_restaurante,nombre,descripcion,fecha_hora,duracion_minutos,cupos,precio) VALUES (?,?,?,?,?,?,?)', Object.values(data));
      return { ...data, id_experiencia: saved.insertId, estado: 'activa' };
    }); res.status(201).json(result);
  }));
  app.put('/api/experiencias/:id', requireSession, requireStaff, checkDbConnection, handler(async (db, req, res) => {
    const result = await transaction(db, async c => {
      const previous = await activity(c, req.params.id);
      if (!canManage(req.user, previous)) fail(403, 'Solo puedes cambiar actividades de tus restaurantes.');
      if (previous.estado !== 'activa' || previous.fecha_hora <= timestamp(now())) fail(409, 'La actividad está cerrada y conserva su historial.');
      const [[count]] = await c.query("SELECT COALESCE(SUM(cantidad_personas),0) AS n,COALESCE(SUM(estado_pago='pagado'),0) AS cobradas FROM reservas_experiencias WHERE id_experiencia=? AND estado='confirmada'", [previous.id_experiencia]);
      if (req.body.estado === 'cancelada') {
        if (Number(count.cobradas)) fail(409, 'La actividad tiene reservas cobradas. No se cancela sin resolver primero su devolución en el restaurante.');
        await c.query("INSERT INTO notificaciones(mensaje,id_usuario) SELECT ?,id_usuario FROM reservas_experiencias WHERE id_experiencia=? AND estado='confirmada'", [`La actividad ${previous.nombre} fue cancelada por el restaurante.`, previous.id_experiencia]);
        await c.query("UPDATE reservas_experiencias SET estado='cancelada' WHERE id_experiencia=? AND estado='confirmada'", [previous.id_experiencia]);
        await c.query("UPDATE experiencias SET estado='cancelada' WHERE id_experiencia=?", [previous.id_experiencia]);
        return { ...previous, estado: 'cancelada' };
      }
      const data = payload({ ...previous, ...req.body });
      if (data.id_restaurante !== previous.id_restaurante) fail(400, 'El restaurante de una actividad no puede cambiarse.');
      if (data.fecha_hora <= timestamp(now())) fail(400, 'La experiencia debe empezar en el futuro.');
      if (Number(count.n) && (data.fecha_hora !== previous.fecha_hora || data.duracion_minutos !== previous.duracion_minutos)) fail(409, 'Hay cupos reservados. Conserva la fecha, hora y duración de la actividad.');
      if (data.cupos < Number(count.n) || data.cupos > Number(previous.capacidad_total)) fail(409, 'Los cupos deben cubrir las reservas y respetar la capacidad del restaurante.');
      await c.query('UPDATE experiencias SET nombre=?,descripcion=?,fecha_hora=?,duracion_minutos=?,cupos=?,precio=? WHERE id_experiencia=?', [data.nombre,data.descripcion,data.fecha_hora,data.duracion_minutos,data.cupos,data.precio,previous.id_experiencia]);
      return { ...data, id_experiencia: previous.id_experiencia, estado: 'activa' };
    }); res.json(result);
  }));
  app.get('/api/reservas_experiencias', requireSession, checkDbConnection, handler(async (db, req, res) => {
    const role = req.user.tipo_usuario;
    if (!['cliente','restaurante','administrador'].includes(role)) fail(403, 'Rol no autorizado.');
    const filter = role === 'cliente' ? ' WHERE b.id_usuario=?' : role === 'restaurante' ? ' WHERE r.id_propietario=?' : '';
    const [rows] = await db.query(bookings + filter + ' ORDER BY e.fecha_hora DESC,b.id_reserva_experiencia DESC', filter ? [req.user.id_usuario] : []);
    res.json(rows.map(({ id_propietario, ...row }) => row));
  }));
  app.post('/api/reservas_experiencias', requireSession, checkDbConnection, handler(async (db, req, res) => {
    if (req.user.tipo_usuario !== 'cliente') fail(403, 'Reserva el cupo desde una cuenta de cliente.');
    const { id_experiencia, cantidad_personas, referencia } = req.body;
    if (!id(id_experiencia) || !id(cantidad_personas) || !uuid(referencia)) fail(400, 'Selecciona la actividad, una cantidad entera de personas y una referencia válida.');
    const result = await transaction(db, async c => {
      const e = await activity(c, id_experiencia);
      const [[prior]] = await c.query('SELECT * FROM reservas_experiencias WHERE id_usuario=? AND referencia=?', [req.user.id_usuario, referencia]);
      if (prior) {
        if (prior.id_experiencia !== Number(id_experiencia) || prior.cantidad_personas !== Number(cantidad_personas)) fail(409, 'Esta referencia ya corresponde a otra reserva.');
        return { ...prior, total: Number(prior.precio_unitario) * prior.cantidad_personas, repetida: true };
      }
      if (e.estado !== 'activa' || e.fecha_hora <= timestamp(now())) fail(409, 'Esta actividad ya no admite reservas.');
      if (req.body.precio_esperado != null && Number(req.body.precio_esperado) !== Number(e.precio)) fail(409, 'El precio de la actividad cambió. Cierra el formulario y actualiza las actividades antes de confirmar.');
      const [[count]] = await c.query("SELECT COALESCE(SUM(cantidad_personas),0) AS n FROM reservas_experiencias WHERE id_experiencia=? AND estado='confirmada'", [e.id_experiencia]);
      if (Number(count.n) + Number(cantidad_personas) > Math.min(Number(e.cupos),Number(e.capacidad_total))) fail(409, 'No quedan suficientes cupos. Actualiza la disponibilidad.');
      const [saved] = await c.query('INSERT INTO reservas_experiencias(id_experiencia,id_usuario,cantidad_personas,fecha_reserva,precio_unitario,referencia) VALUES (?,?,?,?,?,?)', [e.id_experiencia,req.user.id_usuario,Number(cantidad_personas),timestamp(now()),e.precio,referencia]);
      await c.query('INSERT INTO notificaciones(mensaje,id_usuario) VALUES (?,?)', [`Reservaste ${cantidad_personas} cupo(s) para ${e.nombre}, el ${e.fecha_hora}. El pago se realiza en el restaurante.`,req.user.id_usuario]);
      return { id_reserva_experiencia: saved.insertId, id_experiencia:e.id_experiencia, cantidad_personas:Number(cantidad_personas), precio_unitario:e.precio, total:Number(e.precio)*Number(cantidad_personas), estado:'confirmada', estado_pago:'pendiente' };
    }); res.status(result.repetida ? 200 : 201).json(result);
  }));
  app.put('/api/reservas_experiencias/:id/cancelar', requireSession, checkDbConnection, handler(async (db, req, res) => {
    await transaction(db, async c => {
      const { row, experience } = await booking(c, req.params.id, req.user);
      if (row.estado === 'cancelada') return;
      if (row.estado_pago === 'pagado') fail(409, 'La reserva ya fue cobrada. Consulta cualquier devolución directamente con el restaurante.');
      if (experience.fecha_hora <= timestamp(now())) fail(409, 'La actividad ya empezó; se conserva el historial de la reserva.');
      await c.query("UPDATE reservas_experiencias SET estado='cancelada' WHERE id_reserva_experiencia=?", [row.id_reserva_experiencia]);
      await c.query('INSERT INTO notificaciones(mensaje,id_usuario) VALUES (?,?)', [`Tu reserva de experiencia #${row.id_reserva_experiencia} fue cancelada. Los cupos quedaron disponibles.`,row.id_usuario]);
    }); res.json({ estado:'cancelada' });
  }));
  app.put('/api/reservas_experiencias/:id/cobrar', requireSession, requireStaff, checkDbConnection, handler(async (db, req, res) => {
    if (!id(req.body.id_metodo)) fail(400, 'Selecciona un medio de pago presencial.');
    const result = await transaction(db, async c => {
      const { row, experience } = await booking(c, req.params.id, req.user);
      if (!canManage(req.user, experience)) fail(403, 'Solo el restaurante encargado puede registrar este cobro.');
      if (row.estado !== 'confirmada' || experience.estado !== 'activa') fail(409, 'Una reserva cancelada no puede cobrarse.');
      const [[method]] = await c.query("SELECT id_metodo FROM metodos_pago WHERE id_metodo=? AND tipo_pago='presencial'", [Number(req.body.id_metodo)]);
      if (!method) fail(400, 'Elige efectivo, datáfono u otro medio presencial del catálogo.');
      if (row.estado_pago === 'pagado') {
        if (Number(row.id_metodo) !== Number(req.body.id_metodo)) fail(409, 'El cobro ya quedó registrado con otro medio.');
        return { estado_pago:'pagado', total:Number(row.precio_unitario)*row.cantidad_personas, repetido:true };
      }
      // La pantalla registra una recepción presencial; no contacta una pasarela.
      await c.query("UPDATE reservas_experiencias SET estado_pago='pagado',id_metodo=?,fecha_pago=?,cobrado_por=? WHERE id_reserva_experiencia=?", [Number(req.body.id_metodo),timestamp(now()),req.user.id_usuario,row.id_reserva_experiencia]);
      await c.query('INSERT INTO notificaciones(mensaje,id_usuario) VALUES (?,?)', [`El restaurante registró el pago presencial de tu reserva de experiencia #${row.id_reserva_experiencia}.`,row.id_usuario]);
      return { estado_pago:'pagado', total:Number(row.precio_unitario)*row.cantidad_personas };
    }); res.json(result);
  }));
}
module.exports = { registerExperiences, payload, ExperienceError };
