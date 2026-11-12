'use strict';

const { validDate } = require('./periods');
const { catalogId } = require('./catalogos');

const DURACION_RESERVA = 120;
const active = new Set(['pendiente', 'confirmada']);
const transitions = { pendiente: ['confirmada', 'cancelada'], confirmada: ['finalizada', 'cancelada'], cancelada: [], finalizada: [] };
const positiveId = value => /^\d+$/.test(String(value)) && Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
const hours = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

class ReservationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function slot(fecha, hora) {
  if (!validDate(fecha) || typeof hora !== 'string' || !hours.test(hora)) throw new ReservationError(400, 'Indica una fecha y una hora válidas.');
  return `${fecha} ${hora.length === 5 ? hora + ':00' : hora}`;
}

function access(user, row) {
  return user.tipo_usuario === 'administrador' ||
    (user.tipo_usuario === 'cliente' && Number(row.id_usuario) === Number(user.id_usuario)) ||
    (user.tipo_usuario === 'restaurante' && Number(row.id_propietario) === Number(user.id_usuario));
}

const selectReservations = `SELECT re.*, e.codigo AS estado_reserva, u.nombre AS nombre_usuario, u.correo AS correo_usuario,
  r.nombre AS nombre_restaurante, r.id_restaurante, r.id_propietario, a.numero_mesa, a.ubicacion_mesa, a.mesa_ids
  FROM reservas re JOIN estados_reserva e ON e.id_estado_reserva=re.id_estado_reserva
  JOIN usuarios u ON u.id_usuario=re.id_usuario
  JOIN (SELECT rm.id_reserva, MIN(m.id_restaurante) AS id_restaurante,
        GROUP_CONCAT(m.id_mesa ORDER BY m.id_mesa) AS mesa_ids,
        GROUP_CONCAT(m.numero_mesa ORDER BY m.id_mesa SEPARATOR ', ') AS numero_mesa,
        GROUP_CONCAT(DISTINCT m.ubicacion ORDER BY m.ubicacion SEPARATOR ', ') AS ubicacion_mesa
        FROM reserva_mesas rm JOIN mesas m ON m.id_mesa=rm.id_mesa GROUP BY rm.id_reserva) a ON a.id_reserva=re.id_reserva
  JOIN restaurantes r ON r.id_restaurante=a.id_restaurante`;

function responseRow({ mesa_ids, id_propietario, ...row }) {
  const id_mesas = mesa_ids.split(',').map(Number);
  return { ...row, id_mesas, id_mesa: id_mesas[0] };
}

async function getReservation(db, id, user) {
  if (!positiveId(id)) throw new ReservationError(400, 'Reserva inválida.');
  const [[row]] = await db.query(selectReservations + ' WHERE re.id_reserva=?', [Number(id)]);
  if (!row) throw new ReservationError(404, 'La reserva no existe.');
  if (!access(user, row)) throw new ReservationError(403, 'Esta reserva pertenece a otro usuario o restaurante.');
  return { ...responseRow(row), id_propietario: row.id_propietario };
}

const conflicts = `FROM reserva_mesas rm JOIN reservas re ON re.id_reserva=rm.id_reserva
  JOIN estados_reserva e ON e.id_estado_reserva=re.id_estado_reserva
  WHERE e.codigo IN ('pendiente','confirmada') AND re.id_reserva<>?
  AND re.fecha_reserva BETWEEN DATE_SUB(DATE(?), INTERVAL 1 DAY) AND DATE_ADD(DATE(?), INTERVAL 1 DAY)
  AND TIMESTAMP(re.fecha_reserva,re.hora_reserva)<DATE_ADD(?, INTERVAL ${DURACION_RESERVA} MINUTE)
  AND DATE_ADD(TIMESTAMP(re.fecha_reserva,re.hora_reserva), INTERVAL ${DURACION_RESERVA} MINUTE)>?`;

