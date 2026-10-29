const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadFrontend() {
  const storage = new Map();
  const context = vm.createContext({
    console: {log() {}, warn() {}, error() {}}, URLSearchParams, Intl, Date, window: {},
    document: {addEventListener() {}},
    localStorage: {getItem:key => storage.get(key) ?? null, setItem:(key,value) => storage.set(key,String(value)), removeItem:key => storage.delete(key)},
    fetch: async () => { throw new Error('Unexpected request'); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8') + '\nglobalThis.frontend = {monthlyPeriods,calculateMonthlyReport,simulateLocalStorageAPI,simulateVisitas,getLS,setLS,requestAPI,escapeHTML};', context);
  return {context, api:context.frontend, storage};
}
const plain = object => JSON.parse(JSON.stringify(object));

test('same-day comparison clamps the previous leap February to its last day', () => {
  const {api} = loadFrontend();
  assert.deepEqual(plain(api.monthlyPeriods('2024-03-31')), [
    {periodo:'Mes anterior',desde:'2024-02-01',hasta:'2024-02-29'},
    {periodo:'Mes actual al corte',desde:'2024-03-01',hasta:'2024-03-31'}
  ]);
});
test('whole-month comparison and January rollover use calendar months', () => {
  const {api} = loadFrontend();
  assert.equal(api.monthlyPeriods('2025-01-10','mes_completo')[0].hasta,'2024-12-31');
  assert.equal(api.monthlyPeriods('2025-01-10','mismo_corte')[0].hasta,'2024-12-10');
  assert.throws(() => api.monthlyPeriods('2025-02-30'), /no existe/);
});
test('attendance counts actual persons, excludes outside dates and filters restaurant', () => {
  const {api} = loadFrontend();
  api.setLS('gt_visitas', [
    {fecha_ingreso:'2024-02-10 23:59:59',cantidad_personas:3,id_restaurante:1},
    {fecha_ingreso:'2024-02-11 00:00:00',cantidad_personas:99,id_restaurante:1},
    {fecha_ingreso:'2024-03-10 23:59:59',cantidad_personas:4,id_restaurante:1},
    {fecha_ingreso:'2024-03-10 15:00:00',cantidad_personas:8,id_restaurante:2}
  ]);
  const rows = api.calculateMonthlyReport(11,new URLSearchParams('fecha_corte=2024-03-10&id_restaurante=1'));
  assert.deepEqual(rows.map(r=>r.personas_atendidas).join(','),'3,4');
  assert.deepEqual(rows.map(r=>r.visitas).join(','),'1,1');
});
test('successful logins count events and distinct users independently', () => {
  const {api} = loadFrontend();
  api.setLS('gt_accesos_sistema', [
    {fecha_ingreso:'2024-03-01 12:00:00',id_usuario:1},
    {fecha_ingreso:'2024-03-01 13:00:00',id_usuario:1},
    {fecha_ingreso:'2024-03-02 12:00:00',id_usuario:2}
  ]);
  const row = api.calculateMonthlyReport(12,new URLSearchParams('fecha_corte=2024-03-10'))[1];
  assert.equal(row.ingresos,3); assert.equal(row.usuarios_unicos,2);
});
test('demo login records only successful authentication and never returns password', () => {
  const {api} = loadFrontend();
  api.setLS('gt_usuarios',[{id_usuario:1,correo:'admin@example.test',contrasena:'Example123!',nombre:'Ana',tipo_usuario:'administrador'}]);
  assert.throws(() => api.simulateLocalStorageAPI('auth/login',{method:'POST',body:JSON.stringify({correo:'admin@example.test',contrasena:'wrong'})}),/inválidas/);
  assert.equal(api.getLS('gt_accesos_sistema').length,0);
  const result=api.simulateLocalStorageAPI('auth/login',{method:'POST',body:JSON.stringify({correo:'admin@example.test',contrasena:'Example123!'})});
  assert.equal(api.getLS('gt_accesos_sistema').length,1);
  assert.equal(result.user.contrasena,undefined);
});
test('attendance validates restaurant, reservation, capacity and duplicate attendance', () => {
  const {api,context}=loadFrontend();
  vm.runInContext("currentUser={tipo_usuario:'administrador'}",context);
  api.setLS('gt_restaurantes',[{id_restaurante:1,capacidad_total:20}]);
  api.setLS('gt_mesas',[{id_mesa:1,id_restaurante:1,capacidad:4}]);
  api.setLS('gt_reservas',[{id_reserva:1,id_mesa:1,id_usuario:2,fecha_reserva:'2024-03-10',estado_reserva:'confirmada'}]);
  const body={id_restaurante:1,id_reserva:1,fecha_ingreso:'2024-03-10 13:00:00',cantidad_personas:3};
  assert.throws(()=>api.simulateVisitas('POST',{...body,cantidad_personas:5}),/capacidad/);
  api.simulateVisitas('POST',body);
  assert.throws(()=>api.simulateVisitas('POST',body),/ya tiene/);
});
test('backend HTTP failures never write to demo fallback', async () => {
  const {api,context}=loadFrontend();
  vm.runInContext('isConnectedToDB=true',context);
  context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Sesión requerida'})});
  await assert.rejects(api.requestAPI('visitas',{method:'POST',body:'{}'}),/Sesión requerida/);
  assert.equal(api.getLS('gt_visitas').length,0);
});
test('the new demo namespace preserves the original demonstration data', () => {
  const {api,storage}=loadFrontend();
  storage.set('gt_visitas','[{"cantidad_personas":999}]');
  api.setLS('gt_visitas',[{cantidad_personas:3}]);
  assert.equal(storage.get('gt_visitas'),'[{"cantidad_personas":999}]');
  assert.equal(api.getLS('gt_visitas')[0].cantidad_personas,3);
});
