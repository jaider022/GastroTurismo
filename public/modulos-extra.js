// ====================================================================
// MÓDULOS ADICIONALES: EXPERIENCIAS GASTRONÓMICAS, PLANES Y RECORDATORIOS
// Usa requestAPI, currentUser, getLS/setLS, escapeHTML y showToast de app.js.
// ====================================================================

const EXPERIENCE_LABELS = { cata: 'Cata de café', clase_cocina: 'Clase de cocina', tour: 'Tour gastronómico', maridaje: 'Maridaje', desayuno: 'Desayuno típico' };
const REMINDER_LABELS = { reserva: 'Reserva', experiencia: 'Experiencia', plan: 'Plan', personal: 'Personal' };
const formatCOP = value => `$${Number(value || 0).toLocaleString('es-CO')}`;
const isStaffUser = () => ['administrador', 'restaurante'].includes(currentUser?.tipo_usuario);
const demoId = () => Date.now() + Math.floor(Math.random() * 1000);

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function addMonthsDate(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d, 12)).toISOString().slice(0, 10);
}

// --------------------------------------------------------------------
// MODO DEMOSTRACIÓN: mismas reglas que el servidor sobre LocalStorage
// --------------------------------------------------------------------
function demoNotify(id_usuario, mensaje) {
  const list = getLS('gt_notificaciones');
  list.push({ id_notificacion: demoId(), mensaje, fecha_envio: bogotaNow(), leido: false, id_usuario });
  setLS('gt_notificaciones', list);
}
function demoReminder(data) {
  if (data.fecha_programada <= bogotaNow()) return;
  const list = getLS('gt_recordatorios');
  list.push({ id_recordatorio: demoId(), id_reserva: null, id_inscripcion: null, id_suscripcion: null, enviado: false, fecha_envio: null, ...data });
  setLS('gt_recordatorios', list);
}
function demoProcessReminders() {
  const now = bogotaNow();
  const list = getLS('gt_recordatorios');
  let changed = false;
  list.forEach(r => {
    if (!r.enviado && r.fecha_programada <= now) {
      r.enviado = true; r.fecha_envio = now; changed = true;
      demoNotify(r.id_usuario, `Recordatorio: ${r.titulo}. ${r.mensaje}`);
    }
  });
  if (changed) setLS('gt_recordatorios', list);
  const today = bogotaToday();
  const subs = getLS('gt_suscripciones');
  subs.forEach(s => { if (s.estado_suscripcion === 'activa' && s.fecha_fin <= today) s.estado_suscripcion = 'vencida'; });
  setLS('gt_suscripciones', subs);
  setLS('gt_restaurantes', getLS('gt_restaurantes').map(r => subs.some(s => s.id_restaurante == r.id_restaurante && s.estado_suscripcion === 'activa') ? r : { ...r, id_plan: 1 }));
}
function demoManages(id_restaurante) {
  const rest = getLS('gt_restaurantes').find(r => r.id_restaurante == id_restaurante);
  if (!rest) throw new Error('El restaurante no existe.');
  if (currentUser.tipo_usuario === 'administrador' || (currentUser.tipo_usuario === 'restaurante' && rest.id_propietario == currentUser.id_usuario)) return rest;
  throw new Error('Solo puedes administrar los restaurantes de tu propiedad.');
}

// Reglas de reserva en demostración: fecha no pasada, capacidad y una reserva activa por mesa y día.
function demoValidateReservation(body, exceptId = 0) {
  const mesa = getLS('gt_mesas').find(m => m.id_mesa == body.id_mesa);
  if (!mesa) throw new Error('La mesa no existe.');
  if (mesa.estado === 'mantenimiento') throw new Error('La mesa está en mantenimiento.');
  if (!body.fecha_reserva || body.fecha_reserva < bogotaToday()) throw new Error('No se pueden registrar reservas en fechas pasadas.');
  if (Number(body.cantidad_personas) > Number(mesa.capacidad)) throw new Error(`La ${mesa.numero_mesa} admite máximo ${mesa.capacidad} personas.`);
  const busy = getLS('gt_reservas').some(r => r.id_mesa == body.id_mesa && r.fecha_reserva === body.fecha_reserva && ['pendiente', 'confirmada'].includes(r.estado_reserva) && r.id_reserva != exceptId);
  if (busy) throw new Error('La mesa ya tiene una reserva activa ese día. Elige otra mesa o fecha.');
}

function demoExperiences() {
  const rests = getLS('gt_restaurantes');
  const zones = getLS('gt_zonas');
  const ins = getLS('gt_inscripciones');
  return getLS('gt_experiencias').map(e => {
    const r = rests.find(x => x.id_restaurante == e.id_restaurante) || {};
    const z = zones.find(x => x.id_zona == r.id_zona) || {};
    const ocupados = ins.filter(i => i.id_experiencia == e.id_experiencia && i.estado_inscripcion !== 'cancelada').reduce((s, i) => s + Number(i.cantidad_personas), 0);
    return { ...e, nombre_restaurante: r.nombre, id_propietario: r.id_propietario, nombre_zona: z.nombre_zona, ciudad: z.ciudad, cupos_ocupados: ocupados, cupos_disponibles: Math.max(0, e.cupo_maximo - ocupados) };
  }).sort((a, b) => b.fecha_experiencia.localeCompare(a.fecha_experiencia));
}

