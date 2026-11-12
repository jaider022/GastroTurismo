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
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force) { const add = force === undefined ? !classes.has(name) : force; if (add) classes.add(name); else classes.delete(name); return add; } },
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
    showModal() { this.open = true; },
    close() { this.open = false; },
    contains(node) { return node === this || this.children.includes(node); },
    reset() {},
  };
}

function catalog({ session = new Map(), restaurants, dishes, reducedMotion = false } = {}) {
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
  const timers = new Map();
  let timerId = 0;
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, Intl, Date, URLSearchParams,
    window: { scrollTo() {}, matchMedia: () => ({ matches: reducedMotion }), setInterval(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; }, clearInterval(id) { timers.delete(id); } },
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
  return { context, nodes, node: getNode, calls, messages, reservations, rests, session, originalOpenReservation, timers,
    tick: () => { for (const timer of [...timers.values()]) timer.callback(); },
    authenticate: () => vm.runInContext(`currentUser = ${JSON.stringify(user)}`, context),
    get writes() { return calls.filter(call => call.method !== 'GET'); }
  };
}

test('explorar consulta únicamente el catálogo público y no escribe reservas', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  assert.deepEqual(view.calls, [{ route: 'restaurantes', method: 'GET' }]);
  assert.equal(view.node('public-restaurants').children.length, 3);
  assert.notEqual(view.node('public-container').style.display, 'none');
  assert.equal(view.node('app-container').style.display, 'none');
  assert.equal(view.writes.length, 0);
});

test('la entrada sin sesión muestra el catálogo sin pedir credenciales ni crear reservas', async () => {
  const view = catalog();
  await view.context.initApp();
  assert.equal(view.node('public-container').style.display, 'grid');
  assert.equal(view.node('login-container').style.display, 'none');
  assert.equal(view.node('app-container').style.display, 'none');
  assert.deepEqual(view.calls, [{ route: 'restaurantes', method: 'GET' }]);
  assert.equal(view.writes.length, 0);
  assert.equal(view.reservations.length, 0);
});

test('recargar sin sesión conserva una elección anterior y permite seguir explorando', async () => {
  const view = catalog({ session: new Map([['gt_pending_restaurant', '2']]) });
  await view.context.initApp();
  assert.equal(view.node('public-container').style.display, 'grid');
  assert.equal(view.node('login-container').style.display, 'none');
  assert.equal(view.context.getPendingReservation(), 2);
  assert.equal(view.reservations.length, 0);
});

test('crear cuenta y volver al catálogo conserva el restaurante elegido para reservar', async () => {
  const view = catalog();
  view.context.setupEventHandlers();
  await view.context.initApp();
  await view.context.beginGuestReservation(2);
  await view.node('go-to-register').click();
  assert.equal(view.node('form-register').classList.contains('active'), true);
  assert.equal(view.node('form-login').classList.contains('active'), false);
  await view.node('btn-explorar-restaurantes').click();
  assert.equal(view.node('public-container').style.display, 'grid');
  assert.equal(view.context.getPendingReservation(), 2);
  await view.node('btn-public-login').click();
  assert.equal(view.node('form-login').classList.contains('active'), true);
  assert.equal(view.node('form-register').classList.contains('active'), false);
  await view.node('btn-public-register').click();
  assert.equal(view.node('form-register').classList.contains('active'), true);
  assert.equal(view.node('login-reserva-context').hidden, false);
  assert.equal(view.writes.length, 0);
});

test('cerrar sesión vuelve al catálogo y limpia la selección y los avisos privados', async () => {
  const view = catalog({ session: new Map([['gt_pending_restaurant', '2']]) });
  view.context.setupEventHandlers();
  view.authenticate();
  view.node('notification-panel').classList.add('active');
  await view.node('btn-logout').click();
  assert.equal(view.node('public-container').style.display, 'grid');
  assert.equal(view.node('login-container').style.display, 'none');
  assert.equal(view.node('app-container').style.display, 'none');
  assert.equal(view.context.getPendingReservation(), null);
  assert.equal(view.node('notification-panel').classList.contains('active'), false);
  assert.equal(view.writes.length, 0);
});

