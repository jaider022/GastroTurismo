// ====================================================================
// APPLICACIÓN PRINCIPAL JS - GASTROTURISMO (EJE CAFETERO)
// ====================================================================

// --------------------------------------------------------------------
// 1. BASE DE DATOS DE SEMILLA / COPIA EN LOCALSTORAGE (MOCK FALLBACK)
// --------------------------------------------------------------------
// El mismo conjunto académico alimenta la demostración y el SQL de MySQL.
let demoDataset = null;
const DEMO_NAMESPACE = 'gt_academico_v2:';
const DEMO_TABLE_KEYS = {
  zonas: 'gt_zonas', planes_suscripcion: 'gt_planes', metodos_pago: 'gt_metodos',
  categorias: 'gt_categorias', usuarios: 'gt_usuarios', restaurantes: 'gt_restaurantes',
  mesas: 'gt_mesas', platos: 'gt_platos', reservas: 'gt_reservas', pedidos: 'gt_pedidos',
  detalle_pedidos: 'gt_detalle_pedidos', pagos: 'gt_pagos', resenas: 'gt_resenas',
  notificaciones: 'gt_notificaciones', visitas: 'gt_visitas', accesos_sistema: 'gt_accesos_sistema'
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function bogotaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${v.year}-${v.month}-${v.day} ${v.hour}:${v.minute}:${v.second}`;
}

// --------------------------------------------------------------------
// 2. CONFIGURACIÓN DEL SISTEMA
// --------------------------------------------------------------------
let API_BASE_URL = '/api';
let isConnectedToDB = false;
let currentUser = null;
let dbStatus = {};
let currentCart = [];
let chartInstanceDashboard1 = null;
let chartInstanceDashboard2 = null;
let chartInstanceReport = null;

// Inicializa LocalStorage si no existen datos
function initLocalStorageData(force = false) {
  if (!demoDataset) throw new Error('No se cargó la semilla académica. Recarga la página.');
  for (const [table, key] of Object.entries(DEMO_TABLE_KEYS)) {
    if (force || localStorage.getItem(DEMO_NAMESPACE + key) === null) {
      localStorage.setItem(DEMO_NAMESPACE + key, JSON.stringify(demoDataset[table] || []));
    }
  }
  localStorage.setItem(DEMO_NAMESPACE + 'version', String(demoDataset.meta?.version || '2'));
}
const getLS = key => JSON.parse(localStorage.getItem(DEMO_NAMESPACE + key) || '[]');
const setLS = (key, val) => localStorage.setItem(DEMO_NAMESPACE + key, JSON.stringify(val));

// --------------------------------------------------------------------
// 3. COMPROBAR CONEXIÓN AL BACKEND REAL
// --------------------------------------------------------------------
async function checkBackendConnection() {
  try {
    const res = await fetch(`${API_BASE_URL}/status`);
    const data = await res.json();
    dbStatus = data;
    isConnectedToDB = data.connected;
  } catch (error) {
    dbStatus = { connected: false, error: error.message };
    isConnectedToDB = false;
  }
  updateDbStatusUI();
}

function updateDbStatusUI() {
  const loginBadge = document.getElementById('login-db-status');
  const loginText = document.getElementById('login-db-text');
  const mainBadge = document.getElementById('main-db-status');
  const mainText = document.getElementById('main-db-text');

  const statusClass = isConnectedToDB ? 'online' : 'offline';
  const statusText = isConnectedToDB ? 'Backend Real: MySQL Conectado' : 'Modo Demo: LocalStorage Activo';

  if (loginBadge) {
    loginBadge.className = `db-status-badge ${statusClass}`;
    loginText.textContent = statusText;
  }
  if (mainBadge) {
    mainBadge.className = `db-status-badge ${statusClass}`;
    mainText.textContent = statusText;
  }
}

// --------------------------------------------------------------------
// 4. SISTEMA DE LLAMADAS API CON FALLBACK AUTOMÁTICO
// --------------------------------------------------------------------
async function requestAPI(endpoint, options = {}) {
  if (isConnectedToDB) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/${endpoint}`, { ...options, credentials: 'same-origin' });
    } catch (_) {
      throw new Error('Se perdió la conexión con el servidor. No se guardaron datos en la demostración.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `No se pudo completar la operación (${response.status}).`);
    return data;
  }
  return simulateLocalStorageAPI(endpoint, options);
}

// Simulación de CRUD en LocalStorage
function simulateLocalStorageAPI(endpoint, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  const [route, queryString = ''] = endpoint.split('?');
  const params = new URLSearchParams(queryString);
  const parts = route.split('/');
  const base = parts[0];
  const param = parts[1];

  console.log(`[MOCK DB] ${method} a /api/${endpoint}`);

  switch (base) {
    case 'auth':
      if (param === 'login') {
        const users = getLS('gt_usuarios');
        const match = users.find(u => u.correo === body.correo && u.contrasena === body.contrasena);
        if (!match) throw new Error('Credenciales inválidas.');
        const accesses = getLS('gt_accesos_sistema');
        accesses.push({ id_acceso: Date.now(), id_usuario: match.id_usuario, fecha_ingreso: bogotaNow() });
        setLS('gt_accesos_sistema', accesses);
        const { contrasena: ignored, ...safeUser } = match;
        return { success: true, user: safeUser };
      }
      if (param === 'register') {
        const users = getLS('gt_usuarios');
        if (users.some(u => u.correo === body.correo)) throw new Error('El correo ya existe.');
        const newUser = { ...body, id_usuario: Date.now(), tipo_usuario: 'cliente', fecha_registro: bogotaNow() };
        users.push(newUser);
        setLS('gt_usuarios', users);
        const { contrasena: ignored, ...safeUser } = newUser;
        return { success: true, user: safeUser };
      }
      break;

    case 'restaurantes':
      let rests = getLS('gt_restaurantes');
      if (method === 'GET') {
        const zones = getLS('gt_zonas');
        const users = getLS('gt_usuarios');
        const plans = getLS('gt_planes');
        return rests.map(r => {
          const z = zones.find(x => x.id_zona == r.id_zona) || {};
          const u = users.find(x => x.id_usuario == r.id_propietario) || {};
          const p = plans.find(x => x.id_plan == r.id_plan) || {};
          return { ...r, nombre_zona: z.nombre_zona, ciudad: z.ciudad, nombre_propietario: u.nombre, nombre_plan: p.nombre_plan };
        });
      }
      if (method === 'POST') {
        const newR = { id_restaurante: Date.now(), ...body };
        rests.push(newR);
        setLS('gt_restaurantes', rests);
        return newR;
      }
      if (method === 'PUT') {
        rests = rests.map(r => r.id_restaurante == param ? { ...r, ...body } : r);
        setLS('gt_restaurantes', rests);
        return { message: 'Actualizado' };
      }
      if (method === 'DELETE') {
        rests = rests.filter(r => r.id_restaurante != param);
        setLS('gt_restaurantes', rests);
        return { message: 'Eliminado' };
      }
      break;

    case 'mesas':
      let mesas = getLS('gt_mesas');
      if (method === 'GET') {
        const rests = getLS('gt_restaurantes');
        return mesas.map(m => {
          const r = rests.find(x => x.id_restaurante == m.id_restaurante) || {};
          return { ...m, nombre_restaurante: r.nombre };
        });
      }
      if (method === 'POST') {
        const newM = { id_mesa: Date.now(), ...body, estado: body.estado || 'disponible' };
        mesas.push(newM);
        setLS('gt_mesas', mesas);
        return newM;
      }
      if (method === 'PUT') {
        mesas = mesas.map(m => m.id_mesa == param ? { ...m, ...body } : m);
        setLS('gt_mesas', mesas);
        return { message: 'Actualizada' };
      }
      if (method === 'DELETE') {
        mesas = mesas.filter(m => m.id_mesa != param);
        setLS('gt_mesas', mesas);
        return { message: 'Eliminada' };
      }
      break;

    case 'platos':
      let platos = getLS('gt_platos');
      if (method === 'GET') {
        const cats = getLS('gt_categorias');
        const rests = getLS('gt_restaurantes');
        return platos.map(p => {
          const c = cats.find(x => x.id_categoria == p.id_categoria) || {};
          const r = rests.find(x => x.id_restaurante == p.id_restaurante) || {};
          return { ...p, nombre_categoria: c.nombre_categoria, nombre_restaurante: r.nombre };
        });
      }
      if (method === 'POST') {
        const newP = { id_plato: Date.now(), ...body };
        platos.push(newP);
        setLS('gt_platos', platos);
        return newP;
      }
      if (method === 'PUT') {
        platos = platos.map(p => p.id_plato == param ? { ...p, ...body } : p);
        setLS('gt_platos', platos);
        return { message: 'Actualizado' };
      }
      if (method === 'DELETE') {
        platos = platos.filter(p => p.id_plato != param);
        setLS('gt_platos', platos);
        return { message: 'Eliminado' };
      }
      break;

    case 'reservas':
      let reservas = getLS('gt_reservas');
      if (method === 'GET') {
        const users = getLS('gt_usuarios');
        const mesas = getLS('gt_mesas');
        const rests = getLS('gt_restaurantes');
        return reservas.map(res => {
          const u = users.find(x => x.id_usuario == res.id_usuario) || {};
          const m = mesas.find(x => x.id_mesa == res.id_mesa) || {};
          const r = rests.find(x => x.id_restaurante == m.id_restaurante) || {};
          return {
            ...res,
            nombre_usuario: u.nombre,
            correo_usuario: u.correo,
            numero_mesa: m.numero_mesa,
            ubicacion_mesa: m.ubicacion,
            nombre_restaurante: r.nombre,
            id_restaurante: r.id_restaurante
          };
        }).sort((a,b) => b.fecha_reserva.localeCompare(a.fecha_reserva));
      }
      if (method === 'POST') {
        const newRes = { id_reserva: Date.now(), ...body, estado_reserva: body.estado_reserva || 'pendiente' };
        reservas.push(newRes);
        setLS('gt_reservas', reservas);

        // Bloquear mesa
        let mList = getLS('gt_mesas');
        mList = mList.map(m => m.id_mesa == body.id_mesa ? { ...m, estado: 'reservada' } : m);
        setLS('gt_mesas', mList);

        // Crear notificación
        let notifications = getLS('gt_notificaciones');
        notifications.push({
          id_notificacion: Date.now(),
          mensaje: `Tu reserva para el día ${body.fecha_reserva} a las ${body.hora_reserva} ha sido registrada.`,
          fecha_envio: new Date().toISOString(),
          leido: false,
          id_usuario: body.id_usuario
        });
        setLS('gt_notificaciones', notifications);

        return newRes;
      }
      if (method === 'PUT') {
        reservas = reservas.map(res => {
          if (res.id_reserva == param) {
            // Actualizar mesa antigua
            let mList = getLS('gt_mesas');
            if (body.id_mesa_anterior && body.id_mesa_anterior != body.id_mesa) {
              mList = mList.map(m => m.id_mesa == body.id_mesa_anterior ? { ...m, estado: 'disponible' } : m);
            }
            if (body.estado_reserva === 'cancelada' || body.estado_reserva === 'finalizada') {
              mList = mList.map(m => m.id_mesa == body.id_mesa ? { ...m, estado: 'disponible' } : m);
            } else {
              mList = mList.map(m => m.id_mesa == body.id_mesa ? { ...m, estado: 'reservada' } : m);
            }
            setLS('gt_mesas', mList);
            return { ...res, ...body };
          }
          return res;
        });
        setLS('gt_reservas', reservas);
        return { message: 'Actualizada' };
      }
      if (method === 'DELETE') {
        const target = reservas.find(r => r.id_reserva == param);
        if (target) {
          let mList = getLS('gt_mesas');
          mList = mList.map(m => m.id_mesa == target.id_mesa ? { ...m, estado: 'disponible' } : m);
          setLS('gt_mesas', mList);
        }
        reservas = reservas.filter(r => r.id_reserva != param);
        setLS('gt_reservas', reservas);
        return { message: 'Eliminada' };
      }
      break;

    case 'pedidos':
      let pedidos = getLS('gt_pedidos');
      if (method === 'GET') {
        const users = getLS('gt_usuarios');
        const rests = getLS('gt_restaurantes');
        return pedidos.map(p => {
          const u = users.find(x => x.id_usuario == p.id_usuario) || {};
          const r = rests.find(x => x.id_restaurante == p.id_restaurante) || {};
          return { ...p, nombre_usuario: u.nombre, nombre_restaurante: r.nombre };
        }).sort((a,b) => b.fecha_pedido.localeCompare(a.fecha_pedido));
      }
      if (method === 'POST') {
        const id_pedido = Date.now();
        const platosLS = getLS('gt_platos');
        
        // Formar el array de detalles inyectando nombres de platos
        const details = body.platos.map(pl => {
          const matchPlato = platosLS.find(x => x.id_plato == pl.id_plato) || {};
          return {
            id_plato: pl.id_plato,
            cantidad: pl.cantidad,
            precio_unitario: pl.precio_unitario,
            nombre_plato: matchPlato.nombre || "Plato"
          };
        });

        const newP = {
          id_pedido,
          fecha_pedido: new Date().toISOString(),
          tipo_servicio: body.tipo_servicio,
          estado_pedido: 'en preparacion',
          total_pago: body.total_pago,
          direccion_entrega: body.direccion_entrega || null,
          id_usuario: body.id_usuario,
          id_restaurante: body.id_restaurante,
          detalles: details
        };
        pedidos.push(newP);
        setLS('gt_pedidos', pedidos);
        return newP;
      }
      if (method === 'PUT') {
        pedidos = pedidos.map(p => p.id_pedido == param ? { ...p, estado_pedido: body.estado_pedido } : p);
        setLS('gt_pedidos', pedidos);
        return { message: 'Actualizado' };
      }
      break;

    case 'resenas':
      let resenas = getLS('gt_resenas');
      if (method === 'GET') {
        const users = getLS('gt_usuarios');
        const rests = getLS('gt_restaurantes');
        return resenas.map(re => {
          const u = users.find(x => x.id_usuario == re.id_usuario) || {};
          const r = rests.find(x => x.id_restaurante == re.id_restaurante) || {};
          return { ...re, nombre_usuario: u.nombre, nombre_restaurante: r.nombre };
        }).sort((a,b) => b.fecha_opinion.localeCompare(a.fecha_opinion));
      }
      if (method === 'POST') {
        const existIdx = resenas.findIndex(r => r.id_usuario == body.id_usuario && r.id_restaurante == body.id_restaurante);
        if (existIdx >= 0) {
          resenas[existIdx] = { ...resenas[existIdx], calificacion: body.calificacion, comentario: body.comentario, fecha_opinion: new Date().toISOString().split('T')[0] };
        } else {
          resenas.push({
            id_resena: Date.now(),
            calificacion: body.calificacion,
            comentario: body.comentario,
            fecha_opinion: new Date().toISOString().split('T')[0],
            id_usuario: body.id_usuario,
            id_restaurante: body.id_restaurante
          });
        }
        setLS('gt_resenas', resenas);
        return { success: true };
      }
      break;

    case 'zonas':
      return getLS('gt_zonas');
    case 'categorias':
      return getLS('gt_categorias');
    case 'planes':
      return getLS('gt_planes');
    case 'metodos_pago':
      return getLS('gt_metodos');
    
    case 'pagos':
      if (method === 'POST') {
        const pagos = getLS('gt_pagos');
        const newPag = { id_pago: Date.now(), ...body, fecha_pago: new Date().toISOString(), estado_pago: 'aprobado' };
        pagos.push(newPag);
        setLS('gt_pagos', pagos);

        // Si es pago de plan suscripción
        if (body.id_plan) {
          let restsList = getLS('gt_restaurantes');
          restsList = restsList.map(r => r.id_propietario == body.id_usuario ? { ...r, id_plan: body.id_plan } : r);
          setLS('gt_restaurantes', restsList);
        }
        return newPag;
      }
      break;

    case 'notificaciones':
      let notifs = getLS('gt_notificaciones');
      if (method === 'GET') {
        // param es id_usuario
        return notifs.filter(n => n.id_usuario == param).sort((a,b) => b.fecha_envio.localeCompare(a.fecha_envio));
      }
      if (parts[1] === 'leer') {
        const targetId = parts[2];
        notifs = notifs.map(n => n.id_notificacion == targetId ? { ...n, leido: true } : n);
        setLS('gt_notificaciones', notifs);
        return { message: 'Leida' };
      }
      break;

    case 'visitas':
      return simulateVisitas(method, body);
    case 'reportes':
      if ([11, 12].includes(Number(param))) return calculateMonthlyReport(Number(param), params);
      return calculateMockReport(param);
  }
}

