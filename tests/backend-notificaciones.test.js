'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { hashPassword } = require('../lib/passwords');

const secret = 'Notificacion2026!';
const storedPassword = hashPassword(secret);
const users = [
  { id_usuario: 1, nombre: 'Administradora', correo: 'admin@example.test', tipo_usuario: 'administrador', contrasena: storedPassword },
  { id_usuario: 2, nombre: 'Cliente', correo: 'cliente@example.test', tipo_usuario: 'cliente', contrasena: storedPassword }
];

function fakeDB() {
  return {
    calls: [], failNotifications: false,
    notifications: [
      { id_notificacion: 10, id_usuario: 1, mensaje: 'Aviso propio', fecha_envio: '2026-10-29 12:00:00', leido: false },
      { id_notificacion: 11, id_usuario: 2, mensaje: 'Reserva del cliente', fecha_envio: '2026-10-29 12:00:00', leido: false },
      { id_notificacion: 12, id_usuario: 1, mensaje: 'Segundo aviso', fecha_envio: '2026-10-29 12:00:00', leido: true }
    ],
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (sql.startsWith('SELECT id_usuario, nombre, correo, tipo_usuario, telefono, contrasena')) {
        return [users.filter(user => user.correo === params[0]).map(user => ({ ...user }))];
      }
      if (sql.startsWith('INSERT INTO accesos_sistema')) return [{ insertId: 100 }];
      if (sql.includes('notificaciones') && this.failNotifications) throw new Error('SQL privado y credenciales de prueba');
      if (sql.startsWith('SELECT * FROM notificaciones')) {
        return [this.notifications.filter(notification => notification.id_usuario === params[0])
          .sort((a, b) => b.fecha_envio.localeCompare(a.fecha_envio) || b.id_notificacion - a.id_notificacion)
          .map(notification => ({ ...notification }))];
      }
      if (sql.startsWith('UPDATE notificaciones')) {
        assert.match(sql, /WHERE id_notificacion = \? AND id_usuario = \?$/);
        const notification = this.notifications.find(item => item.id_notificacion === params[0] && item.id_usuario === params[1]);
        const changed = notification && !notification.leido;
        if (notification) notification.leido = true;
        // Simula también una configuración sin FOUND_ROWS: ya leída devuelve cero cambios.
        return [{ affectedRows: changed ? 1 : 0 }];
      }
      if (sql.startsWith('SELECT id_notificacion FROM notificaciones')) {
        return [this.notifications.filter(item => item.id_notificacion === params[0] && item.id_usuario === params[1])
          .map(item => ({ id_notificacion: item.id_notificacion }))];
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    }
  };
}

async function withServer(run) {
  const db = fakeDB();
  const server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) => fetch(base + route, options);
  const login = async (userId = 1) => {
    const response = await request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: users.find(user => user.id_usuario === userId).correo, contrasena: secret })
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  try { await run({ db, request, login }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('leer o marcar notificaciones sin sesión devuelve 401 sin consultar datos', () => withServer(async ({ db, request }) => {
  assert.equal((await request('/api/notificaciones/1')).status, 401);
  assert.equal((await request('/api/notificaciones/leer/10', { method: 'PUT' })).status, 401);
  assert.equal(db.calls.length, 0);
}));

for (const userId of [1, 2]) {
  test(`usuario ${userId}: solo consulta sus propias notificaciones en orden estable`, () => withServer(async ({ db, request, login }) => {
    const cookie = await login(userId);
    const own = await request(`/api/notificaciones/${userId}`, { headers: { cookie } });
    assert.equal(own.status, 200);
    const data = await own.json();
    assert.ok(data.every(notification => notification.id_usuario === userId));
    if (userId === 1) assert.deepEqual(data.map(notification => notification.id_notificacion), [12, 10]);
    const select = db.calls.find(call => call.sql.startsWith('SELECT * FROM notificaciones'));
    assert.match(select.sql, /ORDER BY fecha_envio DESC, id_notificacion DESC$/);
    assert.deepEqual(select.params, [userId]);
    const countBefore = db.calls.length;
    assert.equal((await request(`/api/notificaciones/${userId === 1 ? 2 : 1}`, { headers: { cookie } })).status, 403);
    assert.equal(db.calls.length, countBefore);
  }));
}

test('identificadores inválidos se rechazan antes de ejecutar SQL', () => withServer(async ({ db, request, login }) => {
  const cookie = await login();
  const countBefore = db.calls.length;
  for (const id of ['0', '-1', '1.2', '1e0', 'abc', '9007199254740993', '2147483648']) {
    assert.equal((await request(`/api/notificaciones/${id}`, { headers: { cookie } })).status, 400, id);
    assert.equal((await request(`/api/notificaciones/leer/${id}`, { method: 'PUT', headers: { cookie } })).status, 400, id);
  }
  assert.equal(db.calls.length, countBefore);
}));

test('marcar aplica el usuario de la sesión y es idempotente para notificaciones propias', () => withServer(async ({ db, request, login }) => {
  const cookie = await login();
  const options = { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id_usuario: 2 }) };
  assert.equal((await request('/api/notificaciones/leer/10', options)).status, 200);
  assert.equal((await request('/api/notificaciones/leer/10', options)).status, 200);
  assert.equal(db.notifications.find(notification => notification.id_notificacion === 10).leido, true);
  assert.ok(db.calls.filter(call => call.sql.startsWith('UPDATE notificaciones')).every(call => call.params[1] === 1));
}));

test('un administrador tampoco puede marcar notificaciones ajenas y no revela su existencia', () => withServer(async ({ db, request, login }) => {
  const cookie = await login();
  const before = structuredClone(db.notifications);
  const other = await request('/api/notificaciones/leer/11', { method: 'PUT', headers: { cookie } });
  const missing = await request('/api/notificaciones/leer/999', { method: 'PUT', headers: { cookie } });
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json());
  assert.deepEqual(db.notifications, before);
}));

test('el cliente puede marcar su propio aviso y no el de otro usuario', () => withServer(async ({ db, request, login }) => {
  const cookie = await login(2);
  assert.equal((await request('/api/notificaciones/leer/11', { method: 'PUT', headers: { cookie } })).status, 200);
  assert.equal((await request('/api/notificaciones/leer/10', { method: 'PUT', headers: { cookie } })).status, 404);
  assert.equal(db.notifications.find(notification => notification.id_notificacion === 10).leido, false);
  assert.equal(db.notifications.find(notification => notification.id_notificacion === 11).leido, true);
}));

test('errores al leer o marcar devuelven mensajes controlados sin detalles internos', () => withServer(async ({ db, request, login }) => {
  const cookie = await login();
  db.failNotifications = true;
  for (const [route, method] of [['/api/notificaciones/1', 'GET'], ['/api/notificaciones/leer/10', 'PUT']]) {
    const response = await request(route, { method, headers: { cookie } });
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /SQL privado|credenciales/);
  }
}));
