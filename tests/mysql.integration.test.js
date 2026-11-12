'use strict';

// Explicit opt-in: these tests insert and remove only their own fixtures in the
// isolated academic database. They never create/drop tables or alter seeded rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const { createApp } = require('../server');
const { comparisonPeriods } = require('../lib/periods');
const { verifyPassword } = require('../lib/passwords');
const { processReservationReminders } = require('../lib/recordatorios');
const dataset = require('../public/demo-data.json');

test('integration with the isolated academic MySQL-compatible database', { skip: process.env.GASTRO_MYSQL_TEST !== '1' }, async t => {
  const database = process.env.DB_NAME || 'gastronomia_turistica_academica';
  const host = process.env.DB_HOST || '127.0.0.1';
  const explicitCopy = process.env.GASTRO_MYSQL_TEST_DB;
  assert.ok(database === 'gastronomia_turistica_academica' ||
    (database === explicitCopy && /^gastronomia_turistica_academica_revision_\d{8}_\d+$/.test(database)),
    'Refusing to modify a database other than the academic database or its explicitly selected review copy');
  assert.ok(['localhost', '127.0.0.1'].includes(host), 'Integration testing is restricted to loopback');
  const db = mysql.createPool({ host, port: Number(process.env.DB_PORT) || 3307, user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database, connectionLimit: 1, timezone: '-05:00', dateStrings: true, connectTimeout: 3000 });
  let server;
  let userId;
  const visitIds = [];
  const orderIds = [];
  const paymentIds = [], reservationIds = [], tableIds = [], restaurantIds = [], registeredIds = [], extraDishIds = [];
  const cutoff = dataset.meta.fecha_corte;
  const fixedNow = new Date(`${cutoff}T18:00:00Z`);
  const at = `${cutoff} 12:00:00`;
  try {
    await db.query("SET time_zone = '-05:00'");
    const [fixture] = await db.query('INSERT INTO usuarios (nombre, correo, contrasena, telefono, tipo_usuario, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)',
      ['Prueba de integración', `integration-${Date.now()}@gastroturismo.example`, 'Prueba2026!', '3005550199', 'administrador', at]);
    userId = fixture.insertId;
    const [[account]] = await db.query('SELECT correo FROM usuarios WHERE id_usuario = ?', [userId]);
    const [[restaurant]] = await db.query('SELECT id_restaurante, capacidad_total FROM restaurantes ORDER BY id_restaurante LIMIT 1');
    server = createApp({ db, now: () => fixedNow }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie, clientCookie;
    const request = (route, options = {}) => fetch(base + route, { ...options, headers: { ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json', ...options.headers } });

    await t.test('schema has no memberships and every payment requires an order', async () => {
      const [[obsolete]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('planes_suscripcion','suscripciones')");
      assert.equal(Number(obsolete.n), 0);
      const [[column]] = await db.query("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pagos' AND COLUMN_NAME='id_pedido'");
      assert.equal(column.IS_NULLABLE, 'NO');
      assert.equal((await request('/api/planes')).status, 404);
    });

    await t.test('legacy login becomes a hash, creates a real access and an HttpOnly session', async () => {
      const [[before]] = await db.query('SELECT COUNT(*) AS n FROM accesos_sistema WHERE fecha_ingreso >= ? AND fecha_ingreso < ?', [`${cutoff.slice(0, 7)}-01 00:00:00`, comparisonPeriods({ fecha_corte: cutoff }, fixedNow)[1].hasta_exclusivo + ' 00:00:00']);
      const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ correo: account.correo, contrasena: 'Prueba2026!' }) });
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(response.headers.get('set-cookie'), /HttpOnly/);
      cookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal((await response.json()).user.contrasena, undefined);
      const [[stored]] = await db.query('SELECT contrasena FROM usuarios WHERE id_usuario = ?', [userId]);
      assert.match(stored.contrasena, /^scrypt\$/);
      assert.ok(verifyPassword('Prueba2026!', stored.contrasena));
      const me = await request('/api/auth/me');
      assert.equal(me.status, 200);
      assert.equal((await me.json()).user.contrasena, undefined);
      const report = await request(`/api/reportes/12?fecha_corte=${cutoff}`);
      assert.equal(report.status, 200);
      assert.equal((await report.json())[1].ingresos, Number(before.n) + 1);
    });

    await t.test('registration persists a client account and its authenticated session', async () => {
      const response = await request('/api/auth/register', {method: 'POST', body: JSON.stringify({
        nombre: 'Registro de prueba MySQL', correo: `registro-${Date.now()}@gastroturismo.example`, telefono: '3005550198', contrasena: 'Prueba2026!'
      })});
      assert.equal(response.status, 201, await response.clone().text());
      const registered = await response.json(); registeredIds.push(registered.user.id_usuario);
      clientCookie = response.headers.get('set-cookie').split(';')[0];
      const me = await request('/api/auth/me', {headers: {cookie: clientCookie}});
      assert.equal(me.status, 200);
      const safe = (await me.json()).user;
      assert.equal(safe.tipo_usuario, 'cliente');
      assert.equal(safe.contrasena, undefined);
      const [[saved]] = await db.query('SELECT contrasena FROM usuarios WHERE id_usuario = ?', [safe.id_usuario]);
      assert.ok(verifyPassword('Prueba2026!', saved.contrasena));
    });

    await t.test('restaurant without a plan receives a reservation for two tables and rejects overlapping bookings', async () => {
      const [[zone]] = await db.query('SELECT id_zona FROM zonas ORDER BY id_zona LIMIT 1');
      const created = await request('/api/restaurantes', {method: 'POST', body: JSON.stringify({nombre: 'Restaurante de prueba MySQL', direccion: 'Dirección ficticia de prueba', telefono: '3105550198', email: 'prueba@gastroturismo.example', capacidad_total: 8, especialidad: 'Prueba', id_zona: zone.id_zona, id_propietario: userId})});
      assert.equal(created.status, 201, await created.clone().text());
      const rest = await created.json(); restaurantIds.push(rest.id_restaurante);
      assert.equal(Object.hasOwn(rest, 'id_plan'), false);
      const tableResponse = await request('/api/mesas', {method: 'POST', body: JSON.stringify({numero_mesa: 'Prueba', capacidad: 4, ubicacion: 'Prueba', id_restaurante: rest.id_restaurante})});
      assert.equal(tableResponse.status, 201, await tableResponse.clone().text());
      const table = await tableResponse.json(); tableIds.push(table.id_mesa);
      const secondResponse = await request('/api/mesas', {method: 'POST', body: JSON.stringify({numero_mesa: 'Prueba 2', capacidad: 4, ubicacion: 'Prueba', id_restaurante: rest.id_restaurante})});
      assert.equal(secondResponse.status, 201, await secondResponse.clone().text());
      const second = await secondResponse.json(); tableIds.push(second.id_mesa);
      const payload = { fecha_reserva: cutoff, hora_reserva: '18:00:00', cantidad_personas: 6, id_usuario: userId, id_mesas: [table.id_mesa, second.id_mesa] };
      const book = data => request('/api/reservas', {method: 'POST', body: JSON.stringify(data)});
      const response = await book(payload);
      assert.equal(response.status, 201, await response.clone().text());
      const reservation = await response.json(); reservationIds.push(reservation.id_reserva);
      const [saved] = await db.query('SELECT r.id_usuario, rm.id_mesa, r.cantidad_personas FROM reservas r JOIN reserva_mesas rm USING (id_reserva) WHERE r.id_reserva = ? ORDER BY rm.id_mesa', [reservation.id_reserva]);
      assert.deepEqual(saved.map(row => row.id_mesa), payload.id_mesas);
      assert.equal(saved[0].id_usuario, userId); assert.equal(saved[0].cantidad_personas, 6);
      assert.equal((await book({...payload, id_mesas: [second.id_mesa], cantidad_personas: 2, hora_reserva: '19:00:00'})).status, 409);
      const available = await request(`/api/reservas/disponibilidad?id_restaurante=${rest.id_restaurante}&fecha=${cutoff}&hora=19%3A00`);
      assert.equal(available.status, 200, await available.clone().text());
      assert.deepEqual(await available.json(), []);
      const createTable = async (number, capacity) => {
        const response = await request('/api/mesas', {method:'POST',body:JSON.stringify({numero_mesa:number,capacidad:capacity,ubicacion:'Terraza',id_restaurante:rest.id_restaurante})});
        assert.equal(response.status,201,await response.clone().text());
        const row=await response.json(); tableIds.push(row.id_mesa); return row;
      };
      const third=await createTable('Aforo',8), fourth=await createTable('Lateral',2);
      const tooCrowded=await book({...payload,id_mesas:[third.id_mesa],cantidad_personas:3});
      assert.equal(tooCrowded.status,409,await tooCrowded.clone().text());
      for (const candidate of [
        {...payload,id_mesas:[third.id_mesa],cantidad_personas:6,hora_reserva:'20:30:00'},
        {...payload,id_mesas:[fourth.id_mesa],cantidad_personas:2,hora_reserva:'19:00:00'}
      ]) {
        const response=await book(candidate);
        assert.equal(response.status,201,await response.clone().text());
        reservationIds.push((await response.json()).id_reserva);
      }
      const editTable = changes => request(`/api/mesas/${table.id_mesa}`,{method:'PUT',body:JSON.stringify({...table, ...changes})});
      assert.equal((await editTable({capacidad:1})).status,409);
      assert.equal((await editTable({estado:'mantenimiento'})).status,409);
      assert.equal((await editTable({numero_mesa:'Prueba editada',capacidad:4})).status,200);
      assert.equal((await request(`/api/restaurantes/${rest.id_restaurante}`,{method:'PUT',body:JSON.stringify({...rest,capacidad_total:5})})).status,409);
      const listing = await request('/api/restaurantes'); assert.equal(listing.status, 200);
      const rows = await listing.json(); assert.ok(rows.some(row => row.id_restaurante === rest.id_restaurante));
      assert.ok(rows.every(row => !Object.hasOwn(row, 'id_plan') && !Object.hasOwn(row, 'nombre_plan')));
    });

    await t.test('reservation reminders are private, skip cancellations and are idempotent', async () => {
      for (const code of ['confirmada','pendiente','cancelada']) {
        const [[state]]=await db.query('SELECT id_estado_reserva FROM estados_reserva WHERE codigo=?',[code]);
        const [row]=await db.query('INSERT INTO reservas(fecha_reserva,hora_reserva,cantidad_personas,id_estado_reserva,id_usuario) VALUES (?,?,?,?,?)',
          ['2030-01-02','12:00:00',2,state.id_estado_reserva,userId]);
        reservationIds.push(row.insertId);
        await db.query('INSERT INTO reserva_mesas(id_reserva,id_mesa) VALUES (?,?)',[row.insertId,tableIds[0]]);
      }
      await processReservationReminders(db,'2030-01-01 13:00:00');
      const [reminders]=await db.query("SELECT mensaje,id_usuario FROM notificaciones WHERE id_usuario=? AND mensaje LIKE 'Recordatorio de reserva #%'",[userId]);
      assert.equal(reminders.length,2);
      assert.ok(reminders.every(r=>r.id_usuario===userId));
      assert.ok(reminders.every(r=>!r.mensaje.includes('#'+reservationIds.at(-1)+' ')));
      assert.equal(await processReservationReminders(db,'2030-01-01 13:00:00'),0);
    });

    await t.test('all twelve reports execute successfully against real tables', async () => {
      for (let n = 1; n <= 12; n++) {
        const response = await request(`/api/reportes/${n}?fecha_corte=${cutoff}`);
        assert.equal(response.status, 200, `Report ${n}: ${await response.clone().text()}`);
        assert.ok(Array.isArray(await response.json()));
      }
    });

    await t.test('attendance totals match SQL for matching days, full month and restaurant filter', async () => {
      for (const comparacion of ['mismo_corte', 'mes_completo']) {
        for (const filter of ['', String(restaurant.id_restaurante)]) {
          const response = await request(`/api/reportes/11?fecha_corte=${cutoff}&comparacion=${comparacion}${filter ? `&id_restaurante=${filter}` : ''}`);
          assert.equal(response.status, 200);
          const actual = await response.json();
          const periods = comparisonPeriods({ fecha_corte: cutoff, comparacion }, fixedNow);
          for (let index = 0; index < periods.length; index++) {
            const period = periods[index];
            const params = [`${period.desde} 00:00:00`, `${period.hasta_exclusivo} 00:00:00`];
            if (filter) params.push(Number(filter));
            const [[expected]] = await db.query(`SELECT COALESCE(SUM(cantidad_personas),0) AS personas_atendidas, COUNT(*) AS visitas FROM visitas WHERE fecha_ingreso >= ? AND fecha_ingreso < ?${filter ? ' AND id_restaurante = ?' : ''}`, params);
            assert.equal(actual[index].personas_atendidas, Number(expected.personas_atendidas));
            assert.equal(actual[index].visitas, Number(expected.visitas));
          }
        }
      }
    });

    await t.test('real access report separates access count from distinct users', async () => {
      const actual = await (await request(`/api/reportes/12?fecha_corte=${cutoff}`)).json();
      const periods = comparisonPeriods({ fecha_corte: cutoff }, fixedNow);
      for (let i = 0; i < periods.length; i++) {
        const [[expected]] = await db.query('SELECT COUNT(*) AS ingresos, COUNT(DISTINCT id_usuario) AS usuarios_unicos FROM accesos_sistema WHERE fecha_ingreso >= ? AND fecha_ingreso < ?', [`${periods[i].desde} 00:00:00`, `${periods[i].hasta_exclusivo} 00:00:00`]);
        assert.equal(actual[i].ingresos, Number(expected.ingresos));
        assert.equal(actual[i].usuarios_unicos, Number(expected.usuarios_unicos));
      }
    });

    await t.test('invalid attendance is rejected and valid attendance persists accurately', async () => {
      const body = { id_restaurante: restaurant.id_restaurante, cantidad_personas: 2, fecha_ingreso: at };
      const bad = await request('/api/visitas', { method: 'POST', body: JSON.stringify({ ...body, cantidad_personas: Number(restaurant.capacidad_total) + 1 }) });
      assert.equal(bad.status, 400);
      const response = await request('/api/visitas', { method: 'POST', body: JSON.stringify(body) });
      assert.equal(response.status, 201, await response.clone().text());
      const inserted = await response.json();
      visitIds.push(inserted.id_visita);
      const [[row]] = await db.query('SELECT cantidad_personas, fecha_ingreso, id_reserva FROM visitas WHERE id_visita = ?', [inserted.id_visita]);
      assert.equal(Number(row.cantidad_personas), 2);
      assert.equal(row.fecha_ingreso, at);
      assert.equal(row.id_reserva, null);
    });

    await t.test('order ignores manipulated client prices and derives its total from the menu', async () => {
      const [[dish]] = await db.query('SELECT id_plato, precio FROM platos WHERE id_restaurante = ? AND disponibilidad = 1 LIMIT 1', [restaurant.id_restaurante]);
      const response = await request('/api/pedidos', { method: 'POST', body: JSON.stringify({ tipo_servicio: 'comedor', id_usuario: userId, id_restaurante: restaurant.id_restaurante, total_pago: 1, platos: [{ id_plato: dish.id_plato, cantidad: 2, precio_unitario: 0.01 }] }) });
      assert.equal(response.status, 201, await response.clone().text());
      const order = await response.json();
      orderIds.push(order.id_pedido);
      assert.equal(order.total_pago, Number(dish.precio) * 2);
      const [[saved]] = await db.query('SELECT p.total_pago, d.precio_unitario, d.cantidad FROM pedidos p JOIN detalle_pedidos d ON d.id_pedido = p.id_pedido WHERE p.id_pedido = ?', [order.id_pedido]);
      assert.equal(Number(saved.total_pago), Number(dish.precio) * 2);
      assert.equal(Number(saved.precio_unitario), Number(dish.precio));
      assert.equal(Number(saved.cantidad), 2);
    });

    await t.test('order payment persists, rejects plans and enforces the real order foreign key', async () => {
      assert.ok(orderIds.length);
      const [[order]] = await db.query('SELECT total_pago FROM pedidos WHERE id_pedido = ?', [orderIds[0]]);
      const [[method]] = await db.query('SELECT id_metodo FROM metodos_pago ORDER BY id_metodo LIMIT 1');
      const payload = {monto: Number(order.total_pago), id_usuario: userId, id_metodo: method.id_metodo, id_pedido: orderIds[0], referencia: '01eb05c0-d18b-43a8-b0d1-d498fb45b91a'};
      const response = await request('/api/pagos', {method: 'POST', body: JSON.stringify(payload)});
      assert.equal(response.status, 201, await response.clone().text());
      const payment = await response.json(); paymentIds.push(payment.id_pago);
      const replay = await request('/api/pagos', {method: 'POST', body: JSON.stringify(payload)});
      assert.equal(replay.status, 200, await replay.clone().text());
      assert.equal((await replay.json()).id_pago, payment.id_pago);
      const excess = await request('/api/pagos', {method: 'POST', body: JSON.stringify({...payload, referencia: null, monto: 1})});
      assert.equal(excess.status, 409);
      const [[saved]] = await db.query('SELECT * FROM pagos WHERE id_pago = ?', [payment.id_pago]);
      assert.equal(saved.id_pedido, orderIds[0]); assert.equal(saved.id_usuario, userId);
      assert.equal(Number(saved.monto), payload.monto); assert.equal(Object.hasOwn(saved, 'id_plan'), false);
      assert.equal((await request('/api/pagos', {method: 'POST', body: JSON.stringify({...payload, id_plan: 1})})).status, 400);
      assert.equal((await request('/api/pagos', {method: 'POST', body: JSON.stringify({...payload, id_pedido: 2147483647})})).status, 404);
      await assert.rejects(db.query('INSERT INTO pagos (monto,id_usuario,id_metodo,id_pedido) VALUES (?,?,?,NULL)', [1000, userId, method.id_metodo]), error => error.code === 'ER_BAD_NULL_ERROR');
      await assert.rejects(db.query('INSERT INTO pagos (monto,id_usuario,id_metodo,id_pedido) VALUES (?,?,?,2147483647)', [1000, userId, method.id_metodo]), error => error.code === 'ER_NO_REFERENCED_ROW_2');
    });

    await t.test('client sees only their reservations and orders and cannot edit restaurant records', async () => {
      assert.ok(clientCookie && reservationIds.length && orderIds.length);
      const headers = {cookie: clientCookie};
      for (const [route, key, fixture] of [['reservas', 'id_reserva', reservationIds[0]], ['pedidos', 'id_pedido', orderIds[0]]]) {
        const response = await request('/api/' + route, {headers});
        assert.equal(response.status, 200, await response.clone().text());
        const rows = await response.json();
        assert.ok(rows.every(row => row.id_usuario === registeredIds[0]));
        assert.ok(rows.every(row => row[key] !== fixture));
      }
      const status = await request(`/api/pedidos/${orderIds[0]}`, {headers, method:'PUT', body: JSON.stringify({estado_pedido:'entregado'})});
      assert.equal(status.status, 403);
      const deletion = await request(`/api/mesas/${tableIds[0]}`, {headers, method:'DELETE'});
      assert.equal(deletion.status, 403);
    });

    await t.test('delivery requires an address and follows the catalog of order states', async () => {
      const [[dish]] = await db.query('SELECT id_plato FROM platos WHERE id_restaurante = ? AND disponibilidad = 1 LIMIT 1', [restaurant.id_restaurante]);
      const payload = {tipo_servicio:'delivery', id_usuario:userId, id_restaurante:restaurant.id_restaurante, platos:[{id_plato:dish.id_plato,cantidad:1}]};
      const send = body => request('/api/pedidos', {method:'POST', body:JSON.stringify(body)});
      assert.equal((await send({...payload,direccion_entrega:'   '})).status, 400);
      const created = await send({...payload,direccion_entrega:'  Calle de prueba 123  '});
      assert.equal(created.status, 201, await created.clone().text());
      const order = await created.json();
      orderIds.push(order.id_pedido);
      assert.equal(order.direccion_entrega, 'Calle de prueba 123');
      const change = estado_pedido => request(`/api/pedidos/${order.id_pedido}`, {method:'PUT', body:JSON.stringify({estado_pedido})});
      assert.equal((await change('en camino')).status, 200);
      assert.equal((await change('entregado')).status, 200);
      assert.equal((await change('en camino')).status, 409);
    });

    await t.test('owner completes management operations and cannot manage another owners restaurant', async () => {
      const createOwner = async label => {
        const email = `owner-${label}-${Date.now()}@gastroturismo.example`;
        const [result] = await db.query('INSERT INTO usuarios(nombre,correo,contrasena,tipo_usuario,fecha_registro) VALUES (?,?,?,?,?)',
          [label,email,'Prueba2026!','restaurante',at]);
        registeredIds.push(result.insertId);
        const auth = await request('/api/auth/login',{method:'POST',body:JSON.stringify({correo:email,contrasena:'Prueba2026!'})});
        assert.equal(auth.status,200,await auth.clone().text());
        return { id:result.insertId, headers:{cookie:auth.headers.get('set-cookie').split(';')[0]} };
      };
      const first=await createOwner('Uno'),second=await createOwner('Dos');
      const [[zone]]=await db.query('SELECT id_zona FROM zonas ORDER BY id_zona LIMIT 1');
      const [[category]]=await db.query('SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1');
      const createRest = async (owner,name) => {
        const response = await request('/api/restaurantes',{method:'POST',headers:owner.headers,
          body:JSON.stringify({nombre:name,direccion:'Dirección de prueba',telefono:'3005550111',email:'restaurante@example.test',capacidad_total:12,especialidad:'Café',id_zona:zone.id_zona,id_propietario:second.id})});
        assert.equal(response.status,201,await response.clone().text());
        const row=await response.json(); restaurantIds.push(row.id_restaurante); assert.equal(row.id_propietario,owner.id); return row;
      };
      const mine=await createRest(first,'Mi restaurante de revisión'),theirs=await createRest(second,'Otro restaurante de revisión');
      const call=(route,method,body,owner=first)=>request('/api/'+route,{method,headers:owner.headers,...(body ? {body:JSON.stringify(body)} : {})});
      assert.equal((await call('restaurantes/'+mine.id_restaurante,'PUT',{...mine,nombre:'Mi restaurante editado'})).status,200);
      assert.equal((await call('restaurantes/'+theirs.id_restaurante,'PUT',theirs)).status,403);
      assert.equal((await call('restaurantes/'+theirs.id_restaurante,'DELETE')).status,403);
      assert.equal((await call('mesas','POST',{numero_mesa:'X',capacidad:4,ubicacion:'Salón',id_restaurante:theirs.id_restaurante})).status,403);
      const tableResponse=await call('mesas','POST',{numero_mesa:'Revisión',capacidad:4,ubicacion:'Salón',id_restaurante:mine.id_restaurante});
      assert.equal(tableResponse.status,201,await tableResponse.clone().text());
      const table=await tableResponse.json(); tableIds.push(table.id_mesa);
      assert.equal((await call('mesas/'+table.id_mesa,'PUT',{...table,ubicacion:'Terraza'})).status,200);
      assert.equal((await call('mesas/'+table.id_mesa,'PUT',{...table,id_restaurante:theirs.id_restaurante})).status,400);
      const dishResponse=await call('platos','POST',{nombre:'Plato de revisión',descripcion:'Prueba',precio:12345.67,disponibilidad:true,id_categoria:category.id_categoria,id_restaurante:mine.id_restaurante});
      assert.equal(dishResponse.status,201,await dishResponse.clone().text());
      const dish=await dishResponse.json();
      try {
        assert.equal((await call('platos/'+dish.id_plato,'PUT',{...dish,nombre:'Plato editado',disponibilidad:false})).status,200);
        assert.equal((await call('platos/'+dish.id_plato,'PUT',{...dish,precio:-1})).status,400);
        assert.equal((await call('platos/'+dish.id_plato,'DELETE',null,second)).status,403);
      } finally { await db.query('DELETE FROM platos WHERE id_plato=?',[dish.id_plato]); }
      for (const n of [1,3,4,5,6,7,8,10,11]) {
        const report=await call(`reportes/${n}?fecha_corte=${cutoff}`,'GET');
        assert.equal(report.status,200,await report.clone().text());
        const rows=await report.json();
        if ([1,4,6,7,8].includes(n)) assert.ok(rows.every(row=>row.Restaurante==='Mi restaurante editado'), 'Reporte '+n);
      }
      for (const n of [2,9,12]) assert.equal((await call('reportes/'+n,'GET')).status,403);
      assert.equal((await call('mesas/'+table.id_mesa,'DELETE')).status,200);
      assert.equal((await call('restaurantes/'+mine.id_restaurante,'DELETE')).status,200);
      const bad=await call('restaurantes','POST',{...mine,nombre:'   '});
      assert.equal(bad.status,400);
    });

    await t.test('reservation edit preserves its two table assignments and permitted deletion removes the bridge rows', async () => {
      const future=new Date(cutoff+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+2);const date=future.toISOString().slice(0,10);
      const body={fecha_reserva:date,hora_reserva:'10:00:00',cantidad_personas:6,id_mesas:tableIds.slice(0,2),id_usuario:registeredIds[0]};
      const headers={cookie:clientCookie};
      const created=await request('/api/reservas',{method:'POST',headers,body:JSON.stringify(body)});
      assert.equal(created.status,201,await created.clone().text());const reservation=await created.json();reservationIds.push(reservation.id_reserva);
      const route='/api/reservas/'+reservation.id_reserva;
      const changed=await request(route,{method:'PUT',headers,body:JSON.stringify({...body,hora_reserva:'11:00:00',cantidad_personas:5})});
      assert.equal(changed.status,200,await changed.clone().text());const row=await changed.json();assert.equal(row.id_reserva,reservation.id_reserva);assert.equal(row.cantidad_personas,5);assert.deepEqual(row.id_mesas,body.id_mesas);
      assert.equal((await request(route,{method:'PUT',headers,body:JSON.stringify({estado_reserva:'confirmada'})})).status,403);
      assert.equal((await request(route,{method:'PUT',headers,body:JSON.stringify({cantidad_personas:99})})).status,400);
      assert.equal((await request(route,{method:'DELETE',headers})).status,200);
      const [[remaining]]=await db.query('SELECT COUNT(*) AS n FROM reserva_mesas WHERE id_reserva=?',[reservation.id_reserva]);assert.equal(Number(remaining.n),0);
      assert.equal((await request(route,{method:'DELETE',headers})).status,404);
    });

    await t.test('authorized dish deletion succeeds without history and is rejected once used in an order', async () => {
      const [[category]]=await db.query('SELECT id_categoria FROM categorias LIMIT 1');
      const dishBody={nombre:'Plato temporal para eliminación',descripcion:'Prueba controlada',precio:9500,disponibilidad:true,id_restaurante:restaurant.id_restaurante,id_categoria:category.id_categoria};
      const createDish=async()=>{const response=await request('/api/platos',{method:'POST',body:JSON.stringify(dishBody)});assert.equal(response.status,201,await response.clone().text());const row=await response.json();extraDishIds.push(row.id_plato);return row;};
      const unused=await createDish();assert.equal((await request('/api/platos/'+unused.id_plato,{method:'DELETE'})).status,200);
      const used=await createDish();const response=await request('/api/pedidos',{method:'POST',body:JSON.stringify({tipo_servicio:'comedor',id_usuario:userId,id_restaurante:restaurant.id_restaurante,platos:[{id_plato:used.id_plato,cantidad:1}]})});
      assert.equal(response.status,201,await response.clone().text());const order=await response.json();orderIds.push(order.id_pedido);
      assert.equal((await request('/api/platos/'+used.id_plato,{method:'DELETE'})).status,409);
      assert.equal((await request('/api/platos/'+used.id_plato,{method:'PUT',body:JSON.stringify({...used,disponibilidad:false})})).status,200);
      const [[detail]]=await db.query('SELECT COUNT(*) AS n FROM detalle_pedidos WHERE id_pedido=? AND id_plato=?',[order.id_pedido,used.id_plato]);assert.equal(Number(detail.n),1);
    });

    await t.test('logout invalidates the authenticated session', async () => {
      assert.equal((await request('/api/auth/logout', {method: 'POST'})).status, 200);
      assert.equal((await request('/api/auth/me')).status, 401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const id of paymentIds) await db.query('DELETE FROM pagos WHERE id_pago = ?', [id]);
    for (const id of visitIds) await db.query('DELETE FROM visitas WHERE id_visita = ?', [id]);
    for (const id of reservationIds) await db.query('DELETE FROM reservas WHERE id_reserva = ?', [id]);
    for (const id of orderIds) {
      await db.query('DELETE FROM detalle_pedidos WHERE id_pedido = ?', [id]);
      await db.query('DELETE FROM pedidos WHERE id_pedido = ?', [id]);
    }
    for (const id of tableIds) await db.query('DELETE FROM mesas WHERE id_mesa = ?', [id]);
    for (const id of extraDishIds) await db.query('DELETE FROM platos WHERE id_plato = ?', [id]);
    for (const id of restaurantIds) await db.query('DELETE FROM restaurantes WHERE id_restaurante = ?', [id]);
    for (const id of registeredIds) {
      await db.query('DELETE FROM accesos_sistema WHERE id_usuario = ?', [id]);
      await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
    }
    if (userId) {
      await db.query('DELETE FROM accesos_sistema WHERE id_usuario = ?', [userId]);
      await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId]);
    }
    await db.end();
  }
});
