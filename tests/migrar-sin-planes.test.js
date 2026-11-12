'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {migrate} = require('../scripts/migrar-sin-planes');

function fixture({legacy = true, badPayments = [], database = 'gastronomia_turistica_academica', engine = '10.4-MariaDB'} = {}) {
  const events = [];
  let restaurantPlan = legacy, paymentPlan = legacy, planTable = legacy, nullable = legacy ? 'YES' : 'NO', legacyCount = legacy ? 7 : 0;
  const rows = {restaurantes: [{id_restaurante: 1, nombre: 'Propio', id_plan: 2}], pagos: [{id_pago: 1, id_pedido: 4, id_plan: null}, {id_pago: 2, id_pedido: null, id_plan: 2}], planes_suscripcion: [{id_plan: 2, costo: '120000.00'}]};
  const connection = {async query(sql) {
    events.push(sql);
    if (sql.startsWith('SELECT DATABASE()')) return [[{database_name: database, engine_version: engine}]];
    if (sql.includes('information_schema.COLUMNS')) return [[
      {table_name: 'pagos', column_name: 'id_pedido', nullable, column_type: 'int(11)'},
      {table_name: 'restaurantes', column_name: 'id_restaurante', nullable: 'NO'},
      ...(paymentPlan ? [{table_name: 'pagos', column_name: 'id_plan'}] : []),
      ...(restaurantPlan ? [{table_name: 'restaurantes', column_name: 'id_plan'}] : []),
      ...(planTable ? [{table_name: 'planes_suscripcion', column_name: 'id_plan'}] : [])]];
    if (sql.startsWith('SELECT p.id_pago')) return [badPayments];
    if (sql.startsWith('SELECT COUNT(*)')) return [[{total: legacyCount}]];
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [paymentPlan ? [
      {table_name: 'pagos', constraint_name: 'pagos_ibfk_4', column_name: 'id_plan', referenced_table: 'planes_suscripcion'},
      {table_name: 'restaurantes', constraint_name: 'restaurantes_ibfk_3', column_name: 'id_plan', referenced_table: 'planes_suscripcion'}] : []];
    if (sql.includes('information_schema.TABLE_CONSTRAINTS')) return [paymentPlan ? [{constraint_name: 'chk_pago_concepto', clause_text: 'id_plan IS NULL OR id_pedido IS NULL'}] : []];
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{'Create Table': 'CREATE TABLE respaldo (...)'}]];
    if (sql.startsWith('SELECT * FROM')) return [rows[sql.match(/`(\w+)`/)[1]]];
    if (sql.startsWith('DELETE FROM pagos')) legacyCount = 0;
    if (sql.includes('DROP COLUMN id_plan')) { if (sql.includes('`pagos`')) paymentPlan = false; else restaurantPlan = false; }
    if (sql.startsWith('ALTER TABLE pagos MODIFY')) nullable = 'NO';
    if (sql === 'DROP TABLE planes_suscripcion') planTable = false;
    if (/^(?:ALTER|DELETE|DROP)\b/.test(sql)) return [{affectedRows: 1}];
    throw new Error('Consulta inesperada: ' + sql);
  }};
  return {connection, events};
}
const mutations = events => events.filter(sql => /^(?:ALTER|DELETE|DROP|CREATE|INSERT)\b/.test(sql));

test('inspección predeterminada informa pagos antiguos sin cambiar datos', async () => {
  const view = fixture();
  const result = await migrate(view.connection);
  assert.equal(result.pagos_de_planes_a_archivar, 7);
  assert.equal(result.aplicado, false);
  assert.equal(result.pendiente, true);
  assert.deepEqual(mutations(view.events), []);
});

test('otra base o pagos ambiguos impiden aplicar cualquier cambio', async () => {
  for (const options of [{database: 'otra_base'}, {badPayments: [{id_pago: 1}]}]) {
    const view = fixture(options);
    await assert.rejects(migrate(view.connection, {apply: true}));
    assert.deepEqual(mutations(view.events), []);
  }
});

test('sin respaldo válido no se ejecuta ningún cambio de estructura ni borrado', async () => {
  const view = fixture();
  await assert.rejects(migrate(view.connection, {apply: true, writeBackup: () => {throw new Error('Sin espacio para respaldo');}}), /respaldo/);
  assert.deepEqual(mutations(view.events), []);
});

for (const engine of ['10.4-MariaDB', '8.0.40']) test(`migración de ${engine} respalda antes de aplicar y deja Pago-Pedido obligatorio`, async () => {
  const view = fixture({engine});
  const result = await migrate(view.connection, {apply: true, writeBackup: (_directory, backup) => {
    assert.deepEqual(mutations(view.events), []);
    assert.equal(backup.tables.pagos.rows[1].id_plan, 2);
    assert.ok(backup.tables.restaurantes.ddl);
    assert.ok(backup.tables.planes_suscripcion.rows.length);
    view.events.push('RESPALDO_VERIFICADO');
    return 'respaldo-local.json';
  }});
  assert.equal(result.aplicado, true);
  assert.equal(result.pendiente, false);
  assert.ok(view.events.indexOf('RESPALDO_VERIFICADO') < view.events.findIndex(sql => sql.startsWith('ALTER')));
  assert.ok(view.events.includes('DELETE FROM pagos WHERE id_pedido IS NULL AND id_plan IS NOT NULL'));
  assert.equal(view.events.some(sql => /^DELETE FROM (?:pedidos|reservas|usuarios)/.test(sql)), false);
  assert.ok(view.events.includes('ALTER TABLE pagos MODIFY id_pedido int(11) NOT NULL'));
  assert.ok(view.events.some(sql => sql.includes(/MariaDB/.test(engine) ? 'DROP CONSTRAINT' : 'DROP CHECK')));
});

test('ejecutar de nuevo sobre el esquema actual no modifica datos', async () => {
  const view = fixture({legacy: false});
  const result = await migrate(view.connection, {apply: true});
  assert.equal(result.pendiente, false);
  assert.equal(result.aplicado, false);
  assert.deepEqual(mutations(view.events), []);
});
