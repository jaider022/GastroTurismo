'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function element(value = '') {
  let html = '';
  const classes = new Set(), events = new Map(), selectors = new Map();
  return {
    value, textContent: '', hidden: false, disabled: false, style: {}, children: [], dataset: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: name => classes.has(name) ? classes.delete(name) : classes.add(name) },
    get innerHTML() { return html; },
    set innerHTML(next) { html = String(next); this.children = []; selectors.clear(); },
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    addEventListener(name, handler) { events.set(name, handler); },
    dispatch(name) { return events.get(name)?.({ preventDefault() {}, stopPropagation() {}, target: this }); },
    click() { return this.onclick ? this.onclick() : this.dispatch('click'); },
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    querySelectorAll() { return []; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    reset() {},
  };
}

function catalog({ session = new Map(), restaurants, dishes } = {}) {
  const nodes = new Map(), calls = [], messages = [], reservations = [];
  const getNode = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const rests = restaurants || [
    { id_restaurante: 2, nombre: 'Café Cocora', especialidad: 'Cocina típica', ciudad: 'Salento', nombre_zona: 'Valle del Cocora', direccion: 'Camino rural' },
    { id_restaurante: 3, nombre: 'Mirador del Quindío', especialidad: 'Asados', ciudad: 'Armenia', nombre_zona: 'Centro', direccion: 'Calle 2' }
  ];
  const plates = dishes || [
    { id_plato: 1, id_restaurante: 2, nombre: 'Trucha de la casa', descripcion: 'Con patacón', disponibilidad: 1, precio: '24500.50', nombre_categoria: 'Fuertes' },
    { id_plato: 2, id_restaurante: 2, nombre: 'Plato agotado', disponibilidad: 0, precio: 12000 },
    { id_plato: 3, id_restaurante: 3, nombre: 'Otro restaurante', disponibilidad: true, precio: 9000 }
  ];
  const user = { id_usuario: 42, nombre: 'Turista', tipo_usuario: 'cliente' };
  const local = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, Intl, Date, URLSearchParams,
    window: { scrollTo() {} },
    document: { addEventListener() {}, getElementById: getNode, createElement: () => element(), querySelectorAll: () => [] },
    localStorage: storage(local), sessionStorage: storage(session)
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'), context);
  context.showToast = (message, type) => messages.push({ message, type });
  context.renderDashboardStats = () => {};
  context.loadNotifications = () => {};
  const originalOpenReservation = context.openReservaModal;
  context.openReservaModal = async id => { reservations.push(id); getNode('modal-reserva').classList.add('active'); };
  const response = async (route, options = {}) => {
    calls.push({ route, method: options.method || 'GET' });
    if (route === 'restaurantes') return rests;
    if (route === 'platos') return plates;
    if (route === 'mesas' || route === 'reservas') return [];
    if (route === 'auth/login') {
      if (JSON.parse(options.body).contrasena !== 'Correcta2026!') throw new Error('Credenciales inválidas.');
      return { success: true, user };
    }
    if (route === 'auth/register') return { success: true, user };
    throw new Error(`Consulta inesperada: ${route}`);
  };
  context.requestAPI = response;
  return { context, nodes, node: getNode, calls, messages, reservations, rests, session, originalOpenReservation,
    authenticate: () => vm.runInContext(`currentUser = ${JSON.stringify(user)}`, context),
    get writes() { return calls.filter(call => call.method !== 'GET'); }
  };
}

test('explorar consulta únicamente el catálogo público y no escribe reservas', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  assert.deepEqual(view.calls, [{ route: 'restaurantes', method: 'GET' }]);
  assert.equal(view.node('public-restaurants').children.length, 2);
  assert.notEqual(view.node('public-container').style.display, 'none');
  assert.equal(view.node('app-container').style.display, 'none');
  assert.equal(view.writes.length, 0);
});

