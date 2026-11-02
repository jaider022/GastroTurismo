'use strict';
// Prueba real de los módulos v3 contra la base académica (MySQL/MariaDB).
// Se activa con GASTRO_MYSQL_TEST=1. Crea registros de prueba: después ejecutar `npm run db:recrear`.
const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const { createApp } = require('../server');
const { bogotaDate } = require('../lib/periods');

const addDays = (date, n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('módulos v3 contra la base académica real', { skip: process.env.GASTRO_MYSQL_TEST !== '1' }, async t => {
  const database = process.env.DB_NAME || 'gastronomia_turistica_academica';
  assert.equal(database, 'gastronomia_turistica_academica');
  const db = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database, connectionLimit: 4, timezone: '-05:00', dateStrings: true });
  db.pool.on('connection', c => c.query("SET time_zone = '-05:00'"));
  const server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async correo => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena: 'Gastro2026!' }) });
    assert.equal(r.status, 200, `login ${correo}`);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    return (route, method = 'GET', body) => fetch(base + route, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  };
  const today = bogotaDate(new Date());
  try {
    const client = await login('cliente@gastroturismo.example');
    const owner = await login('restaurante@gastroturismo.example');

    await t.test('el esquema tiene las 20 tablas', async () => {
      const [rows] = await db.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [database]);
      assert.equal(Number(rows[0].n), 20);
    });

    await t.test('reserva: disponibilidad, creación con recordatorio y mesa ocupada', async () => {
      const fecha = addDays(today, 5);
      const mesas = await (await client(`/api/mesas/disponibilidad?id_restaurante=1&fecha=${fecha}`)).json();
      const libre = mesas.find(m => !m.ocupada && m.capacidad >= 2);
      assert.ok(libre, 'hay una mesa libre');
      const body = { fecha_reserva: fecha, hora_reserva: '19:00', cantidad_personas: 2, id_mesa: libre.id_mesa, recordatorio_horas: 3 };
      const created = await client('/api/reservas', 'POST', body);
      assert.equal(created.status, 201, await created.clone().text());
      const { id_reserva } = await created.json();
      assert.equal((await client('/api/reservas', 'POST', body)).status, 409);
      const [rec] = await db.query('SELECT fecha_programada FROM recordatorios WHERE id_reserva = ?', [id_reserva]);
      assert.equal(String(rec[0].fecha_programada).slice(0, 16), `${fecha} 16:00`);
      const mine = await (await client('/api/reservas')).json();
      assert.ok(mine.every(r => r.correo_usuario === 'cliente@gastroturismo.example'));
      assert.equal((await owner(`/api/reservas/${id_reserva}`, 'PUT', { estado_reserva: 'confirmada' })).status, 200);
    });

    await t.test('inscripción a experiencia con pago en línea', async () => {
      const exps = await (await client('/api/experiencias')).json();
      const exp = exps.find(e => e.estado_experiencia === 'programada' && e.fecha_experiencia > today && e.cupos_disponibles > 0);
      if (!exp) return t.skip('no hay experiencias futuras; regenera datos con --fecha de hoy');
      const res = await client('/api/inscripciones', 'POST', { id_experiencia: exp.id_experiencia, cantidad_personas: 1, id_metodo: 1 });
      if (res.status === 409) return; // el cliente ya estaba inscrito en esa experiencia
      assert.equal(res.status, 201, await res.clone().text());
      const { id_inscripcion } = await res.json();
      const [pago] = await db.query('SELECT monto FROM pagos WHERE id_inscripcion = ?', [id_inscripcion]);
      assert.equal(Number(pago[0].monto), Number(exp.precio_persona));
    });

    await t.test('suscripción de plan con vigencia y plan vigente del restaurante', async () => {
      const res = await owner('/api/suscripciones', 'POST', { id_restaurante: 1, id_plan: 3, id_metodo: 2 });
      assert.equal(res.status, 201, await res.clone().text());
      const [[r]] = await db.query('SELECT id_plan FROM restaurantes WHERE id_restaurante = 1');
      assert.equal(Number(r.id_plan), 3);
      const subs = await (await owner('/api/suscripciones')).json();
      assert.equal(subs.filter(s => s.id_restaurante === 1 && s.estado_suscripcion === 'activa').length, 1);
    });

    await t.test('recordatorios personales y procesamiento sin errores SQL', async () => {
      const r = await client('/api/recordatorios', 'POST', { titulo: 'Prueba', mensaje: 'Recordatorio de integración', fecha_programada: `${addDays(today, 1)}T08:00` });
      assert.equal(r.status, 201);
      assert.equal((await client('/api/recordatorios')).status, 200);
    });

    await t.test('permisos: el cliente no administra mesas', async () => {
      assert.equal((await client('/api/mesas', 'POST', { id_restaurante: 1, numero_mesa: 'X', capacidad: 2, ubicacion: 'Terraza' })).status, 403);
    });

    await t.test('reporte 10 coincide con el cálculo independiente en MySQL/MariaDB', async () => {
      const [sold] = await db.query('SELECT p.nombre, p.id_categoria, SUM(d.cantidad) AS vendidos FROM platos p JOIN detalle_pedidos d ON d.id_plato = p.id_plato GROUP BY p.id_plato, p.nombre, p.id_categoria');
      const byCat = {};
      sold.forEach(r => (byCat[r.id_categoria] ||= []).push(r));
      const expected = Object.values(byCat).flatMap(list => {
        const avg = list.reduce((s, r) => s + Number(r.vendidos), 0) / list.length;
        return list.filter(r => Number(r.vendidos) >= avg).map(r => r.nombre);
      }).sort();
      const actual = (await (await owner('/api/reportes/10')).json()).map(r => r.Plato).sort();
      assert.deepEqual(actual, expected);
    });

    await t.test('los doce reportes responden', async () => {
      for (let n = 1; n <= 12; n++) assert.equal((await owner(`/api/reportes/${n}`)).status, 200, `reporte ${n}`);
    });
  } finally {
    await new Promise(r => server.close(r));
    await db.end();
  }
});