async function writeReservation(db, user, body, now, id = null) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let previous;
    if (id !== null) {
      const [[locked]] = await connection.query('SELECT id_reserva FROM reservas WHERE id_reserva=? FOR UPDATE', [id]);
      if (!locked) throw new ReservationError(404, 'La reserva no existe.');
      previous = await getReservation(connection, id, user);
    }
    const rawIds = body.id_mesas ?? (body.id_mesa == null ? previous?.id_mesas : [body.id_mesa]);
    if (!Array.isArray(rawIds) || !rawIds.length || rawIds.some(value => !positiveId(value))) throw new ReservationError(400, 'Selecciona al menos una mesa válida.');
    const tableIds = [...new Set(rawIds.map(Number))].sort((a, b) => a - b);
    const fecha = body.fecha_reserva ?? previous?.fecha_reserva;
    const hora = body.hora_reserva ?? previous?.hora_reserva;
    const start = slot(fecha, hora);
    const people = Number(body.cantidad_personas ?? previous?.cantidad_personas);
    if (!positiveId(people)) throw new ReservationError(400, 'La cantidad de personas debe ser un entero positivo.');
    const userId = Number(previous?.id_usuario ?? body.id_usuario ?? user.id_usuario);
    if (!positiveId(userId) || (user.tipo_usuario === 'cliente' && Number(user.id_usuario) !== userId)) throw new ReservationError(403, 'Solo puedes reservar a tu nombre.');
    const state = body.estado_reserva ?? previous?.estado_reserva ?? 'pendiente';
    if (!Object.hasOwn(transitions, state) || (!previous && !active.has(state))) throw new ReservationError(400, 'Estado de reserva inválido.');
    if (previous && state !== previous.estado_reserva && !transitions[previous.estado_reserva].includes(state)) throw new ReservationError(409, 'Ese cambio de estado no está permitido.');
    if (user.tipo_usuario === 'cliente' && state !== 'pendiente' && state !== 'cancelada' && state !== previous?.estado_reserva) throw new ReservationError(403, 'El restaurante debe confirmar o finalizar la reserva.');

    const [tables] = await connection.query(`SELECT m.id_mesa,m.id_restaurante,m.capacidad,m.estado,r.capacidad_total,r.id_propietario
      FROM mesas m JOIN restaurantes r ON r.id_restaurante=m.id_restaurante WHERE m.id_mesa IN (?) ORDER BY m.id_mesa FOR UPDATE`, [tableIds]);
    if (tables.length !== tableIds.length || tables.some(table => table.id_restaurante !== tables[0].id_restaurante)) throw new ReservationError(400, 'Las mesas deben existir y pertenecer al mismo restaurante.');
    const restaurant = tables[0];
    if (!access(user, { id_usuario: userId, id_propietario: restaurant.id_propietario })) throw new ReservationError(403, 'No puedes gestionar reservas de ese restaurante.');
    const changed = !previous || start !== slot(previous.fecha_reserva, previous.hora_reserva) ||
      people !== Number(previous.cantidad_personas) || tableIds.join(',') !== previous.id_mesas.join(',');
    if (previous && !active.has(previous.estado_reserva) && changed) throw new ReservationError(409, 'Una reserva cerrada no puede reprogramarse.');
    if (active.has(state) && (changed || state !== previous?.estado_reserva)) {
      if (new Date(start.replace(' ', 'T') + '-05:00') <= now()) throw new ReservationError(400, 'La reserva debe empezar en el futuro.');
      if (tables.some(table => table.estado === 'mantenimiento')) throw new ReservationError(409, 'Una de las mesas está en mantenimiento.');
      if (people > Math.min(Number(restaurant.capacidad_total), tables.reduce((sum, table) => sum + Number(table.capacidad), 0))) {
        throw new ReservationError(400, 'Las mesas elegidas no tienen capacidad suficiente.');
      }
      const [busy] = await connection.query(`SELECT rm.id_mesa ${conflicts} AND rm.id_mesa IN (?) LIMIT 1 FOR UPDATE`, [id ?? 0, start, start, start, start, tableIds]);
      if (busy.length) throw new ReservationError(409, 'Una de las mesas ya está reservada en ese horario.');
      const [overlapping] = await connection.query(`SELECT DISTINCT re.id_reserva,re.fecha_reserva,re.hora_reserva,re.cantidad_personas ${conflicts}
        AND rm.id_mesa IN (SELECT id_mesa FROM mesas WHERE id_restaurante=?)`, [id ?? 0, start, start, start, start, restaurant.id_restaurante]);
      const begins = Date.parse(start.replace(' ', 'T') + '-05:00');
      const ends = begins + DURACION_RESERVA * 60000;
      const events = new Map([[begins, people], [ends, -people]]);
      for (const reservation of overlapping) {
        const arrival = Date.parse(slot(reservation.fecha_reserva, reservation.hora_reserva).replace(' ', 'T') + '-05:00');
        const from = Math.max(begins, arrival);
        const to = Math.min(ends, arrival + DURACION_RESERVA * 60000);
        events.set(from, (events.get(from) || 0) + Number(reservation.cantidad_personas));
        events.set(to, (events.get(to) || 0) - Number(reservation.cantidad_personas));
      }
      let occupied = 0;
      for (const [, change] of [...events].sort(([a], [b]) => a - b)) {
        occupied += change;
        if (occupied > Number(restaurant.capacidad_total)) throw new ReservationError(409, 'El restaurante alcanza su aforo en parte de ese horario. Selecciona otra hora.');
      }
    }
    const stateId = await catalogId(connection, 'estados_reserva', state);
    if (!stateId) throw new ReservationError(503, 'El catálogo de estados de reserva requiere actualización.');
    if (previous) {
      await connection.query('UPDATE reservas SET fecha_reserva=?,hora_reserva=?,cantidad_personas=?,id_estado_reserva=? WHERE id_reserva=?', [fecha, start.slice(11), people, stateId, id]);
      if (changed) await connection.query('DELETE FROM reserva_mesas WHERE id_reserva=?', [id]);
    } else {
      const [result] = await connection.query('INSERT INTO reservas (fecha_reserva,hora_reserva,cantidad_personas,id_estado_reserva,id_usuario) VALUES (?,?,?,?,?)', [fecha, start.slice(11), people, stateId, userId]);
      id = result.insertId;
      await connection.query('INSERT INTO notificaciones (mensaje,id_usuario) VALUES (?,?)', [`Tu reserva para el día ${fecha} a las ${start.slice(11, 16)} ha sido registrada.`, userId]);
    }
    if (changed) await connection.query('INSERT INTO reserva_mesas (id_reserva,id_mesa) VALUES ?', [tableIds.map(table => [id, table])]);
    if (previous && (changed || state !== previous.estado_reserva)) {
      await connection.query('INSERT INTO notificaciones (mensaje,id_usuario) VALUES (?,?)',
        [`Tu reserva #${id} para ${fecha} a las ${start.slice(11, 16)} fue actualizada. Estado ${state}.`, userId]);
    }
    const row = await getReservation(connection, id, user);
    await connection.commit();
    const { id_propietario, ...result } = row;
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

