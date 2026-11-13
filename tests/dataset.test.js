const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDataset, generateSeedSQL, TABLES } = require('../scripts/generar-datos');
const data = generateDataset('2026-10-27');
const by = (table, key, id) => data[table].find(row => row[key] === id);

test('datos reproducibles con fechas de Colombia y los 22 conjuntos completos', () => {
  assert.deepEqual(data, generateDataset('2026-10-27'));
  assert.equal(data.meta.fecha_inicio, '2026-08-01');
  assert.equal(TABLES.length, 22);
  assert.equal(data.planes_suscripcion, undefined);
  TABLES.forEach(table => assert.ok(data[table].length > 0, table));
  ['2026-02-30', '27-10-2026', 'invalida'].forEach(date => assert.throws(() => generateDataset(date)));
  assert.equal(generateDataset('2026-01-05').meta.fecha_inicio, '2025-11-01');
  assert.equal(generateDataset('2028-03-01').meta.fecha_inicio, '2028-01-01');
});

test('identificadores, correos y teléfonos coherentes sin claves huérfanas', () => {
  for (const table of TABLES.filter(t => !['detalle_pedidos', 'reserva_mesas'].includes(t))) {
    const key = Object.keys(data[table][0])[0];
    assert.equal(new Set(data[table].map(row => row[key])).size, data[table].length, table);
  }
  assert.equal(new Set(data.usuarios.map(u => u.correo)).size, data.usuarios.length);
  data.usuarios.forEach(u => { if (u.telefono !== null) assert.match(u.telefono, /^3\d{9}$/); assert.match(u.correo, /@gastroturismo\.example$/); });
  data.restaurantes.forEach(r => { assert.ok(by('zonas', 'id_zona', r.id_zona)); assert.equal(by('usuarios', 'id_usuario', r.id_propietario).tipo_usuario, 'restaurante'); assert.equal(Object.hasOwn(r, 'id_plan'), false); });
  data.platos.forEach(p => { assert.ok(by('categorias', 'id_categoria', p.id_categoria)); assert.ok(by('restaurantes', 'id_restaurante', p.id_restaurante)); });
  assert.equal(new Set(data.mesas.map(m => `${m.id_restaurante}/${m.numero_mesa}`)).size, data.mesas.length);
  assert.equal(new Set(data.resenas.map(r => `${r.id_usuario}/${r.id_restaurante}`)).size, data.resenas.length);
});

test('asistencia real respeta reserva, restaurante, capacidad y fecha; no duplica reservas', () => {
  const registered = new Set();
  data.reservas.forEach(r => {
    const mesas = data.reserva_mesas.filter(a => a.id_reserva === r.id_reserva).map(a => by('mesas', 'id_mesa', a.id_mesa));
    assert.ok(mesas.length > 0);
    assert.ok(r.cantidad_personas <= mesas.reduce((sum, m) => sum + m.capacidad, 0));
    assert.ok(by('usuarios', 'id_usuario', r.id_usuario));
  });
  data.visitas.forEach(v => {
    assert.ok(v.cantidad_personas > 0);
    assert.ok(v.fecha_ingreso.slice(0, 10) <= data.meta.fecha_corte);
    assert.ok(by('restaurantes', 'id_restaurante', v.id_restaurante));
    if (v.id_usuario !== null) assert.ok(by('usuarios', 'id_usuario', v.id_usuario));
    if (v.id_reserva !== null) {
      assert.ok(!registered.has(v.id_reserva)); registered.add(v.id_reserva);
      const reservation = by('reservas', 'id_reserva', v.id_reserva);
      assert.equal(by('estados_reserva', 'id_estado_reserva', reservation.id_estado_reserva).codigo, 'finalizada');
      assert.equal(reservation.fecha_reserva, v.fecha_ingreso.slice(0, 10));
      assert.equal(reservation.id_usuario, v.id_usuario);
      assert.equal(by('mesas', 'id_mesa', by('reserva_mesas', 'id_reserva', reservation.id_reserva).id_mesa).id_restaurante, v.id_restaurante);
      assert.ok(v.cantidad_personas <= reservation.cantidad_personas);
    }
  });
  data.reservas.filter(r => by('estados_reserva', 'id_estado_reserva', r.id_estado_reserva).codigo === 'cancelada').forEach(r => assert.ok(!registered.has(r.id_reserva)));
});