// --------------------------------------------------------------------
// 5. CÁLCULO DE LOS 10 REPORTES EN LOCALSTORAGE (MOCK DE CONSULTAS)
// --------------------------------------------------------------------
function calculateMockReport(reportId) {
  console.log(`[MOCK DB] Calculando Reporte #${reportId}`);
  
  const rests = getLS('gt_restaurantes');
  const users = getLS('gt_usuarios');
  const platos = getLS('gt_platos');
  const resenas = getLS('gt_resenas');
  const reservas = getLS('gt_reservas');
  const mesas = getLS('gt_mesas');
  const zonas = getLS('gt_zonas');
  const pedidos = getLS('gt_pedidos');
  const categorias = getLS('gt_categorias');

  switch (parseInt(reportId)) {
    case 1:
      // Directorio completo restaurantes
      return rests.map(r => ({
        Restaurante: r.nombre,
        Direccion: r.direccion,
        Telefono: r.telefono,
        Correo: r.email,
        Aforo: r.capacidad_total
      }));
    case 2:
      // Clientes registrados
      return users.filter(u => u.tipo_usuario === 'cliente').map(u => ({
        Cliente: u.nombre,
        Email: u.correo,
        Celular: u.telefono || 'N/A',
        Registro: u.fecha_registro ? u.fecha_registro.split('T')[0] : 'Sin fecha'
      }));
    case 3:
      // Platos disponibles
      return platos.filter(p => p.disponibilidad).map(p => ({
        Plato: p.nombre,
        Descripcion: p.descripcion,
        Precio: `$${p.precio.toLocaleString()} COP`,
        Disponible: 'Sí'
      }));
    case 4:
      // Calificación promedio por restaurante
      return rests.map(r => {
        const reList = resenas.filter(x => x.id_restaurante == r.id_restaurante);
        const count = reList.length;
        const avg = count > 0 ? (reList.reduce((acc, curr) => acc + curr.calificacion, 0) / count) : 0;
        return {
          Restaurante: r.nombre,
          'Total Resenas': count,
          'Calificacion Promedio': count > 0 ? parseFloat(avg.toFixed(1)) : 'Sin opiniones'
        };
      }).sort((a,b) => (b['Calificacion Promedio'] === 'Sin opiniones' ? 0 : b['Calificacion Promedio']) - (a['Calificacion Promedio'] === 'Sin opiniones' ? 0 : a['Calificacion Promedio']));
    case 5:
      // Reservas por zona turística
      return zonas.map(z => {
        const rIds = rests.filter(r => r.id_zona == z.id_zona).map(r => r.id_restaurante);
        const mIds = mesas.filter(m => rIds.includes(m.id_restaurante)).map(m => m.id_mesa);
        const resCount = reservas.filter(res => mIds.includes(res.id_mesa)).length;
        return {
          Zona: z.nombre_zona,
          Municipio: z.ciudad,
          Reservas: resCount
        };
      }).sort((a,b) => b.Reservas - a.Reservas);
    case 6:
      // Ingresos totales por restaurante
      return rests.map(r => {
        const pList = pedidos.filter(p => p.id_restaurante == r.id_restaurante && p.estado_pedido === 'entregado');
        const sum = pList.reduce((acc, curr) => acc + curr.total_pago, 0);
        return {
          Restaurante: r.nombre,
          Pedidos: pList.length,
          'Ingresos Totales': sum
        };
      }).sort((a,b) => b['Ingresos Totales'] - a['Ingresos Totales']);
    case 7:
      // Ocupación de mesas
      return rests.map(r => {
        const mList = mesas.filter(m => m.id_restaurante == r.id_restaurante);
        const total = mList.length;
        const disp = mList.filter(m => m.estado === 'disponible').length;
        const res = mList.filter(m => m.estado === 'reservada').length;
        return {
          Restaurante: r.nombre,
          'Total Mesas': total,
          Disponibles: disp,
          Reservadas: res
        };
      });
    case 8:
      // Restaurantes que superan el promedio de la plataforma
      const allRates = resenas.map(r => r.calificacion);
      const generalAvg = allRates.length > 0 ? (allRates.reduce((a,b)=>a+b, 0) / allRates.length) : 0;
      
      return rests.map(r => {
        const reList = resenas.filter(x => x.id_restaurante == r.id_restaurante);
        const avg = reList.length > 0 ? (reList.reduce((acc, curr) => acc + curr.calificacion, 0) / reList.length) : 0;
        return {
          Restaurante: r.nombre,
          Calificacion: parseFloat(avg.toFixed(2)),
          'Promedio General': parseFloat(generalAvg.toFixed(2))
        };
      }).filter(item => item.Calificacion > generalAvg);
    case 9:
      // Clientes VIP
      const uResCount = users.filter(u => u.tipo_usuario === 'cliente').map(u => {
        const count = reservas.filter(r => r.id_usuario == u.id_usuario).length;
        return { user: u, count };
      });
      const validUCounts = uResCount.filter(x => x.count > 0);
      const avgRes = validUCounts.length > 0 ? (validUCounts.reduce((acc,curr)=>acc+curr.count,0)/validUCounts.length) : 0;
      
      return uResCount.filter(x => x.count > avgRes).map(x => ({
        Cliente: x.user.nombre,
        Email: x.user.correo,
        'Total Reservas': x.count
      })).sort((a,b) => b['Total Reservas'] - a['Total Reservas']);
    case 10:
      // Platos más vendidos por categoría por encima de la media de su categoría
      const salesMap = {};
      pedidos.forEach(p => {
        p.detalles.forEach(d => {
          salesMap[d.id_plato] = (salesMap[d.id_plato] || 0) + d.cantidad;
        });
      });

      // Calcular medias por categoría
      const categoryAverages = {};
      categorias.forEach(cat => {
        const catPlatos = platos.filter(p => p.id_categoria == cat.id_categoria);
        const sales = catPlatos.map(p => salesMap[p.id_plato] || 0);
        const totalSales = sales.reduce((a,b)=>a+b, 0);
        categoryAverages[cat.id_categoria] = catPlatos.length > 0 ? (totalSales / catPlatos.length) : 0;
      });

      const rep10 = [];
      platos.forEach(p => {
        const sold = salesMap[p.id_plato] || 0;
        const threshold = categoryAverages[p.id_categoria];
        if (sold >= threshold && sold > 0) {
          const cat = categorias.find(c => c.id_categoria == p.id_categoria) || {};
          rep10.push({
            Plato: p.nombre,
            Categoria: cat.nombre_categoria,
            Vendidos: sold
          });
        }
      });
      return rep10.sort((a,b) => b.Vendidos - a.Vendidos);
  }
  return [];
}

// --------------------------------------------------------------------
// 6. CONTROLADORES DE RUTA & CAMBIO DE SECCIÓN
// --------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Los controles no dependen de las bibliotecas visuales externas.
  setupEventHandlers();
  try {
    const seedResponse = await fetch('demo-data.json');
    if (!seedResponse.ok) throw new Error('No se encontró el archivo de datos académicos.');
    demoDataset = await seedResponse.json();
    initLocalStorageData();
    await checkBackendConnection();
    if (isConnectedToDB) {
      try { const session = await requestAPI('auth/me'); currentUser = session.user || null; } catch (_) { currentUser = null; }
    } else {
      const stored = localStorage.getItem(DEMO_NAMESPACE + 'gt_logged_user');
      currentUser = stored ? JSON.parse(stored) : null;
    }
    initApp();
    document.getElementById('report-fecha-corte').value = bogotaToday();
    document.getElementById('report-fecha-corte').max = bogotaToday();
  } catch (error) {
    showLogin();
    showToast(error.message, 'danger');
    document.getElementById('login-db-text').textContent = 'No se pudieron cargar los datos: recarga la página.';
  }
});

function initApp() {
  if (window.lucide) lucide.createIcons();
  if (currentUser) showDashboard(); else showLogin();
}

