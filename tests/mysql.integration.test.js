'use strict';

// Explicit opt-in: these tests insert and remove only their own fixtures in the
// isolated academic database. They never create/drop tables or alter seeded rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const { createApp } = require('../server');
const { comparisonPeriods } = require('../lib/periods');
const { verifyPassword } = require('../lib/passwords');
const dataset = require('../public/demo-data.json');

test('integration with the isolated academic MySQL-compatible database', { skip: process.env.GASTRO_MYSQL_TEST !== '1' }, async t => {
  const database = process.env.DB_NAME || 'gastronomia_turistica_academica';
  const host = process.env.DB_HOST || '127.0.0.1';
  assert.equal(database, 'gastronomia_turistica_academica', 'Refusing to modify a database other than the isolated academic database');
  assert.ok(['localhost', '127.0.0.1'].includes(host), 'Integration testing is restricted to loopback');
  const db = mysql.createPool({ host, port: Number(process.env.DB_PORT) || 3307, user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database, connectionLimit: 1, timezone: '-05:00', dateStrings: true, connectTimeout: 3000 });
  let server;
  let userId;
  const visitIds = [];
  const orderIds = [];
  const cutoff = dataset.meta.fecha_corte;
  const fixedNow = new Date(`${cutoff}T18:00:00Z`);
  const at = `${cutoff} 12:00:00`;
  try {
    await db.query("SET time_zone = '-05:00'");
    const [fixture] = await db.query('INSERT INTO usuarios (nombre, correo, contrasena, telefono, tipo_usuario, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)',
      ['Prueba de integración', `integration-${Date.now()}@gastroturismo.example`, 'Prueba2026!', '3005550199', 'administrador', at]);
    userId = fixture.insertId;
    const [[account]] = await db.query('SELECT correo FROM usuarios WHERE id_usuario = ?', [userId]);
    const [[restaurant]] = await db.query('SELECT id_restaurante, capacidad_total FROM restaurantes ORDER BY id_restaurante LIMIT 1');
    server = createApp({ db, now: () => fixedNow }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie;
    const request = (route, options = {}) => fetch(base + route, { ...options, headers: { ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json', ...options.headers } });

    await t.test('legacy login becomes a hash, creates a real access and an HttpOnly session', async () => {
      const [[before]] = await db.query('SELECT COUNT(*) AS n FROM accesos_sistema WHERE fecha_ingreso >= ? AND fecha_ingreso < ?', [`${cutoff.slice(0, 7)}-01 00:00:00`, comparisonPeriods({ fecha_corte: cutoff }, fixedNow)[1].hasta_exclusivo + ' 00:00:00']);
      const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ correo: account.correo, contrasena: 'Prueba2026!' }) });
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(response.headers.get('set-cookie'), /HttpOnly/);
      cookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal((await response.json()).user.contrasena, undefined);
      const [[stored]] = await db.query('SELECT contrasena FROM usuarios WHERE id_usuario = ?', [userId]);
      assert.match(stored.contrasena, /^scrypt\$/);
      assert.ok(verifyPassword('Prueba2026!', stored.contrasena));
      const me = await request('/api/auth/me');
      assert.equal(me.status, 200);
      assert.equal((await me.json()).user.contrasena, undefined);
      const report = await request(`/api/reportes/12?fecha_corte=${cutoff}`);
      assert.equal(report.status, 200);
      assert.equal((await report.json())[1].ingresos, Number(before.n) + 1);
    });

    await t.test('all twelve reports execute successfully against real tables', async () => {
      for (let n = 1; n <= 12; n++) {
        const response = await request(`/api/reportes/${n}?fecha_corte=${cutoff}`);
        assert.equal(response.status, 200, `Report ${n}: ${await response.clone().text()}`);
        assert.ok(Array.isArray(await response.json()));
      }
    });

    await t.test('attendance totals match SQL for matching days, full month and restaurant filter', async () => {
      for (const comparacion of ['mismo_corte', 'mes_completo']) {
        for (const filter of ['', String(restaurant.id_restaurante)]) {
          const response = await request(`/api/reportes/11?fecha_corte=${cutoff}&comparacion=${comparacion}${filter ? `&id_restaurante=${filter}` : ''}`);
          assert.equal(response.status, 200);
          const actual = await response.json();
          const periods = comparisonPeriods({ fecha_corte: cutoff, comparacion }, fixedNow);
          for (let index = 0; index < periods.length; index++) {
            const period = periods[index];
            const params = [`${period.desde} 00:00:00`, `${period.hasta_exclusivo} 00:00:00`];
            if (filter) params.push(Number(filter));
            const [[expected]] = await db.query(`SELECT COALESCE(SUM(cantidad_personas),0) AS personas_atendidas, COUNT(*) AS visitas FROM visitas WHERE fecha_ingreso >= ? AND fecha_ingreso < ?${filter ? ' AND id_restaurante = ?' : ''}`, params);
            assert.equal(actual[index].personas_atendidas, Number(expected.personas_atendidas));
            assert.equal(actual[index].visitas, Number(expected.visitas));
          }
        }
      }
    });

    await t.test('real access report separates access count from distinct users', async () => {
      const actual = await (await request(`/api/reportes/12?fecha_corte=${cutoff}`)).json();
      const periods = comparisonPeriods({ fecha_corte: cutoff }, fixedNow);
      for (let i = 0; i < periods.length; i++) {
        const [[expected]] = await db.query('SELECT COUNT(*) AS ingresos, COUNT(DISTINCT id_usuario) AS usuarios_unicos FROM accesos_sistema WHERE fecha_ingreso >= ? AND fecha_ingreso < ?', [`${periods[i].desde} 00:00:00`, `${periods[i].hasta_exclusivo} 00:00:00`]);
        assert.equal(actual[i].ingresos, Number(expected.ingresos));
        assert.equal(actual[i].usuarios_unicos, Number(expected.usuarios_unicos));
      }
    });

    await t.test('invalid attendance is rejected and valid attendance persists accurately', async () => {
      const body = { id_restaurante: restaurant.id_restaurante, cantidad_personas: 2, fecha_ingreso: at };
      const bad = await request('/api/visitas', { method: 'POST', body: JSON.stringify({ ...body, cantidad_personas: Number(restaurant.capacidad_total) + 1 }) });
      assert.equal(bad.status, 400);
      const response = await request('/api/visitas', { method: 'POST', body: JSON.stringify(body) });
      assert.equal(response.status, 201, await response.clone().text());
      const inserted = await response.json();
      visitIds.push(inserted.id_visita);
      const [[row]] = await db.query('SELECT cantidad_personas, fecha_ingreso, id_reserva FROM visitas WHERE id_visita = ?', [inserted.id_visita]);
      assert.equal(Number(row.cantidad_personas), 2);
      assert.equal(row.fecha_ingreso, at);
      assert.equal(row.id_reserva, null);
    });

    await t.test('order ignores manipulated client prices and derives its total from the menu', async () => {
      const [[dish]] = await db.query('SELECT id_plato, precio FROM platos WHERE id_restaurante = ? AND disponibilidad = 1 LIMIT 1', [restaurant.id_restaurante]);
      const response = await request('/api/pedidos', { method: 'POST', body: JSON.stringify({ tipo_servicio: 'comedor', id_usuario: userId, id_restaurante: restaurant.id_restaurante, total_pago: 1, platos: [{ id_plato: dish.id_plato, cantidad: 2, precio_unitario: 0.01 }] }) });
      assert.equal(response.status, 201, await response.clone().text());
      const order = await response.json();
      orderIds.push(order.id_pedido);
      assert.equal(order.total_pago, Number(dish.precio) * 2);
      const [[saved]] = await db.query('SELECT p.total_pago, d.precio_unitario, d.cantidad FROM pedidos p JOIN detalle_pedidos d ON d.id_pedido = p.id_pedido WHERE p.id_pedido = ?', [order.id_pedido]);
      assert.equal(Number(saved.total_pago), Number(dish.precio) * 2);
      assert.equal(Number(saved.precio_unitario), Number(dish.precio));
      assert.equal(Number(saved.cantidad), 2);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const id of visitIds) await db.query('DELETE FROM visitas WHERE id_visita = ?', [id]);
    for (const id of orderIds) {
      await db.query('DELETE FROM detalle_pedidos WHERE id_pedido = ?', [id]);
      await db.query('DELETE FROM pedidos WHERE id_pedido = ?', [id]);
    }
    if (userId) {
      await db.query('DELETE FROM accesos_sistema WHERE id_usuario = ?', [userId]);
      await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId]);
    }
    await db.end();
  }
});