function simulateExtraAPI(base, parts, method, body, params) {
  const param = parts[1];
  switch (base) {
    case 'experiencias': {
      let list = getLS('gt_experiencias');
      if (method === 'GET') {
        const all = demoExperiences();
        return params.get('id_restaurante') ? all.filter(e => e.id_restaurante == params.get('id_restaurante')) : all;
      }
      if (!isStaffUser()) throw new Error('Esta acción requiere una cuenta de administrador o restaurante.');
      if (method === 'POST') {
        demoManages(body.id_restaurante);
        if (!body.fecha_experiencia || body.fecha_experiencia <= bogotaToday()) throw new Error('Las experiencias nuevas deben programarse desde mañana.');
        const exp = { ...body, id_experiencia: demoId(), estado_experiencia: 'programada' };
        list.push(exp); setLS('gt_experiencias', list); return exp;
      }
      const current = list.find(e => e.id_experiencia == param);
      if (!current) throw new Error('La experiencia no existe.');
      demoManages(current.id_restaurante);
      const used = getLS('gt_inscripciones').filter(i => i.id_experiencia == param);
      if (method === 'PUT') {
        const ocupados = used.filter(i => i.estado_inscripcion !== 'cancelada').reduce((s, i) => s + Number(i.cantidad_personas), 0);
        if (Number(body.cupo_maximo) < ocupados) throw new Error(`Ya hay ${ocupados} personas inscritas; el cupo no puede ser menor.`);
        if (body.estado_experiencia === 'cancelada' && current.estado_experiencia !== 'cancelada') {
          used.filter(i => i.estado_inscripcion === 'confirmada').forEach(i => demoNotify(i.id_usuario, `La experiencia "${body.nombre}" fue cancelada. El valor pagado será reembolsado.`));
        }
        setLS('gt_experiencias', list.map(e => e.id_experiencia == param ? { ...e, ...body, id_restaurante: e.id_restaurante } : e));
        return { message: 'Experiencia actualizada con éxito.' };
      }
      if (method === 'DELETE') {
        if (used.length) throw new Error('La experiencia tiene inscripciones. Cámbiala a cancelada para conservar el historial.');
        setLS('gt_experiencias', list.filter(e => e.id_experiencia != param));
        return { message: 'Experiencia eliminada con éxito.' };
      }
      break;
    }
    case 'inscripciones': {
      let list = getLS('gt_inscripciones');
      if (method === 'GET') {
        const exps = demoExperiences();
        const users = getLS('gt_usuarios');
        const pagos = getLS('gt_pagos');
        return list.map(i => {
          const e = exps.find(x => x.id_experiencia == i.id_experiencia) || {};
          const u = users.find(x => x.id_usuario == i.id_usuario) || {};
          return { ...i, nombre_experiencia: e.nombre, fecha_experiencia: e.fecha_experiencia, hora_inicio: e.hora_inicio, estado_experiencia: e.estado_experiencia, nombre_restaurante: e.nombre_restaurante, id_propietario: e.id_propietario, nombre_usuario: u.nombre, correo_usuario: u.correo, id_pago: (pagos.find(p => p.id_inscripcion == i.id_inscripcion) || {}).id_pago || null };
        }).filter(i => currentUser.tipo_usuario === 'administrador' || (currentUser.tipo_usuario === 'restaurante' ? i.id_propietario == currentUser.id_usuario : i.id_usuario == currentUser.id_usuario))
          .sort((a, b) => String(b.fecha_experiencia).localeCompare(String(a.fecha_experiencia)));
      }
      if (method === 'POST') {
        if (currentUser.tipo_usuario !== 'cliente') throw new Error('Las inscripciones se hacen con una cuenta de cliente.');
        const exp = demoExperiences().find(e => e.id_experiencia == body.id_experiencia);
        if (!exp) throw new Error('La experiencia no existe.');
        if (exp.estado_experiencia !== 'programada' || exp.fecha_experiencia <= bogotaToday()) throw new Error('La experiencia ya no recibe inscripciones.');
        const cantidad = Number(body.cantidad_personas);
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) throw new Error('La cantidad de personas no es válida.');
        if (cantidad > exp.cupos_disponibles) throw new Error(exp.cupos_disponibles ? `Solo quedan ${exp.cupos_disponibles} cupos.` : 'La experiencia no tiene cupos disponibles.');
        if (list.some(i => i.id_experiencia == exp.id_experiencia && i.id_usuario == currentUser.id_usuario)) throw new Error('Ya tienes una inscripción en esta experiencia.');
        const total = cantidad * Number(exp.precio_persona);
        const metodo = getLS('gt_metodos').find(m => m.id_metodo == body.id_metodo);
        if (total > 0 && (!metodo || metodo.tipo_pago !== 'online')) throw new Error('Selecciona un medio de pago en línea.');
        const ins = { id_inscripcion: demoId(), id_experiencia: exp.id_experiencia, id_usuario: currentUser.id_usuario, cantidad_personas: cantidad, total, fecha_inscripcion: bogotaNow(), estado_inscripcion: 'confirmada' };
        list.push(ins); setLS('gt_inscripciones', list);
        let id_pago = null;
        if (total > 0) {
          const pagos = getLS('gt_pagos');
          id_pago = demoId();
          pagos.push({ id_pago, monto: total, fecha_pago: bogotaNow(), estado_pago: 'aprobado', id_usuario: currentUser.id_usuario, id_metodo: metodo.id_metodo, id_pedido: null, id_plan: null, id_inscripcion: ins.id_inscripcion });
          setLS('gt_pagos', pagos);
        }
        demoNotify(currentUser.id_usuario, `Inscripción confirmada en "${exp.nombre}" (${exp.nombre_restaurante}) el ${exp.fecha_experiencia} para ${cantidad} personas.`);
        demoNotify(exp.id_propietario, `Nueva inscripción de ${cantidad} personas en "${exp.nombre}" del ${exp.fecha_experiencia}.`);
        demoReminder({ id_usuario: currentUser.id_usuario, tipo_recordatorio: 'experiencia', id_inscripcion: ins.id_inscripcion, titulo: exp.nombre, mensaje: `La experiencia inicia el ${exp.fecha_experiencia} a las ${String(exp.hora_inicio).slice(0, 5)}.`, fecha_programada: `${shiftDate(exp.fecha_experiencia, -1)} 09:00:00` });
        return { id_inscripcion: ins.id_inscripcion, id_pago, total, estado_inscripcion: 'confirmada' };
      }
      if (method === 'PUT') {
        const ins = list.find(i => i.id_inscripcion == param);
        if (!ins) throw new Error('La inscripción no existe.');
        if (ins.estado_inscripcion !== 'confirmada') throw new Error('Solo se modifican inscripciones confirmadas.');
        const exp = demoExperiences().find(e => e.id_experiencia == ins.id_experiencia) || {};
        const manages = currentUser.tipo_usuario === 'administrador' || (currentUser.tipo_usuario === 'restaurante' && exp.id_propietario == currentUser.id_usuario);
        if (body.estado_inscripcion === 'asistio' && !manages) throw new Error('Solo el restaurante registra la asistencia.');
        if (body.estado_inscripcion === 'asistio' && exp.fecha_experiencia > bogotaToday()) throw new Error('La asistencia se registra el día de la experiencia o después.');
        if (body.estado_inscripcion === 'cancelada' && !manages && ins.id_usuario != currentUser.id_usuario) throw new Error('No puedes cancelar esta inscripción.');
        if (body.estado_inscripcion === 'cancelada' && exp.fecha_experiencia <= bogotaToday()) throw new Error('Las inscripciones se cancelan hasta el día anterior.');
        setLS('gt_inscripciones', list.map(i => i.id_inscripcion == param ? { ...i, estado_inscripcion: body.estado_inscripcion } : i));
        if (body.estado_inscripcion === 'cancelada') setLS('gt_recordatorios', getLS('gt_recordatorios').filter(r => !(r.id_inscripcion == param && !r.enviado)));
        return { message: 'Inscripción actualizada.' };
      }
      break;
    }
    case 'suscripciones': {
      if (!isStaffUser()) throw new Error('Esta acción requiere una cuenta de administrador o restaurante.');
      demoProcessReminders();
      let list = getLS('gt_suscripciones');
      if (method === 'GET') {
        const rests = getLS('gt_restaurantes'); const plans = getLS('gt_planes'); const pagos = getLS('gt_pagos'); const metodos = getLS('gt_metodos');
        return list.map(s => {
          const r = rests.find(x => x.id_restaurante == s.id_restaurante) || {};
          const p = plans.find(x => x.id_plan == s.id_plan) || {};
          const pg = pagos.find(x => x.id_pago == s.id_pago) || {};
          return { ...s, nombre_restaurante: r.nombre, id_propietario: r.id_propietario, nombre_plan: p.nombre_plan, costo: p.costo, monto: pg.monto ?? null, fecha_pago: pg.fecha_pago ?? null, nombre_metodo: (metodos.find(m => m.id_metodo == pg.id_metodo) || {}).nombre_metodo || null };
        }).filter(s => currentUser.tipo_usuario === 'administrador' || s.id_propietario == currentUser.id_usuario)
          .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio) || b.id_suscripcion - a.id_suscripcion);
      }
      if (method === 'POST') {
        const rest = demoManages(body.id_restaurante);
        const plan = getLS('gt_planes').find(p => p.id_plan == body.id_plan);
        if (!plan) throw new Error('El plan no existe.');
        const today = bogotaToday();
        const active = list.filter(s => s.id_restaurante == rest.id_restaurante && s.estado_suscripcion === 'activa').sort((a, b) => b.fecha_fin.localeCompare(a.fecha_fin))[0];
        let inicio = today;
        if (active && active.id_plan == plan.id_plan) {
          inicio = active.fecha_fin;
          if (inicio > shiftDate(today, 31)) throw new Error(`El plan ya está pagado hasta ${inicio}. Puedes renovarlo desde un mes antes del vencimiento.`);
        } else if (active) {
          list = list.map(s => s.id_suscripcion === active.id_suscripcion ? { ...s, estado_suscripcion: 'cancelada' } : s);
        }
        const fin = addMonthsDate(inicio, Number(plan.duracion_meses));
        let id_pago = null;
        if (Number(plan.costo) > 0) {
          const metodo = getLS('gt_metodos').find(m => m.id_metodo == body.id_metodo);
          if (!metodo || metodo.tipo_pago !== 'online') throw new Error('Selecciona un medio de pago en línea.');
          const pagos = getLS('gt_pagos'); id_pago = demoId();
          pagos.push({ id_pago, monto: plan.costo, fecha_pago: bogotaNow(), estado_pago: 'aprobado', id_usuario: currentUser.id_usuario, id_metodo: metodo.id_metodo, id_pedido: null, id_plan: plan.id_plan, id_inscripcion: null });
          setLS('gt_pagos', pagos);
        }
        const sub = { id_suscripcion: demoId(), id_restaurante: rest.id_restaurante, id_plan: plan.id_plan, fecha_inicio: inicio, fecha_fin: fin, estado_suscripcion: 'activa', id_pago };
        list.push(sub); setLS('gt_suscripciones', list);
        setLS('gt_restaurantes', getLS('gt_restaurantes').map(r => r.id_restaurante == rest.id_restaurante ? { ...r, id_plan: plan.id_plan } : r));
        demoNotify(rest.id_propietario, `Plan ${plan.nombre_plan} activo para ${rest.nombre} del ${inicio} al ${fin}.`);
        demoReminder({ id_usuario: rest.id_propietario, tipo_recordatorio: 'plan', id_suscripcion: sub.id_suscripcion, titulo: `Renovación del plan ${plan.nombre_plan}`, mensaje: `El plan de ${rest.nombre} vence el ${fin}.`, fecha_programada: `${shiftDate(fin, -5)} 08:00:00` });
        return { ...sub };
      }
      break;
    }
    case 'recordatorios': {
      demoProcessReminders();
      const list = getLS('gt_recordatorios');
      if (method === 'GET') return list.filter(r => r.id_usuario == currentUser.id_usuario).sort((a, b) => Number(a.enviado) - Number(b.enviado) || b.fecha_programada.localeCompare(a.fecha_programada));
      if (method === 'POST') {
        const fecha = String(body.fecha_programada || '').replace('T', ' ');
        if (!body.titulo?.trim() || !body.mensaje?.trim()) throw new Error('Escribe el título y el mensaje del recordatorio.');
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(fecha)) throw new Error('La fecha y hora del recordatorio no son válidas.');
        const fecha_programada = fecha.length === 16 ? `${fecha}:00` : fecha;
        if (fecha_programada <= bogotaNow()) throw new Error('El recordatorio debe programarse en el futuro.');
        let tipo = 'personal'; let id_reserva = null;
        if (body.id_reserva) {
          const own = getLS('gt_reservas').find(r => r.id_reserva == body.id_reserva && r.id_usuario == currentUser.id_usuario);
          if (!own) throw new Error('Solo puedes asociar tus propias reservas.');
          tipo = 'reserva'; id_reserva = own.id_reserva;
        }
        const item = { id_recordatorio: demoId(), id_usuario: currentUser.id_usuario, tipo_recordatorio: tipo, titulo: body.titulo.trim(), mensaje: body.mensaje.trim(), fecha_programada, enviado: false, fecha_envio: null, id_reserva, id_inscripcion: null, id_suscripcion: null };
        list.push(item); setLS('gt_recordatorios', list);
        return item;
      }
      if (method === 'DELETE') {
        const target = list.find(r => r.id_recordatorio == param && r.id_usuario == currentUser.id_usuario && !r.enviado);
        if (!target) throw new Error('El recordatorio no existe, no es tuyo o ya fue enviado.');
        setLS('gt_recordatorios', list.filter(r => r !== target));
        return { message: 'Recordatorio eliminado.' };
      }
      break;
    }
  }
  return undefined;
}