function setupEventHandlers() {
  // Navegación Sidebar
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      
      // Título de topbar
      document.getElementById('current-section-title').textContent = item.textContent.trim();
      
      // Acciones adicionales por sección
      if (target === 'section-dashboard') renderDashboardStats();
      if (target === 'section-restaurantes') renderRestaurantes();
      if (target === 'section-mesas') loadMesasFilterRestaurantes();
      if (target === 'section-reservas') renderReservas();
      if (target === 'section-pedidos') loadPedidosSection();
      if (target === 'section-resenas') loadResenasSection();
      if (target === 'section-reportes') loadReportesSection();
      if (target === 'section-asistencia') loadAsistenciaSection();
      if (target === 'section-documentos') loadDocumentosSection();
    });
  });

  // Toggle Auth Forms
  document.getElementById('go-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-login').classList.remove('active');
    document.getElementById('form-register').classList.add('active');
  });

  document.getElementById('go-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-register').classList.remove('active');
    document.getElementById('form-login').classList.add('active');
  });

  // Envío Form Login
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    try {
      const data = await requestAPI('auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email, contrasena: pass })
      });
      
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem(DEMO_NAMESPACE + 'gt_logged_user', JSON.stringify(currentUser));
        showToast(`¡Bienvenido de nuevo, ${currentUser.nombre}!`, 'success');
        showDashboard();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Envío Form Registro
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('register-name').value;
    const correo = document.getElementById('register-email').value;
    const telefono = document.getElementById('register-phone').value;
    const contrasena = document.getElementById('register-password').value;
    const tipo_usuario = document.getElementById('register-type').value;

    try {
      const data = await requestAPI('auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, telefono, contrasena, tipo_usuario })
      });

      if (data.success) {
        currentUser = data.user;
        localStorage.setItem(DEMO_NAMESPACE + 'gt_logged_user', JSON.stringify(currentUser));
        showToast('Cuenta creada con éxito.', 'success');
        showDashboard();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Cerrar Sesión
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (isConnectedToDB) { try { await requestAPI('auth/logout', {method:'POST'}); } catch (e) { showToast(e.message, 'danger'); return; } }
    currentUser = null;
    localStorage.removeItem(DEMO_NAMESPACE + 'gt_logged_user');
    showLogin();
  });

  // Notificaciones Campana Toggle
  document.getElementById('bell-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notification-panel').classList.toggle('active');
  });

  document.addEventListener('click', () => {
    document.getElementById('notification-panel').classList.remove('active');
  });

  // Configuración de BD Form
  document.getElementById('form-db-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const host = document.getElementById('cfg-db-host').value;
    const user = document.getElementById('cfg-db-user').value;
    const pass = document.getElementById('cfg-db-password').value;
    const dbName = document.getElementById('cfg-db-name').value;

    showToast('Guardando configuración y reconectando...', 'info');

    try {
      const res = await fetch(`${API_BASE_URL}/status/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, user, password: pass, database: dbName })
      });
      const data = await res.json();
      isConnectedToDB = data.connected;
      updateDbStatusUI();

      if (isConnectedToDB) {
        showToast('¡MySQL conectado con éxito!', 'success');
      } else {
        showToast('Fallo en MySQL. Sigues en modo LocalStorage.', 'warning');
      }
    } catch (error) {
      isConnectedToDB = false;
      updateDbStatusUI();
      showToast('No se puede conectar al servidor Express local.', 'danger');
    }
  });

  // Restaurar datos de LocalStorage
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    if (confirm('¿Estás seguro de restaurar los datos iniciales de fábrica? Esto limpiará tus cambios en LocalStorage.')) {
      initLocalStorageData(true);
      showToast('Datos restaurados. Recargando...', 'success');
      setTimeout(() => location.reload(), 1000);
    }
  });

  // Filtro mesas por restaurante
  document.getElementById('filter-mesas-restaurante').addEventListener('change', renderMesas);

  // Botón añadir restaurante
  document.getElementById('btn-add-restaurante').addEventListener('click', () => openRestauranteModal());
  document.getElementById('form-modal-restaurante').addEventListener('submit', saveRestaurante);

  // Botón añadir mesa
  document.getElementById('btn-add-mesa').addEventListener('click', () => openMesaModal());
  document.getElementById('form-modal-mesa').addEventListener('submit', saveMesa);

  // Botón nueva reserva
  document.getElementById('btn-new-reserva').addEventListener('click', () => openReservaModal());
  document.getElementById('form-modal-reserva').addEventListener('submit', saveReserva);

  // Restaurante selector en pedidos
  document.getElementById('pedido-restaurante').addEventListener('change', loadPedidoMenu);
  document.getElementById('pedido-servicio').addEventListener('change', (e) => {
    const isDelivery = e.target.value === 'delivery';
    document.getElementById('pedido-direccion-group').style.display = isDelivery ? 'block' : 'none';
  });

  // Realizar pedido
  document.getElementById('btn-checkout').addEventListener('click', executeCheckout);

  // Crear reseña
  document.getElementById('form-resena').addEventListener('submit', saveResena);

  // Cambio de reporte
  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReport(Number(btn.dataset.reportId));
    });
  });

  document.getElementById('form-report-filters').addEventListener('submit', event => { event.preventDefault(); renderReport(currentReportId); });
  document.getElementById('form-asistencia').addEventListener('submit', saveAsistencia);
  document.getElementById('asistencia-restaurante').addEventListener('change', updateAsistenciaReservas);

  // Mostrar SQL
  document.getElementById('btn-toggle-sql').addEventListener('click', () => {
    const box = document.getElementById('sql-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  // Exportar reporte a PDF
  document.getElementById('btn-export-pdf').addEventListener('click', exportReportToPDF);

  // Generar documentos
  document.getElementById('btn-gen-comprobante').addEventListener('click', () => generateDocumentPDF('reserva'));
  document.getElementById('btn-gen-factura').addEventListener('click', () => generateDocumentPDF('pedido'));
  
  // Buscar restaurantes filter
  document.getElementById('search-restaurantes').addEventListener('input', (e) => {
    renderRestaurantes(e.target.value);
  });
}

// --------------------------------------------------------------------
// 7. FLUJO DE SECCIONES (MOSTRAR U OCULTAR)
// --------------------------------------------------------------------
function showLogin() {
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'grid';

  // Cargar datos en pantalla
  document.getElementById('user-display-name').textContent = currentUser.nombre;
  document.getElementById('user-display-role').textContent = currentUser.tipo_usuario;
  document.getElementById('welcome-user-name').textContent = currentUser.nombre;
  document.getElementById('user-avatar').textContent = currentUser.nombre.substring(0, 1).toUpperCase();

  // Ajustes de rol
  const isAdmin = currentUser.tipo_usuario === 'administrador';
  const isRestOwner = currentUser.tipo_usuario === 'restaurante';
  
  document.getElementById('btn-add-restaurante').style.display = (isAdmin || isRestOwner) ? 'inline-flex' : 'none';
  document.getElementById('btn-add-mesa').style.display = (isAdmin || isRestOwner) ? 'inline-flex' : 'none';

  // Renderizar
  renderDashboardStats();
  loadNotifications();
}

// --------------------------------------------------------------------
// 8. RENDERIZACIÓN DE CONTENIDOS Y DASHBOARD STATS
// --------------------------------------------------------------------
async function renderDashboardStats() {
  try {
    const rests = await requestAPI('restaurantes');
    const resvs = await requestAPI('reservas');
    const peds = await requestAPI('pedidos');
    
    // Contar usuarios del localStorage (o API si existiera usuarios list)
    let clientsCount = 0;
    try {
      const usersList = getLS('gt_usuarios');
      clientsCount = usersList.filter(u => u.tipo_usuario === 'cliente').length;
    } catch(e) {
      clientsCount = 8;
    }

    // Set stats
    document.getElementById('stat-restaurantes').textContent = rests.length;
    document.getElementById('stat-reservas').textContent = resvs.filter(r => r.estado_reserva !== 'cancelada' && r.estado_reserva !== 'finalizada').length;
    document.getElementById('stat-pedidos').textContent = peds.filter(p => p.estado_pedido === 'entregado').length;
    document.getElementById('stat-clientes').textContent = clientsCount;

    // Renderizar Gráficos de Resumen
    renderDashboardCharts(rests, resvs, peds);

  } catch (error) {
    console.error(error);
  }
}

function renderDashboardCharts(rests, resvs, peds) {
  if (!window.Chart) return;
  // Gráfico 1: Ingresos Totales por Restaurante (COP)
  const incomeData = rests.map(r => {
    const rPeds = peds.filter(p => p.id_restaurante == r.id_restaurante && p.estado_pedido === 'entregado');
    const total = rPeds.reduce((acc, curr) => acc + curr.total_pago, 0);
    return { name: r.nombre, total };
  });

  if (chartInstanceDashboard1) chartInstanceDashboard1.destroy();
  const ctx1 = document.getElementById('chart-dashboard-ingresos').getContext('2d');
  chartInstanceDashboard1 = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: incomeData.map(d => d.name),
      datasets: [{
        label: 'Ingresos (COP)',
        data: incomeData.map(d => d.total),
        backgroundColor: 'rgba(245, 158, 11, 0.45)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Gráfico 2: Reservas por Zona
  const zonesMap = {};
  const zonesList = getLS('gt_zonas');
  const mesas = getLS('gt_mesas');

  zonesList.forEach(z => {
    zonesMap[z.id_zona] = { name: z.nombre_zona, count: 0 };
  });

  resvs.forEach(res => {
    const m = mesas.find(x => x.id_mesa == res.id_mesa);
    if (m) {
      const r = rests.find(x => x.id_restaurante == m.id_restaurante);
      if (r && zonesMap[r.id_zona]) {
        zonesMap[r.id_zona].count += 1;
      }
    }
  });

  if (chartInstanceDashboard2) chartInstanceDashboard2.destroy();
  const ctx2 = document.getElementById('chart-dashboard-reservas').getContext('2d');
  chartInstanceDashboard2 = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.values(zonesMap).map(z => z.name),
      datasets: [{
        data: Object.values(zonesMap).map(z => z.count),
        backgroundColor: [
          'rgba(16, 185, 129, 0.5)',
          'rgba(245, 158, 11, 0.5)',
          'rgba(59, 130, 246, 0.5)',
          'rgba(239, 68, 68, 0.5)',
          'rgba(139, 92, 246, 0.5)'
        ],
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } }
      }
    }
  });
}

// --------------------------------------------------------------------
// 9. MÓDULO CRUD: RESTAURANTES
// --------------------------------------------------------------------
async function renderRestaurantes(filterQuery = '') {
  const container = document.getElementById('restaurantes-container');
  container.innerHTML = '<p class="info-text">Cargando restaurantes...</p>';

  try {
    const list = await requestAPI('restaurantes');
    container.innerHTML = '';
    
    const filtered = list.filter(r => 
      r.nombre.toLowerCase().includes(filterQuery.toLowerCase()) || 
      r.especialidad.toLowerCase().includes(filterQuery.toLowerCase())
    );

    if (filtered.length === 0) {
      container.innerHTML = '<p class="info-text">No se encontraron restaurantes.</p>';
      return;
    }

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = 'restaurant-card glass';

      const isAdmin = currentUser.tipo_usuario === 'administrador';
      const isOwner = currentUser.tipo_usuario === 'restaurante' && r.id_propietario == currentUser.id_usuario;

      let actionButtons = '';
      if (isAdmin || isOwner) {
        actionButtons = `
          <button class="btn btn-sm btn-secondary" onclick="openRestauranteModal(${r.id_restaurante})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRestaurante(${r.id_restaurante})">Eliminar</button>
        `;
      } else {
        actionButtons = `
          <button class="btn btn-sm btn-primary btn-block" onclick="goToReserveFromRest(${r.id_restaurante})">Reservar Mesa</button>
        `;
      }

      card.innerHTML = `
        <div class="restaurant-badge-container">
          <h3>${r.nombre}</h3>
          <span class="role-badge" style="background: rgba(245, 158, 11, 0.15); color: var(--primary);">${r.nombre_plan || 'Básico'}</span>
        </div>
        <div class="restaurant-card-body">
          <p><i data-lucide="map-pin"></i> <span>${r.direccion} (${r.nombre_zona})</span></p>
          <p><i data-lucide="utensils"></i> <span>Especialidad: ${r.especialidad}</span></p>
          <p><i data-lucide="users-2"></i> <span>Capacidad total: ${r.capacidad_total} personas</span></p>
          <p><i data-lucide="phone"></i> <span>Tel: ${r.telefono || 'N/A'}</span></p>
        </div>
        <div class="restaurant-card-footer">
          ${actionButtons}
        </div>
      `;
      container.appendChild(card);
    });
    
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    container.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

async function openRestauranteModal(id = null) {
  const modal = document.getElementById('modal-restaurante');
  const title = document.getElementById('modal-restaurante-title');
  const form = document.getElementById('form-modal-restaurante');

  // Cargar zonas en el select
  const zonas = await requestAPI('zonas');
  const selectZona = document.getElementById('mrest-zona');
  selectZona.innerHTML = '';
  zonas.forEach(z => {
    const opt = document.createElement('option');
    opt.value = z.id_zona;
    opt.textContent = `${z.nombre_zona} - ${z.ciudad}`;
    selectZona.appendChild(opt);
  });

  if (id) {
    title.textContent = 'Editar Restaurante';
    const list = await requestAPI('restaurantes');
    const r = list.find(x => x.id_restaurante == id);
    if (r) {
      document.getElementById('mrest-id').value = r.id_restaurante;
      document.getElementById('mrest-nombre').value = r.nombre;
      document.getElementById('mrest-direccion').value = r.direccion;
      document.getElementById('mrest-telefono').value = r.telefono;
      document.getElementById('mrest-email').value = r.email;
      document.getElementById('mrest-capacidad').value = r.capacidad_total;
      document.getElementById('mrest-especialidad').value = r.especialidad;
      document.getElementById('mrest-zona').value = r.id_zona;
    }
  } else {
    title.textContent = 'Agregar Nuevo Restaurante';
    form.reset();
    document.getElementById('mrest-id').value = '';
  }

  modal.classList.add('active');
}

async function saveRestaurante(e) {
  e.preventDefault();
  const id = document.getElementById('mrest-id').value;
  const nombre = document.getElementById('mrest-nombre').value;
  const direccion = document.getElementById('mrest-direccion').value;
  const telefono = document.getElementById('mrest-telefono').value;
  const email = document.getElementById('mrest-email').value;
  const capacidad_total = parseInt(document.getElementById('mrest-capacidad').value);
  const especialidad = document.getElementById('mrest-especialidad').value;
  const id_zona = parseInt(document.getElementById('mrest-zona').value);
  
  const body = {
    nombre,
    direccion,
    telefono,
    email,
    capacidad_total,
    especialidad,
    id_zona,
    id_propietario: currentUser.id_usuario,
    id_plan: 1
  };

  try {
    if (id) {
      await requestAPI(`restaurantes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      showToast('Restaurante actualizado.', 'success');
    } else {
      await requestAPI('restaurantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      showToast('Restaurante creado con éxito.', 'success');
    }
    closeModal('modal-restaurante');
    renderRestaurantes();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function deleteRestaurante(id) {
  if (confirm('¿Estás seguro de eliminar este restaurante? Se borrarán sus mesas y menús.')) {
    try {
      await requestAPI(`restaurantes/${id}`, { method: 'DELETE' });
      showToast('Restaurante eliminado.', 'success');
      renderRestaurantes();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  }
}

function goToReserveFromRest(restId) {
  // Simula clic en el menú reservas
  const menuItem = document.querySelector('.menu-item[data-target="section-reservas"]');
  if (menuItem) {
    menuItem.click();
    openReservaModal(restId);
  }
}

// --------------------------------------------------------------------
// 10. MÓDULO CRUD: MESAS
// --------------------------------------------------------------------
async function loadMesasFilterRestaurantes() {
  const select = document.getElementById('filter-mesas-restaurante');
  const list = await requestAPI('restaurantes');
  select.innerHTML = '';
  
  list.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id_restaurante;
    opt.textContent = r.nombre;
    select.appendChild(opt);
  });

  renderMesas();
}

async function renderMesas() {
  const restId = document.getElementById('filter-mesas-restaurante').value;
  const container = document.getElementById('mesas-container');
  container.innerHTML = '<p class="info-text">Cargando mesas...</p>';
  
  if (!restId) {
    container.innerHTML = '<p class="info-text">No hay restaurantes registrados.</p>';
    return;
  }

  try {
    const list = await requestAPI('mesas');
    container.innerHTML = '';

    const filtered = list.filter(m => m.id_restaurante == restId);

    if (filtered.length === 0) {
      container.innerHTML = '<p class="info-text">Este restaurante aún no cuenta con mesas registradas.</p>';
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = `mesa-card glass ${m.estado}`;
      
      const isAdmin = currentUser.tipo_usuario === 'administrador';
      const rests = getLS('gt_restaurantes');
      const r = rests.find(x => x.id_restaurante == restId) || {};
      const isOwner = currentUser.tipo_usuario === 'restaurante' && r.id_propietario == currentUser.id_usuario;

      let deleteButton = '';
      if (isAdmin || isOwner) {
        deleteButton = `<button class="btn btn-sm btn-danger" style="margin-top: 10px; width: 100%" onclick="deleteMesa(${m.id_mesa})">Eliminar</button>`;
      }

      card.innerHTML = `
        <div class="mesa-table-icon">${m.numero_mesa.split(' ')[1] || m.numero_mesa}</div>
        <h4>${m.numero_mesa}</h4>
        <p>Capacidad: ${m.capacidad} pers.</p>
        <p class="role-badge" style="background: rgba(255,255,255,0.05); color: #fff;">${m.ubicacion}</p>
        <span class="badge-status ${m.estado}">${m.estado}</span>
        ${deleteButton}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

async function openMesaModal() {
  const modal = document.getElementById('modal-mesa');
  const select = document.getElementById('mmesa-restaurante');
  
  const rests = await requestAPI('restaurantes');
  select.innerHTML = '';
  rests.forEach(r => {
    if (currentUser.tipo_usuario === 'administrador' || r.id_propietario == currentUser.id_usuario) {
      const opt = document.createElement('option');
      opt.value = r.id_restaurante;
      opt.textContent = r.nombre;
      select.appendChild(opt);
    }
  });

  if (select.children.length === 0) {
    showToast('No tienes restaurantes creados donde añadir mesas.', 'warning');
    return;
  }

  document.getElementById('form-modal-mesa').reset();
  modal.classList.add('active');
}

async function saveMesa(e) {
  e.preventDefault();
  const id_restaurante = parseInt(document.getElementById('mmesa-restaurante').value);
  const numero_mesa = document.getElementById('mmesa-numero').value;
  const capacidad = parseInt(document.getElementById('mmesa-capacidad').value);
  const ubicacion = document.getElementById('mmesa-ubicacion').value;

  try {
    await requestAPI('mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_mesa, capacidad, ubicacion, estado: 'disponible', id_restaurante })
    });
    showToast('Mesa creada con éxito.', 'success');
    closeModal('modal-mesa');
    renderMesas();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function deleteMesa(id) {
  if (confirm('¿Estás seguro de eliminar esta mesa?')) {
    try {
      await requestAPI(`mesas/${id}`, { method: 'DELETE' });
      showToast('Mesa eliminada.', 'success');
      renderMesas();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  }
}

// --------------------------------------------------------------------
// 11. MÓDULO CRUD: RESERVAS
// --------------------------------------------------------------------
async function renderReservas() {
  const tbody = document.getElementById('reservas-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="info-text">Cargando reservas...</td></tr>';

  try {
    const list = await requestAPI('reservas');
    tbody.innerHTML = '';
    
    // Filtrar si no es admin (Clientes ven solo las suyas, propietarios las de sus restaurantes)
    let filtered = list;
    if (currentUser.tipo_usuario === 'cliente') {
      filtered = list.filter(r => r.id_usuario == currentUser.id_usuario);
    } else if (currentUser.tipo_usuario === 'restaurante') {
      const myRests = getLS('gt_restaurantes').filter(x => x.id_propietario == currentUser.id_usuario).map(x => x.id_restaurante);
      filtered = list.filter(r => myRests.includes(r.id_restaurante));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="info-text">No se encontraron reservas registradas.</td></tr>';
      return;
    }

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      
      let actionButtons = '<div class="table-actions">';
      if (r.estado_reserva === 'pendiente' || r.estado_reserva === 'confirmada') {
        actionButtons += `<button class="btn btn-sm btn-secondary" onclick="openReservaModal(null, ${r.id_reserva})" title="Editar"><i data-lucide="edit-2"></i></button> `;
        
        if (r.estado_reserva === 'pendiente') {
          if (currentUser.tipo_usuario !== 'cliente') {
            actionButtons += `<button class="btn btn-sm btn-success" onclick="updateReservaStatus(${r.id_reserva}, 'confirmada', ${r.id_mesa})" title="Confirmar"><i data-lucide="check"></i></button> `;
          }
          actionButtons += `<button class="btn btn-sm btn-danger" onclick="updateReservaStatus(${r.id_reserva}, 'cancelada', ${r.id_mesa})" title="Cancelar"><i data-lucide="x"></i></button>`;
        } else if (r.estado_reserva === 'confirmada' && currentUser.tipo_usuario !== 'cliente') {
          actionButtons += `<button class="btn btn-sm btn-secondary" onclick="updateReservaStatus(${r.id_reserva}, 'finalizada', ${r.id_mesa})" title="Finalizar"><i data-lucide="check-square"></i></button>`;
        }
      } else {
        actionButtons += `<button class="btn btn-sm btn-danger" onclick="deleteReserva(${r.id_reserva})" title="Eliminar"><i data-lucide="trash-2"></i></button>`;
      }

      // Si es administrador, siempre puede eliminar físicamente cualquier reserva
      if (currentUser.tipo_usuario === 'administrador' && r.estado_reserva !== 'cancelada' && r.estado_reserva !== 'finalizada') {
        actionButtons += ` <button class="btn btn-sm btn-danger" onclick="deleteReserva(${r.id_reserva})" title="Borrar de la BD"><i data-lucide="trash-2"></i></button>`;
      }
      actionButtons += '</div>';

      tr.innerHTML = `
        <td><strong>${r.nombre_restaurante}</strong></td>
        <td>${r.numero_mesa} (${r.ubicacion_mesa})</td>
        <td>${r.fecha_reserva}</td>
        <td>${r.hora_reserva}</td>
        <td>${r.cantidad_personas}</td>
        <td><span class="badge-status ${r.estado_reserva}">${r.estado_reserva}</span></td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

async function openReservaModal(preSelectedRestId = null, idReserva = null) {
  const modal = document.getElementById('modal-reserva');
  const title = document.getElementById('modal-reserva-title');
  const selectRest = document.getElementById('mres-restaurante');
  const selectMesa = document.getElementById('mres-mesa');
  const dateInput = document.getElementById('mres-fecha');
  const numPersonas = document.getElementById('mres-personas');
  
  const restSummary = document.getElementById('mres-restaurante-summary');
  const mesaSummary = document.getElementById('mres-mesa-summary');

  // Ocultar etiquetas informativas inicialmente
  restSummary.style.display = 'none';
  mesaSummary.style.display = 'none';
  numPersonas.removeAttribute('max');

  // Limpiar campos del formulario
  document.getElementById('form-modal-reserva').reset();
  document.getElementById('mres-id').value = '';
  document.getElementById('mres-mesa-anterior').value = '';

  const rests = await requestAPI('restaurantes');
  selectRest.innerHTML = '<option value="">Selecciona...</option>';
  rests.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id_restaurante;
    opt.textContent = r.nombre;
    selectRest.appendChild(opt);
  });

  selectMesa.innerHTML = '<option value="">Primero selecciona el restaurante...</option>';

  let currentMesaId = null;

  // Función para calcular aforo restante del restaurante para la fecha seleccionada
  const updateRestaurantAvailability = async () => {
    const rId = selectRest.value;
    const selectedDate = dateInput.value;
    
    if (rId && selectedDate) {
      const todasLasMesas = await requestAPI('mesas');
      const mesasRestaurante = todasLasMesas.filter(m => m.id_restaurante == rId);
      
      const todasLasReservas = await requestAPI('reservas');
      // Contar reservas activas en esa fecha en este local, ignorando la que estamos editando
      const reservasFecha = todasLasReservas.filter(res => 
        res.fecha_reserva === selectedDate && 
        res.id_restaurante == rId && 
        res.estado_reserva !== 'cancelada' &&
        res.id_reserva != document.getElementById('mres-id').value
      );
      
      const mesasReservadasIds = reservasFecha.map(res => res.id_mesa);
      const mesasLibres = mesasRestaurante.filter(m => !mesasReservadasIds.includes(m.id_mesa));
      const aforoLibre = mesasLibres.reduce((acc, curr) => acc + curr.capacidad, 0);

      restSummary.textContent = `Quedan ${mesasLibres.length} de ${mesasRestaurante.length} mesas disponibles (Aforo libre: ${aforoLibre} personas para esta fecha).`;
      restSummary.style.display = 'block';
    } else {
      restSummary.style.display = 'none';
    }
  };

  // Listener para cambiar mesas cuando cambia restaurante o fecha
  const loadAvailableMesas = async () => {
    const rId = selectRest.value;
    const selectedDate = dateInput.value;
    selectMesa.innerHTML = '<option value="">Cargando mesas...</option>';
    
    if (rId && selectedDate) {
      const mesas = await requestAPI('mesas');
      const mesasRestaurante = mesas.filter(m => m.id_restaurante == rId);

      const todasLasReservas = await requestAPI('reservas');
      const reservasFecha = todasLasReservas.filter(res => 
        res.fecha_reserva === selectedDate && 
        res.estado_reserva !== 'cancelada' && 
        res.id_reserva != document.getElementById('mres-id').value
      );
      const mesasReservadasIds = reservasFecha.map(res => res.id_mesa);

      // Mostrar mesas que no estén reservadas esa fecha, o incluir la mesa actual que ya tiene asignada si estamos editando
      const filtered = mesasRestaurante.filter(m => !mesasReservadasIds.includes(m.id_mesa) || m.id_mesa == currentMesaId);
      
      selectMesa.innerHTML = '';
      if (filtered.length === 0) {
        selectMesa.innerHTML = '<option value="">No hay mesas disponibles en esta fecha</option>';
        mesaSummary.style.display = 'none';
      } else {
        filtered.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id_mesa;
          opt.textContent = `${m.numero_mesa} (Capacidad: ${m.capacidad} personas - ${m.ubicacion})`;
          if (m.id_mesa == currentMesaId) {
            opt.selected = true;
          }
          selectMesa.appendChild(opt);
        });
        selectMesa.onchange(); // Disparar cambio de mesa para calcular límites
      }
    } else {
      selectMesa.innerHTML = '<option value="">Primero selecciona el restaurante y fecha...</option>';
      mesaSummary.style.display = 'none';
    }
    await updateRestaurantAvailability();
  };

  // Listener al seleccionar mesa (Aplica límites de capacidad por mesa)
  selectMesa.onchange = () => {
    const selectedMesaId = selectMesa.value;
    if (selectedMesaId) {
      const mesasGlobal = getLS('gt_mesas');
      const mObj = mesasGlobal.find(x => x.id_mesa == selectedMesaId);
      if (mObj) {
        numPersonas.max = mObj.capacidad;
        mesaSummary.textContent = `La ${mObj.numero_mesa} admite un límite máximo de ${mObj.capacidad} comensales.`;
        mesaSummary.style.display = 'block';
        
        // Si el valor del input supera el límite de la mesa seleccionada, reajustarlo
        if (parseInt(numPersonas.value) > mObj.capacidad) {
          numPersonas.value = mObj.capacidad;
          showToast(`Límite ajustado a la capacidad máxima de la mesa (${mObj.capacidad} personas).`, 'warning');
        }
      }
    } else {
      mesaSummary.style.display = 'none';
      numPersonas.removeAttribute('max');
    }
  };

  selectRest.onchange = loadAvailableMesas;
  dateInput.onchange = loadAvailableMesas;

  // Poner fecha mínima hoy por defecto
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;

  if (idReserva) {
    title.textContent = 'Editar Reserva';
    const list = await requestAPI('reservas');
    const res = list.find(x => x.id_reserva == idReserva);
    if (res) {
      document.getElementById('mres-id').value = res.id_reserva;
      document.getElementById('mres-mesa-anterior').value = res.id_mesa;
      currentMesaId = res.id_mesa;
      
      selectRest.value = res.id_restaurante;
      dateInput.value = res.fecha_reserva;
      
      await loadAvailableMesas(); // Cargar mesas y preseleccionar la mesa correcta en el select

      document.getElementById('mres-hora').value = res.hora_reserva.substring(0, 5); // HH:MM
      numPersonas.value = res.cantidad_personas;
      selectMesa.onchange(); // Actualizar límites en la interfaz
    }
  } else {
    title.textContent = 'Nueva Reserva de Mesa';
    if (preSelectedRestId) {
      selectRest.value = preSelectedRestId;
      await loadAvailableMesas();
    }
  }

  modal.classList.add('active');
}

async function saveReserva(e) {
  e.preventDefault();
  const id = document.getElementById('mres-id').value;
  const id_mesa_anterior = document.getElementById('mres-mesa-anterior').value;
  const id_mesa = parseInt(document.getElementById('mres-mesa').value);
  const fecha_reserva = document.getElementById('mres-fecha').value;
  const hora_reserva = document.getElementById('mres-hora').value + ':00';
  const cantidad_personas = parseInt(document.getElementById('mres-personas').value);

  if (!id_mesa) {
    showToast('Selecciona una mesa disponible.', 'warning');
    return;
  }

  try {
    if (id) {
      // Obtener la reserva actual
      const list = await requestAPI('reservas');
      const target = list.find(r => r.id_reserva == id);
      const estado_reserva = target ? target.estado_reserva : 'pendiente';

      await requestAPI(`reservas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_reserva,
          hora_reserva,
          cantidad_personas,
          estado_reserva,
          id_usuario: target ? target.id_usuario : currentUser.id_usuario,
          id_mesa,
          id_mesa_anterior: id_mesa_anterior ? parseInt(id_mesa_anterior) : id_mesa
        })
      });
      showToast('Reserva modificada con éxito.', 'success');
    } else {
      await requestAPI('reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_reserva,
          hora_reserva,
          cantidad_personas,
          estado_reserva: 'pendiente',
          id_usuario: currentUser.id_usuario,
          id_mesa
        })
      });
      showToast('Reserva realizada con éxito. Queda en estado pendiente de aprobación.', 'success');
    }
    closeModal('modal-reserva');
    renderReservas();
    loadNotifications();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function updateReservaStatus(id, newStatus, idMesa) {
  try {
    const list = await requestAPI('reservas');
    const target = list.find(r => r.id_reserva == id);
    if (!target) return;

    await requestAPI(`reservas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha_reserva: target.fecha_reserva,
        hora_reserva: target.hora_reserva,
        cantidad_personas: target.cantidad_personas,
        estado_reserva: newStatus,
        id_usuario: target.id_usuario,
        id_mesa: idMesa,
        id_mesa_anterior: idMesa
      })
    });

    showToast(`Reserva ${newStatus} con éxito.`, 'success');
    renderReservas();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function deleteReserva(id) {
  if (confirm('¿Estás seguro de eliminar esta reserva del historial?')) {
    try {
      await requestAPI(`reservas/${id}`, { method: 'DELETE' });
      showToast('Reserva eliminada con éxito.', 'success');
      renderReservas();
      loadNotifications();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  }
}

// --------------------------------------------------------------------
// 12. MÓDULO PEDIDOS, MENÚ Y CARRITO (DE COMIDA / DELIVERY)
// --------------------------------------------------------------------
async function loadPedidosSection() {
  currentCart = [];
  updateCartUI();

  // Cargar selector de restaurantes
  const rests = await requestAPI('restaurantes');
  const selectRest = document.getElementById('pedido-restaurante');
  selectRest.innerHTML = '<option value="">Selecciona un restaurante...</option>';
  rests.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id_restaurante;
    opt.textContent = r.nombre;
    selectRest.appendChild(opt);
  });

  // Cargar métodos de pago
  const metodos = await requestAPI('metodos_pago');
  const selectPay = document.getElementById('cart-payment-select');
  selectPay.innerHTML = '';
  metodos.filter(m => m.tipo_pago === 'online').forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id_metodo;
    opt.textContent = m.nombre_metodo;
    selectPay.appendChild(opt);
  });

  renderPedidosHistorial();
}

