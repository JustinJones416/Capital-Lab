/* Proyecto CapitalLab — desarrollo original: Justin Jones, Universidad de Panamá, Facultad de Economía. Registro interno de autoría, no eliminar. */
function computePrices(months){
  const seed=months*1000;
  function rnd(i){let x=Math.sin(seed+i)*10000;return x-(x|0);}
  STOCKS=ALL_STOCKS.map((s,i)=>{
    const mr=(s.ret/100)/12,noise=(rnd(i)-.5)*s.sigma/100*Math.sqrt(months/12);
    const cp=s.price*Math.pow(1+mr,months)*(1+noise);
    return{...s,currentPrice:+cp.toFixed(2),change:+((cp-s.price)/s.price*100).toFixed(2)};
  });
  BONDS=ALL_BONDS.map((b,i)=>{
    const mr=(b.ret/100)/12,noise=(rnd(i+100)-.5)*b.sigma/100*Math.sqrt(months/12)*.5;
    const cp=b.price*Math.pow(1+mr,months)*(1+noise);
    return{...b,currentPrice:+cp.toFixed(2),change:+((cp-b.price)/b.price*100).toFixed(2)};
  });
  FOREX=ALL_FOREX.map((f,i)=>{
    const mr=(f.ret/100)/12,noise=(rnd(i+200)-.5)*f.sigma/100*Math.sqrt(months/12);
    const cp=f.price*Math.pow(1+mr,months)*(1+noise);
    const dec=f.price>100?0:4;
    return{...f,currentPrice:+cp.toFixed(dec),change:+((cp-f.price)/f.price*100).toFixed(2)};
  });
  FUTURES=ALL_FUTURES.map((f,i)=>{
    const mr=(f.ret/100)/12,noise=(rnd(i+300)-.5)*f.sigma/100*Math.sqrt(months/12);
    const cp=f.price*Math.pow(1+mr,months)*(1+noise);
    const dec=f.price>100?0:2;
    return{...f,currentPrice:+cp.toFixed(dec),change:+((cp-f.price)/f.price*100).toFixed(2)};
  });
  DERIVATIVES=ALL_DERIVATIVES.map((d,i)=>{
    const mr=(d.ret/100)/12,noise=(rnd(i+400)-.5)*d.sigma/100*Math.sqrt(months/12);
    const cp=d.price*Math.pow(1+mr,months)*(1+noise);
    return{...d,currentPrice:+cp.toFixed(2),change:+((cp-d.price)/d.price*100).toFixed(2)};
  });
  // sync portfolio prices
  portfolio.forEach(pos=>{
    const live=allAssets().find(a=>a.id===pos.id&&a.type===pos.type);
    if(live)pos.currentPrice=live.currentPrice;
  });
}

// ═══════════════════ CAPITAL EDITOR ═══════════════════
function openCapModal(){
  // Un estudiante con cuenta real no puede editarse el capital a mano: eso
  // invalidaría el retorno del que dependen sus calificaciones, la tabla
  // de posiciones y los logros. Antes, tocar el capital solo le mostraba
  // un error y no pasaba nada más — ahora, en vez de dejarlo en un
  // callejón sin salida, le muestra una vista rápida de su cartera, que
  // es justo lo que probablemente quería ver al tocar ahí.
  if(currentUser && currentUser.rol==='estudiante' && !guestMode){
    abrirVistaRapidaCartera();
    return;
  }
  document.getElementById('cap-modal-current').textContent=fmt(capital);
  document.getElementById('cap-modal-input').value=Math.round(capital);
  document.getElementById('cap-modal').classList.add('open');
  setTimeout(()=>document.getElementById('cap-modal-input').select(),80);
}

// Popover ligero con el resumen de la cartera, accesible desde cualquier
// pantalla tocando el capital en la topbar — sin tener que navegar hasta
// Cartera solo para ver cómo va.
function abrirVistaRapidaCartera(){
  document.querySelectorAll('.vista-rapida-cartera').forEach(el=>el.remove());
  const valorTotal = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  const retornoPct = ((valorTotal - 50000) / 50000) * 100;
  const topPosiciones = [...portfolio].sort((a,b)=>(b.qty*(b.currentPrice||b.buyPrice))-(a.qty*(a.currentPrice||a.buyPrice))).slice(0,3);

  const el = document.createElement('div');
  el.className = 'vista-rapida-cartera';
  el.style.cssText = 'position:fixed;z-index:2500;background:var(--c1);border:1px solid var(--c4);border-radius:var(--r2);padding:16px;width:280px;max-width:90vw;box-shadow:0 12px 32px rgba(0,0,0,.45);';
  el.innerHTML = `
    <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">Valor de mi cartera</div>
    <div style="font-size:24px;font-weight:700;">$${valorTotal.toLocaleString('es-PA',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
    <div style="font-size:14px;font-weight:600;color:${retornoPct>=0?'var(--green)':'var(--red)'};margin-bottom:12px;">${retornoPct>=0?'+':''}${retornoPct.toFixed(2)}%</div>
    ${topPosiciones.length ? `<div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;margin-bottom:6px;">Principales posiciones</div>` + topPosiciones.map(p=>{
      const gan = p.currentPrice >= p.buyPrice;
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-top:1px solid var(--c3);">
        <span>${(p.name||'').substring(0,20)}</span>
        <span class="mono" style="color:${gan?'var(--green)':'var(--red)'};">$${(p.qty*(p.currentPrice||p.buyPrice)).toLocaleString('es-PA',{maximumFractionDigits:0})}</span>
      </div>`;
    }).join('') : '<div class="auth-hint">Todavía no tienes posiciones abiertas.</div>'}
    <button class="btn btn-sm" style="width:100%;margin-top:12px;" onclick="document.querySelectorAll('.vista-rapida-cartera').forEach(el=>el.remove());goPage('cartera');"><i class="ti ti-briefcase"></i> Ver cartera completa</button>
  `;
  document.body.appendChild(el);

  // Posicionarlo justo debajo de la píldora de capital, ajustando si se
  // sale de la pantalla en el celular.
  const pill = document.querySelector('.cap-pill');
  const rect = pill.getBoundingClientRect();
  let left = rect.left;
  if(left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;
  el.style.top = (rect.bottom + 8) + 'px';
  el.style.left = Math.max(10, left) + 'px';

  const cerrarAlTocarFuera = (e) => {
    if(!el.contains(e.target) && e.target !== pill){
      el.remove();
      document.removeEventListener('click', cerrarAlTocarFuera);
    }
  };
  setTimeout(()=>document.addEventListener('click', cerrarAlTocarFuera), 50);
}
function closeCapModal(){
  document.getElementById('cap-modal').classList.remove('open');
}
function applyCapital(){
  const raw=+document.getElementById('cap-modal-input').value;
  if(!raw||raw<1000){notify('El capital mínimo es $1,000','error');return;}
  if(raw>10000000){notify('El capital máximo es $10,000,000','error');return;}
  capital=raw;
  updateNavCapital();
  autosave();
  closeCapModal();
  notify('Capital actualizado a $'+fmt(capital)+' ✓');
}
// Close on backdrop click
document.addEventListener('click',e=>{
  const m=document.getElementById('cap-modal');
  if(m&&m.classList.contains('open')&&e.target===m)closeCapModal();
});

// ═══════════════════ VIEWPORT HEIGHT FIX (iOS Safari) ═══════════════════
// iOS Safari 100vh includes address bar. We compute the real visible height
// and expose it as --vh so the shell always fills exactly the visible screen.
(function fixViewportHeight(){
  function setVH(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  setVH();
  window.addEventListener('resize',  setVH, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(setVH, 120); }, {passive:true});
})();

// ═══════════════════ MOBILE SIDEBAR ═══════════════════
// Menú unificado de exportar/importar: junta lo que antes eran cuatro
// botones sueltos en la topbar (Exportar, Para profesor, PDF, Importar)
// en uno solo, para liberar espacio, sobre todo en el celular.
// ══════════════════════════════════════════════════
// BUSCADOR UNIVERSAL (Ctrl+K) — saltar a cualquier página, activo o
// estudiante sin tener que navegar el menú entero.
// ══════════════════════════════════════════════════
const CMDK_PAGINAS = [
  { pagina:'inicio', texto:'Inicio', icono:'ti-home' },
  { pagina:'mercado', texto:'Mercado', icono:'ti-chart-candle' },
  { pagina:'analisis', texto:'Análisis', icono:'ti-chart-bar' },
  { pagina:'personalizado', texto:'Personalizado', icono:'ti-adjustments-horizontal' },
  { pagina:'cartera', texto:'Mi Cartera', icono:'ti-briefcase' },
  { pagina:'laboratorio', texto:'Laboratorio', icono:'ti-flask' },
  { pagina:'resultados', texto:'Resultados', icono:'ti-award' },
  { pagina:'resultados-lab', texto:'Resultados Lab', icono:'ti-report-analytics' },
  { pagina:'noticias', texto:'Noticias', icono:'ti-news' },
  { pagina:'calificaciones', texto:'Calificaciones', icono:'ti-certificate' },
  { pagina:'cuestionarios', texto:'Cuestionarios', icono:'ti-list-check' },
  { pagina:'posiciones', texto:'Posiciones', icono:'ti-trophy' },
  { pagina:'logros', texto:'Logros', icono:'ti-award' },
  { pagina:'profesor', texto:'Modo Profesor', icono:'ti-school', soloDocente:true },
  { pagina:'admin', texto:'Administración', icono:'ti-shield-cog', soloSuperadmin:true },
];
let cmdkEstudiantesCache = null;
let cmdkIndiceActivo = 0;

// ══════════════════════════════════════════════════
// SELECTOR DE ACTIVOS — acceso directo desde la propia pantalla de
// Mercado, sin depender de encontrar el Watchlist dentro del menú lateral
// (que en el celular queda escondido detrás del botón de hamburguesa,
// debajo de más de una decena de botones de navegación).
// ══════════════════════════════════════════════════
let selectorActivosFiltro = 'all';

function abrirSelectorActivos(){
  if(document.getElementById('selector-activos-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'selector-activos-overlay';
  overlay.className = 'cmdk-overlay';
  overlay.innerHTML = `
    <div class="cmdk-box" style="max-height:75vh;">
      <div class="cmdk-input-row">
        <i class="ti ti-search"></i>
        <input type="text" id="sa-input" placeholder="Busca por nombre o símbolo…" autocomplete="off">
      </div>
      <div style="display:flex;gap:6px;padding:10px 12px 0;flex-wrap:wrap;">
        ${[['all','Todos'],['accion','Acciones'],['bono','Bonos'],['divisa','Divisas'],['futuro','Futuros'],['derivado','Derivados']].map(([v,l]) =>
          `<button class="wf-btn ${v==='all'?'active':''}" data-sa-filtro="${v}" style="font-size:11px;">${l}</button>`).join('')}
      </div>
      <div class="cmdk-results" id="sa-results" style="padding-top:10px;"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) cerrarSelectorActivos(); };

  overlay.querySelectorAll('[data-sa-filtro]').forEach(btn => btn.onclick = () => {
    selectorActivosFiltro = btn.dataset.saFiltro;
    overlay.querySelectorAll('[data-sa-filtro]').forEach(b=>b.classList.toggle('active', b===btn));
    renderResultadosSelectorActivos(overlay.querySelector('#sa-input').value.trim());
  });

  const input = overlay.querySelector('#sa-input');
  input.focus();
  input.oninput = () => renderResultadosSelectorActivos(input.value.trim());
  input.onkeydown = (e) => { if(e.key==='Escape') cerrarSelectorActivos(); };

  selectorActivosFiltro = 'all';
  renderResultadosSelectorActivos('');
}

function cerrarSelectorActivos(){
  const overlay = document.getElementById('selector-activos-overlay');
  if(overlay) overlay.remove();
}

function renderResultadosSelectorActivos(query){
  const cont = document.getElementById('sa-results');
  if(!cont || typeof allAssets!=='function') return;
  const q = query.toLowerCase();
  const resultados = allAssets().filter(a => {
    if(selectorActivosFiltro!=='all' && a.type!==selectorActivosFiltro) return false;
    return !q || a.name.toLowerCase().includes(q) || (a.ticker&&a.ticker.toLowerCase().includes(q));
  }).slice(0, 60);

  if(!resultados.length){
    cont.innerHTML = '<div class="auth-hint" style="padding:20px;text-align:center;">Sin resultados.</div>';
    return;
  }
  cont.innerHTML = resultados.map(a => {
    const chg = a.change||0;
    const p = a.currentPrice||a.price;
    return `<div class="cmdk-item" onclick="cerrarSelectorActivos();goPage('mercado');showAssetDetail('${a.id}','${a.type}');">
      <i class="ti ti-chart-line"></i>
      <div style="flex:1;min-width:0;">
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.name} <span class="badge ${typeBadgeCls(a.type)}" style="font-size:8px;">${a.type}</span></div>
        <div style="font-size:10.5px;color:var(--t3);">${a.ticker||''}</div>
      </div>
      <div style="text-align:right;">
        <div class="mono" style="font-size:12px;">$${p.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:10.5px;color:${chg>=0?'var(--green)':'var(--red)'};">${chg>=0?'+':''}${chg.toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('');
}

function abrirBuscadorUniversal(){
  if(document.getElementById('cmdk-overlay')) return; // ya está abierto
  const overlay = document.createElement('div');
  overlay.id = 'cmdk-overlay';
  overlay.className = 'cmdk-overlay';
  overlay.innerHTML = `
    <div class="cmdk-box">
      <div class="cmdk-input-row">
        <i class="ti ti-search"></i>
        <input type="text" id="cmdk-input" placeholder="Busca una página, un activo del mercado${(currentUser&&(currentUser.rol==='docente'||currentUser.rol==='superadmin'))?', o un estudiante':''}…" autocomplete="off">
      </div>
      <div class="cmdk-results" id="cmdk-results"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) cerrarBuscadorUniversal(); };

  const input = overlay.querySelector('#cmdk-input');
  input.focus();
  input.oninput = () => renderResultadosCmdk(input.value.trim());
  input.onkeydown = (e) => {
    const items = () => Array.from(document.querySelectorAll('.cmdk-item'));
    if(e.key==='ArrowDown'){ e.preventDefault(); cmdkIndiceActivo = Math.min(cmdkIndiceActivo+1, items().length-1); marcarActivoCmdk(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); cmdkIndiceActivo = Math.max(cmdkIndiceActivo-1, 0); marcarActivoCmdk(); }
    else if(e.key==='Enter'){ e.preventDefault(); const el = items()[cmdkIndiceActivo]; if(el) el.click(); }
    else if(e.key==='Escape'){ cerrarBuscadorUniversal(); }
  };

  renderResultadosCmdk('');

  // Si es docente, precarga la lista de estudiantes de su sesión activa en
  // segundo plano, para que buscar por nombre responda al instante.
  if(currentUser && (currentUser.rol==='docente'||currentUser.rol==='superadmin') && currentUser.sesion_id && sb && !cmdkEstudiantesCache){
    sb.from('usuarios').select('id,nombre').eq('sesion_id', currentUser.sesion_id).eq('rol','estudiante').then(({data})=>{
      cmdkEstudiantesCache = data || [];
      renderResultadosCmdk(input.value.trim());
    });
  }
}

function cerrarBuscadorUniversal(){
  const overlay = document.getElementById('cmdk-overlay');
  if(overlay) overlay.remove();
}

function marcarActivoCmdk(){
  document.querySelectorAll('.cmdk-item').forEach((el,i)=>el.classList.toggle('active', i===cmdkIndiceActivo));
  const activo = document.querySelector('.cmdk-item.active');
  if(activo) activo.scrollIntoView({block:'nearest'});
}

function renderResultadosCmdk(query){
  cmdkIndiceActivo = 0;
  const cont = document.getElementById('cmdk-results');
  if(!cont) return;
  const q = query.toLowerCase();
  const esDocente = currentUser && (currentUser.rol==='docente'||currentUser.rol==='superadmin');

  const paginas = CMDK_PAGINAS.filter(p => {
    if(p.soloDocente && !esDocente) return false;
    if(p.soloSuperadmin && (!currentUser||currentUser.rol!=='superadmin')) return false;
    return !q || p.texto.toLowerCase().includes(q);
  }).slice(0, 8);

  let activos = [];
  if(q.length>=2 && typeof allAssets==='function'){
    activos = allAssets().filter(a => a.name.toLowerCase().includes(q) || (a.ticker&&a.ticker.toLowerCase().includes(q))).slice(0, 6);
  }

  let estudiantes = [];
  if(q.length>=2 && esDocente && cmdkEstudiantesCache){
    estudiantes = cmdkEstudiantesCache.filter(e => e.nombre.toLowerCase().includes(q)).slice(0, 6);
  }

  if(!paginas.length && !activos.length && !estudiantes.length){
    cont.innerHTML = '<div class="auth-hint" style="padding:20px;text-align:center;">Sin resultados.</div>';
    return;
  }

  let html = '';
  if(paginas.length){
    html += '<div class="cmdk-group-label">Páginas</div>';
    html += paginas.map(p => `<div class="cmdk-item" onclick="cerrarBuscadorUniversal();goPage('${p.pagina}');"><i class="ti ${p.icono}"></i>${p.texto}</div>`).join('');
  }
  if(activos.length){
    html += '<div class="cmdk-group-label">Activos del mercado</div>';
    html += activos.map(a => `<div class="cmdk-item" onclick="cerrarBuscadorUniversal();goPage('mercado');showAssetDetail('${a.id}','${a.type}');"><i class="ti ti-chart-line"></i>${a.name}<span class="cmdk-item-sub">${a.ticker||''}</span></div>`).join('');
  }
  if(estudiantes.length){
    html += '<div class="cmdk-group-label">Estudiantes</div>';
    html += estudiantes.map(e => `<div class="cmdk-item" onclick="cerrarBuscadorUniversal();goPage('profesor');setTimeout(()=>abrirDetalleEstudiante('${e.id}','${e.nombre.replace(/'/g,"\\'")}','${currentUser.sesion_id}'),300);"><i class="ti ti-user"></i>${e.nombre}</div>`).join('');
  }
  cont.innerHTML = html;
  marcarActivoCmdk();
}

// Atajo global: Ctrl+K o Cmd+K abre el buscador desde cualquier parte de la app.
function cmdkAtajoGlobal(e){
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    abrirBuscadorUniversal();
  }
}
document.addEventListener('keydown', cmdkAtajoGlobal);

function toggleExportMenu(forzar){
  const menu = document.getElementById('export-menu');
  if(!menu) return;
  const abrir = forzar!==undefined ? forzar : !menu.classList.contains('open');
  menu.classList.toggle('open', abrir);
  if(abrir){
    setTimeout(()=>document.addEventListener('click', cerrarExportMenuFuera), 0);
  } else {
    document.removeEventListener('click', cerrarExportMenuFuera);
  }
}
function cerrarExportMenuFuera(e){
  const menu = document.getElementById('export-menu');
  if(menu && !menu.contains(e.target) && !e.target.closest('.pbtn-export')){
    toggleExportMenu(false);
  }
}

document.addEventListener('click', ()=>{ document.querySelectorAll('.cl-tools-dropdown.open').forEach(d=>d.classList.remove('open')); });
function toggleMobileSidebar(){
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const btn      = document.getElementById('hamburger-btn');
  const isOpen   = sidebar.classList.contains('mobile-open');
  if(isOpen){ closeMobileSidebar(); }
  else {
    sidebar.classList.add('mobile-open');
    overlay.style.display='block';
    btn.classList.add('open');
    document.body.style.overflow='hidden';
  }
}
// Colapsar/expandir una sección del menú lateral — para clases con
// muchos botones (Simulador tiene once), poder ocultar lo que no se usa
// por ahora ahorra bastante espacio en pantalla, sobre todo en el
// celular. Se recuerda la preferencia entre sesiones de uso.
function alternarSeccionNav(header, forzarEstado){
  const colapsar = forzarEstado !== undefined ? forzarEstado : !header.classList.contains('colapsada');
  header.classList.toggle('colapsada', colapsar);
  let el = header.nextElementSibling;
  while(el && !el.classList.contains('wl-nav-section')){
    el.style.display = colapsar ? 'none' : '';
    el = el.nextElementSibling;
  }
  const nombreSeccion = header.textContent.trim();
  const clave = 'capitallab_nav_colapsada_'+nombreSeccion;
  if(colapsar) localStorage.setItem(clave, '1'); else localStorage.removeItem(clave);
}

// Aplica las secciones que ya estaban colapsadas de una visita anterior,
// apenas se pinta el menú — así no hay que volver a cerrarlas cada vez.
function restaurarSeccionesNavColapsadas(){
  document.querySelectorAll('.wl-nav-section').forEach(header => {
    const nombreSeccion = header.textContent.trim();
    if(localStorage.getItem('capitallab_nav_colapsada_'+nombreSeccion) === '1'){
      alternarSeccionNav(header, true);
    }
  });
}

// Lo mismo que las secciones del menú, pero para cualquier tarjeta de
// contenido dentro de una página — para páginas con varias tarjetas
// apiladas (como Cartera), poder cerrar la que no se está usando ahora
// mismo ahorra bastante desplazamiento, sobre todo en el celular.
function alternarTarjeta(icono){
  const tarjeta = icono.closest('.card');
  if(!tarjeta) return;
  tarjeta.dataset.tocada = '1';
  const colapsada = tarjeta.classList.toggle('tarjeta-colapsada');
  icono.style.transform = colapsada ? 'rotate(-90deg)' : '';
}

// En pantallas angostas, las tarjetas secundarias (gráficas de detalle,
// estados financieros) empiezan colapsadas la primera vez que aparecen,
// para que lo esencial quede a la vista sin desplazarse tanto — pero
// solo la primera vez: si la persona ya la abrió, se respeta su elección
// y no se le vuelve a cerrar sola.
// Complemento del colapso individual: expande o cierra de una vez todas
// las tarjetas colapsables dentro de una página, útil cuando ya hay
// varias — decide qué hacer mirando si la mayoría están cerradas.
function alternarTodasLasTarjetas(idContenedor){
  const cont = document.getElementById(idContenedor);
  if(!cont) return;
  const iconos = [...cont.querySelectorAll('.card-collapse-toggle')];
  if(!iconos.length) return;
  const cerradas = iconos.filter(i=>i.closest('.card').classList.contains('tarjeta-colapsada')).length;
  const abrirTodas = cerradas >= iconos.length/2;
  iconos.forEach(icono => {
    const tarjeta = icono.closest('.card');
    tarjeta.dataset.tocada = '1';
    tarjeta.classList.toggle('tarjeta-colapsada', !abrirTodas);
    icono.style.transform = abrirTodas ? '' : 'rotate(-90deg)';
  });
}

