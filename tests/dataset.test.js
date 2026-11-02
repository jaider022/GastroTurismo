const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDataset, generateSeedSQL, TABLES } = require('../scripts/generar-datos');
const data = generateDataset('2026-10-27');
const by = (table, key, id) => data[table].find(row => row[key] === id);

test('datos reproducibles con fechas de Colombia y los 20 conjuntos completos', () => {
  assert.deepEqual(data, generateDataset('2026-10-27'));
  assert.equal(data.meta.fecha_inicio, '2026-08-01');
  assert.equal(TABLES.length, 20);
  TABLES.forEach(table => assert.ok(data[table].length > 0, table));
  ['2026-02-30', '27-10-2026', 'invalida'].forEach(date => assert.throws(() => generateDataset(date)));
  assert.equal(generateDataset('2026-01-05').meta.fecha_inicio, '2025-11-01');
  assert.equal(generateDataset('2028-03-01').meta.fecha_inicio, '2028-01-01');
});

test('identificadores, correos y teléfonos coherentes sin claves huérfanas', () => {
  for (const table of TABLES.filter(t => t !== 'detalle_pedidos')) {
    const key = Object.keys(data[table][0])[0];
    assert.equal(new Set(data[table].map(row => row[key])).size, data[table].length, table);
  }
  assert.equal(new Set(data.usuarios.map(u => u.correo)).size, data.usuarios.length);
  data.usuarios.forEach(u => { assert.match(u.telefono, /^3\d{9}$/); assert.match(u.correo, /@gastroturismo\.example$/); });
  data.restaurantes.forEach(r => { assert.ok(by('zonas', 'id_zona', r.id_zona)); assert.equal(by('usuarios', 'id_usuario', r.id_propietario).tipo_usuario, 'restaurante'); assert.ok(by('planes_suscripcion', 'id_plan', r.id_plan)); });
  data.platos.forEach(p => { assert.ok(by('categorias', 'id_categoria', p.id_categoria)); assert.ok(by('restaurantes', 'id_restaurante', p.id_restaurante)); });
  assert.equal(new Set(data.mesas.map(m => `${m.id_restaurante}/${m.numero_mesa}`)).size, data.mesas.length);
  assert.equal(new Set(data.resenas.map(r => `${r.id_usuario}/${r.id_restaurante}`)).size, data.resenas.length);
});

test('asistencia real respeta reserva, restaurante, capacidad y fecha; no duplica reservas', () => {
  const registered = new Set();
  data.reservas.forEach(r => {
    const mesa = by('mesas', 'id_mesa', r.id_mesa);
    assert.ok(r.cantidad_personas <= mesa.capacidad);
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
      assert.equal(reservation.estado_reserva, 'finalizada');
      assert.equal(reservation.fecha_reserva, v.fecha_ingreso.slice(0, 10));
      assert.equal(reservation.id_usuario, v.id_usuario);
      assert.equal(by('mesas', 'id_mesa', reservation.id_mesa).id_restaurante, v.id_restaurante);
      assert.ok(v.cantidad_personas <= reservation.cantidad_personas);
    }
  });
  data.reservas.filter(r => r.estado_reserva === 'cancelada').forEach(r => assert.ok(!registered.has(r.id_reserva)));
});

