'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { createApp } = require('../server');
const { hashPassword } = require('../lib/passwords');
const { generateDataset, TABLES } = require('../scripts/generar-datos');

const data = generateDataset('2026-10-27');
// Los DECIMAL de mysql2 pueden llegar como texto; la demo debe sumar números.
data.pedidos.forEach(row => { row.total_pago = String(row.total_pago); });
data.platos.forEach(row => { row.precio = String(row.precio); row.disponibilidad = String(Number(row.disponibilidad)); });
data.resenas.forEach(row => { row.calificacion = String(row.calificacion); });
data.detalle_pedidos.forEach(row => { row.cantidad = String(row.cantidad); });
data.zonas.push({ id_zona: 900, nombre_zona: 'Zona sin reservas', ciudad: 'Armenia', descripcion_turistica: 'Prueba' });
data.restaurantes.push({ ...data.restaurantes[0], id_restaurante: 900, id_zona: 900, nombre: 'Sin mesas ni opiniones' });
const adminId = data.usuarios.find(user => user.tipo_usuario === 'administrador').id_usuario;
for (let index = 0; index < 30; index += 1) data.reservas.push({ ...data.reservas[0], id_reserva: 900 + index, id_usuario: adminId });

const storage = new Map();
const context = vm.createContext({
  console: { log() {}, error() {}, warn() {} }, Date, Intl, URLSearchParams, window: {},
  document: { addEventListener() {} },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') +
  '\nglobalThis.reports = {calculateMockReport, SQL_QUERIES, setLS, getLS};', context);
const frontend = context.reports;
const keys = { zonas: 'gt_zonas', usuarios: 'gt_usuarios', restaurantes: 'gt_restaurantes', mesas: 'gt_mesas', platos: 'gt_platos', reservas: 'gt_reservas', pedidos: 'gt_pedidos', detalle_pedidos: 'gt_detalle_pedidos', resenas: 'gt_resenas', categorias: 'gt_categorias' };
for (const [table, key] of Object.entries(keys)) frontend.setLS(key, data[table]);
const plain = value => JSON.parse(JSON.stringify(value));
const canonical = rows => plain(rows).map(row => JSON.stringify(row)).sort();
const normalizeSQL = sql => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().replace(/;$/, '');
const sqlRows = new Map(), sqlQueries = new Map();
let database, server;

before(async () => {
  // Motor SQL independiente en memoria para comprobar la lógica de las consultas.
  // No verifica reglas/configuración específicas de MySQL ni abre la base del usuario.
  database = new DatabaseSync(':memory:');
  database.function('IF', (condition, yes, no) => condition ? yes : no);
  database.function('DATE_FORMAT', (value, format) => {
    assert.equal(format, '%Y-%m-%d');
    return value === null ? null : String(value).slice(0, 10);
  });
  for (const table of TABLES) {
    const columns = Object.keys(data[table][0]).filter(key => !Array.isArray(data[table][0][key]));
    const type = key => /^(id_|cantidad|capacidad|calificacion|precio|total_pago|disponibilidad)/.test(key) ? 'NUMERIC' : 'TEXT';
    database.exec(`CREATE TABLE "${table}" (${columns.map(key => `"${key}" ${type(key)}`).join(',')})`);
    const insert = database.prepare(`INSERT INTO "${table}" (${columns.map(key => `"${key}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
    for (const row of data[table]) insert.run(...columns.map(key => typeof row[key] === 'boolean' ? Number(row[key]) : row[key] ?? null));
  }
  const password = hashPassword('ReportePrueba2026!');
  let lastQuery;
  const db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT id_usuario, nombre, correo, tipo_usuario, telefono, contrasena')) return [[{ id_usuario: 999, nombre: 'Prueba', correo: 'reportes@example.test', tipo_usuario: 'administrador', contrasena: password }]];
    if (sql.startsWith('INSERT INTO accesos_sistema')) return [{ insertId: 1 }];
    lastQuery = sql;
    return [database.prepare(sql).all(...(params || []))];
  } };
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'reportes@example.test', contrasena: 'ReportePrueba2026!' }) });
  assert.equal(auth.status, 200);
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  for (let id = 1; id <= 10; id += 1) {
    const response = await fetch(`${base}/api/reportes/${id}`, { headers: { cookie } });
    const rows = await response.json();
    assert.equal(response.status, 200, `Reporte ${id}: ${JSON.stringify(rows)}`);
    sqlRows.set(id, rows);
    sqlQueries.set(id, lastQuery);
  }
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  database?.close();
});

for (let id = 1; id <= 10; id += 1) {
  test(`reporte ${id}: la demo coincide con el resultado independiente de la consulta SQL`, () => {
    assert.deepEqual(canonical(frontend.calculateMockReport(id)), canonical(sqlRows.get(id)));
  });
}

test('las consultas mostradas coinciden con las diez consultas que ejecuta el servidor', () => {
  for (let id = 1; id <= 10; id += 1) assert.equal(normalizeSQL(frontend.SQL_QUERIES[id]), normalizeSQL(sqlQueries.get(id)), `Reporte ${id}`);
});

