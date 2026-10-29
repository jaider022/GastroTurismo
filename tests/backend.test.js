'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { comparisonPeriods, bogotaDate } = require('../lib/periods');
const { hashPassword, verifyPassword } = require('../lib/passwords');

const fixedNow = new Date('2026-10-27T18:00:00Z');
const admin = { id_usuario: 1, nombre: 'Laura Méndez', correo: 'laura@example.test', telefono: '3105550101', tipo_usuario: 'administrador', contrasena: 'Gastro2026!' };

function fakeDB() {
  const calls = [];
  const db = {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id_usuario, nombre, correo, tipo_usuario, telefono, contrasena')) return [[{ ...admin }]];
      if (sql.startsWith('SELECT COALESCE(SUM(cantidad_personas)')) return [[{ personas_atendidas: '23', visitas: '8' }]];
      if (sql.startsWith('SELECT COUNT(*) AS ingresos')) return [[{ ingresos: '11', usuarios_unicos: '4' }]];
      if (sql.startsWith('SELECT id_restaurante, capacidad_total')) return [[{ id_restaurante: 2, capacidad_total: 40, id_propietario: 1 }]];
      if (sql.startsWith('SELECT r.id_reserva')) return [[{ id_reserva: 4, id_usuario: 6, fecha_reserva: '2026-10-27', estado_reserva: 'confirmada', id_restaurante: 2, capacidad: 4 }]];
      return [{ insertId: 7, affectedRows: 1 }];
    }
  };
  return db;
}

async function withServer(run) {
  const db = fakeDB();
  const server = createApp({ db, now: () => fixedNow }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) => fetch(base + route, options);
  try { await run({ db, request }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function login(request) {
  const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: admin.correo, contrasena: admin.contrasena }) });
  assert.equal(response.status, 200);
  return { response, cookie: response.headers.get('set-cookie').split(';')[0] };
}

test('comparison clamps day 31 to February and handles January rollover', () => {
  assert.deepEqual(comparisonPeriods({ fecha_corte: '2024-03-31' }, fixedNow).map(p => [p.desde, p.hasta, p.hasta_exclusivo]), [
    ['2024-02-01', '2024-02-29', '2024-03-01'], ['2024-03-01', '2024-03-31', '2024-04-01']
  ]);
  assert.equal(comparisonPeriods({ fecha_corte: '2026-01-03' }, fixedNow)[0].desde, '2025-12-01');
});

test('full previous month differs from matching cutoff, rejects future or invalid dates', () => {
  assert.equal(comparisonPeriods({ fecha_corte: '2026-10-03' }, fixedNow)[0].hasta, '2026-09-03');
  assert.equal(comparisonPeriods({ fecha_corte: '2026-10-03', comparacion: 'mes_completo' }, fixedNow)[0].hasta, '2026-09-30');
  for (const fecha_corte of ['2026-02-30', '2026-13-01', '2026-10-28', 'today']) assert.throws(() => comparisonPeriods({ fecha_corte }, fixedNow));
  assert.throws(() => comparisonPeriods({ comparacion: 'anything' }, fixedNow));
  assert.equal(bogotaDate(new Date('2026-11-01T02:00:00Z')), '2026-10-31');
});

test('password hash has salt, verifies secret and rejects incorrect values', () => {
  const a = hashPassword('Gastro2026!');
  const b = hashPassword('Gastro2026!');
  assert.notEqual(a, b);
  assert.ok(verifyPassword('Gastro2026!', a));
  assert.equal(verifyPassword('wrong', a), false);
  assert.equal(verifyPassword('secret', 'scrypt$broken'), false);
});

test('reports and writes require a server session', () => withServer(async ({ request }) => {
  assert.equal((await request('/api/reportes/11')).status, 401);
  assert.equal((await request('/api/pagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
}));

test('successful login migrates password, records access and returns no password', () => withServer(async ({ db, request }) => {
  const { response, cookie } = await login(request);
  const body = await response.json();
  assert.equal(body.user.contrasena, undefined);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
  const migration = db.calls.find(c => c.sql.startsWith('UPDATE usuarios SET contrasena'));
  assert.match(migration.params[0], /^scrypt\$/);
  const access = db.calls.find(c => c.sql.startsWith('INSERT INTO accesos_sistema'));
  assert.deepEqual(access.params, [1, '2026-10-27 13:00:00']);
  assert.equal((await request('/api/auth/me', { headers: { cookie } })).status, 200);
  await request('/api/auth/logout', { method: 'POST', headers: { cookie } });
  assert.equal((await request('/api/auth/me', { headers: { cookie } })).status, 401);
}));

test('failed login never records an access', () => withServer(async ({ db, request }) => {
  const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: admin.correo, contrasena: 'bad' }) });
  assert.equal(response.status, 401);
  assert.equal(db.calls.some(c => c.sql.startsWith('INSERT INTO accesos_sistema')), false);
}));

test('attendance report uses actual visits and exclusive next-day limits, not reservations', () => withServer(async ({ db, request }) => {
  const { cookie } = await login(request);
  const response = await request('/api/reportes/11?fecha_corte=2026-10-27&id_restaurante=2', { headers: { cookie } });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].personas_atendidas, 23);
  const queries = db.calls.filter(c => c.sql.startsWith('SELECT COALESCE(SUM(cantidad_personas)'));
  assert.deepEqual(queries.map(q => q.params), [['2026-09-01 00:00:00', '2026-09-28 00:00:00', 2], ['2026-10-01 00:00:00', '2026-10-28 00:00:00', 2]]);
  assert.ok(queries.every(q => q.sql.includes('FROM visitas') && !q.sql.includes('reservas')));
  assert.equal((await request('/api/reportes/11?id_restaurante=2%20OR%201=1', { headers: { cookie } })).status, 400);
}));

test('access report separates login count from unique users', () => withServer(async ({ request }) => {
  const { cookie } = await login(request);
  const response = await request('/api/reportes/12?fecha_corte=2026-10-27', { headers: { cookie } });
  assert.deepEqual((await response.json())[1], { periodo: 'Mes actual', desde: '2026-10-01', hasta: '2026-10-27', ingresos: 11, usuarios_unicos: 4 });
}));

test('visits validate restaurant, reservation date and capacity', () => withServer(async ({ db, request }) => {
  const { cookie } = await login(request);
  const send = body => request('/api/visitas', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const base = { id_restaurante: 2, id_reserva: 4, cantidad_personas: 3, fecha_ingreso: '2026-10-27 12:00:00' };
  assert.equal((await send({ ...base, cantidad_personas: 5 })).status, 400);
  assert.equal((await send({ ...base, fecha_ingreso: '2026-10-26 12:00:00' })).status, 400);
  assert.equal((await send({ ...base, id_usuario: 7 })).status, 400);
  assert.equal((await send({ ...base, cantidad_personas: -2 })).status, 400);
  const result = await send(base);
  assert.equal(result.status, 201);
  assert.equal((await result.json()).id_usuario, 6);
  assert.equal(db.calls.filter(c => c.sql.startsWith('INSERT INTO visitas')).length, 1);
}));

test('payment must target exactly one concept', () => withServer(async ({ request }) => {
  const { cookie } = await login(request);
  for (const concepts of [{}, { id_plan: 1, id_pedido: 1 }]) {
    const response = await request('/api/pagos', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ monto: 10000, id_usuario: 1, id_metodo: 1, ...concepts }) });
    assert.equal(response.status, 400);
  }
}));
