'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const quote = value => { if (!/^\w+$/.test(value)) throw new Error('Identificador inesperado.'); return '`' + value + '`'; };

async function normalizePayments(c, { apply = false, expectedDatabase, backupDirectory } = {}) {
  const [[base]] = await c.query('SELECT DATABASE() AS nombre');
  if (base.nombre !== expectedDatabase || !/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(base.nombre)) throw new Error('Selecciona explícitamente la base académica o una copia de revisión.');
  const [columns] = await c.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pagos'");
  if (!columns.some(r => r.COLUMN_NAME === 'id_pedido')) throw new Error('Falta la relación obligatoria de Pago con Pedido.');
  const redundant = columns.some(r => r.COLUMN_NAME === 'id_usuario');
  const [auxiliary] = await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='recordatorios_reserva'");
  const [invalid] = await c.query('SELECT p.id_pago FROM pagos p LEFT JOIN pedidos d ON d.id_pedido=p.id_pedido WHERE d.id_pedido IS NULL' + (redundant ? ' OR p.id_usuario IS NULL OR p.id_usuario<>d.id_usuario' : ''));
  if (invalid.length) throw new Error('Hay pagos sin pedido o con clientes distintos. No se modificó la estructura.');
  if (auxiliary.length) {
    const [[count]] = await c.query('SELECT COUNT(*) AS n FROM recordatorios_reserva');
    if (Number(count.n)) throw new Error('La tabla auxiliar tiene datos. Se conserva y requiere revisión.');
    const [incoming] = await c.query("SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='recordatorios_reserva'");
    if (incoming.length) throw new Error('La tabla auxiliar tiene dependencias entrantes. Se conserva.');
  }
  const report = { base: base.nombre, pendiente: redundant || Boolean(auxiliary.length), aplicado: false };
  if (!apply || !report.pendiente) return report;
  if (!backupDirectory) throw new Error('Falta la carpeta de respaldo.');
  const [[lock]] = await c.query("SELECT GET_LOCK('gastroturismo:normalizar-pagos',2) AS adquirido");
  if (Number(lock.adquirido) !== 1) throw new Error('Otra normalización está en curso.');
  try {
    const [tables] = await c.query('SHOW TABLES');
    const snapshot = { base: base.nombre, fecha: new Date().toISOString(), tablas: {} };
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    try {
      for (const entry of tables) {
        const table = Object.values(entry)[0];
        const [ddl] = await c.query('SHOW CREATE TABLE ' + quote(table));
        const [rows] = await c.query('SELECT * FROM ' + quote(table));
        snapshot.tablas[table] = { ddl: ddl[0]['Create Table'], filas: rows };
      }
      await c.commit();
    } catch (error) { await c.rollback(); throw error; }
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backup = path.join(backupDirectory, `antes-normalizar-pagos-${base.nombre}-${Date.now()}.json`);
    const content = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(backup, content, { flag: 'wx' });
    const hash = value => crypto.createHash('sha256').update(value).digest('hex');
    if (hash(fs.readFileSync(backup)) !== hash(content)) throw new Error('No se verificó el respaldo.');
    if (redundant) {
      const [incoming] = await c.query("SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='pagos' AND REFERENCED_COLUMN_NAME='id_usuario'");
      if (incoming.length) throw new Error('Hay referencias entrantes al usuario duplicado. Se conserva la columna.');
      const [keys] = await c.query("SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pagos' AND COLUMN_NAME='id_usuario' AND REFERENCED_TABLE_NAME IS NOT NULL");
      const alterations = keys.map(r => 'DROP FOREIGN KEY ' + quote(r.CONSTRAINT_NAME));
      alterations.push('DROP COLUMN id_usuario');
      await c.query('ALTER TABLE pagos ' + alterations.join(', '));
    }
    if (auxiliary.length) await c.query('DROP TABLE recordatorios_reserva');
    let checked = 0;
    for (const [table, data] of Object.entries(snapshot.tablas)) {
      if (table === 'recordatorios_reserva') continue;
      const [after] = await c.query('SELECT * FROM ' + quote(table));
      const beforeRows = data.filas.map(row => {
        const copy = { ...row }; if (table === 'pagos') delete copy.id_usuario; return JSON.stringify(copy);
      }).sort();
      if (JSON.stringify(beforeRows) !== JSON.stringify(after.map(row => JSON.stringify(row)).sort())) throw new Error('Cambió un dato distinto del campo redundante en ' + table + '. Conserva el respaldo y revisa.');
      checked++;
    }
    return { ...report, pendiente: false, aplicado: true, respaldo: backup, tablas_con_datos_conservados: checked,
      pagos_conservados: snapshot.tablas.pagos.filas.length, auxiliar_vacia_retirada: Boolean(auxiliary.length) };
  } finally { await c.query("SELECT RELEASE_LOCK('gastroturismo:normalizar-pagos')"); }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  (async () => {
    if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Utiliza la base académica local.');
    const c = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME, dateStrings: true, timezone: '-05:00' });
    try { await c.query("SET time_zone='-05:00'"); console.log(JSON.stringify(await normalizePayments(c, { apply: process.argv.includes('--aplicar'),
      expectedDatabase: process.env.DB_NAME, backupDirectory: path.join(__dirname, '../backups/normalizacion-pagos') }), null, 2)); }
    finally { await c.end(); }
  })().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
}
module.exports = { normalizePayments };
