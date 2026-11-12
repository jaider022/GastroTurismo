'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const [route, render, state] of [
  ['reservas', 'renderReservas', 'reservasList'],
  ['pedidos', 'renderPedidosHistorial', 'pedidosList']
]) {
  test(`propietario consulta ${route} de sus restaurantes en MySQL sin depender de la semilla del navegador`, async () => {
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', replaceChildren() {}, add() {} });
      return elements.get(id);
    };
    const context = vm.createContext({
      console: { log() {}, error() {} }, Date, Intl, URLSearchParams,
      window: {}, document: { addEventListener() {}, getElementById: element },
      localStorage: { getItem: () => null },
      Option: function(text, value) { this.text = text; this.value = value; }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'), context);
    vm.runInContext("currentUser={id_usuario:70,tipo_usuario:'restaurante'};isConnectedToDB=true;", context);
    context.renderReservasPage = context.renderPedidosPage = () => {};
    context.requestAPI = async endpoint => {
      if (endpoint === 'restaurantes') return [
        { id_restaurante: 900, id_propietario: 70 },
        { id_restaurante: 901, id_propietario: 71 }
      ];
      assert.equal(endpoint, route);
      return [{ id_restaurante: 900, id_usuario: 80 }, { id_restaurante: 901, id_usuario: 81 }];
    };
    await context[render]();
    const rows = JSON.parse(JSON.stringify(vm.runInContext(state, context)));
    assert.deepEqual(rows, [{ id_restaurante: 900, id_usuario: 80 }]);
  });
}
