'use strict';
// Experiencias gastronómicas, planes con vigencia y recordatorios personalizados.
const { validDate, bogotaDate } = require('./periods');
const { RuleError, isAdmin, isOwnerRole, positiveInteger, cleanText, integerInRange, money, validTime, restaurantFor, assertManagesRestaurant, sendRuleError } = require('./reglas');

const EXPERIENCE_TYPES = ['cata', 'clase_cocina', 'tour', 'maridaje', 'desayuno'];

function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1 + months, d, 12));
  return value.toISOString().slice(0, 10);
}
function shiftDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Convierte en notificación cada recordatorio cuya fecha ya llegó. Devuelve cuántos envió.
async function processReminders(db, now = () => new Date()) {
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now()).replace(',', '');
  await expireSubscriptions(db, now);
  const [due] = await db.query('SELECT id_recordatorio, id_usuario, titulo, mensaje FROM recordatorios WHERE enviado = FALSE AND fecha_programada <= ? ORDER BY fecha_programada LIMIT 200', [stamp]);
  for (const reminder of due) {
    // La condición enviado = FALSE evita duplicar si dos procesos coinciden.
    const [result] = await db.query('UPDATE recordatorios SET enviado = TRUE, fecha_envio = ? WHERE id_recordatorio = ? AND enviado = FALSE', [stamp, reminder.id_recordatorio]);
    if (result.affectedRows) await db.query('INSERT INTO notificaciones (mensaje, id_usuario, fecha_envio) VALUES (?, ?, ?)', [`Recordatorio: ${reminder.titulo}. ${reminder.mensaje}`, reminder.id_usuario, stamp]);
  }
  return due.length;
}

// Vence las suscripciones cuyo periodo terminó y devuelve al plan Básico los restaurantes sin plan activo.
async function expireSubscriptions(db, now = () => new Date()) {
  const today = bogotaDate(now());
  await db.query("UPDATE suscripciones SET estado_suscripcion = 'vencida' WHERE estado_suscripcion = 'activa' AND fecha_fin <= ?", [today]);
  await db.query(`UPDATE restaurantes r SET r.id_plan = 1 WHERE r.id_plan <> 1 AND NOT EXISTS (
    SELECT 1 FROM suscripciones s WHERE s.id_restaurante = r.id_restaurante AND s.estado_suscripcion = 'activa' AND s.fecha_inicio <= ? AND s.fecha_fin > ?)`, [today, today]);
}

