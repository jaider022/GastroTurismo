'use strict';

function rows(key, entries) {
  return entries.map(([codigo, nombre], index) => ({ [key]: index + 1, codigo, nombre }));
}

const catalogos = {
  tipos_servicio: rows('id_tipo_servicio', [['comedor', 'Comedor'], ['delivery', 'Domicilio']]),
  estados_pedido: rows('id_estado_pedido', [['en preparacion', 'En preparación'], ['en camino', 'En camino'], ['entregado', 'Entregado'], ['cancelado', 'Cancelado']]),
  estados_reserva: rows('id_estado_reserva', [['pendiente', 'Pendiente'], ['confirmada', 'Confirmada'], ['cancelada', 'Cancelada'], ['finalizada', 'Finalizada']])
};

const keys = { tipos_servicio: 'id_tipo_servicio', estados_pedido: 'id_estado_pedido', estados_reserva: 'id_estado_reserva' };

async function catalogId(db, table, code) {
  const key = keys[table];
  if (!key) throw new Error('Catálogo desconocido.');
  const [[row]] = await db.query(`SELECT ${key} FROM ${table} WHERE codigo = ?`, [code]);
  return row?.[key];
}

function normalizeDataset(data) {
  const names = [...new Set(data.zonas.map(zone => zone.ciudad.trim()))].sort();
  data.municipios = names.map((nombre_municipio, index) => ({ id_municipio: index + 1, nombre_municipio }));
  for (const [table, entries] of Object.entries(catalogos)) data[table] = entries.map(entry => ({ ...entry }));
  data.zonas = data.zonas.map(({ ciudad, ...zone }) => ({ ...zone, id_municipio: names.indexOf(ciudad.trim()) + 1 }));
  data.reserva_mesas = data.reservas.map(({ id_reserva, id_mesa }) => ({ id_reserva, id_mesa }));
  data.reservas = data.reservas.map(({ id_mesa, estado_reserva, ...reservation }) => ({ ...reservation,
    id_estado_reserva: catalogos.estados_reserva.find(entry => entry.codigo === estado_reserva).id_estado_reserva }));
  data.pedidos = data.pedidos.map(({ tipo_servicio, estado_pedido, ...order }) => ({ ...order,
    id_tipo_servicio: catalogos.tipos_servicio.find(entry => entry.codigo === tipo_servicio).id_tipo_servicio,
    id_estado_pedido: catalogos.estados_pedido.find(entry => entry.codigo === estado_pedido).id_estado_pedido }));
  return data;
}

module.exports = { catalogos, catalogId, normalizeDataset };