test('pedidos tienen detalle del mismo restaurante y totales exactos; cada pago pertenece a un pedido', () => {
  assert.equal(new Set(data.detalle_pedidos.map(d => `${d.id_pedido}/${d.id_plato}`)).size, data.detalle_pedidos.length);
  data.pedidos.forEach(p => {
    const details = data.detalle_pedidos.filter(d => d.id_pedido === p.id_pedido);
    assert.ok(details.length > 0);
    assert.equal(p.total_pago, details.reduce((total, d) => total + d.cantidad * d.precio_unitario, 0));
    details.forEach(d => assert.equal(by('platos', 'id_plato', d.id_plato).id_restaurante, p.id_restaurante));
    assert.equal(Boolean(p.direccion_entrega), by('tipos_servicio', 'id_tipo_servicio', p.id_tipo_servicio).codigo === 'delivery');
  });
  data.pagos.forEach(p => {
    assert.ok(p.id_pedido > 0);
    assert.equal(Object.hasOwn(p, 'id_plan'), false);
    assert.ok(by('metodos_pago', 'id_metodo', p.id_metodo));
      const order = by('pedidos', 'id_pedido', p.id_pedido);
      assert.equal(by('estados_pedido', 'id_estado_pedido', order.id_estado_pedido).codigo, 'entregado');
      assert.equal(p.monto, order.total_pago);
      assert.equal(Object.hasOwn(p, 'id_usuario'), false);
      assert.ok(p.fecha_pago >= order.fecha_pedido);
  });
});

test('los reportes tienen tres meses de asistencia e ingresos, con accesos repetidos distinguibles', () => {
  for (const month of ['2026-08', '2026-09', '2026-10']) {
    const visits = data.visitas.filter(v => v.fecha_ingreso.startsWith(month));
    const accesses = data.accesos_sistema.filter(a => a.fecha_ingreso.startsWith(month));
    assert.ok(visits.reduce((s, v) => s + v.cantidad_personas, 0) > 0);
    assert.ok(accesses.length > new Set(accesses.map(a => a.id_usuario)).size);
  }
  data.accesos_sistema.forEach(a => { assert.ok(by('usuarios', 'id_usuario', a.id_usuario)); assert.ok(a.fecha_ingreso.slice(0, 10) <= data.meta.fecha_corte); });
});

test('SQL de semilla conserva datos existentes y no contiene borrados', () => {
  const sql = generateSeedSQL(data);
  assert.match(sql, /USE gastronomia_turistica_academica/);
  assert.match(sql, /INSERT IGNORE INTO `visitas`/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|REPLACE)\b/i);
  assert.doesNotMatch(sql, /`detalles`/);
  assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /planes_suscripcion|id_plan/);
});

test('Sorrento tiene diez mesas combinables, datos pendientes explícitos e historial sin inventar', () => {
  const restaurant = data.restaurantes.find(r => r.nombre === 'Café Sorrento');
  const tables = data.mesas.filter(m => m.id_restaurante === restaurant.id_restaurante);
  assert.equal(data.restaurantes.length, 5);
  assert.equal(tables.length, 10);
  assert.equal(tables.filter(m => m.capacidad === 2).length, 5);
  assert.equal(tables.filter(m => m.capacidad === 4).length, 5);
  assert.equal(tables.reduce((sum, m) => sum + m.capacidad, 0), restaurant.capacidad_total);
  assert.equal(restaurant.capacidad_total, 30);
  assert.equal(restaurant.telefono, null);
  assert.equal(restaurant.email, null);
  assert.match(restaurant.direccion, /Mall Privilegio.*por confirmar/);
  assert.equal(data.platos.filter(p=>p.id_restaurante===restaurant.id_restaurante).length,11);
  const menu=Object.fromEntries(data.platos.filter(p=>p.id_restaurante===restaurant.id_restaurante).map(p=>[p.nombre,p.precio]));
  assert.equal(menu.Café,4400); assert.equal(menu.Maicitos,24000); assert.equal(menu['Rollitos mixtos'],26000);
  assert.equal(menu['Pizza personal'],20000); assert.equal(menu['Pizza mediana'],32000); assert.equal(menu['Pizza grande'],50000);
  for (const table of ['pedidos', 'visitas', 'resenas', 'experiencias']) {
    assert.equal(data[table].filter(row => row.id_restaurante === restaurant.id_restaurante).length, 0, table);
  }
  assert.equal(data.reserva_mesas.some(a => tables.some(m => m.id_mesa === a.id_mesa)), false);
});

test('experiencias mantienen cupos, fechas y precio de reserva sin cobro online', () => {
  data.experiencias.forEach(e=>{assert.ok(by('restaurantes','id_restaurante',e.id_restaurante));assert.ok(e.fecha_hora.slice(0,10)>data.meta.fecha_corte);assert.ok(e.cupos<=by('restaurantes','id_restaurante',e.id_restaurante).capacidad_total);});
  data.reservas_experiencias.forEach(b=>{const e=by('experiencias','id_experiencia',b.id_experiencia);assert.ok(e);assert.ok(by('usuarios','id_usuario',b.id_usuario));assert.equal(b.precio_unitario,e.precio);assert.equal(b.estado_pago,'pendiente');assert.equal(b.fecha_pago,null);assert.equal(b.id_metodo,null);assert.ok(b.cantidad_personas<=e.cupos);});
});
