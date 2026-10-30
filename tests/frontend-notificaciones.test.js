'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  let html = '';
  const classes = new Set(), events = new Map(), selectors = new Map();
  return {
    value: '', textContent: '', style: {}, children: [], disabled: false,
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value), toggle: value => classes.has(value) ? classes.delete(value) : classes.add(value) },
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); this.children = []; selectors.clear(); },
    appendChild(child) { this.children.push(child); },
    addEventListener(name, handler) { events.set(name, handler); },
    dispatch(name, event = { preventDefault() {}, stopPropagation() {} }) { return events.get(name)?.(event); },
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, element()); return selectors.get(selector); },
    setAttribute(name, value) { this[name] = String(value); }
  };
}

function fixture() {
  const nodes = new Map(), storage = new Map(), calls = [], messages = [], documentEvents = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, Intl, Date, URLSearchParams,
    window: { scrollTo() {} },
    document: { getElementById: node, createElement: () => element(), querySelectorAll: () => [], addEventListener: (name, handler) => documentEvents.set(name, handler) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    sessionStorage: { getItem: () => null, removeItem() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') + '\nglobalThis.data = {setLS, getLS};', context);
  const own = Array.from({ length: 8 }, (_, index) => ({
    id_notificacion: index + 1, id_usuario: 1, mensaje: `Aviso ${index + 1}`,
    fecha_envio: `2026-10-${String(index < 6 ? 24 : 25).padStart(2, '0')} 15:30:00`,
    leido: [false, 0, '0', false, 0, '0', true, '1'][index]
  }));
  context.data.setLS('gt_notificaciones', [...own, { id_notificacion: 99, id_usuario: 2, mensaje: 'Aviso privado de otra persona', fecha_envio: '2026-10-29 15:30:00', leido: false }]);
  const user = id => vm.runInContext(`currentUser = ${id === null ? 'null' : JSON.stringify({ id_usuario: id, nombre: 'Cliente', tipo_usuario: 'cliente' })}`, context);
  user(1);
  const originalRequest = context.requestAPI;
  context.requestAPI = async (route, options = {}) => {
    calls.push({ route, method: options.method || 'GET' });
    return originalRequest(route, options);
  };
  context.showToast = (message, type) => messages.push({ message, type });
  const contents = () => node('notifications-list').innerHTML + node('notifications-list').children.map(child => child.innerHTML).join('');
  return { context, node, calls, messages, user, contents, documentEvents, originalRequest,
    records: () => JSON.parse(JSON.stringify(context.data.getLS('gt_notificaciones'))),
    get writes() { return calls.filter(call => call.method !== 'GET'); }
  };
}

test('el panel pagina cinco avisos, ordena por fecha/id y filtra pendientes, todas y leídas', async () => {
  const view = fixture();
  view.context.setupEventHandlers();
  await view.context.loadNotifications();
  assert.equal(view.node('notification-filter').value, 'pendientes');
  assert.equal(view.node('notification-count').textContent, '6');
  assert.equal(view.node('notifications-list').children.length, 5);
  assert.match(view.node('notifications-list').children[0].innerHTML, /Aviso 6/);
  assert.equal(view.node('notification-page').textContent, '1 / 2');
  await view.node('notification-next').dispatch('click');
  assert.equal(view.node('notification-page').textContent, '2 / 2');
  assert.equal(view.node('notifications-list').children.length, 1);
  assert.match(view.contents(), /Aviso 1/);
  view.node('notification-filter').value = 'todas';
  await view.node('notification-filter').dispatch('change');
  assert.equal(view.node('notification-page').textContent, '1 / 2');
  assert.match(view.node('notifications-list').children[0].innerHTML, /Aviso 8/);
  assert.match(view.node('notification-summary').textContent, /de 8/);
  view.node('notification-filter').value = 'leidas';
  await view.node('notification-filter').dispatch('change');
  assert.equal(view.node('notifications-list').children.length, 2);
  assert.equal(view.node('notification-count').textContent, '6');
  assert.equal(view.node('notification-page').textContent, '1 / 1');
  assert.ok(!view.contents().includes('otra persona'));
});

test('marcar el último pendiente de la página dos actualiza almacenamiento, contador y página', async () => {
  const view = fixture();
  view.context.setupEventHandlers();
  await view.context.loadNotifications();
  view.node('notification-next').dispatch('click');
  await view.node('notifications-list').children[0].querySelector('button').dispatch('click');
  assert.deepEqual(view.writes, [{ route: 'notificaciones/leer/1', method: 'PUT' }]);
  assert.equal(view.records().find(record => record.id_notificacion === 1).leido, true);
  assert.equal(view.node('notification-count').textContent, '5');
  assert.equal(view.node('notification-page').textContent, '1 / 1');
  assert.equal(view.node('notifications-list').children.length, 5);
  assert.equal(view.records().find(record => record.id_notificacion === 99).leido, false);
});

test('un PUT fallido conserva el aviso pendiente y permite volver a intentarlo', async () => {
  const view = fixture();
  await view.context.loadNotifications();
  const before = view.records();
  view.context.requestAPI = async () => { throw new Error('No hay conexión'); };
  await view.context.markNotificationRead(6);
  assert.deepEqual(view.records(), before);
  assert.equal(view.node('notification-count').textContent, '6');
  assert.match(view.contents(), /Aviso 6/);
  assert.equal(view.node('notifications-list').children[0].querySelector('button').disabled, false);
  assert.ok(view.messages.some(message => /conexión/.test(message.message)));
});

test('dos pulsaciones durante un guardado solo envían un PUT', async () => {
  const view = fixture();
  await view.context.loadNotifications();
  let release, writes = 0;
  view.context.requestAPI = async (route, options) => {
    writes += 1;
    await new Promise(resolve => { release = resolve; });
    return view.originalRequest(route, options);
  };
  const first = view.context.markNotificationRead(6);
  const second = view.context.markNotificationRead(6);
  assert.equal(view.node('notifications-list').children[0].querySelector('button').disabled, true);
  assert.equal(writes, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(view.node('notification-count').textContent, '5');
});

test('la API demo rechaza consultar o marcar avisos ajenos sin modificar registros', async () => {
  const view = fixture();
  await view.context.loadNotifications();
  const before = view.records();
  assert.throws(() => view.context.simulateLocalStorageAPI('notificaciones/2'), /tus notificaciones/);
  assert.throws(() => view.context.simulateLocalStorageAPI('notificaciones/leer/99', { method: 'PUT' }), /No se encontró/);
  await view.context.markNotificationRead(99);
  assert.deepEqual(view.records(), before);
  assert.equal(view.writes.length, 0);
});

test('la API demo exige sesión e identificadores enteros positivos', () => {
  const view = fixture();
  const before = view.records();
  for (const id of ['0', '-1', '1.5', '1x', 'NaN']) {
    assert.throws(() => view.context.simulateLocalStorageAPI(`notificaciones/${id}`), /no válido/);
    assert.throws(() => view.context.simulateLocalStorageAPI(`notificaciones/leer/${id}`, { method: 'PUT' }), /no válida/);
  }
  view.user(null);
  assert.throws(() => view.context.simulateLocalStorageAPI('notificaciones/1'), /iniciar sesión/);
  assert.throws(() => view.context.simulateLocalStorageAPI('notificaciones/leer/1', { method: 'PUT' }), /iniciar sesión/);
  assert.deepEqual(view.records(), before);
});

test('mensajes con HTML se escapan y las fechas inválidas tienen texto legible', async () => {
  const view = fixture();
  view.context.data.setLS('gt_notificaciones', [{ id_notificacion: 1, id_usuario: 1, leido: false, mensaje: '<img src=x onerror="alert(1)"> & café', fecha_envio: 'fecha incorrecta' }]);
  await view.context.loadNotifications();
  assert.match(view.contents(), /&lt;img/);
  assert.match(view.contents(), /&amp; café/);
  assert.match(view.contents(), /Fecha no disponible/);
  assert.ok(!view.contents().includes('<img'));
});

test('una respuesta anterior no reemplaza la actualización más reciente', async () => {
  const view = fixture();
  const pending = [];
  view.context.requestAPI = async () => new Promise(resolve => pending.push(resolve));
  const first = view.context.loadNotifications();
  const second = view.context.loadNotifications();
  pending[1]([{ id_notificacion: 2, id_usuario: 1, leido: false, mensaje: 'Aviso reciente', fecha_envio: '2026-10-29 10:00:00' }]);
  await second;
  pending[0]([{ id_notificacion: 1, id_usuario: 1, leido: false, mensaje: 'Aviso viejo', fecha_envio: '2026-10-28 10:00:00' }]);
  await first;
  assert.match(view.contents(), /Aviso reciente/);
  assert.ok(!view.contents().includes('Aviso viejo'));
});

test('cambiar de usuario descarta la respuesta previa y filtra avisos ajenos incluso si la API los devuelve', async () => {
  const view = fixture();
  const pending = [];
  view.context.requestAPI = async () => new Promise(resolve => pending.push(resolve));
  const first = view.context.loadNotifications();
  view.user(2);
  const second = view.context.loadNotifications();
  pending[1]([
    { id_notificacion: 99, id_usuario: 2, leido: false, mensaje: 'Solo usuario dos', fecha_envio: '2026-10-29 10:00:00' },
    { id_notificacion: 1, id_usuario: 1, leido: false, mensaje: 'Privado usuario uno', fecha_envio: '2026-10-29 10:00:00' }
  ]);
  await second;
  pending[0]([{ id_notificacion: 1, id_usuario: 1, leido: false, mensaje: 'Privado usuario uno', fecha_envio: '2026-10-29 10:00:00' }]);
  await first;
  assert.match(view.contents(), /Solo usuario dos/);
  assert.ok(!view.contents().includes('usuario uno'));
  assert.equal(view.node('notification-count').textContent, '1');
});

test('pulsar dentro del panel conserva su apertura y pulsar fuera lo cierra', async () => {
  const view = fixture();
  view.context.setupEventHandlers();
  view.node('notification-panel').classList.add('active');
  let stopped = false;
  view.node('notification-panel').dispatch('click', { stopPropagation() { stopped = true; } });
  if (!stopped) view.documentEvents.get('click')();
  assert.equal(stopped, true);
  assert.equal(view.node('notification-panel').classList.contains('active'), true);
  view.documentEvents.get('click')();
  assert.equal(view.node('notification-panel').classList.contains('active'), false);
  assert.equal(view.node('bell-btn')['aria-expanded'], 'false');
});

test('cerrar sesión limpia avisos y una respuesta pendiente no los vuelve a mostrar', async () => {
  const view = fixture();
  view.context.setupEventHandlers();
  await view.context.loadNotifications();
  view.node('notification-panel').classList.add('active');
  let release;
  view.context.requestAPI = async () => new Promise(resolve => { release = resolve; });
  const loading = view.context.loadNotifications();
  await view.node('btn-logout').dispatch('click');
  assert.equal(view.node('notification-count').textContent, '0');
  assert.equal(view.node('notification-count').style.display, 'none');
  assert.equal(view.node('notification-filter').value, 'pendientes');
  assert.equal(view.node('notification-panel').classList.contains('active'), false);
  release([{ id_notificacion: 1, id_usuario: 1, leido: false, mensaje: 'No debe reaparecer', fecha_envio: '2026-10-29 10:00:00' }]);
  await loading;
  assert.equal(view.contents(), '');
  assert.equal(view.node('notification-page').textContent, '1 / 1');
});

test('una consulta iniciada antes de marcar no puede devolver el aviso a pendientes', async () => {
  const view = fixture();
  await view.context.loadNotifications();
  const stale = view.records().filter(record => record.id_usuario === 1);
  let release;
  view.context.requestAPI = async (route, options = {}) => options.method === 'PUT'
    ? view.originalRequest(route, options)
    : new Promise(resolve => { release = resolve; });
  const loading = view.context.loadNotifications();
  await view.context.markNotificationRead(6);
  release(stale);
  await loading;
  assert.equal(view.node('notification-count').textContent, '5');
  assert.ok(!view.contents().includes('Aviso 6'));
  assert.equal(view.records().find(record => record.id_notificacion === 6).leido, true);
});

test('fechas MySQL de Bogotá e ISO se ordenan por el instante y las inválidas quedan al final', async () => {
  const view = fixture();
  view.context.data.setLS('gt_notificaciones', [
    { id_notificacion: 1, id_usuario: 1, leido: false, mensaje: 'Diez en Bogotá', fecha_envio: '2026-10-29 10:00:00' },
    { id_notificacion: 2, id_usuario: 1, leido: false, mensaje: 'Nueve y media en Bogotá', fecha_envio: '2026-10-29T14:30:00.000Z' },
    { id_notificacion: 3, id_usuario: 1, leido: false, mensaje: 'Once en Bogotá', fecha_envio: '2026-10-29T16:00:00.000Z' },
    { id_notificacion: 4, id_usuario: 1, leido: false, mensaje: 'Sin fecha válida', fecha_envio: 'error' }
  ]);
  await view.context.loadNotifications();
  const rows = view.node('notifications-list').children;
  assert.match(rows[0].innerHTML, /Once en Bogotá/);
  assert.match(rows[1].innerHTML, /Diez en Bogotá/);
  assert.match(rows[2].innerHTML, /Nueve y media en Bogotá/);
  assert.match(rows[3].innerHTML, /Fecha no disponible/);
  assert.equal(view.context.notificationDate('2026-10-29 10:00:00'), view.context.notificationDate('2026-10-29T15:00:00.000Z'));
});