function registerReservations(app, { getDb, checkDbConnection, requireSession, now }) {
  function handler(action) {
    return [requireSession, checkDbConnection, async (req, res) => {
      try { await action(getDb(), req, res); }
      catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'La reserva tiene registros vinculados. Usa la opción de cancelar cuando corresponda.' });
        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) return res.status(409).json({ error: 'El horario se está actualizando. Vuelve a consultar la disponibilidad.' });
        res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo completar la operación de reservas.' });
      }
    }];
  }

  app.get('/api/reservas/disponibilidad', ...handler(async (db, req, res) => {
    const { id_restaurante, fecha, hora, id_reserva } = req.query;
    if (!positiveId(id_restaurante)) throw new ReservationError(400, 'Selecciona un restaurante.');
    const start = slot(fecha, hora);
    if (id_reserva) await getReservation(db, id_reserva, req.user);
    const [tables] = await db.query(`SELECT m.* FROM mesas m WHERE m.id_restaurante=? AND m.estado<>'mantenimiento'
      AND NOT EXISTS (SELECT 1 ${conflicts} AND rm.id_mesa=m.id_mesa) ORDER BY m.numero_mesa`, [Number(id_restaurante), Number(id_reserva || 0), start, start, start, start]);
    res.json(tables);
  }));

  app.get('/api/reservas', ...handler(async (db, req, res) => {
    const filters = { cliente: ' WHERE re.id_usuario=?', restaurante: ' WHERE r.id_propietario=?', administrador: '' };
    const filter = filters[req.user.tipo_usuario];
    if (filter === undefined) throw new ReservationError(403, 'Rol no autorizado.');
    const [rows] = await db.query(selectReservations + filter + ' ORDER BY re.fecha_reserva DESC,re.hora_reserva DESC', filter ? [req.user.id_usuario] : []);
    res.json(rows.map(responseRow));
  }));

  app.post('/api/reservas', ...handler(async (db, req, res) => {
    res.status(201).json(await writeReservation(db, req.user, req.body, now));
  }));
  app.put('/api/reservas/:id', ...handler(async (db, req, res) => {
    if (!positiveId(req.params.id)) throw new ReservationError(400, 'Reserva inválida.');
    res.json(await writeReservation(db, req.user, req.body, now, Number(req.params.id)));
  }));
  app.delete('/api/reservas/:id', ...handler(async (db, req, res) => {
    const row = await getReservation(db, req.params.id, req.user);
    if (req.user.tipo_usuario === 'cliente' && row.estado_reserva !== 'pendiente') throw new ReservationError(409, 'Solo se pueden eliminar reservas pendientes.');
    await db.query('DELETE FROM reservas WHERE id_reserva=?', [row.id_reserva]);
    res.json({ message: 'Reserva eliminada con éxito.' });
  }));
}

module.exports = { registerReservations };