async function loadPedidoMenu() {
  const restId = document.getElementById('pedido-restaurante').value;
  const menuList = document.getElementById('pedido-menu-list');
  menuList.innerHTML = '';
  
  if (!restId) {
    menuList.innerHTML = '<p class="info-text">Selecciona un restaurante para cargar el menú.</p>';
    return;
  }

  try {
    const platos = await requestAPI('platos');
    const filtered = platos.filter(p => p.id_restaurante == restId && p.disponibilidad);

    if (filtered.length === 0) {
      menuList.innerHTML = '<p class="info-text">Este restaurante no tiene platos disponibles en su menú.</p>';
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = 'menu-item-row';
      item.innerHTML = `
        <div class="menu-item-info">
          <h5>${p.nombre}</h5>
          <p>${p.descripcion}</p>
          <span class="menu-item-price">$${p.precio.toLocaleString()} COP</span>
        </div>
        <button class="btn btn-sm btn-primary" onclick="addToCart(${p.id_plato}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio})">Agregar</button>
      `;
      menuList.appendChild(item);
    });

  } catch (error) {
    menuList.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

function addToCart(id, nombre, precio) {
  const exist = currentCart.find(item => item.id_plato === id);
  if (exist) {
    exist.cantidad += 1;
  } else {
    currentCart.push({ id_plato: id, nombre, precio_unitario: precio, cantidad: 1 });
  }
  showToast(`${nombre} agregado al resumen.`, 'success');
  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById('cart-items');
  container.innerHTML = '';

  if (currentCart.length === 0) {
    container.innerHTML = '<p class="empty-list">No has agregado platos a tu pedido.</p>';
    document.getElementById('cart-subtotal').textContent = '$0 COP';
    document.getElementById('cart-total').textContent = '$0 COP';
    return;
  }

  let subtotal = 0;
  currentCart.forEach(item => {
    const itemTotal = item.precio_unitario * item.cantidad;
    subtotal += itemTotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <h5>${item.nombre}</h5>
        <p>Precio Unitario: $${item.precio_unitario.toLocaleString()}</p>
        <p>Cantidad: 
          <button class="btn btn-secondary btn-sm" style="padding: 2px 6px" onclick="changeCartQty(${item.id_plato}, -1)">-</button> 
          <strong>${item.cantidad}</strong> 
          <button class="btn btn-secondary btn-sm" style="padding: 2px 6px" onclick="changeCartQty(${item.id_plato}, 1)">+</button>
        </p>
      </div>
      <div style="text-align: right">
        <span class="menu-item-price">$${itemTotal.toLocaleString()} COP</span>
      </div>
    `;
    container.appendChild(row);
  });

  const total = subtotal;
  document.getElementById('cart-subtotal').textContent = `$${subtotal.toLocaleString()} COP`;
  document.getElementById('cart-total').textContent = `$${total.toLocaleString()} COP`;
}

function changeCartQty(id, delta) {
  const idx = currentCart.findIndex(item => item.id_plato === id);
  if (idx >= 0) {
    currentCart[idx].cantidad += delta;
    if (currentCart[idx].cantidad <= 0) {
      currentCart.splice(idx, 1);
    }
  }
  updateCartUI();
}

async function executeCheckout() {
  if (currentCart.length === 0) {
    showToast('El carrito está vacío.', 'warning');
    return;
  }

  const id_restaurante = parseInt(document.getElementById('pedido-restaurante').value);
  const tipo_servicio = document.getElementById('pedido-servicio').value;
  const direccion_entrega = document.getElementById('pedido-direccion').value;
  const id_metodo = parseInt(document.getElementById('cart-payment-select').value);

  if (tipo_servicio === 'delivery' && !direccion_entrega.trim()) {
    showToast('Ingresa una dirección de entrega para la zona turística.', 'warning');
    return;
  }

  const subtotal = currentCart.reduce((a, c) => a + (c.precio_unitario * c.cantidad), 0);

  const payload = {
    tipo_servicio,
    total_pago: subtotal,
    direccion_entrega: tipo_servicio === 'delivery' ? direccion_entrega : null,
    id_usuario: currentUser.id_usuario,
    id_restaurante,
    platos: currentCart
  };

  try {
    const pedRes = await requestAPI('pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const id_pedido = pedRes.id_pedido;

    // Registrar Pago
    await requestAPI('pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto: subtotal,
        id_usuario: currentUser.id_usuario,
        id_metodo,
        id_pedido
      })
    });

    showToast('¡Pago aprobado y pedido enviado a cocina!', 'success');
    currentCart = [];
    updateCartUI();
    renderPedidosHistorial();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function renderPedidosHistorial() {
  const tbody = document.getElementById('pedidos-table-body');
  tbody.innerHTML = '<tr><td colspan="8" class="info-text">Cargando historial...</td></tr>';

  try {
    const list = await requestAPI('pedidos');
    tbody.innerHTML = '';

    // Filtrar según rol
    let filtered = list;
    if (currentUser.tipo_usuario === 'cliente') {
      filtered = list.filter(p => p.id_usuario == currentUser.id_usuario);
    } else if (currentUser.tipo_usuario === 'restaurante') {
      const myRests = getLS('gt_restaurantes').filter(x => x.id_propietario == currentUser.id_usuario).map(x => x.id_restaurante);
      filtered = list.filter(p => myRests.includes(p.id_restaurante));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="info-text">No has realizado pedidos aún.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      
      const platosList = p.detalles.map(d => `${d.nombre_plato} (x${d.cantidad})`).join(', ');

      let actionButtons = '';
      if (currentUser.tipo_usuario !== 'cliente' && p.estado_pedido === 'en preparacion') {
        actionButtons += `<button class="btn btn-sm btn-success" onclick="updatePedidoStatus(${p.id_pedido}, 'en camino')">Despachar</button>`;
      } else if (currentUser.tipo_usuario !== 'cliente' && p.estado_pedido === 'en camino') {
        actionButtons += `<button class="btn btn-sm btn-secondary" onclick="updatePedidoStatus(${p.id_pedido}, 'entregado')">Entregar</button>`;
      } else {
        actionButtons = '<span class="text-muted">Finalizado</span>';
      }

      tr.innerHTML = `
        <td><strong>#${p.id_pedido.toString().slice(-4)}</strong></td>
        <td>${p.nombre_restaurante}</td>
        <td>${new Date(p.fecha_pedido).toLocaleDateString()}</td>
        <td><span class="role-badge" style="background: rgba(255,255,255,0.05); color: #fff;">${p.tipo_servicio}</span></td>
        <td><strong>$${p.total_pago.toLocaleString()} COP</strong></td>
        <td><span class="badge-status ${p.estado_pedido.replace(' ', '-')}">${p.estado_pedido}</span></td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${platosList}</span></td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

async function updatePedidoStatus(id, newStatus) {
  try {
    await requestAPI(`pedidos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_pedido: newStatus })
    });
    showToast(`Pedido actualizado a ${newStatus}.`, 'success');
    renderPedidosHistorial();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// --------------------------------------------------------------------
// 13. MÓDULO RESEÑAS Y COMENTARIOS
// --------------------------------------------------------------------
async function loadResenasSection() {
  // Cargar selector de restaurantes
  const rests = await requestAPI('restaurantes');
  const select = document.getElementById('resena-restaurante');
  select.innerHTML = '<option value="">Selecciona...</option>';
  rests.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id_restaurante;
    opt.textContent = r.nombre;
    select.appendChild(opt);
  });

  renderResenasWall();
}

async function renderResenasWall() {
  const container = document.getElementById('resenas-wall-container');
  container.innerHTML = '<p class="info-text">Cargando opiniones...</p>';

  try {
    const list = await requestAPI('resenas');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<p class="info-text">Aún no hay opiniones de turistas registradas. ¡Sé el primero!</p>';
      return;
    }

    list.forEach(r => {
      const card = document.createElement('div');
      card.className = 'resena-card glass';
      
      const stars = '★'.repeat(r.calificacion) + '☆'.repeat(5 - r.calificacion);

      card.innerHTML = `
        <div class="resena-header">
          <h4>${r.nombre_usuario}</h4>
          <span class="resena-stars">${stars}</span>
        </div>
        <p class="resena-comment">${r.comentario}</p>
        <div class="resena-meta">
          <span>Restaurante: <strong>${r.nombre_restaurante}</strong></span>
          <span>Fecha: ${r.fecha_opinion}</span>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

async function saveResena(e) {
  e.preventDefault();
  const id_restaurante = parseInt(document.getElementById('resena-restaurante').value);
  const comment = document.getElementById('resena-comentario').value;
  
  // Buscar calificacion estrellas seleccionadas
  const selectedStar = document.querySelector('input[name="stars"]:checked');
  if (!selectedStar) {
    showToast('Selecciona una calificación de estrellas.', 'warning');
    return;
  }
  const rating = parseInt(selectedStar.value);

  try {
    await requestAPI('resenas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calificacion: rating,
        comentario: comment,
        id_usuario: currentUser.id_usuario,
        id_restaurante
      })
    });

    showToast('¡Gracias por tu opinión!', 'success');
    document.getElementById('form-resena').reset();
    renderResenasWall();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// --------------------------------------------------------------------
// 14. MÓDULO REPORTES (CARGA Y VIZUALIZACIÓN DE SQL CON GRÁFICOS)
// --------------------------------------------------------------------
const SQL_QUERIES = {
  1: `-- Reporte 1: Directorio Completo de Restaurantes\nSELECT \n    nombre AS 'Restaurante',\n    direccion AS 'Direccion',\n    telefono AS 'Telefono',\n    email AS 'Correo',\n    capacidad_total AS 'Aforo' \nFROM restaurantes \nORDER BY nombre;`,
  
  2: `-- Reporte 2: Clientes Registrados en la Plataforma\nSELECT \n    nombre AS 'Cliente',\n    correo AS 'Email',\n    telefono AS 'Celular',\n    DATE_FORMAT(fecha_registro, '%Y-%m-%d') AS 'Registro' \nFROM usuarios \nWHERE tipo_usuario = 'cliente' \nORDER BY fecha_registro DESC;`,
  
  3: `-- Reporte 3: Menú de Platos Disponibles en la Plataforma\nSELECT \n    nombre AS 'Plato',\n    descripcion AS 'Descripcion',\n    precio AS 'Precio',\n    IF(disponibilidad, 'Sí', 'No') AS 'Disponible' \nFROM platos \nWHERE disponibilidad = TRUE \nORDER BY precio;`,
  
  4: `-- Reporte 4: Calificación Promedio por Restaurante\nSELECT \n    r.nombre AS 'Restaurante',\n    COUNT(re.id_resena) AS 'Total Resenas',\n    ROUND(AVG(re.calificacion), 1) AS 'Calificacion Promedio' \nFROM restaurantes r \nLEFT JOIN resenas re ON r.id_restaurante = re.id_restaurante \nGROUP BY r.id_restaurante, r.nombre \nORDER BY AVG(re.calificacion) DESC;`,
  
  5: `-- Reporte 5: Reservas por Zona Turística\nSELECT \n    z.nombre_zona AS 'Zona',\n    z.ciudad AS 'Municipio',\n    COUNT(res.id_reserva) AS 'Reservas' \nFROM zonas z \nINNER JOIN restaurantes r ON z.id_zona = r.id_zona \nINNER JOIN mesas m ON r.id_restaurante = m.id_restaurante \nINNER JOIN reservas res ON m.id_mesa = res.id_mesa \nGROUP BY z.id_zona, z.nombre_zona, z.ciudad \nORDER BY Reservas DESC;`,
  
  6: `-- Reporte 6: Ingresos Totales por Restaurante (Apto para Gráfico)\nSELECT \n    r.nombre AS 'Restaurante',\n    COUNT(p.id_pedido) AS 'Pedidos',\n    COALESCE(SUM(p.total_pago), 0) AS 'Ingresos Totales' \nFROM restaurantes r \nLEFT JOIN pedidos p ON r.id_restaurante = p.id_restaurante AND p.estado_pedido = 'entregado' \nGROUP BY r.id_restaurante, r.nombre \nORDER BY \`Ingresos Totales\` DESC;`,
  
  7: `-- Reporte 7: Detalle y Ocupación de Mesas\nSELECT \n    r.nombre AS 'Restaurante',\n    COUNT(m.id_mesa) AS 'Total Mesas',\n    SUM(CASE WHEN m.estado = 'disponible' THEN 1 ELSE 0 END) AS 'Disponibles',\n    SUM(CASE WHEN m.estado = 'reservada' THEN 1 ELSE 0 END) AS 'Reservadas' \nFROM restaurantes r \nINNER JOIN mesas m ON r.id_restaurante = m.id_restaurante \nGROUP BY r.id_restaurante, r.nombre;`,
  
  8: `-- Reporte 8: Restaurantes con Calificación Superior al Promedio General\nSELECT \n    r.nombre AS 'Restaurante',\n    ROUND(AVG(re.calificacion), 2) AS 'Calificacion' \nFROM restaurantes r \nINNER JOIN resenas re ON r.id_restaurante = re.id_restaurante \nGROUP BY r.id_restaurante, r.nombre \nHAVING AVG(re.calificacion) > (SELECT AVG(calificacion) FROM resenas);`,
  
  9: `-- Reporte 9: Clientes VIP (Apto para Gráfico)\nSELECT \n    u.nombre AS 'Cliente',\n    u.correo AS 'Email',\n    COUNT(r.id_reserva) AS 'Total Reservas' \nFROM usuarios u \nINNER JOIN reservas r ON u.id_usuario = r.id_usuario \nGROUP BY u.id_usuario, u.nombre, u.correo \nHAVING COUNT(r.id_reserva) > (\n    SELECT AVG(total_res) \n    FROM (SELECT COUNT(id_reserva) AS total_res FROM reservas GROUP BY id_usuario) AS sub\n) \nORDER BY \`Total Reservas\` DESC;`,
  
  10: `-- Reporte 10: Platos más Vendidos por encima de la media de su categoría (Apto para Gráfico)\nSELECT \n    p.nombre AS 'Plato',\n    c.nombre_categoria AS 'Categoria',\n    SUM(dp.cantidad) AS 'Vendidos' \nFROM platos p \nINNER JOIN categorias c ON p.id_categoria = c.id_categoria \nINNER JOIN detalle_pedidos dp ON p.id_plato = dp.id_plato \nGROUP BY p.id_plato, p.nombre, c.nombre_categoria \nHAVING SUM(dp.cantidad) >= (\n    SELECT AVG(cantidad_plato) \n    FROM (\n        SELECT p2.id_categoria, SUM(dp2.cantidad) AS cantidad_plato \n        FROM platos p2 \n        INNER JOIN detalle_pedidos dp2 ON p2.id_plato = dp2.id_plato \n        GROUP BY p2.id_plato, p2.id_categoria\n    ) AS sub2 \n    WHERE sub2.id_categoria = p.id_categoria\n) \nORDER BY \`Vendidos\` DESC;`
};

const MONTHLY_REPORT_HEADERS = {periodo: 'Periodo', desde: 'Desde', hasta: 'Hasta', personas_atendidas: 'Personas atendidas', visitas: 'Visitas', ingresos: 'Ingresos a la aplicación', usuarios_unicos: 'Usuarios distintos'};
function reportHeaderLabel(key) {
  return [11, 12].includes(currentReportId) ? (MONTHLY_REPORT_HEADERS[key] || key) : key;
}
let currentReportId = 1;
let currentReportCriteria = '';
let currentReportData = [];
let currentReportTitle = "";

async function loadReportesSection() {
  await fillRestaurantSelect(document.getElementById('report-restaurante'), true);
  renderReport(currentReportId);
}

async function renderReport(id) {
  currentReportId = Number(id);
  document.querySelectorAll('.report-btn').forEach(button => button.classList.toggle('active', Number(button.dataset.reportId) === currentReportId));
  document.getElementById('form-report-filters').hidden = ![11,12].includes(currentReportId);
  document.getElementById('report-restaurante-group').hidden = currentReportId !== 11;
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  const chartCard = document.getElementById('report-chart-card');
  
  thead.innerHTML = '';
  tbody.innerHTML = '<tr><td class="info-text">Cargando reporte...</td></tr>';
  chartCard.style.display = 'none';

  // Mostrar SQL
  document.getElementById('sql-query-display').textContent = SQL_QUERIES[id] || monthlySQLExample(id);

  try {
    const query = new URLSearchParams({ fecha_corte: document.getElementById('report-fecha-corte').value || bogotaToday(), comparacion: document.getElementById('report-comparacion').value });
    if (id == 11 && document.getElementById('report-restaurante').value) query.set('id_restaurante', document.getElementById('report-restaurante').value);
    const data = await requestAPI(`reportes/${id}${[11,12].includes(Number(id)) ? '?' + query : ''}`);
    const source = isConnectedToDB ? 'MySQL' : 'Demostración académica: datos ficticios guardados en este navegador';
    currentReportCriteria = source + ([11,12].includes(Number(id)) ? ` · Corte ${query.get('fecha_corte')} · ${query.get('comparacion') === 'mismo_corte' ? 'Mismos días en ambos meses' : 'Mes anterior completo'}` : ' · Histórico completo');
    if (id == 11) currentReportCriteria += ' · ' + document.getElementById('report-restaurante').selectedOptions[0].textContent;
    document.getElementById('report-criteria').textContent = currentReportCriteria;
    currentReportData = data;
    
    // Set Título
    const btn = document.querySelector(`.report-btn[data-report-id="${id}"]`);
    currentReportTitle = btn ? btn.textContent.split('. ')[1] : `Reporte ${id}`;
    document.getElementById('report-title').textContent = currentReportTitle;

    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td class="info-text">No hay datos suficientes para generar este reporte.</td></tr>';
      return;
    }

    // Cabeceras de tabla
    const headers = Object.keys(data[0]);
    const trHead = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = reportHeaderLabel(h);
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // Contenido
    data.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const td = document.createElement('td');
        const value = row[h];
        
        // Formato moneda
        if (h.includes('Ingresos') || h.includes('Costo') || h.includes('Precio')) {
          td.textContent = typeof value === 'number' ? `$${value.toLocaleString()} COP` : value;
        } else {
          td.textContent = value;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // Renderizar gráficos si corresponde (Reporte 6, 9 y 10)
    if (window.Chart && [6, 9, 10].includes(parseInt(id))) {
      renderReportChart(id, data);
    }

  } catch (error) {
    tbody.innerHTML = `<tr><td class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderReportChart(id, data) {
  if (!window.Chart) return;
  const chartCard = document.getElementById('report-chart-card');
  chartCard.style.display = 'block';

  if (chartInstanceReport) chartInstanceReport.destroy();
  const ctx = document.getElementById('chart-reporte-canvas').getContext('2d');

  let labels = [];
  let values = [];
  let labelText = "";
  let chartType = "bar";

  if (id == 6) {
    labels = data.map(d => d.Restaurante);
    values = data.map(d => d['Ingresos Totales']);
    labelText = "Ingresos en Pesos (COP)";
  } else if (id == 9) {
    labels = data.map(d => d.Cliente);
    values = data.map(d => d['Total Reservas']);
    labelText = "Número de Reservas";
  } else if (id == 10) {
    labels = data.map(d => d.Plato);
    values = data.map(d => d.Vendidos);
    labelText = "Unidades Vendidas";
    chartType = "bar";
  }

  chartInstanceReport = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [{
        label: labelText,
        data: values,
        backgroundColor: 'rgba(16, 185, 129, 0.45)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: '#9ca3af' } },
        x: { ticks: { color: '#9ca3af' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function exportReportToPDF() {
  if (currentReportData.length === 0) {
    showToast('No hay datos para exportar.', 'warning');
    return;
  }

  if (!window.jspdf?.jsPDF) { printCurrentReport(); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  if (typeof doc.autoTable !== 'function') { printCurrentReport(); return; }

  // Encabezado estético Universidad del Quindío
  doc.setFillColor(10, 15, 29);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GASTROTURISMO Q.', 15, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Proyecto Final Bases de Datos I - Eje Cafetero', 15, 30);
  doc.text(new Date().toLocaleDateString(), 180, 30);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(currentReportTitle.toUpperCase(), 15, 55);

  const headers = Object.keys(currentReportData[0]);
  const rows = currentReportData.map(r => headers.map(h => {
    const val = r[h];
    if (h.includes('Ingresos') || h.includes('Costo') || h.includes('Precio')) {
      return `$${Number(val).toLocaleString('es-CO')} COP`;
    }
    return val;
  }));

  doc.setFontSize(8);
  const criteriaLines = doc.splitTextToSize(currentReportCriteria, 180);
  doc.text(criteriaLines, 15, 63);
  doc.autoTable({
    startY: 68 + criteriaLines.length * 4,
    head: [headers.map(reportHeaderLabel)],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: [10, 15, 29], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 15, right: 15 }
  });

  doc.save(`Reporte_${currentReportTitle.replace(/\s+/g, '_')}.pdf`);
  showToast('Reporte exportado a PDF con éxito.', 'success');
}

// --------------------------------------------------------------------
// 15. MÓDULO DOCUMENTOS & PLANTILLAS (VISTA PREVIA Y PDF)
// --------------------------------------------------------------------
async function loadDocumentosSection() {
  const selectRes = document.getElementById('doc-reserva-select');
  const selectPed = document.getElementById('doc-pedido-select');
  
  selectRes.innerHTML = '<option value="">Cargando reservas...</option>';
  selectPed.innerHTML = '<option value="">Cargando pedidos...</option>';

  try {
    const resvs = await requestAPI('reservas');
    const peds = await requestAPI('pedidos');

    selectRes.innerHTML = '';
    selectPed.innerHTML = '';

    resvs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id_reserva;
      opt.textContent = `Código #${r.id_reserva} - Cliente: ${r.nombre_usuario} (Rest: ${r.nombre_restaurante})`;
      selectRes.appendChild(opt);
    });

    peds.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_pedido;
      opt.textContent = `Factura #${p.id_pedido.toString().slice(-4)} - Cliente: ${p.nombre_usuario} (Total: $${p.total_pago.toLocaleString()})`;
      selectPed.appendChild(opt);
    });

  } catch(e) {
    console.error(e);
  }
}

let activePreviewType = "";
let activePreviewId = null;

async function generateDocumentPDF(type) {
  const previewContainer = document.getElementById('preview-doc-container');
  const previewCanvas = document.getElementById('preview-canvas-content');
  
  previewContainer.style.display = 'block';
  previewCanvas.innerHTML = 'Generando vista previa...';

  activePreviewType = type;

  if (type === 'reserva') {
    const id = document.getElementById('doc-reserva-select').value;
    activePreviewId = id;
    if (!id) {
      previewCanvas.innerHTML = 'Selecciona una reserva válida.';
      return;
    }

    const list = await requestAPI('reservas');
    const res = list.find(x => x.id_reserva == id);
    if (!res) return;

    previewCanvas.innerHTML = `
      <div class="invoice-box" style="text-align: center; border: 2px dashed #f59e0b; padding: 20px;">
        <h2 style="color: #f59e0b; font-size: 1.5rem; margin-bottom: 10px;">COMPROBANTE DE RESERVA</h2>
        <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 20px;">Código Único: <strong>RES-${res.id_reserva}</strong></p>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Restaurante:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.nombre_restaurante}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Mesa asignada:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.numero_mesa} (${res.ubicacion_mesa})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Titular Reserva:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.nombre_usuario}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Correo:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.correo_usuario}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Fecha & Hora:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.fecha_reserva} a las ${res.hora_reserva}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Cantidad Personas:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${res.cantidad_personas} adultos</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Estado actual:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #10b981; font-weight: bold;">${res.estado_reserva.toUpperCase()}</td>
          </tr>
        </table>
        
        <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 20px;">Por favor, preséntate 10 minutos antes en el establecimiento.</p>
      </div>
    `;

  } else if (type === 'pedido') {
    const id = document.getElementById('doc-pedido-select').value;
    activePreviewId = id;
    if (!id) {
      previewCanvas.innerHTML = 'Selecciona un pedido válido.';
      return;
    }

    const list = await requestAPI('pedidos');
    const ped = list.find(x => x.id_pedido == id);
    if (!ped) return;

    let itemsRows = '';
    ped.detalles.forEach(d => {
      const rowTotal = d.precio_unitario * d.cantidad;
      itemsRows += `
        <tr class="item">
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.nombre_plato} x${d.cantidad}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${rowTotal.toLocaleString()} COP</td>
        </tr>
      `;
    });

    const iva = ped.total_pago * 0.08; // Impuesto al consumo de comida colombiana 8%
    const subtotal = ped.total_pago - iva;

    previewCanvas.innerHTML = `
      <div class="invoice-box" style="border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr class="top">
            <td colspan="2">
              <table style="width: 100%;">
                <tr>
                  <td class="title" style="color: #f59e0b;">GASTROTURISMO</td>
                  <td style="text-align: right;">
                    Factura #: FACT-${ped.id_pedido.toString().slice(-6)}<br>
                    Fecha: ${new Date(ped.fecha_pedido).toLocaleDateString()}<br>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr class="information">
            <td colspan="2">
              <table style="width: 100%;">
                <tr>
                  <td>
                    Restaurante: <strong>${ped.nombre_restaurante}</strong><br>
                    Tipo Servicio: ${ped.tipo_servicio.toUpperCase()}<br>
                    Entrega: ${ped.direccion_entrega || 'Comedor del Local'}
                  </td>
                  <td style="text-align: right;">
                    Cliente: <strong>${ped.nombre_usuario}</strong><br>
                    Eje Cafetero Gastronomía
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr class="heading" style="background: #eee;">
            <td style="padding: 8px; font-weight: bold;">Plato / Bebida</td>
            <td style="padding: 8px; font-weight: bold; text-align: right;">Total</td>
          </tr>
          ${itemsRows}
          <tr class="total">
            <td></td>
            <td style="text-align: right; padding-top: 20px;">
               Subtotal: $${subtotal.toLocaleString()} COP<br>
               Impoconsumo (8%): $${iva.toLocaleString()} COP<br>
               <span style="font-size: 1.2rem; font-weight: bold; color: #10b981;">Total: $${ped.total_pago.toLocaleString()} COP</span>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
  
  // Agregar listener para descargar
  document.getElementById('btn-download-preview-pdf').onclick = downloadActivePreviewPDF;
}

function downloadActivePreviewPDF() {
  if (!activePreviewId) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if (activePreviewType === 'reserva') {
    const list = getLS('gt_reservas');
    const users = getLS('gt_usuarios');
    const mesas = getLS('gt_mesas');
    const rests = getLS('gt_restaurantes');

    const res = list.find(x => x.id_reserva == activePreviewId);
    if (!res) return;

    const u = users.find(x => x.id_usuario == res.id_usuario) || {};
    const m = mesas.find(x => x.id_mesa == res.id_mesa) || {};
    const r = rests.find(x => x.id_restaurante == m.id_restaurante) || {};

    doc.setFillColor(10, 15, 29);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(22);
    doc.text('COMPROBANTE DE RESERVA', 20, 22);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`CÓDIGO ÚNICO: RES-${res.id_reserva}`, 20, 32);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    
    const rows = [
      ['Establecimiento', r.nombre],
      ['Ubicación', r.direccion],
      ['Número de Mesa', m.numero_mesa],
      ['Ubicación Mesa', m.ubicacion],
      ['Cliente Titular', u.nombre],
      ['Contacto Tel.', u.telefono || 'N/A'],
      ['Fecha Reservada', res.fecha_reserva],
      ['Hora de Llegada', res.hora_reserva],
      ['Comensales', `${res.cantidad_personas} personas`],
      ['Estado Aprobación', res.estado_reserva.toUpperCase()]
    ];

    doc.autoTable({
      startY: 60,
      head: [['Concepto', 'Detalle']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] }
    });

    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text('Por favor, presenta este tiquete en tu celular al llegar al establecimiento gastronómico.', 20, 150);

    doc.save(`Comprobante_Reserva_${res.id_reserva}.pdf`);

  } else if (activePreviewType === 'pedido') {
    const list = getLS('gt_pedidos');
    const users = getLS('gt_usuarios');
    const rests = getLS('gt_restaurantes');

    const ped = list.find(x => x.id_pedido == activePreviewId);
    if (!ped) return;

    const u = users.find(x => x.id_usuario == ped.id_usuario) || {};
    const r = rests.find(x => x.id_restaurante == ped.id_restaurante) || {};

    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('FACTURA COMERCIAL', 20, 22);
    doc.setFontSize(10);
    doc.text(`NÚMERO DE PEDIDO: FACT-${ped.id_pedido.toString().slice(-6)}`, 20, 32);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text(`Establecimiento: ${r.nombre}`, 20, 60);
    doc.text(`Cliente: ${u.nombre}`, 20, 66);
    doc.text(`Servicio: ${ped.tipo_servicio.toUpperCase()}`, 20, 72);
    if (ped.direccion_entrega) {
      doc.text(`Dirección Delivery: ${ped.direccion_entrega}`, 20, 78);
    }

    const headers = ['Plato', 'Cantidad', 'Precio Unitario', 'Subtotal'];
    const rows = ped.detalles.map(d => [
      d.nombre_plato,
      d.cantidad,
      `$${d.precio_unitario.toLocaleString()} COP`,
      `$${(d.precio_unitario * d.cantidad).toLocaleString()} COP`
    ]);

    const iva = ped.total_pago * 0.08;
    const subtotal = ped.total_pago - iva;

    doc.autoTable({
      startY: 88,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.text(`Subtotal: $${subtotal.toLocaleString()} COP`, 140, finalY);
    doc.text(`Impoconsumo (8%): $${iva.toLocaleString()} COP`, 140, finalY + 6);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FACTURA: $${ped.total_pago.toLocaleString()} COP`, 140, finalY + 14);

    doc.save(`Factura_Pedido_${ped.id_pedido.toString().slice(-4)}.pdf`);
  }

  showToast('Documento exportado a PDF con éxito.', 'success');
}

// --------------------------------------------------------------------
// 16. MÓDULO NOTIFICACIONES Y RECORDATORIOS
// --------------------------------------------------------------------
async function loadNotifications() {
  const panel = document.getElementById('notifications-list');
  const countBadge = document.getElementById('notification-count');
  
  if (!currentUser) return;

  try {
    const list = await requestAPI(`notificaciones/${currentUser.id_usuario}`);
    panel.innerHTML = '';

    const unread = list.filter(n => !n.leido);
    
    if (unread.length > 0) {
      countBadge.textContent = unread.length;
      countBadge.style.display = 'flex';
    } else {
      countBadge.style.display = 'none';
    }

    if (list.length === 0) {
      panel.innerHTML = '<p class="empty-list">No tienes notificaciones pendientes.</p>';
      return;
    }

    list.forEach(n => {
      const item = document.createElement('div');
      item.className = `notification-item ${n.leido ? '' : 'unread'}`;
      item.innerHTML = `
        <p>${n.mensaje}</p>
        <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 4px;">
          ${new Date(n.fecha_envio).toLocaleTimeString()} - ${new Date(n.fecha_envio).toLocaleDateString()}
        </span>
      `;
      
      // Marcar como leída al pulsar
      item.addEventListener('click', async () => {
        if (!n.leido) {
          await requestAPI(`notificaciones/leer/${n.id_notificacion}`, { method: 'PUT' });
          loadNotifications();
        }
      });
      panel.appendChild(item);
    });

  } catch(e) {
    console.error(e);
  }
}

// --------------------------------------------------------------------
// 17. UTILERÍA GLOBO AVISO (TOAST NOTIFICATIONS) Y MODALES
// --------------------------------------------------------------------
function showToast(message, type = 'primary') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'danger') icon = 'x-circle';
  if (type === 'warning') icon = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  // Slideout y Remover
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.closeModal = closeModal;
window.deleteMesa = deleteMesa;
window.deleteRestaurante = deleteRestaurante;
window.openRestauranteModal = openRestauranteModal;
window.openMesaModal = openMesaModal;
window.addToCart = addToCart;
window.changeCartQty = changeCartQty;
window.updatePedidoStatus = updatePedidoStatus;
window.updateReservaStatus = updateReservaStatus;
window.deleteReserva = deleteReserva;
window.goToReserveFromRest = goToReserveFromRest;
// Fechas civiles de Colombia: los intervalos incluyen el día de corte completo.
function monthlyPeriods(cutoff, comparison = 'mismo_corte') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('Selecciona una fecha de corte válida.');
  const [year, month, day] = cutoff.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== cutoff) throw new Error('La fecha de corte no existe.');
  if (!['mismo_corte', 'mes_completo'].includes(comparison)) throw new Error('Comparación no válida.');
  const dateString = date => date.toISOString().slice(0, 10);
  const currentStart = new Date(Date.UTC(year, month - 1, 1));
  const previousStart = new Date(Date.UTC(year, month - 2, 1));
  const previousLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const previousDay = comparison === 'mes_completo' ? previousLastDay : Math.min(day, previousLastDay);
  return [
    {periodo: 'Mes anterior', desde: dateString(previousStart), hasta: dateString(new Date(Date.UTC(year, month - 2, previousDay)))},
    {periodo: 'Mes actual al corte', desde: dateString(currentStart), hasta: cutoff}
  ];
}

