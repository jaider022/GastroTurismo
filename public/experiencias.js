/* Experiencias: reservas de cupos y recepción de pagos en el restaurante. */
let experienceRows = [], experienceBookings = [], experienceRestaurants = [], experienceMethods = [];
let experienceRequest = 0, experiencePage = 1, experienceBookingPage = 1, experienceAttempt = null, experienceCharge = null;
const expNode = id => document.getElementById(id);
const expMoney = value => Number(value).toLocaleString('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:2});
const expStaff = () => ['administrador','restaurante'].includes(currentUser?.tipo_usuario);
const expOpen = row => row.estado === 'activa' && row.fecha_hora > bogotaNow();
function resetExperiencias() {
  experienceRequest++; experienceRows=[]; experienceBookings=[]; experienceRestaurants=[]; experienceMethods=[]; experienceAttempt=null; experienceCharge=null;
  if (expNode('exp-catalogo')) expNode('exp-catalogo').innerHTML='';
  if (expNode('exp-reservas-body')) expNode('exp-reservas-body').innerHTML='';
}
async function experienceAPI(route, options={}) {
  if (isConnectedToDB) return requestAPI(route, { ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } });
  return experienceDemoAPI(route, options);
}
function experienceDemoAPI(route, options={}) {
  const [resource,rawId,action]=route.split('?')[0].split('/'),value=Number(rawId),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  const activities=getLS('gt_experiencias'),reservations=getLS('gt_reservas_experiencias'),restaurants=getLS('gt_restaurantes');
  const manage=e=>currentUser?.tipo_usuario==='administrador'||(currentUser?.tipo_usuario==='restaurante'&&restaurants.some(r=>Number(r.id_restaurante)===Number(e.id_restaurante)&&Number(r.id_propietario)===Number(currentUser.id_usuario)));
  const enriched=e=>{const r=restaurants.find(r=>Number(r.id_restaurante)===Number(e.id_restaurante));const zone=getLS('gt_zonas').find(z=>Number(z.id_zona)===Number(r?.id_zona));const used=reservations.filter(b=>Number(b.id_experiencia)===Number(e.id_experiencia)&&b.estado==='confirmada').reduce((n,b)=>n+Number(b.cantidad_personas),0);return{...e,nombre_restaurante:r?.nombre,direccion:r?.direccion,nombre_municipio:zone?.ciudad||'Quindío',cupos_reservados:used,cupos_disponibles:Number(e.cupos)-used};};
  const requireUser=()=>{if(!currentUser)throw Error('Debes iniciar sesión.');};
  const notify=(message,user)=>setLS('gt_notificaciones',[...getLS('gt_notificaciones'),{id_notificacion:Date.now(),id_usuario:user,mensaje:message,fecha_envio:bogotaNow(),leido:0}]);
  const saveBooking=row=>setLS('gt_reservas_experiencias',reservations.map(b=>Number(b.id_reserva_experiencia)===Number(row.id_reserva_experiencia)?row:b));
  const nextId=(rows,key)=>Math.max(0,...rows.map(r=>Number(r[key])))+1;
  if(resource==='experiencias'){
    if(method==='GET'){
      if(route.includes('gestion=1')){requireUser();if(!expStaff())throw Error('No tienes permiso para gestionar actividades.');return activities.filter(manage).map(enriched).sort((a,b)=>a.fecha_hora.localeCompare(b.fecha_hora));}
      return activities.filter(expOpen).map(enriched).sort((a,b)=>a.fecha_hora.localeCompare(b.fecha_hora));
    }
    requireUser();if(!expStaff())throw Error('No tienes permiso para gestionar actividades.');
    const previous=activities.find(e=>Number(e.id_experiencia)===value);
    if(method==='PUT'&&(!previous||!manage(previous)))throw Error('No puedes modificar esta actividad.');
    if(previous&&!expOpen(previous))throw Error('La actividad está cerrada y conserva su historial.');
    if(method==='PUT'&&body.estado==='cancelada'){
      if(reservations.some(b=>Number(b.id_experiencia)===value&&b.estado==='confirmada'&&b.estado_pago==='pagado'))throw Error('La actividad tiene reservas cobradas; consulta las devoluciones con el restaurante.');
      setLS('gt_experiencias',activities.map(e=>Number(e.id_experiencia)===value?{...e,estado:'cancelada'}:e));
      setLS('gt_reservas_experiencias',reservations.map(b=>{if(Number(b.id_experiencia)!==value||b.estado!=='confirmada')return b;notify('La actividad '+previous.nombre+' fue cancelada por el restaurante.',b.id_usuario);return{...b,estado:'cancelada'};}));
      return{estado:'cancelada'};
    }
    const data={...previous,...body};data.fecha_hora=data.fecha_hora?.replace('T',' ');if(data.fecha_hora?.length===16)data.fecha_hora+=':00';
    const restaurant=restaurants.find(r=>Number(r.id_restaurante)===Number(data.id_restaurante));
    if(!restaurant||!manage(data))throw Error('Selecciona un restaurante autorizado.');
    if(!data.nombre?.trim()||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(data.fecha_hora)||data.fecha_hora<=bogotaNow()||!Number.isInteger(Number(data.cupos))||Number(data.cupos)<1||Number(data.cupos)>Number(restaurant.capacidad_total)||!Number.isInteger(Number(data.duracion_minutos))||Number(data.duracion_minutos)<1||Number(data.duracion_minutos)>1440||!Number.isFinite(Number(data.precio))||Number(data.precio)<0)throw Error('Revisa los datos, la fecha, el precio y los cupos.');
    const used=previous?enriched(previous).cupos_reservados:0;
    if(previous&&Number(data.id_restaurante)!==Number(previous.id_restaurante))throw Error('El restaurante no puede cambiarse.');
    if(used>Number(data.cupos))throw Error('Los cupos no pueden ser menores que las reservas.');
    if(used&&(data.fecha_hora!==previous.fecha_hora||Number(data.duracion_minutos)!==Number(previous.duracion_minutos)))throw Error('Hay cupos reservados; conserva fecha y duración.');
    const row={...data,nombre:data.nombre.trim(),precio:Number(data.precio),id_experiencia:previous?.id_experiencia||nextId(activities,'id_experiencia'),estado:'activa'};
    setLS('gt_experiencias',previous?activities.map(e=>e.id_experiencia===previous.id_experiencia?row:e):[...activities,row]);return row;
  }
  requireUser();
  if(resource==='reservas_experiencias'&&method==='GET')return reservations.filter(b=>{const e=activities.find(e=>Number(e.id_experiencia)===Number(b.id_experiencia));return currentUser.tipo_usuario==='cliente'?Number(b.id_usuario)===Number(currentUser.id_usuario):e&&manage(e);}).map(b=>{const e=activities.find(e=>Number(e.id_experiencia)===Number(b.id_experiencia)),r=restaurants.find(r=>Number(r.id_restaurante)===Number(e?.id_restaurante)),u=getLS('gt_usuarios').find(u=>Number(u.id_usuario)===Number(b.id_usuario)),m=getLS('gt_metodos').find(m=>Number(m.id_metodo)===Number(b.id_metodo));return{...b,nombre_experiencia:e?.nombre,fecha_hora:e?.fecha_hora,duracion_minutos:e?.duracion_minutos,estado_experiencia:e?.estado,id_restaurante:r?.id_restaurante,nombre_restaurante:r?.nombre,nombre_usuario:u?.nombre||currentUser.nombre,total:Math.round(Number(b.precio_unitario)*Number(b.cantidad_personas)*100)/100,nombre_metodo:m?.nombre_metodo};}).sort((a,b)=>b.fecha_hora.localeCompare(a.fecha_hora));
  if(resource==='reservas_experiencias'&&method==='POST'){
    if(currentUser.tipo_usuario!=='cliente')throw Error('Reserva desde una cuenta de cliente.');
    const previous=reservations.find(b=>Number(b.id_usuario)===Number(currentUser.id_usuario)&&b.referencia===body.referencia);
    if(previous){if(Number(previous.id_experiencia)!==Number(body.id_experiencia)||Number(previous.cantidad_personas)!==Number(body.cantidad_personas))throw Error('Esta referencia ya corresponde a otra reserva.');return previous;}
    const e=activities.find(e=>Number(e.id_experiencia)===Number(body.id_experiencia));
    if(!e||!expOpen(e)||!Number.isInteger(body.cantidad_personas)||body.cantidad_personas<1||!body.referencia)throw Error('Revisa la actividad y la cantidad de personas.');
    if(body.precio_esperado!=null&&Number(body.precio_esperado)!==Number(e.precio))throw Error('El precio cambió. Actualiza las actividades antes de confirmar.');
    if(body.cantidad_personas>enriched(e).cupos_disponibles)throw Error('No quedan suficientes cupos. Actualiza la disponibilidad.');
    const row={id_reserva_experiencia:nextId(reservations,'id_reserva_experiencia'),id_experiencia:e.id_experiencia,id_usuario:currentUser.id_usuario,cantidad_personas:body.cantidad_personas,fecha_reserva:bogotaNow(),estado:'confirmada',precio_unitario:Number(e.precio),referencia:body.referencia,estado_pago:'pendiente',id_metodo:null,fecha_pago:null,cobrado_por:null};
    setLS('gt_reservas_experiencias',[...reservations,row]);notify('Tus cupos para '+e.nombre+' quedaron confirmados. Paga en el restaurante.',currentUser.id_usuario);return row;
  }
  const b=reservations.find(b=>Number(b.id_reserva_experiencia)===value),e=activities.find(e=>Number(e.id_experiencia)===Number(b?.id_experiencia));
  if(!b||!e)throw Error('La reserva no existe.');
  if(!(manage(e)||(currentUser.tipo_usuario==='cliente'&&Number(b.id_usuario)===Number(currentUser.id_usuario))))throw Error('No puedes gestionar esta reserva.');
  if(method==='PUT'&&action==='cancelar'){
    if(b.estado==='cancelada')return b;
    if(b.estado_pago==='pagado')throw Error('La reserva ya fue cobrada. Consulta la devolución en el restaurante.');
    if(e.fecha_hora<=bogotaNow())throw Error('La actividad ya empezó.');
    const next={...b,estado:'cancelada'};saveBooking(next);notify('Tu reserva de experiencia #'+value+' fue cancelada.',b.id_usuario);return next;
  }
  if(method==='PUT'&&action==='cobrar'){
    if(!expStaff()||!manage(e))throw Error('Solo el restaurante encargado registra el pago.');
    if(b.estado!=='confirmada'||e.estado!=='activa')throw Error('Una reserva cancelada no puede cobrarse.');
    const m=getLS('gt_metodos').find(m=>Number(m.id_metodo)===Number(body.id_metodo)&&m.tipo_pago==='presencial');if(!m)throw Error('Selecciona un medio presencial.');
    if(b.estado_pago==='pagado'){if(Number(b.id_metodo)!==Number(m.id_metodo))throw Error('El pago ya está registrado con otro medio.');return b;}
    const next={...b,estado_pago:'pagado',id_metodo:m.id_metodo,fecha_pago:bogotaNow(),cobrado_por:currentUser.id_usuario};saveBooking(next);notify('El restaurante registró el pago de tu reserva de experiencia #'+value+'.',b.id_usuario);return next;
  }
  throw Error('Operación de experiencias no válida.');
}
async function loadExperienciasSection() {
  if (!currentUser) return;
  const ticket=++experienceRequest, user=currentUser, staff=expStaff();
  expNode('btn-add-experiencia').hidden=!staff;
  expNode('exp-reservas-titulo').textContent=staff?'Reservas de experiencias':'Mis cupos reservados';
  expNode('exp-vista').querySelector('option[value="todas"]').hidden=!staff;
  if (!staff) expNode('exp-vista').value='proximas';
  expNode('exp-status').textContent='Consultando actividades y cupos…';
  try {
    const [rows,bookings,restaurants,methods]=await Promise.all([experienceAPI('experiencias'+(staff?'?gestion=1':'')),experienceAPI('reservas_experiencias'),requestAPI('restaurantes'),staff?requestAPI('metodos_pago'):Promise.resolve([])]);
    if(ticket!==experienceRequest || currentUser!==user)return;
    experienceRows=rows; experienceBookings=bookings;
    experienceRestaurants=restaurants.filter(r=>user.tipo_usuario!=='restaurante'||Number(r.id_propietario)===Number(user.id_usuario));
    experienceMethods=methods.filter(m=>m.tipo_pago==='presencial');
    const filter=expNode('exp-restaurante-filtro'),previous=filter.value;
    filter.innerHTML='<option value="">Todos</option>';
    for(const r of experienceRestaurants){const o=document.createElement('option');o.value=r.id_restaurante;o.textContent=r.nombre;filter.appendChild(o);}
    filter.value=experienceRestaurants.some(r=>String(r.id_restaurante)===previous)?previous:'';
    expNode('exp-status').textContent='Reserva sin cobro online. Cupos actualizados al consultar.';
    renderExperiencias();
  }catch(error){if(ticket!==experienceRequest||currentUser!==user)return;experienceRows=[];experienceBookings=[];renderExperiencias();expNode('exp-status').textContent=error.message;}
}
function expPagination(items,page,prefix) {
  const pages=Math.max(1,Math.ceil(items.length/6)),actual=Math.min(Math.max(1,page),pages);
  expNode(prefix+'-pagina').textContent=`Página ${actual} de ${pages}`;
  expNode(prefix+'-prev').disabled=actual<=1;expNode(prefix+'-next').disabled=actual>=pages;
  expNode(prefix+'-resumen').textContent=`${items.length} resultado(s)`;
  return {page:actual,rows:items.slice((actual-1)*6,actual*6)};
}
function renderExperiencias() {
  const term=expNode('exp-busqueda').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(), rest=expNode('exp-restaurante-filtro').value,fecha=expNode('exp-fecha-filtro').value;
  const matches=r=>(!rest||Number(r.id_restaurante)===Number(rest))&&(!fecha||r.fecha_hora.slice(0,10)===fecha)&&`${r.nombre||r.nombre_experiencia} ${r.nombre_restaurante}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term);
  const catalog=expPagination(experienceRows.filter(r=>matches(r)&&(expNode('exp-vista').value==='todas'||expOpen(r))),experiencePage,'exp');experiencePage=catalog.page;
  const container=expNode('exp-catalogo');container.innerHTML='';
  if(!catalog.rows.length)container.innerHTML='<p class="info-text">No hay experiencias para estos filtros.</p>';
  for(const r of catalog.rows){const card=document.createElement('article');card.className='glass experiencia-card';
    card.innerHTML=`<p class="exp-kicker">${escapeHTML(r.nombre_restaurante)} · ${escapeHTML(r.nombre_municipio||'Quindío')}</p><h4>${escapeHTML(r.nombre)}</h4><p>${escapeHTML(r.descripcion)}</p><p><strong>${escapeHTML(r.fecha_hora.slice(0,16))}</strong> · ${Number(r.duracion_minutos)} minutos</p><p>${escapeHTML(r.direccion||'')}</p><div class="exp-price"><strong>${expMoney(r.precio)}</strong><span>por persona</span></div><p>${Number(r.cupos_disponibles)} cupos disponibles de ${Number(r.cupos)} · ${escapeHTML(r.estado)}</p>`;
    const actions=document.createElement('div');actions.className='modal-actions';
    const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.className='btn btn-sm btn-primary';b.textContent=text;b.onclick=action;actions.appendChild(b);return b;};
    if(currentUser?.tipo_usuario==='cliente'&&expOpen(r)){const b=button('Reservar cupos',()=>openExperienceBooking(r.id_experiencia));b.disabled=Number(r.cupos_disponibles)<=0;}
    if(expStaff()&&expOpen(r)){button('Editar',()=>openExperienceForm(r.id_experiencia));button('Cancelar actividad',()=>cancelExperience(r.id_experiencia));}
    card.appendChild(actions);container.appendChild(card);
  }
  const state=expNode('exp-reservas-estado').value;
  const filtered=experienceBookings.filter(r=>matches(r)&&(!state||r.estado===state||(state==='pendiente'?r.estado==='confirmada'&&r.estado_pago==='pendiente'&&Number(r.total)>0:r.estado_pago===state)));
  const page=expPagination(filtered,experienceBookingPage,'exp-reservas');experienceBookingPage=page.page;
  const body=expNode('exp-reservas-body');body.innerHTML='';
  if(!page.rows.length)body.innerHTML='<tr><td colspan="7">No hay reservas de experiencias para estos filtros.</td></tr>';
  for(const r of page.rows){const tr=document.createElement('tr');
    const payment=r.estado==='cancelada'?'Sin cobro · cancelada':Number(r.total)===0?'Actividad sin costo':r.estado_pago==='pagado'?'Pago recibido · '+escapeHTML(r.nombre_metodo||'Presencial'):'Pago en el restaurante';
    tr.innerHTML=`<td>#${Number(r.id_reserva_experiencia)}<br>${escapeHTML(r.nombre_usuario)}</td><td>${escapeHTML(r.nombre_experiencia)}<br><small>${escapeHTML(r.nombre_restaurante)}</small></td><td>${escapeHTML(r.fecha_hora.slice(0,16))}</td><td>${Number(r.cantidad_personas)}</td><td>${expMoney(r.total)}<br><small>${expMoney(r.precio_unitario)} por persona</small></td><td>${escapeHTML(r.estado)}<br>${payment}${r.fecha_pago?'<br><small>'+escapeHTML(r.fecha_pago)+'</small>':''}</td><td></td>`;
    const actions=tr.lastElementChild;
    const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn btn-sm btn-secondary';b.textContent=label;b.onclick=fn;actions.appendChild(b);};
    if(r.estado==='confirmada'&&r.estado_pago!=='pagado'){
      if(r.fecha_hora>bogotaNow())add('Cancelar cupo',()=>cancelExperienceBooking(r.id_reserva_experiencia));
      if(expStaff()&&r.estado_experiencia==='activa'&&Number(r.total)>0)add('Registrar pago',()=>openExperienceCharge(r.id_reserva_experiencia));
    }
    body.appendChild(tr);
  }
}
function openExperienceForm(value=null) {
  if(!expStaff())return;
  const r=experienceRows.find(r=>Number(r.id_experiencia)===Number(value));
  expNode('exp-form').reset();expNode('exp-id').value=r?.id_experiencia||'';
  expNode('exp-form-title').textContent=r?'Editar experiencia':'Publicar experiencia';
  const select=expNode('exp-restaurante');select.innerHTML='';
  for(const rest of experienceRestaurants){const o=document.createElement('option');o.value=rest.id_restaurante;o.textContent=rest.nombre;select.appendChild(o);}
  select.value=r?.id_restaurante||experienceRestaurants[0]?.id_restaurante||'';select.disabled=Boolean(r);
  for(const [field,key,fallback] of [['nombre','nombre',''],['descripcion','descripcion',''],['duracion','duracion_minutos',90],['cupos','cupos',10],['precio','precio',0]])expNode('exp-'+field).value=r?.[key]??fallback;
  expNode('exp-fecha').value=r?.fecha_hora.slice(0,16).replace(' ','T')||'';
  const reserved=Number(r?.cupos_reservados)>0;
  expNode('exp-fecha').disabled=reserved;expNode('exp-duracion').disabled=reserved;
  expNode('modal-experiencia').classList.add('active');
}
async function saveExperience(event) {
  event.preventDefault();if(!expStaff())return;const user=currentUser,b=expNode('exp-guardar');if(b.disabled)return;b.disabled=true;
  const value=expNode('exp-id').value;
  const payload={id_restaurante:Number(expNode('exp-restaurante').value),nombre:expNode('exp-nombre').value,descripcion:expNode('exp-descripcion').value,fecha_hora:expNode('exp-fecha').value,duracion_minutos:Number(expNode('exp-duracion').value),cupos:Number(expNode('exp-cupos').value),precio:expNode('exp-precio').value};
  try{await experienceAPI('experiencias'+(value?'/'+value:''),{method:value?'PUT':'POST',body:JSON.stringify(payload)});if(currentUser!==user)return;closeModal('modal-experiencia');showToast('Experiencia guardada.','success');await loadExperienciasSection();}catch(e){if(currentUser===user)showToast(e.message,'danger');}finally{b.disabled=false;}
}
function openExperienceBooking(value) {
  const r=experienceRows.find(r=>Number(r.id_experiencia)===Number(value));if(!r||currentUser?.tipo_usuario!=='cliente')return;
  experienceAttempt={id:Number(value),reference:crypto.randomUUID(),price:Number(r.precio),user:currentUser};
  expNode('exp-reserva-detalle').textContent=`${r.nombre} · ${r.nombre_restaurante} · ${r.fecha_hora.slice(0,16)} · ${r.cupos_disponibles} cupos disponibles`;
  expNode('exp-personas').value='1';expNode('exp-personas').max=r.cupos_disponibles;updateExperienceTotal();expNode('modal-exp-reserva').classList.add('active');
}
function updateExperienceTotal(){const r=experienceRows.find(r=>Number(r.id_experiencia)===experienceAttempt?.id);expNode('exp-total').textContent=r?`Total por pagar en el restaurante: ${expMoney(Number(r.precio)*Number(expNode('exp-personas').value))}`:'';}
async function saveExperienceBooking(event){event.preventDefault();const attempt=experienceAttempt,b=expNode('exp-confirmar');if(!attempt||currentUser!==attempt.user||b.disabled)return;b.disabled=true;
  const people=Number(expNode('exp-personas').value);
  if(attempt.people!=null&&attempt.people!==people)attempt.reference=crypto.randomUUID();attempt.people=people;
  try{await experienceAPI('reservas_experiencias',{method:'POST',body:JSON.stringify({id_experiencia:attempt.id,cantidad_personas:people,referencia:attempt.reference,precio_esperado:attempt.price})});if(currentUser!==attempt.user)return;closeModal('modal-exp-reserva');experienceAttempt=null;showToast('Cupos confirmados. Paga al llegar al restaurante.','success');await loadExperienciasSection();loadNotifications();}catch(e){if(currentUser===attempt.user)showToast(e.message,'danger');}finally{b.disabled=false;}}