test('la búsqueda pública encuentra nombre, especialidad, ciudad y zona sin tildes', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  for (const query of ['cafe', 'tipica', 'salento', 'valle del cocora']) {
    view.node('public-rest-search').value = query;
    view.context.renderPublicRestaurants();
    assert.equal(view.node('public-restaurants').children.length, query === 'cafe' ? 2 : 1, query);
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
  assert.ok(!card.includes('<img src=x'));
  assert.doesNotMatch(card, /<img\b[^>]*\bonerror\s*=/i);
  assert.match(card, /&lt;img/);
  assert.match(card, /Comida &amp; café/);
  await view.context.openPublicMenu(2);
  const menu = view.node('public-menu-items');
  const html = menu.innerHTML + menu.children.map(child => child.innerHTML).join('');
  assert.ok(!html.includes('<b>Trucha'));
  assert.match(html, /&lt;b&gt;Trucha/);
  assert.ok(!html.includes('<img'));
  assert.match(view.node('public-menu-contact').innerHTML, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('municipio y búsqueda se combinan sin mezclar restaurantes ni escribir reservas', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  assert.match(view.node('public-rest-city').innerHTML, /Armenia/);
  assert.match(view.node('public-rest-city').innerHTML, /Salento/);
  view.node('public-rest-city').value = 'salento';
  view.context.renderPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 1);
  assert.match(view.node('public-restaurants').children[0].innerHTML, /Café Cocora/);
  view.node('public-rest-search').value = 'asados';
  view.context.renderPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 0);
  assert.equal(view.node('public-rest-count').textContent, '0 restaurantes encontrados');
  view.node('public-rest-city').value = '';
  view.context.renderPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 1);
  assert.match(view.node('public-restaurants').children[0].innerHTML, /Mirador del Quindío/);
  assert.equal(view.writes.length, 0);
});

test('el menú conserva dirección y teléfono aunque las tarjetas sean compactas', async () => {
  const view = catalog({ restaurants: [{ id_restaurante: 2, nombre: 'Café Cocora', especialidad: 'Café de origen', ciudad: 'Salento', direccion: 'Vía al valle, km 2', nombre_zona: 'Cocora', telefono: '3105550100' }] });
  await view.context.showPublicRestaurants();
  const card = view.node('public-restaurants').children[0].innerHTML;
  assert.ok(!card.includes('3105550100'));
  await view.context.openPublicMenu(2);
  const contact = view.node('public-menu-contact').innerHTML;
  assert.match(contact, /Vía al valle, km 2/);
  assert.match(contact, /Cocora/);
  assert.match(contact, /3105550100/);
});

test('Sorrento aparece y se puede buscar junto a los demás sin inventar una reserva', async () => {
  const view = catalog();
  await view.context.showPublicRestaurants();
  view.node('public-rest-search').value = 'sorrento';
  view.node('public-rest-city').value = 'armenia';
  view.context.renderPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 1);
  const card = view.node('public-restaurants').children[0];
  assert.match(card.innerHTML, /Café Sorrento/);
  assert.ok(!card.innerHTML.includes('>Reservar<'));
  await card.querySelector('[data-public-menu]').click();
  assert.match(view.node('public-menu-items').innerHTML, /Maicitos/);
  assert.match(view.node('public-menu-items').innerHTML, /Pizza/);
  await card.querySelector('[data-public-reserve]').click();
  assert.equal(view.node('sorrento-gallery').open, true);
  assert.equal(view.context.getPendingReservation(), null);
  assert.equal(view.writes.length, 0);
  await view.context.openPublicMenu(2);
  assert.equal(view.node('btn-public-reserve').textContent, 'Reservar en este restaurante');
});

test('si Sorrento ya llega de la base no se duplica y utiliza su identificador real', async () => {
  const view = catalog({ restaurants: [{ id_restaurante: 80, nombre: 'Café Sorrento', ciudad: 'Armenia', especialidad: 'Café y desayunos' }] });
  await view.context.showPublicRestaurants();
  assert.equal(view.node('public-restaurants').children.length, 1);
  assert.match(view.node('public-restaurants').children[0].innerHTML, />Reservar</);
  await view.node('public-restaurants').children[0].querySelector('[data-public-reserve]').click();
  assert.equal(view.context.getPendingReservation(), 80);
  assert.equal(view.writes.length, 0);
});

test('fotos y tarjetas rotan con tiempos independientes, pausa y limpieza al cambiar de vista', async () => {
  const restaurants = [1, 2, 3, 4].map(id => ({ id_restaurante: id, nombre: 'Restaurante ' + id, ciudad: 'Armenia' }));
  const view = catalog({ restaurants });
  await view.context.showPublicRestaurants();
  assert.equal(view.timers.size, 2);
  assert.deepEqual([...view.timers.values()].map(t => t.delay).sort((a, b) => a - b), [2000, 5000]);
  assert.equal(view.node('public-hero-image').src, 'images/cocora-restaurante.jpg');
  view.tick();
  assert.equal(view.node('public-hero-image').src, 'images/cafe-finca.jpg');
  assert.equal(view.node('public-restaurants').children[0].inert, true);
  assert.equal(view.node('public-restaurants').children[4].inert, true);
  view.tick();
  assert.equal(view.node('public-restaurants').children[4].inert, false);
  view.context.setPublicCarouselPaused('catalog', true);
  assert.equal(view.timers.size, 1);
  const transform = view.node('public-restaurants').style.transform;
  view.tick();
  assert.equal(view.node('public-restaurants').style.transform, transform);
  view.context.advancePublicCatalog(-1);
  assert.notEqual(view.node('public-restaurants').style.transform, transform);
  assert.equal(view.timers.size, 1);
  view.context.setPublicCarouselPaused('catalog', false);
  await view.context.showPublicRestaurants();
  assert.equal(view.timers.size, 2);
  view.context.showLogin();
  assert.equal(view.timers.size, 0);
  await view.context.showPublicRestaurants();
  view.authenticate();
  view.context.showDashboard();
  assert.equal(view.timers.size, 0);
});

test('carruseles se detienen al leer detalles o interactuar y respetan movimiento reducido', async () => {
  const restaurants = [1, 2, 3, 4].map(id => ({ id_restaurante: id, nombre: 'Restaurante ' + id, ciudad: 'Armenia' }));
  const view = catalog({ restaurants });
  view.context.setupEventHandlers();
  await view.context.showPublicRestaurants();
  view.node('sorrento-gallery').open = true;
  view.tick();
  assert.equal(view.node('public-hero-image').src, 'images/cocora-restaurante.jpg');
  assert.equal(view.node('public-restaurants').children[0].inert, false);
  view.node('sorrento-gallery').close();
  view.node('public-catalog').dispatch('mouseenter');
  view.tick();
  assert.equal(view.node('public-restaurants').children[0].inert, false);
  assert.equal(view.node('public-hero-image').src, 'images/cafe-finca.jpg');
  view.node('public-catalog').dispatch('mouseleave');
  view.tick();
  assert.equal(view.node('public-restaurants').children[0].inert, true);
  const reduced = catalog({ restaurants, reducedMotion: true });
  await reduced.context.showPublicRestaurants();
  assert.equal(reduced.timers.size, 0);
  reduced.context.advancePublicHero(1);
  assert.equal(reduced.node('public-hero-image').src, 'images/cafe-finca.jpg');
  reduced.context.advancePublicCatalog(1);
  assert.equal(reduced.node('public-restaurants').children[0].inert, true);
});