// Modo enfoque — oculta el menú lateral por completo para aprovechar
// toda la pantalla en tablet o laptop, útil sobre todo en Mercado o
// Análisis cuando se quiere ver el detalle de un activo sin distracción.
// En el celular no aplica: ahí el menú ya vive fuera del camino.
// Baja el historial de velas simulado del activo seleccionado en Análisis
// a un CSV — útil para llevarse los números a Excel o pegarlos en un
// informe, en vez de solo poder verlos en la gráfica.
function exportarHistorialPreciosCSV(){
  const asset = allAssets().find(a=>a.id===anSelectedId);
  if(!asset){ notify('Selecciona primero un activo en Análisis.', 'error'); return; }
  const velas = candleHistory[asset.id];
  if(!velas || !velas.length){ notify('Todavía no hay historial de precios para este activo.', 'error'); return; }
  const filas = velas.map((v,i) => [i+1, v.o, v.h, v.l, v.c].join(','));
  const csv = ['Periodo,Apertura,Máximo,Mínimo,Cierre', ...filas].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `precios_${asset.ticker||asset.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify('Historial de precios exportado.', 'success');
}

function alternarModoEnfoque(){
  const shellBody = document.querySelector('.shell-body');
  if(!shellBody) return;
  const activo = shellBody.classList.toggle('enfoque');
  localStorage.setItem('capitallab_modo_enfoque', activo ? '1' : '0');
  actualizarBotonModoEnfoque(activo);
}
function actualizarBotonModoEnfoque(activo){
  const btn = document.getElementById('btn-modo-enfoque');
  if(!btn) return;
  btn.innerHTML = activo
    ? '<i class="ti ti-layout-sidebar-left-expand" style="font-size:16px;color:var(--accent2);"></i>'
    : '<i class="ti ti-layout-sidebar-left-collapse" style="font-size:16px;"></i>';
  btn.title = activo ? 'Mostrar el menú lateral' : 'Modo enfoque — ocultar el menú lateral';
}
function restaurarModoEnfoque(){
  if(localStorage.getItem('capitallab_modo_enfoque') === '1'){
    document.querySelector('.shell-body')?.classList.add('enfoque');
    actualizarBotonModoEnfoque(true);
  }
}

function autoColapsarEnMovil(contenedor){
  if(window.innerWidth > 640 || !contenedor) return;
  contenedor.querySelectorAll('.card-collapse-toggle').forEach(icono => {
    const tarjeta = icono.closest('.card');
    if(tarjeta && !tarjeta.dataset.tocada){
      tarjeta.classList.add('tarjeta-colapsada');
      icono.style.transform = 'rotate(-90deg)';
    }
  });
}

function closeMobileSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  sidebar.classList.remove('mobile-open');
  overlay.style.display='none';
  btn.classList.remove('open');
  document.body.style.overflow='';
}
// Auto-close sidebar on page navigation (mobile only)
const _origGoPage = typeof goPage !== 'undefined' ? goPage : null;

// ═══════════════════ NAVIGATION ═══════════════════
function goPage(p){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.wl-nav-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const btn=document.getElementById('nav-'+p);
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.mbn-btn').forEach(el=>el.classList.toggle('active', el.dataset.pagina===p));
  if(p==='mercado'&&selectedAsset){
    // Canvas had zero size while hidden — redraw now that the page is visible
    requestAnimationFrame(()=>requestAnimationFrame(()=>drawCandlestickChart(selectedAsset)));
  }
  if(p==='cartera'){renderPortfolio();renderPortfolioTabs();}
  if(p==='resultados')renderResults();
  if(p==='analisis')populateAnalysisSelect();
  if(p==='laboratorio'){renderLabHistory();renderLabPicker();}
  if(p==='resultados-lab')renderResultsLab();
  if(p==='profesor'){ renderTeacher(); cargarRosterProfesor(); iniciarRealtimeProfesor(); }
  else { detenerRealtimeProfesor(); detenerSalaEnVivo(); }
  if(p==='inicio') renderInicioPage();
  if(p==='mercado' && currentUser && currentUser.sesion_id) localStorage.setItem('cl_visito_mercado_'+currentUser.sesion_id, '1');
  if(p==='calificaciones' && currentUser && currentUser.sesion_id) localStorage.setItem('cl_visito_calificaciones_'+currentUser.sesion_id, '1');
  if(p==='calificaciones') renderCalificacionesPage();
  if(p==='cuestionarios') renderCuestionariosPage();
  if(p==='p2p'){ renderMercadoP2P(); iniciarRealtimeP2P(); cargarChat('p2p'); iniciarRealtimeChat(); document.getElementById('dot-p2p').style.display='none'; }
  else { detenerRealtimeP2P(); }
  if(p==='chat'){ cargarChat('sesion'); iniciarRealtimeChat(); document.getElementById('dot-chat').style.display='none'; setTimeout(()=>document.getElementById('sesion-chat-input')?.focus(), 200); }
  else if(p!=='p2p'){ detenerRealtimeChat(); }
  if(p==='posiciones') renderPosicionesPage();
  if(p==='logros') renderLogrosPage();
  if(p==='admin') renderAdminPage();
  if(p==='noticias')renderNewsCenter();
  if(p==='tesis'){ renderFormularioTesis(); renderMiTesis(); }
  // Close mobile drawer on navigation
  if(window.innerWidth<=768)closeMobileSidebar();
}

// ═══════════════════ HORIZON (deprecated — real-time market) ═══════════════════
// The horizon selector was removed: the market now runs in real time via sessions.
// currentHorizonMonths is kept fixed at 12 only for annualized-return math.
function setHorizon(){ /* deprecated no-op */ }
function applyCustomHorizon(){ /* deprecated no-op */ }

// ═══════════════════ MARKET ═══════════════════
let wlFilter='all';
let wlSort='default';  // SERIE 3: 'default' | 'gainers' | 'losers' | 'name'
let wlPage=1;          // página actual del watchlist
const WL_PAGE_SIZE=25; // activos por página (paginación para 150 instrumentos)

function setWlFilter(type,btn){
  wlFilter=type;
  wlPage=1;            // resetea a la primera página al cambiar de filtro
  document.querySelectorAll('.wf-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderWatchlist();
}

function setWlSort(sort){
  wlSort=sort;
  wlPage=1;            // resetea a la primera página al cambiar de orden
  document.querySelectorAll('.wl-sort-btn').forEach(b=>b.classList.toggle('active', b.dataset.sort===sort));
  renderWatchlist();
}

// Cambio de página del watchlist (delta = -1 anterior, +1 siguiente)
function wlChangePage(delta){
  wlPage = Math.max(1, wlPage + delta);
  renderWatchlist();
  const body=document.getElementById('wl-body');
  if(body)body.scrollTop=0;
}

function renderWatchlist(){
  const q=(document.getElementById('wl-search')||{value:''}).value.toLowerCase();
  const sections=[
    {label:'Acciones',  type:'accion',   data:STOCKS},
    {label:'Bonos',     type:'bono',     data:BONDS},
    {label:'Divisas',   type:'divisa',   data:FOREX},
    {label:'Futuros',   type:'futuro',   data:FUTURES},
    {label:'Derivados', type:'derivado', data:DERIVATIVES},
  ];
  const typeColor={accion:'var(--accent)',bono:'var(--green)',divisa:'var(--amber)',futuro:'var(--red)',derivado:'var(--accent2)'};

  // SERIE 3: when sorting by performance/name, flatten all into one list
  const sortFn = {
    gainers: (a,b)=>(b.change||0)-(a.change||0),
    losers:  (a,b)=>(a.change||0)-(b.change||0),
    name:    (a,b)=>a.ticker.localeCompare(b.ticker),
  };

  let html='';
  const matches = a => !q || a.name.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q) || (a.country||'').toLowerCase().includes(q);
  const itemHtml = a => {
    const p=a.currentPrice||a.price;
    const chg=a.change||0;
    const sel=(selectedAsset&&selectedAsset.id===a.id)?'selected':'';
    const pStr=a.type==='divisa'&&p>100?p.toLocaleString('es-PA',{maximumFractionDigits:0}):p.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:4});
    return `<div class="wl-item ${sel}" onclick="wlSelect('${a.id}','${a.type}')">
      <div class="wl-left">
        <div class="wl-name">${a.ticker}</div>
        <div class="wl-sub">${a.name.substring(0,20)}</div>
      </div>
      <div class="wl-right">
        <div class="wl-price">$${pStr}</div>
        <div class="wl-chg ${chg>=0?'g':'r'}">${chg>=0?'+':''}${chg.toFixed(2)}%</div>
      </div>
    </div>`;
  };

  // ── Conteo total de coincidencias (para paginación) ──
  const totalMatches = sections
    .filter(s=>wlFilter==='all'||wlFilter===s.type)
    .flatMap(s=>(s.data||[]))
    .filter(matches).length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / WL_PAGE_SIZE));
  if (wlPage > totalPages) wlPage = totalPages;          // clamp si cambió el conjunto
  const startIdx = (wlPage - 1) * WL_PAGE_SIZE;
  const endIdx   = startIdx + WL_PAGE_SIZE;

  if (wlSort !== 'default') {
    // Lista plana ordenada (respeta filtro de tipo + búsqueda), paginada
    let all = sections.filter(s=>wlFilter==='all'||wlFilter===s.type)
                      .flatMap(s=>(s.data||[]))
                      .filter(matches)
                      .sort(sortFn[wlSort]);
    html = all.slice(startIdx, endIdx).map(itemHtml).join('');
  } else {
    // Agrupado por tipo (default), pero paginado sobre el índice global aplanado.
    // Se recorre en orden de sección y solo se renderizan los ítems dentro de [startIdx, endIdx).
    let globalIdx = 0;
    sections.forEach(sec=>{
      if(wlFilter!=='all'&&wlFilter!==sec.type)return;
      const items=(sec.data||[]).filter(matches);
      if(items.length===0)return;
      // ¿Algún ítem de esta sección cae en la ventana de la página?
      const pageItems = items.filter((_,i)=>{ const g=globalIdx+i; return g>=startIdx && g<endIdx; });
      globalIdx += items.length;
      if(pageItems.length===0)return;
      if(wlFilter==='all'){
        html+=`<div class="wl-section"><span class="wl-section-lbl" style="color:${typeColor[sec.type]};">${sec.label} (${items.length})</span></div>`;
      }
      pageItems.forEach(a=>{ html+=itemHtml(a); });
    });
  }
  if(!html)html='<div style="text-align:center;padding:20px;font-size:11px;color:var(--t3);">Sin resultados</div>';

  // ── Controles de paginación (solo si hay más de una página) ──
  let pager='';
  if(totalPages>1){
    const from=totalMatches===0?0:startIdx+1;
    const to=Math.min(endIdx,totalMatches);
    pager=`<div class="wl-pager">
      <button class="wl-pg-btn" onclick="wlChangePage(-1)" ${wlPage<=1?'disabled':''}>‹</button>
      <span class="wl-pg-info">${from}–${to} de ${totalMatches} · pág. ${wlPage}/${totalPages}</span>
      <button class="wl-pg-btn" onclick="wlChangePage(1)" ${wlPage>=totalPages?'disabled':''}>›</button>
    </div>`;
  }

  const body=document.getElementById('wl-body');
  if(body)body.innerHTML=html+pager;
}

function wlSelect(id,type){
  goPage('mercado');
  showAssetDetail(id,type);
  renderWatchlist();
  if(window.innerWidth<=768)closeMobileSidebar();
}

function setMktTab(type,btn){
  mktTypeFilter=type;
  document.querySelectorAll('.mtt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAssetList();
}
function filterAssets(){renderAssetList();renderWatchlist();}
function renderAssetList(){
  const el=document.getElementById('asset-list');
  const q=(document.getElementById('mkt-search')||{value:''}).value.toLowerCase();
  const list=allAssets().filter(a=>{
    if(mktTypeFilter!=='all'&&a.type!==mktTypeFilter)return false;
    return!q||a.name.toLowerCase().includes(q)||a.ticker.toLowerCase().includes(q)||(a.country||'').toLowerCase().includes(q);
  });
  if(!el)return; // market sidebar removed — skip DOM render
  document.getElementById('asset-list').innerHTML=list.map(a=>{
    const p=a.currentPrice||a.price;
    const chg=a.change||0;
    const sel=selectedAsset&&selectedAsset.id===a.id?'selected':'';
    return`<div class="asset-item ${sel}" onclick="showAssetDetail('${a.id}','${a.type}')">
      <div class="ai-left">
        <div class="ai-name">${a.ticker}</div>
        <div class="ai-sub">${a.name.substring(0,22)} · ${a.country}</div>
      </div>
      <div class="ai-right">
        <div class="ai-price">${a.type==='divisa'&&a.price>100?Math.round(p).toLocaleString('es-PA'):p.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:4})}</div>
        <div class="ai-chg ${chg>=0?'g':'r'}">${chg>=0?'+':''}${chg.toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════ STRUCTURED PROFILE BUILDER ═══════════════════
function buildProfile(asset){
  const row=(k,v,cls='')=>`<div class="profile-row"><span class="profile-key">${k}</span><span class="profile-val ${cls}">${v}</span></div>`;
  const badge=(txt,color)=>`<span class="badge" style="background:${color};font-size:9px;">${txt}</span>`;
  const ratingColor=r=>r.startsWith('AA')||r==='AAA'?'var(--green)':r.startsWith('A')?'var(--accent2)':r.startsWith('BB')?'var(--amber)':'var(--red)';

  // Descripción completa del emisor — antes se recortaba a 220 caracteres,
  // perdiendo información real que sí existía en los datos.
  let desc=asset.profile||'';

  let rows='';
  let extra='';

  if(asset.type==='accion'){
    rows=`
      ${row('Empresa', asset.name)}
      ${row('Sector',  asset.sector||'—')}
      ${row('País',    asset.country)}
      ${row('Calificación', badge(asset.rating||'—', ratingColor(asset.rating||'B')))}
      ${row('Beta (riesgo sistemático)', asset.beta?.toFixed(2)||'—')}
      ${row('Dividendo anual', asset.dividend>0?'$'+asset.dividend.toFixed(2):'Sin dividendo', asset.dividend>0?'g':'a')}
      ${row('Retorno esperado', asset.ret.toFixed(1)+'%','g')}
      ${row('Volatilidad σ', asset.sigma.toFixed(1)+'%','a')}`;

  }else if(asset.type==='bono'){
    const dur=(asset.maturity||0);
    rows=`
      ${row('Emisor soberano', asset.country)}
      ${row('Calificación crediticia', badge(asset.rating||'—', ratingColor(asset.rating||'B')))}
      ${row('Tasa cupón anual', (asset.coupon||0).toFixed(2)+'%','g')}
      ${row('Vencimiento', (asset.maturity||0)+' años')}
      ${row('Rendimiento (YTM)', asset.ret.toFixed(2)+'%','g')}
      ${row('Riesgo país (EMBI)', (asset.rp||0)+'% spread', asset.rp>5?'r':asset.rp>2?'a':'g')}
      ${row('Volatilidad σ', asset.sigma.toFixed(1)+'%','a')}`;
    if(asset.rp>2)extra=`<div class="info-box warn" style="margin-top:8px;font-size:11px;"><b>Riesgo soberano:</b> EMBI spread de ${asset.rp}% refleja riesgo de crédito elevado. Monitorear la evolución fiscal del emisor.</div>`;

  }else if(asset.type==='divisa'){
    const g=asset.gdp||{};
    rows=`
      ${row('Par cambiario', asset.ticker)}
      ${row('País / Región', asset.country)}
      ${row('Nivel de riesgo', badge(asset.riskCountry||'—', asset.rp>5?'#cc2200':asset.rp>2?'#b07000':'#00a070'))}
      ${row('PIB total', g.total?'$'+g.total+' B':'—')}
      ${row('Inflación anual', g.inflation?g.inflation+'%':'—', g.inflation>8?'r':g.inflation>4?'a':'g')}
      ${row('Calificación S&P', badge(g.rating||'—', ratingColor(g.rating||'B')))}
      ${row('Volatilidad σ', asset.sigma.toFixed(1)+'%','a')}
      ${row('Riesgo país', asset.rp+'% EMBI', asset.rp>5?'r':asset.rp>2?'a':'g')}`;

  }else if(asset.type==='futuro'){
    const sp=asset.specs||{};
    rows=`
      ${row('Subyacente', asset.name)}
      ${row('Sector', asset.sector||'—')}
      ${row('Bolsa', sp.exchange||'—')}
      ${row('Tamaño del contrato', sp.contractSize||'—')}
      ${row('Tick mínimo', sp.tickSize||'—')}
      ${row('Margen inicial', sp.margin||'—')}
      ${row('Liquidación', sp.settlement||'—')}
      ${row('Retorno esperado', asset.ret.toFixed(1)+'%','g')}
      ${row('Volatilidad σ', asset.sigma.toFixed(1)+'%','a')}`;

  }else if(asset.type==='derivado'){
    const sp=asset.specs||{};
    rows=`
      ${row('Instrumento', asset.name)}
      ${row('Tipo', sp.type||'—')}
      ${row('Subyacente / Referencia', sp.underlying||sp.reference||sp.currency||'—')}
      ${row('Nocional', sp.notional||sp.contractSize||'—')}
      ${row('Vencimiento / Plazo', sp.maturity||sp.expiry||'—')}
      ${row('Mercado', sp.market||sp.exchange||'OTC')}
      ${row('Retorno esperado', asset.ret.toFixed(1)+'%','g')}
      ${row('Volatilidad σ', asset.sigma.toFixed(1)+'%','a')}`;
  }

  return`
    <p style="font-size:11.5px;color:var(--t2);line-height:1.6;margin-bottom:10px;border-left:3px solid var(--c5);padding-left:8px;">${desc}</p>
    <div>${rows}</div>
    ${extra}`;
}

// ═══════════════════════════════════════════════════════════════════
// ANÁLISIS CON IA — tesis de un activo específico, y ranking de las
// mejores inversiones disponibles ahora mismo. La clave de Gemini
// nunca toca el navegador; todo pasa por la Edge Function protegida.
// ═══════════════════════════════════════════════════════════════════
const SIM_IA_URL = 'https://zppwrnznsnphxbcqsxsg.supabase.co';
const SIM_IA_ANON_KEY = 'sb_publishable_QDlqCn_sV9kDtrSs4cvQzQ_8ji-2CcO';
let tesisIASimuladorCache = {};

// El enlace a Yahoo Finance solo se muestra para los tipos de activo
// donde realmente existe una ficha real ahí — acciones, divisas, y
// los pocos futuros con correspondencia confirmada. Bonos y
// derivados no tienen equivalente real, así que no se les inventa uno.
function renderEnlaceYahooFinance(asset){
  const box = document.getElementById('mkt-yahoo-link');
  if(!box) return;
  let simboloYahoo = null;
  if(asset.type==='accion' && asset.ticker) simboloYahoo = asset.ticker.replace('.', '-');
  else if(asset.type==='divisa' && asset.ticker?.includes('/')) simboloYahoo = asset.ticker.replace('/','')+'=X';
  else if(asset.type==='futuro' && FUTUROS_YAHOO_MAP[asset.ticker]) simboloYahoo = FUTUROS_YAHOO_MAP[asset.ticker];
  const enlace = simboloYahoo
    ? `<a href="https://finance.yahoo.com/quote/${encodeURIComponent(simboloYahoo)}" target="_blank" rel="noopener" style="font-size:11.5px;color:var(--accent2, #4a9eff);"><i class="ti ti-external-link"></i> Ver ${asset.ticker} en Yahoo Finance ↗</a>`
    : '';
  // Marca de última actualización real, específica de este activo —
  // distinta del indicador general, porque cada activo se sincroniza
  // en el mismo momento, pero conviene que quede claro cuál precio
  // exacto es el que arrancó de un dato real de mercado. Los bonos
  // nunca reciben esta sincronización (no existe una fuente gratuita
  // confiable para ellos), así que se les avisa distinto, sin dar a
  // entender que podrían tener un dato real en algún momento.
  let marcaActualizacion;
  if(asset.type==='bono'){
    marcaActualizacion = `<div style="font-size:10.5px;color:var(--t3, #7a8ab0);margin-top:4px;">Precio calculado por el modelo del simulador — los bonos no tienen una fuente gratuita de precio real en tiempo real disponible</div>`;
  } else if(window.__ultimaSincronizacionReal){
    marcaActualizacion = `<div style="font-size:10.5px;color:var(--t3, #7a8ab0);margin-top:4px;">Precio real confirmado a las ${window.__ultimaSincronizacionReal.toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'})} · hasta 15 min de rezago frente a bolsa, desde ahí la simulación toma el control</div>`;
  } else {
    marcaActualizacion = `<div style="font-size:10.5px;color:var(--t3, #7a8ab0);margin-top:4px;">Precio base del simulador — la sincronización con el mercado real no estuvo disponible en esta sesión</div>`;
  }
  box.innerHTML = enlace + marcaActualizacion;
}
function renderTesisIASimulador(asset){
  const box = document.getElementById('mkt-tesis-ia');
  if(!box) return;
  const clave = asset.id+asset.type;
  if(tesisIASimuladorCache[clave]){
    box.innerHTML = tesisSimuladorHTML(tesisIASimuladorCache[clave]);
    return;
  }
  box.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="generarTesisIASimulador('${asset.id}','${asset.type}')"><i class="ti ti-sparkles"></i> Analizar con IA</button>
    <div id="tesis-ia-sim-msg" style="font-size:11.5px;margin-top:6px;"></div>
  `;
}
function tesisSimuladorHTML(texto){
  const parrafos = texto.split(/\n+/).filter(p=>p.trim());
  return `<div style="background:var(--bg2, #10141d);border:1px solid var(--c4, #242d42);border-radius:10px;padding:12px 14px;">
    <div style="font-size:11px;color:var(--t3, #7a8ab0);margin-bottom:8px;display:flex;align-items:center;gap:5px;"><i class="ti ti-sparkles" style="color:var(--gold, #e8b94a);"></i> Análisis generado con IA</div>
    ${parrafos.map(p=>`<p style="font-size:12.5px;color:var(--t2, #b8c4dc);line-height:1.6;margin-bottom:8px;">${p}</p>`).join('')}
  </div>`;
}
function generarTesisLocal(asset){
  // Umbrales simples y transparentes, sobre los datos reales del
  // activo — sin el matiz de un análisis de IA, pero siempre cierto.
  let calificacionRiesgo, explicacion;
  if(asset.type==='bono'){
    calificacionRiesgo = (asset.rating||'').startsWith('A') ? 'bajo' : 'moderado';
    explicacion = `Cupón de ${asset.coupon}%, TIR de ${asset.ytm}%, calificación ${asset.rating}, duración ${asset.duration}. Un riesgo ${calificacionRiesgo} típico de un instrumento de renta fija con esta calificación.`;
  } else if(asset.type==='divisa'){
    calificacionRiesgo = asset.sigma < 10 ? 'bajo' : (asset.sigma < 20 ? 'moderado' : 'alto');
    explicacion = `Volatilidad anualizada de ${asset.sigma}%, retorno esperado histórico de ${asset.ret}%. Riesgo ${calificacionRiesgo} para un par de divisas.`;
  } else {
    calificacionRiesgo = asset.beta < 0.9 ? 'bajo' : (asset.beta < 1.3 ? 'moderado' : 'alto');
    explicacion = `Beta de ${asset.beta}, volatilidad de ${asset.sigma}%, calificación ${asset.rating}. Riesgo ${calificacionRiesgo} frente al mercado general, con un retorno esperado histórico de ${asset.ret}%.`;
  }
  return `${asset.name} muestra un perfil de riesgo ${calificacionRiesgo} según sus datos actuales. ${explicacion} Recuerda que este es un análisis básico por reglas fijas, no generado por IA, considera siempre el contexto completo antes de decidir.`;
}

async function generarTesisIASimulador(id, type){
  const asset = allAssets().find(a=>a.id===id&&a.type===type);
  if(!asset) return;
  const boton = document.querySelector('#mkt-tesis-ia button.btn');
  const msg = document.getElementById('tesis-ia-sim-msg');
  boton.disabled = true; boton.style.opacity='.6';
  boton.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Analizando…';
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  try {
    // Cada tipo de activo manda sus propios campos reales — un bono
    // no tiene beta ni dividendo, tiene cupón, TIR y vencimiento; una
    // divisa no tiene ninguno de esos. Mandar el campo correcto según
    // el tipo evita que la IA reciba datos vacíos sin sentido.
    let datosActivo;
    if(asset.type==='bono'){
      datosActivo = { tipo:'bono', name:asset.name, ticker:asset.ticker, sector:asset.country, price:asset.currentPrice||asset.price, coupon:asset.coupon, maturity:asset.maturity, ytm:asset.ytm, duration:asset.duration, sigma:asset.sigma, ret:asset.ret, rating:asset.rating, profile:asset.profile };
    } else if(asset.type==='divisa'){
      datosActivo = { tipo:'divisa', name:asset.name, ticker:asset.ticker, price:asset.currentPrice||asset.price, sigma:asset.sigma, ret:asset.ret, profile:asset.profile };
    } else {
      datosActivo = { tipo:'accion', name:asset.name, ticker:asset.ticker, sector:asset.sector, country:asset.country, price:asset.currentPrice||asset.price, beta:asset.beta, sigma:asset.sigma, ret:asset.ret, rating:asset.rating, dividend:asset.dividend, profile:asset.profile };
    }
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'tesis', activo:datosActivo }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    tesisIASimuladorCache[asset.id+asset.type] = d.tesis;
    document.getElementById('mkt-tesis-ia').innerHTML = tesisSimuladorHTML(d.tesis);
  } catch(e){
    // La IA no respondió — se muestra un análisis básico por reglas,
    // calculado con los datos reales del activo, para que el
    // estudiante nunca se quede solo con un mensaje de error.
    const tesisLocal = generarTesisLocal(asset);
    document.getElementById('mkt-tesis-ia').innerHTML = `
      <div style="background:rgba(232,185,74,.1);border:1px solid var(--amber, #e8b94a);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11px;color:var(--amber, #e8b94a);"><i class="ti ti-plug-connected-x"></i> La IA no está disponible ahora mismo, este es un análisis básico por reglas.</div>
      <div style="background:var(--bg2, #10141d);border:1px solid var(--c4, #242d42);border-radius:10px;padding:12px 14px;">
        <p style="font-size:12.5px;color:var(--t2, #b8c4dc);line-height:1.6;margin:0;">${tesisLocal}</p>
      </div>
    `;
  }
}

// ───── Mejores inversiones (IA) — panel para Mercado y Laboratorio ─────
async function abrirMejoresInversionesIA(){
  // Si hay una sesión de Laboratorio activa, la recomendación debe
  // considerar su meta real (horizonte y rentabilidad objetivo que
  // asignó el profesor), no dar la misma sugerencia genérica que en
  // Mercado libre, donde no existe ninguna meta específica que cumplir.
  const enLaboratorio = labConfig.started === true;
  const contextoLab = enLaboratorio
    ? `<div style="background:var(--bg2, #10141d);border:1px solid var(--gold, #e8b94a);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--t2, #b8c4dc);"><i class="ti ti-target" style="color:var(--gold, #e8b94a);"></i> Considerando tu meta del Laboratorio: <b>${labConfig.target}%</b> de rentabilidad en <b>${labConfig.horizon} meses</b></div>`
    : '';
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'mejores-ia-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:560px;">
    <button class="modal-close" onclick="document.getElementById('mejores-ia-overlay').remove()"><i class="ti ti-x"></i></button>
    <h2><i class="ti ti-trophy" style="color:var(--gold, #e8b94a);"></i> Mejores inversiones ahora mismo</h2>
    <p style="font-size:12.5px;color:var(--t2, #b8c4dc);margin-bottom:14px;">La IA analiza los activos disponibles en el mercado actual y recomienda tres opciones, con su razonamiento.</p>
    ${contextoLab}
    <label style="font-size:12px;color:var(--t3, #7a8ab0);display:block;margin-bottom:5px;">Tu perfil de riesgo</label>
    <select id="mejores-ia-perfil" style="width:100%;padding:10px 12px;background:var(--bg2, #10141d);border:1px solid var(--c4, #242d42);border-radius:8px;color:var(--t1, #e8edf8);font-size:13px;margin-bottom:14px;">
      <option value="conservador">Conservador, prioriza estabilidad sobre retorno</option>
      <option value="moderado" selected>Moderado, equilibrio entre riesgo y retorno</option>
      <option value="agresivo">Agresivo, busca el mayor retorno posible</option>
    </select>
    <button class="btn" style="width:100%;justify-content:center;" onclick="generarMejoresInversionesIA()"><i class="ti ti-sparkles"></i> Generar recomendación</button>
    <div id="mejores-ia-resultado" style="margin-top:16px;"></div>
  </div>`;
  document.body.appendChild(overlay);
}
// ───── Analista de Cartera con IA — revisa las posiciones REALES ─────
// ═══════════════════════════════════════════════════════════════════
// ANÁLISIS LOCAL, SIN IA — si Gemini falla por cualquier motivo (sin
// conexión, límite de solicitudes, el servidor caído), el estudiante
// nunca se queda solo con un mensaje de error. Estas funciones usan
// la misma matemática real de la cartera, el mercado, o el activo,
// pero arman el diagnóstico con reglas fijas en vez de redacción de
// IA — menos elaborado, pero siempre disponible y siempre honesto
// sobre los datos reales.
// ═══════════════════════════════════════════════════════════════════
function analizarCarteraLocal(posiciones){
  const totalInvertido = posiciones.reduce((s,p)=>s+(p.invested||0), 0);
  const valorActual = posiciones.reduce((s,p)=>s+((p.currentPrice||0)*(p.qty||0)), 0);
  const conPeso = posiciones.map(p => ({ ...p, peso: totalInvertido ? ((p.invested||0)/totalInvertido)*100 : 0 }));
  const mayor = conPeso.reduce((a,b) => (b.peso>a.peso ? b : a), conPeso[0]);
  const tiposDistintos = new Set(posiciones.map(p=>p.type));
  const gananciaTotal = totalInvertido ? ((valorActual-totalInvertido)/totalInvertido)*100 : 0;

  const alertas = [];
  if(mayor.peso >= 40){
    alertas.push({ tipo:'concentracion', mensaje:`${mayor.name||mayor.ticker} representa el ${mayor.peso.toFixed(0)}% de tu capital invertido, una concentración alta en una sola posición.` });
  }
  if(tiposDistintos.size === 1){
    const nombreTipo = TESIS_TIPO_LABEL[[...tiposDistintos][0]]?.toLowerCase() || 'un solo tipo de activo';
    alertas.push({ tipo:'diversificacion', mensaje:`Toda tu cartera está en ${nombreTipo}, sin ninguna posición en otro mercado que ayude a repartir el riesgo.` });
  } else {
    alertas.push({ tipo:'positivo', mensaje:`Tu cartera combina ${tiposDistintos.size} tipos de mercado distintos, lo cual ayuda a repartir el riesgo entre ellos.` });
  }
  if(gananciaTotal < -10){
    alertas.push({ tipo:'riesgo', mensaje:`Tu cartera está ${Math.abs(gananciaTotal).toFixed(1)}% por debajo de lo invertido en este momento.` });
  } else if(gananciaTotal > 0){
    alertas.push({ tipo:'positivo', mensaje:`Tu cartera está ${gananciaTotal.toFixed(1)}% por encima de lo invertido hasta ahora.` });
  }

  return {
    diagnostico: `Capital invertido: US$${totalInvertido.toFixed(2)}. Valor actual: US$${valorActual.toFixed(2)} (${gananciaTotal>=0?'+':''}${gananciaTotal.toFixed(1)}%). Este es un análisis básico por reglas fijas, no generado por IA — los números son reales, pero sin el razonamiento adicional que la IA agrega cuando está disponible.`,
    alertas,
    esLocal: true,
  };
}

async function abrirAnalisisCarteraIA(){
  if(!portfolio.length){ if(typeof notify==='function') notify('Tu cartera está vacía todavía, compra algo primero.', 'error'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'cartera-ia-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:560px;">
    <button class="modal-close" onclick="document.getElementById('cartera-ia-overlay').remove()"><i class="ti ti-x"></i></button>
    <h2><i class="ti ti-brain" style="color:var(--gold, #e8b94a);"></i> Analista de Cartera con IA</h2>
    <p style="font-size:12.5px;color:var(--t2, #b8c4dc);margin-bottom:14px;">La IA revisa tus posiciones reales de ahora mismo, no un ejemplo genérico, y te dice qué tan concentrada o diversificada está tu cartera.</p>
    <div id="cartera-ia-resultado" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:24px 10px;color:var(--t2, #b8c4dc);font-size:13px;">
      <i class="ti ti-loader-2" style="font-size:16px;animation:girarSimIA 1s linear infinite;color:var(--gold, #e8b94a);"></i>
      <span>Analizando tu cartera…</span>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  try {
    const posiciones = portfolio.map(p => ({ name:p.name, ticker:p.ticker, type:p.type, qty:p.qty, invested:p.invested, buyPrice:p.buyPrice, currentPrice:p.currentPrice }));
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'cartera', posiciones, perfilRiesgo: window.__perfilRiesgoDeclarado || 'moderado' }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    renderResultadoAnalisisCartera(d);
  } catch(e){
    // La IA no respondió — en vez de dejar al estudiante solo con un
    // mensaje de error, se calcula el mismo análisis con reglas fijas
    // sobre los datos reales de su cartera, siempre disponible.
    const posiciones = portfolio.map(p => ({ name:p.name, ticker:p.ticker, type:p.type, qty:p.qty, invested:p.invested, buyPrice:p.buyPrice, currentPrice:p.currentPrice }));
    renderResultadoAnalisisCartera(analizarCarteraLocal(posiciones));
  }
}

function renderResultadoAnalisisCartera(d){
  const iconoPorTipo = { concentracion:'ti-alert-triangle', riesgo:'ti-alert-triangle', diversificacion:'ti-info-circle', positivo:'ti-circle-check' };
  const colorPorTipo = { concentracion:'var(--amber, #e8b94a)', riesgo:'var(--red, #ff4757)', diversificacion:'var(--accent2, #4a9eff)', positivo:'var(--green, #1e8e5a)' };
  const avisoLocal = d.esLocal
    ? `<div style="background:rgba(232,185,74,.1);border:1px solid var(--amber, #e8b94a);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11.5px;color:var(--amber, #e8b94a);"><i class="ti ti-plug-connected-x"></i> La IA no está disponible ahora mismo — este es un análisis básico por reglas, con tus datos reales.</div>`
    : '';
  document.getElementById('cartera-ia-resultado').innerHTML = `
    <div style="text-align:left;">
      ${avisoLocal}
      <p style="font-size:13.5px;color:var(--t1, #e8edf8);line-height:1.6;margin-bottom:14px;">${d.diagnostico}</p>
      ${d.alertas.map(a => `<div style="display:flex;gap:10px;align-items:flex-start;background:var(--bg2, #10141d);border:1px solid var(--c4, #242d42);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
        <i class="ti ${iconoPorTipo[a.tipo]||'ti-info-circle'}" style="color:${colorPorTipo[a.tipo]||'var(--t2)'};font-size:16px;flex-shrink:0;margin-top:1px;"></i>
        <span style="font-size:12.5px;color:var(--t2, #b8c4dc);line-height:1.5;">${a.mensaje}</span>
      </div>`).join('')}
      ${!d.esLocal ? `<div style="font-size:10.5px;color:var(--t3, #7a8ab0);margin-top:10px;">Generado con IA a partir de tus posiciones reales de ahora mismo. Revísalo con criterio propio.</div>` : ''}
    </div>
  `;
}

function generarMejoresLocal(activos, perfilRiesgo){
  // Sin IA, se ordena por un criterio simple y transparente según el
  // perfil declarado: conservador prioriza menor volatilidad,
  // agresivo prioriza mayor retorno esperado, moderado busca el
  // mejor balance entre ambos — la misma lógica que seguiría
  // cualquier regla de libro de texto, sin redacción de IA de por medio.
  const conPuntaje = activos.map(a => {
    const sigma = a.sigma ?? 15;
    const ret = a.ret ?? a.ytm ?? 5;
    let puntaje;
    if(perfilRiesgo==='conservador') puntaje = -sigma;
    else if(perfilRiesgo==='agresivo') puntaje = ret;
    else puntaje = ret - (sigma*0.5); // moderado: balance simple retorno/riesgo
    return { ...a, puntaje };
  });
  const top3 = conPuntaje.sort((a,b)=>b.puntaje-a.puntaje).slice(0,3);
  const razonPorTipo = a => {
    if(a.tipo==='bono') return `Cupón ${a.coupon}%, TIR ${a.ytm}%, calificación ${a.rating}.`;
    if(a.tipo==='divisa') return `Volatilidad ${a.sigma}%, retorno esperado ${a.ret}%.`;
    return `Beta ${a.beta}, volatilidad ${a.sigma}%, calificación ${a.rating}.`;
  };
  return {
    resumen: `Análisis básico por reglas, no generado por IA: para un perfil ${perfilRiesgo}, se priorizaron los activos con mejor balance de retorno esperado frente a volatilidad real.`,
    recomendaciones: top3.map(a => ({ ticker:a.ticker, razon:razonPorTipo(a) })),
    esLocal: true,
  };
}

async function generarMejoresInversionesIA(){
  const perfil = document.getElementById('mejores-ia-perfil').value;
  const cont = document.getElementById('mejores-ia-resultado');
  const boton = document.querySelector('#mejores-ia-overlay button.btn');
  boton.disabled = true; boton.style.opacity='.6';
  boton.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Analizando el mercado…';
  cont.innerHTML = '';
  // Los tres mercados reales de este simulador — antes solo se
  // consideraban acciones, dejando fuera bonos y divisas, que sí
  // tienen datos suficientes para una recomendación con sustancia.
  // Se arma fuera del try para que también esté disponible en el
  // fallback local si la IA no responde.
  const activosAccion = STOCKS.map(a => ({ tipo:'accion', ticker:a.ticker, name:a.name, sector:a.sector, price:a.currentPrice||a.price, beta:a.beta, sigma:a.sigma, ret:a.ret, rating:a.rating }));
  const activosBono = BONDS.map(a => ({ tipo:'bono', ticker:a.ticker, name:a.name, sector:a.country, price:a.currentPrice||a.price, coupon:a.coupon, maturity:a.maturity, ytm:a.ytm, duration:a.duration, sigma:a.sigma, ret:a.ret, rating:a.rating }));
  const activosDivisa = FOREX.map(a => ({ tipo:'divisa', ticker:a.ticker, name:a.name, sector:'Divisas', price:a.currentPrice||a.price, sigma:a.sigma, ret:a.ret }));
  const activos = [...activosAccion, ...activosBono, ...activosDivisa];
  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'mejores', activos, perfilRiesgo:perfil, metaLaboratorio: labConfig.started ? { horizonte:labConfig.horizon, objetivoPct:labConfig.target } : null }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    renderResultadoMejoresInversiones(d);
  } catch(e){
    // La IA no respondió — se genera un ranking básico por reglas
    // fijas, con los datos reales del mercado actual, para que el
    // estudiante siempre reciba tres opciones concretas, nunca solo
    // un mensaje de error.
    renderResultadoMejoresInversiones(generarMejoresLocal(activos, perfil));
  } finally {
    boton.disabled=false; boton.style.opacity='1'; boton.innerHTML = '<i class="ti ti-sparkles"></i> Generar recomendación';
  }
}

function renderResultadoMejoresInversiones(d){
  const cont = document.getElementById('mejores-ia-resultado');
  const avisoLocal = d.esLocal
    ? `<div style="background:rgba(232,185,74,.1);border:1px solid var(--amber, #e8b94a);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--amber, #e8b94a);"><i class="ti ti-plug-connected-x"></i> La IA no está disponible ahora mismo — este es un ranking básico por reglas.</div>`
    : '';
  cont.innerHTML = `
    ${avisoLocal}
    <p style="font-size:12.5px;color:var(--t2, #b8c4dc);margin-bottom:12px;line-height:1.6;">${d.resumen}</p>
    ${d.recomendaciones.map((r,i) => `<div style="background:var(--bg2, #10141d);border:1px solid var(--c4, #242d42);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:pointer;" onclick="document.getElementById('mejores-ia-overlay').remove();const a=allAssets().find(x=>x.ticker==='${r.ticker}');if(a)showAssetDetail(a.id,a.type);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;"><span style="background:var(--gold, #e8b94a);color:#000;font-weight:800;font-size:11px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;">${i+1}</span><b style="font-family:var(--font-mono, monospace);">${r.ticker}</b></div>
      <div style="font-size:12px;color:var(--t2, #b8c4dc);line-height:1.55;">${r.razon}</div>
    </div>`).join('')}
    ${!d.esLocal ? `<div style="font-size:10.5px;color:var(--t3, #7a8ab0);margin-top:8px;">Generado con IA a partir de los datos del mercado actual. Toca cualquier opción para ver su detalle completo.</div>` : ''}
  `;
}

function showAssetDetail(id,type){
  const asset=allAssets().find(a=>a.id===id&&a.type===type);
  if(!asset)return;
  selectedAsset=asset;
  renderAssetList();
  document.getElementById('mkt-no-selection').style.display='none';
  document.getElementById('mkt-detail').style.display='block';
  const p=asset.currentPrice||asset.price;
  const chg=asset.change||0;
  const sharpe=computeSharpe(asset);
  document.getElementById('mkt-name').textContent=asset.name+' ('+asset.ticker+')';
  document.getElementById('mkt-sub').textContent=asset.type==='accion'?asset.sector+' · '+asset.country:asset.type==='bono'?'Bono soberano/corp. · '+asset.country:'Par de divisas · '+asset.country;
  document.getElementById('mkt-price').textContent=asset.type==='divisa'&&p>100?'$'+Math.round(p).toLocaleString('es-PA'):(p>10?'$'+p.toFixed(2):'$'+p.toFixed(4));
  document.getElementById('mkt-change').textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%';
  document.getElementById('mkt-change').className='mt-change '+(chg>=0?'g':'r');
  document.getElementById('mkt-badges').innerHTML=
    (asset.rating?ratingBadge(asset.rating):'')+'&nbsp;'+
    (asset.type==='accion'?`<span class="badge badge-blue">β ${asset.beta}</span>`:'')+
    (asset.riskCountry?`<span class="badge ${asset.rp<1?'badge-green':asset.rp<3?'badge-amber':'badge-red'}">${asset.riskCountry}</span>`:'');

  const openP = asset.sessionOpenPrice != null ? asset.sessionOpenPrice : asset.price;
  const sessionChg = openP > 0 ? ((p - openP) / openP * 100) : 0;
  const hv = computeHistVaR(asset, 0.95);
  document.getElementById('mkt-kpis').innerHTML=[
    ['Precio apertura sesión','$'+fmt(openP),''],
    ['Precio actual (en vivo)','$'+fmt(p),chg>=0?'g':'r'],
    ['Variación de sesión',(sessionChg>=0?'+':'')+sessionChg.toFixed(2)+'%',sessionChg>=0?'g':'r'],
    ['Retorno esperado anual',asset.ret.toFixed(1)+'%','g'],
    ['Riesgo σ anual',asset.sigma.toFixed(1)+'%','a'],
    ['Ratio Sharpe',sharpe.toFixed(2),sharpe>0.5?'g':sharpe>0?'a':'r'],
    ['VaR 95% ('+hv.method+')',hv.pct.toFixed(1)+'%','r'],
    [asset.type==='accion'?'Beta (riesgo sist.)':asset.type==='bono'?'Cupón anual':'Volatilidad anual',
     asset.type==='accion'?(asset.beta||0).toFixed(2):asset.type==='bono'?(asset.coupon||0).toFixed(2)+'%':asset.sigma.toFixed(1)+'%',''],
  ].map(([l,v,c])=>`<div class="detail-kpi"><div class="dk-label">${conAyuda(l)}</div><div class="dk-val mono ${c}">${v}</div></div>`).join('');

  document.getElementById('mkt-profile').innerHTML=buildProfile(asset);
  renderEnlaceYahooFinance(asset);
  renderTesisIASimulador(asset);

  // trade panel
  updateTradeCalc();
  renderOrderList();

  // candlestick chart
  if (!candleHistory[asset.id]) initCandles(asset);
  requestAnimationFrame(() => drawCandlestickChart(asset));
}

function updateTradeCalc(){
  if(!selectedAsset)return;
  const qty=+document.getElementById('trade-qty').value||0;
  const p=selectedAsset.currentPrice||selectedAsset.price;
  document.getElementById('trade-price-show').textContent='$'+fmt(p);
  document.getElementById('trade-total-show').textContent='$'+fmt(qty*p);
  document.getElementById('trade-cap-show').textContent='$'+fmt(capital);
  // Costo estimado de ida: comisión sobre el valor + medio spread (coste de cruzar el mercado).
  const costEl=document.getElementById('trade-cost-show');
  if(costEl){
    const gross=qty*p;
    const spreadCost=gross*(spreadFor(selectedAsset.type)/2);   // medio spread (una pierna)
    const estCost=qty>0?(commissionFor(gross)+spreadCost):0;
    costEl.textContent='$'+fmt(estCost);
  }
  const held=portfolio.find(x=>x.id===selectedAsset.id);
  document.getElementById('trade-held-show').textContent=held?(held.qty+' u.'):'0 u.';
}

// Antes de ejecutar una compra o venta, muestra un resumen claro (cantidad,
// precio de ejecución, comisión, total) para evitar que un clic accidental
// mueva dinero virtual sin querer. No duplica la lógica de executeDirect,
// solo repite el mismo cálculo de precio/comisión para el resumen, en modo
// de solo lectura, y al confirmar llama a executeDirect exactamente igual
// que antes.
// ══════════════════════════════════════════════════
// ALERTAS DE PRECIO — avisar cuando un activo cruza un precio objetivo,
// revisado en cada tick de precios mientras el mercado está abierto.
// ══════════════════════════════════════════════════
let alertasPrecioCache = null; // se carga una vez por sesión de uso, se actualiza al crear/borrar

async function cargarAlertasPrecio(forzar){
  if(!sb || !currentUser || !currentUser.usuario_id || guestMode) return [];
  if(alertasPrecioCache && !forzar) return alertasPrecioCache;
  try {
    const { data } = await sb.from('alertas_precio').select('*').eq('usuario_id', currentUser.usuario_id).eq('activa', true);
    alertasPrecioCache = data || [];
  } catch(e){ alertasPrecioCache = []; }
  return alertasPrecioCache;
}

// ══════════════════════════════════════════════════
// MERCADO ENTRE ESTUDIANTES (P2P) — a diferencia de todo lo demás en
// CapitalLab, aquí se negocia directamente entre compañeros de la misma
// sesión, no contra el motor de precios simulado. Sin comisión: es un
// trato directo entre dos personas, no una operación de corretaje.
// ══════════════════════════════════════════════════
let p2pChannel = null;

async function renderMercadoP2P(esManual){
  const contAbiertas = document.getElementById('p2p-ofertas-abiertas');
  const contMisOfertas = document.getElementById('p2p-mis-ofertas');
  const cardMisOfertas = document.getElementById('p2p-mis-ofertas-card');
  const btnPublicar = document.getElementById('p2p-btn-publicar');
  const btnActualizar = document.getElementById('p2p-btn-actualizar');
  const marcaActualizacion = document.getElementById('p2p-ultima-actualizacion');
  if(!contAbiertas) return;
  await cargarMisSeguidos();

  if(!currentUser || guestMode || !currentUser.sesion_id){
    contAbiertas.innerHTML = '<div class="auth-hint">El mercado entre estudiantes es solo para cuentas con una sesión activa.</div>';
    btnPublicar.style.display = 'none';
    if(btnActualizar) btnActualizar.style.display = 'none';
    cardMisOfertas.style.display = 'none';
    return;
  }
  const esDocenteViendo = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  // El docente (y el superadministrador) puede ver todo lo que pasa en
  // el mercado entre los estudiantes de esa sesión, para supervisar,
  // pero no puede comprar, pujar ni publicar — solo observa.
  btnPublicar.style.display = esDocenteViendo ? 'none' : '';
  cardMisOfertas.style.display = esDocenteViendo ? 'none' : 'block';
  if(!esManual) contAbiertas.innerHTML = '<div class="auth-hint">Cargando…</div>';

  // El tiempo real (WebSocket) es poco confiable en algunos navegadores
  // móviles, sobre todo Safari en iOS, que corta la conexión apenas la
  // pantalla se bloquea o cambia de red — por eso este botón manual y la
  // marca de "última actualización" existen: para que nunca dependa
  // solo de que el tiempo real haya funcionado.
  if(esManual && btnActualizar){
    btnActualizar.disabled = true;
    btnActualizar.innerHTML = '<i class="ti ti-refresh" style="animation:spin .7s linear infinite;"></i> Actualizando…';
  }

  // Cada vez que se entra a esta página, se revisa si alguna de mis ofertas
  // de venta ya fue comprada por alguien mientras no estaba conectado.
  if(!esDocenteViendo) await aplicarVentasP2PPendientes();

  try {
    const { data: abiertas, error } = await sb.from('ofertas_p2p').select('*, usuarios!ofertas_p2p_vendedor_id_fkey(nombre)').eq('sesion_id', currentUser.sesion_id).eq('estado','abierta').order('creado_en',{ascending:false});
    if(error) throw error;

    const deOtros = esDocenteViendo ? (abiertas||[]) : (abiertas||[]).filter(o => o.vendedor_id !== currentUser.usuario_id);

    // Si alguna subasta ya se acabó y yo tenía la mejor puja, se reclama
    // sola — no hace falta que nadie toque nada para que la venta se cierre.
    // (El docente nunca puja, así que este paso nunca le aplica a él.)
    if(!esDocenteViendo){
      for(const o of deOtros){
        if(o.tipo==='subasta' && new Date(o.fecha_fin).getTime()<=Date.now() && o.mejor_postor_id===currentUser.usuario_id){
          reclamarSubastaGanada(o.id, o.activo_nombre);
        }
      }
    }

    if(!deOtros.length){
      contAbiertas.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--t3);">
        <i class="ti ti-users-group" style="font-size:34px;display:block;margin-bottom:10px;opacity:.4;"></i>
        ${esDocenteViendo ? 'Ningún estudiante tiene ofertas abiertas por ahora.' : 'Ningún compañero tiene ofertas abiertas por ahora.<br><span style="font-size:11.5px;">Sé el primero — publica algo de tu cartera o lanza una subasta.</span>'}
      </div>`;
    } else {
      contAbiertas.innerHTML = deOtros.map(o => {
        if(o.tipo==='subasta'){
          const terminada = new Date(o.fecha_fin).getTime() <= Date.now();
          const precioActual = o.precio_actual ?? o.precio_unitario;
          const soyElMejor = !esDocenteViendo && o.mejor_postor_id===currentUser.usuario_id;
          return `<div data-subasta-fin="${o.fecha_fin}" style="padding:12px;border:1px solid ${terminada?'var(--c4)':'var(--gold)'};border-radius:var(--r2);margin-bottom:8px;background:rgba(212,175,55,.04);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="min-width:0;">
                <div style="font-weight:700;font-size:13.5px;"><i class="ti ti-gavel" style="font-size:12px;color:var(--gold);margin-right:3px;"></i>${o.activo_nombre} <span class="badge ${typeBadgeCls(o.activo_tipo)}" style="font-size:9px;">${o.activo_tipo}</span></div>
                <div style="font-size:11.5px;color:var(--t3);">${o.usuarios?.nombre||'Estudiante'} subasta ${o.cantidad}u ${soyElMejor?'· <span style="color:var(--gold);">vas ganando</span>':''} ${!esDocenteViendo?`<i class="ti ti-${misSeguidos.has(o.vendedor_id)?'user-check':'user-plus'}" style="font-size:12px;cursor:pointer;color:${misSeguidos.has(o.vendedor_id)?'var(--gold)':'var(--t3)'};margin-left:4px;padding:8px;" title="${misSeguidos.has(o.vendedor_id)?'Dejar de seguir':'Seguir sus operaciones'}" onclick="alternarSeguirEstudiante('${o.vendedor_id}','${(o.usuarios?.nombre||'Estudiante').replace(/'/g,"\\'")}')"></i>`:''}</div>
              </div>
              <span class="nav-badge subasta-cronometro" style="background:${terminada?'var(--c3)':'rgba(212,175,55,.15)'};color:${terminada?'var(--t3)':'var(--gold)'};font-family:var(--font-mono);">${terminada?'Terminada':'—:—'}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;">
              <div><span style="font-size:10.5px;color:var(--t3);">Puja actual</span><div style="font-weight:700;font-size:17px;color:var(--gold);">$${fmt(precioActual)}</div></div>
              ${esDocenteViendo
                ? `<span class="nav-badge" title="Solo observando"><i class="ti ti-eye"></i> Observando</span>`
                : (terminada
                  ? `<span class="nav-badge">Esperando cierre…</span>`
                  : `<button class="btn btn-sm" style="background:rgba(212,175,55,.15);color:var(--gold);border:1px solid rgba(212,175,55,.3);" onclick="abrirPujarSubasta('${o.id}','${o.activo_nombre.replace(/'/g,"\\'")}',${precioActual})"><i class="ti ti-gavel"></i> Pujar</button>`)}
            </div>
          </div>`;
        }
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--c4);border-radius:var(--r2);margin-bottom:8px;flex-wrap:wrap;">
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:13.5px;">${o.activo_nombre} <span class="badge ${typeBadgeCls(o.activo_tipo)}" style="font-size:9px;">${o.activo_tipo}</span></div>
            <div style="font-size:11.5px;color:var(--t3);">${o.usuarios?.nombre||'Estudiante'} vende ${o.cantidad}u a $${fmt(o.precio_unitario)} c/u ${!esDocenteViendo?`<i class="ti ti-${misSeguidos.has(o.vendedor_id)?'user-check':'user-plus'}" style="font-size:12px;cursor:pointer;color:${misSeguidos.has(o.vendedor_id)?'var(--gold)':'var(--t3)'};margin-left:4px;padding:8px;" title="${misSeguidos.has(o.vendedor_id)?'Dejar de seguir':'Seguir sus operaciones'}" onclick="alternarSeguirEstudiante('${o.vendedor_id}','${(o.usuarios?.nombre||'Estudiante').replace(/'/g,"\\'")}')"></i>`:''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-weight:700;font-size:15px;">$${fmt(o.cantidad*o.precio_unitario)}</div>
            ${esDocenteViendo
              ? `<span class="nav-badge" title="Solo observando"><i class="ti ti-eye"></i> Observando</span>`
              : `<button class="btn btn-buy btn-sm" onclick="comprarOfertaP2P('${o.id}')">Comprar</button>`}
          </div>
        </div>`;
      }).join('');
      iniciarCronometrosSubastasP2P();
    }

    if(!esDocenteViendo){
      const mias = (abiertas||[]).filter(o => o.vendedor_id === currentUser.usuario_id);
      const { data: miasCumplidas } = await sb.from('ofertas_p2p').select('*').eq('vendedor_id', currentUser.usuario_id).eq('estado','cumplida').order('cumplida_en',{ascending:false}).limit(5);
      const todasMias = [...mias, ...(miasCumplidas||[])];
      contMisOfertas.innerHTML = todasMias.length ? todasMias.map(o => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">
          <div>${o.tipo==='subasta'?'<i class="ti ti-gavel" style="font-size:11px;color:var(--gold);margin-right:3px;"></i>':''}${o.activo_nombre} · ${o.cantidad}u ${o.tipo==='subasta'?'· puja actual $'+fmt(o.precio_actual??o.precio_unitario):'a $'+fmt(o.precio_unitario)}</div>
          ${o.estado==='abierta'
            ? `<button class="btn btn-sm" style="color:var(--red);" onclick="cancelarOfertaP2P('${o.id}',${!!o.mejor_postor_id})">Cancelar</button>`
            : `<span class="nav-badge" style="background:rgba(0,208,132,.15);color:var(--green);">Vendida</span>`}
        </div>`).join('') : '<div class="auth-hint">No tienes ninguna oferta publicada.</div>';
    }

    if(marcaActualizacion) marcaActualizacion.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'});
    if(esManual) notify('Lista actualizada.', 'success');
  } catch(e){
    contAbiertas.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  } finally {
    if(esManual && btnActualizar){
      btnActualizar.disabled = false;
      btnActualizar.innerHTML = '<i class="ti ti-refresh"></i> Actualizar';
    }
  }
}

