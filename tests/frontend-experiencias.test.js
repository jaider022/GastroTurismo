'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
function setup(){
 const owner={id_usuario:2,tipo_usuario:'restaurante',nombre:'Propietaria'},client={id_usuario:3,tipo_usuario:'cliente',nombre:'Turista'},other={id_usuario:4,tipo_usuario:'cliente',nombre:'Otro turista'};
 const store={gt_usuarios:[owner,client,other],gt_restaurantes:[{id_restaurante:1,id_propietario:2,nombre:'Café',capacidad_total:10}],gt_zonas:[],gt_metodos:[{id_metodo:1,tipo_pago:'online',nombre_metodo:'PSE'},{id_metodo:2,tipo_pago:'presencial',nombre_metodo:'Efectivo'}],gt_notificaciones:[],gt_experiencias:[{id_experiencia:1,id_restaurante:1,nombre:'Cata',fecha_hora:'2031-06-02 15:00:00',duracion_minutos:90,precio:12345.67,cupos:3,estado:'activa'}],gt_reservas_experiencias:[]};
 const context=vm.createContext({console,Intl,Date,crypto:{randomUUID},currentUser:client,isConnectedToDB:false,document:{addEventListener(){}},getLS:key=>JSON.parse(JSON.stringify(store[key]||[])),setLS:(key,value)=>{store[key]=JSON.parse(JSON.stringify(value));},bogotaNow:()=>'2031-05-01 12:00:00'});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/experiencias.js'),'utf8'),context);
 return{context,store,owner,client,other,call:(route,method='GET',body)=>context.experienceAPI(route,{method,...(body?{body:JSON.stringify(body)}:{})})};
}
test('experiencias envía JSON al servidor y conserva un error sin escribir en demo',async()=>{
 const {context,store,call}=setup();context.isConnectedToDB=true;let received;
 context.requestAPI=async(route,options)=>{received={route,options};throw Error('Servidor no disponible');};
 await assert.rejects(call('reservas_experiencias','POST',{id_experiencia:1}),/Servidor no disponible/);
 assert.equal(received.options.headers['Content-Type'],'application/json');assert.equal(store.gt_reservas_experiencias.length,0);
});
test('demo confirma cupos una vez, bloquea sobrecupo y conserva el precio de la reserva',async()=>{
 const {context,store,call}=setup(),reference=randomUUID();
 const body={id_experiencia:1,cantidad_personas:2,referencia:reference,precio_esperado:12345.67};
 const booked=await call('reservas_experiencias','POST',body);await call('reservas_experiencias','POST',body);
 assert.equal(store.gt_reservas_experiencias.length,1);assert.equal(store.gt_notificaciones.length,1);
 assert.equal((await call('experiencias'))[0].cupos_disponibles,1);
 await assert.rejects(call('reservas_experiencias','POST',{...body,referencia:randomUUID()}),/cupos/);
 store.gt_experiencias[0].precio=20000;
 assert.equal((await call('reservas_experiencias'))[0].total,24691.34);
 await assert.rejects(call('reservas_experiencias','POST',{...body,cantidad_personas:1,referencia:randomUUID()}),/precio/);
 assert.equal(booked.precio_unitario,12345.67);
});
test('demo limita reservas al cliente y cancelar libera cupos',async()=>{
 const {context,call,other,client}=setup();const b=await call('reservas_experiencias','POST',{id_experiencia:1,cantidad_personas:2,referencia:randomUUID()});
 context.currentUser=other;assert.equal((await call('reservas_experiencias')).length,0);
 await assert.rejects(call('reservas_experiencias/'+b.id_reserva_experiencia+'/cancelar','PUT'),/gestionar/);
 context.currentUser=client;await call('reservas_experiencias/'+b.id_reserva_experiencia+'/cancelar','PUT');
 assert.equal((await call('experiencias'))[0].cupos_disponibles,3);
});
test('demo registra cobro presencial solo por restaurante y protege lo cobrado',async()=>{
 const {context,store,call,owner}=setup();const b=await call('reservas_experiencias','POST',{id_experiencia:1,cantidad_personas:1,referencia:randomUUID()});
 const route='reservas_experiencias/'+b.id_reserva_experiencia+'/cobrar';
 await assert.rejects(call(route,'PUT',{id_metodo:2}),/restaurante/);
 context.currentUser=owner;await assert.rejects(call(route,'PUT',{id_metodo:1}),/presencial/);
 await call(route,'PUT',{id_metodo:2});await call(route,'PUT',{id_metodo:2});
 assert.equal(store.gt_reservas_experiencias[0].estado_pago,'pagado');assert.equal(store.gt_notificaciones.length,2);
 await assert.rejects(call('experiencias/1','PUT',{estado:'cancelada'}),/cobradas/);
 await assert.rejects(call('reservas_experiencias/'+b.id_reserva_experiencia+'/cancelar','PUT'),/cobrada/);
});
