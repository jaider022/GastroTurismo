'use strict';
// Reglas de negocio y permisos del servidor con una base simulada (no requiere MySQL).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { hashPassword } = require('../lib/passwords');
const { processReminders, addMonths } = require('../lib/modulos-extra');

const fixedNow = new Date('2026-11-02T15:00:00Z'); // 10:00 en Bogotá
const secret = 'Reglas2026!';
const hash = hashPassword(secret);

function fakeDB() {
  const db = {
    calls: [],
    users: [
      { id_usuario: 1, nombre: 'Admin', correo: 'admin@example.test', tipo_usuario: 'administrador', contrasena: hash },
      { id_usuario: 2, nombre: 'Dueña', correo: 'duena@example.test', tipo_usuario: 'restaurante', contrasena: hash },
      { id_usuario: 3, nombre: 'Otro dueño', correo: 'otro@example.test', tipo_usuario: 'restaurante', contrasena: hash },
      { id_usuario: 6, nombre: 'Turista', correo: 'turista@example.test', tipo_usuario: 'cliente', contrasena: hash }
    ],
    restaurants: [{ id_restaurante: 10, id_propietario: 2, capacidad_total: 30, nombre: 'Fogón' }],
    mesas: [{ id_mesa: 5, capacidad: 4, estado: 'disponible', numero_mesa: 'Mesa 1', id_restaurante: 10, id_propietario: 2, nombre_restaurante: 'Fogón' }],
    busy: false,
    experience: { id_experiencia: 7, nombre: 'Cata', fecha_experiencia: '2026-11-10', hora_inicio: '15:00:00', cupo_maximo: 6, precio_persona: '45000.00', estado_experiencia: 'programada', nombre_restaurante: 'Fogón', id_propietario: 2 },
    occupied: 4,
    order: { id_pedido: 9, estado_pedido: 'en preparacion', tipo_servicio: 'comedor', id_usuario: 6, id_propietario: 2, nombre_restaurante: 'Fogón' },
    activeSub: null,
    reminders: [],
    async query(sql, params = []) {
      this.calls.push({ sql, params });
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('SELECT id_usuario, nombre, correo, tipo_usuario, telefono, contrasena')) return [this.users.filter(u => u.correo === params[0]).map(u => ({ ...u }))];
      if (s.startsWith('SELECT id_restaurante, id_propietario, capacidad_total, nombre FROM restaurantes')) return [this.restaurants.filter(r => r.id_restaurante === params[0])];
      if (s.startsWith('SELECT m.id_mesa, m.capacidad, m.estado')) return [this.mesas.filter(m => m.id_mesa === params[0])];
      if (s.startsWith('SELECT id_reserva FROM reservas WHERE id_mesa')) return [this.busy ? [{ id_reserva: 99 }] : []];
      if (s.startsWith('SELECT e.*, r.nombre AS nombre_restaurante, r.id_propietario FROM experiencias')) return [params[0] === 7 ? [{ ...this.experience }] : []];
      if (s.startsWith('SELECT COALESCE(SUM(cantidad_personas), 0) AS ocupados')) return [[{ ocupados: this.occupied }]];
      if (s.startsWith('SELECT id_metodo, tipo_pago FROM metodos_pago')) return [params[0] === 1 ? [{ id_metodo: 1, tipo_pago: 'online' }] : params[0] === 5 ? [{ id_metodo: 5, tipo_pago: 'presencial' }] : []];
      if (s.startsWith('SELECT id_inscripcion, estado_inscripcion FROM inscripciones_experiencia')) return [[]];
      if (s.startsWith('SELECT p.id_pedido, p.estado_pedido')) return [[{ ...this.order }]];
      if (s.startsWith('SELECT * FROM planes_suscripcion')) return [[{ id_plan: params[0], nombre_plan: 'Premium', costo: '120000.00', duracion_meses: 1 }]];
      if (s.startsWith('SELECT * FROM suscripciones')) return [this.activeSub ? [{ ...this.activeSub }] : []];
      if (s.startsWith('SELECT id_recordatorio, id_usuario, titulo, mensaje FROM recordatorios')) return [this.reminders.filter(r => !r.enviado && r.fecha_programada <= params[0])];
      if (s.startsWith('UPDATE recordatorios SET enviado = TRUE')) {
        const r = this.reminders.find(x => x.id_recordatorio === params[1] && !x.enviado);
        if (r) r.enviado = true;
        return [{ affectedRows: r ? 1 : 0 }];
      }
      if (s.startsWith('SELECT res.*, u.nombre')) return [[]];
      return [{ insertId: 500 + this.calls.length, affectedRows: 1 }];
    },
    async getConnection() {
      const self = this;
      return { query: (...a) => self.query(...a), beginTransaction: async () => self.calls.push({ sql: 'BEGIN' }), commit: async () => self.calls.push({ sql: 'COMMIT' }), rollback: async () => self.calls.push({ sql: 'ROLLBACK' }), release() {} };
    }
  };
  return db;
}

