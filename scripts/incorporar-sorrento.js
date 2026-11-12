'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { hashPassword } = require('../lib/passwords');
const { sorrento } = require('../lib/cafe-sorrento');

async function incorporateSorrento(connection, { apply = false, expectedDatabase, backupDirectory } = {}) {
  const [[database]] = await connection.query('SELECT DATABASE() AS name');
  if (database.name !== expectedDatabase || !/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(database.name)) {
    throw new Error('Selecciona explícitamente la base académica o su copia de revisión.');
  }
  const [existing] = await connection.query('SELECT id_restaurante FROM restaurantes WHERE nombre IN (?, ?)', [sorrento.nombre, 'Café Sorrento Gourmet']);
  if (existing.length > 1) throw new Error('Hay más de una ficha de Sorrento. Revisa los datos antes de continuar.');
  if (existing.length) {
    const [[tables]] = await connection.query('SELECT COUNT(*) AS mesas, COALESCE(SUM(capacidad),0) AS asientos FROM mesas WHERE id_restaurante=?', [existing[0].id_restaurante]);
    return { base: database.name, id_restaurante: existing[0].id_restaurante, existente: true, ...tables, aplicado: false };
  }
  if (!apply) return { base: database.name, pendiente: true, mesas: 10, asientos_provisionales: 30, aplicado: false };
  if (!backupDirectory) throw new Error('Indica una carpeta local para el respaldo previo.');
  const [[lock]] = await connection.query("SELECT GET_LOCK('gastroturismo:incorporar-sorrento', 2) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('Otra incorporación está en curso.');
  let inTransaction = false;
  try {
    await connection.beginTransaction();
    inTransaction = true;
    const [again] = await connection.query('SELECT id_restaurante FROM restaurantes WHERE nombre IN (?, ?) FOR UPDATE', [sorrento.nombre, 'Café Sorrento Gourmet']);
    if (again.length) throw new Error('La ficha se creó durante la revisión; vuelve a consultar sin aplicar.');
    const [tableNames] = await connection.query('SHOW TABLES');
    const snapshot = { base: database.name, fecha: new Date().toISOString(), tablas: {} };
    for (const entry of tableNames) {
      const name = Object.values(entry)[0];
      if (!/^\w+$/.test(name)) throw new Error('Nombre de tabla inesperado.');
      const [rows] = await connection.query('SELECT * FROM `' + name + '`');
      snapshot.tablas[name] = rows;
    }
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backup = path.join(backupDirectory, `antes-sorrento-${database.name}-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(snapshot, null, 2), { flag: 'wx' });
    const [[municipality]] = await connection.query('SELECT id_municipio FROM municipios WHERE nombre_municipio=?', [sorrento.municipio]);
    if (!municipality) throw new Error('Falta el municipio Armenia. No se incorporó el café.');
    let [[zone]] = await connection.query('SELECT id_zona,id_municipio FROM zonas WHERE nombre_zona=?', [sorrento.zona]);
    if (zone && zone.id_municipio !== municipality.id_municipio) throw new Error('Mall Privilegio está registrado en otro municipio.');
    if (!zone) {
      const [result] = await connection.query('INSERT INTO zonas (nombre_zona,id_municipio,descripcion_turistica) VALUES (?,?,?)',
        [sorrento.zona, municipality.id_municipio, 'Mall en Armenia; ubicación indicada por el equipo para Café Sorrento.']);
      zone = { id_zona: result.insertId };
    }
    let [[owner]] = await connection.query('SELECT id_usuario,tipo_usuario FROM usuarios WHERE correo=?', [sorrento.cuenta]);
    if (owner && owner.tipo_usuario !== 'restaurante') throw new Error('La cuenta de gestión tiene un rol incompatible.');
    if (!owner) {
      // Cuenta técnica, sin identidad personal inventada ni contraseña de acceso compartida.
      const [result] = await connection.query('INSERT INTO usuarios (nombre,correo,contrasena,telefono,tipo_usuario) VALUES (?,?,?,NULL,?)',
        ['Gestión Café Sorrento (por asignar)', sorrento.cuenta, hashPassword(randomBytes(48).toString('hex')), 'restaurante']);
      owner = { id_usuario: result.insertId };
    }
    const [restaurant] = await connection.query('INSERT INTO restaurantes (nombre,direccion,telefono,email,capacidad_total,especialidad,id_zona,id_propietario) VALUES (?,?,NULL,NULL,?,?,?,?)',
      [sorrento.nombre, sorrento.direccion, sorrento.capacidad_total, sorrento.especialidad, zone.id_zona, owner.id_usuario]);
    for (const [index, capacity] of sorrento.mesas.entries()) await connection.query('INSERT INTO mesas (numero_mesa,capacidad,ubicacion,estado,id_restaurante) VALUES (?,?,?,?,?)',
      [`Mesa ${index + 1}`, capacity, 'Salón · distribución por confirmar', 'disponible', restaurant.insertId]);
    await connection.commit();
    inTransaction = false;
    return { base: database.name, id_restaurante: restaurant.insertId, mesas: 10, asientos_provisionales: 30,
      aplicado: true, respaldo: backup, gestion: 'Cuenta técnica por asignar; el administrador puede gestionar el café.' };
  } catch (error) {
    if (inTransaction) await connection.rollback();
    throw error;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('gastroturismo:incorporar-sorrento')");
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  (async () => {
    if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Este comando es para la base académica local.');
    const connection = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME, dateStrings: true, timezone: '-05:00' });
    try {
      console.log(JSON.stringify(await incorporateSorrento(connection, { apply: process.argv.includes('--aplicar'),
        expectedDatabase: process.env.DB_NAME, backupDirectory: path.join(__dirname, '../backups') }), null, 2));
    } finally { await connection.end(); }
  })().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
}

module.exports = { incorporateSorrento };
