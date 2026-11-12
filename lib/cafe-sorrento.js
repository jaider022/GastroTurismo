'use strict';

// Datos comunicados por Jaider. Las mesas y el aforo son configuración académica provisional.
const sorrento = {
  nombre: 'Café Sorrento',
  direccion: 'Mall Privilegio, Armenia · dirección exacta por confirmar',
  telefono: null,
  email: null,
  capacidad_total: 30,
  especialidad: 'Café, desayunos, hamburguesas, pizza, rollitos, maicitos y chocolate artesanal',
  zona: 'Mall Privilegio',
  municipio: 'Armenia',
  cuenta: 'gestion.sorrento@gastroturismo.example',
  mesas: [2, 2, 2, 2, 2, 4, 4, 4, 4, 4]
};

function addSorrentoDataset(data, password) {
  if (data.restaurantes.some(r => r.nombre === sorrento.nombre)) return data;
  const nextId = (table, key) => Math.max(0, ...data[table].map(row => Number(row[key]))) + 1;
  const ownerId = nextId('usuarios', 'id_usuario');
  const zoneId = nextId('zonas', 'id_zona');
  const restaurantId = nextId('restaurantes', 'id_restaurante');
  data.usuarios.push({ id_usuario: ownerId, nombre: 'Gestión Café Sorrento (por asignar)', correo: sorrento.cuenta,
    contrasena: password, telefono: null, tipo_usuario: 'restaurante', fecha_registro: `${data.meta.fecha_corte} 09:00:00` });
  const municipality = data.municipios?.find(row => row.nombre_municipio === sorrento.municipio);
  data.zonas.push({ id_zona: zoneId, nombre_zona: sorrento.zona,
    ...(municipality ? { id_municipio: municipality.id_municipio } : { ciudad: sorrento.municipio }),
    descripcion_turistica: 'Mall en Armenia; ubicación indicada por el equipo para Café Sorrento.' });
  const { nombre, direccion, telefono, email, capacidad_total, especialidad } = sorrento;
  data.restaurantes.push({ id_restaurante: restaurantId, nombre, direccion, telefono, email, capacidad_total, especialidad,
    id_zona: zoneId, id_propietario: ownerId });
  for (const [index, capacidad] of sorrento.mesas.entries()) data.mesas.push({ id_mesa: nextId('mesas', 'id_mesa'),
    numero_mesa: `Mesa ${index + 1}`, capacidad, ubicacion: 'Salón · distribución por confirmar',
    estado: 'disponible', id_restaurante: restaurantId });
  data.meta.sorrento = { fuente: 'Datos comunicados por Jaider; mesas y aforo provisionales',
    horario: 'Lunes a domingo, 08:30–22:30', precios_confirmados: false };
  return data;
}

module.exports = { sorrento, addSorrentoDataset };