test('el catálogo gira completo y Sorrento pasa por derecha, centro e izquierda sin devolverse', async () => {
  const restaurants = ['A', 'B', 'C', 'D'].map((nombre, i) => ({ id_restaurante: i + 1, nombre, ciudad: 'Armenia' }));
  const view = catalog({ restaurants });
  await view.context.showPublicRestaurants();
  const visible = () => view.node('public-restaurants').children.filter(card => !card.inert);
  const names = () => visible().map(card => card.innerHTML.match(/<h3><button[^>]*>(.*?)<\/button>/)[1]);
  const expected = [['A','B','C'], ['B','C','D'], ['C','D','Café Sorrento'], ['D','Café Sorrento','A'], ['Café Sorrento','A','B'], ['A','B','C']];
  for (const window of expected) {
    assert.deepEqual(names(), window);
    view.context.advancePublicCatalog(1, false);
    view.context.finishPublicCatalogLoop();
  }
  view.context.renderPublicCatalogPosition(4);
  const clone = visible()[1];
  assert.equal(clone['data-catalog-clone'], 'true');
  await clone.querySelector('[data-public-reserve]').click();
  assert.equal(view.context.getPendingReservation(), 1);
  assert.equal(view.writes.length, 0);
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

test('horas de reserva tienen intervalos de quince minutos y distinguen café de cocina cafetera', () => {
  const view = catalog();
  const cafe = view.context.reservationTimeOptions({ nombre: 'Café La Palma', especialidad: 'Desayunos y café' });
  const restaurant = view.context.reservationTimeOptions({ nombre: 'Fogón del Guadual', especialidad: 'Cocina tradicional cafetera' });
  assert.equal(cafe.length, 57);
  assert.equal(cafe[0].value, '08:00');
  assert.equal(cafe.at(-1).value, '22:00');
  assert.equal(restaurant.length, 47);
  assert.equal(restaurant[0].value, '11:30');
  assert.equal(restaurant.at(-1).value, '23:00');
  for (const option of [...cafe, ...restaurant]) assert.match(option.value, /^\d{2}:(00|15|30|45)$/);
  assert.equal(cafe.find(option => option.value === '13:15').label, '1:15 p. m.');
  assert.equal(view.context.reservationTimeOptions(null).length, 0);
});

test('Sorrento respeta apertura 08:30 y fin de ocupación a las 22:30, conservando galería y reserva reales', async () => {
  const view = catalog({ restaurants: [{ id_restaurante: 80, nombre: 'Café Sorrento', ciudad: 'Armenia', direccion: 'Mall Privilegio' }], dishes: [] });
  const options = view.context.reservationTimeOptions(view.rests[0]);
  assert.equal(options.length, 49);
  assert.equal(options[0].value, '08:30');
  assert.equal(options.at(-1).value, '20:30');
  assert.ok(options.every(option => /:(00|15|30|45)$/.test(option.value)));
  await view.context.showPublicRestaurants();
  await view.context.openPublicMenu(80);
  assert.match(view.node('public-menu-contact').innerHTML, /Mall Privilegio/);
  assert.match(view.node('public-menu-contact').innerHTML, /10:30 p. m./);
  assert.match(view.node('public-menu-items').innerHTML, /Precios por confirmar/);
  assert.match(view.node('public-menu-items').innerHTML, /Rollitos/);
  assert.equal(view.node('btn-public-reserve').textContent, 'Reservar en este restaurante');
  await view.node('public-menu-contact').children[0].click();
  assert.equal(view.node('sorrento-gallery').open, true);
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
  assert.equal(view.node('modal-reserva-title').textContent, 'Nueva reserva de mesa');
  assert.equal(view.node('modal-reserva').classList.contains('active'), true);
  assert.equal(view.context.getPendingReservation(), null);
  assert.ok(view.calls.some(call => call.route === 'restaurantes'));
  assert.match(view.node('mres-mesa-summary').textContent, /fecha y hora/);
  assert.equal(view.node('mres-mesa').disabled, true);
  assert.equal(view.writes.length, 0);
});