function calculateMonthlyReport(id, params) {
  const cutoff = params.get('fecha_corte') || bogotaToday();
  if (cutoff > bogotaToday()) throw new Error('La fecha de corte no puede ser futura.');
  const periods = monthlyPeriods(cutoff, params.get('comparacion') || 'mismo_corte');
  const restaurant = params.get('id_restaurante');
  return periods.map(period => {
    const rows = getLS(id === 11 ? 'gt_visitas' : 'gt_accesos_sistema').filter(row => {
      const date = String(row.fecha_ingreso).slice(0, 10);
      return date >= period.desde && date <= period.hasta && (id !== 11 || !restaurant || Number(row.id_restaurante) === Number(restaurant));
    });
    return id === 11
      ? {...period, personas_atendidas: rows.reduce((sum, row) => sum + Number(row.cantidad_personas), 0), visitas: rows.length}
      : {...period, ingresos: rows.length, usuarios_unicos: new Set(rows.map(row => Number(row.id_usuario))).size};
  });
}

function simulateVisitas(method, body) {
  const visits = getLS('gt_visitas');
  const restaurants = getLS('gt_restaurantes');
  const reservations = getLS('gt_reservas');
  const tables = getLS('gt_mesas');
  if (method === 'GET') return visits.map(visit => ({...visit, nombre_restaurante: restaurants.find(r => r.id_restaurante == visit.id_restaurante)?.nombre || 'Restaurante'})).sort((a,b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso));
  if (method !== 'POST') throw new Error('Operación de asistencia no disponible.');
  if (!currentUser || !['administrador', 'restaurante'].includes(currentUser.tipo_usuario)) throw new Error('El registro de asistencia requiere personal del restaurante.');
  const restaurant = restaurants.find(r => r.id_restaurante == body.id_restaurante);
  const count = Number(body.cantidad_personas);
  if (!restaurant || !Number.isInteger(count) || count < 1 || count > Number(restaurant.capacidad_total)) throw new Error('La cantidad debe ser positiva y no superar el aforo del restaurante.');
  const date = String(body.fecha_ingreso || '').replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(date) || date.slice(0,10) > bogotaToday()) throw new Error('La fecha de asistencia debe ser válida y no futura.');
  monthlyPeriods(date.slice(0,10));
  const clock = date.slice(11).split(':').map(Number);
  if (clock[0] > 23 || clock[1] > 59 || (clock[2] || 0) > 59 || date > bogotaNow()) throw new Error('La hora de asistencia debe ser válida y no futura.');
  let reservation = null;
  if (body.id_reserva) {
    reservation = reservations.find(r => r.id_reserva == body.id_reserva);
    const table = tables.find(m => m.id_mesa == reservation?.id_mesa);
    if (!reservation || table?.id_restaurante != body.id_restaurante) throw new Error('La reserva debe pertenecer al restaurante seleccionado.');
    if (reservation.estado_reserva === 'cancelada') throw new Error('No se puede registrar asistencia de una reserva cancelada.');
    if (count > Number(table.capacidad)) throw new Error('La asistencia supera la capacidad de la mesa reservada.');
    if (String(reservation.fecha_reserva).slice(0,10) !== date.slice(0,10)) throw new Error('La asistencia debe corresponder a la fecha de la reserva.');
    if (visits.some(v => v.id_reserva == body.id_reserva)) throw new Error('Esta reserva ya tiene registrada su asistencia.');
  }
  const visit = {id_visita: Date.now(), id_restaurante: Number(body.id_restaurante), id_reserva: reservation ? Number(reservation.id_reserva) : null, id_usuario: reservation?.id_usuario || null, fecha_ingreso: date.length === 16 ? date + ':00' : date, cantidad_personas: count};
  visits.push(visit);
  setLS('gt_visitas', visits);
  return visit;
}