async function withServer(run) {
  const db = fakeDB();
  const server = createApp({ db, now: () => fixedNow }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sessions = {};
  const as = async correo => {
    if (!sessions[correo]) {
      const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena: secret }) });
      assert.equal(r.status, 200);
      sessions[correo] = r.headers.get('set-cookie').split(';')[0];
    }
    return (route, method = 'GET', body) => fetch(base + route, { method, headers: { cookie: sessions[correo], 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  };
  try { await run({ db, as }); } finally { await new Promise(resolve => server.close(resolve)); }
}

const reservation = { fecha_reserva: '2026-11-05', hora_reserva: '13:00', cantidad_personas: 2, id_mesa: 5 };

test('clientes no administran mesas ni restaurantes; propietarios solo los suyos', () => withServer(async ({ as }) => {
  const client = await as('turista@example.test');
  assert.equal((await client('/api/mesas', 'POST', { id_restaurante: 10, numero_mesa: 'M9', capacidad: 2, ubicacion: 'Terraza' })).status, 403);
  assert.equal((await client('/api/restaurantes/10', 'DELETE')).status, 403);
  const other = await as('otro@example.test');
  const response = await other('/api/platos', 'POST', { id_restaurante: 10, nombre: 'Arepa', precio: 5000, id_categoria: 1 });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /de tu propiedad/);
}));

test('reservas: rechaza fechas pasadas, horario cerrado, sobrecupo de mesa y mesa ocupada', () => withServer(async ({ db, as }) => {
  const client = await as('turista@example.test');
  assert.equal((await client('/api/reservas', 'POST', { ...reservation, fecha_reserva: '2026-11-01' })).status, 400);
  assert.equal((await client('/api/reservas', 'POST', { ...reservation, fecha_reserva: '2026-11-02', hora_reserva: '09:30' })).status, 400);
  assert.equal((await client('/api/reservas', 'POST', { ...reservation, hora_reserva: '23:30' })).status, 400);
  assert.equal((await client('/api/reservas', 'POST', { ...reservation, cantidad_personas: 6 })).status, 400);
  db.busy = true;
  assert.equal((await client('/api/reservas', 'POST', reservation)).status, 409);
  assert.ok(db.calls.filter(c => c.sql === 'ROLLBACK').length >= 2);
}));

test('reserva válida queda a nombre del cliente, avisa al restaurante y programa recordatorio', () => withServer(async ({ db, as }) => {
  const client = await as('turista@example.test');
  const response = await client('/api/reservas', 'POST', { ...reservation, id_usuario: 1, recordatorio_horas: 3 });
  assert.equal(response.status, 201);
  const insert = db.calls.find(c => c.sql.startsWith('INSERT INTO reservas'));
  assert.deepEqual(insert.params, ['2026-11-05', '13:00:00', 2, 6, 5]);
  assert.equal(db.calls.filter(c => c.sql.startsWith('INSERT INTO notificaciones')).length, 2);
  const reminder = db.calls.find(c => c.sql.includes('INSERT INTO recordatorios'));
  assert.equal(reminder.params[4], '2026-11-05 10:00:00');
  assert.ok(db.calls.some(c => c.sql === 'COMMIT'));
}));

test('el listado de reservas se filtra por rol', () => withServer(async ({ db, as }) => {
  await (await as('turista@example.test'))('/api/reservas');
  assert.match(db.calls.at(-1).sql, /WHERE res\.id_usuario = \?/);
  await (await as('duena@example.test'))('/api/reservas');
  assert.match(db.calls.at(-1).sql, /WHERE r\.id_propietario = \?/);
  await (await as('admin@example.test'))('/api/reservas');
  assert.doesNotMatch(db.calls.at(-1).sql, /WHERE/);
}));

test('pedidos: el cliente solo cancela en preparación y un pedido en comedor no va en camino', () => withServer(async ({ db, as }) => {
  const client = await as('turista@example.test');
  assert.equal((await client('/api/pedidos/9', 'PUT', { estado_pedido: 'entregado' })).status, 403);
  const owner = await as('duena@example.test');
  assert.equal((await owner('/api/pedidos/9', 'PUT', { estado_pedido: 'en camino' })).status, 400);
  assert.equal((await client('/api/pedidos/9', 'PUT', { estado_pedido: 'cancelado' })).status, 200);
  db.order.estado_pedido = 'entregado';
  assert.equal((await owner('/api/pedidos/9', 'PUT', { estado_pedido: 'cancelado' })).status, 400);
}));