function abrirPublicarOfertaP2P(){
  if(!portfolio.length){ notify('No tienes ninguna posición en tu cartera todavía.', 'error'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:420px;">
    <h3>Publicar oferta de venta</h3>
    <div class="sub">Cualquier compañero de tu sesión podrá verla. Sin comisión.</div>
    <div class="grade-field">
      <label>Tipo de oferta</label>
      <div class="auth-tabs" style="max-width:100%;">
        <div class="auth-tab active" id="pp-tab-fija" onclick="cambiarTipoOfertaP2P('fija')">Precio fijo</div>
        <div class="auth-tab" id="pp-tab-subasta" onclick="cambiarTipoOfertaP2P('subasta')"><i class="ti ti-gavel" style="font-size:12px;margin-right:4px;"></i>Subasta</div>
      </div>
    </div>
    <div class="grade-field">
      <label>Activo</label>
      <select id="pp-activo">${portfolio.map((p,i)=>`<option value="${i}">${p.name} (${p.qty}u disponibles)</option>`).join('')}</select>
    </div>
    <div class="grade-field"><label>Cantidad a vender</label><input type="number" id="pp-cantidad" min="1" value="1"></div>
    <div class="grade-field" id="pp-campo-precio"><label>Precio por unidad ($)</label><input type="number" id="pp-precio" step="0.01"></div>
    <div class="grade-field" id="pp-campo-duracion" style="display:none;"><label>Duración de la subasta (minutos)</label><input type="number" id="pp-duracion" min="1" value="5"></div>
    <div class="auth-msg" id="pp-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="pp-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="pp-guardar" style="flex:1;margin-top:0;">Publicar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#pp-cancelar').onclick = () => overlay.remove();

  let tipoActual = 'fija';
  window.cambiarTipoOfertaP2P = (tipo) => {
    tipoActual = tipo;
    overlay.querySelector('#pp-tab-fija').classList.toggle('active', tipo==='fija');
    overlay.querySelector('#pp-tab-subasta').classList.toggle('active', tipo==='subasta');
    overlay.querySelector('#pp-campo-precio').querySelector('label').textContent = tipo==='subasta' ? 'Precio inicial ($)' : 'Precio por unidad ($)';
    overlay.querySelector('#pp-campo-duracion').style.display = tipo==='subasta' ? '' : 'none';
    overlay.querySelector('#pp-guardar').textContent = tipo==='subasta' ? 'Lanzar subasta' : 'Publicar';
  };

  const actualizarPrecioSugerido = () => {
    const p = portfolio[+overlay.querySelector('#pp-activo').value];
    overlay.querySelector('#pp-precio').value = (p.currentPrice||p.buyPrice).toFixed(2);
    overlay.querySelector('#pp-cantidad').max = p.qty;
  };
  overlay.querySelector('#pp-activo').onchange = actualizarPrecioSugerido;
  actualizarPrecioSugerido();

  overlay.querySelector('#pp-guardar').onclick = async () => {
    const msg = overlay.querySelector('#pp-msg');
    const p = portfolio[+overlay.querySelector('#pp-activo').value];
    const cantidad = +overlay.querySelector('#pp-cantidad').value;
    const precio = +overlay.querySelector('#pp-precio').value;
    const duracion = +overlay.querySelector('#pp-duracion').value;
    if(!cantidad || cantidad<=0 || cantidad>p.qty){ msg.className='auth-msg show error'; msg.textContent='Cantidad inválida (máximo '+p.qty+').'; return; }
    if(!precio || precio<=0){ msg.className='auth-msg show error'; msg.textContent='Ingresa un precio válido.'; return; }
    if(tipoActual==='subasta' && (!duracion || duracion<=0)){ msg.className='auth-msg show error'; msg.textContent='Ingresa una duración válida.'; return; }
    const btn = overlay.querySelector('#pp-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Publicando…';
    try {
      const fila = {
        sesion_id: currentUser.sesion_id, vendedor_id: currentUser.usuario_id,
        activo_id: p.id, activo_nombre: p.name, activo_tipo: p.type,
        cantidad, precio_unitario: precio, tipo: tipoActual,
      };
      if(tipoActual==='subasta'){
        fila.fecha_fin = new Date(Date.now() + duracion*60000).toISOString();
        fila.precio_actual = precio;
      }
      const { error } = await conTiempoLimite(sb.from('ofertas_p2p').insert(fila));
      if(error) throw error;
      overlay.remove();
      notify('Oferta publicada — tus compañeros ya la pueden ver.', 'success');
      renderMercadoP2P();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo publicar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Publicar';
    }
  };
}

// Aplica una compra P2P (de precio fijo o subasta ganada) al estado local
// del comprador — factorizado para que tanto comprar directo como
// reclamar una subasta ganada usen exactamente la misma lógica.
function aplicarCompraP2PLocal(data, etiqueta){
  const costo = data.cantidad * data.precio_unitario;
  if(costo > capital){
    notify('Cuidado: esta compra deja tu capital en negativo (apalancado).', 'error');
  }
  capital -= costo;
  const ex = portfolio.find(x=>x.id===data.activo_id && x.type===data.activo_tipo);
  if(ex){ ex.qty += Number(data.cantidad); ex.invested = (ex.invested||0) + costo; }
  else portfolio.push({ id:data.activo_id, name:data.activo_nombre, type:data.activo_tipo, ticker:data.activo_nombre, qty:Number(data.cantidad), invested:costo, buyPrice:data.precio_unitario, currentPrice:data.precio_unitario });
  txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:data.activo_nombre+' ('+etiqueta+')',type:data.activo_tipo,qty:data.cantidad,price:data.precio_unitario,total:costo,fee:0});
  updateNavCapital();
  autosave();
  return costo;
}

async function comprarOfertaP2P(ofertaId){
  if(!confirm('¿Comprar esta oferta? Se descuenta de tu capital al instante.')) return;
  try {
    const { data, error } = await conTiempoLimite(sb.rpc('comprar_oferta_p2p', { p_oferta_id: ofertaId }));
    if(error) throw error;
    aplicarCompraP2PLocal(data, 'compañero');
    notify(`Compraste ${data.cantidad}u de ${data.activo_nombre} directamente a un compañero.`, 'success');
    renderMercadoP2P();
  } catch(e){
    notify('No se pudo comprar: ' + (e.message||e), 'error');
  }
}

async function cancelarOfertaP2P(ofertaId, tieneOfertas){
  const mensaje = tieneOfertas
    ? 'Esta subasta ya tiene una puja de un compañero. ¿Cancelarla de todas formas? No podrá cobrar esa puja.'
    : '¿Cancelar esta oferta? Ya no será visible para tus compañeros.';
  if(!confirm(mensaje)) return;
  try {
    const { error } = await sb.from('ofertas_p2p').update({ estado:'cancelada' }).eq('id', ofertaId);
    if(error) throw error;
    notify('Oferta cancelada.', 'success');
    renderMercadoP2P();
  } catch(e){ notify('No se pudo cancelar: ' + (e.message||e), 'error'); }
}

// Cuenta regresiva visual de cada subasta abierta en pantalla — se
// actualiza sola cada segundo sin volver a pedir nada a la nube.
let p2pIntervaloCronometros = null;
function iniciarCronometrosSubastasP2P(){
  if(p2pIntervaloCronometros) clearInterval(p2pIntervaloCronometros);
  const actualizar = () => {
    document.querySelectorAll('[data-subasta-fin]').forEach(el => {
      const fin = new Date(el.dataset.subastaFin).getTime();
      const badge = el.querySelector('.subasta-cronometro');
      if(!badge) return;
      const restante = fin - Date.now();
      if(restante <= 0){ badge.textContent = 'Terminada'; return; }
      const min = Math.floor(restante/60000), seg = Math.floor((restante%60000)/1000);
      badge.textContent = `${min}:${String(seg).padStart(2,'0')}`;
      if(restante <= 30000) badge.style.color = 'var(--red)';
    });
  };
  actualizar();
  p2pIntervaloCronometros = setInterval(actualizar, 1000);
}

function abrirPujarSubasta(ofertaId, activoNombre, precioActual){
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  const minimo = (precioActual*1.01).toFixed(2);
  overlay.innerHTML = `<div class="grade-modal" style="max-width:360px;">
    <h3>Pujar por ${activoNombre}</h3>
    <div class="sub">Puja actual: <b style="color:var(--gold);">$${fmt(precioActual)}</b>. Tu puja debe ser mayor.</div>
    <div class="grade-field"><label>Tu puja ($)</label><input type="number" id="pj-monto" step="0.01" value="${minimo}"></div>
    <div class="auth-msg" id="pj-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="pj-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="pj-enviar" style="flex:1;margin-top:0;">Pujar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#pj-cancelar').onclick = () => overlay.remove();
  overlay.querySelector('#pj-monto').addEventListener('keydown', (e) => { if(e.key==='Escape') overlay.remove(); });
  overlay.querySelector('#pj-enviar').onclick = async () => {
    const msg = overlay.querySelector('#pj-msg');
    const monto = +overlay.querySelector('#pj-monto').value;
    if(!monto || monto<=precioActual){ msg.className='auth-msg show error'; msg.textContent='Tu puja debe ser mayor a $'+fmt(precioActual)+'.'; return; }
    const btn = overlay.querySelector('#pj-enviar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Pujando…';
    try {
      const { error } = await conTiempoLimite(sb.rpc('pujar_subasta', { p_oferta_id: ofertaId, p_monto: monto }));
      if(error) throw error;
      overlay.remove();
      notify(`Pujaste $${fmt(monto)} por ${activoNombre}.`, 'success');
      renderMercadoP2P();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo pujar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Pujar';
    }
  };
}

// Se llama sola cuando detecta que una subasta terminó y yo tenía la
// mejor puja — no requiere que el estudiante haga nada para "cobrar" lo
// que ganó.
let subastasYaReclamando = new Set();
async function reclamarSubastaGanada(ofertaId, activoNombre){
  if(subastasYaReclamando.has(ofertaId)) return; // evita reclamarla dos veces si el render corre varias veces seguidas
  subastasYaReclamando.add(ofertaId);
  try {
    const { data, error } = await conTiempoLimite(sb.rpc('reclamar_subasta_ganada', { p_oferta_id: ofertaId }));
    if(error) throw error;
    aplicarCompraP2PLocal(data, 'subasta ganada');
    notify(`🎉 ¡Ganaste la subasta de ${activoNombre}! Se descontó $${fmt(data.cantidad*data.precio_unitario)} de tu capital.`, 'success');
    enviarNotificacionNativa('¡Ganaste una subasta! — CapitalLab', `Te quedaste con ${data.cantidad}u de ${activoNombre} por $${fmt(data.cantidad*data.precio_unitario)}.`);
    renderMercadoP2P();
  } catch(e){
    // si otra pestaña ya la reclamó, o alguien más la reclamó primero, no es un error grave
    subastasYaReclamando.delete(ofertaId);
  }
}

// Revisa si alguna de mis ofertas de venta fue comprada mientras no
// estaba en la app, y aplica esa venta a mi cartera local recién ahora.
async function aplicarVentasP2PPendientes(){
  if(!sb || !currentUser || !currentUser.usuario_id || guestMode) return;
  try {
    const { data: pendientes } = await sb.from('ofertas_p2p').select('*').eq('vendedor_id', currentUser.usuario_id).eq('estado','cumplida').eq('aplicada_vendedor', false);
    if(!pendientes || !pendientes.length) return;
    for(const o of pendientes){
      const pos = portfolio.find(x=>x.id===o.activo_id && x.type===o.activo_tipo);
      const cantidadAVender = pos ? Math.min(pos.qty, Number(o.cantidad)) : 0;
      const cashIn = cantidadAVender * Number(o.precio_unitario);
      if(pos && cantidadAVender>0){
        pos.qty -= cantidadAVender;
        capital += cashIn;
        if(pos.qty<=0) portfolio = portfolio.filter(x=>!(x.id===o.activo_id && x.type===o.activo_tipo));
        txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:o.activo_nombre+' (a un compañero)',type:o.activo_tipo,qty:cantidadAVender,price:o.precio_unitario,total:cashIn,fee:0});
        updateNavCapital();
        autosave();
        notify(`Un compañero te compró ${cantidadAVender}u de ${o.activo_nombre} · +$${fmt(cashIn)}`, 'success');
      }
      await sb.from('ofertas_p2p').update({ aplicada_vendedor: true }).eq('id', o.id);
    }
  } catch(e){ /* silencioso: se vuelve a intentar la próxima vez */ }
}

let p2pIntervaloRespaldo = null;

function iniciarRealtimeP2P(){
  if(!sb || !currentUser || !currentUser.sesion_id || guestMode) return;
  detenerRealtimeP2P();
  p2pChannel = sb.channel('p2p-'+currentUser.sesion_id)
    .on('postgres_changes', { event:'*', schema:'public', table:'ofertas_p2p', filter:`sesion_id=eq.${currentUser.sesion_id}` }, () => {
      renderMercadoP2P();
    })
    .subscribe();
  // Respaldo: el tiempo real (WebSocket) se corta con frecuencia en
  // navegadores móviles, sobre todo Safari en iOS con la pantalla
  // bloqueada. Este refresco cada 20s asegura que la lista se ponga al
  // día tarde o temprano aunque el tiempo real haya fallado en silencio.
  p2pIntervaloRespaldo = setInterval(() => renderMercadoP2P(), 20000);
}
function detenerRealtimeP2P(){
  if(p2pChannel && sb){ sb.removeChannel(p2pChannel); p2pChannel = null; }
  if(p2pIntervaloRespaldo){ clearInterval(p2pIntervaloRespaldo); p2pIntervaloRespaldo = null; }
  if(p2pIntervaloCronometros){ clearInterval(p2pIntervaloCronometros); p2pIntervaloCronometros = null; }
}

// ══════════════════════════════════════════════════
// CHAT — una sola tabla y una sola suscripción de tiempo real sirven a
// los dos canales (el del Mercado P2P y el de toda la sesión); cada
// mensaje que llega se dirige solo a la caja que le corresponde. El
// docente puede escribir en ambos — es la única excepción a que en el
// Mercado P2P normalmente solo observa.
// ══════════════════════════════════════════════════
let chatChannel = null;
const CHAT_CONTENEDORES = { p2p: 'p2p-chat-mensajes', sesion: 'sesion-chat-mensajes' };

function escaparHTML(texto){
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

let chatMensajesCache = { sesion: [], p2p: [] };

async function cargarChat(canal){
  const cont = document.getElementById(CHAT_CONTENEDORES[canal]);
  if(!cont || !currentUser || !currentUser.sesion_id) return;
  try {
    const { data, error } = await conTiempoLimite(sb.from('mensajes_chat').select('*').eq('sesion_id', currentUser.sesion_id).eq('canal', canal).order('creado_en', {ascending:true}).limit(200));
    if(error) throw error;
    chatMensajesCache[canal] = data || [];
    renderMensajesChat(canal, data || [], true);
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudo cargar el chat: '+(e.message||e)+'</div>';
  }
}

function filtrarMensajesChat(canal, query){
  const q = query.trim().toLowerCase();
  const filtrados = !q ? chatMensajesCache[canal] : chatMensajesCache[canal].filter(m =>
    m.cuerpo.toLowerCase().includes(q) || m.autor_nombre.toLowerCase().includes(q));
  if(q && !filtrados.length){
    document.getElementById(CHAT_CONTENEDORES[canal]).innerHTML = '<div class="auth-hint">Ningún mensaje coincide con esa búsqueda.</div>';
    return;
  }
  renderMensajesChat(canal, filtrados, false);
}

function renderMensajesChat(canal, mensajes, forzarAbajo){
  const cont = document.getElementById(CHAT_CONTENEDORES[canal]);
  if(!cont) return;
  // En la carga inicial siempre se va al final. En las actualizaciones que
  // llegan en vivo, solo se sigue bajando solo si la persona ya estaba
  // abajo — si se subió a leer mensajes viejos, no se le mueve la pantalla.
  const yaAbajo = forzarAbajo || (cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 40);
  if(!mensajes.length){
    cont.innerHTML = '<div class="auth-hint">Todavía no hay mensajes aquí — sé el primero en escribir.</div>';
    return;
  }
  cont.innerHTML = mensajes.map(m => {
    const soyYo = m.autor_id === currentUser.usuario_id;
    const esDocenteMsg = m.autor_rol === 'docente' || m.autor_rol === 'superadmin';
    return `<div style="margin-bottom:10px;${soyYo?'text-align:right;':''}">
      <div style="font-size:10px;color:${esDocenteMsg?'var(--gold)':'var(--t3)'};margin-bottom:2px;">${escaparHTML(m.autor_nombre)}${esDocenteMsg?' · docente':''} · ${tiempoRelativo(m.creado_en)}${soyYo?` · <span style="cursor:pointer;text-decoration:underline;" onclick="borrarMensajeChat('${m.id}','${canal}')">borrar</span>`:''}</div>
      <div style="display:inline-block;max-width:80%;padding:8px 12px;border-radius:var(--r2);background:${soyYo?'var(--accent)':'var(--c3)'};color:${soyYo?'#fff':'var(--t1)'};font-size:13px;text-align:left;word-break:break-word;">${escaparHTML(m.cuerpo)}</div>
    </div>`;
  }).join('');
  if(yaAbajo) cont.scrollTop = cont.scrollHeight;
}

async function borrarMensajeChat(id, canal){
  if(!confirm('¿Borrar este mensaje?')) return;
  try {
    const { error } = await sb.from('mensajes_chat').delete().eq('id', id);
    if(error) throw error;
    cargarChat(canal);
  } catch(e){ notify('No se pudo borrar: ' + (e.message||e), 'error'); }
}

function actualizarContadorChat(canal){
  const input = document.getElementById(canal+'-chat-input');
  const contador = document.getElementById(canal+'-chat-contador');
  if(!input || !contador) return;
  const restantes = 500 - input.value.length;
  contador.textContent = restantes < 100 ? restantes : '';
  contador.style.color = restantes < 20 ? 'var(--red)' : 'var(--t3)';
}

async function enviarMensajeChat(canal){
  const input = document.getElementById(canal+'-chat-input');
  if(!input) return;
  const texto = input.value.trim();
  if(!texto || !currentUser || !currentUser.sesion_id) return;
  input.value = '';
  actualizarContadorChat(canal);
  input.disabled = true;
  try {
    const { error } = await conTiempoLimite(sb.from('mensajes_chat').insert({
      sesion_id: currentUser.sesion_id, canal,
      autor_id: currentUser.usuario_id, autor_nombre: currentUser.nombre, autor_rol: currentUser.rol,
      cuerpo: texto,
    }));
    if(error) throw error;
  } catch(e){
    notify('No se pudo enviar el mensaje: ' + (e.message||e), 'error');
    input.value = texto; // se lo devolvemos para que no lo pierda
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function iniciarRealtimeChat(){
  if(!sb || !currentUser || !currentUser.sesion_id || guestMode || chatChannel) return;
  chatChannel = sb.channel('chat-'+currentUser.sesion_id)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'mensajes_chat', filter:`sesion_id=eq.${currentUser.sesion_id}` }, (payload) => {
      const canal = payload.new.canal;
      const cont = document.getElementById(CHAT_CONTENEDORES[canal]);
      if(!cont || !cont.offsetParent){
        // La caja de ese canal no está visible ahora mismo (la persona está
        // en otra página) — se enciende el punto en el menú en vez de
        // intentar actualizar algo que no se ve.
        const dot = document.getElementById('dot-'+canal);
        if(dot && payload.new.autor_id !== currentUser.usuario_id) dot.style.display = 'block';
        return;
      }
      cargarChat(canal);
    })
    .subscribe();
}
function detenerRealtimeChat(){
  if(chatChannel && sb){ sb.removeChannel(chatChannel); chatChannel = null; }
}

// ══════════════════════════════════════════════════
// COPIAR OPERACIONES ENTRE COMPAÑEROS — seguir a otro estudiante de la
// misma sesión y recibir un aviso con un botón de copiar cuando esa
// persona compra o vende. Reutiliza la tabla `operaciones` que ya existía
// para la Sala en Vivo del docente, así que no hace falta ningún cambio
// en el motor de trading ni en cómo se registran las compras y ventas.
//
// NOTA: este bloque completo desapareció por accidente al borrar el
// Modo Crisis (vivían uno junto al otro en el archivo, y el borrado por
// rango de líneas se llevó de más). Reconstruido tal como estaba.
// ══════════════════════════════════════════════════
let misSeguidos = new Set();
let operacionesChannel = null;

async function cargarMisSeguidos(){
  if(!sb || !currentUser || !currentUser.usuario_id || guestMode) { misSeguidos = new Set(); return; }
  try {
    const { data } = await sb.from('seguidores_trading').select('seguido_id').eq('seguidor_id', currentUser.usuario_id);
    misSeguidos = new Set((data||[]).map(f=>f.seguido_id));
  } catch(e){ misSeguidos = new Set(); }
}

async function alternarSeguirEstudiante(usuarioId, nombre){
  if(!currentUser || currentUser.usuario_id === usuarioId) return;
  try {
    if(misSeguidos.has(usuarioId)){
      await sb.from('seguidores_trading').delete().eq('seguidor_id', currentUser.usuario_id).eq('seguido_id', usuarioId);
      misSeguidos.delete(usuarioId);
      notify(`Dejaste de seguir a ${nombre}.`, 'success');
    } else {
      await sb.from('seguidores_trading').insert({ seguidor_id: currentUser.usuario_id, seguido_id: usuarioId, sesion_id: currentUser.sesion_id });
      misSeguidos.add(usuarioId);
      notify(`Ahora sigues a ${nombre} — te avisamos cuando opere.`, 'success');
      iniciarEscuchaOperacionesSeguidos();
    }
    renderMercadoP2P();
  } catch(e){ notify('No se pudo actualizar: ' + (e.message||e), 'error'); }
}

function iniciarEscuchaOperacionesSeguidos(){
  if(!sb || !currentUser || !currentUser.sesion_id || guestMode || operacionesChannel) return;
  operacionesChannel = sb.channel('operaciones-seguidos-'+currentUser.sesion_id)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'operaciones', filter:`sesion_id=eq.${currentUser.sesion_id}` }, (payload) => {
      const op = payload.new;
      if(op.usuario_id === currentUser.usuario_id) return; // nunca avisar de las propias
      if(!misSeguidos.has(op.usuario_id)) return; // solo de a quien sigo
      mostrarAvisoCopiarOperacion(op);
    })
    .subscribe();
}
function detenerEscuchaOperacionesSeguidos(){
  if(operacionesChannel && sb){ sb.removeChannel(operacionesChannel); operacionesChannel = null; }
}

function mostrarAvisoCopiarOperacion(op){
  enviarNotificacionNativa('Un compañero que sigues operó — CapitalLab', `${op.tipo==='compra'?'Compró':'Vendió'} ${op.cantidad}u de ${op.simbolo} a $${fmt(op.precio_ejecucion)}.`);
  const toast = document.createElement('div');
  toast.className = 'deshacer-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:4500;background:var(--c1);border:1px solid var(--gold);border-radius:var(--r2);padding:12px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw;';
  toast.innerHTML = `<span style="font-size:12.5px;white-space:nowrap;"><i class="ti ti-user-check" style="color:var(--gold);"></i> Alguien que sigues ${op.tipo==='compra'?'compró':'vendió'} ${op.cantidad}u de ${op.simbolo} a $${fmt(op.precio_ejecucion)}</span><button class="btn btn-sm" style="background:rgba(212,175,55,.15);color:var(--gold);flex-shrink:0;">Copiar</button>`;
  document.body.appendChild(toast);
  const timeoutId = setTimeout(()=>toast.remove(), 15000);
  toast.querySelector('button').onclick = () => {
    clearTimeout(timeoutId);
    copiarOperacion(op);
    toast.remove();
  };
}

// Copia la operación a mi propia cartera, al precio ACTUAL del mercado
// (no al precio exacto que tenía la otra persona en ese instante, que ya
// pudo haber cambiado) — es la misma lógica que cualquier compra o venta
// normal, solo que la dispara este aviso en vez del panel de Mercado.
function copiarOperacion(op){
  const activo = allAssets().find(a => a.name === op.simbolo);
  if(!activo){ notify('No se pudo encontrar ese activo para copiarlo.', 'error'); return; }
  const precioActual = activo.currentPrice || activo.price;
  if(op.tipo === 'compra'){
    const costo = op.cantidad * precioActual;
    if(costo > capital){ notify('No tienes suficiente capital para copiar esta compra.', 'error'); return; }
    const ex = portfolio.find(x=>x.id===activo.id && x.type===activo.type);
    capital -= costo;
    if(ex){ ex.qty += Number(op.cantidad); ex.invested = (ex.invested||0) + costo; }
    else portfolio.push({ ...activo, qty:Number(op.cantidad), invested:costo, buyPrice:precioActual, currentPrice:precioActual });
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:activo.name+' (copiada)',type:activo.type,qty:op.cantidad,price:precioActual,total:costo,fee:0});
  } else {
    const pos = portfolio.find(x=>x.id===activo.id && x.type===activo.type);
    if(!pos || pos.qty < op.cantidad){ notify('No tienes suficientes unidades para copiar esta venta.', 'error'); return; }
    const ingreso = op.cantidad * precioActual;
    pos.qty -= op.cantidad;
    capital += ingreso;
    if(pos.qty<=0) portfolio = portfolio.filter(x=>!(x.id===activo.id && x.type===activo.type));
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:activo.name+' (copiada)',type:activo.type,qty:op.cantidad,price:precioActual,total:ingreso,fee:0});
  }
  updateNavCapital();
  autosave();
  if(typeof renderPortfolio==='function') renderPortfolio();
  notify(`Copiaste la operación — ${op.cantidad}u de ${activo.name} a $${fmt(precioActual)}.`, 'success');
}

// ══════════════════════════════════════════════════
// TARJETA DE CARTERA PARA COMPARTIR — una imagen lista para bajar o
// compartir directo desde el celular (WhatsApp, redes), con el resumen
// del desempeño. Se dibuja con canvas, nada de datos nuevos ni de la
// nube — solo una forma bonita de mostrar lo que ya está en pantalla.
// ══════════════════════════════════════════════════
// Repite la última compra o venta registrada, al precio ACTUAL del
// mercado (nunca al precio viejo) — para cuando alguien quiere seguir
// aumentando la misma posición sin volver a buscar el activo cada vez.
function repetirUltimaOperacion(){
  const ultima = txHistory.find(t => t.action==='Compra' || t.action==='Venta');
  if(!ultima){ notify('Todavía no tienes ninguna operación para repetir.', 'error'); return; }
  const activo = allAssets().find(a => a.name === ultima.name.replace(/ \(.*\)$/,''));
  if(!activo){ notify('No se pudo encontrar ese activo para repetirlo.', 'error'); return; }
  const precioActual = activo.currentPrice || activo.price;
  const esCompra = ultima.action==='Compra';
  if(!confirm(`¿Repetir: ${esCompra?'comprar':'vender'} ${ultima.qty}u de ${activo.name} a $${fmt(precioActual)} (precio actual)?`)) return;

  if(esCompra){
    const costo = ultima.qty * precioActual;
    if(costo > capital){ notify('No tienes suficiente capital para repetir esta compra.', 'error'); return; }
    const ex = portfolio.find(x=>x.id===activo.id && x.type===activo.type);
    capital -= costo;
    if(ex){ ex.qty += Number(ultima.qty); ex.invested = (ex.invested||0) + costo; }
    else portfolio.push({ ...activo, qty:Number(ultima.qty), invested:costo, buyPrice:precioActual, currentPrice:precioActual });
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:activo.name+' (repetida)',type:activo.type,qty:ultima.qty,price:precioActual,total:costo,fee:0});
  } else {
    const pos = portfolio.find(x=>x.id===activo.id && x.type===activo.type);
    if(!pos || pos.qty < ultima.qty){ notify('No tienes suficientes unidades para repetir esta venta.', 'error'); return; }
    const ingreso = ultima.qty * precioActual;
    pos.qty -= ultima.qty;
    capital += ingreso;
    if(pos.qty<=0) portfolio = portfolio.filter(x=>!(x.id===activo.id && x.type===activo.type));
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:activo.name+' (repetida)',type:activo.type,qty:ultima.qty,price:precioActual,total:ingreso,fee:0});
  }
  updateNavCapital();
  autosave();
  if(typeof renderPortfolio==='function') renderPortfolio();
  notify(`Operación repetida — ${ultima.qty}u de ${activo.name} a $${fmt(precioActual)}.`, 'success');
}

// Racha de días activos — un elemento de constancia simple, guardado en
// este mismo navegador: si entra hoy y también entró ayer, suma un día;
// si dejó pasar más de un día, la racha se reinicia. No depende de la
// nube porque no busca calificar nada, solo animar a volver seguido.
let rachaActividad = 0;
function actualizarRachaActividad(){
  if(!currentUser || !currentUser.sesion_id) return;
  const clave = 'capitallab_racha_'+currentUser.sesion_id;
  const hoy = new Date().toISOString().slice(0,10);
  let datos;
  try { datos = JSON.parse(localStorage.getItem(clave)) || null; } catch(e){ datos = null; }
  if(!datos){ datos = { ultimaFecha: hoy, dias: 1 }; }
  else if(datos.ultimaFecha === hoy){ /* ya contada hoy, no cambia */ }
  else {
    const ayer = new Date(Date.now()-86400000).toISOString().slice(0,10);
    datos.dias = (datos.ultimaFecha === ayer) ? datos.dias + 1 : 1;
    datos.ultimaFecha = hoy;
  }
  localStorage.setItem(clave, JSON.stringify(datos));
  rachaActividad = datos.dias;
}

// ══════════════════════════════════════════════════
// ASESOR DE CARTERA — analiza la cartera actual con reglas concretas de
// finanzas (concentración, diversificación, riesgo, posiciones perdedoras)
// y da alertas y sugerencias accionables, como lo haría un asesor real
// revisando la cartera de un cliente. No usa ninguna IA externa: son
// reglas financieras estándar aplicadas a los datos que ya existen.
// ══════════════════════════════════════════════════
function generarConsejosCartera(){
  const consejos = [];
  const valorTotal = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  if(portfolio.length === 0){
    consejos.push({ tipo:'info', icono:'ti-info-circle', titulo:'Todavía no has invertido nada',
      texto:'Tienes todo tu capital sin invertir. Considera empezar con una o dos posiciones pequeñas para ir familiarizándote con el simulador.' });
    return consejos;
  }

  // Concentración: alguna posición representa más del 40% de la cartera.
  const valores = portfolio.map(p => ({ p, v: p.qty*(p.currentPrice||p.buyPrice) }));
  const mayor = valores.reduce((a,b) => b.v > a.v ? b : a, valores[0]);
  const pctMayor = (mayor.v / valorTotal) * 100;
  if(pctMayor > 40){
    consejos.push({ tipo:'alerta', icono:'ti-alert-triangle', titulo:'Concentración alta',
      texto:`${mayor.p.name} representa el ${pctMayor.toFixed(0)}% de tu cartera. Si ese activo cae, el golpe a tu retorno total sería grande — considera repartir ese capital en más posiciones.` });
  }

  // Diversificación por tipo de activo.
  const tipos = new Set(portfolio.map(p=>p.type));
  if(tipos.size === 1 && portfolio.length >= 2){
    const tipoUnico = { accion:'acciones', bono:'bonos', divisa:'divisas', futuro:'futuros', derivado:'derivados' }[[...tipos][0]] || 'un solo tipo de activo';
    consejos.push({ tipo:'sugerencia', icono:'ti-chart-pie', titulo:'Todo en un solo mercado',
      texto:`Toda tu cartera está en ${tipoUnico}. Combinar con otro tipo de activo (por ejemplo, bonos si solo tienes acciones) suele reducir el riesgo total sin sacrificar tanto retorno.` });
  }

  // Riesgo de la cartera (sigma ponderada) muy alto.
  const pm = computePortfolioMetrics(portfolio);
  if(pm.wSigma > 35){
    consejos.push({ tipo:'alerta', icono:'ti-activity', titulo:'Riesgo elevado',
      texto:`La volatilidad estimada de tu cartera es de ${pm.wSigma.toFixed(1)}%, considerablemente alta. Es una estrategia válida si buscas retorno agresivo, pero prepárate para movimientos fuertes en ambas direcciones.` });
  }

  // Sharpe negativo o muy bajo.
  if(pm.sharpe < 0){
    consejos.push({ tipo:'alerta', icono:'ti-trending-down', titulo:'Retorno no compensa el riesgo',
      texto:'Tu ratio de Sharpe está en negativo — el riesgo que estás tomando no se está viendo recompensado con retorno. Vale la pena revisar si alguna posición ya cumplió su propósito y conviene cerrarla.' });
  } else if(pm.sharpe > 1){
    consejos.push({ tipo:'positivo', icono:'ti-trophy', titulo:'Buen equilibrio riesgo-retorno',
      texto:`Tu ratio de Sharpe (${pm.sharpe.toFixed(2)}) es sólido — estás obteniendo un buen retorno en proporción al riesgo que asumes. Sigue así.` });
  }

  // Posición individual con pérdida fuerte.
  portfolio.forEach(p => {
    const cambio = ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100;
    if(cambio < -15){
      consejos.push({ tipo:'alerta', icono:'ti-trending-down', titulo:`${p.name} en pérdida fuerte`,
        texto:`Esta posición está ${Math.abs(cambio).toFixed(1)}% por debajo de tu precio de compra. Decide con calma: ¿sigues creyendo en este activo a largo plazo, o es momento de cortar la pérdida?` });
    }
  });

  // Capital sin invertir muy alto en proporción a la cartera.
  const pctSinInvertir = (capital / valorTotal) * 100;
  if(pctSinInvertir > 60 && portfolio.length > 0){
    consejos.push({ tipo:'sugerencia', icono:'ti-cash', titulo:'Mucho capital sin invertir',
      texto:`Tienes el ${pctSinInvertir.toFixed(0)}% de tu cartera todavía en efectivo. Dinero sin invertir no genera retorno — si ya perdiste el miedo inicial, considera poner a trabajar una parte más.` });
  }

  if(!consejos.length){
    consejos.push({ tipo:'positivo', icono:'ti-check', titulo:'Cartera balanceada',
      texto:'No encontré ninguna señal de alerta en tu cartera ahora mismo — se ve razonablemente diversificada y con un riesgo controlado.' });
  }
  return consejos;
}

function abrirAsesorCartera(){
  if(!currentUser){ notify('Inicia sesión para usar el asesor.', 'error'); return; }
  const consejos = generarConsejosCartera();
  const colorTipo = { alerta:'var(--red)', sugerencia:'var(--accent2)', positivo:'var(--green)', info:'var(--t3)' };
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:520px;max-height:85vh;overflow-y:auto;">
    <h3><i class="ti ti-bulb"></i> Asesor de Cartera</h3>
    <div class="sub">Un vistazo rápido a tu cartera, con reglas de finanzas reales — no reemplaza tu propio criterio.</div>
    ${consejos.map(c => `<div style="background:var(--c2);border-left:3px solid ${colorTipo[c.tipo]};border-radius:var(--r);padding:12px 14px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:13px;color:${colorTipo[c.tipo]};margin-bottom:4px;"><i class="ti ${c.icono}"></i> ${c.titulo}</div>
      <div style="font-size:12.5px;color:var(--t2);line-height:1.5;">${c.texto}</div>
    </div>`).join('')}
    <button class="btn btn-ghost" onclick="this.closest('.grade-modal-overlay').remove()" style="width:100%;margin-top:6px;min-height:44px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
}

// ══════════════════════════════════════════════════
// CERTIFICADO DE FINALIZACIÓN — una imagen formal, tipo diploma, con el
// desempeño del estudiante en CapitalLab. Pensado para que se lo lleve
// como constancia, para un portafolio personal o para mostrarlo en la
// clase — no es una calificación oficial, es un reconocimiento simbólico
// generado por el propio simulador.
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// TARJETA DE DESEMPEÑO — antes se llamaba "Certificado de Finalización"
// y tenía apariencia de diploma formal (borde decorativo doble, tipografía
// de certificado, mención de la Universidad de Panamá como si la
// emitiera). Un cliente hizo notar, con razón, que eso podía interpretarse
// como un intento de simular un documento oficial, sin ninguna
// institución real detrás de su emisión. Se rediseñó por completo: ahora
// tiene la misma apariencia informal de "tarjeta para compartir" que ya
// usan el resumen de cartera y los logros, con un aviso explícito de que
// no es ningún tipo de certificación oficial.
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// DIARIO DE TRADING — tras cada compra o venta, un aviso breve y
// opcional invita a anotar por qué se tomó esa decisión. La idea no es
// interrumpir el flujo de operar (por eso se puede ignorar sin problema),
// sino, con el tiempo, dejarle al estudiante un historial de su propio
// razonamiento — mucho más útil para aprender que solo ver el resultado
// final. Se guarda en este mismo navegador, junto con el resto del
// progreso.
// ══════════════════════════════════════════════════
let diarioTrading = [];

function mostrarPromptDiarioTrading(accion, nombreActivo){
  document.querySelectorAll('.diario-prompt').forEach(el=>el.remove());
  const el = document.createElement('div');
  el.className = 'diario-prompt';
  // Se coloca arriba, no abajo — la parte inferior de la pantalla ya la
  // usan al mismo tiempo la notificación de la operación y el aviso de
  // "Deshacer", y apilar un tercer aviso justo ahí garantizaba que se
  // taparan entre sí (el campo de texto quedaba cubierto y no se podía
  // escribir). Arriba queda solo, sin nadie más compitiendo por ese
  // espacio.
  el.style.cssText = 'position:fixed;top:92px;left:50%;transform:translateX(-50%);z-index:3000;background:var(--c1);border:1px solid var(--c4);border-radius:var(--r2);padding:12px 16px;max-width:92vw;width:360px;box-shadow:0 10px 30px rgba(0,0,0,.4);';
  el.innerHTML = `
    <div style="font-size:12px;color:var(--t3);margin-bottom:6px;"><i class="ti ti-notebook" style="color:var(--accent2);"></i> ¿Por qué hiciste esta ${accion.toLowerCase()} de ${nombreActivo}? <span style="color:var(--t3);">(opcional)</span></div>
    <div style="display:flex;gap:6px;">
      <input type="text" id="diario-nota-input" placeholder="Ej. Creo que va a subir por..." maxlength="200" style="flex:1;padding:8px 10px;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);color:var(--t1);font-family:var(--font-body);font-size:12.5px;">
      <button class="btn btn-sm" id="diario-nota-guardar">Guardar</button>
    </div>`;
  document.body.appendChild(el);
  const timeoutId = setTimeout(()=>el.remove(), 12000);
  const input = el.querySelector('#diario-nota-input');
  input.focus();
  const guardar = () => {
    const texto = input.value.trim();
    if(texto){
      diarioTrading.unshift({ fecha: new Date().toISOString(), accion, activo: nombreActivo, nota: texto });
      if(diarioTrading.length > 100) diarioTrading.length = 100; // tope razonable, no debe crecer sin límite para siempre
      autosave();
      notify('Nota guardada en tu Diario de Trading.', 'success');
    }
    clearTimeout(timeoutId);
    el.remove();
  };
  el.querySelector('#diario-nota-guardar').onclick = guardar;
  input.onkeydown = (e) => { if(e.key==='Enter') guardar(); };
}

// ══════════════════════════════════════════════════
// META PERSONAL — el estudiante se pone su propia meta de valor de
// cartera (distinta de la meta del Laboratorio, que es aparte y la
// define el propio Laboratorio). Cuando la alcanza, se le avisa una sola
// vez, con notificación nativa incluida si la tiene activada.
// ══════════════════════════════════════════════════
let metaPersonal = null; // { valor, celebrada }

// ══════════════════════════════════════════════════
// YO vs. EL MERCADO — compara el retorno real del estudiante contra lo
// que hubiera obtenido simplemente repartiendo su capital inicial entre
// todos los activos disponibles y no tocar nada más (inversión pasiva).
// Es la lección clásica de finanzas: ¿de verdad conviene operar
// activamente, o el mercado en su conjunto ya lo hace mejor?
// ══════════════════════════════════════════════════
function abrirComparadorIndice(){
  if(!currentUser){ notify('Inicia sesión primero.', 'error'); return; }
  const valorActual = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  const retornoPropio = ((valorActual - 50000) / 50000) * 100;

  const activos = allAssets();
  if(!activos.length){ notify('No hay datos de mercado disponibles todavía.', 'error'); return; }
  const cambios = activos.map(a => {
    const inicial = a.price;
    const actual = a.currentPrice || a.price;
    return inicial > 0 ? ((actual - inicial) / inicial) * 100 : 0;
  });
  const retornoPasivo = cambios.length ? cambios.reduce((s,c)=>s+c,0) / cambios.length : 0;
  const diferencia = retornoPropio - retornoPasivo;

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:460px;">
    <h3><i class="ti ti-scale"></i> Yo vs. el Mercado</h3>
    <div class="sub">Tu retorno real, contra lo que hubieras obtenido repartiendo tu capital inicial entre todo el mercado disponible y no tocar nada más.</div>
    <div style="display:flex;gap:12px;margin:14px 0;">
      <div style="flex:1;background:var(--c2);border-radius:var(--r2);padding:14px;text-align:center;">
        <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Tu retorno (activo)</div>
        <div style="font-size:24px;font-weight:700;color:${retornoPropio>=0?'var(--green)':'var(--red)'};">${retornoPropio>=0?'+':''}${retornoPropio.toFixed(1)}%</div>
      </div>
      <div style="flex:1;background:var(--c2);border-radius:var(--r2);padding:14px;text-align:center;">
        <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Mercado (pasivo)</div>
        <div style="font-size:24px;font-weight:700;color:${retornoPasivo>=0?'var(--green)':'var(--red)'};">${retornoPasivo>=0?'+':''}${retornoPasivo.toFixed(1)}%</div>
      </div>
    </div>
    <div class="info-box" style="font-size:12.5px;">
      ${diferencia > 1
        ? `Tu estrategia activa le está ganando al mercado en general por ${diferencia.toFixed(1)} puntos porcentuales — tus decisiones de comprar y vender activos específicos están aportando valor real.`
        : diferencia < -1
          ? `El mercado en su conjunto le está ganando a tu estrategia por ${Math.abs(diferencia).toFixed(1)} puntos porcentuales — es una lección real de finanzas: superar al mercado de forma consistente es difícil, incluso para profesionales.`
          : `Tu resultado está muy parejo con lo que hubiera dado simplemente repartir el capital entre todo el mercado — ni mejor ni peor de forma significativa.`
      }
    </div>
    <button class="btn btn-ghost" onclick="this.closest('.grade-modal-overlay').remove()" style="width:100%;margin-top:10px;min-height:44px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
}

function abrirMetaPersonal(){
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  const valorActual = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  overlay.innerHTML = `<div class="grade-modal" style="max-width:420px;">
    <h3><i class="ti ti-flag"></i> Mi meta personal</h3>
    <div class="sub">Ponte una meta propia de valor de cartera — te avisamos cuando la alcances.</div>
    ${metaPersonal ? `<div class="info-box" style="font-size:12px;margin-bottom:12px;">Tu meta actual: <b>$${metaPersonal.valor.toLocaleString('es-PA')}</b> — vas en $${valorActual.toLocaleString('es-PA',{maximumFractionDigits:0})} (${Math.min(100,(valorActual/metaPersonal.valor*100)).toFixed(0)}%).</div>` : ''}
    <div class="grade-field"><label>Meta de valor de cartera ($)</label><input type="number" id="mp-valor" min="1" value="${metaPersonal ? metaPersonal.valor : Math.round(valorActual*1.2)}"></div>
    <div class="auth-msg" id="mp-msg"></div>
    <div style="display:flex;gap:10px;">
      ${metaPersonal ? `<button class="btn btn-ghost" id="mp-quitar" style="flex:1;min-height:44px;">Quitar meta</button>` : ''}
      <button class="btn btn-ghost" onclick="this.closest('.grade-modal-overlay').remove()" style="flex:1;min-height:44px;">Cerrar</button>
      <button class="auth-submit" id="mp-guardar" style="flex:1;margin-top:0;min-height:44px;">Guardar meta</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  if(metaPersonal) overlay.querySelector('#mp-quitar').onclick = () => { metaPersonal = null; autosave(); overlay.remove(); notify('Meta personal eliminada.', 'success'); };
  overlay.querySelector('#mp-guardar').onclick = () => {
    const valor = +overlay.querySelector('#mp-valor').value;
    const msg = overlay.querySelector('#mp-msg');
    if(!valor || valor <= 0){ msg.className='auth-msg show error'; msg.textContent='Ingresa un valor válido.'; return; }
    metaPersonal = { valor, celebrada: false };
    autosave();
    overlay.remove();
    notify('Meta personal guardada.', 'success');
  };
}

// Se llama cada vez que se refresca la cartera — revisa si ya se alcanzó
// la meta y, si es la primera vez, celebra una sola vez (no se repite en
// cada render siguiente).
function verificarMetaPersonal(){
  if(!metaPersonal || metaPersonal.celebrada) return;
  const valorActual = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  if(valorActual >= metaPersonal.valor){
    metaPersonal.celebrada = true;
    autosave();
    notify(`🎯 ¡Alcanzaste tu meta personal de $${metaPersonal.valor.toLocaleString('es-PA')}!`, 'success');
    enviarNotificacionNativa('¡Meta alcanzada! — CapitalLab', `Tu cartera ya llegó a $${metaPersonal.valor.toLocaleString('es-PA')}.`);
  }
}

function abrirDiarioTrading(){
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:520px;max-height:85vh;overflow-y:auto;">
    <h3><i class="ti ti-notebook"></i> Mi Diario de Trading</h3>
    <div class="sub">Tus propias anotaciones sobre por qué tomaste cada decisión.</div>
    <div id="diario-lista">${diarioTrading.length ? diarioTrading.map(d => `
      <div style="background:var(--c2);border-radius:var(--r);padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:4px;">
          <span><b style="color:${d.accion==='Compra'?'var(--green)':'var(--red)'};">${d.accion}</b> · ${d.activo}</span>
          <span>${tiempoRelativo(d.fecha)}</span>
        </div>
        <div style="font-size:13px;color:var(--t1);">${escaparHTML(d.nota)}</div>
      </div>`).join('') : '<div class="auth-hint">Todavía no tienes ninguna anotación — la próxima vez que compres o vendas, te preguntamos por qué.</div>'}
    </div>
    <button class="btn btn-ghost" onclick="this.closest('.grade-modal-overlay').remove()" style="width:100%;margin-top:10px;min-height:44px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
}

function abrirInsigniaDesempeno(){
  if(!currentUser || guestMode){ notify('Necesitas una cuenta real para generar tu tarjeta.', 'error'); return; }
  const valorTotal = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  const retornoPct = ((valorTotal - 50000) / 50000) * 100;

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:480px;text-align:center;">
    <h3>Tu tarjeta de desempeño</h3>
    <div class="sub">Un resumen informal de tu paso por CapitalLab, para compartir o guardar.</div>
    <canvas id="cert-canvas" width="1200" height="1000" style="width:100%;max-width:340px;border-radius:12px;margin:10px auto;display:block;box-shadow:0 8px 24px rgba(0,0,0,.35);"></canvas>
    <div class="info-box" style="font-size:11px;text-align:left;margin-bottom:10px;">
      Esta tarjeta la genera el propio simulador y <b>no es un certificado oficial</b> — no acredita estudios ni la emite ninguna institución. Es solo un resumen para compartir.
    </div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-ghost" id="cert-cerrar" style="flex:1;min-height:44px;">Cerrar</button>
      <button class="auth-submit" id="cert-descargar" style="flex:1;margin-top:0;min-height:44px;"><i class="ti ti-download"></i> Descargar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cert-cerrar').onclick = () => overlay.remove();

  dibujarInsigniaDesempeno(overlay.querySelector('#cert-canvas'), {
    nombre: currentUser.nombre, sesion: currentUser.sesion_nombre || 'CapitalLab', retornoPct,
    operaciones: txHistory.filter(t=>t.action==='Compra'||t.action==='Venta').length,
  });

  overlay.querySelector('#cert-descargar').onclick = () => {
    overlay.querySelector('#cert-canvas').toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tarjeta-desempeno-capitallab-${(currentUser.nombre||'estudiante').replace(/\s+/g,'_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
}

function dibujarInsigniaDesempeno(canvas, d){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#10141D'); grad.addColorStop(1,'#0B0E14');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  // Sin borde doble de diploma — el mismo estilo simple de tarjeta que
  // ya usan el resumen de cartera y los logros, para que se sienta como
  // lo que es: un resumen informal, no un documento formal.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00C4FF'; ctx.font = 'bold 32px Arial';
  ctx.fillText('CAPITALLAB', 60, 100);
  ctx.fillStyle = '#7A8AB0'; ctx.font = '18px Arial';
  ctx.fillText('Tarjeta de desempeño · simulador educativo', 60, 132);

  ctx.fillStyle = '#3D4D72'; ctx.font = '18px Arial';
  ctx.fillText('Participación de', 60, 220);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 46px Arial';
  ctx.fillText(d.nombre, 60, 280);
  ctx.fillStyle = '#7A8AB0'; ctx.font = '20px Arial';
  ctx.fillText(`en "${d.sesion}"`, 60, 320);

  ctx.strokeStyle = '#242D42'; ctx.beginPath(); ctx.moveTo(60,370); ctx.lineTo(W-60,370); ctx.stroke();

  const gan = d.retornoPct >= 0;
  ctx.fillStyle = '#1C2333';
  ctx.beginPath(); ctx.roundRect(60, 410, (W-150)/2, 160, 12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(90+(W-150)/2, 410, (W-150)/2, 160, 12); ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = gan?'#00D084':'#FF4757'; ctx.font = 'bold 42px Arial';
  ctx.fillText((gan?'+':'')+d.retornoPct.toFixed(1)+'%', 90, 495);
  ctx.fillStyle = '#7A8AB0'; ctx.font = '14px Arial';
  ctx.fillText('RETORNO OBTENIDO', 90, 525);

  ctx.fillStyle = '#00C4FF'; ctx.font = 'bold 42px Arial';
  ctx.fillText(String(d.operaciones), 120+(W-150)/2, 495);
  ctx.fillStyle = '#7A8AB0'; ctx.font = '14px Arial';
  ctx.fillText('OPERACIONES', 120+(W-150)/2, 525);

  // Aviso explícito, dentro de la propia imagen — no solo en el modal —
  // para que quede claro incluso si la imagen circula por separado.
  ctx.fillStyle = '#3D4D72'; ctx.font = 'italic 15px Arial';
  ctx.fillText('Documento informal generado por el simulador.', 60, 900);
  ctx.fillText('No constituye una certificación oficial ni acredita estudios.', 60, 924);
  const fecha = new Date().toLocaleDateString('es-PA', { day:'numeric', month:'long', year:'numeric' });
  ctx.fillStyle = '#242D42'; ctx.font = '13px Arial';
  ctx.fillText(fecha, 60, 960);
}

// ══════════════════════════════════════════════════
// REPLAY DE MI CARTERA — recorre con un control deslizante cómo fue
// cambiando el valor de la cartera a lo largo de la sesión, en vez de
// solo ver el número final. Usa navHistory, que ya se guarda tick a
// tick — no hace falta ninguna tabla ni consulta nueva.
// ══════════════════════════════════════════════════
function abrirReplayCartera(){
  if(!navHistory || navHistory.length < 2){ notify('Todavía no hay suficiente historial de tu cartera para reproducir — sigue operando y vuelve más tarde.', 'error'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:560px;">
    <h3><i class="ti ti-player-play"></i> Replay de mi Cartera</h3>
    <div class="sub">Recorre cómo fue cambiando el valor de tu cartera durante la sesión.</div>
    <canvas id="rc-canvas" width="900" height="260" style="width:100%;height:180px;background:var(--c2);border-radius:var(--r);margin-bottom:10px;"></canvas>
    <input type="range" id="rc-slider" min="0" max="${navHistory.length-1}" value="${navHistory.length-1}" style="width:100%;">
    <div style="display:flex;justify-content:space-between;margin-top:10px;">
      <div>
        <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Valor en este momento</div>
        <div id="rc-valor" style="font-size:24px;font-weight:700;">—</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Momento</div>
        <div id="rc-fecha" style="font-size:13px;color:var(--t2);">—</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-sm" id="rc-play" style="flex:1;min-height:44px;"><i class="ti ti-player-play"></i> Reproducir</button>
      <button class="btn btn-ghost" onclick="this.closest('.grade-modal-overlay').remove()" style="flex:1;min-height:44px;">Cerrar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};

  const slider = overlay.querySelector('#rc-slider');
  const canvas = overlay.querySelector('#rc-canvas');
  let reproduciendo = null;

  function actualizarReplay(i){
    const punto = navHistory[i];
    if(!punto) return;
    overlay.querySelector('#rc-valor').textContent = '$'+punto.value.toLocaleString('es-PA',{maximumFractionDigits:0});
    overlay.querySelector('#rc-fecha').textContent = new Date(punto.t).toLocaleString('es-PA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    dibujarReplayChart(canvas, navHistory, i);
  }
  slider.oninput = () => actualizarReplay(+slider.value);
  actualizarReplay(navHistory.length-1);

  overlay.querySelector('#rc-play').onclick = () => {
    if(reproduciendo){ clearInterval(reproduciendo); reproduciendo = null; overlay.querySelector('#rc-play').innerHTML = '<i class="ti ti-player-play"></i> Reproducir'; return; }
    slider.value = 0;
    actualizarReplay(0);
    overlay.querySelector('#rc-play').innerHTML = '<i class="ti ti-player-pause"></i> Pausar';
    reproduciendo = setInterval(() => {
      let i = +slider.value;
      if(i >= navHistory.length-1){ clearInterval(reproduciendo); reproduciendo = null; overlay.querySelector('#rc-play').innerHTML = '<i class="ti ti-player-play"></i> Reproducir'; return; }
      slider.value = i+1;
      actualizarReplay(i+1);
    }, 150);
  };
}

function dibujarReplayChart(canvas, historial, indiceActual){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const valores = historial.map(h=>h.value);
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = (max-min) || 1;
  const pad = 20;
  const puntoX = i => pad + (i/(historial.length-1)) * (W-pad*2);
  const puntoY = v => H-pad - ((v-min)/rango) * (H-pad*2);

  ctx.strokeStyle = '#3D4D72'; ctx.lineWidth = 2; ctx.beginPath();
  historial.forEach((h,i) => i===0 ? ctx.moveTo(puntoX(i),puntoY(h.value)) : ctx.lineTo(puntoX(i),puntoY(h.value)));
  ctx.stroke();

  const ganando = historial[indiceActual].value >= historial[0].value;
  ctx.strokeStyle = ganando ? '#00D084' : '#FF4757'; ctx.lineWidth = 3; ctx.beginPath();
  for(let i=0;i<=indiceActual;i++){ i===0 ? ctx.moveTo(puntoX(i),puntoY(historial[i].value)) : ctx.lineTo(puntoX(i),puntoY(historial[i].value)); }
  ctx.stroke();

  ctx.fillStyle = ganando ? '#00D084' : '#FF4757';
  ctx.beginPath(); ctx.arc(puntoX(indiceActual), puntoY(historial[indiceActual].value), 5, 0, Math.PI*2); ctx.fill();
}

function abrirTarjetaCompartir(){
  if(!currentUser){ notify('Inicia sesión para compartir tu cartera.', 'error'); return; }
  const valorTotal = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  const invertidoInicial = 50000; // capital inicial estándar de CapitalLab
  const retornoPct = ((valorTotal - invertidoInicial) / invertidoInicial) * 100;
  const topPosiciones = [...portfolio].sort((a,b)=>(b.qty*(b.currentPrice||b.buyPrice))-(a.qty*(a.currentPrice||a.buyPrice))).slice(0,3);

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:420px;text-align:center;">
    <h3>Comparte tu cartera</h3>
    <div class="sub">Una imagen lista para bajar o compartir directo desde tu celular.</div>
    <canvas id="tc-canvas" width="1080" height="1350" style="width:100%;max-width:340px;border-radius:12px;margin:10px auto;display:block;box-shadow:0 8px 24px rgba(0,0,0,.35);"></canvas>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-ghost" id="tc-cerrar" style="flex:1;">Cerrar</button>
      <button class="auth-submit" id="tc-compartir" style="flex:1;margin-top:0;"><i class="ti ti-download"></i> Descargar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#tc-cerrar').onclick = () => overlay.remove();

  dibujarTarjetaCartera(overlay.querySelector('#tc-canvas'), {
    nombre: currentUser.nombre, sesion: currentUser.sesion_nombre || 'CapitalLab',
    valorTotal, retornoPct, topPosiciones,
  });

  overlay.querySelector('#tc-compartir').onclick = async () => {
    const canvas = overlay.querySelector('#tc-canvas');
    canvas.toBlob(async (blob) => {
      const archivo = new File([blob], 'mi-cartera-capitallab.png', { type: 'image/png' });
      // En el celular, si el navegador soporta compartir archivos nativos,
      // se ofrece directo — si no, simplemente se descarga la imagen.
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[archivo] })){
        try { await navigator.share({ files:[archivo], title:'Mi cartera en CapitalLab' }); return; } catch(e){ /* canceló, seguir con descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mi-cartera-capitallab.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
}

// Comparte un logro individual como imagen — reutiliza el mismo patrón
// de canvas de la tarjeta de cartera, con un formato pensado para una
// sola insignia en vez de todo el resumen financiero.
function compartirLogro(codigo){
  const l = CATALOGO_LOGROS[codigo];
  if(!l || !currentUser) return;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:380px;text-align:center;">
    <h3>Comparte tu logro</h3>
    <canvas id="lg-canvas" width="1080" height="1080" style="width:100%;max-width:300px;border-radius:12px;margin:10px auto;display:block;box-shadow:0 8px 24px rgba(0,0,0,.35);"></canvas>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-ghost" id="lg-cerrar" style="flex:1;">Cerrar</button>
      <button class="auth-submit" id="lg-descargar" style="flex:1;margin-top:0;"><i class="ti ti-download"></i> Descargar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#lg-cerrar').onclick = () => overlay.remove();

  const canvas = overlay.querySelector('#lg-canvas');
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,1080,1080);
  grad.addColorStop(0,'#10141D'); grad.addColorStop(1,'#0B0E14');
  ctx.fillStyle = grad; ctx.fillRect(0,0,1080,1080);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00C4FF'; ctx.font = 'bold 30px Arial';
  ctx.fillText('CAPITALLAB', 540, 90);

  ctx.fillStyle = 'rgba(212,175,55,.15)';
  ctx.beginPath(); ctx.arc(540, 420, 140, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(540, 420, 140, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#D4AF37'; ctx.font = '110px Arial';
  ctx.fillText('★', 540, 460);

  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 52px Arial';
  ctx.fillText(l.titulo, 540, 660);
  ctx.fillStyle = '#7A8AB0'; ctx.font = '28px Arial';
  ctx.fillText(l.desc, 540, 715);

  ctx.fillStyle = '#E8EDF8'; ctx.font = '30px Arial';
  ctx.fillText(currentUser.nombre, 540, 880);
  ctx.fillStyle = '#3D4D72'; ctx.font = '22px Arial';
  ctx.fillText('Simulador de mercados financieros · Universidad de Panamá', 540, 990);

  overlay.querySelector('#lg-descargar').onclick = () => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `logro-${codigo}-capitallab.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
}

function dibujarTarjetaCartera(canvas, datos){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // Fondo degradado navy, igual a la paleta del propio simulador
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#10141D'); grad.addColorStop(1,'#0B0E14');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#00C4FF';
  ctx.font = 'bold 34px Arial';
  ctx.fillText('CAPITALLAB', 60, 100);
  ctx.fillStyle = '#7A8AB0';
  ctx.font = '22px Arial';
  ctx.fillText(datos.sesion, 60, 140);

  ctx.fillStyle = '#E8EDF8';
  ctx.font = '26px Arial';
  ctx.fillText(datos.nombre, 60, 230);
  ctx.fillStyle = '#3D4D72';
  ctx.font = '20px Arial';
  ctx.fillText('Valor de mi cartera', 60, 280);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 76px Arial';
  ctx.fillText('$'+datos.valorTotal.toLocaleString('es-PA',{minimumFractionDigits:0,maximumFractionDigits:0}), 60, 370);

  const retPositivo = datos.retornoPct >= 0;
  ctx.fillStyle = retPositivo ? '#00D084' : '#FF4757';
  ctx.font = 'bold 46px Arial';
  ctx.fillText((retPositivo?'▲ +':'▼ ')+datos.retornoPct.toFixed(1)+'%', 60, 440);
  ctx.fillStyle = '#7A8AB0';
  ctx.font = '18px Arial';
  ctx.fillText('desde el capital inicial', 60, 470);

  // Línea separadora
  ctx.strokeStyle = '#242D42';
  ctx.beginPath(); ctx.moveTo(60,530); ctx.lineTo(W-60,530); ctx.stroke();

  ctx.fillStyle = '#7A8AB0';
  ctx.font = '22px Arial';
  ctx.fillText('MIS PRINCIPALES POSICIONES', 60, 590);

  let y = 650;
  if(datos.topPosiciones.length){
    datos.topPosiciones.forEach(p => {
      const valorPos = p.qty*(p.currentPrice||p.buyPrice);
      const gan = p.currentPrice >= p.buyPrice;
      ctx.fillStyle = '#1C2333';
      ctx.beginPath(); ctx.roundRect(60, y-40, W-120, 90, 12); ctx.fill();
      ctx.fillStyle = '#E8EDF8'; ctx.font = 'bold 26px Arial';
      ctx.fillText((p.name||'').substring(0,26), 90, y);
      ctx.fillStyle = gan ? '#00D084' : '#FF4757'; ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('$'+valorPos.toLocaleString('es-PA',{maximumFractionDigits:0}), W-90, y);
      ctx.textAlign = 'left';
      y += 120;
    });
  } else {
    ctx.fillStyle = '#3D4D72'; ctx.font = '22px Arial';
    ctx.fillText('Todavía sin posiciones abiertas', 60, y);
  }

  ctx.fillStyle = '#D4AF37';
  ctx.font = '20px Arial';
  ctx.fillText('Simulador de mercados financieros · Universidad de Panamá', 60, H-60);
}

// ══════════════════════════════════════════════════
// ENCUESTA RÁPIDA EN VIVO (Pulse Poll) — una sola pregunta, sin
// calificar, para pulso inmediato de la clase. Aparece como un aviso
// flotante a todos los conectados, y el docente ve los resultados
// actualizarse en tiempo real conforme responden.
// ══════════════════════════════════════════════════
let encuestaChannel = null;
let encuestaActivaActual = null;

function abrirLanzarEncuestaRapida(){
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:440px;">
    <h3>Encuesta rápida</h3>
    <div class="sub">Una pregunta, resultados en vivo, sin calificar a nadie.</div>
    <div class="grade-field"><label>Pregunta</label><input type="text" id="er-pregunta" placeholder='Ej. "¿Suben o bajan las tasas este trimestre?"'></div>
    <div class="grade-field"><label>Opciones</label>
      <input type="text" id="er-op-0" placeholder="Opción 1" style="margin-bottom:6px;">
      <input type="text" id="er-op-1" placeholder="Opción 2" style="margin-bottom:6px;">
      <input type="text" id="er-op-2" placeholder="Opción 3 (opcional)" style="margin-bottom:6px;">
      <input type="text" id="er-op-3" placeholder="Opción 4 (opcional)">
    </div>
    <div class="auth-msg" id="er-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="er-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="er-lanzar" style="flex:1;margin-top:0;">Lanzar a la clase</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#er-cancelar').onclick = () => overlay.remove();

  overlay.querySelector('#er-lanzar').onclick = async () => {
    const msg = overlay.querySelector('#er-msg');
    const pregunta = overlay.querySelector('#er-pregunta').value.trim();
    const opciones = [0,1,2,3].map(i=>overlay.querySelector('#er-op-'+i).value.trim()).filter(Boolean);
    if(!pregunta){ msg.className='auth-msg show error'; msg.textContent='Escribe la pregunta.'; return; }
    if(opciones.length<2){ msg.className='auth-msg show error'; msg.textContent='Necesitas al menos dos opciones.'; return; }
    const btn = overlay.querySelector('#er-lanzar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Lanzando…';
    try {
      // Se desactiva cualquier encuesta anterior de esta sesión, para que
      // nunca haya dos "en vivo" compitiendo por la atención de la clase.
      await sb.from('encuestas_rapidas').update({ activa:false }).eq('sesion_id', currentUser.sesion_id).eq('activa', true);
      const { error } = await conTiempoLimite(sb.from('encuestas_rapidas').insert({
        sesion_id: currentUser.sesion_id, docente_id: currentUser.auth_id, pregunta, opciones,
      }));
      if(error) throw error;
      overlay.remove();
      notify('Encuesta lanzada — la clase ya la puede ver.', 'success');
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo lanzar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Lanzar a la clase';
    }
  };
}

function iniciarEscuchaEncuestas(){
  if(!sb || !currentUser || !currentUser.sesion_id || guestMode || encuestaChannel) return;
  buscarEncuestaActiva();
  encuestaChannel = sb.channel('encuestas-'+currentUser.sesion_id)
    .on('postgres_changes', { event:'*', schema:'public', table:'encuestas_rapidas', filter:`sesion_id=eq.${currentUser.sesion_id}` }, () => buscarEncuestaActiva())
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'encuestas_respuestas' }, () => {
      if(encuestaActivaActual && document.getElementById('er-resultados-docente')) mostrarResultadosEncuesta(encuestaActivaActual.id);
    })
    .subscribe();
}
function detenerEscuchaEncuestas(){
  if(encuestaChannel && sb){ sb.removeChannel(encuestaChannel); encuestaChannel = null; }
}

async function buscarEncuestaActiva(){
  if(!currentUser || !currentUser.sesion_id) return;
  try {
    const { data } = await sb.from('encuestas_rapidas').select('*').eq('sesion_id', currentUser.sesion_id).eq('activa', true).order('creado_en',{ascending:false}).limit(1).maybeSingle();
    encuestaActivaActual = data || null;
    document.querySelectorAll('.encuesta-flotante').forEach(el=>el.remove());
    if(!encuestaActivaActual) return;
    if(currentUser.rol==='docente' || currentUser.rol==='superadmin'){
      mostrarResultadosEncuesta(encuestaActivaActual.id);
    } else {
      const { data: yaRespondi } = await sb.from('encuestas_respuestas').select('id').eq('encuesta_id', encuestaActivaActual.id).eq('usuario_id', currentUser.usuario_id).maybeSingle();
      if(!yaRespondi) mostrarAvisoEncuestaFlotante(encuestaActivaActual);
    }
  } catch(e){ /* silencioso */ }
}

function mostrarAvisoEncuestaFlotante(encuesta){
  const el = document.createElement('div');
  el.className = 'encuesta-flotante';
  el.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:4600;background:var(--c1);border:1px solid var(--accent2);border-radius:var(--r2);padding:14px 18px;max-width:92vw;width:380px;box-shadow:0 10px 30px rgba(0,0,0,.4);';
  el.innerHTML = `<div style="font-weight:700;font-size:13.5px;margin-bottom:10px;"><i class="ti ti-chart-pie" style="color:var(--accent2);"></i> ${escaparHTML(encuesta.pregunta)}</div>
    <div id="er-opciones-flotante"></div>`;
  document.body.appendChild(el);
  el.querySelector('#er-opciones-flotante').innerHTML = encuesta.opciones.map((op,i) =>
    `<button class="btn btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:6px;" onclick="responderEncuestaRapida('${encuesta.id}',${i})">${escaparHTML(op)}</button>`).join('');
}

async function responderEncuestaRapida(encuestaId, indice){
  try {
    const { error } = await sb.from('encuestas_respuestas').insert({ encuesta_id: encuestaId, usuario_id: currentUser.usuario_id, opcion_indice: indice });
    if(error) throw error;
    document.querySelectorAll('.encuesta-flotante').forEach(el=>el.remove());
    notify('Respuesta enviada.', 'success');
  } catch(e){ notify('No se pudo enviar tu respuesta: ' + (e.message||e), 'error'); }
}

async function mostrarResultadosEncuesta(encuestaId){
  const { data: encuesta } = await sb.from('encuestas_rapidas').select('*').eq('id', encuestaId).maybeSingle();
  if(!encuesta) return;
  const { data: respuestas } = await sb.from('encuestas_respuestas').select('opcion_indice').eq('encuesta_id', encuestaId);
  const conteos = encuesta.opciones.map((_,i) => (respuestas||[]).filter(r=>r.opcion_indice===i).length);
  const total = conteos.reduce((a,b)=>a+b,0);

  let el = document.getElementById('er-resultados-docente');
  if(!el){
    el = document.createElement('div');
    el.id = 'er-resultados-docente';
    el.className = 'encuesta-flotante';
    el.style.cssText = 'position:fixed;bottom:84px;right:16px;z-index:4600;background:var(--c1);border:1px solid var(--gold);border-radius:var(--r2);padding:14px 18px;max-width:92vw;width:340px;box-shadow:0 10px 30px rgba(0,0,0,.4);';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-weight:700;font-size:13px;"><i class="ti ti-chart-pie" style="color:var(--gold);"></i> ${escaparHTML(encuesta.pregunta)}</div>
      <i class="ti ti-x" style="cursor:pointer;color:var(--t3);" onclick="cerrarEncuestaDocente('${encuesta.id}')" title="Cerrar encuesta"></i>
    </div>
    ${encuesta.opciones.map((op,i) => {
      const pct = total ? Math.round(conteos[i]/total*100) : 0;
      return `<div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:2px;"><span>${escaparHTML(op)}</span><span class="mono">${conteos[i]} (${pct}%)</span></div>
        <div style="height:6px;background:var(--c3);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--gold);"></div></div>
      </div>`;
    }).join('')}
    <div style="font-size:10px;color:var(--t3);margin-top:6px;">${total} respuesta${total===1?'':'s'}</div>`;
}

async function cerrarEncuestaDocente(id){
  try {
    await sb.from('encuestas_rapidas').update({ activa:false }).eq('id', id);
    document.querySelectorAll('.encuesta-flotante').forEach(el=>el.remove());
    notify('Encuesta cerrada.', 'success');
  } catch(e){ notify('No se pudo cerrar: ' + (e.message||e), 'error'); }
}

function abrirCrearAlertaPrecio(){
  if(!selectedAsset){ notify('Selecciona un activo primero', 'error'); return; }
  if(!currentUser || guestMode){ notify('Las alertas de precio necesitan una cuenta real.', 'error'); return; }
  const precioActual = selectedAsset.currentPrice || selectedAsset.price;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:380px;">
    <h3>Alerta de precio</h3>
    <div class="sub">${selectedAsset.name} (${selectedAsset.ticker}) · precio actual $${fmt(precioActual)}</div>
    <div class="grade-field">
      <label>Avisarme cuando el precio…</label>
      <select id="ap-direccion">
        <option value="arriba">Suba hasta</option>
        <option value="abajo">Baje hasta</option>
      </select>
    </div>
    <div class="grade-field"><label>Precio objetivo ($)</label><input type="number" id="ap-precio" step="0.01" value="${(precioActual*1.05).toFixed(2)}"></div>
    <div id="ap-lista-existentes" style="margin-bottom:10px;"></div>
    <div class="auth-msg" id="ap-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="ap-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="ap-guardar" style="flex:1;margin-top:0;">Crear alerta</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#ap-cancelar').onclick = () => overlay.remove();

  (async () => {
    const alertas = await cargarAlertasPrecio();
    const delActivo = alertas.filter(a => a.activo_id===selectedAsset.id && a.activo_tipo===selectedAsset.type);
    const cont = overlay.querySelector('#ap-lista-existentes');
    if(delActivo.length){
      cont.innerHTML = `<div style="font-size:11px;color:var(--t3);text-transform:uppercase;margin-bottom:6px;">Alertas activas en este activo</div>` +
        delActivo.map(a => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">
          <span>${a.direccion==='arriba'?'Sube hasta':'Baja hasta'} $${fmt(a.precio_objetivo)}</span>
          <button class="btn btn-sm" style="padding:2px 7px;color:var(--red);" onclick="borrarAlertaPrecio('${a.id}')"><i class="ti ti-trash" style="font-size:11px;"></i></button>
        </div>`).join('');
    }
  })();

  overlay.querySelector('#ap-guardar').onclick = async () => {
    const msg = overlay.querySelector('#ap-msg');
    const direccion = overlay.querySelector('#ap-direccion').value;
    const precioObjetivo = +overlay.querySelector('#ap-precio').value;
    if(!precioObjetivo || precioObjetivo<=0){ msg.className='auth-msg show error'; msg.textContent='Ingresa un precio válido.'; return; }
    const btn = overlay.querySelector('#ap-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Creando…';
    try {
      const { error } = await conTiempoLimite(sb.from('alertas_precio').insert({
        usuario_id: currentUser.usuario_id, sesion_id: currentUser.sesion_id,
        activo_id: selectedAsset.id, activo_nombre: selectedAsset.name, activo_tipo: selectedAsset.type,
        precio_objetivo: precioObjetivo, direccion,
      }));
      if(error) throw error;
      await cargarAlertasPrecio(true);
      overlay.remove();
      notify('Alerta creada.', 'success');
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo crear: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Crear alerta';
    }
  };
}

async function borrarAlertaPrecio(id){
  try {
    await sb.from('alertas_precio').delete().eq('id', id);
    await cargarAlertasPrecio(true);
    notify('Alerta borrada.', 'success');
    document.querySelectorAll('.grade-modal-overlay').forEach(o=>o.remove());
  } catch(e){ notify('No se pudo borrar: ' + (e.message||e), 'error'); }
}

// Revisa todas las alertas activas contra los precios actuales del
// mercado; si alguna se cruza, la marca disparada y avisa al instante.
async function verificarAlertasPrecio(){
  if(!currentUser || !currentUser.usuario_id || guestMode || !sb) return;
  const alertas = await cargarAlertasPrecio();
  if(!alertas.length) return;
  const activos = allAssets();
  for(const a of alertas){
    const activo = activos.find(x => x.id===a.activo_id && x.type===a.activo_tipo);
    if(!activo) continue;
    const precioActual = activo.currentPrice || activo.price;
    const cruzada = a.direccion==='arriba' ? precioActual >= a.precio_objetivo : precioActual <= a.precio_objetivo;
    if(!cruzada) continue;
    try {
      await sb.from('alertas_precio').update({ activa: false, disparada_en: new Date().toISOString() }).eq('id', a.id);
      alertasPrecioCache = alertasPrecioCache.filter(x=>x.id!==a.id);
      notify(`🔔 ${a.activo_nombre} ${a.direccion==='arriba'?'subió hasta':'bajó hasta'} $${fmt(precioActual)}`, 'success');
      enviarNotificacionNativa('Alerta de precio — CapitalLab', `${a.activo_nombre} ${a.direccion==='arriba'?'subió hasta':'bajó hasta'} $${fmt(precioActual)}`);
      actualizarBadgeNotificaciones();
    } catch(e){ /* silencioso: no interrumpir el mercado por esto */ }
  }
}

function confirmarYEjecutar(op){
  if(!selectedAsset){ notify('Selecciona un activo primero','error'); return; }
  const qty = +document.getElementById('trade-qty').value;
  if(qty<=0){ notify('Ingresa una cantidad válida','error'); return; }

  const mid = selectedAsset.currentPrice || selectedAsset.price;
  const px = execPrice(mid, selectedAsset.type, op);
  const gross = qty*px;
  const fee = commissionFor(gross);
  const total = op==='buy' ? gross+fee : gross-fee;

  // CUÁL ES MI RIESGO — el nivel de riesgo real del activo, en
  // lenguaje simple, no solo el número de volatilidad aislado.
  const sigma = selectedAsset.sigma || 0;
  const nivelRiesgo = sigma<15 ? 'Bajo' : sigma<30 ? 'Moderado' : 'Alto';
  const colorRiesgo = sigma<15 ? 'var(--green, #1e8e5a)' : sigma<30 ? 'var(--amber, #ffb400)' : 'var(--red, #ff4757)';

  // QUÉ PASARÁ SI SE EJECUTA — distinto según sea compra o venta,
  // siempre con los números reales de ESTE estudiante, nunca genéricos.
  let queVaAPasar;
  if(op==='buy'){
    const pctDelCapital = capital>0 ? (total/capital*100) : 0;
    const posActual = portfolio.find(p=>p.id===selectedAsset.id && p.type===selectedAsset.type);
    const valorTotalCarteraActual = portfolio.reduce((s,p)=>s+((p.currentPrice||p.buyPrice)*p.qty),0);
    const valorEnEsteActivoDespues = ((posActual?posActual.qty*(posActual.currentPrice||posActual.buyPrice):0)) + gross;
    const pctDeLaCarteraDespues = (valorTotalCarteraActual+gross)>0 ? (valorEnEsteActivoDespues/(valorTotalCarteraActual+gross)*100) : 100;
    queVaAPasar = `Usarás <b>${pctDelCapital.toFixed(1)}%</b> de tu capital disponible. Después de esta compra, ${selectedAsset.ticker} representará aproximadamente <b>${pctDeLaCarteraDespues.toFixed(1)}%</b> del valor total de tu cartera.`;
  } else {
    const posActual = portfolio.find(p=>p.id===selectedAsset.id && p.type===selectedAsset.type);
    const pctDeLaPosicion = posActual && posActual.qty>0 ? (qty/posActual.qty*100) : 0;
    const gananciaOPerdida = posActual ? (px-posActual.buyPrice)*qty : 0;
    queVaAPasar = `Estás vendiendo el <b>${pctDeLaPosicion.toFixed(0)}%</b> de tu posición en ${selectedAsset.ticker}. Esta venta ${gananciaOPerdida>=0?'realiza una ganancia de':'realiza una pérdida de'} <b class="${gananciaOPerdida>=0?'g':'r'}">${gananciaOPerdida>=0?'+':'-'}$${fmt(Math.abs(gananciaOPerdida))}</b> frente a tu precio de compra.`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:420px;">
    <h3>${op==='buy'?'Confirmar compra':'Confirmar venta'}</h3>
    <div class="sub">Estás a punto de ${op==='buy'?'comprar':'vender'} ${qty} unidades de ${selectedAsset.name} (${selectedAsset.ticker}) a $${fmt(px)} cada una.</div>
    <div style="background:var(--c2);border-radius:var(--r);padding:14px;margin:14px 0;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Cantidad</span><span>${qty}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Precio de ejecución</span><span>$${fmt(px)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Subtotal</span><span>$${fmt(gross)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Comisión</span><span>$${fmt(fee)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:6px;border-top:1px solid var(--c4);font-size:14.5px;font-weight:700;"><span>${op==='buy'?'Total a pagar':'Total a recibir'}</span><span>$${fmt(total)}</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px;"><i class="ti ti-gauge" style="color:${colorRiesgo};"></i> <span style="color:var(--t3);">Riesgo de este activo:</span> <b style="color:${colorRiesgo};">${nivelRiesgo}</b> <span style="color:var(--t3);">(volatilidad anual ${sigma.toFixed(1)}%)</span></div>
    <div style="font-size:12px;color:var(--t2);line-height:1.5;background:rgba(255,255,255,.03);border-radius:8px;padding:10px 12px;margin-bottom:14px;"><i class="ti ti-info-circle" style="color:var(--accent2, #4a9eff);"></i> ${queVaAPasar}</div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="cf-cancelar" style="flex:1;">Cancelar</button>
      <button class="${op==='buy'?'btn btn-buy':'btn btn-sell'}" id="cf-confirmar" style="flex:1;">Confirmar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  overlay.querySelector('#cf-cancelar').onclick = () => overlay.remove();
  overlay.querySelector('#cf-confirmar').onclick = () => {
    overlay.remove();
    const snapshot = tomarSnapshotEstado();
    executeDirect(op);
    mostrarDeshacerToast(snapshot, `${op==='buy'?'Compra':'Venta'} de ${qty}u ${selectedAsset.ticker} realizada.`);
  };
}

// ── Deshacer una operación reciente ──
// No toca nada de la lógica de compra/venta en sí: solo guarda una foto
// del estado justo antes de operar, y si el estudiante toca "Deshacer" a
// tiempo, restaura esa foto tal cual. Cero riesgo para el motor de trading.
function tomarSnapshotEstado(){
  return { capital, portfolio: JSON.parse(JSON.stringify(portfolio)), txHistory: JSON.parse(JSON.stringify(txHistory)) };
}
function restaurarSnapshotEstado(snap){
  capital = snap.capital; portfolio = snap.portfolio; txHistory = snap.txHistory;
  updateNavCapital();
  if(typeof renderPortfolio==='function') renderPortfolio();
  if(typeof updateTradeCalc==='function') updateTradeCalc();
  autosave();
}
function mostrarDeshacerToast(snapshot, mensaje){
  document.querySelectorAll('.deshacer-toast').forEach(t=>t.remove());
  const el = document.createElement('div');
  el.className = 'deshacer-toast';
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:4500;background:var(--c1);border:1px solid var(--c4);border-radius:var(--r2);padding:12px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:90vw;';
  el.innerHTML = `<span style="font-size:12.5px;white-space:nowrap;">${mensaje}</span><button class="btn btn-sm" id="deshacer-btn" style="flex-shrink:0;">Deshacer</button>`;
  document.body.appendChild(el);
  const timeoutId = setTimeout(()=>el.remove(), 8000);
  el.querySelector('#deshacer-btn').onclick = () => {
    clearTimeout(timeoutId);
    restaurarSnapshotEstado(snapshot);
    notify('Operación deshecha.', 'success');
    el.remove();
  };
}

function executeDirect(op){
  if(!selectedAsset){notify('Selecciona un activo primero','error');return;}
  const qty=+document.getElementById('trade-qty').value;
  if(qty<=0){notify('Ingresa una cantidad válida','error');return;}
  const mid=selectedAsset.currentPrice||selectedAsset.price;      // precio medio de mercado
  const px =execPrice(mid, selectedAsset.type, op);               // precio efectivo (cruza el spread)
  const gross=qty*px;                                            // valor bruto a precio de ejecución
  const fee=commissionFor(gross);                                // comisión de corretaje
  if(op==='buy'){
    const cashOut = gross + fee;                                 // efectivo total que sale (incluye costos)
    // SERIE 5: Allow leveraged buying — balance can go negative (margin trading).
    // El límite de margen se deriva de INITIAL_CAPITAL y MARGIN_RATIO (constantes globales).
    if(capital - cashOut < MARGIN_LIMIT){
      notify('Límite de margen alcanzado. No puedes apalancarte más allá de $'+fmt(MARGIN_LIMIT),'error');
      return;
    }
    if(cashOut > capital && capital >= 0){
      notify(`⚠ Compra apalancada: tu balance quedará en negativo ($${fmt(capital-cashOut)})`,'error');
    }
    capital-=cashOut;
    const ex=portfolio.find(x=>x.id===selectedAsset.id&&x.type===selectedAsset.type);
    // El costo base de la posición incluye comisión (criterio contable: costo de adquisición).
    if(ex){ex.qty+=qty;ex.invested+=cashOut;ex.currentPrice=mid;}
    else portfolio.push({...selectedAsset,qty,invested:cashOut,buyPrice:gross/qty,currentPrice:mid});
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:selectedAsset.name,type:selectedAsset.type,qty,price:px,total:gross,fee:+fee.toFixed(2)});
    notify(`Compra de ${qty}u ${selectedAsset.ticker} · costo $${fmt(fee)} ✓`);
    autosave();
    mostrarPromptDiarioTrading('Compra', selectedAsset.name);
  } else {
    const pos=portfolio.find(x=>x.id===selectedAsset.id&&x.type===selectedAsset.type);
    if(!pos||pos.qty<qty){notify('No tienes suficientes unidades','error');return;}
    const cashIn = gross - fee;                                  // efectivo neto que entra (descuenta costos)
    pos.qty-=qty;
    capital+=cashIn;
    if(pos.qty===0)portfolio=portfolio.filter(x=>!(x.id===selectedAsset.id&&x.type===selectedAsset.type));
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:selectedAsset.name,type:selectedAsset.type,qty,price:px,total:gross,fee:+fee.toFixed(2)});
    notify(`Venta de ${qty}u ${selectedAsset.ticker} · costo $${fmt(fee)} ✓`);
    autosave();
    mostrarPromptDiarioTrading('Venta', selectedAsset.name);
  }
  updateNavCapital();
  updateTradeCalc();
}

// ── ÓRDENES PENDIENTES (límite / stop-loss) ──
// Ejecuta una compra/venta para un activo dado, a partir de un precio medio (sin depender del DOM).
// Reutiliza la microestructura: cruza el spread y cobra comisión.
function executeOrderAt(asset, side, qty){
  const mid = asset.currentPrice || asset.price;
  const px  = execPrice(mid, asset.type, side);
  const gross = qty * px;
  const fee = commissionFor(gross);
  if (side === 'buy'){
    const cashOut = gross + fee;
    if (capital - cashOut < MARGIN_LIMIT) return false;   // respeta el límite de margen
    capital -= cashOut;
    const ex = portfolio.find(x=>x.id===asset.id && x.type===asset.type);
    if (ex){ ex.qty+=qty; ex.invested+=cashOut; ex.currentPrice=mid; }
    else portfolio.push({...asset, qty, invested:cashOut, buyPrice:gross/qty, currentPrice:mid});
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:asset.name,type:asset.type,qty,price:px,total:gross,fee:+fee.toFixed(2)});
  } else {
    const pos = portfolio.find(x=>x.id===asset.id && x.type===asset.type);
    if (!pos || pos.qty < qty) return false;              // sin unidades suficientes
    const cashIn = gross - fee;
    pos.qty -= qty;
    capital += cashIn;
    if (pos.qty === 0) portfolio = portfolio.filter(x=>!(x.id===asset.id && x.type===asset.type));
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:asset.name,type:asset.type,qty,price:px,total:gross,fee:+fee.toFixed(2)});
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// STOP LOSS Y TAKE PROFIT — cada uno muestra en vivo, mientras el
// estudiante escribe, exactamente qué va a pasar si el precio llega
// ahí: la pérdida o ganancia potencial en dólares reales, y el
// porcentaje de riesgo o retorno esperado, en vez de solo un campo de
// número aislado sin ningún contexto. Reutilizan el mismo motor de
// órdenes pendientes que ya existía (mismo "kind", mismo "trigger"),
// así que la ejecución real no cambia en absoluto, solo la claridad
// pedagógica de cómo se presenta antes de colocarla.
// ═══════════════════════════════════════════════════════════════════
function calcularStopLoss(){
  const resultado = document.getElementById('sl-resultado');
  if(!selectedAsset){ resultado.style.display='none'; return; }
  const precioSalida = +document.getElementById('sl-precio').value;
  const precioActual = selectedAsset.currentPrice || selectedAsset.price;
  const qty = +document.getElementById('trade-qty').value || 0;
  if(!precioSalida || precioSalida<=0 || !qty){ resultado.style.display='none'; return; }
  const perdidaPct = ((precioSalida-precioActual)/precioActual)*100;
  const perdidaMonto = (precioSalida-precioActual)*qty;
  resultado.style.display = 'block';
  document.getElementById('sl-precio-actual').textContent = '$'+fmt(precioActual);
  document.getElementById('sl-precio-destino').textContent = '$'+fmt(precioSalida);
  document.getElementById('sl-perdida').textContent = (perdidaMonto>=0?'+':'-')+'$'+fmt(Math.abs(perdidaMonto));
  document.getElementById('sl-pct').textContent = Math.abs(perdidaPct).toFixed(1)+'%';
  // Aviso si el precio de salida está por ENCIMA del actual — un stop
  // loss así no protege nada, es una confusión común de quien recién
  // empieza a usarlo, y vale la pena señalarlo antes de que lo coloque.
  const avisoIncoherente = document.getElementById('sl-aviso-incoherente');
  if(precioSalida >= precioActual){
    if(!avisoIncoherente){
      const div = document.createElement('div');
      div.id = 'sl-aviso-incoherente';
      div.style.cssText = 'font-size:10.5px;color:var(--red, #ff4757);margin-top:5px;';
      div.innerHTML = '<i class="ti ti-alert-triangle"></i> Un stop loss normalmente se coloca por debajo del precio actual, para vender si el precio cae.';
      resultado.parentElement.insertBefore(div, resultado.nextSibling);
    }
  } else if(avisoIncoherente){ avisoIncoherente.remove(); }
}

function calcularTakeProfit(){
  const resultado = document.getElementById('tp-resultado');
  if(!selectedAsset){ resultado.style.display='none'; return; }
  const precioSalida = +document.getElementById('tp-precio').value;
  const precioActual = selectedAsset.currentPrice || selectedAsset.price;
  const qty = +document.getElementById('trade-qty').value || 0;
  if(!precioSalida || precioSalida<=0 || !qty){ resultado.style.display='none'; return; }
  const gananciaPct = ((precioSalida-precioActual)/precioActual)*100;
  const gananciaMonto = (precioSalida-precioActual)*qty;
  resultado.style.display = 'block';
  document.getElementById('tp-precio-actual').textContent = '$'+fmt(precioActual);
  document.getElementById('tp-precio-destino').textContent = '$'+fmt(precioSalida);
  document.getElementById('tp-ganancia').textContent = (gananciaMonto>=0?'+':'-')+'$'+fmt(Math.abs(gananciaMonto));
  document.getElementById('tp-pct').textContent = Math.abs(gananciaPct).toFixed(1)+'%';
}

function placeStopLoss(){
  if(!selectedAsset){ notify('Selecciona un activo primero','error'); return; }
  const qty = +document.getElementById('trade-qty').value;
  if(qty<=0){ notify('Ingresa una cantidad válida','error'); return; }
  const trigger = +document.getElementById('sl-precio').value;
  if(!trigger || trigger<=0){ notify('Ingresa el precio de salida del stop loss','error'); return; }
  const pos = portfolio.find(x=>x.id===selectedAsset.id && x.type===selectedAsset.type);
  if(!pos || pos.qty<qty){ notify('No tienes unidades suficientes de este activo para protegerlas con un stop loss','error'); return; }
  pendingOrders.push({ id: Date.now()+Math.random(), assetId:selectedAsset.id, type:selectedAsset.type, ticker:selectedAsset.ticker, name:selectedAsset.name, kind:'stop-loss', side:'sell', qty, trigger });
  notify(`Stop loss colocado: se venderán ${qty}u de ${selectedAsset.ticker} si el precio cae a $${fmt(trigger)} ✓`);
  document.getElementById('sl-precio').value = '';
  document.getElementById('sl-resultado').style.display = 'none';
  renderOrderList();
  autosave();
}

function placeTakeProfit(){
  if(!selectedAsset){ notify('Selecciona un activo primero','error'); return; }
  const qty = +document.getElementById('trade-qty').value;
  if(qty<=0){ notify('Ingresa una cantidad válida','error'); return; }
  const trigger = +document.getElementById('tp-precio').value;
  if(!trigger || trigger<=0){ notify('Ingresa el precio de salida del take profit','error'); return; }
  const pos = portfolio.find(x=>x.id===selectedAsset.id && x.type===selectedAsset.type);
  if(!pos || pos.qty<qty){ notify('No tienes unidades suficientes de este activo para asegurar una ganancia con un take profit','error'); return; }
  pendingOrders.push({ id: Date.now()+Math.random(), assetId:selectedAsset.id, type:selectedAsset.type, ticker:selectedAsset.ticker, name:selectedAsset.name, kind:'limit-sell', side:'sell', qty, trigger });
  notify(`Take profit colocado: se venderán ${qty}u de ${selectedAsset.ticker} si el precio sube a $${fmt(trigger)} ✓`);
  document.getElementById('tp-precio').value = '';
  document.getElementById('tp-resultado').style.display = 'none';
  renderOrderList();
  autosave();
}

function placePendingOrder(){
  // Ahora solo maneja la orden límite de compra — stop loss y take
  // profit tienen sus propias funciones dedicadas (placeStopLoss,
  // placeTakeProfit), con su propio tratamiento pedagógico.
  if(!selectedAsset){notify('Selecciona un activo primero','error');return;}
  const qty=+document.getElementById('trade-qty').value;
  if(qty<=0){notify('Ingresa una cantidad válida','error');return;}
  const kind='limit-buy';
  const trigger=+document.getElementById('order-trigger').value;
  if(!trigger||trigger<=0){notify('Ingresa un precio de activación válido','error');return;}
  const side = 'buy';
  pendingOrders.push({
    id: Date.now()+Math.random(),
    assetId: selectedAsset.id, type: selectedAsset.type,
    ticker: selectedAsset.ticker, name: selectedAsset.name,
    kind, side, qty, trigger,
  });
  notify(`Orden ${kindLabel(kind)} colocada: ${qty}u de ${selectedAsset.ticker} @ $${fmt(trigger)} ✓`);
  document.getElementById('order-trigger').value='';
  renderOrderList();
  autosave();
}

function kindLabel(kind){
  return kind==='limit-buy'?'límite de compra':kind==='limit-sell'?'take profit':'stop loss';
}

function cancelOrder(id){
  pendingOrders = pendingOrders.filter(o=>o.id!==id);
  renderOrderList();
  notify('Orden cancelada');
  autosave();
}

function renderOrderList(){
  const el=document.getElementById('order-list');
  if(!el)return;
  // Muestra solo las órdenes del activo seleccionado (o todas si no hay selección).
  const list = selectedAsset ? pendingOrders.filter(o=>o.assetId===selectedAsset.id&&o.type===selectedAsset.type) : pendingOrders;
  if(list.length===0){el.innerHTML='';return;}
  el.innerHTML=list.map(o=>`<div class="tp-order-item">
    <span><b style="color:var(--accent2);">${o.ticker}</b> · ${kindLabel(o.kind)} · ${o.qty}u @ $${fmt(o.trigger)}</span>
    <button class="o-cancel" onclick="cancelOrder(${o.id})" title="Cancelar">✕</button>
  </div>`).join('');
}

// Evalúa las órdenes pendientes en cada tick y ejecuta las que cruzan su nivel de activación.
function checkPendingOrders(){
  if(pendingOrders.length===0)return;
  const remaining=[];
  let executed=false;
  for(const o of pendingOrders){
    const asset=allAssets().find(a=>a.id===o.assetId&&a.type===o.type);
    if(!asset){remaining.push(o);continue;}
    const price=asset.currentPrice||asset.price;
    let fire=false;
    if(o.kind==='limit-buy'  && price<=o.trigger) fire=true;   // compra cuando baja al nivel
    if(o.kind==='limit-sell' && price>=o.trigger) fire=true;   // venta/TP cuando sube al nivel
    if(o.kind==='stop-loss'  && price<=o.trigger) fire=true;   // stop cuando cae al nivel
    if(fire){
      const okExec=executeOrderAt(asset, o.side, o.qty);
      if(okExec){
        executed=true;
        const now=new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        newsFeed.unshift({id:Date.now()+Math.random(),time:now,
          headline:`✓ Orden ejecutada: ${kindLabel(o.kind)} de ${o.ticker}`,
          body:`Tu orden ${kindLabel(o.kind)} de ${o.qty}u de ${o.name} se activó al alcanzar el precio de $${fmt(o.trigger)} (precio de mercado: $${fmt(price)}).`,
          type:o.side==='buy'?'bull':'bear',ticker:o.ticker,movePct:0,unread:true});
        newsUnreadCount++; if(newsFeed.length>40)newsFeed.pop();
        notify(`✓ Orden ${kindLabel(o.kind)} ejecutada: ${o.qty}u ${o.ticker} @ ~$${fmt(price)}`);
      } else {
        remaining.push(o);   // no se pudo ejecutar (margen/unidades): se mantiene pendiente
      }
    } else {
      remaining.push(o);
    }
  }
  pendingOrders=remaining;
  if(executed){
    updateNavCapital();
    renderNewsFeed();
    renderOrderList();
    autosave();
  }
}

// ═══════════════════ ANALYSIS ═══════════════════
let anCurrentClass='accion';
let anSelectedId=null;

function populateAnalysisSelect(){
  // Inicializa la navegación por clase de activo (reemplaza el selector largo).
  if(!anSelectedId) renderAnalysisGrid();
  if(anCurrentClass==='accion') renderMapaCalorSectorial();
}

function setAnalysisClass(cls, btn){
  anCurrentClass=cls;
  document.querySelectorAll('.an-class-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const s=document.getElementById('an-asset-search'); if(s)s.value='';
  const heatmapCard = document.getElementById('an-sector-heatmap-card');
  if(heatmapCard) heatmapCard.style.display = cls==='accion' ? '' : 'none';
  if(cls==='accion') renderMapaCalorSectorial();
  renderAnalysisGrid();
}

// Agrupa las acciones por sector y muestra el rendimiento esperado
// promedio de cada uno, coloreado — para responder de un vistazo
// "¿qué sector le está yendo mejor ahora mismo?" sin tener que entrar
// activo por activo.
function renderMapaCalorSectorial(){
  const cont = document.getElementById('an-sector-heatmap');
  if(!cont) return;
  const porSector = {};
  STOCKS.forEach(a => {
    const s = a.sector || 'Otro';
    if(!porSector[s]) porSector[s] = [];
    porSector[s].push(a);
  });
  const sectores = Object.entries(porSector).map(([sector, activos]) => ({
    sector,
    n: activos.length,
    retProm: activos.reduce((sum,a)=>sum+a.ret,0)/activos.length,
    sigmaProm: activos.reduce((sum,a)=>sum+a.sigma,0)/activos.length,
  })).sort((a,b)=>b.retProm-a.retProm);
  cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;">
    ${sectores.map(s => {
      const positivo = s.retProm>=0;
      const colorAcento = positivo ? 'var(--green)' : 'var(--red)';
      // El fondo se queda siempre en un tinte suave, sin importar qué tan
      // fuerte sea el rendimiento — así nunca compite en contraste con el
      // texto. La intensidad del sector se ve en el número y el borde, no
      // en volver el fondo casi del mismo color que la letra.
      const fondo = positivo ? 'rgba(0,208,132,.08)' : 'rgba(255,71,87,.08)';
      return `<div style="background:${fondo};border:1px solid ${colorAcento};border-radius:var(--r);padding:12px;cursor:pointer;" onclick="document.getElementById('an-asset-search').value='';filtrarPorSector('${s.sector.replace(/'/g,"\\'")}')" title="Filtrar por ${s.sector}">
        <div style="font-size:12.5px;font-weight:600;color:var(--t1);">${s.sector}</div>
        <div style="font-size:19px;font-weight:700;color:#FFFFFF;margin-top:4px;">${positivo?'▲':'▼'} <span style="color:${colorAcento};">${positivo?'+':''}${s.retProm.toFixed(1)}%</span></div>
        <div style="font-size:10.5px;color:var(--t3);margin-top:4px;">${s.n} activo${s.n===1?'':'s'} · σ ${s.sigmaProm.toFixed(1)}%</div>
      </div>`;
    }).join('')}
  </div>`;
}

function filtrarPorSector(sector){
  const buscador = document.getElementById('an-asset-search');
  if(buscador){ buscador.value = sector; renderAnalysisGrid(); buscador.scrollIntoView({behavior:'smooth', block:'center'}); }
}

function assetsByClass(cls){
  const map={accion:STOCKS,bono:BONDS,divisa:FOREX,futuro:FUTURES,derivado:DERIVATIVES};
  return (map[cls]||[]).slice();
}

// ══════════════════════════════════════════════════
// COMPARADOR DE ACTIVOS — ver dos activos, de cualquier clase, lado a
// lado con sus métricas clave. Pensado para una vista ejecutiva rápida:
// "¿cuál de estos dos me conviene más?", sin tener que ir y volver entre
// dos pantallas de Análisis por separado.
// ══════════════════════════════════════════════════
function abrirComparadorActivos(){
  const activoA = allAssets().find(a=>a.id===anSelectedId);
  if(!activoA){ notify('Selecciona primero un activo en Análisis.', 'error'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:520px;">
    <h3>Comparar activos</h3>
    <div class="sub">${activoA.name} contra el activo que elijas, de cualquier clase.</div>
    <div class="grade-field">
      <label>Comparar con</label>
      <input type="text" id="cmp-buscar" placeholder="Busca por nombre o ticker…" autocomplete="off">
      <div id="cmp-resultados" style="max-height:180px;overflow-y:auto;margin-top:6px;"></div>
    </div>
    <div id="cmp-tabla"><div class="auth-hint" style="text-align:center;padding:14px;">Busca un activo arriba para ver la comparación.</div></div>
    <button class="btn btn-ghost" id="cmp-cerrar" style="width:100%;margin-top:12px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cmp-cerrar').onclick = () => overlay.remove();
  setTimeout(()=>overlay.querySelector('#cmp-buscar')?.focus(), 150);

  overlay.querySelector('#cmp-buscar').oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    const cont = overlay.querySelector('#cmp-resultados');
    if(!q){ cont.innerHTML=''; return; }
    const resultados = allAssets().filter(a => a.id!==activoA.id && (a.name.toLowerCase().includes(q) || (a.ticker||'').toLowerCase().includes(q))).slice(0,8);
    cont.innerHTML = resultados.map(a => `<div class="cmdk-item" style="cursor:pointer;" onclick="renderComparadorTabla('${activoA.id}','${a.id}')"><i class="ti ti-chart-line"></i><span>${a.name}</span> <span class="badge ${typeBadgeCls(a.type)}" style="font-size:8px;">${a.type}</span></div>`).join('');
  };
}

function renderComparadorTabla(idA, idB){
  const a = allAssets().find(x=>x.id===idA);
  const b = allAssets().find(x=>x.id===idB);
  const cont = document.querySelector('#cmp-tabla');
  const buscador = document.querySelector('#cmp-buscar');
  const resultados = document.querySelector('#cmp-resultados');
  if(!a || !b || !cont) return;
  if(buscador) buscador.value = b.name;
  if(resultados) resultados.innerHTML = '';
  const sharpeOf = x => (x.sigma>0 ? (x.ret/x.sigma).toFixed(2) : '—');
  const filas = [
    ['Clase', x=>x.type, false],
    ['Precio actual', x=>'$'+(x.currentPrice||x.price).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}), false],
    ['Rendimiento esperado', x=>(x.ret||0).toFixed(1)+'%', true],
    ['Riesgo (σ)', x=>(x.sigma||0).toFixed(1)+'%', false],
    ['Ratio Sharpe (aprox.)', x=>sharpeOf(x), true],
    ['Calificación', x=>x.rating||'—', false],
    ['País / Región', x=>x.country||'—', false],
  ];
  cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
    <thead><tr>
      <th style="text-align:left;padding:6px;color:var(--t3);">Indicador</th>
      <th style="text-align:right;padding:6px;">${a.name}</th>
      <th style="text-align:right;padding:6px;">${b.name}</th>
    </tr></thead>
    <tbody>
      ${filas.map(([label, fn, mayorEsMejor]) => {
        const va = fn(a), vb = fn(b);
        let colA = '', colB = '';
        if(mayorEsMejor && !isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))){
          const na = parseFloat(va), nb = parseFloat(vb);
          colA = na>nb ? 'color:var(--green);font-weight:600;' : na<nb ? 'color:var(--red);' : '';
          colB = nb>na ? 'color:var(--green);font-weight:600;' : nb<na ? 'color:var(--red);' : '';
        }
        return `<tr style="border-top:1px solid var(--c3);">
          <td style="padding:6px;color:var(--t2);">${label}</td>
          <td class="mono" style="padding:6px;text-align:right;${colA}">${va}</td>
          <td class="mono" style="padding:6px;text-align:right;${colB}">${vb}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// Favoritos de Análisis — se guardan en este mismo navegador (no en la
// nube, es una preferencia personal de quién está mirando el simulador
// en ese momento) para poder marcar rápido los activos de interés antes
// de una demostración y filtrarlos con un clic.
let favoritosAnalisis = new Set(JSON.parse(localStorage.getItem('capitallab_favoritos_analisis')||'[]'));
function alternarFavoritoAnalisis(id){
  if(favoritosAnalisis.has(id)) favoritosAnalisis.delete(id);
  else favoritosAnalisis.add(id);
  localStorage.setItem('capitallab_favoritos_analisis', JSON.stringify([...favoritosAnalisis]));
  renderAnalysisGrid();
}

function colorSector(sector){
  if(!sector) return 'var(--t3)';
  const colores = ['#00C4FF','#D4AF37','#00D084','#FF7A45','#9C6ADE','#FF4757','#4A9DFF','#E0C341'];
  let hash = 0;
  for(let i=0;i<sector.length;i++) hash = sector.charCodeAt(i) + ((hash<<5)-hash);
  return colores[Math.abs(hash) % colores.length];
}

// Copia un resumen en texto plano del activo seleccionado — pensado para
// pegar directo en una diapositiva, un correo, o un chat, sin tener que
// transcribir los números a mano.
function copiarResumenActivo(){
  const a = allAssets().find(x=>x.id===anSelectedId);
  if(!a){ notify('Selecciona primero un activo.', 'error'); return; }
  const p = a.currentPrice||a.price;
  const texto = `${a.name} (${a.ticker})\nPrecio actual: $${p.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2})}\nRendimiento esperado: ${a.ret.toFixed(1)}%\nRiesgo (σ): ${a.sigma.toFixed(1)}%\nCalificación: ${a.rating||'—'}\nPaís / Región: ${a.country||'—'}`;
  navigator.clipboard?.writeText(texto).then(
    () => notify('Resumen copiado al portapapeles.', 'success'),
    () => notify('No se pudo copiar.', 'error')
  );
}

function renderAnalysisGrid(){
  const grid=document.getElementById('an-asset-grid');
  if(!grid)return;
  const q=(document.getElementById('an-asset-search')||{value:''}).value.toLowerCase();
  let items=assetsByClass(anCurrentClass).filter(a=>!q||a.name.toLowerCase().includes(q)||a.ticker.toLowerCase().includes(q)||(a.country||'').toLowerCase().includes(q)||(a.sector||'').toLowerCase().includes(q));
  const soloFav = document.getElementById('an-solo-favoritos')?.checked;
  if(soloFav) items = items.filter(a => favoritosAnalisis.has(a.id));
  const orden = (document.getElementById('an-asset-orden')||{value:'nombre'}).value;
  if(orden==='rendimiento') items = [...items].sort((a,b)=>(b.ret||0)-(a.ret||0));
  else if(orden==='riesgo') items = [...items].sort((a,b)=>(a.sigma||0)-(b.sigma||0));
  else if(orden==='cambio') items = [...items].sort((a,b)=>(b.change||0)-(a.change||0));
  else items = [...items].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  if(items.length===0){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px;font-size:12px;color:var(--t3);">'+(soloFav?'No tienes ningún favorito marcado todavía.':'Sin activos en esta clase')+'</div>';return;}
  grid.innerHTML=items.map(a=>{
    const p=a.currentPrice||a.price;
    const chg=a.change||0;
    const sel=a.id===anSelectedId?'selected':'';
    const pStr=a.type==='divisa'&&p>100?p.toLocaleString('es-PA',{maximumFractionDigits:0}):p.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:4});
    const colorBarra = a.sector ? colorSector(a.sector) : 'transparent';
    const esFav = favoritosAnalisis.has(a.id);
    return `<div class="an-asset-card ${sel}" onclick="selectAnalysisAsset('${a.id}','${a.type}')" style="border-left:3px solid ${colorBarra};position:relative;">
      <i class="ti ti-star${esFav?'-filled':''}" style="position:absolute;top:-2px;right:-2px;padding:10px;font-size:14px;color:${esFav?'var(--gold)':'var(--t3)'};cursor:pointer;" onclick="event.stopPropagation();alternarFavoritoAnalisis('${a.id}')" title="${esFav?'Quitar de favoritos':'Marcar como favorito'}"></i>
      <div class="an-asset-card-tk">${a.ticker}${a.sector?` <span style="font-size:8px;color:${colorBarra};font-weight:600;">${a.sector}</span>`:''}</div>
      <div class="an-asset-card-nm">${a.name}</div>
      <div class="an-asset-card-row">
        <span class="an-asset-card-px">$${pStr}</span>
        <span class="an-asset-card-chg ${chg>=0?'g':'r'}">${chg>=0?'+':''}${chg.toFixed(2)}%</span>
      </div>
    </div>`;
  }).join('');
}

function selectAnalysisAsset(id,type){
  anSelectedId=id;
  renderAnalysisGrid();
  ensureAnalysisBody();
  renderAnalysis(id,type);
  // Desplaza la vista al panel de análisis
  const body=document.getElementById('analysis-body');
  if(body)body.scrollIntoView({behavior:'smooth',block:'start'});
}

// Reconstruye la estructura interna del panel de análisis (divs que renderAnalysis rellena).
function ensureAnalysisBody(){
  const body=document.getElementById('analysis-body');
  if(!body)return;
  if(document.getElementById('an-price'))return;   // ya construido
  body.innerHTML=`
    <div class="metric-grid">
      <div class="metric"><div class="metric-label">Precio actual</div><div class="metric-val mono" id="an-price">—</div></div>
      <div class="metric"><div class="metric-label">Rentabilidad esp.</div><div class="metric-val g" id="an-ret">—</div></div>
      <div class="metric"><div class="metric-label">Riesgo (σ)</div><div class="metric-val a" id="an-risk">—</div></div>
      <div class="metric"><div class="metric-label">Ratio Sharpe</div><div class="metric-val" id="an-sharpe">—</div></div>
    </div>
    <div class="grid2" style="margin-bottom:14px;">
      <div class="card"><div class="card-title"><i class="ti ti-chart-line"></i> Proyección de precio (5 años)</div><div class="chart-box-lg"><canvas id="an-price-chart"></canvas></div></div>
      <div class="card"><div class="card-title"><i class="ti ti-target"></i> Riesgo vs Rentabilidad</div><div class="chart-box-lg"><canvas id="an-rv-chart"></canvas></div></div>
    </div>
    <div class="card" id="an-calificacion-card" style="margin-bottom:14px;"></div>
    <div class="grid2" style="margin-bottom:14px;">
      <div class="card"><div class="card-title"><i class="ti ti-info-circle"></i> Perfil del emisor</div><div id="an-profile"></div></div>
      <div class="card"><div class="card-title"><i class="ti ti-gauge"></i> Indicadores clave</div><div id="an-indicators"></div></div>
    </div>
    <div class="card"><div class="card-title"><i class="ti ti-table"></i> Estadísticas históricas</div><table><thead><tr><th>Indicador</th><th>Valor</th><th>Referencia</th><th>Evaluación</th></tr></thead><tbody id="an-stats-table"></tbody></table></div>`;
}

function renderAnalysis(id,type){
  // Compatibilidad: si se llama sin args, usa el activo seleccionado actual.
  if(!id){ if(!anSelectedId)return; id=anSelectedId; type=anCurrentClass; }
  const asset=allAssets().find(a=>a.id===id&&a.type===type);if(!asset)return;
  ensureAnalysisBody();
  document.getElementById('analysis-body').style.display='block';
  const p=asset.currentPrice||asset.price;const sh=computeSharpe(asset);
  document.getElementById('an-price').textContent='$'+fmt(p);
  document.getElementById('an-ret').textContent=asset.ret.toFixed(1)+'%';
  document.getElementById('an-risk').textContent=asset.sigma.toFixed(1)+'%';
  document.getElementById('an-sharpe').textContent=sh.toFixed(2);
  document.getElementById('an-sharpe').className='metric-val '+(sh>0.5?'g':sh>0?'a':'r');

  anPriceChart=dc(anPriceChart);
  const lbs=[],bull=[],base=[],bear=[];
  for(let t=0;t<=60;t++){lbs.push(t===0?'Hoy':(t%12===0?'Y'+(t/12):''));const m=t/12;base.push(+(p*Math.pow(1+asset.ret/100,m)).toFixed(2));bull.push(+(p*Math.pow(1+(asset.ret+asset.sigma)/100,m)).toFixed(2));bear.push(+(p*Math.pow(1+Math.max(-50,asset.ret-asset.sigma)/100,m)).toFixed(2));}
  {const _c=document.getElementById('an-price-chart');if(_c&&typeof Chart!=='undefined'){anPriceChart=new Chart(_c,{type:'line',data:{labels:lbs,datasets:[{label:'Alcista',data:bull,borderColor:'rgba(0,208,132,.6)',borderWidth:1.5,borderDash:[4,4],tension:.3,pointRadius:0},{label:'Base',data:base,borderColor:'#00c4ff',backgroundColor:'rgba(0,196,255,.07)',borderWidth:2,tension:.3,fill:true,pointRadius:0},{label:'Bajista',data:bear,borderColor:'rgba(255,71,87,.6)',borderWidth:1.5,borderDash:[4,4],tension:.3,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a8ab0',font:{size:10}}}},scales:{x:{ticks:{color:'#3d4d72',maxTicksLimit:6,font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}}}}});}}

  anRvChart=dc(anRvChart);
  const pts=allAssets().map(a=>({x:a.sigma,y:a.ret,label:a.ticker}));
  {const _c=document.getElementById('an-rv-chart');if(_c&&typeof Chart!=='undefined'){anRvChart=new Chart(_c,{type:'scatter',data:{datasets:[{data:pts,backgroundColor:allAssets().map(a=>a.id===id?'#ffb400':'rgba(0,196,255,.4)'),pointRadius:allAssets().map(a=>a.id===id?9:5)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const d=c.dataset.data[c.dataIndex];return d.label+': σ='+d.x.toFixed(1)+'% r='+d.y.toFixed(1)+'%';}}}},scales:{x:{title:{display:true,text:'Riesgo σ%',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},y:{title:{display:true,text:'Retorno%',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}}}}});}}

  // Calificación CapitalLab — sintetiza retorno y riesgo en una sola
  // letra, siempre con las razones reales detrás, nunca solo el
  // símbolo aislado sin explicación.
  const calif = calificarActivoCapitalLab(asset);
  if(calif){
    document.getElementById('an-calificacion-card').innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div style="text-align:center;flex-shrink:0;">
          <div style="width:64px;height:64px;border-radius:50%;background:${calif.color}22;border:2px solid ${calif.color};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:${calif.color};">${calif.letra}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:5px;">Calificación<br>CapitalLab</div>
        </div>
        <div style="flex:1;min-width:220px;">
          <div style="font-size:15px;font-weight:700;color:${calif.color};margin-bottom:3px;">${calif.titulo}</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:8px;">${calif.descripcion}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <div style="font-size:10.5px;font-weight:600;color:var(--green, #1e8e5a);margin-bottom:3px;">FORTALEZAS</div>
              ${calif.fortalezas.map(f=>`<div style="font-size:11px;color:var(--t2);padding:2px 0 2px 10px;border-left:2px solid var(--green, #1e8e5a);margin-bottom:3px;">${f}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:600;color:var(--red, #ff4757);margin-bottom:3px;">RIESGOS</div>
              ${calif.riesgos.map(r=>`<div style="font-size:11px;color:var(--t2);padding:2px 0 2px 10px;border-left:2px solid var(--red, #ff4757);margin-bottom:3px;">${r}</div>`).join('')}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="abrirReferenciaCalificaciones()" style="margin-top:10px;"><i class="ti ti-help-circle"></i> ¿Qué significa cada nivel?</button>
        </div>
      </div>
      <div style="font-size:10px;color:var(--t3);margin-top:10px;font-style:italic;">Esta calificación resume el comportamiento de las métricas disponibles y no constituye una recomendación financiera.</div>
    `;
  }

  document.getElementById('an-profile').innerHTML=buildProfile(asset);
  // VaR histórico real (mismo motor que el panel de Mercado); cae a paramétrico si faltan datos.
  const anVaR = computeHistVaR(asset, 0.95);
  document.getElementById('an-indicators').innerHTML=`<div style="display:flex;flex-direction:column;">${[
    ['Retorno esperado',asset.ret.toFixed(1)+'%','g'],
    ['Riesgo σ anual',asset.sigma.toFixed(1)+'%','a'],
    ['Ratio Sharpe',sh.toFixed(2),sh>0.5?'g':sh>0?'a':'r'],
    ['VaR 95% ('+anVaR.method+')',anVaR.pct.toFixed(1)+'%','r'],
    ...(type==='accion'?[['Beta',asset.beta.toFixed(2),''],['Dividendo','$'+asset.dividend,'g']]:[]),
    ...(type==='bono'?[['Cupón',asset.coupon+'%','g'],['Calificación',asset.rating,'']]:[]),
    ...(type==='divisa'?[['Riesgo país',asset.rp+'%','r'],['Volatilidad',asset.sigma+'%','a']]:[]),
    ...(type==='futuro'||type==='derivado'?[['Sector',asset.sector,''],['País/Región',asset.country,'']]:[]),
  ].map(([l,v,c])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--t2);">${conAyuda(l)}</span><span class="mono ${c}">${v}</span></div>`).join('')}</div>`;

  document.getElementById('an-stats-table').innerHTML=[
    ['Retorno esperado',asset.ret.toFixed(1)+'%',type==='bono'?'>4%':'>8%',asset.ret>=(type==='bono'?4:8)?'<span class="badge badge-green">Favorable</span>':'<span class="badge badge-amber">Revisar</span>'],
    ['Volatilidad σ',asset.sigma.toFixed(1)+'%','<15%',asset.sigma<15?'<span class="badge badge-green">Controlada</span>':asset.sigma<30?'<span class="badge badge-amber">Moderada</span>':'<span class="badge badge-red">Alta</span>'],
    ['Ratio Sharpe',sh.toFixed(2),'>0.5',sh>0.5?'<span class="badge badge-green">Eficiente</span>':sh>0?'<span class="badge badge-amber">Aceptable</span>':'<span class="badge badge-red">Ineficiente</span>'],
    ['VaR 95% ('+anVaR.method+')',anVaR.pct.toFixed(1)+'%',anVaR.method.indexOf('sesión')>=0?'<5%':'<20%',anVaR.pct<(anVaR.method.indexOf('sesión')>=0?5:20)?'<span class="badge badge-green">Manejable</span>':'<span class="badge badge-red">Elevado</span>'],
  ].map(r=>`<tr><td>${conAyuda(r[0])}</td><td class="mono">${r[1]}</td><td class="mono" style="color:var(--t3);">${r[2]}</td><td>${r[3]}</td></tr>`).join('');

  // ── Remove previous extra panels ──
  ['an-financials','an-gdp','an-specs','an-bond-doc','an-fut-mkt','an-deriv-greeks','an-cashflow'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});
  const body=document.getElementById('analysis-body');

  // ── ESTADOS FINANCIEROS (acciones) ──
  if(type==='accion'&&asset.fs){
    const isBanka=asset.id==='JPM'||asset.id==='BVPS'||asset.id==='BLX';
    const inc=asset.fs.income;
    const bal=asset.fs.balance;
    const div=document.createElement('div');
    div.id='an-financials';
    div.style.marginTop='14px';
    div.innerHTML=`
      <div class="card" style="margin-bottom:14px;">
        <div class="card-title"><i class="ti ti-file-invoice" style="color:var(--accent2);"></i> Estado de Resultados — ${asset.name}<i class="ti ti-chevron-down card-collapse-toggle" onclick="alternarTarjeta(this)"></i></div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:10px;" id="fs-fuente-income">Cifras en millones USD (USD M) · Modelo estimado del simulador, no un reporte real</p>
        <table id="fs-tabla-income">
          <thead><tr>
            <th>Concepto</th>
            ${inc.map(r=>`<th style="text-align:right;">Año ${r.year}</th>`).join('')}
            <th style="text-align:right;">Var. interanual</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="color:var(--t2);">Ingresos totales</td>
              ${inc.map(r=>`<td class="mono" style="text-align:right;">${r.revenue.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${inc[0].revenue>inc[1].revenue?'g':'r'}" style="text-align:right;">${((inc[0].revenue-inc[1].revenue)/inc[1].revenue*100).toFixed(1)}%</td>
            </tr>
            ${!isBanka?`<tr>
              <td style="color:var(--t2);">Utilidad bruta</td>
              ${inc.map(r=>`<td class="mono" style="text-align:right;">${r.grossProfit?r.grossProfit.toLocaleString('es-PA'):'N/A'}</td>`).join('')}
              <td class="mono g" style="text-align:right;">—</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">EBIT (Utilidad operativa)</td>
              ${inc.map(r=>`<td class="mono" style="text-align:right;">${r.ebit?r.ebit.toLocaleString('es-PA'):'N/A'}</td>`).join('')}
              <td class="mono ${inc[0].ebit&&inc[1].ebit&&inc[0].ebit>inc[1].ebit?'g':'r'}" style="text-align:right;">${inc[0].ebit&&inc[1].ebit?((inc[0].ebit-inc[1].ebit)/Math.abs(inc[1].ebit)*100).toFixed(1)+'%':'—'}</td>
            </tr>`:''}
            <tr style="background:rgba(0,196,255,.04);">
              <td style="color:var(--t1);font-weight:500;">Utilidad neta</td>
              ${inc.map(r=>`<td class="mono ${r.netIncome>=0?'g':'r'}" style="text-align:right;font-weight:500;">${r.netIncome.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${inc[0].netIncome>inc[1].netIncome?'g':'r'}" style="text-align:right;font-weight:500;">${((inc[0].netIncome-inc[1].netIncome)/Math.abs(inc[1].netIncome)*100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Margen neto</td>
              ${inc.map(r=>`<td class="mono g" style="text-align:right;">${(r.netIncome/r.revenue*100).toFixed(1)}%</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-title"><i class="ti ti-building" style="color:var(--green);"></i> Estado de Situación Financiera — ${asset.name}<i class="ti ti-chevron-down card-collapse-toggle" onclick="alternarTarjeta(this)"></i></div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:10px;">Cifras en millones USD (USD M) · Modelo estimado del simulador — Yahoo Finance no entrega este detalle sin costo</p>
        <table>
          <thead><tr>
            <th>Concepto</th>
            ${bal.map(r=>`<th style="text-align:right;">Año ${r.year}</th>`).join('')}
            <th style="text-align:right;">Var. interanual</th>
          </tr></thead>
          <tbody>
            <tr style="background:rgba(0,196,255,.04);">
              <td style="color:var(--t1);font-weight:500;">Total activos</td>
              ${bal.map(r=>`<td class="mono" style="text-align:right;font-weight:500;">${r.assets.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${bal[0].assets>bal[1].assets?'g':'r'}" style="text-align:right;">${((bal[0].assets-bal[1].assets)/bal[1].assets*100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Total pasivos</td>
              ${bal.map(r=>`<td class="mono r" style="text-align:right;">${r.liabilities.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
            <tr style="background:rgba(0,208,132,.04);">
              <td style="color:var(--t1);font-weight:500;">Patrimonio neto</td>
              ${bal.map(r=>`<td class="mono g" style="text-align:right;font-weight:500;">${r.equity.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${bal[0].equity>bal[1].equity?'g':'r'}" style="text-align:right;">${((bal[0].equity-bal[1].equity)/Math.abs(bal[1].equity)*100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Caja y equivalentes</td>
              ${bal.map(r=>`<td class="mono g" style="text-align:right;">${r.cash.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Deuda financiera</td>
              ${bal.map(r=>`<td class="mono a" style="text-align:right;">${r.debt.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Razón deuda/patrimonio</td>
              ${bal.map(r=>`<td class="mono ${r.debt/r.equity<1?'g':r.debt/r.equity<2?'a':'r'}" style="text-align:right;">${(r.debt/r.equity).toFixed(2)}x</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    body.appendChild(div);

    // ── FLUJO DE CAJA — el dato ya existía en el modelo (asset.fs.cashflow)
    // pero nunca se había construido la tarjeta que lo muestra; hasta ahora
    // Análisis solo mostraba resultados y balance, sin la tercera pieza
    // clásica de cualquier análisis financiero serio.
    if(asset.fs.cashflow){
      const cf=asset.fs.cashflow;
      const fcl = cf.map(r=>r.operating+r.investing);
      const divCF=document.createElement('div');
      divCF.id='an-cashflow';
      divCF.style.marginTop='14px';
      divCF.innerHTML=`
      <div class="card">
        <div class="card-title"><i class="ti ti-cash" style="color:var(--gold);"></i> Estado de Flujo de Efectivo — ${asset.name}<i class="ti ti-chevron-down card-collapse-toggle" onclick="alternarTarjeta(this)"></i></div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:10px;">Cifras en millones USD (USD M) · Modelo estimado del simulador — Yahoo Finance no entrega este detalle sin costo</p>
        <table>
          <thead><tr>
            <th>Concepto</th>
            ${cf.map(r=>`<th style="text-align:right;">Año ${r.year}</th>`).join('')}
            <th style="text-align:right;">Var. interanual</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="color:var(--t2);">Flujo de efectivo operativo</td>
              ${cf.map(r=>`<td class="mono ${r.operating>=0?'g':'r'}" style="text-align:right;">${r.operating.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${cf[0].operating>cf[1].operating?'g':'r'}" style="text-align:right;">${((cf[0].operating-cf[1].operating)/Math.abs(cf[1].operating)*100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Flujo de efectivo de inversión</td>
              ${cf.map(r=>`<td class="mono ${r.investing>=0?'g':'r'}" style="text-align:right;">${r.investing.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Flujo de efectivo de financiamiento</td>
              ${cf.map(r=>`<td class="mono ${r.financing>=0?'g':'r'}" style="text-align:right;">${r.financing.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
            <tr style="background:rgba(212,175,55,.06);">
              <td style="color:var(--t1);font-weight:500;">Flujo de caja libre (estimado)</td>
              ${fcl.map(v=>`<td class="mono ${v>=0?'g':'r'}" style="text-align:right;font-weight:500;">${v.toLocaleString('es-PA')}</td>`).join('')}
              <td class="mono ${fcl[0]>fcl[1]?'g':'r'}" style="text-align:right;font-weight:500;">${((fcl[0]-fcl[1])/Math.abs(fcl[1])*100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td style="color:var(--t2);">Margen de flujo libre / ingresos</td>
              ${cf.map((r,i)=>`<td class="mono" style="text-align:right;">${(fcl[i]/inc[i].revenue*100).toFixed(1)}%</td>`).join('')}
              <td class="mono" style="text-align:right;">—</td>
            </tr>
          </tbody>
        </table>
        <div class="info-box" style="margin-top:10px;font-size:11px;">
          <b>Sobre estas cifras:</b> CapitalLab es un simulador educativo. Las cifras de flujo de caja se aproximan a
          reportes financieros públicos reales de cada empresa, redondeadas y simplificadas con fines pedagógicos —
          no sustituyen los estados financieros auditados oficiales de cada compañía para fines de inversión real.
        </div>
      </div>`;
      body.appendChild(divCF);
    }
    autoColapsarEnMovil(body);

    // Intento de traer el Estado de Resultados real de Yahoo Finance —
    // solo se reemplazan Ingresos y Utilidad neta (los únicos campos
    // que Yahoo entrega reales sin costo). Si falla por cualquier
    // motivo, la tabla se queda con el modelo simulado que ya se
    // dibujó arriba, sin que el estudiante note ningún error.
    if(asset.ticker){
      try { intentarCargarEstadosFinancierosReales(asset); } catch(e){}
    }
  }

  // ── PROSPECTO DEL BONO ──
  if(type==='bono'){
    const p2=asset.currentPrice||asset.price;
    const ytm=asset.ret;
    const years=asset.maturity;
    const coupon=asset.coupon;
    const nominal=100;
    // Macaulay duration simplified
    let durNum=0,durDen=0;
    for(let t=1;t<=years;t++){const cf=t===years?(coupon+nominal):coupon;const pv=cf/Math.pow(1+ytm/100,t);durNum+=t*pv;durDen+=pv;}
    const macDur=(durDen>0?durNum/durDen:years).toFixed(2);
    const modDurNum=macDur/(1+ytm/100);
    const modDur=modDurNum.toFixed(2);
    // DV01 (basis point value)
    const dv01=(modDurNum*p2*0.0001).toFixed(4);
    // Cash flows
    const cfs=[];
    for(let t=1;t<=Math.min(years,10);t++){cfs.push({year:t,cf:t===years?coupon+nominal:coupon,pv:+((t===years?coupon+nominal:coupon)/Math.pow(1+ytm/100,t)).toFixed(2)});}
    const divEl=document.createElement('div');
    divEl.id='an-bond-doc';
    divEl.style.marginTop='14px';
    divEl.innerHTML=`
      <div class="card" style="margin-bottom:14px;">
        <div class="card-title"><i class="ti ti-file-text" style="color:var(--amber);"></i> Prospecto del Bono — ${asset.name} (${asset.ticker})</div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:14px;">Documento informativo del instrumento de renta fija · Fuente: Datos de mercado de referencia</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
          ${[
            ['Precio de mercado','$'+fmt(p2),'g'],
            ['Rendimiento (YTM)',ytm.toFixed(2)+'%','a'],
            ['Tasa cupón',coupon.toFixed(2)+'% anual',''],
            ['Vencimiento',years+' año'+(years>1?'s':''),''],
            ['Duración Macaulay',macDur+' años',''],
            ['Duración modificada',modDur+'',''],
            ['DV01 (valor bp)','$'+dv01,'r'],
            ['Calificación crediticia',asset.rating,asset.rating.startsWith('A')?'g':asset.rating.startsWith('B')?'a':'r'],
          ].map(([l,v,c])=>`<div class="metric"><div class="metric-label">${conAyuda(l)}</div><div class="metric-val ${c}" style="font-size:16px;">${v}</div></div>`).join('')}
        </div>
        <div class="grid2" style="gap:14px;">
          <div>
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Características del instrumento</div>
            ${[
              ['Emisor',asset.country+' — '+asset.name],
              ['Tipo de bono',asset.rating.startsWith('A')?'Grado de inversión (Investment Grade)':asset.rating.startsWith('BB')||asset.rating.startsWith('B')?'Especulativo (High Yield)':'Grado de inversión / Monitoreo'],
              ['País emisor',asset.country],
              ['Frecuencia cupón','Anual'],
              ['Base de cálculo','30/360'],
              ['Riesgo de reinversión',ytm>6?'Moderado':'Bajo'],
              ['Riesgo de crédito','EMBI spread: '+(asset.rp||0)+'%'],
              ['Convexidad',((modDurNum*modDurNum+modDurNum)*0.01).toFixed(3)],
            ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--t2);">${l}</span><span class="mono">${v}</span></div>`).join('')}
          </div>
          <div>
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Flujo de pagos proyectado${cfs.length<years?' (primeros 10 años)':''}</div>
            <table>
              <thead><tr><th>Año</th><th style="text-align:right;">Flujo ($)</th><th style="text-align:right;">Valor presente</th><th style="text-align:right;">Tipo</th></tr></thead>
              <tbody>
                ${cfs.map(cf=>`<tr>
                  <td class="mono">${cf.year}</td>
                  <td class="mono g" style="text-align:right;">${cf.cf.toFixed(2)}</td>
                  <td class="mono a" style="text-align:right;">${cf.pv.toFixed(2)}</td>
                  <td style="text-align:right;font-size:10px;"><span class="badge ${cf.year===years?'badge-amber':'badge-blue'}">${cf.year===years?'Cupón+Principal':'Cupón'}</span></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="info-box ${asset.rp<2?'success':asset.rp<6?'warn':'danger'}" style="margin-top:14px;">
          <b>Análisis de riesgo-rendimiento:</b> El bono ${asset.name} ofrece un rendimiento (YTM) de <b>${ytm.toFixed(2)}%</b> anual con duración modificada de <b>${modDur} años</b>. Por cada incremento de 100 puntos base en tasas, el precio sufriría una caída estimada de <b>${modDurNum.toFixed(1)}%</b>. La calificación <b>${asset.rating}</b> refleja ${asset.rating.startsWith('A')?'un bajo riesgo de incumplimiento con fuerte capacidad de pago':asset.rating.startsWith('BB')?'riesgo especulativo moderado':'alto riesgo especulativo — requiere análisis detallado del emisor'}.
        </div>
      </div>`;
    body.appendChild(divEl);
  }

  // ── PIB / GDP (divisas) ──
  if(type==='divisa'&&asset.gdp){
    const g=asset.gdp;
    const div=document.createElement('div');
    div.id='an-gdp';
    div.style.marginTop='14px';
    div.innerHTML=`
      <div class="card">
        <div class="card-title"><i class="ti ti-world-dollar" style="color:var(--amber);"></i> Contexto Macroeconómico — ${asset.country}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
          ${[
            ['PIB total','$'+g.total+' B USD','g'],
            ['PIB per cápita','$'+g.perCapita+' USD','g'],
            ['Crecimiento PIB',(g.growth>=0?'+':'')+g.growth+'%',g.growth>=2?'g':g.growth>=0?'a':'r'],
            ['Inflación anual',g.inflation+'%',g.inflation<4?'g':g.inflation<8?'a':'r'],
            ['Desempleo',g.unemployment+'%',g.unemployment<5?'g':g.unemployment<10?'a':'r'],
            ['Calificación S&P',g.rating,g.rating.startsWith('A')?'g':g.rating.startsWith('B')?'a':'r'],
          ].map(([l,v,c])=>`<div class="metric"><div class="metric-label">${conAyuda(l)}</div><div class="metric-val ${c}">${v}</div></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Moneda y sectores principales</div>
            <div style="font-size:13px;color:var(--t2);margin-bottom:4px;"><b style="color:var(--t1);">Moneda:</b> ${g.currency}</div>
            <div style="font-size:13px;color:var(--t2);"><b style="color:var(--t1);">Sectores:</b> ${g.mainSectors}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Perspectiva económica</div>
            <div class="info-box ${g.growth>=2?'success':g.growth>=0?'warn':'danger'}" style="margin:0;">${g.outlook}</div>
          </div>
        </div>
      </div>`;
    body.appendChild(div);
  }

  // ── ESPECIFICACIONES (futuros y derivados) ──
  if((type==='futuro'||type==='derivado')&&asset.specs){
    const sp=asset.specs;
    const div=document.createElement('div');
    div.id='an-specs';
    div.style.marginTop='14px';
    div.innerHTML=`
      <div class="card">
        <div class="card-title"><i class="ti ti-file-description" style="color:var(--accent2);"></i> Especificaciones del contrato — ${asset.name}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0;">
          ${Object.entries(sp).map(([k,v])=>{
            const labels={
              exchange:'Bolsa / Mercado',contractSize:'Tamaño del contrato',tickSize:'Tick mínimo',
              margin:'Margen inicial aprox.',settlement:'Liquidación',expiryNote:'Vencimientos',
              underlying:'Activo subyacente',type:'Tipo de instrumento',strike:'Precio de ejercicio (Strike)',
              expiry:'Vencimiento',premium:'Prima actual',delta:'Delta (Δ)',gamma:'Gamma (Γ)',theta:'Theta (Θ)',iv:'Volatilidad implícita',
              maturity:'Plazo / Vencimiento',payLeg:'Pata pagadora',receiveLeg:'Pata receptora',notional:'Nocional de referencia',
              counterpartyRisk:'Riesgo de contraparte',market:'Mercado de negociación',
              reference:'Entidad de referencia',spread:'Spread actual',trigger:'Evento de crédito',
              currency:'Par de divisas',period:'Período del contrato',contractRate:'Tasa del contrato',reference2:'Tasa de referencia',
              forwardRate:'Tipo de cambio forward',spotRate:'Tipo de cambio spot',points:'Puntos forward',
              coupon:'Cupón',tranche:'Tramo',collateral:'Cartera subyacente',manager:'Gestor',minimumInvestment:'Inversión mínima',
            };
            const lbl=labels[k]||k;
            return`<div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--t2);">${lbl}</span><span class="mono" style="color:var(--t1);text-align:right;max-width:55%;">${v}</span></div>`;
          }).join('')}
        </div>
      </div>`;
    body.appendChild(div);
  }

  // ── ANÁLISIS DE MERCADO DE FUTUROS (spot, base, curva) ──
  if(type==='futuro'&&asset.spot!=null){
    const fut=document.createElement('div');
    fut.id='an-fut-mkt';
    fut.style.marginTop='14px';
    const basePos=asset.basis>=0;
    fut.innerHTML=`
      <div class="card">
        <div class="card-title"><i class="ti ti-chart-dots" style="color:var(--green);"></i> Análisis de Mercado — ${asset.name}</div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:12px;">Relación entre el precio del futuro y el precio al contado (spot) · Datos representativos con fines educativos</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px;">
          ${[
            ['Precio del futuro','$'+fmt(asset.currentPrice||asset.price),''],
            ['Precio spot','$'+fmt(asset.spot),''],
            ['Base (futuro − spot)',(basePos?'+':'')+asset.basis.toFixed(4),basePos?'r':'g'],
            ['Estado de la curva',asset.curveState,asset.curveState==='Contango'?'a':'g'],
            ['Interés abierto',asset.openInterest.toLocaleString('es-PA')+' K',''],
            ['Vencimiento',asset.expiry||'Trimestral',''],
          ].map(([l,v,c])=>`<div class="metric"><div class="metric-label">${conAyuda(l)}</div><div class="metric-val ${c}" style="font-size:15px;">${v}</div></div>`).join('')}
        </div>
        <div class="info-box ${asset.curveState==='Contango'?'warn':'success'}" style="margin:0;">
          <b>${asset.curveState}:</b> ${asset.curveState==='Contango'
            ? 'El precio del futuro está por encima del spot. El mercado anticipa costos de almacenamiento o expectativas alcistas; mantener posiciones largas implica un costo de acarreo (roll negativo) al renovar el contrato.'
            : 'El precio del futuro está por debajo del spot (backwardation). Suele indicar escasez actual del subyacente o fuerte demanda inmediata; favorece a los tenedores de posiciones largas al renovar (roll positivo).'}
        </div>
      </div>`;
    body.appendChild(fut);
  }

  // ── ANÁLISIS DE OPCIONES / GRIEGAS (derivados) ──
  if(type==='derivado'&&asset.delta!=null){
    const der=document.createElement('div');
    der.id='an-deriv-greeks';
    der.style.marginTop='14px';
    const moneyness=asset.strike&&asset.currentPrice?((asset.currentPrice||asset.price)/asset.strike):1;
    const estado=moneyness>1.02?'Dentro del dinero (ITM)':moneyness<0.98?'Fuera del dinero (OTM)':'En el dinero (ATM)';
    der.innerHTML=`
      <div class="card">
        <div class="card-title"><i class="ti ti-diamonds" style="color:var(--accent2);"></i> Análisis de Sensibilidades (Griegas) — ${asset.name}</div>
        <p style="font-size:11px;color:var(--t3);margin-bottom:12px;">Sensibilidades del derivado a las variables de mercado · Datos representativos con fines educativos</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px;">
          ${[
            ['Delta (Δ)',asset.delta.toFixed(2),'g','Sensibilidad al precio del subyacente'],
            ['Gamma (Γ)',asset.gamma.toFixed(3),'a','Variación del delta'],
            ['Theta (Θ)',asset.theta.toFixed(3),'r','Decaimiento temporal diario'],
            ['Vega (ν)',asset.vega.toFixed(2),'','Sensibilidad a la volatilidad'],
            ['Volatilidad implícita',asset.impliedVol.toFixed(1)+'%','a','IV del contrato'],
            ['Precio de ejercicio','$'+fmt(asset.strike),'','Strike'],
          ].map(([l,v,c,t])=>`<div class="metric" title="${t}"><div class="metric-label">${conAyuda(l)}</div><div class="metric-val ${c}" style="font-size:15px;">${v}</div></div>`).join('')}
        </div>
        <div class="info-box" style="margin:0;">
          <b>Situación del contrato — ${estado}:</b> Un delta de <b>${asset.delta.toFixed(2)}</b> implica que el derivado se mueve aproximadamente <b>$${(asset.delta).toFixed(2)}</b> por cada $1 de movimiento del subyacente. El theta de <b>${asset.theta.toFixed(3)}</b> refleja la pérdida de valor temporal por día; la volatilidad implícita de <b>${asset.impliedVol.toFixed(1)}%</b> es el principal determinante de la prima.
        </div>
      </div>`;
    body.appendChild(der);
  }
}

// ═══════════════════ CUSTOM ═══════════════════
// ═══════════════════════════════════════════════════════════════════════════
// ESTADOS FINANCIEROS REALES — solo Ingresos y Utilidad neta, los
// únicos dos campos que Yahoo Finance entrega reales sin costo (se
// confirmó con pruebas reales antes de construir esto: el Balance
// General y el Flujo de Caja llegan restringidos, incluso con el
// símbolo correcto). Si el intento falla por cualquier motivo — sin
// conexión, símbolo no encontrado, Yahoo bloqueó la solicitud — la
// tabla se queda tal cual con el modelo simulado, sin ningún cambio
// visible para el estudiante, ni ningún error interrumpiendo nada.
// ═══════════════════════════════════════════════════════════════════
async function intentarCargarEstadosFinancierosReales(asset){
  const tabla = document.getElementById('fs-tabla-income');
  const fuenteEl = document.getElementById('fs-fuente-income');
  if(!tabla || !fuenteEl) return; // la tarjeta ni siquiera está en pantalla

  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/estados-financieros-yahoo?symbol=${encodeURIComponent(asset.ticker)}`, {
      headers: { 'apikey': SIM_IA_ANON_KEY, 'Authorization': `Bearer ${SIM_IA_ANON_KEY}` },
    });
    const d = await respuesta.json();
    if(!d.ok || !Array.isArray(d.anios) || d.anios.length < 2) throw new Error(d.error||'Sin datos reales disponibles.');

    // Yahoo entrega en dólares exactos; el modelo del simulador usa
    // millones — se convierte para que ambas cifras se lean igual.
    const aniosReales = d.anios.map(a => ({ year:a.year, revenue:Math.round(a.revenue/1e6), netIncome:Math.round(a.netIncome/1e6) }));

    // Actualizar solo las filas de Ingresos y Utilidad neta, que ya
    // existen en la tabla simulada — el resto de las filas (utilidad
    // bruta, EBIT, margen) se quedan con el valor estimado del
    // modelo, porque Yahoo no entrega esos campos sin costo.
    const filaIngresos = [...tabla.querySelectorAll('td')].find(td => td.textContent.trim()==='Ingresos totales')?.parentElement;
    const filaUtilidadNeta = [...tabla.querySelectorAll('td')].find(td => td.textContent.trim()==='Utilidad neta')?.parentElement;

    if(filaIngresos){
      const celdas = filaIngresos.querySelectorAll('td.mono');
      aniosReales.forEach((a,i) => { if(celdas[i]) celdas[i].textContent = a.revenue.toLocaleString('es-PA'); });
      if(celdas[celdas.length-1] && aniosReales.length>=2){
        const variacion = ((aniosReales[0].revenue-aniosReales[1].revenue)/aniosReales[1].revenue*100);
        celdas[celdas.length-1].textContent = variacion.toFixed(1)+'%';
        celdas[celdas.length-1].className = 'mono '+(variacion>=0?'g':'r');
      }
    }
    if(filaUtilidadNeta){
      const celdas = filaUtilidadNeta.querySelectorAll('td.mono');
      aniosReales.forEach((a,i) => { if(celdas[i]) { celdas[i].textContent = a.netIncome.toLocaleString('es-PA'); celdas[i].className = 'mono '+(a.netIncome>=0?'g':'r'); celdas[i].style.fontWeight = '500'; } });
    }

    fuenteEl.innerHTML = `Cifras en millones USD (USD M) · <span style="color:var(--green);"><i class="ti ti-circle-check" style="font-size:11px;"></i> Ingresos y Utilidad neta reales</span>, resto estimado · <a href="${d.urlYahoo}" target="_blank" rel="noopener" style="color:var(--accent2);">Ver en Yahoo Finance ↗</a>`;
  } catch(e){
    // Silencioso a propósito — el modelo simulado ya está en pantalla
    // y sigue siendo perfectamente utilizable para fines educativos.
  }
}

function renderCustom(){
  const tipo=document.getElementById('c-tipo').value;
  const precio=+document.getElementById('c-precio').value;
  const target=+document.getElementById('c-target').value;
  const horiz=+document.getElementById('c-horiz').value;
  const vol=+document.getElementById('c-vol').value;
  const monto=+document.getElementById('c-monto').value;
  const cupon=+document.getElementById('c-cupon').value;
  document.getElementById('c-precio-v').textContent='$'+precio;
  document.getElementById('c-target-v').textContent='$'+target;
  document.getElementById('c-horiz-v').textContent=horiz+' años';
  document.getElementById('c-vol-v').textContent=vol+'%';
  document.getElementById('c-monto-v').textContent='$'+monto.toLocaleString('es-PA');
  document.getElementById('c-cupon-v').textContent=cupon.toFixed(1)+'%';
  document.getElementById('c-extra-bono').style.display=tipo==='bono'?'block':'none';
  const retCap=(target-precio)/precio*100/horiz;
  const retTotal=tipo==='bono'?(cupon+retCap):retCap;
  const gan=monto*retTotal/100;
  const varV=monto*(vol/100)*1.645;
  const sh=(retTotal-RF)/vol;
  document.getElementById('c-ret').textContent=retTotal.toFixed(1)+'%';
  document.getElementById('c-ret').className='metric-val '+(retTotal>=0?'g':'r');
  document.getElementById('c-gan').textContent=fmtS(gan);
  document.getElementById('c-gan').className='metric-val '+(gan>=0?'g':'r');
  document.getElementById('c-var').textContent='-$'+fmt(varV);
  document.getElementById('c-sharpe').textContent=sh.toFixed(2);
  document.getElementById('c-sharpe').className='metric-val '+(sh>0.5?'g':sh>0?'a':'r');
  document.getElementById('c-risk-thumb').style.left=Math.min(100,vol*1.5)+'%';
  document.getElementById('c-explain').innerHTML=`Retorno esperado anual: <b>${retTotal.toFixed(1)}%</b> · VaR 95%: <b>$${fmt(varV)}</b> · ${vol<10?'<b>Riesgo bajo.</b>':vol<25?'<b>Riesgo moderado.</b>':'<b>Riesgo alto.</b>'}`;
  cProjChartInst=dc(cProjChartInst);
  const pts2=horiz*12+1,lbs2=[],base2=[],bull2=[],bear2=[];
  for(let t=0;t<pts2;t++){const m=t/12;lbs2.push(t===0?'Hoy':(t%12===0?'Y'+(t/12):''));base2.push(+(precio*Math.pow(1+retTotal/100,m)).toFixed(2));bull2.push(+(precio*Math.pow(1+(retTotal+vol)/100,m)).toFixed(2));bear2.push(+(precio*Math.pow(1+Math.max(-50,retTotal-vol)/100,m)).toFixed(2));}
  const _cpC=document.getElementById('c-proj-chart');if(_cpC&&typeof Chart!=='undefined'){cProjChartInst=new Chart(_cpC,{type:'line',data:{labels:lbs2,datasets:[{label:'Alcista',data:bull2,borderColor:'rgba(0,208,132,.5)',borderWidth:1.5,borderDash:[5,5],tension:.3,pointRadius:0,fill:false},{label:'Base',data:base2,borderColor:'#00c4ff',backgroundColor:'rgba(0,196,255,.07)',borderWidth:2,tension:.3,fill:true,pointRadius:0},{label:'Bajista',data:bear2,borderColor:'rgba(255,71,87,.5)',borderWidth:1.5,borderDash:[5,5],tension:.3,pointRadius:0,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a8ab0',font:{size:10}}}},scales:{x:{ticks:{color:'#3d4d72',maxTicksLimit:8,font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}}}}});}
}
function addCustomToPortfolio(){
  const precio=+document.getElementById('c-precio').value;
  const vol=+document.getElementById('c-vol').value;
  const monto=+document.getElementById('c-monto').value;
  const tipo=document.getElementById('c-tipo').value;
  const horiz=+document.getElementById('c-horiz').value;
  const cupon=+document.getElementById('c-cupon').value;
  const retCap=(+document.getElementById('c-target').value-precio)/precio*100/horiz;
  const retTotal=tipo==='bono'?(cupon+retCap):retCap;
  if(monto>capital){notify('Capital insuficiente','error');return;}
  const qty=Math.max(1,Math.floor(monto/precio));
  const gross=qty*precio;
  const fee=commissionFor(gross);
  capital-=(gross+fee);   // descuenta valor + comisión
  portfolio.push({id:'CUSTOM_'+Date.now(),name:'Activo personalizado',ticker:'CUSTOM',type:tipo,price:precio,currentPrice:precio,sigma:vol,ret:retTotal,beta:1,qty,invested:gross+fee,buyPrice:precio,profile:'Activo definido manualmente.',rating:'N/A'});
  txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Compra',name:'Activo personalizado',qty,price:precio,total:gross,fee:+fee.toFixed(2)});
  updateNavCapital();
  notify('Activo personalizado agregado ✓');
  autosave();
}

// ═══════════════════ PORTFOLIO ═══════════════════
// ── LLAMADA DE MARGEN: liquidación forzada por insuficiencia de patrimonio ──
// Se evalúa en cada tick. Si el inversor está apalancado (efectivo negativo) y su patrimonio
// neto cae por debajo del margen de mantenimiento sobre el valor de sus posiciones, el bróker
// liquida posiciones automáticamente (las de mayor pérdida no realizada primero) hasta
// restaurar el margen o agotar la cartera. Refleja el riesgo real del apalancamiento.
function checkMarginCall(){
  if (portfolio.length === 0) return;
  // Solo aplica si hay deuda (efectivo negativo por apalancamiento).
  if (capital >= 0) return;

  let posValue = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty, 0);
  let equity   = capital + posValue;                 // patrimonio neto
  // Requisito: equity ≥ MAINTENANCE_MARGIN × valor de posiciones.
  if (equity >= MAINTENANCE_MARGIN * posValue) return;  // margen suficiente, sin acción

  // Margin call: liquidar posiciones de mayor pérdida primero hasta restaurar el margen.
  const liquidated = [];
  // Ordena por pérdida no realizada (más negativa primero).
  const ordered = portfolio.slice().sort((a,b)=>{
    const plA = ((a.currentPrice||a.buyPrice)-a.buyPrice)*a.qty;
    const plB = ((b.currentPrice||b.buyPrice)-b.buyPrice)*b.qty;
    return plA - plB;
  });

  for (const pos of ordered){
    if (capital >= 0 && equity >= MAINTENANCE_MARGIN * posValue) break;  // margen restaurado
    if (posValue <= 0) break;
    const mid = pos.currentPrice || pos.buyPrice;
    const px  = execPrice(mid, pos.type, 'sell');     // liquidación cruza el bid
    const gross = pos.qty * px;
    const fee = commissionFor(gross);
    const cashIn = gross - fee;
    capital += cashIn;                                // el efectivo recibido reduce la deuda
    liquidated.push({ name: pos.name, ticker: pos.ticker, qty: pos.qty, value: gross });
    // Retira la posición liquidada de la cartera.
    portfolio = portfolio.filter(x=>!(x.id===pos.id && x.type===pos.type));
    // Recalcula tras la liquidación.
    posValue = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty, 0);
    equity   = capital + posValue;
    txHistory.unshift({
      date: new Date().toLocaleTimeString('es-PA'),
      action: 'Liquidación', name: pos.name, type: pos.type,
      qty: pos.qty, price: px, total: gross, fee: +fee.toFixed(2)
    });
  }

  if (liquidated.length > 0){
    marginCallCount++;
    const tickers = liquidated.map(l=>l.ticker).join(', ');
    notify(`⚠ LLAMADA DE MARGEN: se liquidaron ${liquidated.length} posición(es) (${tickers}) para cubrir tu deuda`, 'error');
    // Noticia del evento
    const now = new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    newsFeed.unshift({
      id: Date.now()+Math.random(), time: now,
      headline: `⚠ Llamada de margen ejecutada — liquidación forzada`,
      body: `El nivel de patrimonio cayó por debajo del margen de mantenimiento (${(MAINTENANCE_MARGIN*100).toFixed(0)}%). El sistema liquidó automáticamente ${liquidated.length} posición(es): ${tickers}. Esta es una consecuencia directa del apalancamiento: cuando el mercado se mueve en contra de una posición apalancada, el bróker cierra posiciones para cubrir la deuda.`,
      type: 'bear', ticker: '—', movePct: 0, unread: true,
    });
    newsUnreadCount++;
    if (newsFeed.length > 40) newsFeed.pop();
    renderNewsFeed();
    updateNavCapital();
    autosave();
  }
}

// Antes de vender una posición completa desde la Cartera, pide confirmación
// con el mismo criterio que ya se usa al comprar/vender desde el Mercado
// (evitar que un clic accidental liquide una posición sin querer).
function sellFromPortfolio(id,type){
  const pos=portfolio.find(p=>p.id===id&&p.type===type);
  if(!pos||pos.qty<=0){notify('Sin unidades para vender','error');return;}
  const mid=pos.currentPrice||pos.buyPrice;
  const px =execPrice(mid, pos.type, 'sell');
  const gross=pos.qty*px;
  const fee=commissionFor(gross);
  const cashIn=gross-fee;

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:400px;">
    <h3>Confirmar venta</h3>
    <div class="sub">${pos.name}${pos.ticker?' ('+pos.ticker+')':''} · venta total de ${pos.qty} unidades</div>
    <div style="background:var(--c2);border-radius:var(--r);padding:14px;margin:14px 0;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Precio de ejecución</span><span>$${fmt(px)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Subtotal</span><span>$${fmt(gross)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:var(--t3);">Comisión</span><span>$${fmt(fee)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:6px;border-top:1px solid var(--c4);font-size:14.5px;font-weight:700;"><span>Total a recibir</span><span>$${fmt(cashIn)}</span></div>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="vp-cancelar" style="flex:1;">Cancelar</button>
      <button class="btn btn-sell" id="vp-confirmar" style="flex:1;">Confirmar venta</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  overlay.querySelector('#vp-cancelar').onclick = () => overlay.remove();
  overlay.querySelector('#vp-confirmar').onclick = () => {
    overlay.remove();
    const snapshot = tomarSnapshotEstado();
    capital+=cashIn;
    txHistory.unshift({date:new Date().toLocaleTimeString('es-PA'),timestamp:Date.now(),action:'Venta',name:pos.name,type:pos.type,qty:pos.qty,price:px,total:gross,fee:+fee.toFixed(2)});
    portfolio=portfolio.filter(x=>!(x.id===id&&x.type===type));
    updateNavCapital();
    notify(`Venta total de ${pos.ticker||pos.name} · costo $${fmt(fee)} ✓`);
    autosave();
    renderPortfolio();
    mostrarDeshacerToast(snapshot, `Venta de ${pos.qty}u ${pos.ticker||pos.name} realizada.`);
  };
}
// Color de etiqueta según el tipo de activo — global porque tanto la
// cartera como el historial de transacciones (funciones separadas) la usan.
function typeBadgeCls(t){
  return t==='accion'?'badge-blue':t==='bono'?'badge-green':t==='divisa'?'badge-amber':t==='futuro'?'badge-red':'badge-cyan';
}

function renderPortfolio(permitirSaltarGraficos){
  updateNavCapital();
  verificarMetaPersonal();
  const btnRepetir = document.getElementById('btn-repetir-op');
  if(btnRepetir) btnRepetir.style.display = txHistory.some(t=>t.action==='Compra'||t.action==='Venta') ? '' : 'none';
  const totalInv = portfolio.reduce((s,p)=>s+p.invested,0);
  const curVal   = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const pnl      = curVal-totalInv;
  const portVal  = capital+curVal;
  const retPct   = totalInv>0?(pnl/totalInv*100):0;
  // Métricas ponderadas por valor de mercado, con VaR diversificado (modelo de un factor).
  const pm = computePortfolioMetrics(portfolio);
  const aS = pm.wSigma;     // sigma de cartera (ponderada + correlación), no promedio simple
  const aR = pm.wRet;       // retorno ponderado por peso de posición
  const sh = pm.sharpe;     // Sharpe de cartera correcto
  const var95 = pm.var95;   // VaR-95 diversificado (no asume ρ=1)
  const winners  = portfolio.filter(p=>(p.currentPrice||p.buyPrice)>p.buyPrice);
  const losers   = portfolio.filter(p=>(p.currentPrice||p.buyPrice)<p.buyPrice);

  document.getElementById('port-total').textContent='$'+fmt(portVal);
  document.getElementById('port-cap').textContent='$'+fmt(capital);
  document.getElementById('port-pnl').textContent=fmtS(pnl);
  document.getElementById('port-pnl').className='metric-val mono '+(pnl>=0?'g':'r');
  document.getElementById('port-ret-pct').textContent=(retPct>=0?'+':'')+retPct.toFixed(2)+'%';
  document.getElementById('port-ret-pct').className='metric-val mono '+(retPct>=0?'g':'r');

  // ── Positions ──
  if(portfolio.length===0){
    document.getElementById('port-positions').innerHTML='<div style="text-align:center;padding:2rem;color:var(--t3);font-size:13px;">No tienes posiciones. Ve al Mercado para invertir.</div>';
  } else {
    document.getElementById('port-positions').innerHTML=
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr 100px;gap:8px;font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;padding:7px 10px;border-bottom:1px solid var(--c4);min-width:520px;"><span>Activo</span><span>Tipo</span><span>Qty</span><span>P.compra</span><span>P.actual</span><span>P&L</span><span></span></div>'
      +portfolio.map(p=>{
        const cur=p.currentPrice||p.buyPrice;
        const pl=cur*p.qty-p.invested;
        const plPct=p.invested>0?(pl/p.invested*100):0;
        return`<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr 100px;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.03);background:${pl>=0?'rgba(0,208,132,.045)':'rgba(255,71,87,.045)'};border-left:2px solid ${pl>=0?'var(--green)':'var(--red)'};">
          <div><div style="font-weight:500;font-size:13px;">${p.name}</div><div style="font-size:10px;color:var(--t3);">${p.ticker}</div></div>
          <div><span class="badge ${typeBadgeCls(p.type)}">${p.type}</span></div>
          <div class="mono" style="font-size:12px;">${p.qty}</div>
          <div class="mono" style="font-size:12px;">$${fmt(p.buyPrice)}</div>
          <div class="mono" style="font-size:12px;">$${fmt(cur)}</div>
          <div class="mono ${pl>=0?'g':'r'}" style="font-size:12px;">${pl>=0?'+':'-'}$${fmt(Math.abs(pl))} (${plPct.toFixed(1)}%)</div>
          <button class="btn btn-sell btn-xs" onclick="sellFromPortfolio('${p.id}','${p.type}')"><i class="ti ti-minus"></i> Vender</button>
        </div>`;
      }).join('');
  }

  // ── CHART 1: Evolución REAL del patrimonio (NAV registrado por tick durante la sesión) ──
  // Los cinco gráficos de Chart.js de esta página (evolución, dona,
  // dos de barras, y dispersión) se destruían y recreaban por
  // completo en cada ciclo de precios — una operación genuinamente
  // costosa del navegador, confirmada con medición real: 63ms de
  // los aproximadamente 68ms que tomaba un ciclo completo con una
  // cartera de 15 posiciones. Los números y la tabla de posiciones
  // siguen actualizándose en cada ciclo (son baratos); los gráficos
  // ahora se reconstruyen solo cada tercer ciclo (~15 segundos en
  // vez de 5), un retraso imperceptible para un estudiante viendo
  // su cartera con normalidad, pero con un tercio del costo real.
  window.__contadorRenderPortfolio = (window.__contadorRenderPortfolio || 0) + 1;
  if(!permitirSaltarGraficos || window.__contadorRenderPortfolio % 3 === 1 || !portEvolInst){
  portEvolInst=dc(portEvolInst);
  {const _c=document.getElementById('port-evolution');if(_c&&typeof Chart!=='undefined'){
    const evL=[],evT=[],evI=[];
    if(navHistory.length >= 2){
      // Muestreo: hasta 40 puntos equiespaciados del histórico real
      const N=navHistory.length, step=Math.max(1,Math.floor(N/40));
      for(let i=0;i<N;i+=step){
        const pt=navHistory[i];
        const d=new Date(pt.t);
        evL.push(d.toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'}));
        evT.push(pt.value);
        evI.push(pt.invested);
      }
      // Asegura incluir el último punto (estado actual)
      const last=navHistory[N-1];
      evL.push('Ahora'); evT.push(last.value); evI.push(last.invested);
    } else {
      // Aún sin histórico (sesión recién abierta): punto único actual, sin inventar pasado
      evL.push('Inicio'); evT.push(+portVal.toFixed(0)); evI.push(+totalInv.toFixed(0));
    }
    portEvolInst=new Chart(_c,{type:'line',data:{labels:evL,datasets:[
      {label:'Valor cartera (NAV real)',data:evT,borderColor:'#00c4ff',backgroundColor:'rgba(0,196,255,.07)',tension:.3,fill:true,pointRadius:0,borderWidth:2},
      {label:'Capital invertido',data:evI,borderColor:'rgba(255,180,0,.55)',borderDash:[5,4],fill:false,pointRadius:0,borderWidth:1.5},
    ]},options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#7a8ab0',font:{size:10}}}},
      scales:{x:{ticks:{color:'#3d4d72',font:{size:10},maxTicksLimit:8},grid:{color:'rgba(255,255,255,.03)'}},
              y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.03)'}}}}});
  }}

  // ── CHART 2: Donut distribución ──
  portDonutInst=dc(portDonutInst);
  {const _c=document.getElementById('port-donut');if(_c&&typeof Chart!=='undefined'){
    const byT={accion:0,bono:0,divisa:0,futuro:0,derivado:0};
    portfolio.forEach(p=>{if(byT[p.type]!==undefined)byT[p.type]+=(p.currentPrice||p.buyPrice)*p.qty;});
    portDonutInst=new Chart(_c,{type:'doughnut',data:{
      labels:['Acciones','Bonos','Divisas','Futuros','Derivados'],
      datasets:[{data:[byT.accion,byT.bono,byT.divisa,byT.futuro,byT.derivado],
        backgroundColor:['#2962ff','#00d084','#ffb400','#ff4757','#00c4ff'],borderWidth:0,borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{
        legend:{labels:{color:'#7a8ab0',font:{size:10}}},
        tooltip:{callbacks:{label:c=>{const t=Object.values(byT).reduce((s,v)=>s+v,0);return c.label+': $'+fmt(c.raw)+' ('+(t>0?(c.raw/t*100).toFixed(1):0)+'%)';}}}}}});
  }}

  // ── CHART 3: P&L por posición ──
  portPnlBarInst=dc(portPnlBarInst);
  {const _c=document.getElementById('port-pnl-bar');if(_c&&typeof Chart!=='undefined'&&portfolio.length>0){
    const lbs=portfolio.map(p=>p.ticker);
    const pnls=portfolio.map(p=>{const cur=p.currentPrice||p.buyPrice;return +((cur-p.buyPrice)*p.qty).toFixed(2);});
    portPnlBarInst=new Chart(_c,{type:'bar',data:{labels:lbs,datasets:[{label:'P&L ($)',data:pnls,
      backgroundColor:pnls.map(v=>v>=0?'rgba(0,208,132,.72)':'rgba(255,71,87,.72)'),borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>(c.raw>=0?'+$':'-$')+fmt(Math.abs(c.raw))}}},
        scales:{x:{ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},
                y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>'$'+Math.round(v)},grid:{color:'rgba(255,255,255,.03)'},
                  suggestedMin:Math.min(0,...pnls),suggestedMax:Math.max(0,...pnls)}}}});
  }}

  // ── CHART 4: Retorno % por posición ──
  portRetBarInst=dc(portRetBarInst);
  {const _c=document.getElementById('port-ret-bar');if(_c&&typeof Chart!=='undefined'&&portfolio.length>0){
    const lbs=portfolio.map(p=>p.ticker);
    const rets=portfolio.map(p=>{const cur=p.currentPrice||p.buyPrice;return +((cur-p.buyPrice)/p.buyPrice*100).toFixed(2);});
    portRetBarInst=new Chart(_c,{type:'bar',data:{labels:lbs,datasets:[{label:'Retorno %',data:rets,
      backgroundColor:rets.map(v=>v>=0?'rgba(0,196,255,.72)':'rgba(255,71,87,.72)'),borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>(c.raw>=0?'+':'')+c.raw.toFixed(2)+'%'}}},
        scales:{x:{ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},
                y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.03)'},
                  suggestedMin:Math.min(0,...rets)-1,suggestedMax:Math.max(0,...rets)+1}}}});
  }}

  // ── CHART 5: Scatter σ vs Retorno ──
  portScatterInst=dc(portScatterInst);
  {const _c=document.getElementById('port-scatter');if(_c&&typeof Chart!=='undefined'&&portfolio.length>0){
    const pts=portfolio.map(p=>{const cur=p.currentPrice||p.buyPrice;return{x:p.sigma,y:+((cur-p.buyPrice)/p.buyPrice*100).toFixed(2),label:p.ticker};});
    portScatterInst=new Chart(_c,{type:'scatter',data:{datasets:[{data:pts,
      backgroundColor:pts.map(p=>p.y>=0?'rgba(0,208,132,.72)':'rgba(255,71,87,.72)'),pointRadius:9}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const d=c.dataset.data[c.dataIndex];return d.label+': σ='+d.x.toFixed(1)+'%  r='+(d.y>=0?'+':'')+d.y.toFixed(2)+'%';}}}},
        scales:{x:{title:{display:true,text:'Riesgo σ (%)',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},
                y:{title:{display:true,text:'Retorno (%)',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'},
                  suggestedMin:Math.min(0,...pts.map(p=>p.y))-1,suggestedMax:Math.max(0,...pts.map(p=>p.y))+1}}}});
  }}
  }

  // ── FINANCIAL EVALUATION ──
  const winRate  = portfolio.length>0?Math.round(winners.length/portfolio.length*100):0;
  const shLabel  = sh>1?'Excelente':sh>0.5?'Bueno':sh>0?'Aceptable':'Ineficiente';
  const shColor  = sh>1||sh>0.5?'var(--green)':sh>0?'var(--amber)':'var(--red)';
  const riskColor= aS<10?'var(--green)':aS<20?'var(--amber)':'var(--red)';
  const riskLabel= aS<10?'Bajo':aS<20?'Moderado':aS<30?'Alto':'Muy alto';
  const varColor = var95<5000?'var(--green)':var95<15000?'var(--amber)':'var(--red)';
  const divColor = portfolio.length<3?'var(--red)':portfolio.length<5?'var(--amber)':'var(--green)';
  const divScore = portfolio.length<3?'Baja':portfolio.length<5?'Media':'Alta';

  document.getElementById('port-evaluation').innerHTML=portfolio.length===0?'':
    `<div class="card" style="margin-bottom:14px;border-color:rgba(0,196,255,.18);">
      <div class="card-title"><i class="ti ti-report-analytics" style="color:var(--accent2);"></i> Evaluación financiera estructurada</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;">
        ${[
          ['Retorno total',(retPct>=0?'+':'')+retPct.toFixed(2)+'%',retPct>8?'var(--green)':retPct>0?'var(--amber)':'var(--red)',retPct>8?'Óptimo':retPct>0?'Positivo':'Negativo'],
          ['Ratio Sharpe',sh.toFixed(2),shColor,shLabel],
          ['Riesgo σ prom.',aS.toFixed(1)+'%',riskColor,riskLabel],
          ['VaR 95% anual','$'+fmt(var95),varColor,var95<5000?'Controlado':var95<15000?'Moderado':'Elevado'],
          ['Diversificación',portfolio.length+' pos.',divColor,divScore],
        ].map(([l,v,c,s])=>`<div style="background:var(--c3);border-radius:var(--r2);padding:12px;text-align:center;border-top:3px solid ${c};">
          <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${l}</div>
          <div style="font-size:18px;font-family:var(--font-mono);font-weight:700;color:${c};margin-bottom:2px;">${v}</div>
          <div style="font-size:10px;color:${c};font-weight:600;">${s}</div>
        </div>`).join('')}
      </div>
      <div class="grid2" style="gap:12px;">
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Métricas cuantitativas</div>
          ${[
            ['Capital invertido','$'+fmt(totalInv),''],
            ['Valor actual de cartera','$'+fmt(curVal),''],
            ['Ganancia / Pérdida neta',(pnl>=0?'+$':'-$')+fmt(Math.abs(pnl)),pnl>=0?'g':'r'],
            ['Retorno del período (realizado)',(retPct>=0?'+':'')+retPct.toFixed(2)+'%',retPct>=0?'g':'r'],
            ['Beta de cartera (ponderada)',pm.beta?pm.beta.toFixed(2):'N/A',''],
            ['VaR 95% (diversificado)','$'+fmt(var95),'r'],
            ['Posiciones ganadoras',winners.length+' / '+portfolio.length+' ('+winRate+'%)',winRate>=50?'g':'r'],
            ['Posiciones perdedoras',losers.length+' / '+portfolio.length,''],
          ].map(([l,v,c])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--t2);">${conAyuda(l)}</span><span class="mono ${c}" style="font-weight:500;">${v}</span></div>`).join('')}
        </div>
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Dictamen del analista</div>
          <div class="info-box ${retPct>=8?'success':retPct>=0?'warn':'danger'}" style="margin-bottom:12px;font-size:12px;line-height:1.65;">
            ${retPct>=8?`<b>Cartera con desempeño óptimo.</b> Retorno de <b>+${retPct.toFixed(2)}%</b> supera el benchmark de renta fija. Ratio Sharpe de <b>${sh.toFixed(2)}</b> indica compensación eficiente por riesgo asumido.`:
              retPct>=0?`<b>Cartera con desempeño positivo.</b> Retorno de <b>+${retPct.toFixed(2)}%</b> por debajo del umbral de referencia del 8%. Sharpe de <b>${sh.toFixed(2)}</b>. Considera rebalancear hacia activos de mayor retorno esperado.`:
              `<b>Cartera en terreno negativo.</b> Pérdida acumulada de <b>${retPct.toFixed(2)}%</b>. Volatilidad σ=${aS.toFixed(1)}% eleva el VaR. Evalúa reducir posiciones especulativas y aumentar renta fija.`}
          </div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Composición del portafolio</div>
          ${['accion','bono','divisa','futuro','derivado'].map(t=>{
            const v=portfolio.filter(p=>p.type===t).reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
            const pctv=curVal>0?(v/curVal*100):0;
            const col=t==='accion'?'#2962ff':t==='bono'?'#00d084':t==='divisa'?'#ffb400':t==='futuro'?'#ff4757':'#00c4ff';
            if(!pctv)return'';
            return`<div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                <span style="color:var(--t2);text-transform:capitalize;">${t}s</span>
                <span class="mono" style="color:${col};">${pctv.toFixed(1)}%</span>
              </div>
              <div style="height:5px;border-radius:3px;background:var(--c4);">
                <div style="width:${pctv}%;height:5px;border-radius:3px;background:${col};"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  // ── Risk metrics ──
  document.getElementById('port-risk-metrics').innerHTML=[
    ['Volatilidad promedio σ',aS.toFixed(1)+'%'],['Retorno esperado prom.',aR.toFixed(1)+'%'],
    ['Ratio Sharpe',sh.toFixed(2)],['VaR 95% 1 año','$'+fmt(var95)],
    ['Posiciones activas',portfolio.length],['Ganadoras / Perdedoras',winners.length+' / '+losers.length],
    ['Total transacciones',txHistory.length],
  ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.03);"><span style="color:var(--t2);">${l}</span><span class="mono">${v}</span></div>`).join('');

  // ── Transaction history ──
  renderTablaHistorialTx(aplicarFiltroYOrdenTx(txHistory));
  autoColapsarEnMovil(document.getElementById('page-cartera'));
}

// ── Buscador y orden por columnas del historial de transacciones ──
let txFiltroActual = '';
let txOrdenColumna = null;
let txOrdenAscendente = false;
let txFiltroTipo = 'todas'; // 'todas' | 'compras' | 'ventas' | 'ingresos'
let txOcultarIngresos = false; // excluye cupones y dividendos, que se repiten mucho

function aplicarFiltroYOrdenTx(lista){
  let out = lista;
  // Los cupones y dividendos son ingresos recurrentes y frecuentes —
  // se pueden excluir de la vista para que no dominen una lista que,
  // de otra forma, se vuelve larga muy rápido con operaciones reales.
  if(txOcultarIngresos) out = out.filter(t => t.action!=='Cupón' && t.action!=='Dividendo');
  if(txFiltroTipo==='compras') out = out.filter(t => t.action==='Compra');
  else if(txFiltroTipo==='ventas') out = out.filter(t => t.action==='Venta');
  else if(txFiltroTipo==='ingresos') out = out.filter(t => t.action==='Cupón' || t.action==='Dividendo');
  const q = txFiltroActual.trim().toLowerCase();
  if(q) out = out.filter(t => (t.name||'').toLowerCase().includes(q) || (t.action||'').toLowerCase().includes(q) || (t.type||'').toLowerCase().includes(q));
  if(txOrdenColumna){
    out = [...out].sort((a,b) => {
      let va = a[txOrdenColumna], vb = b[txOrdenColumna];
      if(typeof va === 'string') va = va.toLowerCase();
      if(typeof vb === 'string') vb = vb.toLowerCase();
      if(va < vb) return txOrdenAscendente ? -1 : 1;
      if(va > vb) return txOrdenAscendente ? 1 : -1;
      return 0;
    });
  }
  return out;
}

function fijarFiltroTipoTx(tipo, boton){
  txFiltroTipo = tipo;
  document.querySelectorAll('.tx-filtro-tipo-btn').forEach(b=>b.classList.remove('active'));
  if(boton) boton.classList.add('active');
  renderTablaHistorialTx(aplicarFiltroYOrdenTx(txHistory));
}

function alternarOcultarIngresosTx(){
  txOcultarIngresos = !txOcultarIngresos;
  const btn = document.getElementById('tx-toggle-ingresos');
  if(btn) btn.classList.toggle('active', txOcultarIngresos);
  renderTablaHistorialTx(aplicarFiltroYOrdenTx(txHistory));
}

function filtrarHistorialTx(query){
  txFiltroActual = query;
  renderTablaHistorialTx(aplicarFiltroYOrdenTx(txHistory));
}

function ordenarHistorialTx(columna){
  if(txOrdenColumna === columna) txOrdenAscendente = !txOrdenAscendente;
  else { txOrdenColumna = columna; txOrdenAscendente = true; }
  renderTablaHistorialTx(aplicarFiltroYOrdenTx(txHistory));
}

function flechaOrden(columna){
  if(txOrdenColumna !== columna) return '';
  return txOrdenAscendente ? ' ↑' : ' ↓';
}

function renderTablaHistorialTx(lista){
  const cont = document.getElementById('port-history');
  if(!cont) return;

  // Barra de filtros rápidos — siempre visible, incluso con la lista
  // vacía, para que el estudiante pueda cambiar de filtro sin tener
  // que borrar la búsqueda primero.
  const barraFiltros = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
      <button class="tx-filtro-tipo-btn ${txFiltroTipo==='todas'?'active':''}" onclick="fijarFiltroTipoTx('todas', this)">Todas</button>
      <button class="tx-filtro-tipo-btn ${txFiltroTipo==='compras'?'active':''}" onclick="fijarFiltroTipoTx('compras', this)">Compras</button>
      <button class="tx-filtro-tipo-btn ${txFiltroTipo==='ventas'?'active':''}" onclick="fijarFiltroTipoTx('ventas', this)">Ventas</button>
      <button class="tx-filtro-tipo-btn ${txFiltroTipo==='ingresos'?'active':''}" onclick="fijarFiltroTipoTx('ingresos', this)">Cupones y dividendos</button>
      <button class="tx-filtro-tipo-btn ${txOcultarIngresos?'active':''}" id="tx-toggle-ingresos" onclick="alternarOcultarIngresosTx()" style="margin-left:auto;">
        <i class="ti ${txOcultarIngresos?'ti-eye-off':'ti-eye'}" style="font-size:12px;"></i> Ocultar cupones/dividendos
      </button>
    </div>`;

  if(txHistory.length===0){
    cont.innerHTML = barraFiltros + '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:13px;">Aún no hay transacciones. Ve al Mercado para comenzar.</div>';
    return;
  }
  if(lista.length===0){
    cont.innerHTML = barraFiltros + '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:13px;">Ninguna transacción coincide con este filtro.</div>';
    return;
  }

  // Agrupar por día real — las transacciones antiguas, guardadas
  // antes de que se empezara a registrar la fecha completa, caen
  // todas juntas en un grupo aparte, sin perderlas ni romper nada.
  const grupos = new Map();
  lista.forEach(t => {
    const clave = t.timestamp ? new Date(t.timestamp).toLocaleDateString('es-PA', {weekday:'long', day:'numeric', month:'long'}) : 'Antes de esta actualización';
    if(!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(t);
  });

  const th = (col, label) => `<th style="cursor:pointer;user-select:none;" onclick="ordenarHistorialTx('${col}')">${label}${flechaOrden(col)}</th>`;
  const filaDe = (t) => {
    const isIncome = t.action==='Cupón'||t.action==='Dividendo';
    const badgeCls = t.action==='Compra'?'badge-green':isIncome?'badge-cyan':'badge-red';
    const effClass = t.action==='Compra'?'r':'g';
    const effSign  = t.action==='Compra'?'−$':'+$';
    return `<tr>
        <td class="mono" style="font-size:10px;color:var(--t3);">${t.date}</td>
        <td><span class="badge ${badgeCls}">${t.action}</span></td>
        <td style="font-weight:500;">${t.name}</td>
        <td><span class="badge ${typeBadgeCls(t.type||'accion')}" style="font-size:9px;">${t.type||'—'}</span></td>
        <td class="mono">${t.qty===''||t.qty==null?'—':t.qty+(isIncome?'':' u.')}</td>
        <td class="mono">${t.price>0?'$'+fmt(t.price):'—'}</td>
        <td class="mono">$${fmt(t.total)}</td>
        <td class="mono ${effClass}">${effSign}${fmt(t.total)}</td>
      </tr>`;
  };

  const bloquesPorDia = [...grupos.entries()].map(([dia, ops], i) => `
    <div class="tx-grupo-dia" style="margin-bottom:10px;">
      <div class="tx-grupo-dia-header" onclick="this.nextElementSibling.classList.toggle('colapsado');this.querySelector('.ti-chevron-down').style.transform=this.nextElementSibling.classList.contains('colapsado')?'rotate(-90deg)':'rotate(0)';" style="display:flex;align-items:center;gap:6px;padding:8px 4px;cursor:pointer;font-size:12px;font-weight:600;color:var(--t2);border-bottom:1px solid var(--c4);">
        <i class="ti ti-chevron-down" style="font-size:14px;transition:transform .15s;"></i>
        ${dia.charAt(0).toUpperCase()+dia.slice(1)}
        <span style="font-weight:400;color:var(--t3);">· ${ops.length} operación${ops.length===1?'':'es'}</span>
      </div>
      <div class="tx-grupo-dia-body">
        <table><thead><tr>${th('date','Hora')}${th('action','Operación')}${th('name','Activo')}${th('type','Tipo')}${th('qty','Qty')}${th('price','Precio')}${th('total','Total')}<th>Efecto</th></tr></thead>
        <tbody>${ops.map(filaDe).join('')}</tbody></table>
      </div>
    </div>`).join('');

  cont.innerHTML = barraFiltros + bloquesPorDia +
      `<div style="font-size:10px;color:var(--t3);text-align:right;margin-top:8px;">${lista.length} de ${txHistory.length} op. · Compras: ${txHistory.filter(t=>t.action==='Compra').length} · Ventas: ${txHistory.filter(t=>t.action==='Venta').length} · Ingresos: ${txHistory.filter(t=>t.action==='Cupón'||t.action==='Dividendo').length}</div>`;
}

function renderLabPicker(){
  const makeGrid=(assets,containerId)=>{
    const el=document.getElementById(containerId);
    if(!el)return;
    el.innerHTML=assets.map(a=>`
      <div class="lap-item ${labPickedIds.includes(a.id)?'picked':''}" onclick="toggleLabPick('${a.id}')">
        <div><div class="lap-name">${a.ticker}</div><div class="lap-sub">${a.name.substring(0,18)}</div></div>
        <div class="lap-check">${labPickedIds.includes(a.id)?'✓':''}</div>
      </div>`).join('');
  };
  makeGrid(STOCKS,   'lap-acciones');
  makeGrid(BONDS,    'lap-bonos');
  makeGrid(FOREX,    'lap-divisas');
  makeGrid(FUTURES,  'lap-futuros');
  makeGrid(DERIVATIVES,'lap-derivados');
  renderPickedChips();
}
function toggleLabPick(id){
  if(labPickedIds.includes(id))labPickedIds=labPickedIds.filter(x=>x!==id);
  else labPickedIds.push(id);
  renderLabPicker();
}
function renderPickedChips(){
  const container=document.getElementById('lab-picked-list');
  if(!container)return;
  if(labPickedIds.length===0){container.innerHTML='<span style="font-size:12px;color:var(--t3);">Ningún activo seleccionado aún</span>';return;}
  const icons={accion:'📈',bono:'🏦',divisa:'💱',futuro:'📊',derivado:'🔷'};
  container.innerHTML=labPickedIds.map(id=>{
    const a=allAssets().find(x=>x.id===id);if(!a)return'';
    return`<span class="picked-chip">${icons[a.type]||'📌'} ${a.ticker}<button onclick="toggleLabPick('${id}')"><i class="ti ti-x"></i></button></span>`;
  }).join('');
}

// ═══════════════════ LAB ═══════════════════
function onHorizonChange(){
  document.getElementById('custom-lab-wrap').style.display=document.getElementById('lab-horizon').value==='custom'?'block':'none';
  updateLabConfig();
}
function getLabMonths(){const v=document.getElementById('lab-horizon').value;if(v==='custom')return Math.max(1,Math.min(36,+document.getElementById('lab-custom-months').value||6));return+v;}
function updateLabConfig(){
  // El atributo min="1000" del campo solo frena las flechitas del navegador,
  // no evita que alguien escriba un número negativo a mano — por eso se
  // vuelve a forzar el mínimo aquí, en el propio cálculo.
  labConfig.capital=Math.max(1000, +document.getElementById('lab-capital').value||50000);
  labConfig.horizon=getLabMonths();
  labConfig.target=+document.getElementById('lab-target').value||8;
  // Restricciones opcionales del profesor — si el campo queda vacío,
  // no hay límite en esa dimensión (undefined, no cero, para no
  // confundir "sin límite" con "límite de cero por ciento").
  const riesgoMax = document.getElementById('lab-riesgo-max')?.value;
  const maxPorActivo = document.getElementById('lab-max-por-activo')?.value;
  const minDiversificacion = document.getElementById('lab-min-diversificacion')?.value;
  labConfig.riesgoMaximo = riesgoMax ? +riesgoMax : undefined;
  labConfig.maxPorActivo = maxPorActivo ? +maxPorActivo : undefined;
  labConfig.minDiversificacion = minDiversificacion ? +minDiversificacion : undefined;
  document.getElementById('lab-horizon-show').textContent=labConfig.horizon+' meses';
  document.getElementById('lab-target-show').textContent=labConfig.target+'%';
  document.getElementById('lab-capital-show').textContent=labConfig.capital.toLocaleString('es-PA');
}
function initLab(){
  updateLabConfig();
  labConfig.started=true;
  labConfig.startCapital=labConfig.capital;
  // Lab capital is INDEPENDENT — never touches market capital
  labCapital=labConfig.capital;
  document.getElementById('lab-init-show').textContent='$'+fmt(labConfig.startCapital);
  document.getElementById('lab-body').style.display='block';
  document.getElementById('lab-result-card').style.display='none';
  updateLabCapitalMeter();
  suggestAllocation();
  renderLabPicker();
  notify('Laboratorio CapitalLab iniciado ✓');
}
function updateLabCapitalMeter(){
  const cur=labCapital;
  const init=labConfig.startCapital||1;
  const invested=0; // lab doesn't hold real positions — Monte Carlo only
  const total=cur;
  const pct=Math.max(0,Math.min(100,(cur/init)*100));
  document.getElementById('lab-current-show').textContent='$'+fmt(total);
  document.getElementById('lab-invested-show').textContent='$'+fmt(invested);
  document.getElementById('lab-avail-show').textContent='$'+fmt(cur);
  document.getElementById('lab-cap-pct').textContent=pct.toFixed(1)+'%';
  const bar=document.getElementById('lab-cap-bar');
  bar.style.width=pct+'%';
  bar.style.background=pct>80?'var(--green)':pct>50?'var(--amber)':'var(--red)';
  const achieved=(total-init)/init*100;
  const prog=Math.max(0,Math.min(100,(achieved/labConfig.target)*100));
  document.getElementById('lab-prog-pct').textContent=prog.toFixed(1)+'%';
  document.getElementById('lab-prog-bar').style.width=prog+'%';
  document.getElementById('lab-prog-bar').style.background=prog>=100?'var(--green)':prog>=60?'var(--amber)':'var(--red)';
}
function suggestAllocation(){
  const p=document.getElementById('lab-perfil').value;
  // [bonos, acciones, divisas, futuros, derivados]
  const allocs={
    conservador:[50,25,15,5,5],
    moderado:   [30,35,15,10,10],
    agresivo:   [10,55,10,15,10]
  }[p];
  ['b','a','d','f','dv'].forEach((k,i)=>{
    const el=document.getElementById('lab-pct-'+k);
    const vEl=document.getElementById('lab-pct-'+k+'-v');
    if(el)el.value=allocs[i];
    if(vEl)vEl.textContent=allocs[i]+'%';
  });
  document.getElementById('lab-suggestion').innerHTML={
    conservador:'<b>Conservador:</b> Mayor peso en bonos para preservar capital. Exposición mínima a futuros y derivados.',
    moderado:   '<b>Moderado:</b> Balance entre acciones, bonos y diversificación en futuros y derivados.',
    agresivo:   '<b>Agresivo:</b> Dominio de acciones con exposición a futuros para maximizar retorno potencial.'
  }[p];
  labAlloc();
}
function labAlloc(){
  const vals=['b','a','d','f','dv'].map(k=>{
    const el=document.getElementById('lab-pct-'+k);
    const vEl=document.getElementById('lab-pct-'+k+'-v');
    const v=el?+el.value:0;
    if(vEl)vEl.textContent=v+'%';
    return v;
  });
  const sum=vals.reduce((s,v)=>s+v,0);
  document.getElementById('lab-alloc-warn').style.display=(sum!==100)?'block':'none';
}
function simulateLab(){
  const pb =+document.getElementById('lab-pct-b').value/100;
  const pa =+document.getElementById('lab-pct-a').value/100;
  const pd =+document.getElementById('lab-pct-d').value/100;
  const pf =+document.getElementById('lab-pct-f').value/100;
  const pdv=+document.getElementById('lab-pct-dv').value/100;
  const totalPct=Math.round((pb+pa+pd+pf+pdv)*100);
  if(totalPct!==100){notify('La suma de porcentajes debe ser exactamente 100%','error');return;}

  const strat=document.getElementById('lab-strat-name').value||'Sin nombre';
  const months=labConfig.horizon;
  const init=labConfig.startCapital;
  const pickedAssets=labPickedIds.length>0?labPickedIds.map(id=>allAssets().find(a=>a.id===id)).filter(Boolean):null;

  // Default returns & sigmas per type
  let retB=5.2,sigB=4.5,retA=10.8,sigA=18.2,retD=4.1,sigD=10.4,retF=8.2,sigF=32.8,retDV=6.8,sigDV=18.4;
  if(pickedAssets){
    const byType=t=>pickedAssets.filter(a=>a.type===t);
    const avg=(arr,k)=>arr.length?arr.reduce((s,a)=>s+a[k],0)/arr.length:null;
    // Live market bias: include the accumulated price change of each asset during the session
    // so lab prices stay aligned with the market/cartera live prices.
    const liveRet=a=>{
      const base=a.price||a.currentPrice;
      const cur=a.currentPrice||a.price;
      const sessionChange=base>0?((cur-base)/base*100):0;
      return a.ret + sessionChange; // intrinsic return + live market movement
    };
    const avgLive=arr=>arr.length?arr.reduce((s,a)=>s+liveRet(a),0)/arr.length:null;
    const pb2=byType('bono'),pa2=byType('accion'),pd2=byType('divisa'),pf2=byType('futuro'),pdv2=byType('derivado');
    if(pb2.length){retB=avgLive(pb2);sigB=avg(pb2,'sigma');}
    if(pa2.length){retA=avgLive(pa2);sigA=avg(pa2,'sigma');}
    if(pd2.length){retD=avgLive(pd2);sigD=avg(pd2,'sigma');}
    if(pf2.length){retF=avgLive(pf2);sigF=avg(pf2,'sigma');}
    if(pdv2.length){retDV=avgLive(pdv2);sigDV=avg(pdv2,'sigma');}
  }

  // ── SIMULACIÓN MONTE CARLO REAL — N trayectorias ──
  // Corre miles de caminos aleatorios y reporta la DISTRIBUCIÓN de resultados
  // (media, percentiles, probabilidad de meta y de pérdida), no una sola corrida.
  const retPort=pb*retB+pa*retA+pd*retD+pf*retF+pdv*retDV;
  // Volatilidad de cartera con CORRELACIÓN parcial entre clases (no independencia total).
  // Modelo de un factor: componente sistemática correlacionada + idiosincrásica diversificable.
  const RHO = 0.35;   // correlación promedio entre clases de activo (factor de mercado común)
  const weightedSig = pb*sigB + pa*sigA + pd*sigD + pf*sigF + pdv*sigDV;          // caso ρ=1
  const indepSig    = Math.sqrt(Math.pow(pb*sigB,2)+Math.pow(pa*sigA,2)+Math.pow(pd*sigD,2)+Math.pow(pf*sigF,2)+Math.pow(pdv*sigDV,2)); // caso ρ=0
  // Interpolación por correlación: σ² = ρ·(Σwσ)² + (1−ρ)·Σ(wσ)²
  const sigPort = Math.sqrt(RHO*Math.pow(weightedSig,2) + (1-RHO)*Math.pow(indepSig,2));

  // ═══════════════════════════════════════════════════════════════════════
  // VERIFICACIÓN DE RESTRICCIONES — antes de gastar la simulación
  // Monte Carlo completa, se compara la cartera propuesta contra las
  // reglas reales que puso el profesor (si las puso). Cada violación
  // se calcula con el número real, no una advertencia genérica.
  // ═══════════════════════════════════════════════════════════════
  const restricciones = [];
  if(labConfig.riesgoMaximo){
    const cumple = sigPort <= labConfig.riesgoMaximo;
    restricciones.push({ nombre:'Riesgo máximo', limite:`${labConfig.riesgoMaximo}%`, real:`${sigPort.toFixed(1)}%`, cumple, exceso: cumple?0:(((sigPort-labConfig.riesgoMaximo)/labConfig.riesgoMaximo)*100) });
  }
  if(labConfig.maxPorActivo){
    const mayorPct = Math.max(pb,pa,pd,pf,pdv)*100;
    const cumple = mayorPct <= labConfig.maxPorActivo;
    restricciones.push({ nombre:'Concentración máxima', limite:`${labConfig.maxPorActivo}%`, real:`${mayorPct.toFixed(0)}%`, cumple, exceso: cumple?0:(((mayorPct-labConfig.maxPorActivo)/labConfig.maxPorActivo)*100) });
  }
  if(labConfig.minDiversificacion){
    const tiposUsados = [pb,pa,pd,pf,pdv].filter(p=>p>0).length;
    const cumple = tiposUsados >= labConfig.minDiversificacion;
    restricciones.push({ nombre:'Diversificación mínima', limite:`${labConfig.minDiversificacion} tipos`, real:`${tiposUsados} tipos`, cumple, exceso:0 });
  }
  window.__ultimasRestriccionesLab = restricciones;
  window.__ultimaAlocacionLab = { Bonos:Math.round(pb*100), Acciones:Math.round(pa*100), Divisas:Math.round(pd*100), Futuros:Math.round(pf*100), Derivados:Math.round(pdv*100) };
  // Amplificación especulativa del laboratorio (1.5×–3× según perfil de agresividad).
  const ampFactor = document.getElementById('lab-perfil').value==='agresivo'?3.0:document.getElementById('lab-perfil').value==='moderado'?2.0:1.5;
  const sigAmp    = sigPort * ampFactor;
  const retMonth  = retPort/12;
  const sigMonth  = sigAmp/Math.sqrt(12);

  const N_PATHS = 5000;                 // número de trayectorias Monte Carlo
  const finals = new Float64Array(N_PATHS);
  let sumPaths = null;                  // trayectoria promedio (para graficar)
  let bestPath=null, worstPath=null, bestF=-Infinity, worstF=Infinity;
  const target$ = init*(1+labConfig.target/100);
  let countMeta=0, countLoss=0, countRuin=0;

  for(let p=0;p<N_PATHS;p++){
    let val=init;
    const path=[init];
    for(let m=1;m<=months;m++){
      const u1=Math.random()||1e-10, u2=Math.random()||1e-10;
      const z = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
      const shock = (retMonth/100) + (sigMonth/100)*z;
      val = val*(1+shock);
      // Evento de crash: 8% de probabilidad mensual de caída de −5% a −35%
      if(Math.random()<0.08){ val *= (1 - Math.random()*0.30 - 0.05); }
      val = Math.max(0, val);
      path.push(val);
    }
    finals[p]=val;
    if(val>=target$) countMeta++;
    if(val<init) countLoss++;
    if(val<=init*0.05) countRuin++;        // ruina: pérdida ≥95%
    // Acumular para la trayectoria media
    if(!sumPaths) sumPaths = path.slice();
    else for(let i=0;i<path.length;i++) sumPaths[i]+=path[i];
    if(val>bestF){bestF=val;bestPath=path;}
    if(val<worstF){worstF=val;worstPath=path;}
  }

  // Estadísticos de la distribución de resultados finales
  const sortedF = Array.from(finals).sort((a,b)=>a-b);
  const pctile = q => sortedF[Math.min(sortedF.length-1, Math.max(0, Math.floor(q*sortedF.length)))];
  const meanFinal = sortedF.reduce((s,v)=>s+v,0)/sortedF.length;
  const p5=pctile(0.05), p50=pctile(0.50), p95=pctile(0.95);
  const probMeta = countMeta/N_PATHS*100;
  const probLoss = countLoss/N_PATHS*100;
  const probRuin = countRuin/N_PATHS*100;
  const avgPath = sumPaths.map(v=>+(v/N_PATHS).toFixed(2));

  // Resultado "representativo" = mediana (no una corrida aislada y ruidosa)
  const finalVal = p50;
  const achieved=(finalVal-init)/init*100;
  const sh=sigAmp>0?(retPort-RF)/sigAmp:0;
  // VaR coherente con la volatilidad AMPLIFICADA efectivamente simulada (corrige Hallazgo 5).
  // VaR empírico al 5% directamente de la distribución Monte Carlo (pérdida potencial):
  const var95=Math.max(0, init - p5);
  const capEff=Math.min(150,Math.max(0,(finalVal/init)*100));
  const riskEff=Math.max(0,100-(sigPort*2));
  const passed=achieved>=labConfig.target;
  window.__ultimoContextoLab = { metaAlcanzada:passed, retornoPct:achieved.toFixed(1) };
  const calific=achieved>=labConfig.target*1.5?'Excelente':achieved>=labConfig.target?'Aprobado':achieved>=labConfig.target*.5?'Regular':'Por mejorar';

  const lbs=avgPath.map((_,i)=>i===0?'Inicio':'Mes '+i);
  const pts=avgPath;                     // trayectoria media para el dataset principal
  const bestPts=bestPath.map(v=>+v.toFixed(2));
  const worstPts=worstPath.map(v=>+v.toFixed(2));

  labChartInst=dc(labChartInst);
  {const _c=document.getElementById('lab-chart');if(_c&&typeof Chart!=='undefined'){labChartInst=new Chart(_c,{type:'line',data:{labels:lbs,datasets:[
    {label:'Mejor escenario (P100)',data:bestPts,borderColor:'rgba(0,208,132,.45)',borderWidth:1,borderDash:[4,3],tension:.3,pointRadius:0,fill:false},
    {label:'Trayectoria media',data:pts,borderColor:'#00c4ff',backgroundColor:'rgba(0,196,255,.07)',tension:.3,fill:true,pointRadius:0,borderWidth:2},
    {label:'Peor escenario (P0)',data:worstPts,borderColor:'rgba(255,71,87,.45)',borderWidth:1,borderDash:[4,3],tension:.3,pointRadius:0,fill:false},
    {label:'Meta',data:Array(pts.length).fill(+target$.toFixed(0)),borderColor:'rgba(255,180,0,.5)',borderDash:[6,4],borderWidth:1.5,pointRadius:0,fill:false}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a8ab0',font:{size:10}}}},scales:{x:{ticks:{color:'#3d4d72',maxTicksLimit:8,font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.03)'}}}}});}}


  // ── Lab capital is INDEPENDENT from market capital ──
  labCapital = Math.max(0, finalVal);
  updateLabCapitalMeter();

  let varExp='';
  if(achieved>labConfig.target)varExp=`En la mediana de ${N_PATHS.toLocaleString('es-PA')} trayectorias simuladas, tu capital creció <b>${achieved.toFixed(2)}%</b>, superando la meta de <b>${labConfig.target}%</b>. La probabilidad estimada de alcanzar la meta es <b>${probMeta.toFixed(1)}%</b>. Las acciones aportaron <b>${(pa*retA).toFixed(2)}%</b> y los futuros <b>${(pf*retF).toFixed(2)}%</b> al retorno esperado. Sharpe <b>${sh.toFixed(2)}</b>.`;
  else if(achieved>0)varExp=`En la mediana de ${N_PATHS.toLocaleString('es-PA')} trayectorias, tu capital creció <b>${achieved.toFixed(2)}%</b> sin alcanzar la meta de <b>${labConfig.target}%</b> (probabilidad de meta: <b>${probMeta.toFixed(1)}%</b>). La volatilidad amplificada σ=${sigAmp.toFixed(1)}% reduce la consistencia. Revisa la exposición a futuros y derivados.`;
  else varExp=`En la mediana de ${N_PATHS.toLocaleString('es-PA')} trayectorias, tu capital registró una pérdida del <b>${Math.abs(achieved).toFixed(2)}%</b>. La probabilidad de terminar con pérdida es <b>${probLoss.toFixed(1)}%</b> y la de ruina (≥95% de pérdida) <b>${probRuin.toFixed(1)}%</b>. Alta volatilidad (σ=${sigAmp.toFixed(1)}%) con shocks adversos erosionan el capital. Reduce exposición a instrumentos especulativos.`;

  const pickedNames=labPickedIds.length>0?labPickedIds.map(id=>{const a=allAssets().find(x=>x.id===id);return a?a.ticker:'';}).filter(Boolean).join(', '):'Todos los activos disponibles';

  // Transaction history HTML — solo compras y ventas, sin cupones ni
  // dividendos, que son clutter en un reporte de operaciones.
  const txOperacionesReales=txHistory.filter(t=>t.action==='Compra'||t.action==='Venta');
  const txHtml=txOperacionesReales.length===0
    ?'<div style="text-align:center;padding:1.2rem;color:var(--t3);font-size:12px;">Aún no hay transacciones registradas en el mercado.</div>'
    :`<table>
        <thead><tr><th>Hora</th><th>Operación</th><th>Activo</th><th>Tipo</th><th>Qty</th><th>Precio</th><th>Total</th><th>Efecto</th></tr></thead>
        <tbody>${txOperacionesReales.map(t=>`<tr>
          <td class="mono" style="font-size:10px;color:var(--t3);">${t.date}</td>
          <td><span class="badge ${t.action==='Compra'?'badge-green':'badge-red'}" style="font-size:9px;">${t.action}</span></td>
          <td style="font-weight:500;font-size:11px;">${t.name}</td>
          <td><span class="badge ${t.type==='accion'?'badge-blue':t.type==='bono'?'badge-green':t.type==='divisa'?'badge-amber':t.type==='futuro'?'badge-red':'badge-cyan'}" style="font-size:9px;">${t.type||'—'}</span></td>
          <td class="mono">${t.qty}u</td>
          <td class="mono">$${fmt(t.price)}</td>
          <td class="mono">$${fmt(t.total)}</td>
          <td class="mono ${t.action==='Compra'?'r':'g'}" style="font-weight:600;">${t.action==='Compra'?'−':'+'} $${fmt(t.total)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div style="font-size:10px;color:var(--t3);text-align:right;margin-top:6px;">
        ${txOperacionesReales.length} operación(es) · Compras: ${txOperacionesReales.filter(t=>t.action==='Compra').length} · Ventas: ${txOperacionesReales.filter(t=>t.action==='Venta').length}
      </div>`;

  // Allocation table rows for all 5 types
  const allocRows=[
    ['Bonos',    pb,retB,sigB,pb>0.5?'<span class="badge badge-green">Conservador</span>':'<span class="badge badge-blue">Balanceado</span>'],
    ['Acciones', pa,retA,sigA,pa>0.6?'<span class="badge badge-red">Agresivo</span>':pa>0.3?'<span class="badge badge-amber">Moderado</span>':'<span class="badge badge-green">Conservador</span>'],
    ['Divisas',  pd,retD,sigD,'<span class="badge badge-cyan">Diversificador</span>'],
    ['Futuros',  pf,retF,sigF,pf>0.2?'<span class="badge badge-red">Especulativo</span>':'<span class="badge badge-amber">Táctico</span>'],
    ['Derivados',pdv,retDV,sigDV,pdv>0.15?'<span class="badge badge-red">Cobertura avanzada</span>':'<span class="badge badge-cyan">Cobertura</span>'],
  ].filter(r=>r[1]>0);

  const rc=document.getElementById('lab-result-card');
  rc.style.display='block';
  rc.innerHTML=`<div class="card" style="border-color:rgba(0,196,255,.2);">
    <div class="card-title" style="font-size:16px;margin-bottom:14px;"><i class="ti ti-report-analytics" style="color:var(--accent2);font-size:18px;"></i> Resultados del Laboratorio CapitalLab</div>
    <div class="${passed?'verdict-win':achieved>0?'verdict-neutral':'verdict-loss'}" style="margin-bottom:14px;">
      <div style="font-size:15px;font-weight:600;color:${passed?'var(--green)':achieved>0?'var(--amber)':'var(--red)'};margin-bottom:4px;">${passed?'✓ Meta alcanzada':'✗ Meta no alcanzada'} — <b>${calific}</b></div>
      <div style="font-size:12px;color:var(--t2);">Estrategia: <b style="color:var(--t1);">${strat}</b> · ${months} meses · ${document.getElementById('lab-perfil').value} · Portafolio: <b style="color:var(--accent2);">${pickedNames}</b></div>
    </div>
    ${(window.__ultimasRestriccionesLab||[]).length ? `
    <div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12.5px;margin-bottom:8px;"><i class="ti ti-shield-lock"></i> Cumplimiento de restricciones del profesor</div>
      ${window.__ultimasRestriccionesLab.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:7px 10px;background:${r.cumple?'rgba(0,208,132,.08)':'rgba(255,71,87,.08)'};border-left:3px solid ${r.cumple?'var(--green)':'var(--red)'};border-radius:4px;margin-bottom:5px;">
          <span>${r.cumple?'✓':'✗'} <b>${r.nombre}</b>: límite ${r.limite}, tu cartera ${r.real}${!r.cumple && r.exceso>0 ? ` <span style="color:var(--red);">(${r.exceso.toFixed(0)}% por encima del permitido)</span>` : ''}</span>
        </div>
      `).join('')}
    </div>` : ''}
    ${(window.__ultimasRestriccionesLab||[]).some(r=>!r.cumple) ? `
    <div style="margin-bottom:14px;">
      <button class="btn btn-ghost btn-sm" onclick="generarReflexionRestriccionesIA()" id="btn-reflexion-lab"><i class="ti ti-bulb"></i> ¿Qué decisión cambiarías? (IA)</button>
      <div id="reflexion-restricciones-resultado" style="margin-top:10px;"></div>
    </div>` : ''}
    <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px;">
      <div class="kpi"><div class="kpi-label">Capital inicial</div><div class="kpi-val mono">$${fmt(init)}</div></div>
      <div class="kpi"><div class="kpi-label">Capital final</div><div class="kpi-val ${achieved>=0?'g':'r'}">$${fmt(finalVal)}</div></div>
      <div class="kpi"><div class="kpi-label">Rentabilidad</div><div class="kpi-val ${achieved>=0?'g':'r'}">${achieved>=0?'+':''}${achieved.toFixed(2)}%</div></div>
      <div class="kpi"><div class="kpi-label">Meta profesor</div><div class="kpi-val a">${labConfig.target}%</div></div>
    </div>
    <div class="grid2" style="margin-bottom:14px;">
      <div class="card" style="padding:12px;">
        <div style="font-size:11px;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Eficiencia del riesgo</div>
        <div style="font-size:26px;font-family:var(--font-mono);font-weight:500;color:${riskEff>60?'var(--green)':riskEff>40?'var(--amber)':'var(--red)'};margin-bottom:6px;">${riskEff.toFixed(1)}%</div>
        <div class="pbar-bg"><div class="pbar-fill" style="width:${riskEff}%;background:${riskEff>60?'var(--green)':riskEff>40?'var(--amber)':'var(--red)'};"></div></div>
        <div style="font-size:11px;color:var(--t3);margin-top:5px;">σ = ${sigPort.toFixed(1)}% · VaR 95%: $${fmt(var95)}</div>
      </div>
      <div class="card" style="padding:12px;">
        <div style="font-size:11px;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Eficiencia del capital</div>
        <div style="font-size:26px;font-family:var(--font-mono);font-weight:500;color:${capEff>100?'var(--green)':capEff>80?'var(--amber)':'var(--red)'};margin-bottom:6px;">${capEff.toFixed(1)}%</div>
        <div class="pbar-bg"><div class="pbar-fill" style="width:${Math.min(100,capEff)}%;background:${capEff>100?'var(--green)':capEff>80?'var(--amber)':'var(--red)'};"></div></div>
        <div style="font-size:11px;color:var(--t3);margin-top:5px;">$${fmt(init)} → $${fmt(finalVal)} · Sharpe: ${sh.toFixed(2)}</div>
      </div>
    </div>
    <div class="info-box ${passed?'success':achieved>0?'warn':'danger'}" style="margin-bottom:14px;"><b>Análisis de la variación:</b> ${varExp}</div>
    <div style="font-size:12px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Distribución Monte Carlo · ${N_PATHS.toLocaleString('es-PA')} trayectorias</div>
    <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px;">
      <div class="kpi"><div class="kpi-label">Escenario pesimista (P5)</div><div class="kpi-val mono r">$${fmt(p5)}</div><div style="font-size:9px;color:var(--t3);">${((p5-init)/init*100).toFixed(1)}%</div></div>
      <div class="kpi"><div class="kpi-label">Escenario mediano (P50)</div><div class="kpi-val mono">$${fmt(p50)}</div><div style="font-size:9px;color:var(--t3);">${((p50-init)/init*100).toFixed(1)}%</div></div>
      <div class="kpi"><div class="kpi-label">Escenario optimista (P95)</div><div class="kpi-val mono g">$${fmt(p95)}</div><div style="font-size:9px;color:var(--t3);">${((p95-init)/init*100).toFixed(1)}%</div></div>
    </div>
    <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;">
      <div class="kpi"><div class="kpi-label">Prob. de alcanzar meta</div><div class="kpi-val ${probMeta>=50?'g':probMeta>=25?'a':'r'}">${probMeta.toFixed(1)}%</div></div>
      <div class="kpi"><div class="kpi-label">Prob. de pérdida</div><div class="kpi-val ${probLoss<=30?'g':probLoss<=50?'a':'r'}">${probLoss.toFixed(1)}%</div></div>
      <div class="kpi"><div class="kpi-label">Prob. de ruina (≥95%)</div><div class="kpi-val ${probRuin<=2?'g':probRuin<=10?'a':'r'}">${probRuin.toFixed(1)}%</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Distribución del portafolio simulado</div>
    <table style="margin-bottom:14px;">
      <thead><tr><th>Tipo de activo</th><th>Asignación</th><th>Retorno aportado</th><th>Riesgo aportado</th><th>Perfil</th></tr></thead>
      <tbody>${allocRows.map(r=>`<tr>
        <td>${r[0]}</td>
        <td class="mono">${(r[1]*100).toFixed(0)}%</td>
        <td class="mono ${r[1]*r[2]>=0?'g':'r'}">${(r[1]*r[2]).toFixed(2)}%</td>
        <td class="mono">${(r[1]*r[3]).toFixed(2)}%</td>
        <td>${r[4]}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="card" style="padding:12px;">
      <div style="font-size:12px;font-weight:600;color:var(--accent2);margin-bottom:10px;display:flex;align-items:center;gap:6px;"><i class="ti ti-history"></i> Historial de transacciones del usuario</div>
      ${txHtml}
    </div>
  </div>`;
  notify('Simulación completada ✓');
  autosave();

  // ── Guardar sesión en el historial del laboratorio ──
  labHistory.unshift({
    id:         Date.now(),
    date:       new Date().toLocaleString('es-PA'),
    strat:      strat,
    perfil:     document.getElementById('lab-perfil').value,
    months:     months,
    init:       init,
    finalVal:   finalVal,
    achieved:   +achieved.toFixed(2),
    target:     labConfig.target,
    passed:     passed,
    calific:    calific,
    sharpe:     +sh.toFixed(2),
    sigma:      +sigPort.toFixed(1),
    var95:      +var95.toFixed(2),
    riskEff:    +riskEff.toFixed(1),
    capEff:     +capEff.toFixed(1),
    picked:     pickedNames,
    pickedIds:  [...labPickedIds],  // store full id list for rich display
    alloc:      {b:+(pb*100).toFixed(0),a:+(pa*100).toFixed(0),d:+(pd*100).toFixed(0),f:+(pf*100).toFixed(0),dv:+(pdv*100).toFixed(0)},
    txCount:    txHistory.length,
  });
  autosave();
  renderLabHistory();
}

// ═══════════════════ LAB HISTORY ═══════════════════