async function fillRestaurantSelect(select, includeAll = false) {
  const value = select.value;
  const restaurants = await requestAPI('restaurantes');
  select.replaceChildren();
  if (includeAll) select.add(new Option('Todos los restaurantes', ''));
  for (const restaurant of restaurants) select.add(new Option(restaurant.nombre, restaurant.id_restaurante));
  if (Array.from(select.options).some(o => o.value === value)) select.value = value;
}

async function loadAsistenciaSection() {
  try {
    const canRegister = currentUser && ['administrador', 'restaurante'].includes(currentUser.tipo_usuario);
    document.getElementById('form-asistencia').hidden = !canRegister;
    await fillRestaurantSelect(document.getElementById('asistencia-restaurante'));
    const dateInput = document.getElementById('asistencia-fecha');
    dateInput.value = bogotaNow().slice(0,16).replace(' ', 'T');
    dateInput.max = bogotaNow().slice(0,16).replace(' ', 'T');
    await updateAsistenciaReservas();
    const visits = await requestAPI('visitas');
    const tbody = document.getElementById('asistencia-tbody');
    tbody.replaceChildren();
    for (const visit of visits) {
      const tr = document.createElement('tr');
      for (const value of [String(visit.fecha_ingreso).replace('T',' ').slice(0,19), visit.nombre_restaurante, visit.id_reserva ? `#${visit.id_reserva}` : 'Sin reserva', visit.cantidad_personas]) {
        const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    if (!visits.length) tbody.innerHTML = '<tr><td colspan="4">Todavía no hay asistencias registradas.</td></tr>';
    document.getElementById('asistencia-source').textContent = isConnectedToDB ? 'Asistencia registrada en MySQL.' : 'Demostración académica: las modificaciones se conservan en este navegador.';
  } catch (error) { showToast(error.message, 'danger'); }
}

async function updateAsistenciaReservas() {
  const restaurant = document.getElementById('asistencia-restaurante').value;
  const select = document.getElementById('asistencia-reserva');
  const reservations = await requestAPI('reservas');
  select.replaceChildren(new Option('Llegada sin reserva', ''));
  for (const reservation of reservations.filter(r => r.id_restaurante == restaurant && r.estado_reserva !== 'cancelada')) {
    select.add(new Option(`#${reservation.id_reserva} · ${String(reservation.fecha_reserva).slice(0,10)} · ${reservation.nombre_usuario || 'Cliente'} · ${reservation.cantidad_personas} personas`, reservation.id_reserva));
  }
}

async function saveAsistencia(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await requestAPI('visitas', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      id_restaurante: Number(document.getElementById('asistencia-restaurante').value),
      id_reserva: Number(document.getElementById('asistencia-reserva').value) || null,
      fecha_ingreso: document.getElementById('asistencia-fecha').value.replace('T',' ') + ':00',
      cantidad_personas: Number(document.getElementById('asistencia-personas').value)
    })});
    showToast('Asistencia registrada. El reporte mensual ya incluye estas personas.', 'success');
    await loadAsistenciaSection();
  } catch (error) { showToast(error.message, 'danger'); }
  finally { button.disabled = false; }
}

function monthlySQLExample(id) {
  return Number(id) === 11
    ? '-- Consulta ejecutada para cada intervalo mensual. Hasta exclusivo = día posterior al corte.\nSELECT SUM(cantidad_personas) AS personas_atendidas, COUNT(*) AS visitas\nFROM visitas\nWHERE fecha_ingreso >= ? AND fecha_ingreso < ?;\n-- Se añade id_restaurante = ? cuando existe filtro.'
    : '-- Solo inicios de sesión correctos; abrir o recargar una página no añade un acceso.\nSELECT COUNT(*) AS ingresos, COUNT(DISTINCT id_usuario) AS usuarios_unicos\nFROM accesos_sistema\nWHERE fecha_ingreso >= ? AND fecha_ingreso < ?;';
}

function printCurrentReport() {
  showToast('Se abrirá la impresión. Selecciona “Guardar como PDF”.', 'info');
  window.print();
}

