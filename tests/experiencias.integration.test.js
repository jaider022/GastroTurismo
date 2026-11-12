'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mysql=require('mysql2/promise');
const {randomUUID}=require('node:crypto');
const {createApp}=require('../server');
const {hashPassword}=require('../lib/passwords');
const {migrateExperiences}=require('../scripts/migrar-experiencias');
test('experiencias con cupos concurrentes, privacidad y pago presencial en MySQL', {skip:process.env.GASTRO_MYSQL_TEST!=='1'}, async t=>{
  const name=process.env.DB_NAME;
  assert.ok(name===process.env.GASTRO_MYSQL_TEST_DB&&/^gastronomia_turistica_academica_revision_\d{8}_\d+$/.test(name),'Estas pruebas solo admiten la copia de revisión explícita');
  assert.ok(['127.0.0.1','localhost'].includes(process.env.DB_HOST));
  const db=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:name,dateStrings:true,timezone:'-05:00',connectionLimit:6});
  let server;const users=[],restaurants=[],activities=[];let owner,other,client,second,admin,exp,booked,paid,unused;
  try{
    assert.equal((await migrateExperiences(db,{expectedDatabase:name})).pendiente,false);
    server=createApp({db,now:()=>new Date('2031-05-01T17:00:00Z')}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base='http://127.0.0.1:'+server.address().port;
    const call=(who,route,method='GET',body)=>fetch(base+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(who?{cookie:who.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const makeUser=async(role)=>{const email=randomUUID()+'@gastroturismo.example';const [r]=await db.query('INSERT INTO usuarios(nombre,correo,contrasena,tipo_usuario) VALUES (?,?,?,?)',['Prueba experiencia',email,hashPassword('Experiencia2026!'),role]);users.push(r.insertId);const response=await call(null,'auth/login','POST',{correo:email,contrasena:'Experiencia2026!'});assert.equal(response.status,200);return{id:r.insertId,cookie:response.headers.get('set-cookie').split(';')[0]};};
    owner=await makeUser('restaurante');other=await makeUser('restaurante');client=await makeUser('cliente');second=await makeUser('cliente');admin=await makeUser('administrador');
    const [[zone]]=await db.query('SELECT id_zona FROM zonas LIMIT 1');
    const rest=async user=>{const [r]=await db.query('INSERT INTO restaurantes(nombre,direccion,capacidad_total,id_zona,id_propietario) VALUES (?,?,?,?,?)',['Café de prueba','Dirección de prueba',12,zone.id_zona,user.id]);restaurants.push(r.insertId);return r.insertId;};
    const mine=await rest(owner),theirs=await rest(other);
    const payload={id_restaurante:mine,nombre:'Cata de prueba',descripcion:'Café local',fecha_hora:'2031-05-04T15:00',duracion_minutos:90,cupos:3,precio:'12345.67'};
    const publish=async(body,user=owner)=>{const r=await call(user,'experiencias','POST',body);assert.equal(r.status,201,await r.clone().text());const e=await r.json();activities.push(e.id_experiencia);return e;};
    const book=async(who,e,people,reference=randomUUID())=>call(who,'reservas_experiencias','POST',{id_experiencia:e,cantidad_personas:people,referencia:reference});
    await t.test('gestión autorizada, fechas, aforo y catálogo público sin datos personales',async()=>{
      assert.equal((await call(null,'reservas_experiencias')).status,401);
      assert.equal((await call(client,'experiencias?gestion=1')).status,403);
      assert.equal((await call(client,'experiencias','POST',payload)).status,403);
      assert.equal((await call(other,'experiencias','POST',payload)).status,403);
      for(const change of [{cupos:13},{precio:-2},{precio:[]},{cupos:1.5},{fecha_hora:'2031-02-30T15:00'},{fecha_hora:'2031-04-30T15:00'}])assert.equal((await call(owner,'experiencias','POST',{...payload,...change})).status,400,JSON.stringify(change));
      exp=await publish(payload);await publish({...payload,id_restaurante:theirs,nombre:'Otra cata'},other);
      assert.equal((await call(owner,'restaurantes/'+mine,'PUT',{nombre:'Café de prueba',direccion:'Dirección de prueba',telefono:'3005550100',email:'prueba@example.test',especialidad:'Café',capacidad_total:2,id_zona:zone.id_zona})).status,409);
      const catalog=await (await call(null,'experiencias')).json();assert.ok(catalog.some(e=>e.id_experiencia===exp.id_experiencia));assert.ok(catalog.every(e=>!Object.hasOwn(e,'correo_usuario')&&!Object.hasOwn(e,'id_usuario')));
      const own=await(await call(owner,'experiencias?gestion=1')).json();assert.ok(own.every(e=>e.id_restaurante===mine));
    });
    await t.test('reserva conserva precio, referencia y cupos ante reintentos',async()=>{
      const reference=randomUUID();const r=await book(client,exp.id_experiencia,2,reference);assert.equal(r.status,201,await r.clone().text());booked=await r.json();
      assert.equal(Number(booked.precio_unitario),12345.67);assert.equal(booked.estado_pago,'pendiente');
      const retry=await book(client,exp.id_experiencia,2,reference);assert.equal(retry.status,200);assert.equal((await retry.json()).id_reserva_experiencia,booked.id_reserva_experiencia);
      assert.equal((await book(client,exp.id_experiencia,1,reference)).status,409);
      assert.equal((await call(owner,'experiencias/'+exp.id_experiencia,'PUT',{precio:20000})).status,200);
      assert.equal((await call(client,'reservas_experiencias','POST',{id_experiencia:exp.id_experiencia,cantidad_personas:1,referencia:randomUUID(),precio_esperado:12345.67})).status,409);
      assert.equal((await call(owner,'experiencias/'+exp.id_experiencia,'PUT',{cupos:1})).status,409);
      assert.equal((await call(owner,'experiencias/'+exp.id_experiencia,'PUT',{fecha_hora:'2031-05-05T16:00'})).status,409);
      const rows=await(await call(client,'reservas_experiencias')).json();assert.equal(Number(rows.find(b=>b.id_reserva_experiencia===booked.id_reserva_experiencia).total),24691.34);
      assert.equal((await call(other,'experiencias/'+exp.id_experiencia,'PUT',{precio:1})).status,403);
    });
    await t.test('dos clientes compiten por el último cupo y solo uno lo obtiene',async()=>{
      const responses=await Promise.all([book(client,exp.id_experiencia,1),book(second,exp.id_experiencia,1)]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      const catalog=await(await call(null,'experiencias')).json();assert.equal(Number(catalog.find(e=>e.id_experiencia===exp.id_experiencia).cupos_disponibles),0);
    });
    await t.test('privacidad y cancelación devuelven cupos sin alterar otras reservas',async()=>{
      assert.equal((await call(second,'reservas_experiencias/'+booked.id_reserva_experiencia+'/cancelar','PUT')).status,403);
      assert.equal((await call(client,'reservas_experiencias/'+booked.id_reserva_experiencia+'/cancelar','PUT')).status,200);
      assert.equal((await call(client,'reservas_experiencias/'+booked.id_reserva_experiencia+'/cancelar','PUT')).status,200);
      const catalog=await(await call(null,'experiencias')).json();assert.equal(Number(catalog.find(e=>e.id_experiencia===exp.id_experiencia).cupos_disponibles),2);
      assert.ok((await(await call(client,'reservas_experiencias')).json()).every(b=>b.id_usuario===client.id));
      assert.deepEqual(await(await call(other,'reservas_experiencias')).json(),[]);
      const r=await book(client,exp.id_experiencia,2);assert.equal(r.status,201);paid=await r.json();assert.equal(Number(paid.precio_unitario),20000);
    });
    await t.test('solo el restaurante registra el pago presencial total y no puede duplicarlo',async()=>{
      const [[cash]]=await db.query("SELECT id_metodo FROM metodos_pago WHERE tipo_pago='presencial' ORDER BY id_metodo LIMIT 1");
      const [[online]]=await db.query("SELECT id_metodo FROM metodos_pago WHERE tipo_pago='online' LIMIT 1");
      const route='reservas_experiencias/'+paid.id_reserva_experiencia+'/cobrar';
      assert.equal((await call(client,route,'PUT',{id_metodo:cash.id_metodo})).status,403);
      assert.equal((await call(other,route,'PUT',{id_metodo:cash.id_metodo})).status,403);
      assert.equal((await call(owner,route,'PUT',{id_metodo:online.id_metodo})).status,400);
      const r=await call(owner,route,'PUT',{id_metodo:cash.id_metodo,monto:1});assert.equal(r.status,200);assert.equal((await r.json()).total,40000);
      assert.equal((await call(owner,route,'PUT',{id_metodo:cash.id_metodo})).status,200);
      assert.equal((await call(client,'reservas_experiencias/'+paid.id_reserva_experiencia+'/cancelar','PUT')).status,409);
      assert.equal((await call(owner,'experiencias/'+exp.id_experiencia,'PUT',{estado:'cancelada'})).status,409);
      const [[row]]=await db.query('SELECT * FROM reservas_experiencias WHERE id_reserva_experiencia=?',[paid.id_reserva_experiencia]);assert.equal(row.estado_pago,'pagado');assert.equal(row.cobrado_por,owner.id);assert.ok(row.fecha_pago);
    });
    await t.test('cancelar una actividad sin cobros cancela sus cupos y notifica',async()=>{
      unused=await publish({...payload,nombre:'Taller cancelable'});const r=await book(client,unused.id_experiencia,1);assert.equal(r.status,201);const b=await r.json();
      assert.equal((await call(owner,'experiencias/'+unused.id_experiencia,'PUT',{estado:'cancelada'})).status,200);
      const [[row]]=await db.query('SELECT estado FROM reservas_experiencias WHERE id_reserva_experiencia=?',[b.id_reserva_experiencia]);assert.equal(row.estado,'cancelada');
      assert.equal((await book(second,unused.id_experiencia,1)).status,409);
      assert.ok((await(await call(admin,'reservas_experiencias')).json()).some(r=>r.id_reserva_experiencia===b.id_reserva_experiencia));
    });
  }finally{
    if(server)await new Promise(r=>server.close(r));
    for(const e of activities){await db.query('DELETE FROM reservas_experiencias WHERE id_experiencia=?',[e]);await db.query('DELETE FROM experiencias WHERE id_experiencia=?',[e]);}
    for(const r of restaurants)await db.query('DELETE FROM restaurantes WHERE id_restaurante=?',[r]);
    for(const u of users){await db.query('DELETE FROM notificaciones WHERE id_usuario=?',[u]);await db.query('DELETE FROM accesos_sistema WHERE id_usuario=?',[u]);await db.query('DELETE FROM usuarios WHERE id_usuario=?',[u]);}
    await db.end();
  }
});
