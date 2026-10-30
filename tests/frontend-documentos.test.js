'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const plain = value => JSON.parse(JSON.stringify(value));
const response = data => ({ ok: true, status: 200, json: async () => data });

function reserva(overrides = {}) {
  return {
    id_reserva: 701, id_usuario: 21, id_mesa: 31, id_restaurante: 41,
    nombre_usuario: 'Cliente API', correo_usuario: 'cliente@example.test',
    nombre_restaurante: 'Restaurante API', numero_mesa: 'Mesa 4', ubicacion_mesa: 'Terraza',
    fecha_reserva: '2026-11-03', hora_reserva: '18:30:00', cantidad_personas: 3,
    estado_reserva: 'confirmada', ...overrides
  };
}

function pedido(overrides = {}) {
  return {
    id_pedido: 801, id_usuario: 21, id_restaurante: 41,
    nombre_usuario: 'Cliente API', nombre_restaurante: 'Restaurante API',
    fecha_pedido: '2026-11-03 18:30:00', tipo_servicio: 'domicilio',
    direccion_entrega: 'Calle 12 # 3-45', total_pago: '24000.50',
    detalles: [{ id_plato: 51, nombre_plato: 'Plato API', cantidad: '2', precio_unitario: '12000.25' }],
    ...overrides
  };
}

function node(value = '') {
  let html = '', text = '';
  return {
    value, disabled: false, style: {}, children: [], onclick: null,
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); text = html.replace(/<[^>]*>/g, ''); },
    get textContent() { return text; },
    set textContent(value) { text = String(value); html = text; },
    appendChild(child) { this.children.push(child); }
  };
}

