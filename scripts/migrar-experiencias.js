'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
async function migrateExperiences(c, { apply = false, expectedDatabase } = {}) {
  const [[database]] = await c.query('SELECT DATABASE() AS name');
  if (database.name !== expectedDatabase || !/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(database.name)) throw new Error('Selecciona explícitamente la base académica o una copia de revisión.');
  let [columns] = await c.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
  const has = (table, col) => columns.some(r=>r.TABLE_NAME===table && r.COLUMN_NAME===col);
  if (!has('reserva_mesas','id_mesa') || has('pagos','id_plan')) throw new Error('Aplica primero las migraciones sin planes y de la asesoría.');
  const additions = { precio_unitario:'DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0)', referencia:'CHAR(36) NULL', estado_pago:"ENUM('pendiente','pagado') NOT NULL DEFAULT 'pendiente'", id_metodo:'INT NULL', fecha_pago:'DATETIME NULL', cobrado_por:'INT NULL' };
  const needsPrice = has('reservas_experiencias','id_reserva_experiencia') && !has('reservas_experiencias','precio_unitario');
  const [initialIndexes] = await c.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reservas_experiencias'");
  const [initialKeys] = await c.query("SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reservas_experiencias' AND REFERENCED_TABLE_NAME IS NOT NULL");
  const pending = !has('experiencias','id_experiencia') || Object.keys(additions).some(col=>!has('reservas_experiencias',col)) ||
    ['uq_reserva_experiencia_referencia','ix_reserva_experiencia_cupos'].some(name=>!initialIndexes.some(row=>row.INDEX_NAME===name)) ||
    ['id_metodo','cobrado_por'].some(name=>!initialKeys.some(row=>row.COLUMN_NAME===name));
  if (!apply) return { base:database.name, pendiente:pending, aplicado:false };
  const schema = fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8');
  for (const table of ['experiencias','reservas_experiencias']) {
    const sql = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\) ENGINE=InnoDB;`));
    if (!sql) throw new Error('Falta la definición de '+table);
    await c.query(sql[0]);
  }
  // CREATE TABLE puede haber creado ya todas las columnas en una instalación nueva.
  [columns] = await c.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
  for (const [col,definition] of Object.entries(additions)) if (!has('reservas_experiencias',col)) await c.query(`ALTER TABLE reservas_experiencias ADD COLUMN ${mysql.escapeId(col)} ${definition}`);
  if (needsPrice) {
    await c.query('UPDATE reservas_experiencias b JOIN experiencias e ON e.id_experiencia=b.id_experiencia SET b.precio_unitario=e.precio');
  }
  const [indexes] = await c.query('SHOW INDEX FROM reservas_experiencias');
  if (!indexes.some(r=>r.Key_name==='uq_reserva_experiencia_referencia')) await c.query('ALTER TABLE reservas_experiencias ADD UNIQUE KEY uq_reserva_experiencia_referencia(id_usuario,referencia)');
  if (!indexes.some(r=>r.Key_name==='ix_reserva_experiencia_cupos')) await c.query('ALTER TABLE reservas_experiencias ADD INDEX ix_reserva_experiencia_cupos(id_experiencia,estado)');
  const [keys] = await c.query("SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reservas_experiencias' AND REFERENCED_TABLE_NAME IS NOT NULL");
  for (const [col,parent,key] of [['id_metodo','metodos_pago','id_metodo'],['cobrado_por','usuarios','id_usuario']]) {
    if (!keys.some(r=>r.COLUMN_NAME===col)) await c.query(`ALTER TABLE reservas_experiencias ADD CONSTRAINT ${mysql.escapeId('fk_experiencia_'+col)} FOREIGN KEY (${mysql.escapeId(col)}) REFERENCES ${mysql.escapeId(parent)}(${mysql.escapeId(key)}) ON UPDATE CASCADE ON DELETE RESTRICT`);
  }
  return { base:database.name, pendiente:false, aplicado:pending };
}
if (require.main === module) {
  require('dotenv').config({path:path.join(__dirname,'../.env')});
  (async()=>{ const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME});
    try {console.log(JSON.stringify(await migrateExperiences(c,{apply:process.argv.includes('--aplicar'),expectedDatabase:process.env.DB_NAME})));} finally {await c.end();}
  })().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
}
module.exports={migrateExperiences};
