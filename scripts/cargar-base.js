'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function load() {
  const database = process.env.DB_NAME || 'gastronomia_turistica_academica';
  if (database !== 'gastronomia_turistica_academica') {
    throw new Error('La carga de ejemplo solo está permitida en gastronomia_turistica_academica.');
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    multipleStatements: true, charset: 'utf8mb4', connectTimeout: 3000
  });
  try {
    const [legacy] = await connection.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('pagos', 'restaurantes') AND COLUMN_NAME = 'id_plan'`, [database]);
    if (legacy.length) throw new Error('La base todavía usa planes. Revisa primero npm run db:sin-planes; no se cargaron datos.');
    const [previousModel] = await connection.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND ((TABLE_NAME = 'zonas' AND COLUMN_NAME = 'ciudad') OR (TABLE_NAME = 'reservas' AND COLUMN_NAME = 'id_mesa'))`, [database]);
    if (previousModel.length) throw new Error('La base existente requiere la migración de la asesoría. Revisa npm run db:asesoria antes de cargar la semilla.');
    const [existingColumns] = await connection.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?', [database]);
    if (existingColumns.some(c=>c.TABLE_NAME==='reservas') && !['precio_unitario','referencia','estado_pago','id_metodo','fecha_pago','cobrado_por'].every(name=>existingColumns.some(c=>c.TABLE_NAME==='reservas_experiencias'&&c.COLUMN_NAME===name))) {
      throw new Error('La base existente requiere la migración de experiencias. Revisa npm run db:experiencias antes de cargar la semilla. No se importaron registros.');
    }
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'demo-inicial.sql'), 'utf8');
    await connection.query(sql);
    const [rows] = await connection.query('SELECT COUNT(*) AS visitas, COALESCE(SUM(cantidad_personas),0) AS personas FROM gastronomia_turistica_academica.visitas');
    console.log(`Base académica lista: ${rows[0].visitas} visitas y ${rows[0].personas} personas atendidas. Los registros existentes se conservan.`);
  } finally { await connection.end(); }
}
load().catch(error => { console.error(error.code || '', error.message); process.exitCode = 1; });