test('se cubren tres consultas simples, cuatro con varias tablas y tres con subconsultas', () => {
  const groups = { simple: [], intermedio: [], avanzado: [] };
  for (const [id, sql] of sqlQueries) {
    const selects = (sql.match(/\bSELECT\b/gi) || []).length;
    if (selects > 1) groups.avanzado.push(id);
    else if (/\bJOIN\b/i.test(sql)) {
      assert.match(sql, /\b(?:COUNT|SUM|AVG)\s*\(/i);
      assert.match(sql, /\bGROUP BY\b/i);
      groups.intermedio.push(id);
    } else groups.simple.push(id);
  }
  assert.deepEqual(groups, { simple: [1, 2, 3], intermedio: [4, 5, 6, 7], avanzado: [8, 9, 10] });
});

test('platos disponibles conservan precios numéricos exportables y excluyen disponibilidad texto cero', () => {
  frontend.setLS('gt_platos', [{ id_plato: 1, nombre: 'Agotado', precio: '1.00', disponibilidad: '0' }, { id_plato: 2, nombre: 'Disponible', descripcion: '', precio: '12500.50', disponibilidad: '1' }]);
  try { assert.deepEqual(plain(frontend.calculateMockReport(3)), [{ Plato: 'Disponible', Descripcion: '', Precio: 12500.5, Disponible: 'Sí' }]); }
  finally { frontend.setLS('gt_platos', data.platos); }
});

test('el promedio de vendidos usa solo platos con ventas y no duplica detalles de la semilla', () => {
  const tables = ['gt_platos', 'gt_categorias', 'gt_pedidos', 'gt_detalle_pedidos'];
  const saved = tables.map(key => frontend.getLS(key));
  try {
    frontend.setLS('gt_categorias', [{ id_categoria: 1, nombre_categoria: 'Fuertes' }]);
    frontend.setLS('gt_platos', [1, 2, 3].map(id => ({ id_plato: id, id_categoria: 1, nombre: `Plato ${id}` })));
    const details = [{ id_pedido: 1, id_plato: 1, cantidad: '10' }, { id_pedido: 1, id_plato: 2, cantidad: '6' }];
    frontend.setLS('gt_detalle_pedidos', details);
    frontend.setLS('gt_pedidos', [{ id_pedido: 1, detalles: details }]);
    assert.deepEqual(plain(frontend.calculateMockReport(10)), [{ Plato: 'Plato 1', Categoria: 'Fuertes', Vendidos: 10 }]);
    frontend.setLS('gt_pedidos', [{ id_pedido: 1 }, { id_pedido: 2, detalles: [{ id_plato: 2, cantidad: '20' }] }]);
    assert.deepEqual(plain(frontend.calculateMockReport(10)), [{ Plato: 'Plato 2', Categoria: 'Fuertes', Vendidos: 26 }]);
  } finally { tables.forEach((key, index) => frontend.setLS(key, saved[index])); }
});

test('un administrador con reservas no altera el umbral de clientes VIP', () => {
  const savedUsers = frontend.getLS('gt_usuarios'), savedReservations = frontend.getLS('gt_reservas');
  try {
    frontend.setLS('gt_usuarios', [{ id_usuario: 1, nombre: 'Cliente uno', correo: 'uno@example.test', tipo_usuario: 'cliente' }, { id_usuario: 2, nombre: 'Cliente dos', correo: 'dos@example.test', tipo_usuario: 'cliente' }, { id_usuario: 3, nombre: 'Administradora', tipo_usuario: 'administrador' }]);
    const reservations = [1, 1, 1, 2, ...Array(30).fill(3)].map((id_usuario, index) => ({ id_reserva: index + 1, id_usuario }));
    frontend.setLS('gt_reservas', reservations);
    assert.deepEqual(plain(frontend.calculateMockReport(9)), [{ Cliente: 'Cliente uno', Email: 'uno@example.test', 'Total Reservas': 3 }]);
    assert.match(sqlQueries.get(9), /WHERE u\.tipo_usuario = 'cliente'/);
    assert.match(sqlQueries.get(9), /WHERE u2\.tipo_usuario = 'cliente'/);
  } finally { frontend.setLS('gt_usuarios', savedUsers); frontend.setLS('gt_reservas', savedReservations); }
});

test('los promedios positivos se redondean a una y dos cifras sin truncamiento binario', () => {
  const savedRestaurants = frontend.getLS('gt_restaurantes'), savedReviews = frontend.getLS('gt_resenas');
  try {
    frontend.setLS('gt_restaurantes', [{ id_restaurante: 1, nombre: 'Uno' }, { id_restaurante: 2, nombre: 'Dos' }]);
    frontend.setLS('gt_resenas', Array.from({ length: 20 }, (_, index) => ({ id_restaurante: 1, calificacion: index === 0 ? '5' : '4' })));
    assert.equal(frontend.calculateMockReport(4)[0]['Calificacion Promedio'], 4.1);
    frontend.setLS('gt_resenas', [
      ...Array.from({ length: 200 }, (_, index) => ({ id_restaurante: 1, calificacion: index === 0 ? '5' : '4' })),
      { id_restaurante: 2, calificacion: '4' }
    ]);
    assert.deepEqual(plain(frontend.calculateMockReport(8)), [{ Restaurante: 'Uno', Calificacion: 4.01 }]);
  } finally { frontend.setLS('gt_restaurantes', savedRestaurants); frontend.setLS('gt_resenas', savedReviews); }
});
