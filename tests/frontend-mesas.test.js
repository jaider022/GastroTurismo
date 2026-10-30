'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function editor({ id = '7', capacity = '6', number = 'Mesa 9', role = 'administrador', reservations = [] } = {}) {
  const nodes = Object.fromEntries(Object.entries({
    'mmesa-id': id, 'mmesa-restaurante': '3', 'mmesa-numero': number,
    'mmesa-capacidad': capacity, 'mmesa-ubicacion': 'Terraza', 'filter-mesas-restaurante': '2', 'btn-save-mesa': ''
  }).map(([key, value]) => [key, { value, disabled: false }]));
  const writes = [], messages = [];
  const tables = [
    { id_mesa: 7, id_restaurante: 2, numero_mesa: 'Mesa 1', capacidad: 4, ubicacion: 'Salón', estado: 'reservada' },
    { id_mesa: 8, id_restaurante: 2, numero_mesa: 'Mesa 10', capacidad: 4, ubicacion: 'Salón', estado: 'disponible' }
  ];
  const context = vm.createContext({
    console, Intl, Date, URLSearchParams, window: {},
    document: { addEventListener() {}, getElementById: id => nodes[id] },
    localStorage: { getItem: () => null }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'), context);
  vm.runInContext(`currentUser = {id_usuario: 1, tipo_usuario: ${JSON.stringify(role)}};`, context);
  context.requestAPI = async (route, options = {}) => {
    if (options.method) {
      writes.push({ route, method: options.method, body: JSON.parse(options.body) });
      return {};
    }
    if (route === 'mesas') return tables;
    if (route === 'restaurantes') return [
      { id_restaurante: 2, id_propietario: 4 }, { id_restaurante: 3, id_propietario: 1 }
    ];
    if (route === 'reservas') return reservations;
    throw new Error('Petición inesperada: ' + route);
  };
  context.showToast = message => messages.push(message);
  context.closeModal = () => {};
  context.renderMesas = async () => {};
  return { nodes, writes, messages, save: () => context.saveMesa({ preventDefault() {} }) };
}

test('editar actualiza el mismo identificador y conserva restaurante y estado reservado', async () => {
  const view = editor();
  await view.save();
  assert.deepEqual(view.writes, [{ route: 'mesas/7', method: 'PUT', body: {
    numero_mesa: 'Mesa 9', capacidad: 6, ubicacion: 'Terraza', estado: 'reservada', id_restaurante: 2
  } }]);
  assert.equal(view.nodes['btn-save-mesa'].disabled, false);
});

test('la creación conserva POST y crea una mesa disponible en el restaurante seleccionado', async () => {
  const view = editor({ id: '' });
  await view.save();
  assert.equal(view.writes.length, 1);
  assert.equal(view.writes[0].route, 'mesas');
  assert.equal(view.writes[0].method, 'POST');
  assert.equal(view.writes[0].body.estado, 'disponible');
  assert.equal(view.writes[0].body.id_restaurante, 3);
});

test('no envía una reducción de aforo incompatible con una reserva activa', async () => {
  const view = editor({ capacity: '2', reservations: [{ id_mesa: 7, estado_reserva: 'confirmada', cantidad_personas: 4 }] });
  await view.save();
  assert.equal(view.writes.length, 0);
  assert.match(view.messages[0], /reserva activa/);
});

test('no envía números duplicados de mesa dentro del mismo restaurante', async () => {
  const view = editor({ number: 'mesa 10' });
  await view.save();
  assert.equal(view.writes.length, 0);
  assert.match(view.messages[0], /Ya existe/);
});

test('un cliente no puede guardar mediante el formulario de administración', async () => {
  const view = editor({ role: 'cliente' });
  await view.save();
  assert.equal(view.writes.length, 0);
  assert.match(view.messages[0], /permiso/);
});