// --------------------------------------------------------------------
// INTERFAZ: EXPERIENCIAS GASTRONÓMICAS
// --------------------------------------------------------------------
let experienciasList = [];
async function loadExperienciasSection() {
  const select = document.getElementById('exp-filtro-restaurante');
  if (select && select.options.length <= 1) await fillRestaurantSelect(select, true);
  document.getElementById('btn-add-experiencia').style.display = isStaffUser() ? 'inline-flex' : 'none';
  await renderExperiencias();
  await renderInscripciones();
}

async function renderExperiencias() {
  const container = document.getElementById('experiencias-container');
  container.innerHTML = '<p class="info-text">Cargando experiencias...</p>';
  try {
    experienciasList = await requestAPI('experiencias');
    const rest = document.getElementById('exp-filtro-restaurante').value;
    const estado = document.getElementById('exp-filtro-estado').value;
    const tipo = document.getElementById('exp-filtro-tipo').value;
    const today = bogotaToday();
    // "Programadas" muestra solo las próximas; las de fechas pasadas quedan en "Todas" hasta que el restaurante las cierre.
    const filtered = experienciasList.filter(e => (!rest || e.id_restaurante == rest) && (!estado || (e.estado_experiencia === estado && (estado !== 'programada' || e.fecha_experiencia >= today))) && (!tipo || e.tipo_experiencia === tipo))
      .sort((a, b) => (a.estado_experiencia === 'programada' ? 0 : 1) - (b.estado_experiencia === 'programada' ? 0 : 1) || (a.estado_experiencia === 'programada' ? a.fecha_experiencia.localeCompare(b.fecha_experiencia) : b.fecha_experiencia.localeCompare(a.fecha_experiencia)));
    if (!filtered.length) { container.innerHTML = '<p class="info-text">No hay experiencias para los filtros seleccionados.</p>'; return; }
    container.innerHTML = filtered.map(e => {
      const manages = currentUser.tipo_usuario === 'administrador' || (currentUser.tipo_usuario === 'restaurante' && e.id_propietario == currentUser.id_usuario);
      const open = e.estado_experiencia === 'programada' && e.fecha_experiencia > bogotaToday();
      let actions = '';
      if (manages) actions = `<button class="btn btn-sm btn-secondary" onclick="openExperienciaModal(${e.id_experiencia})">Editar</button> <button class="btn btn-sm btn-danger" onclick="deleteExperiencia(${e.id_experiencia})">Eliminar</button>`;
      else if (currentUser.tipo_usuario === 'cliente' && open) actions = e.cupos_disponibles > 0 ? `<button class="btn btn-sm btn-primary btn-block" onclick="openInscripcionModal(${e.id_experiencia})">Inscribirme</button>` : '<span class="text-muted">Sin cupos disponibles</span>';
      return `<div class="restaurant-card glass">
        <div class="restaurant-badge-container"><h3>${escapeHTML(e.nombre)}</h3><span class="badge-status ${e.estado_experiencia === 'programada' ? 'confirmada' : e.estado_experiencia === 'cancelada' ? 'cancelada' : 'finalizada'}">${escapeHTML(e.estado_experiencia)}</span></div>
        <div class="restaurant-card-body">
          <p><i data-lucide="sparkles"></i> <span>${escapeHTML(EXPERIENCE_LABELS[e.tipo_experiencia] || e.tipo_experiencia)} · ${escapeHTML(e.idioma)}</span></p>
          <p><i data-lucide="store"></i> <span>${escapeHTML(e.nombre_restaurante)} (${escapeHTML(e.ciudad || '')})</span></p>
          <p><i data-lucide="calendar"></i> <span>${escapeHTML(e.fecha_experiencia)} · ${escapeHTML(String(e.hora_inicio).slice(0, 5))} · ${Number(e.duracion_minutos)} min</span></p>
          <p><i data-lucide="users"></i> <span>Cupos: ${Number(e.cupos_disponibles)} de ${Number(e.cupo_maximo)} disponibles</span></p>
          <p><i data-lucide="wallet"></i> <span>${formatCOP(e.precio_persona)} por persona</span></p>
          <p class="plato-description">${escapeHTML(e.descripcion || '')}</p>
        </div>
        <div class="restaurant-card-footer">${actions}</div>
      </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    container.innerHTML = `<p class="info-text color-danger">Error: ${escapeHTML(error.message)}</p>`;
  }
}

async function openExperienciaModal(id = null) {
  const form = document.getElementById('form-modal-experiencia');
  form.reset();
  document.getElementById('mexp-id').value = id || '';
  const select = document.getElementById('mexp-restaurante');
  const rests = (await requestAPI('restaurantes')).filter(r => currentUser.tipo_usuario === 'administrador' || r.id_propietario == currentUser.id_usuario);
  select.innerHTML = rests.map(r => `<option value="${r.id_restaurante}">${escapeHTML(r.nombre)}</option>`).join('');
  if (!rests.length) { showToast('Primero registra un restaurante propio.', 'warning'); return; }
  const fecha = document.getElementById('mexp-fecha');
  fecha.min = shiftDate(bogotaToday(), 1);
  document.getElementById('mexp-estado-group').style.display = id ? 'block' : 'none';
  if (id) {
    const e = experienciasList.find(x => x.id_experiencia == id);
    if (!e) return;
    fecha.min = '';
    select.value = e.id_restaurante; select.disabled = true;
    document.getElementById('mexp-nombre').value = e.nombre;
    document.getElementById('mexp-descripcion').value = e.descripcion || '';
    document.getElementById('mexp-tipo').value = e.tipo_experiencia;
    fecha.value = e.fecha_experiencia;
    document.getElementById('mexp-hora').value = String(e.hora_inicio).slice(0, 5);
    document.getElementById('mexp-duracion').value = e.duracion_minutos;
    document.getElementById('mexp-cupo').value = e.cupo_maximo;
    document.getElementById('mexp-precio').value = Number(e.precio_persona);
    document.getElementById('mexp-idioma').value = e.idioma;
    document.getElementById('mexp-estado').value = e.estado_experiencia;
    document.getElementById('modal-experiencia-title').textContent = 'Editar experiencia';
  } else {
    select.disabled = false;
    fecha.value = shiftDate(bogotaToday(), 7);
    document.getElementById('modal-experiencia-title').textContent = 'Nueva experiencia gastronómica';
  }
  document.getElementById('modal-experiencia').classList.add('active');
}

async function saveExperiencia(event) {
  event.preventDefault();
  const id = document.getElementById('mexp-id').value;
  const payload = {
    id_restaurante: Number(document.getElementById('mexp-restaurante').value),
    nombre: document.getElementById('mexp-nombre').value.trim(),
    descripcion: document.getElementById('mexp-descripcion').value.trim(),
    tipo_experiencia: document.getElementById('mexp-tipo').value,
    fecha_experiencia: document.getElementById('mexp-fecha').value,
    hora_inicio: `${document.getElementById('mexp-hora').value}:00`,
    duracion_minutos: Number(document.getElementById('mexp-duracion').value),
    cupo_maximo: Number(document.getElementById('mexp-cupo').value),
    precio_persona: Number(document.getElementById('mexp-precio').value),
    idioma: document.getElementById('mexp-idioma').value.trim() || 'Español',
    estado_experiencia: id ? document.getElementById('mexp-estado').value : 'programada'
  };
  try {
    await requestAPI(id ? `experiencias/${id}` : 'experiencias', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast(id ? 'Experiencia actualizada.' : 'Experiencia publicada.', 'success');
    closeModal('modal-experiencia');
    renderExperiencias();
  } catch (error) { showToast(error.message, 'danger'); }
}

async function deleteExperiencia(id) {
  if (!confirm('¿Eliminar esta experiencia? Solo es posible si no tiene inscripciones.')) return;
  try {
    await requestAPI(`experiencias/${id}`, { method: 'DELETE' });
    showToast('Experiencia eliminada.', 'success');
    renderExperiencias();
  } catch (error) { showToast(error.message, 'danger'); }
}

async function openInscripcionModal(id) {
  const e = experienciasList.find(x => x.id_experiencia == id);
  if (!e) return;
  document.getElementById('mins-experiencia').value = id;
  document.getElementById('mins-resumen').textContent = `${e.nombre} · ${e.nombre_restaurante} · ${e.fecha_experiencia} ${String(e.hora_inicio).slice(0, 5)} · ${formatCOP(e.precio_persona)} por persona · ${e.cupos_disponibles} cupos libres`;
  const personas = document.getElementById('mins-personas');
  personas.max = Math.min(20, e.cupos_disponibles); personas.value = 1;
  const metodos = (await requestAPI('metodos_pago')).filter(m => m.tipo_pago === 'online');
  document.getElementById('mins-metodo').innerHTML = metodos.map(m => `<option value="${m.id_metodo}">${escapeHTML(m.nombre_metodo)}</option>`).join('');
  const updateTotal = () => { document.getElementById('mins-total').textContent = formatCOP(Number(personas.value || 0) * Number(e.precio_persona)); };
  personas.oninput = updateTotal; updateTotal();
  document.getElementById('modal-inscripcion').classList.add('active');
}

async function saveInscripcion(event) {
  event.preventDefault();
  try {
    const result = await requestAPI('inscripciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id_experiencia: Number(document.getElementById('mins-experiencia').value),
      cantidad_personas: Number(document.getElementById('mins-personas').value),
      id_metodo: Number(document.getElementById('mins-metodo').value)
    }) });
    showToast(`Pago aprobado (${formatCOP(result.total)}). Inscripción confirmada.`, 'success');
    closeModal('modal-inscripcion');
    renderExperiencias(); renderInscripciones(); loadNotifications();
  } catch (error) { showToast(error.message, 'danger'); }
}

async function renderInscripciones() {
  const tbody = document.getElementById('inscripciones-tbody');
  document.getElementById('inscripciones-title').textContent = currentUser.tipo_usuario === 'cliente' ? 'Mis inscripciones' : 'Inscripciones de mis experiencias';
  try {
    const list = await requestAPI('inscripciones');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="info-text">No hay inscripciones registradas.</td></tr>'; return; }
    const today = bogotaToday();
    tbody.innerHTML = list.slice(0, 50).map(i => {
      const manages = isStaffUser();
      let actions = '';
      if (i.estado_inscripcion === 'confirmada' && i.fecha_experiencia > today) actions += `<button class="btn btn-sm btn-danger" onclick="updateInscripcion(${i.id_inscripcion}, 'cancelada')">Cancelar</button>`;
      if (manages && i.estado_inscripcion === 'confirmada' && i.fecha_experiencia <= today) actions += `<button class="btn btn-sm btn-success" onclick="updateInscripcion(${i.id_inscripcion}, 'asistio')">Asistió</button>`;
      const estadoClase = { confirmada: 'confirmada', cancelada: 'cancelada', asistio: 'finalizada' }[i.estado_inscripcion];
      return `<tr><td>${escapeHTML(i.nombre_experiencia)}<br><small>${escapeHTML(i.nombre_restaurante)}</small></td>
        <td>${escapeHTML(i.fecha_experiencia)} ${escapeHTML(String(i.hora_inicio || '').slice(0, 5))}</td>
        <td>${escapeHTML(i.nombre_usuario)}</td><td>${Number(i.cantidad_personas)}</td><td>${formatCOP(i.total)}</td>
        <td><span class="badge-status ${estadoClase}">${i.estado_inscripcion === 'asistio' ? 'asistió' : escapeHTML(i.estado_inscripcion)}</span></td>
        <td><div class="table-actions">${actions || '<span class="text-muted">—</span>'}</div></td></tr>`;
    }).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="info-text">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

async function updateInscripcion(id, estado) {
  if (estado === 'cancelada' && !confirm('¿Cancelar esta inscripción?')) return;
  try {
    await requestAPI(`inscripciones/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado_inscripcion: estado }) });
    showToast(estado === 'cancelada' ? 'Inscripción cancelada.' : 'Asistencia registrada.', 'success');
    renderExperiencias(); renderInscripciones();
  } catch (error) { showToast(error.message, 'danger'); }
}

