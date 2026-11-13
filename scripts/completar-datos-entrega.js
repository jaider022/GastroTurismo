'use strict';
const fs=require('node:fs'),path=require('node:path');
const {menuSorrento,sorrento}=require('../lib/cafe-sorrento');
const reference='20261112-0000-4000-8000-000000000022';
async function completeDeliveryData(c,{apply=false,expectedDatabase,backupDirectory,includeExperience=true}={}){
 const [[database]]=await c.query('SELECT DATABASE() AS nombre');
 if(database.nombre!==expectedDatabase||!/^gastronomia_turistica_academica(?:_revision_\d{8}_\d+)?$/.test(database.nombre))throw new Error('Selecciona la base académica o su copia de revisión.');
 const [[restaurant]]=await c.query('SELECT id_restaurante FROM restaurantes WHERE nombre=?',[sorrento.nombre]);
 if(!restaurant)throw new Error('Primero incorpora Café Sorrento.');
 if(!apply)return{base:database.nombre,aplicado:false,productos:menuSorrento.length,experiencia:'Reserva académica del cliente de demostración, si hay cupos futuros.'};
 if(!backupDirectory)throw new Error('Falta el respaldo.');
 await c.beginTransaction();
 try{
  const [tables]=await c.query('SHOW TABLES');const backup={base:database.nombre,fecha:new Date().toISOString(),tablas:{}};
  for(const entry of tables){const table=Object.values(entry)[0];if(!/^\w+$/.test(table))throw new Error('Tabla inesperada.');const [rows]=await c.query('SELECT * FROM `'+table+'`');backup.tablas[table]=rows;}
  fs.mkdirSync(backupDirectory,{recursive:true});const file=path.join(backupDirectory,`antes-datos-entrega-${database.nombre}-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(backup,null,2),{flag:'wx'});
  await c.query('SELECT id_restaurante FROM restaurantes WHERE id_restaurante=? FOR UPDATE',[restaurant.id_restaurante]);
  let added=0;const discrepancies=[];
  for(const [name,price,category,description] of menuSorrento){
   const [[existing]]=await c.query('SELECT id_plato,precio FROM platos WHERE id_restaurante=? AND nombre=?',[restaurant.id_restaurante,name]);
   if(existing){if(Number(existing.precio)!==price)discrepancies.push(name);continue;}
   const [[kind]]=await c.query('SELECT id_categoria FROM categorias WHERE nombre_categoria=?',[category]);if(!kind)throw new Error('Falta la categoría '+category);
   await c.query('INSERT INTO platos(nombre,descripcion,precio,disponibilidad,id_categoria,id_restaurante) VALUES (?,?,?,TRUE,?,?)',[name,description,price,kind.id_categoria,restaurant.id_restaurante]);added++;
  }
  if(discrepancies.length)throw new Error('Hay precios existentes distintos; no se sobrescribieron: '+discrepancies.join(', '));
  const [[client]]=await c.query("SELECT id_usuario FROM usuarios WHERE correo='cliente@gastroturismo.example' AND tipo_usuario='cliente'");
  if(!client)throw new Error('Falta el cliente ficticio de la demostración.');
  const [[existingBooking]]=await c.query('SELECT id_reserva_experiencia FROM reservas_experiencias WHERE id_usuario=? AND referencia=?',[client.id_usuario,reference]);
  let booking=existingBooking?.id_reserva_experiencia,created=false;
  if(!booking && includeExperience){
   const [[experience]]=await c.query("SELECT e.* FROM experiencias e JOIN restaurantes r ON r.id_restaurante=e.id_restaurante JOIN usuarios u ON u.id_usuario=r.id_propietario WHERE e.estado='activa' AND e.fecha_hora>NOW() AND u.correo LIKE '%@gastroturismo.example' AND r.id_restaurante<>? AND e.cupos-COALESCE((SELECT SUM(b.cantidad_personas) FROM reservas_experiencias b WHERE b.id_experiencia=e.id_experiencia AND b.estado<>'cancelada'),0)>=2 ORDER BY e.fecha_hora LIMIT 1 FOR UPDATE",[restaurant.id_restaurante]);
   if(!experience)throw new Error('No hay una experiencia futura de ejemplo con dos cupos libres.');
   const [result]=await c.query("INSERT INTO reservas_experiencias(id_experiencia,id_usuario,cantidad_personas,fecha_reserva,estado,precio_unitario,referencia,estado_pago) VALUES (?,?,2,NOW(),'confirmada',?,?,'pendiente')",[experience.id_experiencia,client.id_usuario,experience.precio,reference]);booking=result.insertId;created=true;
  }
  await c.commit();return{base:database.nombre,aplicado:true,respaldo:file,platos_agregados:added,id_reserva_experiencia:booking,reserva_academica_agregada:created,cobro_real:false};
 }catch(error){await c.rollback();throw error;}
}
if(require.main===module){require('dotenv').config({path:path.join(__dirname,'../.env')});(async()=>{if(!['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST))throw new Error('Utiliza la base académica local.');const c=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME,dateStrings:true,timezone:'-05:00'});try{await c.query("SET time_zone='-05:00'");console.log(JSON.stringify(await completeDeliveryData(c,{apply:process.argv.includes('--aplicar'),expectedDatabase:process.env.DB_NAME,backupDirectory:path.join(__dirname,'../backups/datos-entrega')}),null,2));}finally{await c.end();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});}
module.exports={completeDeliveryData};
