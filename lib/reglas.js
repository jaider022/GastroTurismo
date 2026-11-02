'use strict';
// Reglas de negocio compartidas por el servidor: permisos por rol y validaciones.
const { validDate, bogotaDate } = require('./periods');

const ACTIVE_RESERVATION = ['pendiente', 'confirmada'];
const ORDER_TRANSITIONS = {
  'en preparacion': ['en camino', 'entregado', 'cancelado'],
  'en camino': ['entregado', 'cancelado'],
  entregado: [],
  cancelado: []
};

class RuleError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const isAdmin = user => user?.tipo_usuario === 'administrador';
const isOwnerRole = user => user?.tipo_usuario === 'restaurante';
const isStaff = user => isAdmin(user) || isOwnerRole(user);
const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;

function cleanText(value, { max, required = true, field }) {
  if (value == null || value === '') {
    if (required) throw new RuleError(400, `El campo ${field} es obligatorio.`);
    return null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw new RuleError(400, `El campo ${field} no es válido.`);
  const text = String(value).trim();
  if (required && !text) throw new RuleError(400, `El campo ${field} es obligatorio.`);
  if (text.length > max) throw new RuleError(400, `El campo ${field} supera ${max} caracteres.`);
  return text || null;
}

function integerInRange(value, { min = 1, max = 2147483647, field }) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new RuleError(400, `El campo ${field} debe ser un número entero entre ${min} y ${max}.`);
  return number;
}

function money(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 99999999.99) throw new RuleError(400, `El campo ${field} debe ser un valor positivo.`);
  return Math.round(number * 100) / 100;
}

function validTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

// Reserva: fecha real, no pasada, horario de atención y personas positivas.
function validateReservationFields({ fecha_reserva, hora_reserva, cantidad_personas }, now) {
  if (!validDate(fecha_reserva)) throw new RuleError(400, 'La fecha de la reserva no es válida.');
  if (!validTime(hora_reserva)) throw new RuleError(400, 'La hora de la reserva no es válida.');
  const hour = Number(hora_reserva.slice(0, 2));
  if (hour < 6 || hour > 22) throw new RuleError(400, 'Las reservas se reciben entre las 6:00 y las 22:59.');
  const today = bogotaDate(now);
  if (fecha_reserva < today) throw new RuleError(400, 'No se pueden registrar reservas en fechas pasadas.');
  if (fecha_reserva === today) {
    const current = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    if (hora_reserva.slice(0, 5) <= current) throw new RuleError(400, 'La hora de la reserva ya pasó.');
  }
  const limit = new Date(`${today}T12:00:00Z`); limit.setUTCDate(limit.getUTCDate() + 180);
  if (fecha_reserva > limit.toISOString().slice(0, 10)) throw new RuleError(400, 'Las reservas se aceptan con máximo seis meses de anticipación.');
  return { fecha_reserva, hora_reserva: hora_reserva.length === 5 ? `${hora_reserva}:00` : hora_reserva, cantidad_personas: integerInRange(cantidad_personas, { max: 100, field: 'cantidad de personas' }) };
}

async function restaurantFor(db, id) {
  if (!positiveInteger(id)) throw new RuleError(400, 'El restaurante no es válido.');
  const [rows] = await db.query('SELECT id_restaurante, id_propietario, capacidad_total, nombre FROM restaurantes WHERE id_restaurante = ?', [Number(id)]);
  if (!rows.length) throw new RuleError(404, 'El restaurante no existe.');
  return rows[0];
}

// Administrador: todo. Propietario: solo sus restaurantes. Cliente: nada.
async function assertManagesRestaurant(db, user, id) {
  const restaurant = await restaurantFor(db, id);
  if (isAdmin(user)) return restaurant;
  if (isOwnerRole(user) && Number(restaurant.id_propietario) === Number(user.id_usuario)) return restaurant;
  throw new RuleError(403, 'Solo puedes administrar los restaurantes de tu propiedad.');
}

function sendRuleError(res, error, fallback) {
  if (error instanceof RuleError) return res.status(error.status).json({ error: error.message });
  if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') return res.status(409).json({ error: 'No se puede eliminar porque tiene registros relacionados. Puedes desactivarlo o cancelarlo para conservar el historial.' });
  if (error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.code === 'ER_NO_REFERENCED_ROW') return res.status(400).json({ error: 'Uno de los datos relacionados no existe.' });
  if (error?.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || error?.errno === 4025) return res.status(400).json({ error: 'Los datos no cumplen las reglas de la base de datos.' });
  return res.status(500).json({ error: fallback });
}

module.exports = {
  ACTIVE_RESERVATION, ORDER_TRANSITIONS, RuleError, isAdmin, isOwnerRole, isStaff, positiveInteger,
  cleanText, integerInRange, money, validTime, validateReservationFields, restaurantFor, assertManagesRestaurant, sendRuleError
};