test('inscripción a experiencia: respeta cupo, exige pago en línea y registra pago, avisos y recordatorio', () => withServer(async ({ db, as }) => {
  const owner = await as('duena@example.test');
  assert.equal((await owner('/api/inscripciones', 'POST', { id_experiencia: 7, cantidad_personas: 1, id_metodo: 1 })).status, 403);
  const client = await as('turista@example.test');
  const full = await client('/api/inscripciones', 'POST', { id_experiencia: 7, cantidad_personas: 3, id_metodo: 1 });
  assert.equal(full.status, 409);
  assert.match((await full.json()).error, /Solo quedan 2 cupos/);
  assert.equal((await client('/api/inscripciones', 'POST', { id_experiencia: 7, cantidad_personas: 2, id_metodo: 5 })).status, 400);
  const ok = await client('/api/inscripciones', 'POST', { id_experiencia: 7, cantidad_personas: 2, id_metodo: 1 });
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).total, 90000);
  const pago = db.calls.find(c => c.sql.startsWith("INSERT INTO pagos (monto, estado_pago, id_usuario, id_metodo, id_inscripcion)"));
  assert.deepEqual(pago.params.slice(0, 3), [90000, 6, 1]);
  assert.equal(db.calls.find(c => c.sql.includes('INSERT INTO recordatorios')).params[4], '2026-11-09 09:00:00');
}));

test('suscripción: renovar el mismo plan suma el periodo desde el vencimiento y cambiar de plan cancela el anterior', () => withServer(async ({ db, as }) => {
  const owner = await as('duena@example.test');
  db.activeSub = { id_suscripcion: 3, id_plan: 2, fecha_fin: '2026-11-20' };
  const renewed = await owner('/api/suscripciones', 'POST', { id_restaurante: 10, id_plan: 2, id_metodo: 1 });
  assert.equal(renewed.status, 201);
  const body = await renewed.json();
  assert.equal(body.fecha_inicio, '2026-11-20');
  assert.equal(body.fecha_fin, '2026-12-20');
  assert.ok(!db.calls.some(c => c.sql.includes("SET estado_suscripcion = 'cancelada'")));

  db.activeSub = { id_suscripcion: 4, id_plan: 3, fecha_fin: '2027-01-01' };
  const changed = await owner('/api/suscripciones', 'POST', { id_restaurante: 10, id_plan: 2, id_metodo: 1 });
  assert.equal((await changed.json()).fecha_inicio, '2026-11-02');
  assert.ok(db.calls.some(c => c.sql.includes("SET estado_suscripcion = 'cancelada'") && c.params[0] === 4));
  assert.equal((await owner('/api/suscripciones', 'POST', { id_restaurante: 10, id_plan: 2, id_metodo: 5 })).status, 400);

  db.activeSub = { id_suscripcion: 5, id_plan: 2, fecha_fin: '2027-03-01' };
  assert.equal((await owner('/api/suscripciones', 'POST', { id_restaurante: 10, id_plan: 2, id_metodo: 1 })).status, 400);
}));

test('procesar recordatorios genera una notificación por recordatorio vencido una sola vez', async () => {
  const db = fakeDB();
  db.reminders = [
    { id_recordatorio: 1, id_usuario: 6, titulo: 'Reserva', mensaje: 'Mañana a la 1', fecha_programada: '2026-11-02 09:00:00', enviado: false },
    { id_recordatorio: 2, id_usuario: 6, titulo: 'Futuro', mensaje: 'Luego', fecha_programada: '2026-11-03 09:00:00', enviado: false }
  ];
  assert.equal(await processReminders(db, () => fixedNow), 1);
  assert.equal(await processReminders(db, () => fixedNow), 0);
  const notes = db.calls.filter(c => c.sql.startsWith('INSERT INTO notificaciones'));
  assert.equal(notes.length, 1);
  assert.match(notes[0].params[0], /^Recordatorio: Reserva\./);
  assert.ok(db.calls.some(c => c.sql.includes("SET estado_suscripcion = 'vencida'")));
});

test('recordatorios personales deben programarse en el futuro', () => withServer(async ({ as }) => {
  const client = await as('turista@example.test');
  assert.equal((await client('/api/recordatorios', 'POST', { titulo: 'Bus', mensaje: 'Salida', fecha_programada: '2026-11-02T09:00' })).status, 400);
  assert.equal((await client('/api/recordatorios', 'POST', { titulo: 'Bus', mensaje: 'Salida', fecha_programada: '2026-11-02T18:00' })).status, 201);
}));

test('sumar meses conserva el día del calendario', () => {
  assert.equal(addMonths('2026-10-01', 1), '2026-11-01');
  assert.equal(addMonths('2026-08-01', 3), '2026-11-01');
  assert.equal(addMonths('2026-12-15', 12), '2027-12-15');
});
