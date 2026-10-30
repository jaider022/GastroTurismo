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
        const used = getLS('gt_detalle_pedidos').some(d => d.id_plato == param) || getLS('gt_pedidos').some(p => (p.detalles || []).some(d => d.id_plato == param));
        if (used) throw new Error('Este plato tiene pedidos registrados. Puedes marcarlo como no disponible para conservar el historial.');
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
      if (!currentUser) throw new Error('Debes iniciar sesión.');
      if (method === 'GET' && parts.length === 2) {
        const userId = positiveRecordId(param);
        if (!userId) throw new Error('Usuario no válido.');
        if (userId !== Number(currentUser.id_usuario)) throw new Error('Solo puedes consultar tus notificaciones.');
        return notifs.filter(n => Number(n.id_usuario) === userId).sort(compareNotifications);
      }
      if (method === 'PUT' && parts[1] === 'leer' && parts.length === 3) {
        const targetId = positiveRecordId(parts[2]);
        if (!targetId) throw new Error('Notificación no válida.');
        if (!notifs.some(n => Number(n.id_notificacion) === targetId && Number(n.id_usuario) === Number(currentUser.id_usuario))) throw new Error('No se encontró la notificación.');
        notifs = notifs.map(n => Number(n.id_notificacion) === targetId && Number(n.id_usuario) === Number(currentUser.id_usuario) ? { ...n, leido: true } : n);
        setLS('gt_notificaciones', notifs);
        return { message: 'Leida' };
      }
      throw new Error('Operación de notificaciones no válida.');

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
      return [...rests].sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')).map(r => ({
        Restaurante: r.nombre,
        Direccion: r.direccion,
        Telefono: r.telefono,
        Correo: r.email,
        Aforo: r.capacidad_total
      }));
    case 2:
      // Clientes registrados
      return users.filter(u => u.tipo_usuario === 'cliente').sort((a,b) => String(b.fecha_registro || '').localeCompare(String(a.fecha_registro || ''))).map(u => ({
        Cliente: u.nombre,
        Email: u.correo,
        Celular: u.telefono,
        Registro: u.fecha_registro ? u.fecha_registro.slice(0, 10) : null
      }));
    case 3:
      // Platos disponibles
      return platos.filter(p => Number(p.disponibilidad) === 1).sort((a,b) => Number(a.precio) - Number(b.precio)).map(p => ({
        Plato: p.nombre,
        Descripcion: p.descripcion,
        Precio: Number(p.precio),
        Disponible: 'Sí'
      }));
    case 4:
      // Calificación promedio por restaurante
      return rests.map(r => {
        const reList = resenas.filter(x => x.id_restaurante == r.id_restaurante);
        const count = reList.length;
        const avg = count > 0 ? (reList.reduce((acc, curr) => acc + Number(curr.calificacion), 0) / count) : 0;
        return {
          Restaurante: r.nombre,
          'Total Resenas': count,
          'Calificacion Promedio': count > 0 ? Math.round((avg + Number.EPSILON) * 10) / 10 : null
        };
      }).sort((a,b) => (b['Calificacion Promedio'] ?? -Infinity) - (a['Calificacion Promedio'] ?? -Infinity));
    case 5:
      // Reservas por zona turística
      return zonas.map(z => {
        const rIds = rests.filter(r => r.id_zona == z.id_zona).map(r => Number(r.id_restaurante));
        const mIds = mesas.filter(m => rIds.includes(Number(m.id_restaurante))).map(m => Number(m.id_mesa));
        const resCount = reservas.filter(res => mIds.includes(Number(res.id_mesa))).length;
        return {
          Zona: z.nombre_zona,
          Municipio: z.ciudad,
          Reservas: resCount
        };
      }).filter(row => row.Reservas > 0).sort((a,b) => b.Reservas - a.Reservas);
    case 6:
      // Ingresos totales por restaurante
      return rests.map(r => {
        const pList = pedidos.filter(p => p.id_restaurante == r.id_restaurante && p.estado_pedido === 'entregado');
        const sum = pList.reduce((acc, curr) => acc + Number(curr.total_pago), 0);
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
      }).filter(row => row['Total Mesas'] > 0);
    case 8:
      // Restaurantes que superan el promedio de la plataforma
      const allRates = resenas.map(r => Number(r.calificacion));
      const generalAvg = allRates.length > 0 ? (allRates.reduce((a,b)=>a+b, 0) / allRates.length) : 0;
      return rests.flatMap(r => {
        const reList = resenas.filter(x => x.id_restaurante == r.id_restaurante);
        const avg = reList.length > 0 ? (reList.reduce((acc, curr) => acc + Number(curr.calificacion), 0) / reList.length) : 0;
        return reList.length && avg > generalAvg ? [{ Restaurante: r.nombre, Calificacion: Math.round((avg + Number.EPSILON) * 100) / 100 }] : [];
      });
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
      const storedDetails = getLS('gt_detalle_pedidos');
      const storedOrders = new Set(storedDetails.map(d => Number(d.id_pedido)));
      // La tabla de detalles es la fuente principal; los pedidos demo nuevos conservan detalles anidados.
      const reportDetails = storedDetails.concat(pedidos.filter(p => !storedOrders.has(Number(p.id_pedido))).flatMap(p => p.detalles || []));
      reportDetails.forEach(d => { salesMap[d.id_plato] = (salesMap[d.id_plato] || 0) + Number(d.cantidad); });

      // Calcular medias por categoría
      const categoryAverages = {};
      categorias.forEach(cat => {
        const catPlatos = platos.filter(p => p.id_categoria == cat.id_categoria && salesMap[p.id_plato] > 0);
        const sales = catPlatos.map(p => salesMap[p.id_plato]);
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
    await initApp();
    document.getElementById('report-fecha-corte').value = bogotaToday();
    document.getElementById('report-fecha-corte').max = bogotaToday();
  } catch (error) {
    showLogin();
    showToast(error.message, 'danger');
    document.getElementById('login-db-text').textContent = 'No se pudieron cargar los datos: recarga la página.';
  }
});

async function initApp() {
  if (window.lucide) lucide.createIcons();
  if (currentUser) { showDashboard(); await resumePendingReservation(); } else showLogin();
}

