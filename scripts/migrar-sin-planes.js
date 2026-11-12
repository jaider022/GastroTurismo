'use strict';

// Solo inspecciona por defecto. --aplicar requiere detener primero la aplicación.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const quote = name => {
  if (!/^[A-Za-z0-9_$]+$/.test(name)) throw new Error('Identificador de esquema inesperado.');
  return '`' + name + '`';
};

async function inspect(connection, { expectedDatabase = 'gastronomia_turistica_academica' } = {}) {
  const [[info]] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS engine_version');
  if (!/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(expectedDatabase) || info.database_name !== expectedDatabase) throw new Error('Solo se admite la base académica seleccionada o una copia de revisión identificada explícitamente.');
  const [columns] = await connection.query(`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
    IS_NULLABLE AS nullable, COLUMN_TYPE AS column_type FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('pagos', 'restaurantes', 'planes_suscripcion', 'suscripciones')`);
  const has = (table, column) => columns.some(c => c.table_name === table && c.column_name === column);
  if (!has('pagos', 'id_pedido') || !has('restaurantes', 'id_restaurante')) throw new Error('No se encontró el esquema académico esperado.');
  const legacyColumn = has('pagos', 'id_plan');
  const [invalid] = await connection.query(`SELECT p.id_pago FROM pagos p LEFT JOIN pedidos d ON d.id_pedido = p.id_pedido
    WHERE (p.id_pedido IS NULL ${legacyColumn ? 'AND p.id_plan IS NULL' : ''})
       OR (p.id_pedido IS NOT NULL AND (d.id_pedido IS NULL OR p.id_usuario <> d.id_usuario ${legacyColumn ? 'OR p.id_plan IS NOT NULL' : ''}))`);
  if (invalid.length) throw new Error(`Hay ${invalid.length} pagos sin pedido válido o con concepto ambiguo. Revisarlos antes de migrar.`);
  const [[counts]] = await connection.query(`SELECT COUNT(*) AS total FROM pagos ${legacyColumn ? 'WHERE id_pedido IS NULL AND id_plan IS NOT NULL' : 'WHERE 1 = 0'}`);
  const [fks] = await connection.query(`SELECT TABLE_NAME AS table_name, CONSTRAINT_NAME AS constraint_name,
    COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS referenced_table FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
      AND (REFERENCED_TABLE_NAME IN ('planes_suscripcion', 'suscripciones') OR (TABLE_NAME IN ('pagos', 'restaurantes') AND COLUMN_NAME = 'id_plan'))`);
  if (fks.some(f => !['pagos', 'restaurantes', 'suscripciones'].includes(f.table_name) || f.column_name !== 'id_plan' || f.referenced_table !== 'planes_suscripcion')) throw new Error('Existen relaciones adicionales con planes; requieren revisión antes de migrar.');
  const [checks] = await connection.query(`SELECT tc.CONSTRAINT_NAME AS constraint_name, cc.CHECK_CLAUSE AS clause_text
    FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'pagos' AND tc.CONSTRAINT_TYPE = 'CHECK'`);
  return { info, columns, fks, checks: checks.filter(c => /\bid_plan\b/i.test(c.clause_text)),
    legacyPayments: Number(counts.total), has, orderColumn: columns.find(c => c.table_name === 'pagos' && c.column_name === 'id_pedido') };
}

function saveBackup(directory, backup) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `antes-sin-planes-${Date.now()}.json`);
  const contents = JSON.stringify(backup, null, 2);
  fs.writeFileSync(file, contents, { encoding: 'utf8', flag: 'wx' });
  const digest = text => createHash('sha256').update(text).digest('hex');
  if (digest(fs.readFileSync(file, 'utf8')) !== digest(contents)) throw new Error('No fue posible verificar el respaldo. No se modificará la base.');
  return file;
}

async function migrate(connection, { apply = false, backupDir = path.join(__dirname, '..', 'backups', 'sin-planes'), writeBackup = saveBackup, expectedDatabase = 'gastronomia_turistica_academica' } = {}) {
  const state = await inspect(connection, { expectedDatabase });
  const pending = state.has('pagos', 'id_plan') || state.has('restaurantes', 'id_plan') || state.has('planes_suscripcion', 'id_plan') || state.has('suscripciones', 'id_suscripcion') || state.orderColumn.nullable === 'YES';
  const result = { pendiente: pending, pagos_de_planes_a_archivar: state.legacyPayments, aplicado: false };
  if (!apply || !pending) return result;
  if (!/^(?:int|integer)(?:\(\d+\))?(?: unsigned)?$/i.test(state.orderColumn.column_type)) throw new Error('El tipo de pagos.id_pedido requiere revisión manual.');
  // Se guardan estructura y TODOS los datos de las tablas afectadas antes de alterar.
  const backup = { fecha: new Date().toISOString(), database: state.info.database_name, tables: {} };
  for (const table of ['restaurantes', 'pagos', 'planes_suscripcion', 'suscripciones']) {
    if (!state.columns.some(c => c.table_name === table)) continue;
    const [ddl] = await connection.query(`SHOW CREATE TABLE ${quote(table)}`);
    const [rows] = await connection.query(`SELECT * FROM ${quote(table)}`);
    backup.tables[table] = { ddl: ddl[0]['Create Table'], rows };
  }
  result.respaldo = await writeBackup(backupDir, backup);
  if (!result.respaldo) throw new Error('Se requiere un respaldo verificado antes de aplicar cambios.');
  if (state.has('suscripciones', 'id_suscripcion')) await connection.query('DROP TABLE suscripciones');
  for (const check of state.checks) {
    const syntax = /mariadb/i.test(state.info.engine_version) ? 'DROP CONSTRAINT' : 'DROP CHECK';
    await connection.query(`ALTER TABLE pagos ${syntax} ${quote(check.constraint_name)}`);
  }
  if (state.legacyPayments) await connection.query('DELETE FROM pagos WHERE id_pedido IS NULL AND id_plan IS NOT NULL');
  for (const fk of new Map(state.fks.map(f => [`${f.table_name}:${f.constraint_name}`, f])).values()) {
    if (fk.table_name === 'suscripciones') continue;
    await connection.query(`ALTER TABLE ${quote(fk.table_name)} DROP FOREIGN KEY ${quote(fk.constraint_name)}`);
  }
  for (const table of ['restaurantes', 'pagos']) {
    if (state.has(table, 'id_plan')) await connection.query(`ALTER TABLE ${quote(table)} DROP COLUMN id_plan`);
  }
  await connection.query(`ALTER TABLE pagos MODIFY id_pedido ${state.orderColumn.column_type} NOT NULL`);
  if (state.has('planes_suscripcion', 'id_plan')) await connection.query('DROP TABLE planes_suscripcion');
  const final = await inspect(connection, { expectedDatabase });
  if (final.has('pagos', 'id_plan') || final.has('restaurantes', 'id_plan') || final.has('planes_suscripcion', 'id_plan') || final.has('suscripciones', 'id_suscripcion') || final.orderColumn.nullable !== 'NO') throw new Error('La migración quedó parcial; conserva el respaldo y revisa el esquema antes de continuar.');
  return { ...result, aplicado: true, pendiente: false };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'gastronomia_turistica_academica',
    dateStrings: true, connectTimeout: 3000 });
  try {
    const result = await migrate(connection, { apply: process.argv.includes('--aplicar') });
    console.log(JSON.stringify(result, null, 2));
    if (result.pendiente) console.log('Solo inspección. Para aplicar: detener la aplicación, conservar un respaldo general y ejecutar con --aplicar.');
  } finally { await connection.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { inspect, migrate, saveBackup };