test('pedidos tienen detalle del mismo restaurante y totales exactos; pagos con concepto exclusivo', () => {
  assert.equal(new Set(data.detalle_pedidos.map(d => `${d.id_pedido}/${d.id_plato}`)).size, data.detalle_pedidos.length);
  data.pedidos.forEach(p => {
    const details = data.detalle_pedidos.filter(d => d.id_pedido === p.id_pedido);
    assert.ok(details.length > 0);
    assert.equal(p.total_pago, details.reduce((total, d) => total + d.cantidad * d.precio_unitario, 0));
    details.forEach(d => assert.equal(by('platos', 'id_plato', d.id_plato).id_restaurante, p.id_restaurante));
    assert.equal(Boolean(p.direccion_entrega), p.tipo_servicio === 'delivery');
  });
  data.pagos.forEach(p => {
    assert.equal([p.id_pedido, p.id_plan, p.id_inscripcion].filter(v => v !== null).length, 1);
    assert.ok(by('metodos_pago', 'id_metodo', p.id_metodo));
    if (p.id_pedido !== null) {
      const order = by('pedidos', 'id_pedido', p.id_pedido);
      assert.equal(order.estado_pedido, 'entregado');
      assert.equal(p.monto, order.total_pago);
      assert.equal(p.id_usuario, order.id_usuario);
      assert.ok(p.fecha_pago >= order.fecha_pedido);
    } else if (p.id_inscripcion !== null) {
      const ins = by('inscripciones_experiencia', 'id_inscripcion', p.id_inscripcion);
      assert.notEqual(ins.estado_inscripcion, 'cancelada');
      assert.equal(p.monto, ins.total);
      assert.equal(p.id_usuario, ins.id_usuario);
    } else {
      const plan = by('planes_suscripcion', 'id_plan', p.id_plan);
      assert.equal(p.monto, plan.costo);
      assert.equal(by('usuarios', 'id_usuario', p.id_usuario).tipo_usuario, 'restaurante');
    }
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
});

test('experiencias respetan cupo, precio y estado; inscripciones sin duplicados', () => {
  data.experiencias.forEach(e => {
    assert.ok(by('restaurantes', 'id_restaurante', e.id_restaurante));
    const active = data.inscripciones_experiencia.filter(i => i.id_experiencia === e.id_experiencia && i.estado_inscripcion !== 'cancelada');
    assert.ok(active.reduce((s, i) => s + i.cantidad_personas, 0) <= e.cupo_maximo);
    assert.equal(e.estado_experiencia, e.fecha_experiencia > data.meta.fecha_corte ? 'programada' : 'realizada');
  });
  assert.equal(new Set(data.inscripciones_experiencia.map(i => `${i.id_experiencia}/${i.id_usuario}`)).size, data.inscripciones_experiencia.length);
  data.inscripciones_experiencia.forEach(i => {
    const e = by('experiencias', 'id_experiencia', i.id_experiencia);
    assert.equal(i.total, i.cantidad_personas * e.precio_persona);
    assert.equal(by('usuarios', 'id_usuario', i.id_usuario).tipo_usuario, 'cliente');
    assert.ok(i.fecha_inscripcion.slice(0, 10) < e.fecha_experiencia);
  });
});

test('suscripciones con vigencia coherente, plan vigente igual al del restaurante y pago del propietario', () => {
  data.restaurantes.forEach(r => {
    const active = data.suscripciones.filter(s => s.id_restaurante === r.id_restaurante && s.estado_suscripcion === 'activa');
    assert.equal(active.length, 1);
    assert.equal(active[0].id_plan, r.id_plan);
  });
  data.suscripciones.forEach(s => {
    assert.ok(s.fecha_fin > s.fecha_inicio);
    assert.equal(s.estado_suscripcion, s.fecha_fin > data.meta.fecha_corte ? 'activa' : 'vencida');
    if (s.id_pago !== null) {
      const pago = by('pagos', 'id_pago', s.id_pago);
      assert.equal(pago.id_plan, s.id_plan);
      assert.equal(pago.id_usuario, by('restaurantes', 'id_restaurante', s.id_restaurante).id_propietario);
    } else assert.equal(by('planes_suscripcion', 'id_plan', s.id_plan).costo, 0);
  });
  assert.equal(new Set(data.suscripciones.filter(s => s.id_pago !== null).map(s => s.id_pago)).size, data.suscripciones.filter(s => s.id_pago !== null).length);
});

test('recordatorios enviados solo hasta la fecha de corte y asociados a registros del mismo usuario', () => {
  data.recordatorios.forEach(r => {
    assert.ok(by('usuarios', 'id_usuario', r.id_usuario));
    assert.equal(r.enviado, r.fecha_programada.slice(0, 10) <= data.meta.fecha_corte);
    assert.equal(r.fecha_envio !== null, r.enviado);
    if (r.id_reserva !== null) assert.equal(by('reservas', 'id_reserva', r.id_reserva).id_usuario, r.id_usuario);
    if (r.id_inscripcion !== null) assert.equal(by('inscripciones_experiencia', 'id_inscripcion', r.id_inscripcion).id_usuario, r.id_usuario);
    if (r.id_suscripcion !== null) assert.equal(by('restaurantes', 'id_restaurante', by('suscripciones', 'id_suscripcion', r.id_suscripcion).id_restaurante).id_propietario, r.id_usuario);
  });
  assert.ok(data.recordatorios.some(r => r.tipo_recordatorio === 'personal'));
  assert.ok(data.recordatorios.some(r => !r.enviado));
});