function setupEventHandlers() {
  document.getElementById('btn-explorar-restaurantes').addEventListener('click', showPublicRestaurants);
  document.getElementById('btn-public-login').addEventListener('click', showLogin);
  document.getElementById('public-rest-search').addEventListener('input', renderPublicRestaurants);
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
      if (target === 'section-platos') loadPlatosSection();
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
        await resumePendingReservation();
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
        await resumePendingReservation();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Cerrar Sesión
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (isConnectedToDB) { try { await requestAPI('auth/logout', {method:'POST'}); } catch (e) { showToast(e.message, 'danger'); return; } }
    currentUser = null;
    clearPendingReservation();
    localStorage.removeItem(DEMO_NAMESPACE + 'gt_logged_user');
    showLogin();
  });

  // Notificaciones Campana Toggle
  document.getElementById('bell-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('notification-panel');
    panel.classList.toggle('active');
    const expanded = panel.classList.contains('active');
    document.getElementById('bell-btn').setAttribute('aria-expanded', String(expanded));
    if (expanded) loadNotifications();
  });

  document.getElementById('notification-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('notification-filter').addEventListener('change', () => { notificationPage = 1; renderNotifications(); });
  document.getElementById('notification-prev').addEventListener('click', () => { notificationPage -= 1; renderNotifications(); });
  document.getElementById('notification-next').addEventListener('click', () => { notificationPage += 1; renderNotifications(); });

  document.addEventListener('click', () => {
    document.getElementById('notification-panel').classList.remove('active');
    document.getElementById('bell-btn').setAttribute('aria-expanded', 'false');
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
  document.getElementById('btn-add-plato').addEventListener('click', () => openPlatoModal());
  document.getElementById('form-modal-plato').addEventListener('submit', savePlato);
  document.getElementById('platos-restaurante').addEventListener('change', () => { platosAdminPage = 1; renderPlatosAdmin(); });
  for (const id of ['platos-busqueda', 'platos-disponibilidad']) {
    document.getElementById(id).addEventListener(id === 'platos-busqueda' ? 'input' : 'change', () => { platosAdminPage = 1; renderPlatosAdminPage(); });
  }
  document.getElementById('platos-anterior').addEventListener('click', () => { platosAdminPage -= 1; renderPlatosAdminPage(); });
  document.getElementById('platos-siguiente').addEventListener('click', () => { platosAdminPage += 1; renderPlatosAdminPage(); });

  // Botón nueva reserva
  document.getElementById('btn-new-reserva').addEventListener('click', () => openReservaModal());
  document.getElementById('reservas-busqueda').addEventListener('input', filterReservas);
  document.getElementById('reservas-estado').addEventListener('change', filterReservas);
  document.getElementById('reservas-fecha').addEventListener('change', filterReservas);
  document.getElementById('reservas-por-pagina').addEventListener('change', filterReservas);
  document.getElementById('reservas-limpiar').addEventListener('click', () => {
    for (const id of ['reservas-busqueda', 'reservas-estado', 'reservas-fecha']) {
      document.getElementById(id).value = '';
    }
    filterReservas();
  });
  document.getElementById('reservas-anterior').addEventListener('click', () => {
    reservasPage -= 1;
    renderReservasPage();
  });
  document.getElementById('reservas-siguiente').addEventListener('click', () => {
    reservasPage += 1;
    renderReservasPage();
  });
  document.getElementById('form-modal-reserva').addEventListener('submit', saveReserva);

  // Restaurante selector en pedidos
  document.getElementById('pedido-restaurante').addEventListener('change', loadPedidoMenu);
  document.getElementById('pedido-servicio').addEventListener('change', (e) => {
    const isDelivery = e.target.value === 'delivery';
    document.getElementById('pedido-direccion-group').style.display = isDelivery ? 'block' : 'none';
  });

  // Realizar pedido
  document.getElementById('btn-checkout').addEventListener('click', executeCheckout);
  for (const id of ['pedidos-filtro-restaurante', 'pedidos-desde', 'pedidos-hasta', 'pedidos-por-pagina']) {
    document.getElementById(id).addEventListener('change', filterPedidos);
  }
  document.getElementById('pedidos-limpiar').addEventListener('click', () => {
    for (const id of ['pedidos-filtro-restaurante', 'pedidos-desde', 'pedidos-hasta']) {
      document.getElementById(id).value = '';
    }
    filterPedidos();
  });
  document.getElementById('pedidos-anterior').addEventListener('click', () => {
    pedidosPage -= 1;
    renderPedidosPage();
  });
  document.getElementById('pedidos-siguiente').addEventListener('click', () => {
    pedidosPage += 1;
    renderPedidosPage();
  });

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
  for (const id of ['asistencia-filtro-restaurante', 'asistencia-desde', 'asistencia-hasta', 'asistencia-por-pagina']) {
    document.getElementById(id).addEventListener('change', filterAsistencia);
  }
  document.getElementById('asistencia-limpiar').addEventListener('click', () => {
    for (const id of ['asistencia-filtro-restaurante', 'asistencia-desde', 'asistencia-hasta']) {
      document.getElementById(id).value = '';
    }
    filterAsistencia();
  });
  document.getElementById('asistencia-anterior').addEventListener('click', () => {
    asistenciaPage -= 1;
    renderAsistenciaPage();
  });
  document.getElementById('asistencia-siguiente').addEventListener('click', () => {
    asistenciaPage += 1;
    renderAsistenciaPage();
  });

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
let publicRestaurants = [];
let publicCatalogRequest = 0;
let publicMenuRequest = 0;
let pendingRestaurantId = null;
let resumingPublicReservation = false;
const PENDING_RESTAURANT_KEY = 'gt_pending_restaurant';

function positiveRecordId(value) {
  if (!/^\d+$/.test(String(value ?? ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getPendingReservation() {
  try {
    const stored = sessionStorage.getItem(PENDING_RESTAURANT_KEY);
    if (stored !== null) pendingRestaurantId = positiveRecordId(stored);
  } catch (_) { /* Conserva la selección en memoria si el almacenamiento no está disponible. */ }
  return pendingRestaurantId;
}

function clearPendingReservation() {
  pendingRestaurantId = null;
  try { sessionStorage.removeItem(PENDING_RESTAURANT_KEY); } catch (_) { /* El recorrido sigue funcionando sin almacenamiento. */ }
}

async function showPublicRestaurants() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('public-container').style.display = 'block';
  window.scrollTo({ top: 0, left: 0 });
  const request = ++publicCatalogRequest;
  const container = document.getElementById('public-restaurants');
  const count = document.getElementById('public-rest-count');
  publicRestaurants = [];
  container.innerHTML = '<p class="info-text">Cargando restaurantes…</p>';
  count.textContent = '';
  try {
    const restaurants = await requestAPI('restaurantes');
    if (request !== publicCatalogRequest) return;
    publicRestaurants = restaurants.filter(r => positiveRecordId(r.id_restaurante));
    renderPublicRestaurants();
  } catch (error) {
    if (request !== publicCatalogRequest) return;
    container.innerHTML = `<p class="info-text color-danger">${escapeHTML(error.message)}</p>`;
  }
}

function renderPublicRestaurants() {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const query = normalize(document.getElementById('public-rest-search').value.trim());
  const filtered = publicRestaurants.filter(r => normalize([r.nombre, r.especialidad, r.nombre_zona, r.ciudad].join(' ')).includes(query));
  const container = document.getElementById('public-restaurants');
  container.innerHTML = '';
  document.getElementById('public-rest-count').textContent = `${filtered.length} restaurante${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) container.innerHTML = '<p class="info-text">No se encontraron restaurantes. Prueba con otro nombre, especialidad o zona.</p>';
  for (const restaurant of filtered) {
    const card = document.createElement('article');
    card.className = 'restaurant-card glass';
    card.innerHTML = `<div class="restaurant-badge-container"><h3>${escapeHTML(restaurant.nombre)}</h3></div>
      <div class="restaurant-card-body">
        <p><i data-lucide="map-pin"></i><span>${escapeHTML(restaurant.direccion)} · ${escapeHTML(restaurant.nombre_zona || restaurant.ciudad || '')}</span></p>
        <p><i data-lucide="utensils"></i><span>${escapeHTML(restaurant.especialidad || 'Cocina de la región')}</span></p>
        <p><i data-lucide="phone"></i><span>${escapeHTML(restaurant.telefono || 'Consulta al restaurante')}</span></p>
      </div><div class="restaurant-card-footer">
        <button type="button" class="btn btn-secondary" data-public-menu>Ver menú</button>
        <button type="button" class="btn btn-primary" data-public-reserve>Reservar</button>
      </div>`;
    card.querySelector('[data-public-menu]').addEventListener('click', () => openPublicMenu(restaurant.id_restaurante));
    card.querySelector('[data-public-reserve]').addEventListener('click', () => beginGuestReservation(restaurant.id_restaurante));
    container.appendChild(card);
  }
  if (window.lucide) lucide.createIcons();
}

async function openPublicMenu(value) {
  const id = positiveRecordId(value);
  const restaurant = publicRestaurants.find(r => Number(r.id_restaurante) === id);
  if (!restaurant) { showToast('Selecciona un restaurante del listado.', 'warning'); return; }
  const request = ++publicMenuRequest;
  const modal = document.getElementById('modal-public-menu');
  const container = document.getElementById('public-menu-items');
  document.getElementById('public-menu-title').textContent = `Menú · ${restaurant.nombre}`;
  document.getElementById('btn-public-reserve').onclick = () => beginGuestReservation(id);
  container.innerHTML = '<p class="info-text">Cargando menú…</p>';
  modal.classList.add('active');
  try {
    const dishes = await requestAPI('platos');
    if (request !== publicMenuRequest || !modal.classList.contains('active')) return;
    const available = dishes.filter(dish => Number(dish.id_restaurante) === id && Number(dish.disponibilidad) === 1);
    container.innerHTML = '';
    if (!available.length) container.innerHTML = '<p class="info-text">Este restaurante todavía no tiene platos disponibles en su menú.</p>';
    for (const dish of available) {
      const item = document.createElement('div');
      item.className = 'menu-item-row';
      const price = Number(dish.precio);
      item.innerHTML = `<div><h4>${escapeHTML(dish.nombre)}</h4><p>${escapeHTML(dish.descripcion)}</p><small>${escapeHTML(dish.nombre_categoria || '')}</small></div><strong>${Number.isFinite(price) ? price.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }) : 'Consultar precio'}</strong>`;
      container.appendChild(item);
    }
  } catch (error) {
    if (request === publicMenuRequest && modal.classList.contains('active')) container.innerHTML = `<p class="info-text color-danger">${escapeHTML(error.message)}</p>`;
  }
}

async function beginGuestReservation(value) {
  const id = positiveRecordId(value);
  if (!id || !publicRestaurants.some(r => Number(r.id_restaurante) === id)) {
    showToast('Selecciona un restaurante del listado.', 'warning');
    return;
  }
  pendingRestaurantId = id;
  try { sessionStorage.setItem(PENDING_RESTAURANT_KEY, String(id)); } catch (_) { /* Se conserva en memoria durante el acceso. */ }
  closeModal('modal-public-menu');
  if (currentUser) { showDashboard(); await resumePendingReservation(); } else showLogin();
}

async function resumePendingReservation() {
  const id = getPendingReservation();
  if (!currentUser || !id || resumingPublicReservation) return;
  resumingPublicReservation = true;
  try {
    const restaurants = await requestAPI('restaurantes');
    if (!restaurants.some(r => Number(r.id_restaurante) === id)) {
      clearPendingReservation();
      showToast('El restaurante seleccionado ya no está disponible. Elige otro restaurante.', 'warning');
      return;
    }
    await openReservaModal(id);
    if (document.getElementById('modal-reserva').classList.contains('active') && getPendingReservation() === id) clearPendingReservation();
  } catch (error) {
    showToast(`No se pudo continuar con la reserva: ${error.message}. Tu selección se conserva; recarga la página para reintentar.`, 'warning');
  } finally {
    resumingPublicReservation = false;
  }
}

function showLogin() {
  resetNotifications();
  document.getElementById('public-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
  const pending = getPendingReservation();
  const notice = document.getElementById('login-reserva-context');
  notice.hidden = !pending;
  notice.textContent = pending ? 'Tu restaurante está seleccionado. Inicia sesión o crea tu cuenta para continuar con la reserva.' : '';
  window.scrollTo({top: 0, left: 0});
}

function showDashboard() {
  document.getElementById('public-container').style.display = 'none';
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
  document.getElementById('menu-admin-platos').style.display = isAdmin || isRestOwner ? 'flex' : 'none';
  
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

function getChartPalette() {
  const theme = getComputedStyle(document.documentElement);
  return {
    text: theme.getPropertyValue('--text-muted').trim(),
    grid: theme.getPropertyValue('--glass-border').trim(),
    surface: theme.getPropertyValue('--glass-bg').trim()
  };
}

function renderDashboardCharts(rests, resvs, peds) {
  if (!window.Chart) return;
  const palette = getChartPalette();
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
        backgroundColor: 'rgba(230, 170, 82, 0.65)',
        borderColor: '#bf812a',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: palette.grid }, ticks: { color: palette.text } },
        x: { grid: { display: false }, ticks: { color: palette.text } }
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
          '#7aab7c', '#e6b364', '#80afbb', '#d68f75', '#b6a3bf'
        ],
        borderColor: palette.surface,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: palette.text, font: { size: 10 } } }
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
    const [list, restaurants] = await Promise.all([requestAPI('mesas'), requestAPI('restaurantes')]);
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
      const r = restaurants.find(x => x.id_restaurante == restId) || {};
      const isOwner = currentUser.tipo_usuario === 'restaurante' && r.id_propietario == currentUser.id_usuario;

      let actionButtons = '';
      if (isAdmin || isOwner) {
        actionButtons = `<div class="mesa-actions">
          <button type="button" class="btn btn-sm btn-secondary" onclick="openMesaModal(${m.id_mesa})" aria-label="Editar ${escapeHTML(m.numero_mesa)}">Editar</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteMesa(${m.id_mesa})">Eliminar</button>
        </div>`;
      }

      card.innerHTML = `
        <div class="mesa-table-icon">${escapeHTML(m.numero_mesa.split(' ')[1] || m.numero_mesa)}</div>
        <h4>${escapeHTML(m.numero_mesa)}</h4>
        <p>Capacidad: ${m.capacidad} pers.</p>
        <p class="role-badge neutral-badge">${escapeHTML(m.ubicacion)}</p>
        <span class="badge-status ${m.estado}">${m.estado}</span>
        ${actionButtons}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

async function openMesaModal(id = null) {
  const modal = document.getElementById('modal-mesa');
  const select = document.getElementById('mmesa-restaurante');
  if (!currentUser || !['administrador', 'restaurante'].includes(currentUser.tipo_usuario)) return;

  document.getElementById('form-modal-mesa').reset();
  document.getElementById('mmesa-id').value = '';
  document.getElementById('modal-mesa-title').textContent = id ? 'Editar mesa' : 'Agregar Mesa';
  document.getElementById('btn-save-mesa').textContent = id ? 'Guardar cambios' : 'Agregar Mesa';
  select.disabled = false;

  try {
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

  const selectedRestaurant = document.getElementById('filter-mesas-restaurante').value;
  if ([...select.options].some(option => option.value === selectedRestaurant)) select.value = selectedRestaurant;
  if (id) {
    const mesas = await requestAPI('mesas');
    const mesa = mesas.find(item => Number(item.id_mesa) === Number(id));
    if (!mesa || ![...select.options].some(option => Number(option.value) === Number(mesa.id_restaurante))) {
      showToast('La mesa no existe o no pertenece a tus restaurantes.', 'warning');
      return;
    }
    document.getElementById('mmesa-id').value = mesa.id_mesa;
    select.value = mesa.id_restaurante;
    select.disabled = true;
    document.getElementById('mmesa-numero').value = mesa.numero_mesa;
    document.getElementById('mmesa-capacidad').value = mesa.capacidad;
    document.getElementById('mmesa-ubicacion').value = mesa.ubicacion;
  }
  modal.classList.add('active');
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

async function saveMesa(e) {
  e.preventDefault();
  const id = document.getElementById('mmesa-id').value;
  const numero_mesa = document.getElementById('mmesa-numero').value.trim();
  const capacidad = Number(document.getElementById('mmesa-capacidad').value);
  const ubicacion = document.getElementById('mmesa-ubicacion').value.trim();
  const button = document.getElementById('btn-save-mesa');
  if (button.disabled) return;
  if (!numero_mesa || numero_mesa.length > 20 || !ubicacion || ubicacion.length > 100 || !Number.isInteger(capacidad) || capacidad < 1 || capacidad > 20) {
    showToast('Revisa el número, la ubicación y la capacidad (entre 1 y 20 personas).', 'warning');
    return;
  }
  button.disabled = true;

  try {
    const [mesas, restaurants] = await Promise.all([requestAPI('mesas'), requestAPI('restaurantes')]);
    const original = id ? mesas.find(mesa => Number(mesa.id_mesa) === Number(id)) : null;
    if (id && !original) throw new Error('La mesa ya no existe. Actualiza el listado.');
    const id_restaurante = Number(original ? original.id_restaurante : document.getElementById('mmesa-restaurante').value);
    const restaurant = restaurants.find(item => Number(item.id_restaurante) === id_restaurante);
    if (!restaurant || !currentUser || !(currentUser.tipo_usuario === 'administrador' || (currentUser.tipo_usuario === 'restaurante' && Number(restaurant.id_propietario) === Number(currentUser.id_usuario)))) {
      throw new Error('No tienes permiso para administrar mesas de este restaurante.');
    }
    if (mesas.some(mesa => Number(mesa.id_restaurante) === id_restaurante && Number(mesa.id_mesa) !== Number(id) && mesa.numero_mesa.trim().toLocaleLowerCase('es') === numero_mesa.toLocaleLowerCase('es'))) {
      throw new Error('Ya existe una mesa con ese número en el restaurante.');
    }
    if (original && capacidad < Number(original.capacidad)) {
      const reservas = await requestAPI('reservas');
      if (reservas.some(reserva => Number(reserva.id_mesa) === Number(id) && ['pendiente', 'confirmada'].includes(reserva.estado_reserva) && Number(reserva.cantidad_personas) > capacidad)) {
        throw new Error('La capacidad no puede ser menor al grupo de una reserva activa de esta mesa.');
      }
    }
    await requestAPI(id ? `mesas/${id}` : 'mesas', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_mesa, capacidad, ubicacion, estado: original ? original.estado : 'disponible', id_restaurante })
    });
    showToast(id ? 'Mesa actualizada con éxito.' : 'Mesa creada con éxito.', 'success');
    closeModal('modal-mesa');
    document.getElementById('filter-mesas-restaurante').value = id_restaurante;
    await renderMesas();
  } catch (error) {
    showToast(error.message, 'danger');
  } finally {
    button.disabled = false;
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
// ADMINISTRACIÓN DE PLATOS (INTERFAZ; PERMISOS DE SERVIDOR EN SEGUIMIENTO 15)
// --------------------------------------------------------------------
let platosAdminList = [];
let platosAdminPage = 1;
let platosAdminRequest = 0;

function canManageMenuRestaurant(restaurant) {
  return Boolean(restaurant && currentUser && (currentUser.tipo_usuario === 'administrador' ||
    (currentUser.tipo_usuario === 'restaurante' && Number(restaurant.id_propietario) === Number(currentUser.id_usuario))));
}

async function loadPlatosSection() {
  const select = document.getElementById('platos-restaurante');
  const button = document.getElementById('btn-add-plato');
  button.disabled = true;
  try {
    const restaurants = (await requestAPI('restaurantes')).filter(canManageMenuRestaurant);
    const previous = select.value;
    select.replaceChildren();
    restaurants.forEach(r => select.add(new Option(r.nombre, r.id_restaurante)));
    if (restaurants.some(r => String(r.id_restaurante) === previous)) select.value = previous;
    button.disabled = !restaurants.length;
    platosAdminPage = 1;
    await renderPlatosAdmin();
  } catch (error) {
    document.getElementById('platos-tbody').innerHTML = `<tr><td colspan="5" class="info-text color-danger">${escapeHTML(error.message)}</td></tr>`;
  }
}

async function renderPlatosAdmin() {
  const tbody = document.getElementById('platos-tbody');
  const requestId = ++platosAdminRequest;
  platosAdminList = [];
  renderPlatosAdminPage();
  if (!document.getElementById('platos-restaurante').value) return;
  tbody.innerHTML = '<tr><td colspan="5" class="info-text">Cargando menú...</td></tr>';
  try {
    const [platos, restaurants] = await Promise.all([requestAPI('platos'), requestAPI('restaurantes')]);
    if (requestId !== platosAdminRequest) return;
    const allowed = new Set(restaurants.filter(canManageMenuRestaurant).map(r => Number(r.id_restaurante)));
    platosAdminList = platos.filter(p => allowed.has(Number(p.id_restaurante)));
    renderPlatosAdminPage();
  } catch (error) {
    if (requestId !== platosAdminRequest) return;
    tbody.innerHTML = `<tr><td colspan="5" class="info-text color-danger">${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderPlatosAdminPage() {
  const tbody = document.getElementById('platos-tbody');
  const restaurant = Number(document.getElementById('platos-restaurante').value);
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = normalize(document.getElementById('platos-busqueda').value.trim());
  const available = document.getElementById('platos-disponibilidad').value;
  const filtered = platosAdminList.filter(p => Number(p.id_restaurante) === restaurant &&
    (available === '' || Number(p.disponibilidad) === Number(available)) &&
    (!search || normalize(`${p.nombre} ${p.nombre_categoria}`).includes(search)))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  platosAdminPage = Math.min(Math.max(1, platosAdminPage), pages);
  const start = (platosAdminPage - 1) * 10;
  document.getElementById('platos-resumen').textContent = filtered.length ? `Mostrando ${start + 1}–${Math.min(start + 10, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'plato' : 'platos'}` : 'Sin platos para los filtros seleccionados.';
  document.getElementById('platos-pagina').textContent = `Página ${platosAdminPage} de ${pages}`;
  document.getElementById('platos-anterior').disabled = platosAdminPage === 1;
  document.getElementById('platos-siguiente').disabled = platosAdminPage === pages;
  tbody.innerHTML = filtered.length ? filtered.slice(start, start + 10).map(p => `
    <tr>
      <td><strong>${escapeHTML(p.nombre)}</strong><p class="plato-description">${escapeHTML(String(p.descripcion || '').slice(0, 110))}${String(p.descripcion || '').length > 110 ? '…' : ''}</p></td>
      <td>${escapeHTML(p.nombre_categoria)}</td>
      <td>$${Number(p.precio).toLocaleString('es-CO')} COP</td>
      <td><span class="badge-status ${Number(p.disponibilidad) === 1 ? 'confirmada' : 'pendiente'}">${Number(p.disponibilidad) === 1 ? 'Disponible' : 'No disponible'}</span></td>
      <td><div class="plato-actions"><button type="button" class="btn btn-sm btn-secondary" onclick="openPlatoModal(${Number(p.id_plato)})" aria-label="Editar plato ${escapeHTML(p.nombre)}">Editar</button><button type="button" class="btn btn-sm btn-danger" onclick="deletePlato(${Number(p.id_plato)})" aria-label="Eliminar plato ${escapeHTML(p.nombre)}">Eliminar</button></div></td>
    </tr>`).join('') : '<tr><td colspan="5" class="info-text">No hay platos disponibles para esta consulta.</td></tr>';
}

async function openPlatoModal(id = null) {
  if (!currentUser || !['administrador', 'restaurante'].includes(currentUser.tipo_usuario)) return;
  const form = document.getElementById('form-modal-plato');
  const selectRest = document.getElementById('mplato-restaurante');
  const selectCategory = document.getElementById('mplato-categoria');
  form.reset();
  document.getElementById('mplato-id').value = '';
  document.getElementById('mplato-disponible').value = '1';
  selectRest.disabled = false;
  try {
    const [restaurants, categories] = await Promise.all([requestAPI('restaurantes'), requestAPI('categorias')]);
    const allowed = restaurants.filter(canManageMenuRestaurant);
    if (!allowed.length) throw new Error('Primero necesitas un restaurante propio para administrar su menú.');
    selectRest.replaceChildren();
    allowed.forEach(r => selectRest.add(new Option(r.nombre, r.id_restaurante)));
    const selected = document.getElementById('platos-restaurante').value;
    if (allowed.some(r => String(r.id_restaurante) === selected)) selectRest.value = selected;
    selectCategory.replaceChildren(new Option('Selecciona una categoría', ''));
    categories.forEach(c => selectCategory.add(new Option(c.nombre_categoria, c.id_categoria)));
    if (id) {
      const plato = (await requestAPI('platos')).find(p => Number(p.id_plato) === Number(id));
      if (!plato || !allowed.some(r => Number(r.id_restaurante) === Number(plato.id_restaurante))) throw new Error('El plato no existe o no pertenece a tus restaurantes.');
      document.getElementById('mplato-id').value = plato.id_plato;
      selectRest.value = plato.id_restaurante;
      selectRest.disabled = true;
      selectCategory.value = plato.id_categoria;
      document.getElementById('mplato-nombre').value = plato.nombre;
      document.getElementById('mplato-descripcion').value = plato.descripcion || '';
      document.getElementById('mplato-precio').value = Number(plato.precio);
      document.getElementById('mplato-disponible').value = Number(plato.disponibilidad) === 1 ? '1' : '0';
    }
    document.getElementById('modal-plato-title').textContent = id ? 'Editar plato' : 'Agregar plato';
    document.getElementById('btn-save-plato').textContent = id ? 'Guardar cambios' : 'Agregar plato';
    document.getElementById('modal-plato').classList.add('active');
  } catch (error) { showToast(error.message, 'danger'); }
}

async function savePlato(event) {
  event.preventDefault();
  const button = document.getElementById('btn-save-plato');
  if (button.disabled) return;
  const id = document.getElementById('mplato-id').value;
  const nombre = document.getElementById('mplato-nombre').value.trim();
  const descripcion = document.getElementById('mplato-descripcion').value.trim();
  const priceText = document.getElementById('mplato-precio').value.trim();
  const precio = Number(priceText);
  const id_categoria = Number(document.getElementById('mplato-categoria').value);
  const disponibilidad = Number(document.getElementById('mplato-disponible').value);
  if (!nombre || nombre.length > 150 || descripcion.length > 4000 || !priceText || !Number.isFinite(precio) || precio < 0 || precio > 99999999.99 || Math.abs(precio * 100 - Math.round(precio * 100)) > 0.000001 || ![0, 1].includes(disponibilidad)) {
    showToast('Revisa el nombre y el precio del plato (hasta dos decimales).', 'warning');
    return;
  }
  button.disabled = true;
  try {
    const [platos, restaurants, categories] = await Promise.all([requestAPI('platos'), requestAPI('restaurantes'), requestAPI('categorias')]);
    const original = id ? platos.find(p => Number(p.id_plato) === Number(id)) : null;
    if (id && !original) throw new Error('El plato ya no existe. Actualiza el menú.');
    const id_restaurante = Number(original ? original.id_restaurante : document.getElementById('mplato-restaurante').value);
    if (!canManageMenuRestaurant(restaurants.find(r => Number(r.id_restaurante) === id_restaurante))) throw new Error('No tienes permiso para administrar este menú.');
    if (!categories.some(c => Number(c.id_categoria) === id_categoria)) throw new Error('Selecciona una categoría válida.');
    await requestAPI(id ? `platos/${id}` : 'platos', {method: id ? 'PUT' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nombre, descripcion, precio, disponibilidad, id_categoria, id_restaurante})});
    closeModal('modal-plato');
    document.getElementById('platos-restaurante').value = id_restaurante;
    await renderPlatosAdmin();
    showToast(id ? 'Plato actualizado con éxito.' : 'Plato creado con éxito.', 'success');
  } catch (error) { showToast(error.message, 'danger'); }
  finally { button.disabled = false; }
}

async function deletePlato(id) {
  try {
    const [platos, restaurants, pedidos] = await Promise.all([requestAPI('platos'), requestAPI('restaurantes'), requestAPI('pedidos')]);
    const plato = platos.find(p => Number(p.id_plato) === Number(id));
    if (!plato || !canManageMenuRestaurant(restaurants.find(r => Number(r.id_restaurante) === Number(plato.id_restaurante)))) throw new Error('No tienes permiso para eliminar este plato.');
    const used = pedidos.some(p => (p.detalles || []).some(d => Number(d.id_plato) === Number(id))) ||
      (!isConnectedToDB && getLS('gt_detalle_pedidos').some(d => Number(d.id_plato) === Number(id)));
    if (used) throw new Error('Este plato tiene pedidos registrados. Puedes marcarlo como no disponible para conservar el historial.');
    if (!confirm(`¿Eliminar el plato «${plato.nombre}» del menú?`)) return;
    await requestAPI(`platos/${id}`, {method: 'DELETE'});
    await renderPlatosAdmin();
    showToast('Plato eliminado del menú.', 'success');
  } catch (error) { showToast(error.message, 'warning'); }
}

// --------------------------------------------------------------------
// 11. MÓDULO CRUD: RESERVAS
// --------------------------------------------------------------------
let reservasList = [];
let reservasPage = 1;
let reservasRequest = 0;

function filterReservas() {
  reservasPage = 1;
  renderReservasPage();
}

async function renderReservas() {
  const tbody = document.getElementById('reservas-table-body');
  const requestId = ++reservasRequest;
  reservasList = [];
  renderReservasPage();
  tbody.innerHTML = '<tr><td colspan="7" class="info-text">Cargando reservas...</td></tr>';
  document.getElementById('reservas-resumen').textContent = 'Cargando reservas…';

  try {
    const list = await requestAPI('reservas');
    if (requestId !== reservasRequest) return;
    
    // Filtrar si no es admin (Clientes ven solo las suyas, propietarios las de sus restaurantes)
    let filtered = list;
    if (currentUser.tipo_usuario === 'cliente') {
      filtered = list.filter(r => r.id_usuario == currentUser.id_usuario);
    } else if (currentUser.tipo_usuario === 'restaurante') {
      const myRests = getLS('gt_restaurantes').filter(x => x.id_propietario == currentUser.id_usuario).map(x => x.id_restaurante);
      filtered = list.filter(r => myRests.includes(r.id_restaurante));
    }

    reservasList = filtered;
    renderReservasPage();
  } catch (error) {
    if (requestId !== reservasRequest) return;
    reservasList = [];
    renderReservasPage();
    document.getElementById('reservas-resumen').textContent = 'No se pudieron cargar las reservas.';
    tbody.innerHTML = `<tr><td colspan="7" class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderReservasPage() {
  const tbody = document.getElementById('reservas-table-body');
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = normalize(document.getElementById('reservas-busqueda').value.trim());
  const status = document.getElementById('reservas-estado').value;
  const date = document.getElementById('reservas-fecha').value;
  const pageSize = Number(document.getElementById('reservas-por-pagina').value) || 10;
  const filtered = reservasList.filter(r => {
    const matchesStatus = !status || (status === 'activas'
      ? ['pendiente', 'confirmada'].includes(r.estado_reserva)
      : r.estado_reserva === status);
    const matchesDate = !date || String(r.fecha_reserva).slice(0, 10) === date;
    const text = `${r.nombre_restaurante} ${r.numero_mesa} ${r.ubicacion_mesa} #${r.id_reserva}`;
    return matchesStatus && matchesDate && (!search || normalize(text).includes(search));
  }).sort((a, b) => {
    const dateA = `${String(a.fecha_reserva).slice(0, 10)} ${a.hora_reserva}`;
    const dateB = `${String(b.fecha_reserva).slice(0, 10)} ${b.hora_reserva}`;
    return dateB.localeCompare(dateA) || Number(b.id_reserva) - Number(a.id_reserva);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  reservasPage = Math.min(Math.max(1, reservasPage), pageCount);
  const start = (reservasPage - 1) * pageSize;
  const end = Math.min(start + pageSize, filtered.length);
  const count = filtered.length === reservasList.length ? '' : ` (${reservasList.length} en total)`;
  document.getElementById('reservas-resumen').textContent = filtered.length
    ? `Mostrando ${start + 1}–${end} de ${filtered.length} reservas${count}`
    : `Sin resultados${count}`;
  document.getElementById('reservas-pagina').textContent = `Página ${reservasPage} de ${pageCount}`;
  document.getElementById('reservas-anterior').disabled = reservasPage === 1;
  document.getElementById('reservas-siguiente').disabled = reservasPage === pageCount;
  tbody.innerHTML = '';

  if (!filtered.length) {
    const message = reservasList.length
      ? 'No hay reservas que coincidan. Prueba con otros filtros.'
      : 'No se encontraron reservas registradas.';
    tbody.innerHTML = `<tr><td colspan="7" class="info-text">${message}</td></tr>`;
    return;
  }

    filtered.slice(start, end).forEach(r => {
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
        <td><strong>${escapeHTML(r.nombre_restaurante)}</strong></td>
        <td>${escapeHTML(r.numero_mesa)} (${escapeHTML(r.ubicacion_mesa)})</td>
        <td>${escapeHTML(String(r.fecha_reserva).slice(0, 10))}</td>
        <td>${escapeHTML(String(r.hora_reserva).slice(0, 5))}</td>
        <td>${r.cantidad_personas}</td>
        <td><span class="badge-status ${r.estado_reserva}">${r.estado_reserva}</span></td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
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
    const filtered = platos.filter(p => p.id_restaurante == restId && Number(p.disponibilidad) === 1);

    if (filtered.length === 0) {
      menuList.innerHTML = '<p class="info-text">Este restaurante no tiene platos disponibles en su menú.</p>';
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = 'menu-item-row';
      item.innerHTML = `
        <div class="menu-item-info">
          <h5>${escapeHTML(p.nombre)}</h5>
          <p>${escapeHTML(p.descripcion)}</p>
          <span class="menu-item-price">$${Number(p.precio).toLocaleString('es-CO')} COP</span>
        </div>
        <button type="button" class="btn btn-sm btn-primary">Agregar</button>
      `;
      item.querySelector('button').addEventListener('click', () => addToCart(Number(p.id_plato), p.nombre, Number(p.precio)));
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
        <h5>${escapeHTML(item.nombre)}</h5>
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

let pedidosList = [];
let pedidosPage = 1;
let pedidosRequest = 0;

// MySQL devuelve fecha civil; el modo demo también puede devolver un ISO con zona.
function pedidoFechaLocal(value) {
  const text = String(value ?? '');
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

function pedidoOrdenFecha(value) {
  const text = String(value ?? '');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
    ? text : `${text.replace(' ', 'T')}-05:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function filterPedidos() {
  pedidosPage = 1;
  renderPedidosPage();
}

async function renderPedidosHistorial() {
  const tbody = document.getElementById('pedidos-table-body');
  const requestId = ++pedidosRequest;
  const previousPage = pedidosPage;
  pedidosList = [];
  renderPedidosPage();
  tbody.innerHTML = '<tr><td colspan="8" class="info-text">Cargando historial...</td></tr>';
  document.getElementById('pedidos-contador').textContent = 'Cargando pedidos…';

  try {
    const list = await requestAPI('pedidos');
    if (requestId !== pedidosRequest) return;

    // Filtrar según rol
    let filtered = list;
    if (currentUser.tipo_usuario === 'cliente') {
      filtered = list.filter(p => p.id_usuario == currentUser.id_usuario);
    } else if (currentUser.tipo_usuario === 'restaurante') {
      const myRests = getLS('gt_restaurantes').filter(x => x.id_propietario == currentUser.id_usuario).map(x => x.id_restaurante);
      filtered = list.filter(p => myRests.includes(p.id_restaurante));
    }

    pedidosList = filtered;
    const restaurantSelect = document.getElementById('pedidos-filtro-restaurante');
    const selectedRestaurant = restaurantSelect.value;
    const restaurants = new Map(filtered.map(p => [String(p.id_restaurante), p.nombre_restaurante]));
    restaurantSelect.replaceChildren(new Option('Todos los restaurantes', ''));
    [...restaurants].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es')).forEach(([id, name]) => {
      restaurantSelect.add(new Option(name, id));
    });
    restaurantSelect.value = restaurants.has(selectedRestaurant) ? selectedRestaurant : '';
    pedidosPage = previousPage;
    renderPedidosPage();
  } catch (error) {
    if (requestId !== pedidosRequest) return;
    pedidosList = [];
    renderPedidosPage();
    document.getElementById('pedidos-contador').textContent = 'No se pudieron cargar los pedidos.';
    tbody.innerHTML = `<tr><td colspan="8" class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderPedidosPage() {
  const tbody = document.getElementById('pedidos-table-body');
  const restaurant = document.getElementById('pedidos-filtro-restaurante').value;
  const from = document.getElementById('pedidos-desde').value;
  const to = document.getElementById('pedidos-hasta').value;
  const pageSize = Number(document.getElementById('pedidos-por-pagina').value) || 10;
  const invalidRange = from && to && from > to;
  const filtered = pedidosList.filter(p => {
    const date = pedidoFechaLocal(p.fecha_pedido);
    return !invalidRange && (!restaurant || String(p.id_restaurante) === restaurant)
      && (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => pedidoOrdenFecha(b.fecha_pedido) - pedidoOrdenFecha(a.fecha_pedido)
    || Number(b.id_pedido) - Number(a.id_pedido));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  pedidosPage = Math.min(Math.max(1, pedidosPage), pageCount);
  const start = (pedidosPage - 1) * pageSize;
  const end = Math.min(start + pageSize, filtered.length);
  const restaurantCount = new Set(filtered.map(p => String(p.id_restaurante))).size;
  document.getElementById('pedidos-contador').textContent = invalidRange
    ? 'Revisa el rango de fechas'
    : `${filtered.length} ${filtered.length === 1 ? 'pedido' : 'pedidos'} · ${restaurantCount} ${restaurantCount === 1 ? 'restaurante' : 'restaurantes'}`;
  const total = filtered.length === pedidosList.length ? '' : ` (${pedidosList.length} en total)`;
  document.getElementById('pedidos-resumen').textContent = invalidRange ? '' : filtered.length
    ? `Mostrando ${start + 1}–${end} de ${filtered.length} pedidos${total}`
    : `Sin resultados${total}`;
  document.getElementById('pedidos-pagina').textContent = `Página ${pedidosPage} de ${pageCount}`;
  document.getElementById('pedidos-anterior').disabled = pedidosPage === 1;
  document.getElementById('pedidos-siguiente').disabled = pedidosPage === pageCount;
  tbody.innerHTML = '';
  if (!filtered.length) {
    const message = invalidRange ? 'La fecha Desde no puede ser posterior a la fecha Hasta.'
      : pedidosList.length ? 'No hay pedidos para los filtros seleccionados.' : 'No hay pedidos registrados.';
    tbody.innerHTML = `<tr><td colspan="8" class="info-text">${message}</td></tr>`;
    return;
  }

    filtered.slice(start, end).forEach(p => {
      const tr = document.createElement('tr');
      
      const platosList = (p.detalles || []).map(d => `${d.nombre_plato} (x${d.cantidad})`).join(', ');
      const dateLabel = pedidoFechaLocal(p.fecha_pedido).split('-').reverse().join('/');

      let actionButtons = '';
      if (currentUser.tipo_usuario !== 'cliente' && p.estado_pedido === 'en preparacion') {
        actionButtons += `<button class="btn btn-sm btn-success" onclick="updatePedidoStatus(${p.id_pedido}, 'en camino')">Despachar</button>`;
      } else if (currentUser.tipo_usuario !== 'cliente' && p.estado_pedido === 'en camino') {
        actionButtons += `<button class="btn btn-sm btn-secondary" onclick="updatePedidoStatus(${p.id_pedido}, 'entregado')">Entregar</button>`;
      } else {
        actionButtons = '<span class="text-muted">Finalizado</span>';
      }

      tr.innerHTML = `
        <td><strong>#${escapeHTML(p.id_pedido)}</strong></td>
        <td>${escapeHTML(p.nombre_restaurante)}</td>
        <td>${escapeHTML(dateLabel)}</td>
        <td><span class="role-badge neutral-badge">${escapeHTML(p.tipo_servicio)}</span></td>
        <td><strong>$${Number(p.total_pago).toLocaleString('es-CO')} COP</strong></td>
        <td><span class="badge-status ${escapeHTML(p.estado_pedido.replace(' ', '-'))}">${escapeHTML(p.estado_pedido)}</span></td>
        <td><span class="pedidos-platos">${escapeHTML(platosList)}</span></td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });

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
  
  9: `-- Reporte 9: Clientes VIP (Apto para Gráfico)
SELECT u.nombre AS 'Cliente', u.correo AS 'Email', COUNT(r.id_reserva) AS 'Total Reservas'
FROM usuarios u INNER JOIN reservas r ON u.id_usuario = r.id_usuario
WHERE u.tipo_usuario = 'cliente'
GROUP BY u.id_usuario, u.nombre, u.correo
HAVING COUNT(r.id_reserva) > (
    SELECT AVG(total_res) FROM (
        SELECT COUNT(r2.id_reserva) AS total_res
        FROM usuarios u2 INNER JOIN reservas r2 ON u2.id_usuario = r2.id_usuario
        WHERE u2.tipo_usuario = 'cliente'
        GROUP BY u2.id_usuario
    ) AS sub
)
ORDER BY \`Total Reservas\` DESC;`,
  
  10: `-- Reporte 10: Platos más vendidos al menos en la media de su categoría (Apto para Gráfico)
SELECT p.nombre AS 'Plato', c.nombre_categoria AS 'Categoria', SUM(dp.cantidad) AS 'Vendidos'
FROM platos p
INNER JOIN categorias c ON p.id_categoria = c.id_categoria
INNER JOIN detalle_pedidos dp ON p.id_plato = dp.id_plato
GROUP BY p.id_plato, p.nombre, p.id_categoria, c.nombre_categoria
HAVING SUM(dp.cantidad) >= (
    SELECT AVG(cantidad_plato) FROM (
        SELECT p2.id_categoria, SUM(dp2.cantidad) AS cantidad_plato
        FROM platos p2
        INNER JOIN detalle_pedidos dp2 ON p2.id_plato = dp2.id_plato
        GROUP BY p2.id_plato, p2.id_categoria
    ) AS sub2 WHERE sub2.id_categoria = p.id_categoria
)
ORDER BY \`Vendidos\` DESC;`
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
  const palette = getChartPalette();
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
        backgroundColor: 'rgba(71, 139, 86, 0.55)',
        borderColor: '#26734e',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: palette.grid }, ticks: { color: palette.text } },
        x: { grid: { display: false }, ticks: { color: palette.text } }
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
  clearDocumentPreview();
  document.getElementById('preview-doc-container').style.display = 'none';
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

let activeDocumentPreview = null;
let documentPreviewRequest = 0;

function clearDocumentPreview() {
  activeDocumentPreview = null;
  documentPreviewRequest += 1;
  document.getElementById('btn-download-preview-pdf').disabled = true;
}

async function generateDocumentPDF(type) {
  const previewContainer = document.getElementById('preview-doc-container');
  const previewCanvas = document.getElementById('preview-canvas-content');
  clearDocumentPreview();
  const requestId = documentPreviewRequest;
  let previewRecord;
  
  previewContainer.style.display = 'block';
  previewCanvas.innerHTML = 'Generando vista previa...';

  try {
  if (type === 'reserva') {
    const id = document.getElementById('doc-reserva-select').value;
    if (!id) {
      previewCanvas.innerHTML = 'Selecciona una reserva válida.';
      return;
    }

    const list = await requestAPI('reservas');
    if (requestId !== documentPreviewRequest) return;
    const record = list.find(x => x.id_reserva == id);
    if (!record) throw new Error('La reserva seleccionada ya no está disponible.');
    const res = JSON.parse(JSON.stringify(record));
    previewRecord = res;

    previewCanvas.innerHTML = `
      <div class="invoice-box" style="text-align: center; border: 2px dashed #f59e0b; padding: 20px;">
        <h2 style="color: var(--primary); font-size: 1.5rem; margin-bottom: 10px;">COMPROBANTE DE RESERVA</h2>
        <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 20px;">Código Único: <strong>RES-${escapeHTML(res.id_reserva)}</strong></p>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Restaurante:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.nombre_restaurante)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Mesa asignada:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.numero_mesa)} (${escapeHTML(res.ubicacion_mesa)})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Titular Reserva:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.nombre_usuario)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Correo:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.correo_usuario)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Fecha & Hora:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.fecha_reserva)} a las ${escapeHTML(res.hora_reserva)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Cantidad Personas:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHTML(res.cantidad_personas)} personas</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Estado actual:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: var(--secondary); font-weight: bold;">${escapeHTML(String(res.estado_reserva).toUpperCase())}</td>
          </tr>
        </table>
        
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 20px;">Por favor, preséntate 10 minutos antes en el establecimiento.</p>
      </div>
    `;

  } else if (type === 'pedido') {
    const id = document.getElementById('doc-pedido-select').value;
    if (!id) {
      previewCanvas.innerHTML = 'Selecciona un pedido válido.';
      return;
    }

    const list = await requestAPI('pedidos');
    if (requestId !== documentPreviewRequest) return;
    const record = list.find(x => x.id_pedido == id);
    if (!record) throw new Error('El pedido seleccionado ya no está disponible.');
    const ped = JSON.parse(JSON.stringify(record));
    ped.total_pago = Number(ped.total_pago);
    if (!Array.isArray(ped.detalles) || !ped.detalles.length || !Number.isFinite(ped.total_pago)) {
      throw new Error('El pedido no tiene un detalle o un total válido.');
    }
    ped.detalles = ped.detalles.map(d => ({...d, cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario)}));
    if (ped.detalles.some(d => !Number.isInteger(d.cantidad) || d.cantidad < 1 || !Number.isFinite(d.precio_unitario) || d.precio_unitario < 0)) {
      throw new Error('El pedido tiene cantidades o precios inválidos.');
    }
    previewRecord = ped;

    let itemsRows = '';
    ped.detalles.forEach(d => {
      const rowTotal = d.precio_unitario * d.cantidad;
      itemsRows += `
        <tr class="item">
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(d.nombre_plato)} x${d.cantidad}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${rowTotal.toLocaleString('es-CO')} COP</td>
        </tr>
      `;
    });

    previewCanvas.innerHTML = `
      <div class="invoice-box" style="border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr class="top">
            <td colspan="2">
              <table style="width: 100%;">
                <tr>
                  <td class="title" style="color: var(--primary);">GASTROTURISMO</td>
                  <td style="text-align: right;">
                    Factura #: FACT-${escapeHTML(ped.id_pedido)}<br>
                    Fecha: ${pedidoFechaLocal(ped.fecha_pedido).split('-').reverse().join('/')}<br>
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
                    Restaurante: <strong>${escapeHTML(ped.nombre_restaurante)}</strong><br>
                    Tipo Servicio: ${escapeHTML(String(ped.tipo_servicio).toUpperCase())}<br>
                    Entrega: ${escapeHTML(ped.direccion_entrega || 'Comedor del Local')}
                  </td>
                  <td style="text-align: right;">
                    Cliente: <strong>${escapeHTML(ped.nombre_usuario)}</strong><br>
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
               <span style="font-size: 1.2rem; font-weight: bold; color: var(--secondary);">Total registrado: $${ped.total_pago.toLocaleString('es-CO')} COP</span>
            </td>
          </tr>
        </table>
      </div>
    `;
  } else {
    throw new Error('Selecciona un tipo de documento válido.');
  }
  activeDocumentPreview = {type, id: type === 'reserva' ? previewRecord.id_reserva : previewRecord.id_pedido, data: previewRecord};
  
  // Agregar listener para descargar
  document.getElementById('btn-download-preview-pdf').onclick = downloadActivePreviewPDF;
  document.getElementById('btn-download-preview-pdf').disabled = false;
  } catch (error) {
    if (requestId !== documentPreviewRequest) return;
    activeDocumentPreview = null;
    previewCanvas.textContent = error.message;
    document.getElementById('btn-download-preview-pdf').disabled = true;
  }
}

function downloadActivePreviewPDF() {
  const preview = activeDocumentPreview;
  if (!preview) return;
  if (!window.jspdf?.jsPDF) {
    showToast('No se pudo cargar la herramienta PDF. Recarga la página e inténtalo de nuevo.', 'warning');
    return;
  }
  try {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  if (typeof doc.autoTable !== 'function') throw new Error('No se pudo cargar la herramienta de tablas PDF. Recarga la página.');

  if (preview.type === 'reserva') {
    const res = preview.data;

    doc.setFillColor(25, 77, 59);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(19);
    doc.text('COMPROBANTE DE RESERVA', 20, 22);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`CÓDIGO ÚNICO: RES-${res.id_reserva}`, 20, 32);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    
    const rows = [
      ['Establecimiento', res.nombre_restaurante],
      ['Número de Mesa', res.numero_mesa],
      ['Ubicación Mesa', res.ubicacion_mesa],
      ['Cliente Titular', res.nombre_usuario],
      ['Correo', res.correo_usuario || 'No registrado'],
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
      headStyles: { fillColor: [38, 115, 78], textColor: [255, 255, 255] }
    });

    doc.setFontSize(9);
    doc.setTextColor(89, 104, 93);
    let noteY = doc.lastAutoTable.finalY + 12;
    if (noteY > 270) { doc.addPage(); noteY = 25; }
    doc.text(doc.splitTextToSize('Por favor, preséntate 10 minutos antes en el establecimiento.', 170), 20, noteY);

    doc.save(`Comprobante_Reserva_${res.id_reserva}.pdf`);

  } else if (preview.type === 'pedido') {
    const ped = preview.data;

    doc.setFillColor(25, 77, 59);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('FACTURA COMERCIAL', 20, 22);
    doc.setFontSize(10);
    doc.text(`NÚMERO DE PEDIDO: FACT-${ped.id_pedido}`, 20, 32);
    doc.text(`Fecha: ${pedidoFechaLocal(ped.fecha_pedido).split('-').reverse().join('/')}`, 20, 39);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text(`Establecimiento: ${ped.nombre_restaurante}`, 20, 60);
    doc.text(`Cliente: ${ped.nombre_usuario}`, 20, 66);
    doc.text(`Servicio: ${ped.tipo_servicio.toUpperCase()}`, 20, 72);
    if (ped.direccion_entrega) {
      doc.text(`Dirección Delivery: ${ped.direccion_entrega}`, 20, 78);
    }

    const headers = ['Plato', 'Cantidad', 'Precio Unitario', 'Subtotal'];
    const rows = ped.detalles.map(d => [
      d.nombre_plato,
      d.cantidad,
      `$${d.precio_unitario.toLocaleString('es-CO')} COP`,
      `$${(d.precio_unitario * d.cantidad).toLocaleString('es-CO')} COP`
    ]);

    doc.autoTable({
      startY: 88,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [38, 115, 78], textColor: [255, 255, 255] }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 275) { doc.addPage(); finalY = 25; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL REGISTRADO: $${ped.total_pago.toLocaleString('es-CO')} COP`, 190, finalY, {align: 'right'});

    doc.save(`Factura_Pedido_${ped.id_pedido}.pdf`);
  }

  showToast('Documento exportado a PDF con éxito.', 'success');
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// --------------------------------------------------------------------
// 16. MÓDULO NOTIFICACIONES Y RECORDATORIOS
// --------------------------------------------------------------------
const NOTIFICATION_PAGE_SIZE = 5;
let notificationsList = [];
let notificationPage = 1;
let notificationUserId = null;
let notificationRequest = 0;
const notificationsBeingRead = new Set();

function resetNotifications() {
  notificationRequest += 1;
  notificationUserId = null;
  notificationsList = [];
  notificationPage = 1;
  notificationsBeingRead.clear();
  document.getElementById('notification-count').textContent = '0';
  document.getElementById('notification-count').style.display = 'none';
  document.getElementById('notifications-list').innerHTML = '';
  document.getElementById('notification-summary').textContent = '';
  document.getElementById('notification-page').textContent = '1 / 1';
  document.getElementById('notification-filter').value = 'pendientes';
  document.getElementById('notification-prev').disabled = true;
  document.getElementById('notification-next').disabled = true;
  document.getElementById('notification-panel').classList.remove('active');
  document.getElementById('bell-btn').setAttribute('aria-expanded', 'false');
}

function notificationIsRead(notification) {
  return notification.leido === true || Number(notification.leido) === 1;
}

function notificationTimestamp(value) {
  const raw = String(value ?? '');
  const localDate = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw);
  return new Date(localDate ? raw.replace(' ', 'T') + '-05:00' : raw).getTime();
}

function compareNotifications(a, b) {
  return (notificationTimestamp(b.fecha_envio) || 0) - (notificationTimestamp(a.fecha_envio) || 0) || Number(b.id_notificacion) - Number(a.id_notificacion);
}

function notificationDate(value) {
  const timestamp = notificationTimestamp(value);
  return Number.isNaN(timestamp) ? 'Fecha no disponible' : new Date(timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
}

async function loadNotifications() {
  const panel = document.getElementById('notifications-list');
  if (!currentUser) { resetNotifications(); return; }
  const userId = Number(currentUser.id_usuario);
  if (notificationUserId !== userId) resetNotifications();
  notificationUserId = userId;
  const request = ++notificationRequest;
  panel.innerHTML = '<p class="empty-list">Cargando notificaciones…</p>';
  document.getElementById('notification-summary').textContent = '';
  document.getElementById('notification-prev').disabled = true;
  document.getElementById('notification-next').disabled = true;
  try {
    const list = await requestAPI(`notificaciones/${userId}`);
    if (request !== notificationRequest || Number(currentUser?.id_usuario) !== userId) return;
    notificationsList = list.filter(n => Number(n.id_usuario) === userId).sort(compareNotifications);
    renderNotifications();
  } catch(error) {
    if (request !== notificationRequest || Number(currentUser?.id_usuario) !== userId) return;
    notificationsList = [];
    notificationPage = 1;
    document.getElementById('notification-count').textContent = '0';
    document.getElementById('notification-count').style.display = 'none';
    document.getElementById('notification-page').textContent = '1 / 1';
    document.getElementById('notification-summary').textContent = 'No se pudieron actualizar las notificaciones.';
    panel.innerHTML = `<p class="empty-list color-danger">${escapeHTML(error.message)}. Vuelve a abrir la campana para reintentar.</p>`;
  }
}

function renderNotifications() {
  if (!currentUser || Number(currentUser.id_usuario) !== notificationUserId) { resetNotifications(); return; }
  const filter = document.getElementById('notification-filter').value;
  const unreadCount = notificationsList.filter(n => !notificationIsRead(n)).length;
  const badge = document.getElementById('notification-count');
  badge.textContent = String(unreadCount);
  badge.style.display = unreadCount ? 'flex' : 'none';
  const filtered = notificationsList.filter(n => filter === 'leidas' ? notificationIsRead(n) : filter === 'todas' || !notificationIsRead(n));
  const totalPages = Math.max(1, Math.ceil(filtered.length / NOTIFICATION_PAGE_SIZE));
  notificationPage = Math.min(totalPages, Math.max(1, notificationPage));
  const offset = (notificationPage - 1) * NOTIFICATION_PAGE_SIZE;
  document.getElementById('notification-summary').textContent = filtered.length ? `${offset + 1}–${Math.min(offset + NOTIFICATION_PAGE_SIZE, filtered.length)} de ${filtered.length} notificaciones` : '0 notificaciones';
  document.getElementById('notification-page').textContent = `${notificationPage} / ${totalPages}`;
  document.getElementById('notification-prev').disabled = notificationPage === 1;
  document.getElementById('notification-next').disabled = notificationPage === totalPages;
  const panel = document.getElementById('notifications-list');
  panel.innerHTML = '';
  if (!filtered.length) {
    panel.innerHTML = `<p class="empty-list">${filter === 'leidas' ? 'Todavía no tienes notificaciones leídas.' : filter === 'todas' ? 'Todavía no tienes notificaciones.' : 'No tienes notificaciones pendientes.'}</p>`;
  }
  for (const notification of filtered.slice(offset, offset + NOTIFICATION_PAGE_SIZE)) {
    const read = notificationIsRead(notification);
    const item = document.createElement('article');
    item.className = `notification-item${read ? '' : ' unread'}`;
    item.innerHTML = `<p>${escapeHTML(notification.mensaje)}</p><span class="notification-date">${escapeHTML(notificationDate(notification.fecha_envio))}</span>${read ? '<span>Leída</span>' : '<button type="button" class="btn btn-sm btn-secondary">Marcar como leída</button>'}`;
    if (!read) {
      const button = item.querySelector('button');
      button.disabled = notificationsBeingRead.has(Number(notification.id_notificacion));
      button.addEventListener('click', () => markNotificationRead(notification.id_notificacion));
    }
    panel.appendChild(item);
  }
}

async function markNotificationRead(value) {
  const id = positiveRecordId(value);
  const userId = Number(currentUser?.id_usuario);
  const notification = notificationsList.find(n => Number(n.id_notificacion) === id && Number(n.id_usuario) === userId);
  if (!id || !notification || notificationIsRead(notification) || notificationsBeingRead.has(id)) return;
  notificationsBeingRead.add(id);
  renderNotifications();
  try {
    await requestAPI(`notificaciones/leer/${id}`, { method: 'PUT' });
    if (Number(currentUser?.id_usuario) === userId && notificationUserId === userId) {
      notificationRequest += 1; // Una lectura iniciada antes del marcado no debe restaurar un aviso pendiente.
      notificationsList = notificationsList.map(n => Number(n.id_notificacion) === id ? { ...n, leido: true } : n);
    }
  } catch (error) {
    if (Number(currentUser?.id_usuario) === userId) showToast(`No se pudo marcar la notificación: ${error.message}`, 'danger');
  } finally {
    notificationsBeingRead.delete(id);
    if (Number(currentUser?.id_usuario) === userId && notificationUserId === userId) renderNotifications();
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
    await loadAsistenciaHistorial();
    document.getElementById('asistencia-source').textContent = isConnectedToDB ? 'Asistencia registrada en MySQL.' : 'Demostración académica: las modificaciones se conservan en este navegador.';
  } catch (error) { showToast(error.message, 'danger'); }
}

let asistenciaList = [];
let asistenciaPage = 1;
let asistenciaRequest = 0;

function filterAsistencia() {
  asistenciaPage = 1;
  renderAsistenciaPage();
}

async function loadAsistenciaHistorial() {
  const tbody = document.getElementById('asistencia-tbody');
  const requestId = ++asistenciaRequest;
  const previousPage = asistenciaPage;
  asistenciaList = [];
  renderAsistenciaPage();
  tbody.innerHTML = '<tr><td colspan="4" class="info-text">Cargando asistencia...</td></tr>';
  document.getElementById('asistencia-contador').textContent = 'Cargando visitas…';
  try {
    const visits = await requestAPI('visitas');
    if (requestId !== asistenciaRequest) return;
    asistenciaList = visits;
    const select = document.getElementById('asistencia-filtro-restaurante');
    const selectedRestaurant = select.value;
    const restaurants = new Map(visits.map(v => [String(v.id_restaurante), v.nombre_restaurante]));
    select.replaceChildren(new Option('Todos los restaurantes', ''));
    [...restaurants].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'es')).forEach(([id, name]) => {
      select.add(new Option(name, id));
    });
    select.value = restaurants.has(selectedRestaurant) ? selectedRestaurant : '';
    asistenciaPage = previousPage;
    renderAsistenciaPage();
  } catch (error) {
    if (requestId !== asistenciaRequest) return;
    asistenciaList = [];
    renderAsistenciaPage();
    document.getElementById('asistencia-contador').textContent = 'No se pudo cargar la asistencia.';
    tbody.innerHTML = `<tr><td colspan="4" class="info-text color-danger">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderAsistenciaPage() {
  const tbody = document.getElementById('asistencia-tbody');
  const restaurant = document.getElementById('asistencia-filtro-restaurante').value;
  const from = document.getElementById('asistencia-desde').value;
  const to = document.getElementById('asistencia-hasta').value;
  const pageSize = Number(document.getElementById('asistencia-por-pagina').value) || 10;
  const invalidRange = from && to && from > to;
  const filtered = asistenciaList.filter(visit => {
    const date = pedidoFechaLocal(visit.fecha_ingreso);
    return !invalidRange && (!restaurant || String(visit.id_restaurante) === restaurant)
      && (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => pedidoOrdenFecha(b.fecha_ingreso) - pedidoOrdenFecha(a.fecha_ingreso)
    || Number(b.id_visita) - Number(a.id_visita));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  asistenciaPage = Math.min(Math.max(1, asistenciaPage), pageCount);
  const start = (asistenciaPage - 1) * pageSize;
  const end = Math.min(start + pageSize, filtered.length);
  const people = filtered.reduce((sum, visit) => sum + Number(visit.cantidad_personas), 0);
  document.getElementById('asistencia-contador').textContent = invalidRange ? 'Revisa el rango de fechas'
    : `${filtered.length.toLocaleString('es-CO')} ${filtered.length === 1 ? 'visita' : 'visitas'} · ${people.toLocaleString('es-CO')} ${people === 1 ? 'persona' : 'personas'}`;
  const total = filtered.length === asistenciaList.length ? '' : ` (${asistenciaList.length} en total)`;
  document.getElementById('asistencia-resumen').textContent = invalidRange ? '' : filtered.length
    ? `Mostrando ${start + 1}–${end} de ${filtered.length} visitas${total}` : `Sin resultados${total}`;
  document.getElementById('asistencia-pagina').textContent = `Página ${asistenciaPage} de ${pageCount}`;
  document.getElementById('asistencia-anterior').disabled = asistenciaPage === 1;
  document.getElementById('asistencia-siguiente').disabled = asistenciaPage === pageCount;
  tbody.replaceChildren();
  if (!filtered.length) {
    const message = invalidRange ? 'La fecha Desde no puede ser posterior a la fecha Hasta.'
      : asistenciaList.length ? 'No hay visitas para los filtros seleccionados.' : 'Todavía no hay asistencias registradas.';
    tbody.innerHTML = `<tr><td colspan="4" class="info-text">${message}</td></tr>`;
    return;
  }
  for (const visit of filtered.slice(start, end)) {
    const date = pedidoFechaLocal(visit.fecha_ingreso).split('-').reverse().join('/');
    const timestamp = String(visit.fecha_ingreso);
    const time = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
      ? new Intl.DateTimeFormat('es-CO', {timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(timestamp))
      : timestamp.slice(11, 16);
    const tr = document.createElement('tr');
    for (const value of [`${date} · ${time}`, visit.nombre_restaurante, visit.id_reserva ? `#${visit.id_reserva}` : 'Sin reserva', visit.cantidad_personas]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
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