// --------------------------------------------------------------------
// INTERFAZ: PLANES Y SUSCRIPCIÓN
// --------------------------------------------------------------------
async function loadPlanesSection() {
  try {
    const [planes, rests, metodos, subs] = await Promise.all([requestAPI('planes'), requestAPI('restaurantes'), requestAPI('metodos_pago'), requestAPI('suscripciones')]);
    const own = rests.filter(r => currentUser.tipo_usuario === 'administrador' || r.id_propietario == currentUser.id_usuario);
    document.getElementById('plan-restaurante').innerHTML = own.map(r => `<option value="${r.id_restaurante}">${escapeHTML(r.nombre)} — plan actual: ${escapeHTML(r.nombre_plan || 'Básico')}</option>`).join('') || '<option value="">No tienes restaurantes registrados</option>';
    document.getElementById('plan-metodo').innerHTML = metodos.filter(m => m.tipo_pago === 'online').map(m => `<option value="${m.id_metodo}">${escapeHTML(m.nombre_metodo)}</option>`).join('');
    document.getElementById('planes-container').innerHTML = planes.map(p => `<div class="restaurant-card glass">
        <div class="restaurant-badge-container"><h3>${escapeHTML(p.nombre_plan)}</h3><span class="role-badge">${Number(p.duracion_meses)} ${Number(p.duracion_meses) === 1 ? 'mes' : 'meses'}</span></div>
        <div class="restaurant-card-body"><p class="total-highlight">${Number(p.costo) ? formatCOP(p.costo) : 'Gratis'}</p><p>${escapeHTML(p.descripcion || '')}</p></div>
        <div class="restaurant-card-footer"><button class="btn btn-sm btn-primary btn-block" onclick="contratarPlan(${p.id_plan})" ${own.length ? '' : 'disabled'}>Contratar o renovar</button></div>
      </div>`).join('');
    const today = bogotaToday();
    document.getElementById('suscripciones-tbody').innerHTML = subs.length ? subs.map(s => {
      const dias = s.estado_suscripcion === 'activa' ? Math.round((Date.parse(`${s.fecha_fin}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
      const clase = { activa: 'confirmada', vencida: 'finalizada', cancelada: 'cancelada' }[s.estado_suscripcion];
      return `<tr><td>${escapeHTML(s.nombre_restaurante)}</td><td>${escapeHTML(s.nombre_plan)}</td><td>${escapeHTML(s.fecha_inicio)}</td><td>${escapeHTML(s.fecha_fin)}${dias !== null ? `<br><small>${dias} días restantes</small>` : ''}</td>
        <td>${s.id_pago ? `${formatCOP(s.monto)} · ${escapeHTML(s.nombre_metodo || '')}` : 'Sin costo'}</td><td><span class="badge-status ${clase}">${escapeHTML(s.estado_suscripcion)}</span></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="info-text">No hay suscripciones registradas.</td></tr>';
  } catch (error) { showToast(error.message, 'danger'); }
}

async function contratarPlan(id_plan) {
  const id_restaurante = Number(document.getElementById('plan-restaurante').value);
  const id_metodo = Number(document.getElementById('plan-metodo').value);
  if (!id_restaurante) { showToast('Selecciona un restaurante.', 'warning'); return; }
  if (!confirm('¿Confirmas el pago en línea del plan seleccionado?')) return;
  try {
    const result = await requestAPI('suscripciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_restaurante, id_plan, id_metodo }) });
    showToast(`Plan activo del ${result.fecha_inicio} al ${result.fecha_fin}.`, 'success');
    loadPlanesSection(); loadNotifications();
  } catch (error) { showToast(error.message, 'danger'); }
}

// --------------------------------------------------------------------
// INTERFAZ: RECORDATORIOS PERSONALIZADOS
// --------------------------------------------------------------------
async function loadRecordatoriosSection() {
  const input = document.getElementById('rec-fecha');
  const now = bogotaNow().slice(0, 16).replace(' ', 'T');
  input.min = now;
  if (!input.value) input.value = `${shiftDate(bogotaToday(), 1)}T09:00`;
  const select = document.getElementById('rec-reserva');
  try {
    const reservas = currentUser.tipo_usuario === 'cliente' ? (await requestAPI('reservas')).filter(r => r.id_usuario == currentUser.id_usuario && ['pendiente', 'confirmada'].includes(r.estado_reserva) && r.fecha_reserva >= bogotaToday()) : [];
    select.innerHTML = '<option value="">Sin asociar (recordatorio personal)</option>' + reservas.map(r => `<option value="${r.id_reserva}">${escapeHTML(r.nombre_restaurante)} · ${escapeHTML(r.fecha_reserva)} ${escapeHTML(String(r.hora_reserva).slice(0, 5))}</option>`).join('');
  } catch (_) { select.innerHTML = '<option value="">Sin asociar (recordatorio personal)</option>'; }
  await renderRecordatorios();
}

async function renderRecordatorios() {
  const tbody = document.getElementById('recordatorios-tbody');
  try {
    const list = await requestAPI('recordatorios');
    tbody.innerHTML = list.length ? list.map(r => `<tr>
      <td>${escapeHTML(r.titulo)}<br><small>${escapeHTML(r.mensaje)}</small></td>
      <td>${escapeHTML(REMINDER_LABELS[r.tipo_recordatorio] || r.tipo_recordatorio)}</td>
      <td>${escapeHTML(String(r.fecha_programada).slice(0, 16))}</td>
      <td><span class="badge-status ${r.enviado ? 'finalizada' : 'pendiente'}">${r.enviado ? 'Enviado' : 'Programado'}</span></td>
      <td>${r.enviado ? '<span class="text-muted">—</span>' : `<button class="btn btn-sm btn-danger" onclick="deleteRecordatorio(${r.id_recordatorio})">Eliminar</button>`}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="info-text">No tienes recordatorios.</td></tr>';
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="info-text">Error: ${escapeHTML(error.message)}</td></tr>`;
  }
}

async function saveRecordatorio(event) {
  event.preventDefault();
  try {
    await requestAPI('recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      titulo: document.getElementById('rec-titulo').value,
      mensaje: document.getElementById('rec-mensaje').value,
      fecha_programada: document.getElementById('rec-fecha').value,
      id_reserva: Number(document.getElementById('rec-reserva').value) || null
    }) });
    showToast('Recordatorio programado.', 'success');
    document.getElementById('form-recordatorio').reset();
    loadRecordatoriosSection();
  } catch (error) { showToast(error.message, 'danger'); }
}

async function deleteRecordatorio(id) {
  try {
    await requestAPI(`recordatorios/${id}`, { method: 'DELETE' });
    showToast('Recordatorio eliminado.', 'success');
    renderRecordatorios();
  } catch (error) { showToast(error.message, 'danger'); }
}

// --------------------------------------------------------------------
// INTEGRACIÓN CON LA NAVEGACIÓN
// --------------------------------------------------------------------
window.sectionLoaders = {
  'section-experiencias': loadExperienciasSection,
  'section-planes': loadPlanesSection,
  'section-recordatorios': loadRecordatoriosSection
};
window.onDashboardShown = () => {
  document.getElementById('menu-planes').style.display = isStaffUser() ? 'flex' : 'none';
  // En demostración los recordatorios vencidos se envían al abrir la aplicación.
  if (!isConnectedToDB && typeof demoProcessReminders === 'function') { try { demoProcessReminders(); } catch (_) { /* sin datos demo */ } }
};
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-modal-experiencia')?.addEventListener('submit', saveExperiencia);
  document.getElementById('form-modal-inscripcion')?.addEventListener('submit', saveInscripcion);
  document.getElementById('form-recordatorio')?.addEventListener('submit', saveRecordatorio);
  document.getElementById('btn-add-experiencia')?.addEventListener('click', () => openExperienciaModal());
  ['exp-filtro-restaurante', 'exp-filtro-estado', 'exp-filtro-tipo'].forEach(id => document.getElementById(id)?.addEventListener('change', renderExperiencias));
});
Object.assign(window, { openExperienciaModal, deleteExperiencia, openInscripcionModal, updateInscripcion, contratarPlan, deleteRecordatorio });