function registerExtraRoutes(app, { getDb, checkDbConnection, requireSession, requireStaff, now, colombianTimestamp }) {
  const db = () => getDb();
  const addReminder = (...args) => app.locals.addReminder(...args);

  // ------------------------------------------------------------------
  // EXPERIENCIAS GASTRONÓMICAS
  // ------------------------------------------------------------------
  const experienceSelect = `SELECT e.*, r.nombre AS nombre_restaurante, r.id_propietario, z.nombre_zona, z.ciudad,
      COALESCE((SELECT SUM(i.cantidad_personas) FROM inscripciones_experiencia i WHERE i.id_experiencia = e.id_experiencia AND i.estado_inscripcion <> 'cancelada'), 0) AS cupos_ocupados
    FROM experiencias e JOIN restaurantes r ON r.id_restaurante = e.id_restaurante JOIN zonas z ON z.id_zona = r.id_zona`;

  app.get('/api/experiencias', checkDbConnection, async (req, res) => {
    try {
      const params = []; let where = '';
      if (req.query.id_restaurante) {
        if (!positiveInteger(req.query.id_restaurante)) throw new RuleError(400, 'El restaurante no es válido.');
        where = 'WHERE e.id_restaurante = ?'; params.push(Number(req.query.id_restaurante));
      }
      const [rows] = await db().query(`${experienceSelect} ${where} ORDER BY e.fecha_experiencia DESC, e.hora_inicio`, params);
      res.json(rows.map(row => ({ ...row, cupos_ocupados: Number(row.cupos_ocupados), cupos_disponibles: Math.max(0, Number(row.cupo_maximo) - Number(row.cupos_ocupados)) })));
    } catch (error) { sendRuleError(res, error, 'No se pudieron consultar las experiencias.'); }
  });

  function experiencePayload(body, isNew) {
    const data = {
      nombre: cleanText(body.nombre, { max: 150, field: 'nombre' }),
      descripcion: cleanText(body.descripcion, { max: 4000, required: false, field: 'descripción' }),
      tipo_experiencia: body.tipo_experiencia,
      fecha_experiencia: body.fecha_experiencia,
      hora_inicio: body.hora_inicio,
      duracion_minutos: integerInRange(body.duracion_minutos, { min: 30, max: 600, field: 'duración' }),
      cupo_maximo: integerInRange(body.cupo_maximo, { max: 200, field: 'cupo máximo' }),
      precio_persona: money(body.precio_persona, 'precio por persona'),
      idioma: cleanText(body.idioma || 'Español', { max: 50, field: 'idioma' }),
      estado_experiencia: body.estado_experiencia || 'programada'
    };
    if (!EXPERIENCE_TYPES.includes(data.tipo_experiencia)) throw new RuleError(400, 'El tipo de experiencia no es válido.');
    if (!validDate(data.fecha_experiencia)) throw new RuleError(400, 'La fecha no es válida.');
    if (!validTime(data.hora_inicio)) throw new RuleError(400, 'La hora no es válida.');
    if (!['programada', 'cancelada', 'realizada'].includes(data.estado_experiencia)) throw new RuleError(400, 'El estado no es válido.');
    if (isNew && data.fecha_experiencia <= bogotaDate(now())) throw new RuleError(400, 'Las experiencias nuevas deben programarse desde mañana.');
    if (isNew) data.estado_experiencia = 'programada';
    return data;
  }

  app.post('/api/experiencias', checkDbConnection, requireStaff, async (req, res) => {
    try {
      const restaurant = await assertManagesRestaurant(db(), req.user, req.body.id_restaurante);
      const data = experiencePayload(req.body, true);
      const [result] = await db().query(`INSERT INTO experiencias (nombre, descripcion, tipo_experiencia, fecha_experiencia, hora_inicio, duracion_minutos, cupo_maximo, precio_persona, idioma, estado_experiencia, id_restaurante)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.nombre, data.descripcion, data.tipo_experiencia, data.fecha_experiencia, data.hora_inicio, data.duracion_minutos, data.cupo_maximo, data.precio_persona, data.idioma, data.estado_experiencia, restaurant.id_restaurante]);
      res.status(201).json({ id_experiencia: result.insertId, ...data, id_restaurante: restaurant.id_restaurante });
    } catch (error) { sendRuleError(res, error, 'No se pudo registrar la experiencia.'); }
  });

  async function experienceForStaff(req, connection = db()) {
    if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La experiencia no es válida.');
    const [rows] = await connection.query(`${experienceSelect} WHERE e.id_experiencia = ?`, [Number(req.params.id)]);
    if (!rows.length) throw new RuleError(404, 'La experiencia no existe.');
    await assertManagesRestaurant(connection, req.user, rows[0].id_restaurante);
    return rows[0];
  }

  app.put('/api/experiencias/:id', checkDbConnection, requireStaff, async (req, res) => {
    try {
      const current = await experienceForStaff(req);
      const data = experiencePayload(req.body, false);
      if (data.cupo_maximo < Number(current.cupos_ocupados)) throw new RuleError(400, `Ya hay ${current.cupos_ocupados} personas inscritas; el cupo no puede ser menor.`);
      await db().query(`UPDATE experiencias SET nombre = ?, descripcion = ?, tipo_experiencia = ?, fecha_experiencia = ?, hora_inicio = ?, duracion_minutos = ?, cupo_maximo = ?, precio_persona = ?, idioma = ?, estado_experiencia = ?
        WHERE id_experiencia = ?`, [data.nombre, data.descripcion, data.tipo_experiencia, data.fecha_experiencia, data.hora_inicio, data.duracion_minutos, data.cupo_maximo, data.precio_persona, data.idioma, data.estado_experiencia, current.id_experiencia]);
      const [inscritos] = await db().query("SELECT id_usuario FROM inscripciones_experiencia WHERE id_experiencia = ? AND estado_inscripcion = 'confirmada'", [current.id_experiencia]);
      if (data.estado_experiencia === 'cancelada' && current.estado_experiencia !== 'cancelada') {
        await db().query("DELETE FROM recordatorios WHERE enviado = FALSE AND id_inscripcion IN (SELECT id_inscripcion FROM inscripciones_experiencia WHERE id_experiencia = ?)", [current.id_experiencia]);
        for (const row of inscritos) await db().query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`La experiencia "${data.nombre}" del ${data.fecha_experiencia} fue cancelada por ${current.nombre_restaurante}. El valor pagado será reembolsado.`, row.id_usuario]);
      } else if (data.fecha_experiencia !== String(current.fecha_experiencia).slice(0, 10) || data.hora_inicio.slice(0, 5) !== String(current.hora_inicio).slice(0, 5)) {
        for (const row of inscritos) await db().query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`La experiencia "${data.nombre}" cambió de horario: ${data.fecha_experiencia} a las ${data.hora_inicio.slice(0, 5)}.`, row.id_usuario]);
        await db().query(`UPDATE recordatorios SET fecha_programada = ?, mensaje = ? WHERE enviado = FALSE AND id_inscripcion IN (SELECT id_inscripcion FROM inscripciones_experiencia WHERE id_experiencia = ?)`,
          [`${shiftDays(data.fecha_experiencia, -1)} 09:00:00`, `La experiencia inicia el ${data.fecha_experiencia} a las ${data.hora_inicio.slice(0, 5)}.`, current.id_experiencia]);
      }
      res.json({ message: 'Experiencia actualizada con éxito.' });
    } catch (error) { sendRuleError(res, error, 'No se pudo actualizar la experiencia.'); }
  });

  app.delete('/api/experiencias/:id', checkDbConnection, requireStaff, async (req, res) => {
    try {
      const current = await experienceForStaff(req);
      const [[count]] = await db().query('SELECT COUNT(*) AS total FROM inscripciones_experiencia WHERE id_experiencia = ?', [current.id_experiencia]);
      if (Number(count.total)) throw new RuleError(409, 'La experiencia tiene inscripciones. Cámbiala a cancelada para conservar el historial.');
      await db().query('DELETE FROM experiencias WHERE id_experiencia = ?', [current.id_experiencia]);
      res.json({ message: 'Experiencia eliminada con éxito.' });
    } catch (error) { sendRuleError(res, error, 'No se pudo eliminar la experiencia.'); }
  });

  // ------------------------------------------------------------------
  // INSCRIPCIONES A EXPERIENCIAS (incluye pago en línea)
  // ------------------------------------------------------------------
  app.get('/api/inscripciones', checkDbConnection, requireSession, async (req, res) => {
    try {
      const where = isAdmin(req.user) ? '' : isOwnerRole(req.user) ? 'WHERE r.id_propietario = ?' : 'WHERE i.id_usuario = ?';
      const [rows] = await db().query(`SELECT i.*, e.nombre AS nombre_experiencia, e.fecha_experiencia, e.hora_inicio, e.estado_experiencia,
          r.nombre AS nombre_restaurante, u.nombre AS nombre_usuario, u.correo AS correo_usuario,
          (SELECT p.id_pago FROM pagos p WHERE p.id_inscripcion = i.id_inscripcion LIMIT 1) AS id_pago
        FROM inscripciones_experiencia i JOIN experiencias e ON e.id_experiencia = i.id_experiencia
        JOIN restaurantes r ON r.id_restaurante = e.id_restaurante JOIN usuarios u ON u.id_usuario = i.id_usuario
        ${where} ORDER BY e.fecha_experiencia DESC, i.fecha_inscripcion DESC`, where ? [req.user.id_usuario] : []);
      res.json(rows);
    } catch (error) { sendRuleError(res, error, 'No se pudieron consultar las inscripciones.'); }
  });

  app.post('/api/inscripciones', checkDbConnection, requireSession, async (req, res) => {
    let connection;
    try {
      if (req.user.tipo_usuario !== 'cliente') throw new RuleError(403, 'Las inscripciones se hacen con una cuenta de cliente.');
      const cantidad = integerInRange(req.body.cantidad_personas, { max: 20, field: 'cantidad de personas' });
      if (!positiveInteger(req.body.id_experiencia)) throw new RuleError(400, 'La experiencia no es válida.');
      connection = await db().getConnection();
      await connection.beginTransaction();
      // Bloquear la experiencia evita sobrecupo cuando dos turistas se inscriben a la vez.
      const [rows] = await connection.query(`SELECT e.*, r.nombre AS nombre_restaurante, r.id_propietario FROM experiencias e JOIN restaurantes r ON r.id_restaurante = e.id_restaurante
        WHERE e.id_experiencia = ? FOR UPDATE`, [Number(req.body.id_experiencia)]);
      if (!rows.length) throw new RuleError(404, 'La experiencia no existe.');
      const exp = rows[0];
      const fecha = String(exp.fecha_experiencia).slice(0, 10);
      if (exp.estado_experiencia !== 'programada' || fecha <= bogotaDate(now())) throw new RuleError(400, 'La experiencia ya no recibe inscripciones.');
      const [[used]] = await connection.query("SELECT COALESCE(SUM(cantidad_personas), 0) AS ocupados FROM inscripciones_experiencia WHERE id_experiencia = ? AND estado_inscripcion <> 'cancelada'", [exp.id_experiencia]);
      const libres = Number(exp.cupo_maximo) - Number(used.ocupados);
      if (cantidad > libres) throw new RuleError(409, libres > 0 ? `Solo quedan ${libres} cupos.` : 'La experiencia no tiene cupos disponibles.');
      const total = Math.round(Number(exp.precio_persona) * cantidad * 100) / 100;
      let metodo = null;
      if (total > 0) {
        const [methods] = await connection.query("SELECT id_metodo, tipo_pago FROM metodos_pago WHERE id_metodo = ?", [Number(req.body.id_metodo) || 0]);
        if (!methods.length || methods[0].tipo_pago !== 'online') throw new RuleError(400, 'Selecciona un medio de pago en línea.');
        metodo = methods[0].id_metodo;
      }
      const [previous] = await connection.query('SELECT id_inscripcion, estado_inscripcion FROM inscripciones_experiencia WHERE id_experiencia = ? AND id_usuario = ?', [exp.id_experiencia, req.user.id_usuario]);
      if (previous.length && previous[0].estado_inscripcion !== 'cancelada') throw new RuleError(409, 'Ya estás inscrito en esta experiencia.');
      if (previous.length) throw new RuleError(409, 'Cancelaste esta inscripción antes; comunícate con el restaurante para reactivarla.');
      const stamp = colombianTimestamp(now());
      const [result] = await connection.query(`INSERT INTO inscripciones_experiencia (id_experiencia, id_usuario, cantidad_personas, total, fecha_inscripcion, estado_inscripcion)
        VALUES (?, ?, ?, ?, ?, 'confirmada')`, [exp.id_experiencia, req.user.id_usuario, cantidad, total, stamp]);
      let id_pago = null;
      if (total > 0) {
        const [pago] = await connection.query("INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_inscripcion) VALUES (?, 'aprobado', ?, ?, ?)", [total, req.user.id_usuario, metodo, result.insertId]);
        id_pago = pago.insertId;
      }
      await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`Inscripción confirmada en "${exp.nombre}" (${exp.nombre_restaurante}) el ${fecha} a las ${String(exp.hora_inicio).slice(0, 5)} para ${cantidad} personas.`, req.user.id_usuario]);
      await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`Nueva inscripción de ${cantidad} personas en "${exp.nombre}" del ${fecha}.`, exp.id_propietario]);
      await addReminder(connection, { id_usuario: req.user.id_usuario, tipo_recordatorio: 'experiencia', id_inscripcion: result.insertId, fecha_programada: `${shiftDays(fecha, -1)} 09:00:00`,
        titulo: exp.nombre, mensaje: `La experiencia inicia el ${fecha} a las ${String(exp.hora_inicio).slice(0, 5)} en ${exp.nombre_restaurante}.` });
      await connection.commit();
      res.status(201).json({ id_inscripcion: result.insertId, id_pago, total, estado_inscripcion: 'confirmada' });
    } catch (error) {
      if (connection) await connection.rollback();
      sendRuleError(res, error, 'No se pudo completar la inscripción.');
    } finally { if (connection) connection.release(); }
  });

  app.put('/api/inscripciones/:id', checkDbConnection, requireSession, async (req, res) => {
    try {
      if (!positiveInteger(req.params.id)) throw new RuleError(400, 'La inscripción no es válida.');
      const estado = req.body.estado_inscripcion;
      if (!['cancelada', 'asistio'].includes(estado)) throw new RuleError(400, 'El estado de la inscripción no es válido.');
      const [rows] = await db().query(`SELECT i.*, e.fecha_experiencia, e.nombre, r.id_propietario FROM inscripciones_experiencia i
        JOIN experiencias e ON e.id_experiencia = i.id_experiencia JOIN restaurantes r ON r.id_restaurante = e.id_restaurante WHERE i.id_inscripcion = ?`, [Number(req.params.id)]);
      if (!rows.length) throw new RuleError(404, 'La inscripción no existe.');
      const ins = rows[0];
      const manages = isAdmin(req.user) || (isOwnerRole(req.user) && Number(ins.id_propietario) === Number(req.user.id_usuario));
      const own = Number(ins.id_usuario) === Number(req.user.id_usuario);
      if (ins.estado_inscripcion !== 'confirmada') throw new RuleError(400, 'Solo se modifican inscripciones confirmadas.');
      const fecha = String(ins.fecha_experiencia).slice(0, 10);
      if (estado === 'asistio' && !manages) throw new RuleError(403, 'Solo el restaurante registra la asistencia.');
      if (estado === 'asistio' && fecha > bogotaDate(now())) throw new RuleError(400, 'La asistencia se registra el día de la experiencia o después.');
      if (estado === 'cancelada' && !manages && !own) throw new RuleError(403, 'No puedes cancelar esta inscripción.');
      if (estado === 'cancelada' && fecha <= bogotaDate(now())) throw new RuleError(400, 'Las inscripciones se cancelan hasta el día anterior.');
      await db().query('UPDATE inscripciones_experiencia SET estado_inscripcion = ? WHERE id_inscripcion = ?', [estado, ins.id_inscripcion]);
      if (estado === 'cancelada') {
        await db().query('DELETE FROM recordatorios WHERE id_inscripcion = ? AND enviado = FALSE', [ins.id_inscripcion]);
        await db().query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`Tu inscripción en "${ins.nombre}" fue cancelada.`, ins.id_usuario]);
      }
      res.json({ message: estado === 'cancelada' ? 'Inscripción cancelada.' : 'Asistencia registrada.' });
    } catch (error) { sendRuleError(res, error, 'No se pudo actualizar la inscripción.'); }
  });

  // ------------------------------------------------------------------
  // PLANES Y SUSCRIPCIONES (pago en línea con vigencia)
  // ------------------------------------------------------------------
  app.get('/api/suscripciones', checkDbConnection, requireStaff, async (req, res) => {
    try {
      await expireSubscriptions(db(), now);
      const where = isAdmin(req.user) ? '' : 'WHERE r.id_propietario = ?';
      const [rows] = await db().query(`SELECT s.*, r.nombre AS nombre_restaurante, p.nombre_plan, p.costo, pg.monto, pg.fecha_pago, m.nombre_metodo
        FROM suscripciones s JOIN restaurantes r ON r.id_restaurante = s.id_restaurante JOIN planes_suscripcion p ON p.id_plan = s.id_plan
        LEFT JOIN pagos pg ON pg.id_pago = s.id_pago LEFT JOIN metodos_pago m ON m.id_metodo = pg.id_metodo
        ${where} ORDER BY s.fecha_inicio DESC, s.id_suscripcion DESC`, where ? [req.user.id_usuario] : []);
      res.json(rows);
    } catch (error) { sendRuleError(res, error, 'No se pudieron consultar las suscripciones.'); }
  });

  app.post('/api/suscripciones', checkDbConnection, requireStaff, async (req, res) => {
    let connection;
    try {
      connection = await db().getConnection();
      await connection.beginTransaction();
      const restaurant = await assertManagesRestaurant(connection, req.user, req.body.id_restaurante);
      if (!positiveInteger(req.body.id_plan)) throw new RuleError(400, 'Selecciona un plan.');
      const [plans] = await connection.query('SELECT * FROM planes_suscripcion WHERE id_plan = ?', [Number(req.body.id_plan)]);
      if (!plans.length) throw new RuleError(404, 'El plan no existe.');
      const plan = plans[0];
      const today = bogotaDate(now());
      await expireSubscriptions(connection, now);
      const [active] = await connection.query("SELECT * FROM suscripciones WHERE id_restaurante = ? AND estado_suscripcion = 'activa' ORDER BY fecha_fin DESC LIMIT 1 FOR UPDATE", [restaurant.id_restaurante]);
      let inicio = today;
      if (active.length && Number(active[0].id_plan) === Number(plan.id_plan)) {
        // Renovar el mismo plan suma un periodo a partir del vencimiento actual.
        inicio = String(active[0].fecha_fin).slice(0, 10);
        if (inicio > shiftDays(today, 31)) throw new RuleError(400, `El plan ya está pagado hasta ${inicio}. Puedes renovarlo desde un mes antes del vencimiento.`);
      } else if (active.length) {
        // Cambiar de plan reemplaza el actual desde hoy.
        await connection.query("UPDATE suscripciones SET estado_suscripcion = 'cancelada' WHERE id_suscripcion = ?", [active[0].id_suscripcion]);
        await connection.query('DELETE FROM recordatorios WHERE id_suscripcion = ? AND enviado = FALSE', [active[0].id_suscripcion]);
      }
      const fin = addMonths(inicio, Number(plan.duracion_meses));
      let id_pago = null;
      if (Number(plan.costo) > 0) {
        const [methods] = await connection.query('SELECT id_metodo, tipo_pago FROM metodos_pago WHERE id_metodo = ?', [Number(req.body.id_metodo) || 0]);
        if (!methods.length || methods[0].tipo_pago !== 'online') throw new RuleError(400, 'Selecciona un medio de pago en línea.');
        const [pago] = await connection.query("INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_plan) VALUES (?, 'aprobado', ?, ?, ?)", [plan.costo, req.user.id_usuario, methods[0].id_metodo, plan.id_plan]);
        id_pago = pago.insertId;
      }
      const [result] = await connection.query("INSERT INTO suscripciones (id_restaurante, id_plan, fecha_inicio, fecha_fin, estado_suscripcion, id_pago) VALUES (?, ?, ?, ?, 'activa', ?)",
        [restaurant.id_restaurante, plan.id_plan, inicio, fin, id_pago]);
      await connection.query('UPDATE restaurantes SET id_plan = ? WHERE id_restaurante = ?', [plan.id_plan, restaurant.id_restaurante]);
      await connection.query('INSERT INTO notificaciones (mensaje, id_usuario) VALUES (?, ?)', [`Plan ${plan.nombre_plan} activo para ${restaurant.nombre} del ${inicio} al ${fin}.`, restaurant.id_propietario]);
      await addReminder(connection, { id_usuario: restaurant.id_propietario, tipo_recordatorio: 'plan', id_suscripcion: result.insertId, fecha_programada: `${shiftDays(fin, -5)} 08:00:00`,
        titulo: `Renovación del plan ${plan.nombre_plan}`, mensaje: `El plan de ${restaurant.nombre} vence el ${fin}.` });
      await connection.commit();
      res.status(201).json({ id_suscripcion: result.insertId, id_pago, fecha_inicio: inicio, fecha_fin: fin, id_plan: plan.id_plan });
    } catch (error) {
      if (connection) await connection.rollback();
      sendRuleError(res, error, 'No se pudo contratar el plan.');
    } finally { if (connection) connection.release(); }
  });

  // ------------------------------------------------------------------
  // RECORDATORIOS PERSONALIZADOS
  // ------------------------------------------------------------------
  app.get('/api/recordatorios', checkDbConnection, requireSession, async (req, res) => {
    try {
      await processReminders(db(), now);
      const [rows] = await db().query('SELECT * FROM recordatorios WHERE id_usuario = ? ORDER BY enviado, fecha_programada DESC', [req.user.id_usuario]);
      res.json(rows);
    } catch (error) { sendRuleError(res, error, 'No se pudieron consultar los recordatorios.'); }
  });

  app.post('/api/recordatorios', checkDbConnection, requireSession, async (req, res) => {
    try {
      const titulo = cleanText(req.body.titulo, { max: 150, field: 'título' });
      const mensaje = cleanText(req.body.mensaje, { max: 1000, field: 'mensaje' });
      const value = String(req.body.fecha_programada || '').replace('T', ' ');
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) || !validDate(value.slice(0, 10))) throw new RuleError(400, 'La fecha y hora del recordatorio no son válidas.');
      const fecha_programada = value.length === 16 ? `${value}:00` : value;
      if (fecha_programada <= colombianTimestamp(now())) throw new RuleError(400, 'El recordatorio debe programarse en el futuro.');
      let id_reserva = null; let tipo = 'personal';
      if (req.body.id_reserva) {
        if (!positiveInteger(req.body.id_reserva)) throw new RuleError(400, 'La reserva no es válida.');
        const [own] = await db().query('SELECT id_reserva FROM reservas WHERE id_reserva = ? AND id_usuario = ?', [Number(req.body.id_reserva), req.user.id_usuario]);
        if (!own.length) throw new RuleError(403, 'Solo puedes asociar tus propias reservas.');
        id_reserva = own[0].id_reserva; tipo = 'reserva';
      }
      const [result] = await db().query(`INSERT INTO recordatorios (id_usuario, tipo_recordatorio, titulo, mensaje, fecha_programada, id_reserva)
        VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id_usuario, tipo, titulo, mensaje, fecha_programada, id_reserva]);
      res.status(201).json({ id_recordatorio: result.insertId, tipo_recordatorio: tipo, titulo, mensaje, fecha_programada, enviado: false });
    } catch (error) { sendRuleError(res, error, 'No se pudo crear el recordatorio.'); }
  });

  app.delete('/api/recordatorios/:id', checkDbConnection, requireSession, async (req, res) => {
    try {
      if (!positiveInteger(req.params.id)) throw new RuleError(400, 'El recordatorio no es válido.');
      const [result] = await db().query('DELETE FROM recordatorios WHERE id_recordatorio = ? AND id_usuario = ? AND enviado = FALSE', [Number(req.params.id), req.user.id_usuario]);
      if (!result.affectedRows) throw new RuleError(404, 'El recordatorio no existe, no es tuyo o ya fue enviado.');
      res.json({ message: 'Recordatorio eliminado.' });
    } catch (error) { sendRuleError(res, error, 'No se pudo eliminar el recordatorio.'); }
  });
}

module.exports = { registerExtraRoutes, processReminders, expireSubscriptions, addMonths, EXPERIENCE_TYPES };
