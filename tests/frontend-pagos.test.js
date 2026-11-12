'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const dataset = require('../public/demo-data.json');
const plain = value => JSON.parse(JSON.stringify(value));

function fixture() {
  const storage = new Map();
  const context = vm.createContext({ console: { log() {} }, Intl, Date, URLSearchParams,
    document: { addEventListener() {} }, window: {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') +
    '\nglobalThis.model = {getLS, setLS, initLocalStorageData, migrateDemoWithoutPlans, simulateLocalStorageAPI};', context);
  context.loadedData = plain(dataset);
  vm.runInContext('demoDataset = loadedData; currentUser = {id_usuario: 6, tipo_usuario: "cliente"};', context);
  context.model.initLocalStorageData();
  return { context, storage, api: context.model, user: user => { context.account = user; vm.runInContext('currentUser = account;', context); } };
}

test('la actualización respalda planes antiguos y conserva reservas, pedidos y pagos de comida con sus IDs', () => {
  const {api, storage} = fixture();
  api.setLS('gt_reservas', [{id_reserva: 901, nombre: 'Reserva ingresada por el usuario'}]);
  api.setLS('gt_pedidos', [{id_pedido: 902, id_usuario: 6, total_pago: 45000}]);
  api.setLS('gt_restaurantes', [{id_restaurante: 903, nombre: 'Restaurante propio', id_plan: 2, nombre_plan: 'Premium'}]);
  const oldPayments = [{id_pago: 904, id_pedido: 902, monto: 45000, id_plan: null}, {id_pago: 905, id_pedido: null, monto: 120000, id_plan: 2}];
  api.setLS('gt_pagos', oldPayments);
  api.setLS('gt_planes', [{id_plan: 2, costo: 120000}]);
  const reservations = storage.get('gt_academico_v2:gt_reservas');
  const orders = storage.get('gt_academico_v2:gt_pedidos');
  api.initLocalStorageData();
  assert.equal(storage.get('gt_academico_v2:gt_reservas'), reservations);
  assert.equal(storage.get('gt_academico_v2:gt_pedidos'), orders);
  assert.deepEqual(plain(api.getLS('gt_pagos')), [{id_pago: 904, id_pedido: 902, monto: 45000}]);
  assert.deepEqual(plain(api.getLS('gt_restaurantes')), [{id_restaurante: 903, nombre: 'Restaurante propio'}]);
  const backup = storage.get('gt_academico_v2:respaldo_antes_sin_planes');
  assert.deepEqual(JSON.parse(backup).pagos, oldPayments);
  assert.equal(JSON.parse(backup).planes[0].id_plan, 2);
  const after = [...storage.entries()];
  api.migrateDemoWithoutPlans();
  assert.deepEqual([...storage.entries()], after);
});

test('si falla el respaldo del navegador no se alteran los registros antiguos', () => {
  const {api, context, storage} = fixture();
  api.setLS('gt_restaurantes', [{id_restaurante: 1, id_plan: 1}]);
  const original = [...storage.entries()];
  const write = context.localStorage.setItem;
  context.localStorage.setItem = (key, value) => { if (key.includes('respaldo_antes')) throw new Error('Sin espacio'); return write(key, value); };
  assert.throws(() => api.migrateDemoWithoutPlans(), /Sin espacio/);
  assert.deepEqual([...storage.entries()], original);
});

test('crear pedido y registrar su pago conserva el flujo sin planes ni cambios en restaurantes', () => {
  const {api} = fixture();
  const restaurants = plain(api.getLS('gt_restaurantes'));
  const post = (route, body) => api.simulateLocalStorageAPI(route, {method: 'POST', body: JSON.stringify(body)});
  const order = post('pedidos', {id_usuario: 6, id_restaurante: 1, tipo_servicio: 'comedor', total_pago: 14000,
    platos: [{id_plato: 1, cantidad: 1, precio_unitario: 14000}]});
  const payment = post('pagos', {monto: 14000, id_usuario: 6, id_metodo: 1, id_pedido: order.id_pedido});
  assert.equal(payment.id_pedido, order.id_pedido);
  assert.equal(payment.estado_pago, 'aprobado');
  assert.equal(Object.hasOwn(payment, 'id_plan'), false);
  assert.deepEqual(plain(api.getLS('gt_restaurantes')), restaurants);
  assert.ok(api.getLS('gt_pagos').some(p => p.id_pago === payment.id_pago && p.id_pedido === order.id_pedido));
});

test('un formulario antiguo no puede volver a asignar planes al crear o editar restaurantes', () => {
  const {api} = fixture();
  const restaurant = api.simulateLocalStorageAPI('restaurantes', {method: 'POST', body: JSON.stringify({nombre: 'Nuevo local', id_plan: 2, nombre_plan: 'Premium'})});
  assert.equal(Object.hasOwn(restaurant, 'id_plan'), false);
  api.simulateLocalStorageAPI(`restaurantes/${restaurant.id_restaurante}`, {method: 'PUT', body: JSON.stringify({nombre: 'Local editado', id_plan: 3})});
  const saved = api.getLS('gt_restaurantes').find(r => r.id_restaurante === restaurant.id_restaurante);
  assert.equal(saved.nombre, 'Local editado');
  assert.equal(Object.hasOwn(saved, 'id_plan'), false);
});

test('pagos demo rechazan planes, pedidos ajenos/cancelados/inexistentes y medios inválidos sin guardar', () => {
  const {api, user} = fixture();
  api.setLS('gt_pedidos', [{id_pedido: 1, id_usuario: 6, estado_pedido: 'entregado'}, {id_pedido: 2, id_usuario: 7, estado_pedido: 'entregado'}, {id_pedido: 3, id_usuario: 6, estado_pedido: 'cancelado'}]);
  const before = plain(api.getLS('gt_pagos'));
  const send = body => api.simulateLocalStorageAPI('pagos', {method: 'POST', body: JSON.stringify({monto: 1000, id_usuario: 6, id_metodo: 1, id_pedido: 1, ...body})});
  for (const body of [{id_plan: 1}, {id_plan: null}, {id_pedido: null}, {id_pedido: 99999}, {id_pedido: 2}, {id_pedido: 3}, {id_metodo: 99999}, {id_usuario: 7}, {monto: 0}, {monto: -1}]) assert.throws(() => send(body));
  user(null);
  assert.throws(() => send({}), /iniciar sesión/);
  assert.deepEqual(plain(api.getLS('gt_pagos')), before);
});
