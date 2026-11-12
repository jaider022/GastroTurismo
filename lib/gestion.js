'use strict';

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function text(value, name, maximum, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string') throw invalid(`Revisa ${name}.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > maximum) throw invalid(`Revisa ${name} y su longitud máxima de ${maximum} caracteres.`);
  return clean || null;
}

function integer(value, name) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647) {
    throw invalid(`Indica ${name} como un entero positivo.`);
  }
  return Number(value);
}

function managementPayload(table, body) {
  if (table === 'restaurantes') {
    const email = text(body.email, 'el correo', 150, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('El correo del restaurante no es válido.');
    return {
      nombre: text(body.nombre, 'el nombre', 150), direccion: text(body.direccion, 'la dirección', 200),
      telefono: text(body.telefono, 'el teléfono', 20, false), email,
      capacidad_total: integer(body.capacidad_total, 'el aforo'), especialidad: text(body.especialidad, 'la especialidad', 100, false),
      id_zona: integer(body.id_zona, 'la zona'), id_propietario: integer(body.id_propietario, 'el propietario')
    };
  }
  const id_restaurante = integer(body.id_restaurante, 'el restaurante');
  if (table === 'mesas') {
    const estado = body.estado ?? 'disponible';
    if (!['disponible', 'reservada', 'mantenimiento'].includes(estado)) throw invalid('El estado de la mesa no es válido.');
    return { numero_mesa: text(body.numero_mesa, 'el número de mesa', 20), capacidad: integer(body.capacidad, 'la capacidad'),
      ubicacion: text(body.ubicacion, 'la ubicación', 100), estado, id_restaurante };
  }
  const precio = Number(body.precio);
  if (body.precio === '' || body.precio == null || !Number.isFinite(precio) || precio < 0 || precio > 99999999.99 ||
      Math.abs(precio * 100 - Math.round(precio * 100)) > 0.0001) throw invalid('El precio debe tener hasta dos decimales y ser cero o mayor.');
  const disponibilidad = body.disponibilidad ?? true;
  if (![true, false, 0, 1, '0', '1'].includes(disponibilidad)) throw invalid('La disponibilidad del plato no es válida.');
  return { nombre: text(body.nombre, 'el nombre del plato', 150), descripcion: text(body.descripcion, 'la descripción', 65535, false),
    precio, disponibilidad: Number(disponibilidad), id_categoria: integer(body.id_categoria, 'la categoría'), id_restaurante };
}

function sendManagementError(res, error) {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un registro con esos datos. Revisa el número de mesa.' });
  if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'El registro tiene historial asociado. Conserva sus datos y cambia su disponibilidad cuando corresponda.' });
  if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'La zona, el propietario, la categoría o el restaurante seleccionado ya no existe.' });
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) return res.status(409).json({ error: 'El registro se está actualizando. Actualiza la lista y vuelve a intentarlo.' });
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el cambio.' });
}

async function updateCapacity(db, table, id, body, timestamp) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const restaurantId = table === 'mesas' ? body.id_restaurante : id;
    await connection.query('SELECT id_restaurante FROM restaurantes WHERE id_restaurante=? FOR UPDATE', [restaurantId]);
    const [rows] = await connection.query(`SELECT re.id_reserva,re.cantidad_personas,SUM(m.capacidad) AS capacidad,
      MAX(CASE WHEN m.id_mesa=? THEN m.capacidad ELSE 0 END) AS capacidad_mesa
      FROM reservas re JOIN estados_reserva er ON er.id_estado_reserva=re.id_estado_reserva
      JOIN reserva_mesas rm ON rm.id_reserva=re.id_reserva JOIN mesas m ON m.id_mesa=rm.id_mesa
      WHERE m.id_restaurante=? AND er.codigo IN ('pendiente','confirmada')
      AND DATE_ADD(TIMESTAMP(re.fecha_reserva,re.hora_reserva),INTERVAL 120 MINUTE)>?
      GROUP BY re.id_reserva,re.cantidad_personas`, [table === 'mesas' ? id : 0, restaurantId, timestamp]);
    if (table === 'mesas') {
      const assigned = rows.filter(r => Number(r.capacidad_mesa) > 0);
      if (body.estado === 'mantenimiento' && assigned.length) throw invalid('Esta mesa tiene reservas activas. Reasigna o cancela esas reservas antes de ponerla en mantenimiento.', 409);
      if (assigned.some(r => Number(r.cantidad_personas) > Number(r.capacidad) - Number(r.capacidad_mesa) + body.capacidad)) {
        throw invalid('La nueva capacidad dejaría sin cupo a una reserva activa.', 409);
      }
      await connection.query('UPDATE mesas SET numero_mesa=?,capacidad=?,ubicacion=?,estado=? WHERE id_mesa=?',
        [body.numero_mesa, body.capacidad, body.ubicacion, body.estado, id]);
    } else {
      if (rows.some(r => Number(r.cantidad_personas) > body.capacidad_total)) throw invalid('El nuevo aforo es menor que un grupo con reserva activa.', 409);
      const [activities] = await connection.query("SELECT id_experiencia FROM experiencias WHERE id_restaurante=? AND estado='activa' AND fecha_hora>? AND cupos>? LIMIT 1", [id,timestamp,body.capacidad_total]);
      if (activities.length) throw invalid('Hay una experiencia futura con más cupos que el nuevo aforo. Ajusta primero los cupos de esa actividad.', 409);
      await connection.query('UPDATE restaurantes SET nombre=?,direccion=?,telefono=?,email=?,capacidad_total=?,especialidad=?,id_zona=?,id_propietario=? WHERE id_restaurante=?',
        [body.nombre, body.direccion, body.telefono, body.email, body.capacidad_total, body.especialidad, body.id_zona, body.id_propietario, id]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { managementPayload, sendManagementError, updateCapacity };
