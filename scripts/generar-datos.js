/* Datos ficticios reproducibles para la sustentación. No modifica MySQL. */
const fs = require('node:fs');
const path = require('node:path');
const { normalizeDataset } = require('../lib/catalogos');
const { addSorrentoDataset } = require('../lib/cafe-sorrento');

const TABLES = ['municipios', 'tipos_servicio', 'estados_pedido', 'estados_reserva', 'zonas', 'usuarios', 'categorias', 'metodos_pago', 'restaurantes', 'mesas', 'platos', 'reservas', 'reserva_mesas', 'pedidos', 'detalle_pedidos', 'pagos', 'resenas', 'notificaciones', 'visitas', 'accesos_sistema', 'experiencias', 'reservas_experiencias'];
const DEMO_PASSWORD = 'Gastro2026!';
const dateText = date => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
function todayBogota() {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function generateDataset(cutoff = todayBogota()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('La fecha debe tener formato YYYY-MM-DD.');
  const end = new Date(`${cutoff}T12:00:00Z`);
  if (!Number.isFinite(end.getTime()) || dateText(end) !== cutoff) throw new Error('La fecha no existe.');
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1, 12));
  const data = Object.fromEntries(TABLES.map(table => [table, []]));
  data.meta = { version: 'gastroturismo-2026-v4-asesoria', fecha_corte: cutoff, fecha_inicio: dateText(start), zona_horaria: 'America/Bogota', tipo_datos: 'ficticios', contrasena_demo: DEMO_PASSWORD };
  data.zonas = [
    ['Valle de Cocora', 'Salento', 'Senderos y paisaje de palma de cera.'],
    ['Calle Real', 'Filandia', 'Casas de colores, artesanías y gastronomía local.'],
    ['Centro de Armenia', 'Armenia', 'Oferta cultural y comercial de la capital del Quindío.'],
    ['Miradores de Buenavista', 'Buenavista', 'Paisaje cafetero y cafés de origen.'],
    ['Corredor del café', 'Montenegro', 'Fincas cafeteras y turismo rural.']
  ].map((v, i) => ({ id_zona: i + 1, nombre_zona: v[0], ciudad: v[1], descripcion_turistica: v[2] }));
  data.categorias = ['Entradas', 'Platos fuertes', 'Cafés especiales', 'Postres', 'Bebidas naturales'].map((nombre_categoria, i) => ({ id_categoria: i + 1, nombre_categoria, descripcion: `Selección de ${nombre_categoria.toLowerCase()} de la región.` }));
  data.metodos_pago = [ ['PSE', 'online'], ['Tarjeta', 'online'], ['Transferencia', 'online'], ['Datáfono', 'presencial'], ['Efectivo', 'presencial'] ].map((v, i) => ({ id_metodo: i + 1, nombre_metodo: v[0], tipo_pago: v[1] }));
  const names = ['Santiago Restrepo', 'Mariana Gómez', 'Mauricio Ocampo', 'Lucía Valencia', 'Andrés Giraldo', 'Laura Martínez', 'Juan Carlos Pérez', 'Camila Urrea', 'Carlos Andrés Silva', 'Sofía López', 'Daniela Ríos', 'Sebastián Torres', 'Valentina García', 'Mateo Quintero', 'Isabella Ramírez', 'Nicolás Herrera', 'Paula Castaño', 'David Muñoz', 'Gabriela Duque', 'Felipe Salazar', 'Natalia Suárez', 'Alejandro Mejía', 'Sara Vélez', 'Diego Montoya', 'Juliana Patiño', 'Tomás Arias', 'Manuela Correa', 'Samuel Medina', 'Carolina Londoño', 'Miguel Castro', 'Ana María Ruiz', 'Esteban Osorio', 'Verónica Molina'];
  data.usuarios = names.map((nombre, i) => ({ id_usuario: i + 1, nombre, correo: i === 0 ? 'admin@gastroturismo.example' : i === 5 ? 'cliente@gastroturismo.example' : i === 1 ? 'restaurante@gastroturismo.example' : `usuario${i + 1}@gastroturismo.example`, contrasena: DEMO_PASSWORD, telefono: String(3005550100 + i), tipo_usuario: i === 0 ? 'administrador' : i < 5 ? 'restaurante' : 'cliente', fecha_registro: `${dateText(addDays(start, -45 + i))} 09:00:00` }));
  const restaurantNames = ['Fogón del Guadual', 'Cocina del Mirador', 'Café La Palma', 'Sabores del Camino'];
  data.restaurantes = restaurantNames.map((nombre, i) => ({ id_restaurante: i + 1, nombre, direccion: ['Carrera 5 # 7-18, Salento', 'Carrera 7 # 6-21, Filandia', 'Calle 12 # 14-30, Armenia', 'Vía al mirador, km 2, Buenavista'][i], telefono: String(3105550200 + i), email: `reservas${i + 1}@gastroturismo.example`, capacidad_total: 30, especialidad: ['Cocina tradicional cafetera', 'Trucha y productos de la huerta', 'Café de origen y repostería', 'Platos regionales y cocina de temporada'][i], id_zona: i + 1, id_propietario: i + 2 }));
  data.restaurantes.forEach(r => [2, 4, 6, 8, 10].forEach((capacidad, i) => data.mesas.push({ id_mesa: data.mesas.length + 1, numero_mesa: `Mesa ${i + 1}`, capacidad, ubicacion: i < 3 ? 'Salón principal' : 'Terraza', estado: 'disponible', id_restaurante: r.id_restaurante })));
  const menus = [
    ['Patacones con hogao', 'Trucha con arroz y ensalada', 'Café filtrado de origen', 'Postre de natas', 'Limonada de panela'],
    ['Arepas con queso', 'Bandeja del Mirador', 'Cappuccino de la casa', 'Torta de almojábana', 'Jugo de mora'],
    ['Empanadas de maíz', 'Pollo campesino', 'Espresso de origen', 'Torta de café', 'Limonada de coco'],
    ['Yuca crocante', 'Sancocho de gallina', 'Café de prensa francesa', 'Brevas con arequipe', 'Jugo de maracuyá']
  ];
  data.restaurantes.forEach((r, ri) => menus[ri].forEach((nombre, pi) => data.platos.push({ id_plato: data.platos.length + 1, nombre, descripcion: `${nombre}, preparado con ingredientes de la región.`, precio: [14000, 36000, 8000, 11000, 9000][pi] + ri * 1000, disponibilidad: true, id_categoria: pi + 1, id_restaurante: r.id_restaurante })));
  let dayIndex = 0;
  for (let day = start; day <= end; day = addDays(day, 1), dayIndex++) {
    const fecha = dateText(day);
    data.restaurantes.forEach((r, ri) => {
      const userId = 6 + (dayIndex * 3 + ri * 5) % 28;
      const mesa = data.mesas.filter(m => m.id_restaurante === r.id_restaurante)[1 + (dayIndex + ri) % 4];
      const quantity = 2 + (dayIndex + ri) % Math.min(mesa.capacidad - 1, 5);
      const cancelled = (dayIndex + ri) % 11 === 0;
      const reservation = { id_reserva: data.reservas.length + 1, fecha_reserva: fecha, hora_reserva: '13:00:00', cantidad_personas: quantity, estado_reserva: cancelled ? 'cancelada' : 'finalizada', id_usuario: userId, id_mesa: mesa.id_mesa };
      data.reservas.push(reservation);
      if (!cancelled) data.visitas.push({ id_visita: data.visitas.length + 1, id_restaurante: r.id_restaurante, id_reserva: reservation.id_reserva, id_usuario: userId, fecha_ingreso: `${fecha} 13:05:00`, cantidad_personas: Math.max(1, quantity - (dayIndex % 7 === 0 ? 1 : 0)) });
      data.visitas.push({ id_visita: data.visitas.length + 1, id_restaurante: r.id_restaurante, id_reserva: null, id_usuario: (dayIndex + ri) % 3 === 0 ? null : userId, fecha_ingreso: `${fecha} 18:10:00`, cantidad_personas: 1 + (dayIndex + ri) % 6 });
      const order = { id_pedido: data.pedidos.length + 1, fecha_pedido: `${fecha} 13:20:00`, tipo_servicio: dayIndex % 3 === 0 ? 'delivery' : 'comedor', estado_pedido: cancelled ? 'cancelado' : 'entregado', total_pago: 0, direccion_entrega: dayIndex % 3 === 0 ? `Hospedaje de ejemplo, habitación ${101 + ri}, ${data.zonas[ri].ciudad}` : null, id_usuario: userId, id_restaurante: r.id_restaurante, detalles: [] };
      const dishes = data.platos.filter(p => p.id_restaurante === r.id_restaurante);
      [dishes[(dayIndex + ri) % 4], dishes[4]].forEach((dish, di) => {
        const detail = { id_pedido: order.id_pedido, id_plato: dish.id_plato, cantidad: di === 0 ? 1 + dayIndex % 3 : 2, precio_unitario: dish.precio };
        data.detalle_pedidos.push(detail);
        order.detalles.push({ ...detail, nombre_plato: dish.nombre });
        order.total_pago += detail.cantidad * detail.precio_unitario;
      });
      data.pedidos.push(order);
      if (!cancelled) data.pagos.push({ id_pago: data.pagos.length + 1, monto: order.total_pago, fecha_pago: `${fecha} 14:15:00`, estado_pago: 'aprobado', id_usuario: userId, id_metodo: 1 + (dayIndex + ri) % 5, id_pedido: order.id_pedido });
      if (!cancelled && !data.resenas.some(x => x.id_usuario === userId && x.id_restaurante === r.id_restaurante)) data.resenas.push({ id_resena: data.resenas.length + 1, calificacion: 3 + (dayIndex + ri) % 3, comentario: ['Buena atención y platos bien presentados.', 'Disfrutamos los sabores de la región.', 'El lugar es agradable y las porciones adecuadas.'][(dayIndex + ri) % 3], fecha_opinion: fecha, id_usuario: userId, id_restaurante: r.id_restaurante });
      if (dayIndex % 8 === 0) data.notificaciones.push({ id_notificacion: data.notificaciones.length + 1, mensaje: `Reserva ${reservation.id_reserva} ${cancelled ? 'cancelada' : 'finalizada'} en ${r.nombre}.`, fecha_envio: `${fecha} 15:00:00`, leido: dayIndex % 16 === 0, id_usuario: userId });
      data.accesos_sistema.push({ id_acceso: data.accesos_sistema.length + 1, id_usuario: userId, fecha_ingreso: `${fecha} 10:00:00` });
      if ((dayIndex + ri) % 2 === 0) data.accesos_sistema.push({ id_acceso: data.accesos_sistema.length + 1, id_usuario: userId, fecha_ingreso: `${fecha} 17:00:00` });
    });
    data.accesos_sistema.push({ id_acceso: data.accesos_sistema.length + 1, id_usuario: 1, fecha_ingreso: `${fecha} 08:00:00` });
  }
  // Reservas futuras para poder ensayar confirmación y registro de asistencia.
  for (let i = 1; i <= 12; i++) {
    const mesa = data.mesas[(i * 3) % data.mesas.length];
    data.reservas.push({ id_reserva: data.reservas.length + 1, fecha_reserva: dateText(addDays(end, i)), hora_reserva: '13:00:00', cantidad_personas: Math.min(4, mesa.capacidad), estado_reserva: i % 3 === 0 ? 'pendiente' : 'confirmada', id_usuario: 6 + i, id_mesa: mesa.id_mesa });
  }
  addExperienceExamples(data, cutoff);
  // Se incorpora después del historial ficticio: no inventa ventas, clientes o visitas del café real.
  addSorrentoDataset(data, DEMO_PASSWORD);
  normalizeDataset(data);
  data.meta.filas = Object.fromEntries(TABLES.map(t => [t, data[t].length]));
  return data;
}
function addExperienceExamples(data, cutoff, {legacy=[]}={}) {
  const start=new Date(`${cutoff}T12:00:00Z`);
  const offset=Math.max(0,...legacy.map(e=>Number(e.id_experiencia)));
  data.experiencias=[...legacy,...[
    ['Cata de cafés del Quindío','Conoce aromas y métodos de preparación de cafés de origen.',1,90,12,35000],
    ['Taller de cocina cafetera','Prepara recetas tradicionales con ingredientes de la región.',2,120,10,48000],
    ['Chocolate y sabores de la región','Degustación guiada de cacao y productos locales.',3,75,10,28000]
  ].map((v,i)=>({id_experiencia:offset+i+1,id_restaurante:v[2],nombre:v[0],descripcion:v[1],fecha_hora:`${dateText(addDays(start,3+i*2))} 15:00:00`,duracion_minutos:v[3],cupos:v[4],precio:v[5],estado:'activa'}))];
  const first=data.experiencias[offset?legacy.length:0];
  data.reservas_experiencias=[{id_reserva_experiencia:1,id_experiencia:first.id_experiencia,id_usuario:data.usuarios.find(u=>u.tipo_usuario==='cliente').id_usuario,cantidad_personas:2,fecha_reserva:`${cutoff} 10:00:00`,estado:'confirmada',precio_unitario:first.precio,referencia:'20261110-0000-4000-8000-000000000001',estado_pago:'pendiente',id_metodo:null,fecha_pago:null,cobrado_por:null}];
  data.meta.experiencias_desde=cutoff;
  return data;
}
function sqlValue(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function generateSeedSQL(data) {
  const lines = [ '-- Datos ficticios generados; no borra ni sustituye registros existentes.', `-- Fecha de corte: ${data.meta.fecha_corte}; zona horaria: America/Bogota.`, 'USE gastronomia_turistica_academica;', "SET NAMES utf8mb4;", "SET time_zone = '-05:00';", 'START TRANSACTION;' ];
  for (const table of TABLES) {
    const rows = data[table];
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]).filter(c => c !== 'detalles');
    for (let offset = 0; offset < rows.length; offset += 150) {
      lines.push(`\nINSERT IGNORE INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES\n${rows.slice(offset, offset + 150).map(row => `(${columns.map(c => sqlValue(row[c])).join(', ')})`).join(',\n')};`);
    }
  }
  lines.push('COMMIT;', '');
  return lines.join('\n');
}
function writeDataset(cutoff) {
  const data = generateDataset(cutoff);
  const root = path.join(__dirname, '..');
  fs.mkdirSync(path.join(root, 'database'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'demo-data.json'), JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'database', 'seed.sql'), generateSeedSQL(data));
  fs.writeFileSync(path.join(root, 'database', 'demo-inicial.sql'), fs.readFileSync(path.join(root, 'schema.sql'), 'utf8') + '\n' + generateSeedSQL(data));
  console.log(JSON.stringify({ fecha_corte: data.meta.fecha_corte, tablas: TABLES.length, filas: data.meta.filas }, null, 2));
  return data;
}
if (require.main === module) {
  const option = process.argv.find(arg => arg.startsWith('--fecha='));
  writeDataset(option ? option.slice(8) : todayBogota());
}
module.exports = { generateDataset, generateSeedSQL, writeDataset, TABLES, todayBogota, addExperienceExamples };