test('la búsqueda pública encuentra nombre, especialidad, ciudad y zona sin tildes', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  for (const query of ['cafe', 'tipica', 'salento', 'valle del cocora']) {
    view.node('public-rest-search').value = query;
    view.context.renderPublicRestaurants();
    assert.equal(view.node('public-restaurants').children.length, 1, query);
    assert.match(view.node('public-restaurants').children[0].innerHTML, /Café Cocora/);
  }
  view.node('public-rest-search').value = 'inexistente';
  view.context.renderPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 0);
});

test('los nombres y descripciones públicos se muestran como texto escapado', async () => {
  const view = catalog({ restaurants: [{ id_restaurante: 2, nombre: '<img src=x onerror=alert(1)>', especialidad: 'Comida & café', direccion: '<script>x</script>' }], dishes: [{ id_plato: 1, id_restaurante: 2, nombre: '<b>Trucha</b>', descripcion: '<img src=x>', precio: '15000.50', disponibilidad: 1 }] });
  await view.context.showPublicRestaurants();
  const card = view.node('public-restaurants').children[0].innerHTML;
  assert.ok(!card.includes('<img'));
  assert.match(card, /&lt;img/);
  assert.match(card, /Comida &amp; café/);
  await view.context.openPublicMenu(2);
  const menu = view.node('public-menu-items');
  const html = menu.innerHTML + menu.children.map(child => child.innerHTML).join('');
  assert.ok(!html.includes('<b>Trucha'));
  assert.match(html, /&lt;b&gt;Trucha/);
  assert.ok(!html.includes('<img'));
});

test('el menú público incluye solo platos disponibles del restaurante elegido', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  await view.context.openPublicMenu(2);
  const menu = view.node('public-menu-items');
  const html = menu.innerHTML + menu.children.map(child => child.innerHTML).join('');
  assert.match(html, /Trucha de la casa/);
  assert.ok(!html.includes('Plato agotado'));
  assert.ok(!html.includes('Otro restaurante'));
  assert.equal(view.node('modal-public-menu').classList.contains('active'), true);
  assert.equal(view.writes.length, 0);
});

test('Reservar solicita acceso y mantiene el restaurante sin crear registros', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  await view.context.beginGuestReservation(2);
  assert.equal(view.context.getPendingReservation(), 2);
  assert.equal(view.node('login-reserva-context').hidden, false);
  assert.equal(view.node('login-container').style.display, 'flex');
  assert.equal(view.reservations.length, 0);
  assert.equal(view.writes.length, 0);
  const reloaded = catalog({ session: view.session });
  assert.equal(reloaded.context.getPendingReservation(), 2);
});

test('una selección inválida no inicia una reserva pendiente', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  await view.context.beginGuestReservation(999);
  assert.equal(view.context.getPendingReservation(), null);
  assert.equal(view.reservations.length, 0);
});

test('un acceso fallido conserva la selección para reintentar', async () => {
  const view = catalog();
  view.context.setupEventHandlers();
  await view.context.showPublicRestaurants();
  await view.context.beginGuestReservation(2);
  view.node('login-email').value = 'turista@example.com';
  view.node('login-password').value = 'incorrecta';
  await view.node('form-login').dispatch('submit');
  assert.equal(view.context.getPendingReservation(), 2);
  assert.equal(view.reservations.length, 0);
  assert.ok(view.messages.some(message => /Credenciales/.test(message.message)));
});

for (const mode of ['login', 'register']) {
  test(`${mode} continúa al formulario de reserva con el restaurante elegido`, async () => {
    const view = catalog();
    view.context.setupEventHandlers();
    await view.context.showPublicRestaurants();
    await view.context.beginGuestReservation(2);
    view.node('login-email').value = 'turista@example.com';
    view.node('login-password').value = 'Correcta2026!';
    view.node('register-name').value = 'Turista';
    view.node('register-email').value = 'turista@example.com';
    view.node('register-phone').value = '3001234567';
    view.node('register-password').value = 'Correcta2026!';
    view.node('register-type').value = 'cliente';
    await view.node(`form-${mode}`).dispatch('submit');
    assert.deepEqual(view.reservations, [2]);
    assert.equal(view.context.getPendingReservation(), null);
    assert.equal(view.node('modal-reserva').classList.contains('active'), true);
    assert.ok(view.writes.every(call => call.route.startsWith('auth/')));
  });
}

