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
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'demo-inicial.sql'), 'utf8');
    await connection.query(sql);
    const [rows] = await connection.query('SELECT COUNT(*) AS visitas, COALESCE(SUM(cantidad_personas),0) AS personas FROM gastronomia_turistica_academica.visitas');
    console.log(`Base académica lista: ${rows[0].visitas} visitas y ${rows[0].personas} personas atendidas. Los registros existentes se conservan.`);
  } finally { await connection.end(); }
}
load().catch(error => { console.error(error.code || '', error.message); process.exitCode = 1; });
