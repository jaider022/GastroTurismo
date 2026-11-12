'use strict';

async function processReservationReminders(db, timestamp) {
  const connection = await db.getConnection();
  let lockName, locked = false;
  try {
    const [[database]] = await connection.query('SELECT DATABASE() AS name');
    lockName = database.name + ':recordatorios';
    const [[lock]] = await connection.query('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) return 0;
    locked = true;
    await connection.beginTransaction();
    const [reservations] = await connection.query(`SELECT re.id_reserva,re.id_usuario,
      DATE_FORMAT(re.fecha_reserva,'%Y-%m-%d') AS fecha, LEFT(re.hora_reserva,5) AS hora
      FROM reservas re JOIN estados_reserva er ON er.id_estado_reserva=re.id_estado_reserva
      WHERE er.codigo IN ('pendiente','confirmada')
      AND TIMESTAMP(re.fecha_reserva,re.hora_reserva)>?
      AND TIMESTAMP(re.fecha_reserva,re.hora_reserva)<=DATE_ADD(?,INTERVAL 1 DAY)
      ORDER BY re.fecha_reserva,re.hora_reserva,re.id_reserva FOR UPDATE`, [timestamp, timestamp]);
    let created = 0;
    for (const reservation of reservations) {
      const message = `Recordatorio de reserva #${reservation.id_reserva} para ${reservation.fecha} a las ${reservation.hora}. Consulta el restaurante y las mesas en Mis reservas.`;
      const [result] = await connection.query(`INSERT INTO notificaciones(mensaje,id_usuario,fecha_envio)
        SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM notificaciones WHERE id_usuario=? AND mensaje=?)`,
        [message, reservation.id_usuario, timestamp, reservation.id_usuario, message]);
      created += result.affectedRows;
    }
    await connection.commit();
    return created;
  } catch (error) {
    if (locked) await connection.rollback();
    throw error;
  } finally {
    try { if (locked) await connection.query('DO RELEASE_LOCK(?)', [lockName]); }
    finally { connection.release(); }
  }
}

module.exports = { processReservationReminders };