test('si el restaurante fue eliminado se informa y se descarta la selección', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  await view.context.beginGuestReservation(2);
  view.authenticate();
  view.rests.splice(0, 1);
  await view.context.resumePendingReservation();
  assert.equal(view.context.getPendingReservation(), null);
  assert.equal(view.reservations.length, 0);
  assert.ok(view.messages.length);
});

test('un error al abrir la reserva conserva el restaurante para reintentar', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  await view.context.beginGuestReservation(2);
  view.authenticate();
  view.context.openReservaModal = async () => { throw new Error('Sin conexión'); };
  await view.context.resumePendingReservation();
  assert.equal(view.context.getPendingReservation(), 2);
  assert.ok(view.messages.some(message => /conexión/.test(message.message)));
});

test('cerrar el menú durante la carga impide que la respuesta vuelva a mostrar contenido', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  let resolveDishes;
  view.context.requestAPI = async () => new Promise(resolve => { resolveDishes = resolve; });
  const loading = view.context.openPublicMenu(2);
  view.node('modal-public-menu').classList.remove('active');
  const before = view.node('public-menu-items').innerHTML;
  resolveDishes([{ id_restaurante: 2, nombre: 'Respuesta tardía', disponibilidad: 1, precio: 10000 }]);
  await loading;
  assert.equal(view.node('modal-public-menu').classList.contains('active'), false);
  assert.equal(view.node('public-menu-items').innerHTML, before);
  assert.equal(view.node('public-menu-items').children.length, 0);
});

test('una respuesta tardía del primer restaurante no reemplaza el menú del segundo', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  const pending = [];
  view.context.requestAPI = async () => new Promise(resolve => pending.push(resolve));
  const first = view.context.openPublicMenu(2);
  const second = view.context.openPublicMenu(3);
  pending[1]([{ id_restaurante: 3, nombre: 'Menú del mirador', disponibilidad: 1, precio: 22000 }]);
  await second;
  pending[0]([{ id_restaurante: 2, nombre: 'Menú anterior', disponibilidad: 1, precio: 12000 }]);
  await first;
  assert.equal(view.node('public-menu-title').textContent, 'Menú · Mirador del Quindío');
  const items = view.node('public-menu-items').children;
  assert.equal(items.length, 1);
  assert.match(items[0].innerHTML, /Menú del mirador/);
  assert.ok(!items[0].innerHTML.includes('Menú anterior'));
});

test('initApp reanuda la selección restaurada cuando ya existe una sesión', async () => {
  const view = catalog({ session: new Map([['gt_pending_restaurant', '2']]) });
  view.authenticate();
  await view.context.initApp();
  assert.deepEqual(view.reservations, [2]);
  assert.equal(view.context.getPendingReservation(), null);
  assert.equal(view.node('modal-reserva').classList.contains('active'), true);
  assert.equal(view.node('app-container').style.display, 'grid');
  assert.equal(view.writes.length, 0);
});

test('el formulario original precarga el restaurante seleccionado sin guardar una reserva', async () => {
  const view = catalog({ session: new Map([['gt_pending_restaurant', '2']]) });
  view.authenticate();
  view.context.openReservaModal = view.originalOpenReservation;
  await view.context.resumePendingReservation();
  assert.equal(Number(view.node('mres-restaurante').value), 2);
  assert.equal(view.node('modal-reserva-title').textContent, 'Nueva Reserva de Mesa');
  assert.equal(view.node('modal-reserva').classList.contains('active'), true);
  assert.equal(view.context.getPendingReservation(), null);
  assert.ok(view.calls.some(call => call.route === 'mesas'));
  assert.ok(view.calls.some(call => call.route === 'reservas'));
  assert.equal(view.writes.length, 0);
});