function loadFrontend({ records = {}, missingPDF = false, missingTable = false } = {}) {
  const storage = new Map(), documents = [], messages = [], calls = [];
  const nodes = {
    'doc-reserva-select': node('701'), 'doc-pedido-select': node('801'),
    'preview-doc-container': node(), 'preview-canvas-content': node(),
    'btn-download-preview-pdf': node()
  };
  nodes['btn-download-preview-pdf'].disabled = true;
  let fetchResponse = async route => {
    assert.ok(Object.hasOwn(records, route), 'Petición inesperada: ' + route);
    return response(records[route]);
  };
  class PDF {
    constructor() {
      this.texts = [];
      this.tables = [];
      this.saved = [];
      this.pagesAdded = 0;
      if (missingTable) this.autoTable = undefined;
      documents.push(this);
    }
    setFillColor() { return this; }
    rect() { return this; }
    setTextColor() { return this; }
    setFontSize() { return this; }
    setFont() { return this; }
    text(value) { this.texts.push(plain(value)); return this; }
    autoTable(options) {
      this.tables.push(plain(options));
      this.lastAutoTable = { finalY: 120 };
      return this;
    }
    splitTextToSize(value) { return [value]; }
    addPage() { this.pagesAdded += 1; return this; }
    save(filename) { this.saved.push(filename); }
  }
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Intl, Date, URLSearchParams,
    window: missingPDF ? {} : { jspdf: { jsPDF: PDF } },
    document: { addEventListener() {}, getElementById: id => nodes[id], createElement: () => node() },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetchResponse(url.replace(/^\/api\//, ''));
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') +
    '\nisConnectedToDB = true; globalThis.frontend = {generateDocumentPDF, downloadActivePreviewPDF, loadDocumentosSection, setLS};', context);
  context.showToast = (message, type) => messages.push({ message, type });
  return {
    context, nodes, documents, messages, calls, api: context.frontend,
    respondWith(handler) { fetchResponse = handler; },
    get html() { return nodes['preview-canvas-content'].innerHTML; },
    get downloadDisabled() { return nodes['btn-download-preview-pdf'].disabled; }
  };
}

function seedConflictingDemo(view) {
  view.api.setLS('gt_usuarios', [{ id_usuario: 21, nombre: 'Cliente DEMO', correo: 'demo@example.test' }]);
  view.api.setLS('gt_restaurantes', [{ id_restaurante: 41, nombre: 'Restaurante DEMO' }]);
  view.api.setLS('gt_mesas', [{ id_mesa: 31, id_restaurante: 41, numero_mesa: 'Mesa DEMO', ubicacion: 'Salón DEMO' }]);
  view.api.setLS('gt_reservas', [reserva({ nombre_usuario: 'Cliente DEMO' })]);
  view.api.setLS('gt_pedidos', [pedido({ detalles: [{ nombre_plato: 'Plato DEMO', cantidad: 1, precio_unitario: 1 }], total_pago: 1 })]);
}

function pdfContent(doc) {
  return JSON.stringify({ texts: doc.texts, tables: doc.tables });
}

for (const type of ['reserva', 'pedido']) {
  test(`${type}: el PDF usa los datos de API mostrados aunque el demo contenga otros`, async () => {
    const record = type === 'reserva' ? reserva() : pedido();
    const route = type === 'reserva' ? 'reservas' : 'pedidos';
    const view = loadFrontend({ records: { [route]: [record] } });
    seedConflictingDemo(view);
    await view.api.generateDocumentPDF(type);
    assert.equal(view.downloadDisabled, false);
    assert.match(view.html, /Cliente API/);
    assert.match(view.html, /Restaurante API/);
    view.api.downloadActivePreviewPDF();
    assert.equal(view.documents.length, 1);
    const doc = view.documents[0];
    assert.match(pdfContent(doc), /Cliente API/);
    assert.match(pdfContent(doc), /Restaurante API/);
    assert.doesNotMatch(pdfContent(doc), /DEMO/);
    assert.deepEqual(doc.saved, [type === 'reserva' ? 'Comprobante_Reserva_701.pdf' : 'Factura_Pedido_801.pdf']);
    assert.deepEqual(view.calls.map(call => call.url), ['/api/' + route]);
    assert.equal(view.messages.at(-1).type, 'success');
  });
}

test('cambiar el selector después de previsualizar conserva el documento que se muestra', async () => {
  const view = loadFrontend({ records: { pedidos: [pedido(), pedido({ id_pedido: 802, nombre_usuario: 'Otro cliente' })] } });
  await view.api.generateDocumentPDF('pedido');
  view.nodes['doc-pedido-select'].value = '802';
  view.nodes['doc-reserva-select'].value = '999';
  view.api.downloadActivePreviewPDF();
  assert.match(pdfContent(view.documents[0]), /Cliente API/);
  assert.doesNotMatch(pdfContent(view.documents[0]), /Otro cliente/);
  assert.deepEqual(view.documents[0].saved, ['Factura_Pedido_801.pdf']);
  assert.equal(view.calls.length, 1);
});

test('la descarga conserva una copia profunda si el objeto API cambia después', async () => {
  const original = pedido();
  const view = loadFrontend({ records: { pedidos: [original] } });
  await view.api.generateDocumentPDF('pedido');
  original.nombre_usuario = 'Cliente modificado';
  original.nombre_restaurante = 'Restaurante modificado';
  original.total_pago = '1.00';
  original.detalles[0].nombre_plato = 'Plato modificado';
  original.detalles[0].precio_unitario = '0.50';
  view.api.downloadActivePreviewPDF();
  assert.match(pdfContent(view.documents[0]), /Cliente API/);
  assert.match(pdfContent(view.documents[0]), /Plato API/);
  assert.doesNotMatch(pdfContent(view.documents[0]), /modificado/);
  assert.match(pdfContent(view.documents[0]), /24\.000,5/);
});

for (const failure of ['selección vacía', 'error API', 'registro eliminado']) {
  test(`una nueva ${failure} invalida la descarga anterior`, async () => {
    const view = loadFrontend({ records: { reservas: [reserva()] } });
    await view.api.generateDocumentPDF('reserva');
    assert.equal(view.downloadDisabled, false);
    if (failure === 'selección vacía') view.nodes['doc-reserva-select'].value = '';
    if (failure === 'error API') {
      view.respondWith(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Error API de prueba' }) }));
    }
    if (failure === 'registro eliminado') view.respondWith(async () => response([]));
    await view.api.generateDocumentPDF('reserva');
    assert.equal(view.downloadDisabled, true);
    assert.match(view.html, failure === 'selección vacía' ? /Selecciona una reserva/ : failure === 'error API' ? /Error API de prueba/ : /ya no está disponible/);
    view.api.downloadActivePreviewPDF();
    assert.equal(view.documents.length, 0);
  });
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

test('respuestas invertidas conservan la vista más reciente y bloquean descarga durante carga', async () => {
  const view = loadFrontend();
  const first = deferred(), second = deferred();
  let requests = 0;
  view.respondWith(() => (++requests === 1 ? first.promise : second.promise));
  const firstPreview = view.api.generateDocumentPDF('reserva');
  assert.equal(view.downloadDisabled, true);
  view.api.downloadActivePreviewPDF();
  assert.equal(view.documents.length, 0);
  view.nodes['doc-reserva-select'].value = '702';
  const secondPreview = view.api.generateDocumentPDF('reserva');
  second.resolve(response([reserva({ id_reserva: 702, nombre_usuario: 'Cliente reciente' })]));
  await secondPreview;
  assert.equal(view.downloadDisabled, false);
  first.resolve(response([reserva({ nombre_usuario: 'Cliente anterior' })]));
  await firstPreview;
  assert.match(view.html, /Cliente reciente/);
  assert.doesNotMatch(view.html, /Cliente anterior/);
  view.api.downloadActivePreviewPDF();
  assert.deepEqual(view.documents[0].saved, ['Comprobante_Reserva_702.pdf']);
  assert.match(pdfContent(view.documents[0]), /Cliente reciente/);
});

test('un error de una petición anterior no invalida la vista más reciente', async () => {
  const view = loadFrontend();
  const first = deferred();
  let requests = 0;
  view.respondWith(() => ++requests === 1 ? first.promise : response([reserva({ id_reserva: 702, nombre_usuario: 'Cliente reciente' })]));
  const firstPreview = view.api.generateDocumentPDF('reserva');
  view.nodes['doc-reserva-select'].value = '702';
  await view.api.generateDocumentPDF('reserva');
  first.reject(new Error('Fallo anterior'));
  await firstPreview;
  assert.match(view.html, /Cliente reciente/);
  assert.equal(view.downloadDisabled, false);
  view.api.downloadActivePreviewPDF();
  assert.deepEqual(view.documents[0].saved, ['Comprobante_Reserva_702.pdf']);
});

test('los DECIMAL y cantidades en texto producen los mismos importes en vista y PDF', async () => {
  const view = loadFrontend({ records: { pedidos: [pedido()] } });
  await view.api.generateDocumentPDF('pedido');
  assert.match(view.html, /Plato API x2/);
  assert.match(view.html, /Total registrado: \$24\.000,5 COP/);
  view.api.downloadActivePreviewPDF();
  const doc = view.documents[0];
  assert.deepEqual(doc.tables[0].body, [['Plato API', 2, '$12.000,25 COP', '$24.000,5 COP']]);
  assert.ok(doc.texts.includes('TOTAL REGISTRADO: $24.000,5 COP'));
  assert.doesNotMatch(pdfContent(doc), /NaN|undefined/);
});

for (const missing of ['jsPDF', 'autoTable']) {
  test(`si falta ${missing} se muestra un error controlado y no se guarda PDF`, async () => {
    const view = loadFrontend({ records: { reservas: [reserva()] }, missingPDF: missing === 'jsPDF', missingTable: missing === 'autoTable' });
    await view.api.generateDocumentPDF('reserva');
    assert.equal(view.downloadDisabled, false);
    assert.doesNotThrow(() => view.api.downloadActivePreviewPDF());
    assert.equal(view.documents.flatMap(doc => doc.saved).length, 0);
    assert.match(view.messages.at(-1).message, /herramienta.*PDF/);
    assert.ok(['warning', 'danger'].includes(view.messages.at(-1).type));
    assert.equal(view.messages.some(message => message.type === 'success'), false);
  });
}
