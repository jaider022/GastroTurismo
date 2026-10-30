'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const plain = value => JSON.parse(JSON.stringify(value));

function node(initialValue = '') {
  let value = String(initialValue), html = '';
  const listeners = new Map();
  const element = {
    disabled: false, children: [], style: {}, textContent: '',
    get value() { return value; },
    set value(next) { value = String(next); },
    get innerHTML() { return html; },
    set innerHTML(next) { html = String(next); this.children = []; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    click() { return listeners.get('click')?.(); },
    querySelector(selector) {
      assert.equal(selector, 'button');
      if (!this.button) this.button = node();
      return this.button;
    }
  };
  return element;
}

function editor({ id = '7', role = 'administrador', price = '12500.25', category = '1', availability = '1', details = [], orders = [] } = {}) {
  const storage = new Map(), calls = [], messages = [], confirmations = [];
  const nodes = Object.fromEntries(Object.entries({
    'mplato-id': id, 'mplato-restaurante': '3', 'mplato-nombre': '  Arroz del café  ',
    'mplato-descripcion': '  Preparado en casa.  ', 'mplato-precio': price,
    'mplato-categoria': category, 'mplato-disponible': availability, 'btn-save-plato': '',
    'platos-restaurante': '2', 'pedido-restaurante': '2', 'pedido-menu-list': '',
    'cart-items': '', 'cart-subtotal': '', 'cart-total': ''
  }).map(([key, value]) => [key, node(value)]));
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Intl, Date, URLSearchParams, window: {},
    document: { addEventListener() {}, getElementById: key => nodes[key], createElement: () => node() },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    confirm: message => { confirmations.push(message); return true; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') +
    '\nglobalThis.frontend = {setLS, getLS, simulateLocalStorageAPI, cart: () => currentCart};', context);
  vm.runInContext(`currentUser = {id_usuario: 1, tipo_usuario: ${JSON.stringify(role)}};`, context);
  const api = context.frontend;
  api.setLS('gt_platos', [
    { id_plato: 7, nombre: 'Sopa de la casa', descripcion: 'Receta original', precio: 10000, disponibilidad: true, id_categoria: 1, id_restaurante: 2 },
    { id_plato: 8, nombre: 'Postre', descripcion: '', precio: 6000, disponibilidad: true, id_categoria: 2, id_restaurante: 3 }
  ]);
  api.setLS('gt_restaurantes', [
    { id_restaurante: 2, id_propietario: 4, nombre: 'Restaurante ajeno' },
    { id_restaurante: 3, id_propietario: 1, nombre: 'Restaurante propio' }
  ]);
  api.setLS('gt_categorias', [{ id_categoria: 1, nombre_categoria: 'Platos fuertes' }, { id_categoria: 2, nombre_categoria: 'Postres' }]);
  api.setLS('gt_detalle_pedidos', details);
  api.setLS('gt_pedidos', orders);
  api.setLS('gt_usuarios', []);
  const request = context.requestAPI;
  context.requestAPI = async (route, options = {}) => {
    calls.push({ route, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    return request(route, options);
  };
  context.showToast = (message, type) => messages.push({ message, type });
  context.closeModal = () => {};
  context.renderPlatosAdmin = async () => {};
  return {
    context, nodes, api, calls, messages, confirmations,
    save: () => context.savePlato({ preventDefault() {} }),
    remove: id => context.deletePlato(id),
    snapshot: () => [...storage.entries()],
    get writes() { return calls.filter(call => call.method !== 'GET'); }
  };
}

test('crear envía POST y conserva el plato en el restaurante seleccionado', async () => {
  const view = editor({ id: '', role: 'restaurante' });
  await view.save();
  assert.deepEqual(view.writes, [{ route: 'platos', method: 'POST', body: {
    nombre: 'Arroz del café', descripcion: 'Preparado en casa.', precio: 12500.25,
    disponibilidad: 1, id_categoria: 1, id_restaurante: 3
  } }]);
  const dishes = plain(view.api.getLS('gt_platos'));
  assert.equal(dishes.length, 3);
  assert.ok(dishes[2].id_plato);
  assert.equal(dishes[2].id_restaurante, 3);
  assert.equal(view.nodes['btn-save-plato'].disabled, false);
});

test('editar usa PUT sobre el mismo identificador, conserva restaurante y permite desactivar', async () => {
  const view = editor({ availability: '0' });
  await view.save();
  assert.equal(view.writes.length, 1);
  assert.equal(view.writes[0].route, 'platos/7');
  assert.equal(view.writes[0].method, 'PUT');
  assert.equal(view.writes[0].body.id_restaurante, 2);
  assert.equal(view.writes[0].body.disponibilidad, 0);
  const dishes = plain(view.api.getLS('gt_platos'));
  assert.equal(dishes.length, 2);
  assert.equal(dishes[0].id_plato, 7);
  assert.equal(dishes[0].id_restaurante, 2);
  assert.equal(dishes[0].disponibilidad, 0);
  assert.equal(dishes[1].nombre, 'Postre');
  assert.equal(view.nodes['btn-save-plato'].disabled, false);
});

for (const role of ['cliente', 'restaurante']) {
  test(`${role} no puede modificar ni eliminar un plato de restaurante ajeno`, async () => {
    const view = editor({ role });
    const before = view.snapshot();
    await view.save();
    await view.remove(7);
    assert.equal(view.writes.length, 0);
    assert.equal(view.confirmations.length, 0);
    assert.equal(view.messages.length, 2);
    assert.ok(view.messages.every(message => /permiso/.test(message.message)));
    assert.deepEqual(view.snapshot(), before);
    assert.equal(view.nodes['btn-save-plato'].disabled, false);
  });
}

test('rechaza precios vacíos, negativos, no numéricos, fuera de rango o con más de dos decimales', async () => {
  for (const price of ['', '   ', '-0.01', 'NaN', 'Infinity', '100000000', '1.005']) {
    const view = editor({ price });
    const before = view.snapshot();
    await view.save();
    assert.equal(view.writes.length, 0, `No debe guardar precio ${JSON.stringify(price)}`);
    assert.match(view.messages[0].message, /precio/);
    assert.deepEqual(view.snapshot(), before);
  }
});

test('acepta precio cero y el máximo permitido por DECIMAL(10,2)', async () => {
  for (const price of ['0', '99999999.99']) {
    const view = editor({ price });
    await view.save();
    assert.equal(view.writes.length, 1);
    assert.equal(view.writes[0].body.precio, Number(price));
  }
});

test('rechaza categoría vacía o inexistente sin modificar los datos', async () => {
  for (const category of ['', '999']) {
    const view = editor({ category });
    const before = view.snapshot();
    await view.save();
    assert.equal(view.writes.length, 0);
    assert.match(view.messages[0].message, /categoría válida/);
    assert.deepEqual(view.snapshot(), before);
    assert.equal(view.nodes['btn-save-plato'].disabled, false);
  }
});

test('elimina por DELETE un plato sin pedidos y conserva los demás', async () => {
  const view = editor({ role: 'restaurante' });
  await view.remove(8);
  assert.deepEqual(view.writes, [{ route: 'platos/8', method: 'DELETE', body: null }]);
  assert.equal(view.confirmations.length, 1);
  assert.deepEqual(plain(view.api.getLS('gt_platos')).map(dish => dish.id_plato), [7]);
  assert.equal(view.messages.at(-1).type, 'success');
});

for (const [source, history] of [
  ['gt_detalle_pedidos', { details: [{ id_pedido: 40, id_plato: 7, cantidad: 2, precio_unitario: 10000 }] }],
  ['pedidos.detalles', { orders: [{ id_pedido: 41, id_restaurante: 2, fecha_pedido: '2026-10-29', detalles: [{ id_plato: 7, cantidad: 1, precio_unitario: 10000 }] }] }]
]) {
  test(`el formulario bloquea eliminación con historial en ${source} y conserva todos los datos`, async () => {
    const view = editor(history);
    const before = view.snapshot();
    await view.remove(7);
    assert.equal(view.writes.length, 0);
    assert.equal(view.confirmations.length, 0);
    assert.match(view.messages.at(-1).message, /pedidos registrados/);
    assert.deepEqual(view.snapshot(), before);
  });

  test(`la simulación también protege directamente el historial en ${source}`, () => {
    const view = editor(history);
    const before = view.snapshot();
    assert.throws(() => view.api.simulateLocalStorageAPI('platos/7', { method: 'DELETE' }), /pedidos registrados/);
    assert.deepEqual(view.snapshot(), before);
  });
}

test('el menú muestra nombres con comillas y HTML como texto y agrega al carrito sin romper el evento', async () => {
  const view = editor();
  const name = `D'Angelo "especial" <img src=x onerror="alert(1)">`;
  view.api.setLS('gt_platos', [
    { id_plato: '7', nombre: name, descripcion: '<script>alert(2)</script>', precio: '12000.25', disponibilidad: '1', id_categoria: 1, id_restaurante: 2 },
    { id_plato: 9, nombre: 'No disponible', precio: 1, disponibilidad: '0', id_categoria: 1, id_restaurante: 2 }
  ]);
  await view.context.loadPedidoMenu();
  const rows = view.nodes['pedido-menu-list'].children;
  assert.equal(rows.length, 1);
  assert.match(rows[0].innerHTML, /D&#39;Angelo &quot;especial&quot; &lt;img/);
  assert.match(rows[0].innerHTML, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(rows[0].innerHTML, /<img|<script|onclick=/);
  rows[0].button.click();
  assert.deepEqual(plain(view.api.cart()), [{ id_plato: 7, nombre: name, precio_unitario: 12000.25, cantidad: 1 }]);
  const cartHTML = view.nodes['cart-items'].children[0].innerHTML;
  assert.match(cartHTML, /D&#39;Angelo &quot;especial&quot; &lt;img/);
  assert.doesNotMatch(cartHTML, /<img/);
});
