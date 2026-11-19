'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerReservations } = require('../lib/reservas');

async function withReservations(restaurantName, run, initial = null) {
  const calls = [];
  const states = ['pendiente', 'confirmada', 'cancelada', 'finalizada'];
  const table = { id_mesa: 1, id_restaurante: 3, capacidad: 4, estado: 'disponible',
    capacidad_total: 40, id_propietario: 9, nombre_restaurante: restaurantName };
  let saved = initial && { ...initial };
  let rolledBack = 0;
  const db = {
    async getConnection() { return db; },
    async beginTransaction() {}, async commit() {},
    async rollback() { rolledBack++; }, release() {},
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id_restaurante,nombre')) return [[{ id_restaurante: 3, nombre: restaurantName }]];
      if (sql.startsWith('SELECT m.* FROM mesas')) return [[table]];
      if (sql.startsWith('SELECT m.id_mesa,m.id_restaurante')) return [[table]];
      if (sql.startsWith('SELECT id_reserva FROM reservas')) return [saved ? [{ id_reserva: 20 }] : []];
      if (sql.startsWith('SELECT re.*')) return [saved ? [{ ...saved, id_reserva: 20, id_usuario: 1,
        id_restaurante: 3, id_propietario: 9, mesa_ids: '1' }] : []];
      if (sql.startsWith('SELECT rm.id_mesa') || sql.startsWith('SELECT DISTINCT re.id_reserva')) return [[]];
      if (sql.startsWith('SELECT id_estado_reserva FROM estados_reserva')) return [[{ id_estado_reserva: states.indexOf(params[0]) + 1 }]];
      if (sql.startsWith('INSERT INTO reservas') || sql.startsWith('UPDATE reservas SET')) {
        saved = { fecha_reserva: params[0], hora_reserva: params[1], cantidad_personas: params[2], estado_reserva: states[params[3] - 1] };
      }
      return [{ insertId: 20, affectedRows: 1 }];
    }
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id_usuario: 1, tipo_usuario: 'administrador' }; next(); });
  registerReservations(app, { getDb: () => db, requireSession: (req, res, next) => next(),
    checkDbConnection: (req, res, next) => next(), now: () => new Date('2030-01-01T12:00:00-05:00') });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (route, body, method = 'POST') => fetch(`http://127.0.0.1:${server.address().port}/api/reservas${route}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
  });
  try { await run({ request, calls, row: () => saved, rollbacks: () => rolledBack }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const payload = time => ({ id_mesas: [1], fecha_reserva: '2030-01-02', hora_reserva: time, cantidad_personas: 2 });
const availability = (request, time) => request(`/disponibilidad?id_restaurante=3&fecha=2030-01-02&hora=${encodeURIComponent(time)}`, null, 'GET');

test('la disponibilidad respeta apertura, cierre, turnos y cuartos de hora', async () => {
  for (const name of ['Café La Palma', 'Cocina del Mirador', 'Fogón del Guadual', 'Sabores del Camino']) {
    await withReservations(name, async ({ request }) => {
      for (const time of ['08:00', '10:45', '22:30', '23:00']) {
        const response = await availability(request, time);
        assert.equal(response.status, 400, `${name} ${time}`);
        assert.match((await response.json()).error, /cerrado/);
      }
      for (const time of ['11:00', '13:15', '20:30']) assert.equal((await availability(request, time)).status, 200);
      for (const time of ['11:07', '13:15:01', '20:45']) assert.equal((await availability(request, time)).status, 400);
    });
  }
  await withReservations('Café Sorrento', async ({ request }) => {
    assert.equal((await availability(request, '08:15')).status, 400);
    assert.equal((await availability(request, '08:30')).status, 200);
    assert.equal((await availability(request, '20:30')).status, 200);
    assert.equal((await availability(request, '20:45')).status, 400);
  });
});

test('crear y reprogramar valida horarios antes de escribir la reserva', () => withReservations('Café La Palma', async ({ request, calls, row, rollbacks }) => {
  for (const time of ['08:00:00', '10:45:00', '11:07:00', '20:45:00', '22:30:00']) {
    assert.equal((await request('', payload(time))).status, 400);
  }
  assert.equal(calls.some(call => call.sql.startsWith('INSERT INTO reservas')), false);
  assert.equal(rollbacks(), 5);
  assert.equal((await request('', payload('11:00:00'))).status, 201);
  assert.equal((await request('/20', { hora_reserva: '08:00:00' }, 'PUT')).status, 400);
  assert.equal(row().hora_reserva, '11:00:00');
  assert.equal((await request('/20', { hora_reserva: '13:15:00' }, 'PUT')).status, 200);
  assert.equal(row().hora_reserva, '13:15:00');
}));

test('el nuevo horario conserva la consulta y permite cancelar una reserva antigua fuera del rango', () => withReservations('Café La Palma', async ({ request, row }) => {
  assert.equal((await request('', null, 'GET')).status, 200);
  assert.equal((await request('/20', { estado_reserva: 'cancelada' }, 'PUT')).status, 200);
  assert.equal(row().estado_reserva, 'cancelada');
  assert.equal(row().hora_reserva, '08:00:00');
}, { fecha_reserva: '2030-01-02', hora_reserva: '08:00:00', cantidad_personas: 2, estado_reserva: 'pendiente' }));