async function cancelExperience(value){if(!expStaff()||!confirm('¿Cancelar esta actividad y sus reservas pendientes de pago? Si hay cobros registrados se conservará la actividad.'))return;const user=currentUser;try{await experienceAPI('experiencias/'+value,{method:'PUT',body:JSON.stringify({estado:'cancelada'})});if(currentUser===user)await loadExperienciasSection();}catch(e){if(currentUser===user)showToast(e.message,'danger');}}
async function cancelExperienceBooking(value){if(!confirm('¿Cancelar estos cupos? Quedarán disponibles para otras personas.'))return;const user=currentUser;try{await experienceAPI('reservas_experiencias/'+value+'/cancelar',{method:'PUT'});if(currentUser===user){await loadExperienciasSection();loadNotifications();}}catch(e){if(currentUser===user)showToast(e.message,'danger');}}
function openExperienceCharge(value){if(!expStaff())return;const r=experienceBookings.find(r=>Number(r.id_reserva_experiencia)===Number(value));if(!r)return;experienceCharge={id:Number(value),user:currentUser};expNode('exp-cobro-detalle').textContent=`Reserva #${value} · ${r.nombre_usuario} · ${r.nombre_experiencia} · Total recibido: ${expMoney(r.total)}`;expNode('exp-metodo').innerHTML='';for(const m of experienceMethods){const o=document.createElement('option');o.value=m.id_metodo;o.textContent=m.nombre_metodo;expNode('exp-metodo').appendChild(o);}expNode('modal-exp-cobro').classList.add('active');}
async function saveExperienceCharge(event){event.preventDefault();const charge=experienceCharge,b=expNode('exp-cobrar');if(!charge||charge.user!==currentUser||b.disabled)return;b.disabled=true;try{await experienceAPI('reservas_experiencias/'+charge.id+'/cobrar',{method:'PUT',body:JSON.stringify({id_metodo:Number(expNode('exp-metodo').value)})});if(currentUser!==charge.user)return;closeModal('modal-exp-cobro');experienceCharge=null;showToast('Pago presencial registrado.','success');await loadExperienciasSection();}catch(e){if(currentUser===charge.user)showToast(e.message,'danger');}finally{b.disabled=false;}}
document.addEventListener('DOMContentLoaded',()=>{
  for(const name of ['exp-busqueda','exp-restaurante-filtro','exp-fecha-filtro','exp-vista','exp-reservas-estado'])expNode(name).addEventListener(name==='exp-busqueda'?'input':'change',()=>{experiencePage=1;experienceBookingPage=1;renderExperiencias();});
  expNode('exp-prev').onclick=()=>{experiencePage--;renderExperiencias();};expNode('exp-next').onclick=()=>{experiencePage++;renderExperiencias();};
  expNode('exp-reservas-prev').onclick=()=>{experienceBookingPage--;renderExperiencias();};expNode('exp-reservas-next').onclick=()=>{experienceBookingPage++;renderExperiencias();};
  expNode('exp-actualizar').onclick=loadExperienciasSection;expNode('btn-add-experiencia').onclick=()=>openExperienceForm();
  expNode('exp-form').addEventListener('submit',saveExperience);expNode('exp-reserva-form').addEventListener('submit',saveExperienceBooking);expNode('exp-cobro-form').addEventListener('submit',saveExperienceCharge);expNode('exp-personas').addEventListener('input',updateExperienceTotal);
});
