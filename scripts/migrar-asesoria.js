'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { catalogos } = require('../lib/catalogos');

const changes = [
  ['zonas', 'ciudad', 'id_municipio', 'municipios', 'nombre_municipio', 'fk_zonas_municipio'],
  ['pedidos', 'tipo_servicio', 'id_tipo_servicio', 'tipos_servicio', 'codigo', 'fk_pedidos_tipo_servicio'],
  ['pedidos', 'estado_pedido', 'id_estado_pedido', 'estados_pedido', 'codigo', 'fk_pedidos_estado'],
  ['reservas', 'estado_reserva', 'id_estado_reserva', 'estados_reserva', 'codigo', 'fk_reservas_estado']
];
const quote = mysql.escapeId;

async function columns(connection) {
  const [rows] = await connection.query(`SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, IS_NULLABLE AS nullable
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`);
  return new Map(rows.map(row => [`${row.tabla}.${row.columna}`, row.nullable]));
}

async function replaceColumn(connection, [table, old, key, parent, textColumn, constraint]) {
  const schema = await columns(connection);
  if (!schema.has(`${table}.${old}`)) {
    if (schema.get(`${table}.${key}`) !== 'NO') throw new Error(`Falta verificar ${table}.${key}.`);
    return;
  }
  if (!schema.has(`${table}.${key}`)) await connection.query(`ALTER TABLE ${quote(table)} ADD COLUMN ${quote(key)} INT NULL`);
  const join = `c.${quote(textColumn)} = TRIM(t.${quote(old)})`;
  await connection.query(`UPDATE ${quote(table)} t JOIN ${quote(parent)} c ON ${join}
    SET t.${quote(key)} = c.${quote(key)} WHERE t.${quote(key)} IS NULL`);
  const [[check]] = await connection.query(`SELECT COUNT(*) AS n FROM ${quote(table)} t LEFT JOIN ${quote(parent)} c ON ${join}
    WHERE c.${quote(key)} IS NULL OR t.${quote(key)} IS NULL OR t.${quote(key)} <> c.${quote(key)}`);
  if (Number(check.n)) throw new Error(`${table}.${old} tiene ${check.n} valores sin una correspondencia válida.`);
  const [fk] = await connection.query(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME=?`, [table, key, parent]);
  if (schema.get(`${table}.${key}`) !== 'NO') await connection.query(`ALTER TABLE ${quote(table)} MODIFY ${quote(key)} INT NOT NULL`);
  if (!fk.length) await connection.query(`ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(constraint)}
    FOREIGN KEY (${quote(key)}) REFERENCES ${quote(parent)}(${quote(key)}) ON UPDATE CASCADE ON DELETE RESTRICT`);
  await connection.query(`ALTER TABLE ${quote(table)} DROP COLUMN ${quote(old)}`);
}

async function migrate(connection, { apply = false, expectedDatabase = 'gastronomia_turistica_academica' } = {}) {
  const [[server]] = await connection.query('SELECT DATABASE() AS name');
  if (server.name !== expectedDatabase || !/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(server.name)) {
    throw new Error('Selecciona la base académica o una copia de revisión identificada.');
  }
  const initial = await columns(connection);
  if (!initial.has('reservas.id_reserva') || !initial.has('zonas.id_zona') || initial.has('pagos.id_plan')) {
    throw new Error('Se necesita el esquema académico con la migración sin planes aplicada.');
  }
  const pending = changes.some(([table, old]) => initial.has(`${table}.${old}`)) || initial.has('reservas.id_mesa') || !initial.has('reserva_mesas.id_mesa') || !initial.has('pagos.referencia');
  const result = { base: server.name, pendiente: pending, aplicado: false };
  if (!apply || !pending) return result;

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  const newTables = ['municipios', ...Object.keys(catalogos), 'reserva_mesas'];
  for (const table of newTables) {
    const statement = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\) ENGINE=InnoDB;`));
    if (!statement) throw new Error(`Falta la definición de ${table} en schema.sql.`);
    await connection.query(statement[0]);
  }
  for (const [table, entries] of Object.entries(catalogos)) {
    await connection.query(`INSERT INTO ${quote(table)} (codigo, nombre) VALUES ? ON DUPLICATE KEY UPDATE nombre=VALUES(nombre)`, [entries.map(row => [row.codigo, row.nombre])]);
  }
  if (initial.has('zonas.ciudad')) {
    const [[missing]] = await connection.query("SELECT COUNT(*) AS n FROM zonas WHERE ciudad IS NULL OR TRIM(ciudad) = ''");
    if (Number(missing.n)) throw new Error('Hay zonas sin municipio. Revisa sus datos antes de migrar.');
    await connection.query(`INSERT INTO municipios (nombre_municipio)
      SELECT DISTINCT TRIM(ciudad) FROM zonas ORDER BY TRIM(ciudad)
      ON DUPLICATE KEY UPDATE nombre_municipio=VALUES(nombre_municipio)`);
  }
  for (const change of changes) await replaceColumn(connection, change);

  if (initial.has('reservas.id_mesa')) {
    await connection.query(`INSERT INTO reserva_mesas (id_reserva,id_mesa)
      SELECT id_reserva,id_mesa FROM reservas ON DUPLICATE KEY UPDATE id_mesa=VALUES(id_mesa)`);
    const [[missing]] = await connection.query(`SELECT COUNT(*) AS n FROM reservas r
      LEFT JOIN reserva_mesas rm ON rm.id_reserva=r.id_reserva AND rm.id_mesa=r.id_mesa WHERE rm.id_reserva IS NULL`);
    if (Number(missing.n)) throw new Error('Hay asignaciones de mesa por migrar.');
    const [constraints] = await connection.query(`SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reservas' AND COLUMN_NAME='id_mesa' AND REFERENCED_TABLE_NAME IS NOT NULL`);
    for (const { name } of constraints) await connection.query(`ALTER TABLE reservas DROP FOREIGN KEY ${quote(name)}`);
    await connection.query('ALTER TABLE reservas DROP COLUMN id_mesa');
  }
  const [index] = await connection.query("SHOW INDEX FROM reservas WHERE Key_name='ix_reservas_horario'");
  if (!index.length) await connection.query('CREATE INDEX ix_reservas_horario ON reservas(fecha_reserva,hora_reserva,id_estado_reserva)');
  if (!initial.has('pagos.referencia')) await connection.query('ALTER TABLE pagos ADD COLUMN referencia CHAR(36) NULL, ADD UNIQUE KEY uq_pago_referencia (id_pedido,referencia)');
  return { ...result, pendiente: false, aplicado: true };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const expectedDatabase = process.env.DB_NAME || 'gastronomia_turistica_academica';
  const connection = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: expectedDatabase });
  try {
    console.log(JSON.stringify(await migrate(connection, { apply: process.argv.includes('--aplicar'), expectedDatabase }), null, 2));
  } finally { await connection.end(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrate };
