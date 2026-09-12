// ══════════════════════════════════════════════════════════════
// CapitalLab Analytics — Motor de análisis de inversión
// ══════════════════════════════════════════════════════════════
'use strict';

// iOS viewport fix
function setVH(){ document.documentElement.style.setProperty('--vh', (window.innerHeight*0.01)+'px'); }
setVH(); window.addEventListener('resize', setVH);

// ───── Estado global ─────
let currentMarket = null;   // 'accion' | 'bono' | 'divisa' | 'futuro' | 'derivado'
let lastResult = null;      // resultado del último análisis
let audience = 'expert';    // 'simple' | 'expert'
let mcChart = null;

// ───── Definición de mercados ─────
const MARKETS = {
  accion: {
    name:'Acciones', icon:'ti-trending-up', color:'#2962ff',
    desc:'Renta variable. Analiza una acción a partir de su precio, fundamentales y volatilidad.',
    formDesc:'Ingresa los datos de la acción. Los campos marcados con * son indispensables; los demás enriquecen el análisis fundamental.',
    fields:[
      {k:'ticker', label:'Símbolo / Nombre', type:'text', req:true, placeholder:'Ej. AAPL', ex:'AAPL', src:'Símbolo bursátil de la empresa (símbolo bursátil) visible en el buscador de Yahoo Finance.'},
      {k:'sector', label:'Sector de la empresa', type:'select', options:[['general','General (sin ponderación especial)'],['banca','Banca y Finanzas'],['energia','Energía y Commodities'],['retail','Retail y Consumo'],['tecnologia','Tecnología y SaaS'],['inmobiliario','Real Estate / REITs'],['manufactura','Manufactura e Industria']], note:'se autocompleta con "Traer datos reales" para empresas conocidas', src:'Determina qué indicadores pesan más en la Calificación CapitalLab — un banco se evalúa distinto a una tecnológica. Cámbialo a mano solo si el sector detectado no es el correcto.'},
      {k:'price', label:'Precio actual', type:'num', req:true, unit:'$', placeholder:'185.00', ex:185, sl:[1,1000,0.5], src:'Cotización en tiempo real (precio de mercado) en la cabecera de la acción en Yahoo Finance.'},
      {k:'shares', label:'Acciones en circulación', type:'num', unit:'mill.', placeholder:'15500', ex:15500, note:'En millones', src:'Pestaña "Statistics" en Yahoo Finance, campo de acciones en circulación ("Shares Outstanding").'},
      {k:'eps', label:'Utilidad por acción (EPS)', type:'num', unit:'$', placeholder:'6.13', ex:6.13, sl:[-10,50,0.1], src:'Cabecera de la acción en Yahoo Finance, campo de utilidad por acción de los últimos doce meses ("EPS (TTM)").'},
      {k:'bookValue', label:'Valor en libros por acción', type:'num', unit:'$', placeholder:'4.40', ex:4.40, sl:[0,200,0.1], src:'Pestaña "Statistics" en Yahoo Finance, campo de valor en libros por acción ("Book Value Per Share").'},
      {k:'dividend', label:'Dividendo anual por acción', type:'num', unit:'$', placeholder:'0.96', ex:0.96, sl:[0,50,0.05], src:'Cabecera de la acción en Yahoo Finance, campo de dividendo anual proyectado ("Forward Dividend"). Cero si no reparte.'},
      {k:'epsGrowth', label:'Crecimiento esperado de utilidades', type:'num', unit:'%', placeholder:'10', ex:10, note:'Anual estimado', sl:[-20,40,0.5], src:'Pestaña "Analysis" en Yahoo Finance, sección de estimaciones de crecimiento ("Growth Estimates").'},
      {k:'beta', label:'Beta', type:'num', placeholder:'1.25', ex:1.25, note:'Sensibilidad al mercado', sl:[0,3,0.05], src:'Pestaña "Statistics" en Yahoo Finance, campo del coeficiente de riesgo sistemático ("Beta (5Y Monthly)").'},
      {k:'volatility', label:'Volatilidad anual', type:'num', unit:'%', req:true, placeholder:'28', ex:28, sl:[5,100,1], src:'Volatilidad histórica: se estima a partir de la desviación estándar de los retornos del gráfico de precios en Yahoo Finance, o se aproxima con la volatilidad implícita de la pestaña "Options".'},
      {k:'expReturn', label:'Rentabilidad esperada anual', type:'num', unit:'%', req:true, placeholder:'12', ex:12, sl:[-20,50,0.5], src:'Se deduce del precio objetivo de la pestaña "Analysis" en Yahoo Finance frente al precio actual.'},
      {k:'debtEquity', label:'Razón Deuda/Patrimonio', type:'num', placeholder:'1.45', ex:1.45, sl:[0,5,0.05], src:'Pestaña "Statistics" en Yahoo Finance, campo de la razón deuda-patrimonio ("Total Debt/Equity").'},
      {k:'roe', label:'Rentabilidad sobre patrimonio (ROE)', type:'num', unit:'%', placeholder:'18', ex:18, sl:[-20,60,0.5], src:'Pestaña "Statistics" en Yahoo Finance, campo de rentabilidad sobre el patrimonio ("Return on Equity").'},
    ]
  },
  divisa: {
    name:'Divisas (Forex)', icon:'ti-currency-dollar', color:'#ffb400',
    desc:'Mercado cambiario. Analiza un par de divisas con su tipo de cambio, diferencial de tasas y datos macro.',
    formDesc:'Ingresa los datos del par de divisas (base/cotizada). El diferencial de tasas es clave para el análisis de carry.',
    fields:[
      {k:'ticker', label:'Par de divisas', type:'text', req:true, placeholder:'Ej. EUR/USD', ex:'EUR/USD', src:'Par de divisas: la primera es la base, la segunda la cotizada. Búscalo en la sección "Currencies" de Yahoo Finance.'},
      {k:'price', label:'Tipo de cambio actual', type:'num', req:true, placeholder:'1.0850', ex:1.0850, sl:[0.1,200,0.0001], src:'Tipo de cambio en la ficha del par en la sección "Currencies" de Yahoo Finance.'},
      {k:'rateBase', label:'Tasa de interés (divisa base)', type:'num', req:true, unit:'%', placeholder:'4.50', ex:4.50, sl:[0,25,0.05], src:'Tasa de interés de referencia de la divisa base; en Yahoo Finance se aproxima con el rendimiento del bono soberano a 1 año (sección "Bonds").'},
      {k:'rateQuote', label:'Tasa de interés (divisa cotizada)', type:'num', req:true, unit:'%', placeholder:'5.50', ex:5.50, sl:[0,25,0.05], src:'Tasa de interés de referencia de la divisa cotizada; se aproxima con el rendimiento del bono soberano a 1 año en Yahoo Finance.'},
      {k:'volatility', label:'Volatilidad anual', type:'num', req:true, unit:'%', placeholder:'9', ex:9, sl:[1,40,0.5], src:'Volatilidad histórica: se estima a partir de la desviación estándar de los retornos del gráfico del par en Yahoo Finance.'},
      {k:'inflationBase', label:'Inflación país base', type:'num', unit:'%', placeholder:'2.6', ex:2.6, sl:[-2,30,0.1], src:'Inflación del país de la divisa base, según los indicadores macro disponibles en Yahoo Finance.'},
      {k:'inflationQuote', label:'Inflación país cotizado', type:'num', unit:'%', placeholder:'3.1', ex:3.1, sl:[-2,30,0.1], src:'Inflación del país de la divisa cotizada, según los indicadores macro disponibles en Yahoo Finance.'},
      {k:'horizon', label:'Horizonte de análisis', type:'num', unit:'meses', placeholder:'12', ex:12, sl:[1,60,1], src:'Horizonte de inversión: lo defines tú según tu objetivo.'},
      {k:'expReturn', label:'Apreciación esperada', type:'num', unit:'%', placeholder:'2', ex:2, note:'Del par, anual', sl:[-30,30,0.5], src:'Apreciación esperada: estimación propia sobre la dirección del par.'},
    ]
  },
};

// ───── Utilidades ─────
const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════════
// CUENTA OPCIONAL — Analytics sigue funcionando por completo sin
// iniciar sesión (todo se queda en este navegador, como siempre). Si
// el usuario decide crear una cuenta, su historial se sincroniza en
// la nube y lo puede ver desde cualquier dispositivo. Nunca se obliga
// a nadie a iniciar sesión para usar la herramienta.
// ═══════════════════════════════════════════════════════════════════
const CL_SUPABASE_URL = 'https://rlzwbsitjtmtynxiexlp.supabase.co';
const CL_SUPABASE_ANON_KEY = 'sb_publishable_Y7UdPZo5Gk8lrw2DDStsSw_XVIrh7-M';
const clsb = supabase.createClient(CL_SUPABASE_URL, CL_SUPABASE_ANON_KEY);
let clUsuario = null;

async function iniciarSesionEstado(){
  // Si se entra desde el enlace del correo de "recuperar contraseña",
  // Supabase deja "type=recovery" en la URL — sin revisar esto, la app
  // entraría directo con la sesión activa, sin darle nunca la
  // oportunidad de poner una contraseña nueva.
  const esEnlaceDeRecuperacion = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
  clsb.auth.onAuthStateChange((evento, sesionNueva) => {
    if(evento === 'PASSWORD_RECOVERY'){ abrirModalNuevaContrasena(); return; }
  });
  if(esEnlaceDeRecuperacion){ abrirModalNuevaContrasena(); }
  const { data:{ session } } = await clsb.auth.getSession();
  clUsuario = session?.user || null;
  actualizarBotonCuenta();
  if(clUsuario) await migrarHistorialLocalSiAplica();
  renderHistory();
  cargarActivosSeguidos();
}
function actualizarBotonCuenta(){
  const txt = $('txt-cuenta');
  if(!txt) return;
  txt.textContent = clUsuario ? (clUsuario.email.split('@')[0]) : 'Iniciar sesión';
}

// Documentos legales — mismo contenido condensado ya usado en el
// Simulador (mismos Términos/Privacidad reales de CapitalLab como
// marca, aplicables a ambas herramientas), accesible desde el modal
// de cuenta y desde un enlace permanente en el pie de página.
const TEXTO_TERMINOS = `
<p><b>Última actualización:</b> 11 de septiembre de 2026</p>
<p style="background:rgba(255,180,0,.12);padding:10px;border-radius:8px;font-size:11.5px;"><i>Aviso: este documento es un borrador de trabajo. No sustituye la revisión de un abogado licenciado antes de su publicación formal.</i></p>
<h4>1. Aceptación de los términos</h4>
<p>Al acceder o usar CapitalLab Simulador y/o CapitalLab Analytics ("la Plataforma"), usted acepta quedar obligado por estos Términos. Si no está de acuerdo, no debe usar la Plataforma.</p>
<h4>2. Descripción del servicio</h4>
<p><b>LA PLATAFORMA ES EXCLUSIVAMENTE UNA HERRAMIENTA EDUCATIVA Y DE ANÁLISIS. NO CONSTITUYE ASESORÍA FINANCIERA NI DE INVERSIÓN.</b> Ninguna calificación, veredicto, tesis generada por IA, o proyección constituye una recomendación profesional de inversión.</p>
<h4>3. Uso aceptable</h4>
<p>El usuario se compromete a no usar la Plataforma para decisiones de inversión real sin verificación independiente, vulnerar su seguridad, ni usarla con fines comerciales no autorizados.</p>
<h4>4. Datos de mercado y terceros</h4>
<p>La Plataforma incorpora datos de Yahoo Finance, la SEC de EE.UU., y Finnhub. CapitalLab no controla ni garantiza su exactitud, integridad, o actualidad.</p>
<h4>5. Contenido generado por IA</h4>
<p>Ciertas funciones usan modelos de IA de terceros. Este contenido puede contener errores y no garantiza exactitud.</p>
<h4>6. Propiedad intelectual</h4>
<p>El software y diseño de la Plataforma son propiedad de CapitalLab. Se concede una licencia limitada, no exclusiva, con fines educativos.</p>
<h4>7. Limitación de responsabilidad</h4>
<p><b>CAPITALLAB NO SERÁ RESPONSABLE POR NINGÚN DAÑO, INCLUYENDO PÉRDIDA FINANCIERA REAL, QUE EL USUARIO PUDIERA ATRIBUIR A DECISIONES DE INVERSIÓN BASADAS EN LA PLATAFORMA.</b> Se proporciona "tal cual", sin garantías.</p>
<h4>8-11. Modificaciones, terminación, ley aplicable, contacto</h4>
<p>CapitalLab puede modificar el servicio y estos Términos en cualquier momento. Rige la ley de la República de Panamá. Contacto: capitallabpty@gmail.com.</p>`;

const TEXTO_PRIVACIDAD = `
<p><b>Última actualización:</b> 11 de septiembre de 2026</p>
<p style="background:rgba(255,180,0,.12);padding:10px;border-radius:8px;font-size:11.5px;"><i>Aviso: este documento es un borrador de trabajo. No sustituye la revisión de un abogado licenciado, en particular respecto a la Ley 81 de 2019 de Panamá.</i></p>
<h4>1. Datos que recopilamos</h4>
<p>Datos de cuenta (correo, contraseña cifrada), y los datos que usted ingrese para su análisis (símbolos de activos, cifras financieras).</p>
<h4>2. Cómo usamos sus datos</h4>
<p>Para operar la Plataforma, guardar su historial de análisis si crea una cuenta, generar contenido personalizado con IA, y mejorar el servicio.</p>
<h4>3. Con quién compartimos sus datos</h4>
<p>No vendemos sus datos. Se comparten únicamente con: Supabase (infraestructura), Google Gemini (generación de texto con IA, solo datos ya calculados, nunca su contraseña), fuentes de datos de mercado (sin datos personales), y autoridades cuando sea legalmente requerido.</p>
<h4>4. Seguridad</h4>
<p>Contraseñas cifradas. Crear una cuenta es opcional — puede usar Analytics sin registrarse.</p>
<h4>5. Sus derechos (Ley 81 de 2019, Panamá)</h4>
<p>Acceder, corregir, y solicitar la eliminación de sus datos. Contacto: capitallabpty@gmail.com.</p>
<h4>6. Cambios a esta Política</h4>
<p>Notificaremos cambios significativos publicando la nueva versión con su fecha de actualización.</p>`;

function abrirDocumentoLegal(tipo){
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'legal-overlay';
  overlay.innerHTML = `
    <div class="export-modal" style="max-width:640px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm ${tipo==='terminos'?'':'btn-ghost'}" onclick="abrirDocumentoLegal('terminos')">Términos y Condiciones</button>
          <button class="btn btn-sm ${tipo==='privacidad'?'':'btn-ghost'}" onclick="abrirDocumentoLegal('privacidad')">Política de Privacidad</button>
        </div>
        <button class="modal-close" style="position:static;" onclick="document.getElementById('legal-overlay').remove()"><i class="ti ti-x"></i></button>
      </div>
      <div style="max-height:65vh;overflow-y:auto;font-size:12.5px;line-height:1.6;color:var(--t2);">
        ${tipo==='terminos' ? TEXTO_TERMINOS : TEXTO_PRIVACIDAD}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
}

function abrirModalCuenta(){
  if(clUsuario){ abrirModalCuentaConectada(); return; }
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'cuenta-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:400px;">
    <button class="modal-close" onclick="$('cuenta-overlay').remove()"><i class="ti ti-x"></i></button>
    <div style="text-align:center;margin-bottom:18px;">
      <i class="ti ti-user-circle" style="font-size:36px;color:var(--accent);"></i>
      <h2 style="margin-top:8px;">Tu cuenta CapitalLab</h2>
      <p style="font-size:12.5px;color:var(--t2);">Guarda tu historial y accede desde cualquier dispositivo. Es opcional — puedes seguir usando Analytics sin ninguna cuenta.</p>
    </div>
    <input type="email" id="cuenta-email" placeholder="Correo electrónico" style="width:100%;padding:11px 13px;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);color:var(--t1);font-size:14px;margin-bottom:10px;">
    <input type="password" id="cuenta-password" placeholder="Contraseña" style="width:100%;padding:11px 13px;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);color:var(--t1);font-size:14px;margin-bottom:14px;">
    <button class="btn" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="iniciarSesionCuenta()"><i class="ti ti-login"></i> Iniciar sesión</button>
    <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-bottom:10px;" onclick="crearCuenta()"><i class="ti ti-user-plus"></i> Crear cuenta nueva</button>
    <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:11px;color:var(--t3);cursor:pointer;">
      <input type="checkbox" id="cuenta-acepta-legal" style="width:auto;margin-top:2px;flex-shrink:0;">
      <span>Al crear una cuenta, acepto los <a href="#" onclick="event.preventDefault();abrirDocumentoLegal('terminos');" style="color:var(--accent);">Términos y Condiciones</a> y la <a href="#" onclick="event.preventDefault();abrirDocumentoLegal('privacidad');" style="color:var(--accent);">Política de Privacidad</a>.</span>
    </label>
    <div style="text-align:center;margin-bottom:14px;"><button style="background:none;border:none;color:var(--t3);font-size:11.5px;cursor:pointer;text-decoration:underline;" onclick="recuperarContrasenaCuenta()">¿Olvidaste tu contraseña?</button></div>
    <div id="cuenta-msg" style="font-size:12px;text-align:center;margin-bottom:14px;"></div>
    <div style="border-top:1px solid var(--c3);padding-top:14px;text-align:center;">
      <button class="btn btn-ghost btn-sm" onclick="$('cuenta-overlay').remove()"><i class="ti ti-arrow-right"></i> Continuar sin cuenta</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}
function abrirModalCuentaConectada(){
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'cuenta-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:380px;">
    <button class="modal-close" onclick="$('cuenta-overlay').remove()"><i class="ti ti-x"></i></button>
    <div style="text-align:center;margin-bottom:18px;">
      <i class="ti ti-user-circle" style="font-size:36px;color:var(--accent);"></i>
      <h2 style="margin-top:8px;">${clUsuario.email}</h2>
      <p style="font-size:12px;color:var(--t2);">Tu historial se sincroniza automáticamente en la nube.</p>
    </div>
    <button class="btn btn-ghost" style="width:100%;justify-content:center;" onclick="cerrarSesionCuenta()"><i class="ti ti-logout"></i> Cerrar sesión</button>
  </div>`;
  document.body.appendChild(overlay);
}
async function recuperarContrasenaCuenta(){
  const email = $('cuenta-email').value.trim();
  const msg = $('cuenta-msg');
  if(!email){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Escribe tu correo arriba primero, y toca de nuevo este enlace.'; return; }
  msg.style.color='var(--t3)'; msg.textContent='Enviando enlace de recuperación…';
  // Redirección explícita de vuelta a esta misma página — sin esto,
  // Supabase manda al usuario a un dominio genérico que no es este.
  const { error } = await clsb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  if(error){ msg.style.color='var(--red, #ff4757)'; msg.textContent = error.message; return; }
  msg.style.color='var(--green, #00d084)';
  msg.textContent = 'Enlace de recuperación enviado a tu correo.';
}
function abrirModalNuevaContrasena(){
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.id = 'nueva-pass-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:380px;">
    <div style="text-align:center;margin-bottom:18px;">
      <i class="ti ti-lock" style="font-size:36px;color:var(--accent);"></i>
      <h2 style="margin-top:8px;">Elige tu nueva contraseña</h2>
    </div>
    <input type="password" id="nueva-pass-input" placeholder="Nueva contraseña (mínimo 6 caracteres)" style="width:100%;padding:11px 13px;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);color:var(--t1);font-size:14px;margin-bottom:14px;">
    <button class="btn" style="width:100%;justify-content:center;" onclick="confirmarNuevaContrasena()"><i class="ti ti-check"></i> Guardar nueva contraseña</button>
    <div id="nueva-pass-msg" style="font-size:12px;text-align:center;margin-top:10px;"></div>
  </div>`;
  document.body.appendChild(overlay);
}
async function confirmarNuevaContrasena(){
  const nueva = $('nueva-pass-input').value;
  const msg = $('nueva-pass-msg');
  if(nueva.length<6){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Debe tener al menos 6 caracteres.'; return; }
  msg.style.color='var(--t3)'; msg.textContent='Guardando…';
  const { error } = await clsb.auth.updateUser({ password: nueva });
  if(error){ msg.style.color='var(--red, #ff4757)'; msg.textContent = error.message; return; }
  toast('Contraseña actualizada. Ya puedes usarla para iniciar sesión.','ok');
  $('nueva-pass-overlay')?.remove();
  history.replaceState(null, '', window.location.pathname);
}

async function iniciarSesionCuenta(){
  const email = $('cuenta-email').value.trim(), password = $('cuenta-password').value;
  const msg = $('cuenta-msg');
  if(!email || !password){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Completa correo y contraseña.'; return; }
  msg.style.color='var(--t3)'; msg.textContent='Iniciando sesión…';
  const { data, error } = await clsb.auth.signInWithPassword({ email, password });
  if(error){ msg.style.color='var(--red, #ff4757)'; msg.textContent = error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message; return; }
  clUsuario = data.user;
  actualizarBotonCuenta();
  await migrarHistorialLocalSiAplica();
  renderHistory();
  $('cuenta-overlay')?.remove();
  toast('Sesión iniciada — tu historial ya está sincronizado.','ok');
}
async function crearCuenta(){
  const email = $('cuenta-email').value.trim(), password = $('cuenta-password').value;
  const msg = $('cuenta-msg');
  if(!email || !password){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Completa correo y contraseña.'; return; }
  if(password.length<6){ msg.style.color='var(--red, #ff4757)'; msg.textContent='La contraseña debe tener al menos 6 caracteres.'; return; }
  if(!$('cuenta-acepta-legal').checked){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Debes aceptar los Términos y Condiciones y la Política de Privacidad para crear una cuenta.'; return; }
  msg.style.color='var(--t3)'; msg.textContent='Creando cuenta…';
  const { data, error } = await clsb.auth.signUp({ email, password });
  if(error){ msg.style.color='var(--red, #ff4757)'; msg.textContent = error.message; return; }
  clUsuario = data.user;
  actualizarBotonCuenta();
  await migrarHistorialLocalSiAplica();
  renderHistory();
  $('cuenta-overlay')?.remove();
  toast('Cuenta creada — tu historial ya está sincronizado.','ok');
}
async function cerrarSesionCuenta(){
  await clsb.auth.signOut();
  clUsuario = null;
  actualizarBotonCuenta();
  renderHistory();
  $('cuenta-overlay')?.remove();
  toast('Sesión cerrada. Analytics sigue funcionando normalmente sin cuenta.');
}
// La primera vez que alguien con historial local inicia sesión, ese
// historial se sube a la nube automáticamente, para no perder nada de
// lo que ya tenía guardado en este navegador.
async function migrarHistorialLocalSiAplica(){
  const local = loadHistoryLocal();
  if(!local.length) return;
  try {
    await Promise.all(local.map(entry => clsb.from('analytics_historial').insert({ user_id: clUsuario.id, entrada: entry })));
    localStorage.removeItem(STORAGE_KEY);
  } catch(e){ /* si falla la migración, el historial local no se borra, se reintenta la próxima vez */ }
}

function fmt(n, d=2){ if(n===null||n===undefined||isNaN(n)) return '—'; return Number(n).toLocaleString('es-PA',{minimumFractionDigits:d, maximumFractionDigits:d}); }
function fmtMoney(n, d=2){ return '$'+fmt(n,d); }
function fmtPct(n, d=2){ if(n===null||isNaN(n)) return '—'; return fmt(n,d)+'%'; }
function toast(msg, type=''){ const t=$('toast'); t.textContent=msg; t.className='toast show '+type; clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast',2600); }

// ───── Navegación ─────
function show(page){
  ['page-market','page-form','page-results','page-compare'].forEach(p=>$(p).classList.add('hidden'));
  $(page).classList.remove('hidden');
  $(page).classList.add('fade-in');
  setTimeout(()=>$(page).classList.remove('fade-in'),400);
  window.scrollTo({top:0,behavior:'smooth'});
  syncSidebar(page);
}
function setStep(n){
  [1,2,3].forEach(i=>{
    const el=$('st'+i);
    el.classList.remove('active','done');
    if(i<n) el.classList.add('done');
    else if(i===n) el.classList.add('active');
  });
}
function goToMarket(){ currentMarket=null; show('page-market'); setStep(1); }
function goToForm(){ show('page-form'); setStep(2); }

// ───── Barra lateral ─────
function toggleSidebar(){ const sb=$('sidebar'); sb.classList.contains('open')?closeSidebar():openSidebar(); }
document.addEventListener('click', ()=>{ document.querySelectorAll('.cl-tools-dropdown.open').forEach(d=>d.classList.remove('open')); });
function openSidebar(){ $('sidebar').classList.add('open'); $('nav-backdrop').classList.add('show'); }
function closeSidebar(){ $('sidebar').classList.remove('open'); $('nav-backdrop').classList.remove('show'); }
function navHome(){ goToMarket(); afterNav('nav-home'); }
function navHistory(){
  goToMarket();
  const h=$('history-section');
  if(h && !h.classList.contains('hidden')){ setTimeout(()=>h.scrollIntoView({behavior:'smooth',block:'start'}),120); }
  else { toast('Aún no hay análisis guardados.'); }
  afterNav('nav-history');
}
function navCompare(){ openCompare(); afterNav('nav-compare'); }
function navSection(id){
  const results=$('page-results');
  if(results.classList.contains('hidden')){ toast('Abre o genera un análisis primero.'); return; }
  const el=$(id);
  if(el){ const card=el.closest('.card')||el; card.scrollIntoView({behavior:'smooth',block:'start'}); }
  afterNav(null);
}
function afterNav(activeId){
  document.querySelectorAll('.sidebar .nav-item').forEach(b=>b.classList.remove('active'));
  if(activeId){ const b=$(activeId); if(b) b.classList.add('active'); }
  if(window.innerWidth<=900) closeSidebar();
}
function syncSidebar(page){
  const sec=$('nav-sections');
  if(page==='page-results'){ sec.classList.remove('locked'); $('nav-sections-hint').style.display='none'; }
  else { sec.classList.add('locked'); $('nav-sections-hint').style.display=''; }
  document.querySelectorAll('.sidebar .nav-item').forEach(b=>b.classList.remove('active'));
  const map={'page-market':'nav-home','page-compare':'nav-compare'};
  if(map[page]){ const b=$(map[page]); if(b) b.classList.add('active'); }
}

// ───── Acciones y divisas populares (cotización real en vivo) ─────
// Mapa maestro único de sector por ticker — mismas 6 categorías ya
// usadas en el formulario de Acciones (Banca, Energía, Retail,
// Tecnología, Inmobiliario, Manufactura), para que TODO el sistema
// (auto-relleno de sector, heatmap de inicio, lista de populares,
// listado por sector al hacer clic) use una sola fuente de verdad,
// sin categorías GICS distintas compitiendo entre sí. Empresas reales
// y bien conocidas de cada sector — cualquier ticker fuera de este
// mapa se deja sin sector asignado en vez de adivinar.
const SECTOR_POR_TICKER = {
  tecnologia:  ['AAPL','MSFT','GOOGL','META','NVDA','AMD','ORCL','CRM','ADBE','INTC'],
  banca:       ['JPM','BAC','WFC','GS','MS','C','USB','PNC'],
  energia:     ['XOM','CVX','COP','SLB','OXY','PSX'],
  retail:      ['AMZN','WMT','TGT','COST','HD','NKE','SBUX','MCD'],
  inmobiliario:['PLD','AMT','EQIX','SPG','O','PSA'],
  manufactura: ['CAT','GE','BA','HON','MMM','DE','LMT'],
};
const NOMBRE_POR_TICKER = {
  AAPL:'Apple Inc.', MSFT:'Microsoft', GOOGL:'Alphabet (Google)', META:'Meta Platforms', NVDA:'NVIDIA', AMD:'AMD', ORCL:'Oracle', CRM:'Salesforce', ADBE:'Adobe', INTC:'Intel',
  JPM:'JPMorgan Chase', BAC:'Bank of America', WFC:'Wells Fargo', GS:'Goldman Sachs', MS:'Morgan Stanley', C:'Citigroup', USB:'U.S. Bancorp', PNC:'PNC Financial',
  XOM:'ExxonMobil', CVX:'Chevron', COP:'ConocoPhillips', SLB:'Schlumberger', OXY:'Occidental Petroleum', PSX:'Phillips 66',
  AMZN:'Amazon', WMT:'Walmart', TGT:'Target', COST:'Costco', HD:'Home Depot', NKE:'Nike', SBUX:'Starbucks', MCD:"McDonald's",
  PLD:'Prologis', AMT:'American Tower', EQIX:'Equinix', SPG:'Simon Property Group', O:'Realty Income', PSA:'Public Storage',
  CAT:'Caterpillar', GE:'General Electric', BA:'Boeing', HON:'Honeywell', MMM:'3M', DE:'Deere & Company', LMT:'Lockheed Martin',
};
const NOMBRE_SECTOR_LABEL = { tecnologia:'Tecnología y SaaS', banca:'Banca y Finanzas', energia:'Energía y Commodities', retail:'Retail y Consumo', inmobiliario:'Real Estate / REITs', manufactura:'Manufactura e Industria' };
// Búsqueda inversa: ticker -> clave de sector, construida una vez.
const SECTOR_DE_ESTE_TICKER = {};
Object.entries(SECTOR_POR_TICKER).forEach(([sector, tickers]) => tickers.forEach(t => { SECTOR_DE_ESTE_TICKER[t] = sector; }));
// Universo completo de tickers seguidos por defecto — antes solo 8,
// ahora los ~45 de todos los sectores, para que el heatmap y la
// lista de populares reflejen un panorama real del mercado, no un
// puñado de nombres.
const ACCIONES_POPULARES_BASE = Object.values(SECTOR_POR_TICKER).flat();
const DIVISAS_POPULARES_BASE = ['EUR/USD','GBP/USD','USD/JPY','USD/MXN','USD/CAD','USD/CHF','AUD/USD','USD/COP'];
const STORAGE_KEY_SEGUIDOS = 'capitallab_analytics_seguidos_v1';

function loadSeguidosLocal(){
  try { const raw = localStorage.getItem(STORAGE_KEY_SEGUIDOS); return raw ? JSON.parse(raw) : {accion:[], divisa:[]}; }
  catch(e){ return {accion:[], divisa:[]}; }
}
function saveSeguidosLocal(obj){
  try { localStorage.setItem(STORAGE_KEY_SEGUIDOS, JSON.stringify(obj)); } catch(e){}
}
async function cargarActivosSeguidos(){
  cargarAccionesPopulares();
  cargarDivisasPopulares();
}
async function obtenerSeguidos(tipo){
  if(clUsuario){
    try {
      const { data } = await clsb.from('analytics_seguidos').select('simbolo').eq('user_id', clUsuario.id).eq('tipo', tipo);
      return (data||[]).map(r=>r.simbolo);
    } catch(e){ return []; }
  }
  return loadSeguidosLocal()[tipo] || [];
}
async function agregarActivoSeguido(tipo){
  const inputId = tipo==='accion' ? 'seguir-accion-input' : 'seguir-divisa-input';
  const valor = $(inputId).value.trim().toUpperCase();
  if(!valor){ toast('Escribe un símbolo primero.'); return; }
  $(inputId).value = '';
  if(clUsuario){
    try { await clsb.from('analytics_seguidos').insert({ user_id: clUsuario.id, simbolo: valor, tipo }); }
    catch(e){ toast('No se pudo seguir: '+(e.message||e)); return; }
  } else {
    const obj = loadSeguidosLocal();
    if(!obj[tipo]) obj[tipo] = [];
    if(!obj[tipo].includes(valor)) obj[tipo].push(valor);
    saveSeguidosLocal(obj);
  }
  toast(`Ahora sigues ${valor}${clUsuario?'':' (guardado en este dispositivo)'}`,'ok');
  if(tipo==='accion') cargarAccionesPopulares(); else cargarDivisasPopulares();
}
async function quitarActivoSeguido(tipo, simbolo){
  if(clUsuario){
    try { await clsb.from('analytics_seguidos').delete().eq('user_id', clUsuario.id).eq('simbolo', simbolo).eq('tipo', tipo); }
    catch(e){ toast('No se pudo quitar: '+(e.message||e)); return; }
  } else {
    const obj = loadSeguidosLocal();
    obj[tipo] = (obj[tipo]||[]).filter(s=>s!==simbolo);
    saveSeguidosLocal(obj);
  }
  if(tipo==='accion') cargarAccionesPopulares(); else cargarDivisasPopulares();
}

async function cargarAccionesPopulares(){
  const cont = $('acciones-populares-grid');
  cont.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--t3);font-size:12.5px;"><i class="ti ti-loader-2" style="animation:girarPopulares 1s linear infinite;font-size:18px;"></i><br>Consultando cotizaciones en vivo…</div>`;
  try {
    const seguidos = await obtenerSeguidos('accion');
    const lista = [...new Set([...ACCIONES_POPULARES_BASE, ...seguidos])].join(',');
    const respuesta = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbols=${lista}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await respuesta.json();
    if(!d.ok || !d.cotizaciones?.length) throw new Error('Sin datos disponibles en este momento.');
    cont.innerHTML = d.cotizaciones.map(c => tarjetaPopular(c, 'accion', seguidos.includes(c.simbolo))).join('');
    renderHomeSectorHeatmap(d.cotizaciones);
  } catch(e){
    cont.innerHTML = `<div style="grid-column:1/-1;padding:14px;font-size:12px;color:var(--red, #ff4757);">No se pudieron cargar las cotizaciones en vivo: ${e.message||e}.</div>`;
    const heatmapCont = $('home-sector-heatmap');
    if(heatmapCont) heatmapCont.innerHTML = `<div style="text-align:center;padding:14px;font-size:12px;color:var(--t3);">Sin datos suficientes para el panorama por sector todavía.</div>`;
  }
}

function renderHomeSectorHeatmap(cotizaciones){
  const cont = $('home-sector-heatmap');
  if(!cont) return;
  const porSector = {};
  cotizaciones.forEach(c => {
    const sector = SECTOR_DE_ESTE_TICKER[c.simbolo];
    if(!sector) return; // sin sector conocido con certeza: se omite del heatmap, no se agrupa en un cajón genérico
    (porSector[sector] ||= []).push(c);
  });
  const sectores = Object.entries(porSector).map(([sector, activos]) => ({
    sector, n: activos.length, peso: activos.length,
    retProm: activos.reduce((s,a)=>s+a.variacionPct,0)/activos.length,
  }));
  if(sectores.length < 2){
    cont.innerHTML = `<div style="text-align:center;padding:14px;font-size:12px;color:var(--t3);">Sigue acciones de más de un sector para ver el panorama comparado.</div>`;
    return;
  }
  const magnitudMax = Math.max(...sectores.map(s=>Math.abs(s.retProm)), 1);
  const ALTO = window.innerWidth < 640 ? 260 : 180;
  const ANCHO = cont.clientWidth || 900;
  const rects = calcularSquarifiedTreemapHome(sectores, ANCHO, ALTO);
  cont.innerHTML = `<div style="position:relative;width:100%;height:${ALTO}px;">
    ${rects.map(({item:s,x,y,w,h}) => {
      const positivo = s.retProm>=0;
      const intensidad = 0.18 + (Math.abs(s.retProm)/magnitudMax)*0.67;
      const fondo = positivo ? `rgba(0,208,132,${intensidad.toFixed(2)})` : `rgba(255,71,87,${intensidad.toFixed(2)})`;
      const chico = w<110 || h<60;
      return `<div onclick="abrirListaSector('${s.sector}')" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${fondo};border:1px solid rgba(0,0,0,.35);box-sizing:border-box;padding:${chico?'6px':'12px'};overflow:hidden;cursor:pointer;" title="Ver los activos más relevantes de ${NOMBRE_SECTOR_LABEL[s.sector]}">
        <div style="font-size:${chico?'10px':'12.5px'};font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${NOMBRE_SECTOR_LABEL[s.sector]}</div>
        <div style="font-size:${chico?'12px':'19px'};font-weight:700;color:#fff;margin-top:2px;">${positivo?'+':''}${s.retProm.toFixed(1)}%</div>
        ${!chico ? `<div style="font-size:10.5px;color:rgba(255,255,255,.7);margin-top:4px;">${s.n} activo${s.n===1?'':'s'} · clic para ver más</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// Al hacer clic en un tile del heatmap, muestra la lista completa de
// los activos más relevantes de ese sector (todo el universo del
// mapa maestro, no solo los que el usuario ya sigue) — el punto es
// dejar elegir, no limitarse a lo que ya estaba en pantalla.
async function abrirListaSector(sector){
  const tickers = SECTOR_POR_TICKER[sector] || [];
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if(e.target===modal) modal.remove(); };
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div style="font-size:16px;font-weight:700;">${NOMBRE_SECTOR_LABEL[sector]}</div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="ti ti-x"></i></button>
    </div>
    <div id="lista-sector-cuerpo"><div style="text-align:center;padding:20px;color:var(--t3);font-size:12px;">Consultando cotizaciones en vivo…</div></div>
  </div>`;
  document.body.appendChild(modal);
  try {
    const resp = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbols=${tickers.join(',')}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await resp.json();
    const cuerpo = document.getElementById('lista-sector-cuerpo');
    if(!cuerpo) return; // el usuario cerró el modal antes de que la petición terminara
    if(!d.ok || !d.cotizaciones?.length){ cuerpo.innerHTML = `<div class="info-box">No se pudieron cargar las cotizaciones ahora mismo.</div>`; return; }
    cuerpo.innerHTML = d.cotizaciones.map(c => {
      const positivo = c.variacionPct>=0;
      return `<div onclick="seleccionarActivoDesdeSector('${c.simbolo}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--c4);cursor:pointer;">
        <div>
          <div style="font-weight:600;font-size:13.5px;">${c.simbolo}</div>
          <div style="font-size:11px;color:var(--t3);">${NOMBRE_POR_TICKER[c.simbolo]||''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-mono);font-size:13.5px;">$${c.precioActual.toFixed(2)}</div>
          <div style="font-size:11.5px;font-weight:600;color:${positivo?'var(--green,#00d084)':'var(--red,#ff4757)'};">${positivo?'+':''}${c.variacionPct.toFixed(2)}%</div>
        </div>
      </div>`;
    }).join('');
  } catch(e){
    const cuerpo = document.getElementById('lista-sector-cuerpo');
    if(cuerpo) cuerpo.innerHTML = `<div class="info-box">No se pudo cargar la lista ahora mismo.</div>`;
  }
}
function seleccionarActivoDesdeSector(ticker){
  document.querySelector('.modal-overlay')?.remove();
  goToForm();
  document.querySelectorAll('.market-grid > div')[0]?.click();
  setTimeout(() => {
    const campo = $('f-ticker');
    if(campo){ campo.value = ticker; traerDatosRealesYahoo(); }
  }, 150);
}
function calcularSquarifiedTreemapHome(items, anchoTotal, altoTotal){
  const pesoTotal = items.reduce((s,i)=>s+i.peso, 0);
  const area = anchoTotal * altoTotal;
  const datos = items.map(item => ({ item, area: (item.peso/pesoTotal) * area }));
  const resultado = [];
  function peorAspecto(fila, largoLado){
    const sumaArea = fila.reduce((s,d)=>s+d.area,0);
    const maxArea = Math.max(...fila.map(d=>d.area));
    const minArea = Math.min(...fila.map(d=>d.area));
    const ladoAlCuadrado = largoLado*largoLado;
    return Math.max((ladoAlCuadrado*maxArea)/(sumaArea*sumaArea), (sumaArea*sumaArea)/(ladoAlCuadrado*minArea));
  }
  function colocarFila(fila, rect){
    const sumaArea = fila.reduce((s,d)=>s+d.area,0);
    const vertical = rect.w >= rect.h;
    const largoFijo = vertical ? sumaArea / rect.h : sumaArea / rect.w;
    let cursor = vertical ? rect.y : rect.x;
    fila.forEach(d => {
      const largoVar = d.area / largoFijo;
      if(vertical) resultado.push({ item:d.item, x:rect.x, y:cursor, w:largoFijo, h:largoVar });
      else resultado.push({ item:d.item, x:cursor, y:rect.y, w:largoVar, h:largoFijo });
      cursor += largoVar;
    });
    return vertical ? { x:rect.x+largoFijo, y:rect.y, w:rect.w-largoFijo, h:rect.h } : { x:rect.x, y:rect.y+largoFijo, w:rect.w, h:rect.h-largoFijo };
  }
  let restantes = [...datos];
  let rect = { x:0, y:0, w:anchoTotal, h:altoTotal };
  let filaActual = [];
  while(restantes.length){
    const siguiente = restantes[0];
    const largoLado = Math.min(rect.w, rect.h);
    const filaConSiguiente = [...filaActual, siguiente];
    if(filaActual.length === 0 || peorAspecto(filaConSiguiente, largoLado) <= peorAspecto(filaActual, largoLado)){
      filaActual = filaConSiguiente; restantes = restantes.slice(1);
    } else {
      rect = colocarFila(filaActual, rect); filaActual = [];
    }
  }
  if(filaActual.length) colocarFila(filaActual, rect);
  return resultado;
}

async function cargarDivisasPopulares(){
  const cont = $('divisas-populares-grid');
  cont.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--t3);font-size:12.5px;"><i class="ti ti-loader-2" style="animation:girarPopulares 1s linear infinite;font-size:18px;"></i><br>Consultando cotizaciones en vivo…</div>`;
  try {
    const seguidos = await obtenerSeguidos('divisa');
    const lista = [...new Set([...DIVISAS_POPULARES_BASE, ...seguidos])].join(',');
    const respuesta = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbols=${lista}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await respuesta.json();
    if(!d.ok || !d.cotizaciones?.length) throw new Error('Sin datos disponibles en este momento.');
    cont.innerHTML = d.cotizaciones.map(c => tarjetaPopular(c, 'divisa', seguidos.includes(c.simbolo.replace('=X','')))).join('');
  } catch(e){
    cont.innerHTML = `<div style="grid-column:1/-1;padding:14px;font-size:12px;color:var(--red, #ff4757);">No se pudieron cargar las cotizaciones en vivo: ${e.message||e}.</div>`;
  }
}
function tarjetaPopular(c, tipo, esSeguidoManual){
  const subio = c.variacionPct >= 0;
  const color = subio ? 'var(--green, #00d084)' : 'var(--red, #ff4757)';
  const simboloVisible = tipo==='divisa' ? c.simbolo.replace('=X','').replace(/(...)$/,'/$1') : c.simbolo;
  const quitar = esSeguidoManual ? `<i class="ti ti-x pc-quitar" onclick="event.stopPropagation();quitarActivoSeguido('${tipo}','${c.simbolo.replace('=X','')}')" title="Dejar de seguir"></i>` : '';
  return `<div class="popular-card" onclick="${tipo==='accion'?`analizarAccionPopular('${c.simbolo}')`:`analizarDivisaPopular('${c.simbolo}')`}">
    ${quitar}
    <div class="pc-simbolo">${simboloVisible}</div>
    <div class="pc-precio">${c.precioActual}</div>
    <div class="pc-var" style="color:${color};">${subio?'▲':'▼'} ${Math.abs(c.variacionPct)}%</div>
  </div>`;
}
function analizarAccionPopular(simbolo){
  selectMarket('accion');
  setTimeout(()=>{ if($('f-ticker')){ $('f-ticker').value = simbolo; traerDatosRealesYahoo(); } }, 150);
}
function analizarDivisaPopular(simboloYahoo){
  selectMarket('divisa');
  const par = simboloYahoo.replace('=X','');
  const visible = par.slice(0,3)+'/'+par.slice(3,6);
  setTimeout(()=>{ if($('f-ticker')){ $('f-ticker').value = visible; traerDatosRealesYahoo(); } }, 150);
}

function renderMarkets(){
  $('market-grid').innerHTML = Object.entries(MARKETS).map(([key,m])=>`
    <div class="market-card" onclick="selectMarket('${key}')">
      <div class="mc-icon" style="background:${m.color}22;color:${m.color};"><i class="ti ${m.icon}"></i></div>
      <h3>${m.name}</h3>
      <p>${m.desc}</p>
      <div class="mc-tag">Analizar →</div>
    </div>
  `).join('');
}

function selectMarket(key){
  currentMarket = key;
  const m = MARKETS[key];
  $('form-title').textContent = 'Datos · '+m.name;
  $('form-icon').className = 'ti '+m.icon;
  $('form-desc').textContent = m.formDesc;
  renderForm();
  show('page-form');
  setStep(2);
}

function renderForm(){
  const m = MARKETS[currentMarket];
  $('form-fields').innerHTML = m.fields.map(f=>{
    const reqMark = f.req ? '<span class="req">*</span>' : '';
    const hint = f.note ? `<span class="hint"> · ${f.note}</span>` : '';
    const src = f.src ? `<div class="field-note"><i class="ti ti-map-pin"></i> ${f.src}</div>` : '';
    if(f.type==='select'){
      return `<div class="field">
        <label>${f.label} ${reqMark}${hint}</label>
        <select id="f-${f.k}">${f.options.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
        ${src}
      </div>`;
    }
    const unit = f.unit ? `<span class="u">${f.unit}</span>` : '';
    const inputType = f.type==='num' ? 'number' : 'text';
    const step = f.type==='num' ? ' step="any"' : '';
    const botonTraer = f.k==='ticker' ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-traer-real" onclick="traerDatosRealesYahoo()" style="margin-top:6px;"><i class="ti ti-cloud-download"></i> Traer todos los datos reales disponibles</button><div id="traer-real-msg" style="font-size:11.5px;margin-top:4px;"></div><div id="traer-real-link" style="margin-top:2px;"></div><div id="comparables-box" style="margin-top:10px;"></div>` : '';
    const botonInflacion = f.k==='inflationBase' ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-inflacion-real" onclick="traerInflacionRealDivisa()" style="margin-top:6px;"><i class="ti ti-building-bank"></i> Traer inflación real (Banco Mundial)</button><div id="inflacion-real-msg" style="font-size:11.5px;margin-top:4px;"></div>` : '';
    return `<div class="field">
      <label>${f.label} ${reqMark}${hint}</label>
      <div class="unit"><input id="f-${f.k}" type="${inputType}"${step} placeholder="${f.placeholder||''}">${unit}</div>
      ${src}
      ${botonTraer}
      ${botonInflacion}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// TRAER DATOS REALES — completa automáticamente el precio actual y,
// cuando hay suficiente histórico, la volatilidad anualizada real,
// a partir de una Edge Function que consulta Yahoo Finance del lado
// del servidor. El estudiante sigue pudiendo editar cualquier campo
// después, esto solo ahorra tener que buscar los datos a mano.
// ═══════════════════════════════════════════════════════════════
const YAHOO_SUPABASE_URL = 'https://rlzwbsitjtmtynxiexlp.supabase.co';
const YAHOO_SUPABASE_ANON_KEY = 'sb_publishable_Y7UdPZo5Gk8lrw2DDStsSw_XVIrh7-M';

// Líder real y conocido de cada sector — empresas genuinamente
// dominantes por capitalización de mercado en su categoría, no una
// elección arbitraria. Se usa el mismo endpoint ya usado para "Traer
// datos reales" (quick-task?symbol=X), que acepta cualquier símbolo
// válido — no requiere ningún cambio de backend, solo se pide un
// segundo símbolo conocido.
const SECTOR_LEADER = {
  banca:        { ticker:'JPM', nombre:'JPMorgan Chase' },
  energia:      { ticker:'XOM', nombre:'ExxonMobil' },
  retail:       { ticker:'WMT', nombre:'Walmart' },
  tecnologia:   { ticker:'MSFT', nombre:'Microsoft' },
  inmobiliario: { ticker:'PLD', nombre:'Prologis' },
  manufactura:  { ticker:'CAT', nombre:'Caterpillar' },
};

async function renderComparacionLiderSector(data){
  const cont = $('comparacion-lider-box');
  if(!cont) return;
  const lider = SECTOR_LEADER[data.sector];
  const tickerActivo = (data.ticker||'').trim().toUpperCase();
  if(!lider || currentMarket!=='accion' || !tickerActivo){ cont.innerHTML=''; return; }
  if(tickerActivo === lider.ticker){
    cont.innerHTML = `<div class="card-title"><i class="ti ti-crown"></i> Comparación contra el líder del sector</div><div class="info-box">${tickerActivo} ya es el líder de referencia de este sector — no hay una comparación distinta que mostrar.</div>`;
    return;
  }
  cont.innerHTML = `<div class="card-title"><i class="ti ti-crown"></i> Comparación contra el líder del sector</div><div style="text-align:center;padding:14px;color:var(--t3);font-size:12px;">Consultando datos reales de ${lider.nombre} (${lider.ticker})…</div>`;
  try {
    const resp = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbol=${encodeURIComponent(lider.ticker)}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await resp.json();
    if(!d.ok || !d.fundamentales){ cont.innerHTML = `<div class="card-title"><i class="ti ti-crown"></i> Comparación contra el líder del sector</div><div class="info-box">No se pudieron obtener datos reales de ${lider.nombre} ahora mismo.</div>`; return; }
    const f = d.fundamentales;
    const peLider = f.eps ? Number((d.precioActual/f.eps).toFixed(1)) : null;
    const peActivo = (data.eps && data.price) ? Number((Number(data.price)/Number(data.eps)).toFixed(1)) : null;
    const divYieldLider = (f.dividend && d.precioActual) ? Number((f.dividend/d.precioActual*100).toFixed(2)) : null;
    const divYieldActivo = (data.dividend && data.price) ? Number((Number(data.dividend)/Number(data.price)*100).toFixed(2)) : null;
    const fila = (etiqueta, valActivo, valLider, sufijo='') => `
      <tr>
        <td style="padding:7px 8px;color:var(--t3);">${etiqueta}</td>
        <td style="padding:7px 8px;text-align:right;font-family:var(--font-mono, monospace);font-weight:600;">${valActivo!=null?valActivo+sufijo:'—'}</td>
        <td style="padding:7px 8px;text-align:right;font-family:var(--font-mono, monospace);">${valLider!=null?valLider+sufijo:'—'}</td>
      </tr>`;
    cont.innerHTML = `
      <div class="card-title"><i class="ti ti-crown"></i> Comparación contra el líder del sector</div>
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="background:var(--c3, #f5f5f5);"><th style="padding:7px 8px;text-align:left;">Indicador</th><th style="padding:7px 8px;text-align:right;">${tickerActivo}</th><th style="padding:7px 8px;text-align:right;">${lider.ticker} (líder)</th></tr></thead>
        <tbody>
          ${fila('P/E Ratio', peActivo, peLider)}
          ${fila('ROE', data.roe!=null?Number(data.roe):null, f.roe, '%')}
          ${fila('Deuda/Patrimonio', data.debtEquity!=null?Number(data.debtEquity):null, f.debtEquity)}
          ${fila('Dividend Yield', divYieldActivo, divYieldLider, '%')}
        </tbody>
      </table>
      <div class="info-box" style="margin-top:10px;">${lider.nombre} es la referencia dominante real del sector — útil para ver si ${tickerActivo} cotiza con prima o descuento frente al líder, no como una recomendación de inversión.</div>`;
  } catch(e){
    cont.innerHTML = `<div class="card-title"><i class="ti ti-crown"></i> Comparación contra el líder del sector</div><div class="info-box">No se pudo cargar esta comparación ahora mismo.</div>`;
  }
}

// Estados financieros reales — a diferencia del resto de este
// archivo, se piden al proyecto de Supabase del SIMULADOR
// (zppwrnznsnphxbcqsxsg), no al de Analytics (inaccesible). La
// función estados-financieros-yahoo ya existe ahí, construida y
// verificada en el Simulador, y es un endpoint HTTP público normal:
// no importa qué app la llama, mientras el símbolo sea válido. Esta
// es la vía real para poner a Analytics al día con capacidades del
// Simulador sin necesitar acceso al backend propio de Analytics.
const SIMULADOR_SUPABASE_URL = 'https://zppwrnznsnphxbcqsxsg.supabase.co';
const SIMULADOR_SUPABASE_ANON_KEY = 'sb_publishable_QDlqCn_sV9kDtrSs4cvQzQ_8ji-2CcO';

// Gráfico de precio real — estándar en cualquier herramienta de
// mercado seria (Yahoo/Google/GURU siempre muestran el histórico de
// precio como lo primero que se ve de un activo), y hasta ahora
// Analytics no lo tenía en absoluto: el histórico de 6 meses ya se
// pedía para calcular volatilidad, pero nunca se mostraba. Mismo
// patrón robusto ya usado para correlación: se pide fresco en el
// momento de ver los resultados, directamente por ticker, sin
// depender de que el usuario haya usado "Traer datos reales" antes.
let precioRealChart = null;
async function renderGraficoPrecioReal(data){
  const cont = $('grafico-precio-box');
  if(!cont) return;
  const ticker = (data.ticker||'').trim().toUpperCase();
  if((currentMarket!=='accion' && currentMarket!=='divisa') || !ticker){ cont.innerHTML=''; return; }
  cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-candle"></i> Precio real (6 meses)</div><div style="text-align:center;padding:14px;color:var(--t3);font-size:12px;">Consultando histórico real de ${ticker}…</div>`;
  try {
    const resp = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbol=${encodeURIComponent(ticker)}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await resp.json();
    if(!d.ok || !d.historico6Meses?.length){
      cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-candle"></i> Precio real (6 meses)</div><div class="info-box">No se encontró histórico real de precio para ${ticker} ahora mismo.</div>`;
      return;
    }
    const serie = d.historico6Meses;
    const primero = serie[0].cierre, ultimo = serie[serie.length-1].cierre;
    const subiendo = ultimo >= primero;
    const color = subiendo ? '#00d084' : '#ff4757';
    cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-candle"></i> Precio real (6 meses) — ${ticker}</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">
        <span style="font-size:22px;font-weight:700;">$${ultimo.toFixed(2)}</span>
        <span style="font-size:13px;font-weight:600;color:${color};">${subiendo?'+':''}${((ultimo/primero-1)*100).toFixed(1)}% en 6 meses</span>
      </div>
      <div style="height:220px;"><canvas id="grafico-precio-canvas"></canvas></div>`;
    if(precioRealChart) precioRealChart.destroy();
    precioRealChart = new Chart(document.getElementById('grafico-precio-canvas'), {
      type: 'line',
      data: {
        labels: serie.map(p=>p.fecha),
        datasets: [{
          data: serie.map(p=>p.cierre),
          borderColor: color, borderWidth: 1.8, pointRadius: 0, tension: .1,
          fill: true,
          backgroundColor: (ctxG) => {
            const g = ctxG.chart.ctx.createLinearGradient(0,0,0,220);
            g.addColorStop(0, color+'40'); g.addColorStop(1, color+'02');
            return g;
          },
        }],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`$${c.raw.toFixed(2)}`}} },
        scales: {
          x: { ticks:{color:'#6580b0', font:{size:9}, maxTicksLimit:7}, grid:{display:false} },
          y: { ticks:{color:'#6580b0', font:{size:9}, callback:v=>'$'+v.toFixed(0)}, grid:{color:'rgba(0,0,0,.06)'} },
        },
      },
    });
  } catch(e){
    cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-candle"></i> Precio real (6 meses)</div><div class="info-box">No se pudo cargar el gráfico de precio ahora mismo.</div>`;
  }
}

async function renderEstadosFinancierosReales(data){
  const cont = $('estados-financieros-box');
  if(!cont) return;
  const ticker = (data.ticker||'').trim().toUpperCase();
  if(currentMarket!=='accion' || !ticker){ cont.innerHTML=''; $('balance-general-box').innerHTML=''; $('flujo-caja-box').innerHTML=''; return; }
  cont.innerHTML = `<div class="card-title"><i class="ti ti-file-invoice"></i> Estado de Resultados real</div><div style="text-align:center;padding:14px;color:var(--t3);font-size:12px;">Consultando datos reales de ${ticker}…</div>`;
  try {
    const resp = await fetch(`${SIMULADOR_SUPABASE_URL}/functions/v1/estados-financieros-yahoo?symbol=${encodeURIComponent(ticker)}`, {
      headers: { 'apikey': SIMULADOR_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SIMULADOR_SUPABASE_ANON_KEY}` },
    });
    const d = await resp.json();
    if(!d.ok || (!d.anios?.length && !d.trimestres?.length)){
      cont.innerHTML = `<div class="card-title"><i class="ti ti-file-invoice"></i> Estado de Resultados real</div><div class="info-box">No se encontraron estados financieros reales para ${ticker} ahora mismo.</div>`;
      return;
    }
    const fmtM = v => (v/1e6).toLocaleString('es-PA',{maximumFractionDigits:0});
    const filas = (arr, esTrimestral) => arr.slice(0,4).map(r => `
      <tr>
        <td style="padding:6px 8px;">${esTrimestral && r.fecha ? r.fecha : r.year}</td>
        <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono, monospace);">$${fmtM(r.revenue)}M</td>
        <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono, monospace);font-weight:600;color:${r.netIncome>=0?'var(--green,#00d084)':'var(--red,#ff4757)'};">$${fmtM(r.netIncome)}M</td>
      </tr>`).join('');
    cont.innerHTML = `
      <div class="card-title"><i class="ti ti-file-invoice"></i> Estado de Resultados real — ${ticker}</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="btn btn-ghost btn-sm active" data-ef="anual" onclick="cambiarVistaEF('anual',this)">Anual</button>
        <button class="btn btn-ghost btn-sm" data-ef="trimestral" onclick="cambiarVistaEF('trimestral',this)">Trimestral</button>
      </div>
      <div id="ef-vista-anual"><table style="width:100%;font-size:12.5px;border-collapse:collapse;"><thead><tr style="background:var(--c3,#f5f5f5);"><th style="padding:6px 8px;text-align:left;">Año</th><th style="padding:6px 8px;text-align:right;">Ingresos</th><th style="padding:6px 8px;text-align:right;">Utilidad neta</th></tr></thead><tbody>${filas(d.anios||[], false)}</tbody></table></div>
      <div id="ef-vista-trimestral" style="display:none;"><table style="width:100%;font-size:12.5px;border-collapse:collapse;"><thead><tr style="background:var(--c3,#f5f5f5);"><th style="padding:6px 8px;text-align:left;">Trimestre</th><th style="padding:6px 8px;text-align:right;">Ingresos</th><th style="padding:6px 8px;text-align:right;">Utilidad neta</th></tr></thead><tbody>${filas(d.trimestres||[], true)}</tbody></table></div>
      <div class="info-box" style="margin-top:10px;">Ingresos y utilidad neta reales.${d.urlYahoo?` <a href="${d.urlYahoo}" target="_blank" rel="noopener">Ver en Yahoo Finance ↗</a>`:''}</div>`;
  } catch(e){
    cont.innerHTML = `<div class="card-title"><i class="ti ti-file-invoice"></i> Estado de Resultados real</div><div class="info-box">No se pudo cargar el estado de resultados ahora mismo.</div>`;
  }
  renderBalanceYFlujoRealesSEC(ticker);
}

// Balance General y Flujo de Caja REALES vía la SEC — el mismo hueco
// que Yahoo restringe a cuentas de pago (confirmado empíricamente en
// el Simulador), resuelto con la fuente OFICIAL de EE.UU. que las
// empresas públicas están legalmente obligadas a reportar en sus
// 10-K/10-Q, gratuita y sin restricción. Solo cubre empresas públicas
// de EE.UU. (~10,400 con CIK registrado) — si el ticker no tiene
// cobertura (empresa extranjera), se indica con claridad en vez de
// mostrar algo vacío o inventado.
async function renderBalanceYFlujoRealesSEC(ticker){
  const balCont = $('balance-general-box');
  const cfCont = $('flujo-caja-box');
  if(!balCont || !cfCont) return;
  balCont.innerHTML = `<div class="card-title"><i class="ti ti-building"></i> Estado de Situación Financiera</div><div style="text-align:center;padding:14px;color:var(--t3);font-size:12px;">Consultando la SEC…</div>`;
  cfCont.innerHTML = '';
  try {
    const resp = await fetch(`${SIMULADOR_SUPABASE_URL}/functions/v1/estados-financieros-sec?symbol=${encodeURIComponent(ticker)}`, {
      headers: { 'apikey': SIMULADOR_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SIMULADOR_SUPABASE_ANON_KEY}` },
    });
    const d = await resp.json();
    if(!d.ok){
      balCont.innerHTML = `<div class="card-title"><i class="ti ti-building"></i> Estado de Situación Financiera</div><div class="info-box">${ticker} no tiene cobertura en la SEC — esta fuente solo cubre empresas públicas de EE.UU. con reporte 10-K/10-Q.</div>`;
      return;
    }
    const fmtM = v => Math.round(v/1e6).toLocaleString('es-PA');
    const bal = (d.balanceGeneral?.anual||[]).slice(0,4);
    if(bal.length>=2){
      balCont.innerHTML = `
        <div class="card-title"><i class="ti ti-building"></i> Estado de Situación Financiera — ${ticker}</div>
        <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
          <thead><tr style="background:var(--c3,#f5f5f5);"><th style="padding:6px 8px;text-align:left;">Año</th><th style="padding:6px 8px;text-align:right;">Total activos</th><th style="padding:6px 8px;text-align:right;">Total pasivos</th><th style="padding:6px 8px;text-align:right;">Patrimonio</th></tr></thead>
          <tbody>${bal.map(r=>`<tr><td style="padding:6px 8px;">${r.fecha.slice(0,4)}</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);">$${fmtM(r.activos)}M</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);color:var(--red,#ff4757);">$${fmtM(r.pasivos)}M</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);font-weight:600;color:var(--green,#00d084);">$${fmtM(r.patrimonio)}M</td></tr>`).join('')}</tbody>
        </table>
        <div class="info-box" style="margin-top:10px;">100% real — fuente: SEC (10-K), cifras oficiales reportadas por la empresa. <a href="${d.urlSEC}" target="_blank" rel="noopener">Ver en SEC EDGAR ↗</a></div>`;
    } else {
      balCont.innerHTML = `<div class="card-title"><i class="ti ti-building"></i> Estado de Situación Financiera</div><div class="info-box">La SEC no tiene suficiente historial de balance para ${ticker} todavía.</div>`;
    }
    const flujo = (d.flujoCaja?.anual||[]).slice(0,4);
    if(flujo.length>=2){
      cfCont.innerHTML = `
        <div class="card-title"><i class="ti ti-cash"></i> Estado de Flujo de Efectivo — ${ticker}</div>
        <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
          <thead><tr style="background:var(--c3,#f5f5f5);"><th style="padding:6px 8px;text-align:left;">Año</th><th style="padding:6px 8px;text-align:right;">Operativo</th><th style="padding:6px 8px;text-align:right;">Inversión</th><th style="padding:6px 8px;text-align:right;">Financiamiento</th></tr></thead>
          <tbody>${flujo.map(r=>`<tr><td style="padding:6px 8px;">${r.fecha.slice(0,4)}</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);color:${r.operativo>=0?'var(--green,#00d084)':'var(--red,#ff4757)'};">$${fmtM(r.operativo)}M</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);color:${r.inversion>=0?'var(--green,#00d084)':'var(--red,#ff4757)'};">$${fmtM(r.inversion)}M</td><td style="padding:6px 8px;text-align:right;font-family:var(--font-mono,monospace);color:${r.financiamiento>=0?'var(--green,#00d084)':'var(--red,#ff4757)'};">$${fmtM(r.financiamiento)}M</td></tr>`).join('')}</tbody>
        </table>
        <div class="info-box" style="margin-top:10px;">100% real — fuente: SEC (10-K), cifras oficiales reportadas por la empresa. <a href="${d.urlSEC}" target="_blank" rel="noopener">Ver en SEC EDGAR ↗</a></div>`;
    }
  } catch(e){
    balCont.innerHTML = `<div class="card-title"><i class="ti ti-building"></i> Estado de Situación Financiera</div><div class="info-box">No se pudo cargar el balance ahora mismo.</div>`;
  }
}
function cambiarVistaEF(modo, btn){
  document.querySelectorAll('[data-ef]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  $('ef-vista-anual').style.display = modo==='anual' ? '' : 'none';
  $('ef-vista-trimestral').style.display = modo==='trimestral' ? '' : 'none';
}

async function traerDatosRealesYahoo(){
  const ticker = $('f-ticker')?.value?.trim();
  const msg = $('traer-real-msg');
  const boton = $('btn-traer-real');
  if(!ticker){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Escribe primero el símbolo o par de divisas.'; return; }
  boton.disabled = true; boton.style.opacity='.6';
  msg.style.color='var(--t3)'; msg.textContent='Consultando cotización y datos fundamentales reales…';
  try {
    const respuesta = await fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbol=${encodeURIComponent(ticker)}`, {
      headers: { 'apikey': YAHOO_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${YAHOO_SUPABASE_ANON_KEY}` },
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error || 'No se pudo consultar el símbolo.');

    if($('f-price')) $('f-price').value = d.precioActual;

    // Auto-relleno del sector según el ticker real — antes era un
    // paso manual que el usuario tenía que recordar hacer, señalado
    // explícitamente como un punto de confusión real. Solo se
    // autocompleta cuando el sector es conocido con certeza (mapa
    // maestro); si no está en el mapa, el campo se deja como estaba
    // (el usuario puede elegirlo a mano, pero no se le fuerza nada).
    const sectorConocido = SECTOR_DE_ESTE_TICKER[ticker.toUpperCase()];
    if(sectorConocido && $('f-sector')) $('f-sector').value = sectorConocido;

    // Volatilidad anualizada real, calculada a partir de los retornos
    // diarios del histórico de 6 meses — la fórmula estándar: desviación
    // estándar de los retornos logarítmicos diarios × raíz de 252 (días
    // de negociación en un año), expresada en porcentaje.
    if($('f-volatility') && d.historico6Meses?.length > 10){
      const cierres = d.historico6Meses.map(p=>p.cierre);
      const retornos = [];
      for(let i=1;i<cierres.length;i++) retornos.push(Math.log(cierres[i]/cierres[i-1]));
      const media = retornos.reduce((a,b)=>a+b,0)/retornos.length;
      const varianza = retornos.reduce((a,b)=>a+(b-media)**2,0)/(retornos.length-1);
      const volAnualizada = Math.sqrt(varianza) * Math.sqrt(252) * 100;
      $('f-volatility').value = volAnualizada.toFixed(1);
    }

    // Datos fundamentales reales — solo existen para acciones, Yahoo
    // no tiene EPS ni valor en libros de un par de divisas.
    let camposLlenados = ($('f-price')?1:0) + ($('f-volatility')?1:0);
    if(d.fundamentales){
      const f = d.fundamentales;
      const mapa = { 'f-eps':f.eps, 'f-bookValue':f.bookValue, 'f-dividend':f.dividend, 'f-beta':f.beta, 'f-shares':f.sharesOutstanding, 'f-debtEquity':f.debtEquity, 'f-roe':f.roe, 'f-epsGrowth':f.crecimientoUtilidades, 'f-expReturn':f.expReturn };
      Object.entries(mapa).forEach(([id,val])=>{
        if(val!=null && $(id)){ $(id).value = val; camposLlenados++; }
      });
    }

    // Enlace específico por campo — cada indicador apunta a la
    // sub-página exacta de Yahoo Finance de donde salió ese dato en
    // particular, no un enlace genérico repetido en todos.
    const simboloReal = d.simbolo;
    const urlBase = `https://finance.yahoo.com/quote/${encodeURIComponent(simboloReal)}`;
    const enlacesPorCampo = {
      'f-price': urlBase, 'f-eps': `${urlBase}/key-statistics`, 'f-bookValue': `${urlBase}/key-statistics`,
      'f-dividend': urlBase, 'f-beta': `${urlBase}/key-statistics`, 'f-shares': `${urlBase}/key-statistics`,
      'f-debtEquity': `${urlBase}/key-statistics`, 'f-roe': `${urlBase}/key-statistics`,
      'f-epsGrowth': `${urlBase}/analysis`, 'f-expReturn': `${urlBase}/analysis`,
      'f-volatility': `${urlBase}/history`,
    };
    Object.entries(enlacesPorCampo).forEach(([id, url])=>{
      const campo = $(id);
      if(!campo) return;
      const nota = campo.closest('.field')?.querySelector('.field-note');
      if(nota) nota.innerHTML = `<a href="${url}" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px;"></i> Ver fuente real en Yahoo Finance ↗</a>`;
    });

    // Enlace directo a la ficha real en Yahoo Finance, para verificar
    // o profundizar en cualquier dato que el formulario no cubra.
    const contEnlace = $('traer-real-link');
    if(d.urlYahooFinance){
      if(contEnlace) contEnlace.innerHTML = `<a href="${d.urlYahooFinance}" target="_blank" rel="noopener" style="font-size:11.5px;"><i class="ti ti-external-link"></i> Ver ${d.simbolo} en Yahoo Finance ↗</a>`;
    }

    // Comparables reales del mismo sector — contexto de valoración
    // relativa, no solo el múltiplo aislado del activo principal.
    const boxComparables = $('comparables-box');
    if(boxComparables){
      if(d.comparables?.length){
        const peActual = d.fundamentales?.eps ? Number((d.precioActual / d.fundamentales.eps).toFixed(1)) : null;
        const filas = [{simbolo:d.simbolo+' (este)', pe:peActual, roe:d.fundamentales?.roe, principal:true}, ...d.comparables].map(c => `
          <tr style="${c.principal?'font-weight:700;background:var(--c2);':''}">
            <td style="padding:5px 8px;">${c.simbolo}</td>
            <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono, monospace);">${c.pe ?? '—'}</td>
            <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono, monospace);">${c.roe!=null?c.roe+'%':'—'}</td>
          </tr>`).join('');
        boxComparables.innerHTML = `
          <div style="font-size:11px;color:var(--t3);margin-bottom:5px;"><i class="ti ti-scale"></i> Comparables reales del sector</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;background:var(--c2);border-radius:8px;overflow:hidden;">
            <thead><tr style="background:var(--c3);"><th style="padding:5px 8px;text-align:left;">Empresa</th><th style="padding:5px 8px;text-align:right;">P/E</th><th style="padding:5px 8px;text-align:right;">ROE</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>`;
      } else {
        boxComparables.innerHTML = '';
      }
    }

    msg.style.color='var(--green, #00d084)';
    const notaTrimestre = d.fundamentales?.trimestreMasReciente ? ` Fundamentales del trimestre cerrado el ${d.fundamentales.trimestreMasReciente}.` : '';
    msg.textContent = `Listo: ${d.nombre} a ${d.precioActual} ${d.moneda}. ${camposLlenados} campos completados con datos reales, cada uno con su enlace de fuente debajo.${notaTrimestre} Puedes ajustar cualquiera antes de analizar.`;
  } catch(e){
    msg.style.color='var(--red, #ff4757)';
    msg.textContent = 'No se pudo traer: ' + (e.message||e);
  } finally {
    boton.disabled=false; boton.style.opacity='1';
  }
}

// ═══════════════════════════════════════════════════════════════════
// INFLACIÓN REAL PARA DIVISAS — a través del Banco Mundial (API
// pública, sin necesidad de clave). Los datos macro oficiales tienen
// un rezago normal de uno a dos años, a diferencia de una cotización
// bursátil — se lo advierte al usuario en el propio mensaje.
// ═══════════════════════════════════════════════════════════════════
const CODIGOS_PAIS_DIVISA = {
  USD:{code:'USA', nombre:'Estados Unidos'}, EUR:{code:'DEU', nombre:'Alemania (referencia zona euro)'},
  GBP:{code:'GBR', nombre:'Reino Unido'}, JPY:{code:'JPN', nombre:'Japón'}, PAB:{code:'PAN', nombre:'Panamá'},
  MXN:{code:'MEX', nombre:'México'}, COP:{code:'COL', nombre:'Colombia'}, CNY:{code:'CHN', nombre:'China'},
  CAD:{code:'CAN', nombre:'Canadá'}, CHF:{code:'CHE', nombre:'Suiza'}, BRL:{code:'BRA', nombre:'Brasil'},
  AUD:{code:'AUS', nombre:'Australia'}, CRC:{code:'CRI', nombre:'Costa Rica'},
};
async function traerInflacionRealDivisa(){
  const par = $('f-ticker')?.value?.trim()?.toUpperCase().replace(/[^A-Z]/g,'');
  const msg = $('inflacion-real-msg');
  const boton = $('btn-inflacion-real');
  if(!par || par.length!==6){ msg.style.color='var(--red, #ff4757)'; msg.textContent='Escribe primero el par completo, ej: EUR/USD.'; return; }
  const base = par.slice(0,3), cotizada = par.slice(3,6);
  const infoBase = CODIGOS_PAIS_DIVISA[base], infoCotizada = CODIGOS_PAIS_DIVISA[cotizada];
  if(!infoBase || !infoCotizada){ msg.style.color='var(--red, #ff4757)'; msg.textContent=`No tengo el país mapeado para ${!infoBase?base:cotizada} todavía — ingrésalo manualmente.`; return; }
  boton.disabled=true; boton.style.opacity='.6';
  msg.style.color='var(--t3)'; msg.textContent='Consultando inflación oficial del Banco Mundial…';
  try {
    const consultar = async (codigoISO3) => {
      const r = await fetch(`https://api.worldbank.org/v2/country/${codigoISO3}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&mrnev=1`);
      const d = await r.json();
      return d?.[1]?.[0] || null;
    };
    // Secuencial, no en paralelo — el Banco Mundial limita solicitudes
    // simultáneas rápidas y responde con errores si se le exige de más.
    const datoBase = await consultar(infoBase.code);
    await new Promise(res=>setTimeout(res, 400));
    const datoCotizada = await consultar(infoCotizada.code);

    if(datoBase && $('f-inflationBase')) $('f-inflationBase').value = datoBase.value.toFixed(1);
    if(datoCotizada && $('f-inflationQuote')) $('f-inflationQuote').value = datoCotizada.value.toFixed(1);

    // El año exacto del dato queda visible directo bajo el campo, no
    // solo enterrado en el mensaje general — así se ve de inmediato,
    // sin tener que leer un párrafo, de qué año es cada cifra.
    const marcarAno = (idCampo, dato, nombrePais) => {
      const campo = $(idCampo);
      if(!campo || !dato) return;
      const nota = campo.closest('.field')?.querySelector('.field-note');
      if(nota) nota.innerHTML = `<i class="ti ti-building-bank" style="font-size:10px;"></i> Banco Mundial · ${nombrePais} · último dato oficial publicado: <b>${dato.date}</b>`;
    };
    marcarAno('f-inflationBase', datoBase, infoBase.nombre);
    marcarAno('f-inflationQuote', datoCotizada, infoCotizada.nombre);

    if(datoBase || datoCotizada){
      msg.style.color='var(--green, #00d084)';
      msg.textContent = `Listo: inflación de ${infoBase.nombre} (${datoBase?.date||'—'}) y ${infoCotizada.nombre} (${datoCotizada?.date||'—'}), el dato oficial más reciente que existe publicado en el Banco Mundial. Nota: el año más reciente varía por país según su propio calendario de publicación oficial, no todos publican el mismo año todavía — eso es normal en estadísticas macro, no un dato viejo por error.`;
    } else {
      msg.style.color='var(--red, #ff4757)';
      msg.textContent = 'El Banco Mundial no devolvió datos para este par en este momento. Puede estar limitando solicitudes temporalmente — intenta de nuevo en unos segundos, o ingresa el dato manualmente.';
    }
  } catch(e){
    msg.style.color='var(--red, #ff4757)';
    msg.textContent = 'No se pudo consultar: ' + (e.message||e);
  } finally {
    boton.disabled=false; boton.style.opacity='1';
  }
}

function loadExample(){
  const m = MARKETS[currentMarket];
  m.fields.forEach(f=>{
    if(f.ex!==undefined){ const el=$('f-'+f.k); if(el) el.value=f.ex; }
  });
  toast('Datos de ejemplo cargados — reemplázalos con valores reales','ok');
}

// ───── Recolección de datos del formulario ─────
function collectData(){
  const m = MARKETS[currentMarket];
  const data = {};
  const missing = [];
  m.fields.forEach(f=>{
    const el = $('f-'+f.k);
    let v = el ? el.value.trim() : '';
    if(f.type==='num'){
      v = v===''? null : parseFloat(v);
      if(f.req && (v===null || isNaN(v))) missing.push(f.label);
    } else {
      if(f.req && !v) missing.push(f.label);
    }
    data[f.k] = v;
  });
  return { data, missing };
}

// ══════════════════════════════════════════════════════════════
// MOTOR DE CÁLCULO FINANCIERO POR MERCADO
// Cada analizador devuelve: { kpis[], formulas[], riskFactors[],
//   mc:{mean,sigma,expReturnAnnual,horizonYears}, stress[], verdictInputs{} }
// ══════════════════════════════════════════════════════════════

// Distribución normal acumulada (para Black-Scholes y VaR)
function normCDF(x){
  const t = 1/(1+0.2316419*Math.abs(x));
  const d = 0.3989423*Math.exp(-x*x/2);
  let p = d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return x>0 ? 1-p : p;
}
function normPDF(x){ return 0.3989422804*Math.exp(-x*x/2); }

// helper para fórmulas
function F(name, cat, eq, value, valLabel, desc, interp){
  return { name, cat, eq, value, valLabel, desc, interp };
}
function RF(name, score, desc){ return { name, score:Math.max(0,Math.min(100,score)), desc }; }

// ───────────────────────────────────────────────
// ACCIONES
// ───────────────────────────────────────────────
function analyzeAccion(d){
  const price=d.price, eps=d.eps, bv=d.bookValue, div=d.dividend||0;
  const g=(d.epsGrowth||0)/100, beta=d.beta!=null?d.beta:1, vol=d.volatility, er=d.expReturn;
  const formulas=[], kpis=[];

  // Ratios de valoración
  const per = eps>0 ? price/eps : null;
  if(per!=null) formulas.push(F('Razón Precio/Utilidad (P/E)','Valoración','P/E = Precio / EPS', per, 'veces',
    'Cuántas veces la utilidad anual por acción está contenida en el precio.',
    per<15?'Un P/E relativamente bajo puede indicar que la acción está atractivamente valorada o que el mercado espera bajo crecimiento.':per<25?'Un P/E moderado, en rango típico del mercado.':'Un P/E elevado: el mercado paga una prima, usualmente por expectativas de alto crecimiento. Mayor riesgo si el crecimiento no se materializa.'));

  const pb = bv>0 ? price/bv : null;
  if(pb!=null) formulas.push(F('Razón Precio/Valor Libro (P/B)','Valoración','P/B = Precio / Valor en libros', pb, 'veces',
    'Relación entre el precio de mercado y el valor contable por acción.',
    pb<1?'Cotiza por debajo de su valor en libros, lo que puede señalar infravaloración o problemas de fondo.':pb<3?'Relación P/B razonable.':'P/B alto: el mercado valora intangibles o crecimiento por encima del valor contable.'));

  // Dividend yield
  const divYield = div>0 ? div/price*100 : 0;
  if(div>0) formulas.push(F('Rendimiento por dividendo','Ingreso','Yield = Dividendo anual / Precio × 100', divYield, '%',
    'Retorno anual por dividendos respecto al precio actual.',
    divYield>3?'Rendimiento por dividendo atractivo para inversores que buscan ingresos.':'Rendimiento por dividendo modesto; el retorno dependería más de la apreciación del precio.'));

  // Gordon (valor intrínseco por dividendos crecientes) si hay dividendo
  let gordon=null;
  if(div>0 && er/100 > g){
    gordon = (div*(1+g)) / (er/100 - g);
    formulas.push(F('Modelo de Gordon (valor intrínseco)','Valoración','V = D₁ / (r − g)', gordon, '$ por acción',
      'Valor teórico de la acción según el valor presente de dividendos futuros crecientes.',
      gordon>price?`El valor intrínseco estimado ($${fmt(gordon)}) supera el precio actual ($${fmt(price)}), lo que sugiere potencial de subvaloración.`:`El valor intrínseco estimado ($${fmt(gordon)}) está por debajo del precio actual ($${fmt(price)}), lo que sugiere que la acción podría estar cara según este modelo.`));
  }

  // CAPM
  const rf=4.5, mrp=5.5; // libre de riesgo y prima de mercado supuestas
  const capm = rf + beta*mrp;
  formulas.push(F('Rentabilidad requerida (CAPM)','Riesgo','E(R) = Rf + β × (Rm − Rf)', capm, '%',
    `Rentabilidad mínima exigida según el riesgo sistemático (β=${fmt(beta)}). Supuestos: Rf=${rf}%, prima=${mrp}%.`,
    er>=capm?`La rentabilidad esperada (${fmt(er)}%) supera la requerida por CAPM (${fmt(capm)}%): la acción compensaría su riesgo sistemático.`:`La rentabilidad esperada (${fmt(er)}%) es inferior a la requerida por CAPM (${fmt(capm)}%): no compensaría plenamente su riesgo de mercado.`));

  // Sharpe (aprox con vol)
  const sharpe = vol>0 ? (er-rf)/vol : null;
  if(sharpe!=null) formulas.push(F('Ratio de Sharpe','Riesgo','S = (R − Rf) / σ', sharpe, '',
    'Rentabilidad excedente por unidad de riesgo total (volatilidad).',
    sharpe>1?'Excelente relación rentabilidad-riesgo (Sharpe > 1).':sharpe>0.5?'Relación rentabilidad-riesgo aceptable.':sharpe>0?'Relación rentabilidad-riesgo baja: poco premio por el riesgo asumido.':'Sharpe negativo: la rentabilidad esperada no supera la tasa libre de riesgo.'));

  // ROE
  if(d.roe!=null) formulas.push(F('Rentabilidad sobre patrimonio (ROE)','Rentabilidad','ROE = Utilidad neta / Patrimonio', d.roe, '%',
    'Eficiencia de la empresa para generar beneficio con el capital de los accionistas.',
    d.roe>15?'ROE sólido: la empresa genera buen retorno sobre el capital propio.':'ROE moderado o bajo: revisar la eficiencia en el uso del capital.'));

  // Apalancamiento
  if(d.debtEquity!=null) formulas.push(F('Razón Deuda/Patrimonio','Solvencia','D/E = Deuda total / Patrimonio', d.debtEquity, 'veces',
    'Grado de apalancamiento financiero de la empresa.',
    d.debtEquity<1?'Estructura de capital conservadora.':d.debtEquity<2?'Apalancamiento moderado.':'Apalancamiento elevado: mayor riesgo financiero ante caídas de ingresos o subidas de tasas.'));

  // KPIs
  kpis.push({lbl:'Precio actual', val:fmtMoney(price), cls:''});
  if(per!=null) kpis.push({lbl:'P/E', val:fmt(per)+'×', cls:per<25?'g':'a'});
  kpis.push({lbl:'Rent. esperada', val:fmtPct(er), cls:'g'});
  kpis.push({lbl:'Volatilidad', val:fmtPct(vol), cls:vol>35?'r':'a'});
  if(sharpe!=null) kpis.push({lbl:'Sharpe', val:fmt(sharpe), cls:sharpe>0.5?'g':sharpe>0?'a':'r'});
  if(gordon!=null) kpis.push({lbl:'Valor intrínseco', val:fmtMoney(gordon), cls:gordon>price?'g':'r'});

  // Factores de riesgo (0=bueno,100=malo)
  const riskFactors=[];
  riskFactors.push(RF('Volatilidad', Math.min(100, vol/0.5), `Volatilidad anual de ${fmt(vol)}%. ${vol>35?'Alta: oscilaciones de precio pronunciadas.':vol>20?'Media: típica de renta variable.':'Baja para una acción.'}`));
  riskFactors.push(RF('Riesgo de mercado (β)', Math.min(100, beta*45), `Beta de ${fmt(beta)}. ${beta>1.3?'Amplifica los movimientos del mercado.':beta>0.8?'Se mueve en línea con el mercado.':'Menos sensible que el mercado.'}`));
  if(per!=null) riskFactors.push(RF('Valoración (P/E)', Math.min(100, Math.max(0,(per-10)*3.3)), `P/E de ${fmt(per)}×. ${per>30?'Valoración exigente: vulnerable a decepciones.':per>20?'Valoración algo elevada.':'Valoración contenida.'}`));
  if(d.debtEquity!=null) riskFactors.push(RF('Apalancamiento', Math.min(100, d.debtEquity*33), `D/E de ${fmt(d.debtEquity)}. ${d.debtEquity>2?'Endeudamiento alto.':'Endeudamiento manejable.'}`));
  const capmGap = capm-er; // positivo = no compensa
  riskFactors.push(RF('Premio sobre el rendimiento requerido (CAPM)', Math.min(100, Math.max(0, 50+capmGap*8)), capmGap<=0?`Compensa su riesgo sistemático (+${fmt(-capmGap)}% sobre lo requerido).`:`No compensa del todo su riesgo (${fmt(capmGap)}% por debajo de lo requerido).`));

  return {
    kpis, formulas, riskFactors,
    mc:{ mean:price, sigma:vol/100, expReturnAnnual:er/100, horizonYears:1, label:'precio de la acción' },
    stressBase:{ price, vol:vol/100, er:er/100 },
    verdictInputs:{ er, capm, sharpe, vol, gordon, price }
  };
}

// ───────────────────────────────────────────────
// DIVISAS (FOREX)
// ───────────────────────────────────────────────
function analyzeDivisa(d){
  const px=d.price, rB=d.rateBase/100, rQ=d.rateQuote/100, vol=d.volatility;
  const iB=(d.inflationBase||0)/100, iQ=(d.inflationQuote||0)/100;
  const horizon=(d.horizon||12)/12, er=(d.expReturn||0)/100;
  const formulas=[], kpis=[];

  // Diferencial de tasas (carry)
  const carry = (rB-rQ)*100;
  formulas.push(F('Diferencial de tasas (carry)','Carry','Carry = i_base − i_cotizada', carry, '%',
    'Diferencia entre las tasas de interés de ambas divisas. Base del carry trade.',
    carry>0?`La divisa base ofrece ${fmt(carry)}% más de interés: mantener una posición larga genera carry positivo.`:`La divisa cotizada ofrece mayor interés (${fmt(-carry)}%): una posición larga en el par tendría carry negativo (costo de mantenimiento).`));

  // Tipo de cambio forward (paridad de tasas)
  const fwd = px * (1+rQ*horizon)/(1+rB*horizon);
  formulas.push(F('Tipo de cambio a futuro (paridad de tasas, PTI)','Paridad','F = S × (1+i_cot·t)/(1+i_base·t)', fwd, '',
    'Tipo de cambio teórico a futuro según la paridad de tasas de interés.',
    fwd>px?`La paridad implica una depreciación esperada de la base (forward ${fmt(fwd,4)} > spot ${fmt(px,4)}).`:`La paridad implica una apreciación esperada de la base (forward ${fmt(fwd,4)} < spot ${fmt(px,4)}).`));

  // Paridad del poder adquisitivo (PPA)
  if(iB||iQ){
    const ppaExpected = px * (1+iQ)/(1+iB);
    formulas.push(F('Tipo de cambio según PPA','Paridad','S_ppa = S × (1+π_cot)/(1+π_base)', ppaExpected, '',
      'Tipo de cambio que igualaría el poder adquisitivo entre ambas economías.',
      ppaExpected>px?`Según la inflación relativa, la base tendería a depreciarse hacia ${fmt(ppaExpected,4)}.`:`Según la inflación relativa, la base tendería a apreciarse hacia ${fmt(ppaExpected,4)}.`));
  }

  // Retorno total esperado (apreciación + carry)
  const totalRet = er*100 + carry;
  formulas.push(F('Retorno total esperado','Rendimiento','R = apreciación + carry', totalRet, '%',
    'Retorno combinado por movimiento del tipo de cambio más el diferencial de tasas.',
    totalRet>0?`El retorno total esperado es positivo (${fmt(totalRet)}%): apreciación y/o carry favorecen la posición.`:`El retorno total esperado es negativo (${fmt(totalRet)}%): el carry o la depreciación esperada penalizan la posición.`));

  // Sharpe del par
  const rf=4.5;
  const sharpe = vol>0 ? (totalRet-0)/vol : null; // en forex el "exceso" se mide vs 0 (es relativo)
  if(sharpe!=null) formulas.push(F('Ratio rentabilidad-riesgo','Riesgo','S = Retorno esperado / σ', sharpe, '',
    'Retorno esperado por unidad de volatilidad cambiaria.',
    sharpe>0.5?'Buena relación retorno-riesgo para una posición cambiaria.':sharpe>0?'Relación retorno-riesgo modesta.':'El retorno esperado no compensa la volatilidad del par.'));

  kpis.push({lbl:'Tipo de cambio', val:fmt(px,4), cls:''});
  kpis.push({lbl:'Carry (dif. tasas)', val:fmtPct(carry), cls:carry>0?'g':'r'});
  kpis.push({lbl:'Forward teórico', val:fmt(fwd,4), cls:'b'});
  kpis.push({lbl:'Retorno total esp.', val:fmtPct(totalRet), cls:totalRet>0?'g':'r'});
  kpis.push({lbl:'Volatilidad', val:fmtPct(vol), cls:vol>12?'r':'a'});

  const riskFactors=[];
  riskFactors.push(RF('Volatilidad cambiaria', Math.min(100, vol/0.15), `Volatilidad de ${fmt(vol)}%. ${vol>12?'Alta para una divisa: movimientos amplios.':vol>7?'Media.':'Baja: par relativamente estable.'}`));
  riskFactors.push(RF('Diferencial de tasas (carry)', carry>=0?Math.max(0,40-carry*8):Math.min(100,50-carry*10), carry>=0?'Carry positivo: favorece mantener la posición.':'Carry negativo: costo por mantener la posición abierta.'));
  riskFactors.push(RF('Riesgo de paridad de tasas', Math.min(100, Math.abs((fwd-px)/px*100)*12), `La paridad de tasas implica un ajuste de ${fmt((fwd-px)/px*100)}% en el tipo de cambio.`));
  riskFactors.push(RF('Riesgo macro (inflación)', (iB||iQ)?Math.min(100, Math.abs(iQ-iB)*100*15):45, (iB||iQ)?`Diferencial de inflación de ${fmt(Math.abs(iQ-iB)*100)}% entre ambas economías.`:'Datos de inflación no especificados.'));

  return {
    kpis, formulas, riskFactors,
    mc:{ mean:px, sigma:vol/100, expReturnAnnual:(er + (rB-rQ)), horizonYears:horizon, label:'tipo de cambio', decimals:4 },
    stressBase:{ price:px, vol:vol/100 },
    verdictInputs:{ totalRet, carry, sharpe, vol }
  };
}

// Despachador
const ANALYZERS = { accion:analyzeAccion, divisa:analyzeDivisa };

// ══════════════════════════════════════════════════════════════
// SIMULACIÓN MONTE CARLO
// ══════════════════════════════════════════════════════════════
function gaussRandom(){
  let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function runMonteCarlo(mc){
  const N=10000;
  const { mean, sigma, expReturnAnnual, horizonYears } = mc;
  const drift = (expReturnAnnual - 0.5*sigma*sigma)*horizonYears;
  const diffusion = sigma*Math.sqrt(horizonYears);
  const finals=[];
  for(let i=0;i<N;i++){
    const z=gaussRandom();
    const ST = mean*Math.exp(drift + diffusion*z);
    finals.push(ST);
  }
  finals.sort((a,b)=>a-b);
  const pct = p => finals[Math.floor(p*N)];
  const meanFinal = finals.reduce((s,x)=>s+x,0)/N;
  const p5=pct(0.05), p50=pct(0.50), p95=pct(0.95), p25=pct(0.25), p75=pct(0.75);
  // VaR 95% sobre el retorno
  const var95Ret = (p5/mean - 1)*100;
  const var95Abs = mean - p5;
  // Probabilidad de pérdida (terminar por debajo del valor inicial)
  let below=0; for(const x of finals) if(x<mean) below++;
  const probLoss = below/N*100;
  // Retorno esperado realizado
  const expRet = (meanFinal/mean-1)*100;

  // Histograma (40 bins)
  const bins=40;
  const lo=finals[0], hi=finals[N-1], w=(hi-lo)/bins;
  const hist=new Array(bins).fill(0);
  const labels=[];
  for(const x of finals){ let idx=Math.min(bins-1,Math.floor((x-lo)/w)); hist[idx]++; }
  for(let i=0;i<bins;i++) labels.push(lo+w*(i+0.5));

  return { N, meanFinal, p5,p25,p50,p75,p95, var95Ret, var95Abs, probLoss, expRet, hist, labels, lo, hi, initial:mean };
}

// ══════════════════════════════════════════════════════════════
// VEREDICTO Y PUNTAJE DE RIESGO
// ══════════════════════════════════════════════════════════════
// Pesos relativos por sector — derivados de qué categoría de ratio
// prioriza cada sector según formulas-ratios.html (documento de
// referencia real, no inventado): Banca prioriza rentabilidad
// bancaria y solvencia regulatoria → ROE y D/E pesan más; Energía
// prioriza apalancamiento → D/E pesa más, penaliza menos la
// volatilidad (es intrínseca al sector); Retail prioriza crecimiento
// (Same-Store Sales) → crecimiento de utilidades pesa más; Tecnología
// prioriza crecimiento (Rule of 40) y tolera más volatilidad por
// naturaleza del sector; Real Estate prioriza retorno al inversor
// (Dividend Yield) → dividendo pesa mucho más; Manufactura no tiene
// un sesgo fuerte hacia ningún factor único (Asset Turnover no se
// recolecta hoy), queda balanceado. "General" mantiene el
// comportamiento exacto de antes de esta ponderación, para no
// cambiar la calificación de análisis ya guardados que no eligieron
// sector explícitamente.
const PESOS_POR_SECTOR = {
  general:     { roe:1.0, debtEquity:1.0, epsGrowth:1.0, dividend:1.0, betaPenalizacion:1.0 },
  banca:       { roe:1.8, debtEquity:1.6, epsGrowth:0.8, dividend:1.0, betaPenalizacion:1.0 },
  energia:     { roe:0.9, debtEquity:1.5, epsGrowth:0.9, dividend:1.1, betaPenalizacion:0.6 },
  retail:      { roe:1.1, debtEquity:0.9, epsGrowth:1.6, dividend:0.8, betaPenalizacion:1.0 },
  tecnologia:  { roe:0.8, debtEquity:0.6, epsGrowth:1.8, dividend:0.5, betaPenalizacion:0.5 },
  inmobiliario:{ roe:0.9, debtEquity:1.2, epsGrowth:0.8, dividend:1.9, betaPenalizacion:0.9 },
  manufactura: { roe:1.1, debtEquity:1.1, epsGrowth:1.1, dividend:1.0, betaPenalizacion:1.0 },
};

function computeVerdict(result, mcRes, data){
  // Riesgo global = promedio ponderado de factores (todos 0..100)
  const factors = result.riskFactors;
  const riskScore = factors.reduce((s,f)=>s+f.score,0)/factors.length;

  // Atractivo (0..100): combina retorno esperado, prob. de pérdida y señales propias del activo
  let attract = 50;
  const vi = result.verdictInputs;
  const pesos = PESOS_POR_SECTOR[data.sector] || PESOS_POR_SECTOR.general;
  // Componente Monte Carlo
  attract += (mcRes.expRet)*1.2;                  // premia retorno esperado
  attract -= (mcRes.probLoss-50)*0.5;             // penaliza prob de pérdida alta
  attract -= Math.max(0,(-mcRes.var95Ret)-10)*0.6*pesos.betaPenalizacion; // penaliza VaR severo (menos en sectores con volatilidad intrínseca)

  // Ajustes específicos por mercado
  if(currentMarket==='accion'){
    if(vi.sharpe!=null) attract += vi.sharpe*8;
    if(vi.gordon!=null && vi.price) attract += (vi.gordon/vi.price-1)*30;
    if(vi.er!=null && vi.capm!=null) attract += (vi.er-vi.capm)*2;
    // Ponderación sectorial directa sobre los factores fundamentales
    // ya recolectados — un banco con ROE alto pesa más que una
    // tecnológica con el mismo ROE, y viceversa con crecimiento.
    const d = data;
    if(d.roe!=null) attract += (Number(d.roe)-15) * 0.15 * (pesos.roe-1);
    if(d.debtEquity!=null) attract -= (Number(d.debtEquity)-1) * 3 * (pesos.debtEquity-1);
    if(d.epsGrowth!=null) attract += Number(d.epsGrowth) * 0.3 * (pesos.epsGrowth-1);
    if(d.dividend!=null && d.price) attract += (Number(d.dividend)/Number(d.price)*100) * 1.2 * (pesos.dividend-1);
  } else if(currentMarket==='divisa'){
    if(vi.sharpe!=null) attract += vi.sharpe*10;
    attract += vi.totalRet*1.5;
  }

  attract = Math.max(0, Math.min(100, attract));

  // Score compuesto: combina atractivo y (100-riesgo)
  const composite = attract*0.6 + (100-riskScore)*0.4;

  let grade, title, cls, desc;
  if(composite>=68 && riskScore<60){
    grade='A'; title='Recomendable invertir'; cls='success';
    desc='El análisis es favorable: la rentabilidad esperada compensa el riesgo medido y los indicadores fundamentales respaldan la inversión. Aun así, dimensiona la posición según tu tolerancia al riesgo.';
  } else if(composite>=52){
    grade='B'; title='Invertir con cautela'; cls='warn';
    desc='El activo presenta un perfil mixto: hay elementos atractivos, pero también riesgos relevantes que conviene gestionar. Considera una posición moderada, diversificación y un plan de salida claro.';
  } else if(composite>=38){
    grade='C'; title='Precaución elevada'; cls='warn';
    desc='El balance entre riesgo y retorno es desfavorable según los datos ingresados. La inversión solo se justificaría con una tesis muy específica y una gestión de riesgo estricta.';
  } else {
    grade='D'; title='No recomendable'; cls='danger';
    desc='El riesgo medido supera con claridad la recompensa esperada. Con los datos actuales, esta inversión no resulta aconsejable. Reevalúa los supuestos o busca alternativas.';
  }

  return { grade, title, cls, desc, riskScore, attract, composite };
}

// ══════════════════════════════════════════════════════════════
// EJECUTAR ANÁLISIS
// ══════════════════════════════════════════════════════════════
function runAnalysis(){
  const { data, missing } = collectData();
  if(missing.length){
    toast('Faltan campos obligatorios: '+missing.slice(0,2).join(', ')+(missing.length>2?'…':''),'err');
    return;
  }
  const result = ANALYZERS[currentMarket](data);
  const mcRes = runMonteCarlo(result.mc);
  const verdict = computeVerdict(result, mcRes, data);
  const stress = buildStress(result, mcRes, data);
  lastResult = { data, result, mcRes, verdict, stress, market:currentMarket };

  renderResults();
  show('page-results');
  setStep(3);
}

// ── Pruebas de estrés ──
function buildStress(result, mcRes, data){
  const base = result.mc.mean;
  const scenarios=[
    {name:'Escenario optimista (P95)', val:mcRes.p95, ret:(mcRes.p95/base-1)*100},
    {name:'Escenario favorable (P75)', val:mcRes.p75, ret:(mcRes.p75/base-1)*100},
    {name:'Escenario base (mediana)', val:mcRes.p50, ret:(mcRes.p50/base-1)*100},
    {name:'Escenario adverso (P25)', val:mcRes.p25, ret:(mcRes.p25/base-1)*100},
    {name:'Escenario severo (P5 / VaR 95%)', val:mcRes.p5, ret:(mcRes.p5/base-1)*100},
  ];
  // Caída de mercado -20%
  scenarios.push({name:'Choque de mercado (−20% subyacente)', val:base*0.8, ret:-20, shock:true});
  return scenarios;
}

// ══════════════════════════════════════════════════════════════
// RENDERIZADO DE RESULTADOS
// ══════════════════════════════════════════════════════════════
function setAudience(a){
  audience=a;
  document.querySelectorAll('#aud-toggle button').forEach(b=>b.classList.toggle('active', b.dataset.aud===a));
  renderResults();
}

function renderResults(){
  if(!lastResult) return;
  const { data, result, mcRes, verdict, stress, market } = lastResult;
  const m = MARKETS[market];
  $('result-asset-name').textContent = (data.ticker||m.name)+' · '+m.name;

  renderVerdict(verdict, mcRes, data.sector);
  renderComparacionLiderSector(data);
  renderEstadosFinancierosReales(data);
  renderGraficoPrecioReal(data);
  renderTesisIA(result, verdict, market, data);
  renderKPIs(result.kpis);
  renderRiskFactors(result.riskFactors, verdict.riskScore);
  renderMonteCarlo(mcRes, result.mc);
  renderStress(stress);
  renderFormulas(result.formulas);
}

function renderVerdict(v, mcRes, sector){
  const NOMBRE_SECTOR = {banca:'Banca y Finanzas', energia:'Energía y Commodities', retail:'Retail y Consumo', tecnologia:'Tecnología y SaaS', inmobiliario:'Real Estate / REITs', manufactura:'Manufactura e Industria'};
  const colorMap={success:'var(--green)',warn:'var(--amber)',danger:'var(--red)'};
  const col=colorMap[v.cls];
  const ringPct = v.composite;
  const simple = audience==='simple';
  const riskWord = v.riskScore<35?'BAJO':v.riskScore<60?'MODERADO':'ALTO';
  $('verdict-box').style.borderColor = col;
  $('verdict-box').innerHTML = `
    <div class="verdict-head">
      <div class="verdict-ring">
        <canvas id="verdict-ring-c" width="120" height="120"></canvas>
        <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;">
          <div>
            <div class="verdict-grade" style="color:${col};">${v.grade}</div>
            <div style="font-size:10px;color:var(--t3);font-family:var(--font-mono);">PUNTAJE</div>
          </div>
        </div>
      </div>
      <div class="verdict-info">
        <div class="verdict-label">Recomendación</div>
        <div class="verdict-title" style="color:${col};">${v.title}</div>
        <div class="verdict-desc">${v.desc}</div>
        ${sector && NOMBRE_SECTOR[sector] ? `<div style="font-size:11px;color:var(--accent2, #2962ff);margin-top:6px;"><i class="ti ti-adjustments-horizontal"></i> Calificación ponderada para el sector <b>${NOMBRE_SECTOR[sector]}</b></div>` : ''}
        <div class="verdict-score">
          Riesgo medido: <b style="color:${v.riskScore<35?'var(--green)':v.riskScore<60?'var(--amber)':'var(--red)'};">${riskWord}</b> (${fmt(v.riskScore,0)}/100)
          &nbsp;·&nbsp; Atractivo: <b>${fmt(v.attract,0)}/100</b>
          &nbsp;·&nbsp; Prob. de pérdida: <b>${fmt(mcRes.probLoss,0)}%</b>
        </div>
      </div>
    </div>
    ${simple ? `<div class="info-box ${v.cls}" style="margin-top:18px;margin-bottom:0;">
      <b>En palabras simples:</b> ${simpleExplanation(v, mcRes)}
    </div>`:''}
  `;
  drawRing('verdict-ring-c', ringPct, col);
}

function simpleExplanation(v, mcRes){
  const g=v.grade;
  if(g==='A') return `Según los números, esta inversión luce bien. Podría ganar valor y el riesgo está bajo control. De cada 100 escenarios simulados, en cerca de ${fmt(100-mcRes.probLoss,0)} terminarías ganando. Aun así, nunca inviertas más de lo que puedes permitirte arriesgar.`;
  if(g==='B') return `Esta inversión tiene cosas buenas y cosas riesgosas. Puede salir bien, pero también puede perder valor. En unos ${fmt(mcRes.probLoss,0)} de cada 100 escenarios simulados terminarías perdiendo. Si inviertes, hazlo con una parte pequeña y mantente atento.`;
  if(g==='C') return `Aquí el riesgo pesa más que la posible ganancia. En muchos escenarios (${fmt(mcRes.probLoss,0)} de cada 100) terminarías perdiendo. Solo tendría sentido si tienes una razón muy concreta para creer que subirá.`;
  return `Los números dicen que el riesgo es demasiado alto frente a lo que podrías ganar. En la mayoría de escenarios simulados no compensa. Con esta información, lo más prudente es no invertir.`;
}

// ═══════════════════════════════════════════════════════════════════
// TESIS DE INVERSIÓN CON IA — llama a una Edge Function de Supabase
// que guarda la clave de Gemini del lado del servidor; el navegador
// nunca la ve. Solo envía los indicadores YA CALCULADOS aquí mismo,
// nunca datos personales ni nada fuera de lo estrictamente necesario.
// ═══════════════════════════════════════════════════════════════════
const TESIS_IA_SUPABASE_URL = 'https://rlzwbsitjtmtynxiexlp.supabase.co';
// Esta es la clave pública ("anon"/"publishable") del proyecto, la
// misma que usa CapitalLab Academy. No es secreta — está diseñada
// para vivir en el navegador — y Supabase la exige en todo encabezado
// "apikey" solo para enrutar la solicitud a la función correcta, sin
// importar si la verificación de sesión está activada o no.
const TESIS_IA_SUPABASE_ANON_KEY = 'sb_publishable_Y7UdPZo5Gk8lrw2DDStsSw_XVIrh7-M';
let tesisIACache = {};

function renderTesisIA(result, verdict, market, data){
  const clave = JSON.stringify({market, ticker:data.ticker, price:data.price, formulas:result.formulas.map(f=>f.valor)});
  const box = $('tesis-ia-box');
  if(tesisIACache[clave]){
    box.innerHTML = tesisTextoHTML(tesisIACache[clave], data.ticker, market);
    return;
  }
  box.innerHTML = `
    <div class="card-title" style="display:flex;align-items:center;gap:8px;"><i class="ti ti-sparkles" style="color:var(--gold, #e8b94a);"></i> Tesis de inversión redactada con IA</div>
    <p style="font-size:12.5px;color:var(--t2);margin-bottom:12px;">Genera un párrafo profesional que integra los indicadores ya calculados arriba, incluyendo al menos un riesgo real, no solo argumentos a favor.</p>
    <button class="btn" onclick="generarTesisIA()"><i class="ti ti-sparkles"></i> Generar tesis</button>
    <div id="tesis-ia-msg" style="margin-top:8px;font-size:12px;"></div>
  `;
  box.dataset.claveTesis = clave;
}

function tesisTextoHTML(texto, ticker, market){
  const parrafos = texto.split(/\n+/).filter(p=>p.trim());
  // Enlace directo al Simulador de CapitalLab — lleva el activo y un
  // resumen de esta tesis, para que el estudiante no tenga que volver
  // a explicar lo que ya pensó aquí. Solo se ofrece para acciones y
  // divisas, los dos tipos que el Simulador también maneja con
  // sincronización real; el mercado se traduce al tipo que el
  // Simulador reconoce internamente.
  const tipoSimulador = market === 'divisa' ? 'divisa' : 'accion';
  const resumenCorto = texto.length > 220 ? texto.slice(0, 217) + '…' : texto;
  const urlSimulador = ticker
    ? `Simulador.html?ticker=${encodeURIComponent(ticker)}&tipo=${tipoSimulador}&origen=analytics&tesis=${encodeURIComponent(resumenCorto)}`
    : null;
  const botonSimulador = urlSimulador
    ? `<a href="${urlSimulador}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:10px;display:inline-flex;"><i class="ti ti-chart-candle"></i> Llevar esta tesis al Simulador</a>`
    : '';
  return `
    <div class="card-title" style="display:flex;align-items:center;gap:8px;"><i class="ti ti-sparkles" style="color:var(--gold, #e8b94a);"></i> Tesis de inversión redactada con IA</div>
    <div style="background:linear-gradient(135deg, var(--c2, #18212f), var(--c1, #131a26));border:1px solid var(--gold, #e8b94a);border-left-width:3px;border-radius:10px;padding:20px 22px;margin-top:6px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;color:var(--gold, #e8b94a);opacity:.4;line-height:.3;margin-bottom:8px;">&ldquo;</div>
      ${parrafos.map((p,i)=>`<p style="font-family:Georgia,'Times New Roman',serif;font-size:14.5px;color:var(--t1, #eef3fb);line-height:1.75;margin-bottom:12px;letter-spacing:.1px;">${p}</p>`).join('')}
      <div style="display:flex;align-items:center;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--c4, #2a3850);">
        <i class="ti ti-cpu" style="font-size:12px;color:var(--t3);"></i>
        <span style="font-size:10.5px;color:var(--t3);font-style:italic;">Generada automáticamente a partir de los indicadores calculados arriba. Revísala antes de usarla como parte de un informe formal.</span>
      </div>
    </div>
    ${botonSimulador}
  `;
}

// ═══════════════════════════════════════════════════════════════════
// REPORTE PROFESIONAL — arma un documento formal (Arial, estructura
// limpia, sin nada crudo del navegador) con el activo, todos los
// indicadores calculados y su interpretación, el veredicto, y la tesis
// de IA si ya se generó. Se abre en una ventana nueva lista para
// guardar como PDF, igual patrón que usan Academy y el Simulador.
// ═══════════════════════════════════════════════════════════════════
function generarReporteProfesional(){
  if(!lastResult){ toast?.('Primero ejecuta un análisis.'); return; }
  const { data, result, verdict, market } = lastResult;
  const m = MARKETS[market];
  const nombreActivo = data.ticker || m.name;
  const fecha = new Date().toLocaleDateString('es-PA', { year:'numeric', month:'long', day:'numeric' });

  // Los campos reales que genera el motor de análisis son name, cat,
  // value, valLabel, interp — no los nombres en español que se
  // usaban antes, que nunca existieron en el objeto real y por eso
  // la tabla completa salía en blanco ("undefined" en cada celda).
  const filasIndicadores = result.formulas.map(f => `
    <tr>
      <td style="font-weight:700;">${f.name}</td>
      <td style="text-align:center;">${f.cat}</td>
      <td style="text-align:right;font-family:'Courier New',monospace;">${typeof f.value==='number' ? f.value.toFixed(2) : f.value}${f.valLabel?' '+f.valLabel:''}</td>
    </tr>
    <tr><td colspan="3" style="font-size:11px;color:#555;padding-top:0;padding-bottom:10px;">${f.interp||''}</td></tr>
  `).join('');

  // La tesis de IA solo se incluye si el usuario ya la generó en
  // pantalla — el reporte nunca la genera de nuevo por su cuenta.
  // El diseño usa una tipografía serif para el cuerpo (como una
  // carta de un analista real) y una cita de apertura destacada,
  // en vez del mismo párrafo plano del resto del documento.
  const tesisCacheada = Object.values(tesisIACache)[0];
  const parrafosTesis = tesisCacheada ? tesisCacheada.split(/\n+/).filter(p=>p.trim()) : [];
  const seccionTesis = tesisCacheada ? `
    <h2>Tesis de inversión</h2>
    <div class="tesis-box">
      <div class="tesis-marca"><i>“</i></div>
      ${parrafosTesis.map((p,i)=>`<p class="${i===0?'tesis-primer-parrafo':''}">${p}</p>`).join('')}
      <div class="tesis-firma">Generado por el motor de análisis de CapitalLab, con inteligencia artificial · Gemini</div>
    </div>
  ` : `
    <h2>Tesis de inversión</h2>
    <p style="color:#777;font-style:italic;">No se generó una tesis redactada para este análisis. Puede generarla desde la pantalla de resultados antes de exportar el reporte, si desea incluirla.</p>
  `;

  const cuerpo = `
    <h1>Análisis de Inversión &middot; ${nombreActivo}</h1>
    <div class="sub">${m.name} · CapitalLab Analytics · ${fecha}</div>

    <h2>Veredicto</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr><td style="font-weight:700;padding:6px 0;">Calificación</td><td style="text-align:right;font-size:18px;font-weight:800;">${verdict.grade}</td></tr>
      <tr><td style="font-weight:700;padding:6px 0;">${verdict.title}</td><td></td></tr>
      <tr><td style="padding:6px 0;">Puntaje de riesgo</td><td style="text-align:right;">${verdict.riskScore?.toFixed?.(1) ?? verdict.riskScore}/100</td></tr>
      <tr><td style="padding:6px 0;">Puntaje de atractivo</td><td style="text-align:right;">${verdict.attract?.toFixed?.(1) ?? verdict.attract}/100</td></tr>
    </table>
    <p style="font-size:12.5px;color:#444;margin-bottom:20px;">${verdict.desc||''}</p>

    <h2>Indicadores calculados</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#1a2b4a;color:#fff;"><th style="padding:8px;text-align:left;">Indicador</th><th style="padding:8px;">Categoría</th><th style="padding:8px;text-align:right;">Valor</th></tr></thead>
      <tbody>${filasIndicadores}</tbody>
    </table>

    ${seccionTesis}

    <div style="margin-top:30px;padding:14px;background:#f5f5f5;border-left:4px solid #999;font-size:11.5px;color:#555;">
      <b>Aviso:</b> Este reporte es de carácter educativo y de apoyo al análisis. Los resultados se basan exclusivamente en los datos ingresados y en supuestos de modelos financieros estándar. No constituye asesoría de inversión ni garantiza resultados futuros.
    </div>
  `;

  abrirVentanaImpresionAnalytics(`Análisis de Inversión — ${nombreActivo}`, cuerpo);
}

function abrirVentanaImpresionAnalytics(tituloDoc, cuerpoHtml){
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${tituloDoc}</title>
    <style>
      body,div,td,th{font-family:Arial,Helvetica,sans-serif;color:#111;}
      body{padding:32px;max-width:800px;margin:0 auto;line-height:1.6;}
      h1{font-size:22px;margin-bottom:2px;color:#111;}
      .sub{color:#555;font-size:12.5px;margin-bottom:24px;}
      h2{font-size:16px;margin-top:26px;border-bottom:1px solid #ccc;padding-bottom:4px;color:#1a2b4a;}
      p{font-size:13px;text-align:justify;margin-bottom:10px;}
      table{font-size:12.5px;}
      td,th{border-bottom:1px solid #ddd;}
      /* Tesis de inversión: tipografía serif como una carta de un
         analista real, con una marca de cita y letra capital en el
         primer párrafo, distinta del resto del reporte a propósito. */
      .tesis-box{background:#fbfaf7;border:1px solid #e3ddd0;border-left:4px solid #b8860b;border-radius:4px;padding:24px 28px;margin-top:8px;position:relative;}
      .tesis-box p{font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.75;color:#2a2a2a;text-align:justify;margin-bottom:12px;}
      .tesis-marca{font-family:Georgia,serif;font-size:52px;color:#b8860b;opacity:.35;line-height:0.4;margin-bottom:6px;}
      .tesis-primer-parrafo::first-letter{font-family:Georgia,serif;font-size:38px;font-weight:700;color:#1a2b4a;float:left;line-height:0.8;margin:4px 6px 0 0;}
      .tesis-firma{font-family:Arial,sans-serif;font-size:10px;color:#999;text-align:right;margin-top:10px;font-style:italic;}
      @media print{ body{padding:0;} }
    </style></head><body>${cuerpoHtml}
    <script>window.onload=()=>{window.print();};<\/script>
  </body></html>`);
  win.document.close();
}

async function generarTesisIA(){
  if(!lastResult) return;
  const { data, result, verdict, market } = lastResult;
  const boton = document.querySelector('#tesis-ia-box button.btn');
  const msg = $('tesis-ia-msg');
  boton.disabled = true; boton.style.opacity='.6';
  const mensajesEspera = ['Redactando el argumento central…','Integrando los indicadores calculados…','Verificando coherencia con el veredicto…'];
  let i=0;
  boton.innerHTML = `<i class="ti ti-loader-2" style="animation:girarTesis 1s linear infinite;"></i> <span id="tesis-ia-mensaje">${mensajesEspera[0]}</span>`;
  if(!document.getElementById('tesis-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='tesis-ia-estilo-girar';
    st.textContent='@keyframes girarTesis{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  const intervalo = setInterval(()=>{ i=(i+1)%mensajesEspera.length; const s=$('tesis-ia-mensaje'); if(s) s.textContent=mensajesEspera[i]; }, 3500);

  try {
    const respuesta = await fetch(`${TESIS_IA_SUPABASE_URL}/functions/v1/dynamic-worker`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey': TESIS_IA_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${TESIS_IA_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        tipoActivo: market,
        nombreActivo: data.ticker || MARKETS[market].name,
        formulas: result.formulas.map(f=>({nombre:f.nombre, categoria:f.categoria, valor:f.valor, unidad:f.unidad, interpretacion:f.interpretacion})),
        verdict: { grade:verdict.grade, title:verdict.title, riskScore:verdict.riskScore, attract:verdict.attract },
      }),
    });
    const resultado = await respuesta.json();
    if(!resultado.ok) throw new Error(resultado.error || 'Error desconocido.');
    const box = $('tesis-ia-box');
    const clave = box.dataset.claveTesis;
    tesisIACache[clave] = resultado.tesis;
    box.innerHTML = tesisTextoHTML(resultado.tesis, data.ticker, market);
  } catch(e){
    msg.style.color = 'var(--red)';
    msg.textContent = 'No se pudo generar: ' + (e.message||e);
    boton.disabled=false; boton.style.opacity='1'; boton.innerHTML = '<i class="ti ti-sparkles"></i> Generar tesis';
  } finally {
    clearInterval(intervalo);
  }
}

function drawRing(id, pct, color){
  const c=document.getElementById(id); if(!c) return;
  const ctx=c.getContext('2d'); ctx.clearRect(0,0,120,120);
  ctx.lineWidth=9; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(60,60,50,0,2*Math.PI); ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(60,60,50,-Math.PI/2, -Math.PI/2 + 2*Math.PI*(pct/100)); ctx.strokeStyle=color; ctx.stroke();
}

function renderKPIs(kpis){
  $('kpi-grid').innerHTML = kpis.map(k=>`
    <div class="kpi">
      <div class="kpi-lbl">${k.lbl}</div>
      <div class="kpi-val ${k.cls||''}">${k.val}</div>
      ${k.sub?`<div class="kpi-sub">${k.sub}</div>`:''}
    </div>`).join('');
}

function renderRiskFactors(factors, globalScore){
  const colorFor = s => s<35?'var(--green)':s<60?'var(--amber)':'var(--red)';
  let html = factors.map(f=>`
    <div class="rf">
      <div class="rf-head">
        <span class="rf-name">${f.name}</span>
        <span class="rf-val" style="color:${colorFor(f.score)};">${fmt(f.score,0)}/100</span>
      </div>
      <div class="rf-track"><div class="rf-fill" style="width:${f.score}%;background:${colorFor(f.score)};"></div></div>
      <div class="rf-desc">${f.desc}</div>
    </div>`).join('');
  // barra global
  html = `<div class="rf" style="margin-bottom:6px;">
      <div class="rf-head">
        <span class="rf-name" style="font-weight:700;">Riesgo global ponderado</span>
        <span class="rf-val" style="color:${colorFor(globalScore)};font-weight:700;">${fmt(globalScore,0)}/100</span>
      </div>
      <div class="rf-track" style="height:12px;"><div class="rf-fill" style="width:${globalScore}%;background:${colorFor(globalScore)};"></div></div>
    </div><div style="height:1px;background:var(--c3);margin:6px 0 14px;"></div>` + html;
  $('risk-factors').innerHTML = html;
}

function renderMonteCarlo(mc, mcCfg){
  const dec = mcCfg.decimals||2;
  $('mc-n').textContent = mc.N.toLocaleString('es-PA');
  // KPIs MC
  $('mc-kpis').innerHTML = [
    {lbl:'Valor inicial', val:fmt(mc.initial,dec), cls:''},
    {lbl:'Valor esperado', val:fmt(mc.meanFinal,dec), cls:mc.meanFinal>=mc.initial?'g':'r'},
    {lbl:'Retorno esperado', val:fmtPct(mc.expRet), cls:mc.expRet>=0?'g':'r'},
    {lbl:'VaR 95%', val:fmtPct(mc.var95Ret), cls:'r', sub:'Valor en Riesgo (VaR)'},
    {lbl:'Prob. de pérdida', val:fmtPct(mc.probLoss,0), cls:mc.probLoss>50?'r':'a'},
    {lbl:'Rango P5–P95', val:fmt(mc.p5,dec)+' – '+fmt(mc.p95,dec), cls:'b'},
  ].map(k=>`<div class="kpi"><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val ${k.cls}" style="font-size:17px;">${k.val}</div>${k.sub?`<div class="kpi-sub">${k.sub}</div>`:''}</div>`).join('');

  if(mcChart) mcChart.destroy();
  const ctx=$('mc-chart').getContext('2d');
  const initialIdx = mc.labels.findIndex(l=>l>=mc.initial);
  mcChart=new Chart(ctx,{
    type:'bar',
    data:{ labels:mc.labels.map(l=>fmt(l,dec)),
      datasets:[{ data:mc.hist, backgroundColor:mc.labels.map(l=> l<mc.initial?'rgba(255,71,87,.55)':'rgba(0,208,132,.55)'),
        borderWidth:0, barPercentage:1, categoryPercentage:1 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:(it)=>'Valor ≈ '+it[0].label, label:(it)=>it.raw+' escenarios' } } },
      scales:{
        x:{ ticks:{ color:'#5f7491', font:{size:9}, maxTicksLimit:10 }, grid:{display:false} },
        y:{ ticks:{ color:'#5f7491', font:{size:9} }, grid:{color:'rgba(255,255,255,.03)'}, title:{display:true,text:'N.º de escenarios',color:'#5f7491',font:{size:10}} }
      } }
  });
}

function renderStress(stress){
  $('stress-table').innerHTML = `
    <thead><tr><th>Escenario</th><th style="text-align:right;">Valor proyectado</th><th style="text-align:right;">Retorno</th></tr></thead>
    <tbody>${stress.map(s=>`<tr>
      <td style="font-family:var(--font-body);">${s.name}</td>
      <td style="text-align:right;">${fmt(s.val, lastResult.result.mc.decimals||2)}</td>
      <td style="text-align:right;color:${s.ret>=0?'var(--green)':'var(--red)'};">${s.ret>=0?'+':''}${fmt(s.ret)}%</td>
    </tr>`).join('')}</tbody>`;
}

function renderFormulas(formulas){
  const cats = ['Todas', ...new Set(formulas.map(f=>f.cat))];
  $('formula-toolbar').innerHTML = cats.map((c,i)=>`<button class="fchip ${i===0?'active':''}" onclick="filterFormulas('${c}',this)">${c}</button>`).join('');
  window._allFormulas = formulas;
  paintFormulas(formulas);
}
function filterFormulas(cat, btn){
  document.querySelectorAll('#formula-toolbar .fchip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const list = cat==='Todas' ? window._allFormulas : window._allFormulas.filter(f=>f.cat===cat);
  paintFormulas(list);
}
function paintFormulas(list){
  const simple = audience==='simple';
  $('formula-list').innerHTML = list.map(f=>`
    <div class="formula">
      <div class="formula-name">${f.name} <span class="formula-cat">${f.cat}</span></div>
      <div class="formula-eq">${f.eq}</div>
      <div class="formula-result"><span class="rv">${typeof f.value==='number'?fmt(f.value, Math.abs(f.value)<10?4:2):f.value}</span><span class="rl">${f.valLabel||''}</span></div>
      ${!simple?`<div class="formula-desc">${f.desc}</div>`:''}
      <div class="formula-interp">${f.interp}</div>
    </div>`).join('');
}

// ───── Init ─────
renderMarkets();

// ══════════════════════════════════════════════════════════════
// CAPA INTERACTIVA: controles en vivo, escenarios, historial, comparación
// ══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'capitallab_analytics_v1';

// ───────────────────────────────────────────────
// RE-EJECUTAR ANÁLISIS CON DATOS DADOS (sin tocar el formulario)
// ───────────────────────────────────────────────
function analyzeWith(market, data){
  const prevMarket = currentMarket;
  currentMarket = market;
  const result = ANALYZERS[market](data);
  const mcRes = runMonteCarlo(result.mc);
  const verdict = computeVerdict(result, mcRes, data);
  const stress = buildStress(result, mcRes, data);
  currentMarket = prevMarket;
  return { data, result, mcRes, verdict, stress, market };
}

// ───────────────────────────────────────────────
// CONTROLES EN VIVO (sliders)
// ───────────────────────────────────────────────
let liveActive = false;
let liveData = null;   // copia editable de los datos

function toggleLiveControls(){
  const panel = $('live-panel');
  liveActive = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  $('btn-live').classList.toggle('btn-primary', liveActive);
  if(liveActive){ renderLiveControls(); panel.scrollIntoView({behavior:'smooth', block:'nearest'}); }
}

function renderLiveControls(){
  const m = MARKETS[lastResult.market];
  liveData = Object.assign({}, lastResult.data);
  const sliders = m.fields.filter(f=>f.sl && liveData[f.k]!=null && !isNaN(liveData[f.k]));
  $('live-sliders').innerHTML = sliders.map(f=>{
    const [min,max,step] = f.sl;
    const v = liveData[f.k];
    return `<div class="lslider">
      <div class="lslider-head">
        <span class="lslider-label">${f.label}</span>
        <span class="lslider-val" id="lv-${f.k}">${fmt(v, step<1?(step<0.01?4:2):0)}${f.unit?(' '+f.unit):''}</span>
      </div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" oninput="onLiveChange('${f.k}', this.value, ${step})">
      <div class="lslider-range"><span>${fmt(min,step<1?2:0)}</span><span>${fmt(max,step<1?2:0)}</span></div>
    </div>`;
  }).join('');
}

let liveDebounce = null;
function onLiveChange(key, val, step){
  liveData[key] = parseFloat(val);
  const f = MARKETS[lastResult.market].fields.find(x=>x.k===key);
  $('lv-'+key).textContent = fmt(parseFloat(val), step<1?(step<0.01?4:2):0)+(f.unit?(' '+f.unit):'');
  // Recalcular con debounce ligero para fluidez
  clearTimeout(liveDebounce);
  liveDebounce = setTimeout(()=>{
    lastResult = analyzeWith(lastResult.market, Object.assign({}, liveData));
    // Re-render sin tocar el panel de controles
    renderVerdict(lastResult.verdict, lastResult.mcRes);
    renderKPIs(lastResult.result.kpis);
    renderRiskFactors(lastResult.result.riskFactors, lastResult.verdict.riskScore);
    renderMonteCarlo(lastResult.mcRes, lastResult.result.mc);
    renderStress(lastResult.stress);
    renderFormulas(lastResult.result.formulas);
    renderScenarios();
  }, 90);
}

function resetLiveControls(){
  liveData = Object.assign({}, lastResult.originalData || lastResult.data);
  lastResult = analyzeWith(lastResult.market, Object.assign({}, liveData));
  renderResults();
  if(liveActive){ $('live-panel').classList.remove('hidden'); renderLiveControls(); }
  toast('Valores originales restaurados','ok');
}

// ───────────────────────────────────────────────
// ESCENARIOS INTERACTIVOS
// Tres palancas: optimismo de retorno, nivel de volatilidad, horizonte
// ───────────────────────────────────────────────
let scenarioState = { retShift:0, volMult:1, horizonMult:1 };

function renderScenarios(){
  const sc = scenarioState;
  $('scenario-controls').innerHTML = `
    <div class="lslider">
      <div class="lslider-head"><span class="lslider-label">Ajuste de rentabilidad esperada</span><span class="lslider-val" id="sc-ret">${sc.retShift>=0?'+':''}${fmt(sc.retShift,1)}%</span></div>
      <input type="range" min="-15" max="15" step="0.5" value="${sc.retShift}" oninput="onScenario('retShift',this.value)">
      <div class="lslider-range"><span>Pesimista −15%</span><span>Optimista +15%</span></div>
    </div>
    <div class="lslider">
      <div class="lslider-head"><span class="lslider-label">Nivel de volatilidad</span><span class="lslider-val" id="sc-vol">×${fmt(sc.volMult,2)}</span></div>
      <input type="range" min="0.5" max="2" step="0.05" value="${sc.volMult}" oninput="onScenario('volMult',this.value)">
      <div class="lslider-range"><span>Calma ×0.5</span><span>Turbulencia ×2</span></div>
    </div>
    <div class="lslider">
      <div class="lslider-head"><span class="lslider-label">Horizonte de tiempo</span><span class="lslider-val" id="sc-hor">×${fmt(sc.horizonMult,2)}</span></div>
      <input type="range" min="0.25" max="3" step="0.25" value="${sc.horizonMult}" oninput="onScenario('horizonMult',this.value)">
      <div class="lslider-range"><span>Corto ×0.25</span><span>Largo ×3</span></div>
    </div>`;
  computeScenario();
}

function onScenario(key, val){
  scenarioState[key] = parseFloat(val);
  const lbl = {retShift:'sc-ret', volMult:'sc-vol', horizonMult:'sc-hor'};
  if(key==='retShift') $('sc-ret').textContent = (scenarioState.retShift>=0?'+':'')+fmt(scenarioState.retShift,1)+'%';
  if(key==='volMult') $('sc-vol').textContent = '×'+fmt(scenarioState.volMult,2);
  if(key==='horizonMult') $('sc-hor').textContent = '×'+fmt(scenarioState.horizonMult,2);
  computeScenario();
}

function computeScenario(){
  const base = lastResult.result.mc;
  const mc = {
    mean: base.mean,
    sigma: base.sigma * scenarioState.volMult,
    expReturnAnnual: base.expReturnAnnual + scenarioState.retShift/100,
    horizonYears: base.horizonYears * scenarioState.horizonMult,
    decimals: base.decimals || 2
  };
  const res = runMonteCarlo(mc);
  const dec = mc.decimals;
  $('scenario-readout').innerHTML = [
    {lbl:'Valor esperado', val:fmt(res.meanFinal,dec), cls:res.meanFinal>=base.mean?'g':'r'},
    {lbl:'Retorno esperado', val:fmtPct(res.expRet), cls:res.expRet>=0?'g':'r'},
    {lbl:'Prob. de pérdida', val:fmtPct(res.probLoss,0), cls:res.probLoss>50?'r':'a'},
    {lbl:'VaR 95%', val:fmtPct(res.var95Ret), cls:'r'},
    {lbl:'Rango P5–P95', val:fmt(res.p5,dec)+' – '+fmt(res.p95,dec), cls:'b'},
  ].map(s=>`<div class="sc-stat"><div class="sc-stat-lbl">${s.lbl}</div><div class="sc-stat-val ${s.cls}">${s.val}</div></div>`).join('');
}

// ───────────────────────────────────────────────
// HISTORIAL (localStorage)
// ───────────────────────────────────────────────
function loadHistoryLocal(){
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function saveHistoryLocal(list){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e){}
}
async function loadHistory(){
  if(!clUsuario) return loadHistoryLocal();
  try {
    const { data, error } = await clsb.from('analytics_historial').select('id,entrada,creado_en').eq('user_id', clUsuario.id).order('creado_en',{ascending:false}).limit(30);
    if(error) throw error;
    return (data||[]).map(row => ({ ...row.entrada, id: row.id, _idNube: row.id }));
  } catch(e){ return []; }
}

async function saveCurrentAnalysis(){
  if(!lastResult){ return; }
  const entry = {
    id: Date.now(),
    name: lastResult.data.ticker || MARKETS[lastResult.market].name,
    market: lastResult.market,
    data: lastResult.data,
    grade: lastResult.verdict.grade,
    composite: lastResult.verdict.composite,
    riskScore: lastResult.verdict.riskScore,
    expRet: lastResult.mcRes.expRet,
    probLoss: lastResult.mcRes.probLoss,
    date: new Date().toLocaleDateString('es-PA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  };
  if(clUsuario){
    try {
      const { error } = await clsb.from('analytics_historial').insert({ user_id: clUsuario.id, entrada: entry });
      if(error) throw error;
      toast('Análisis guardado y sincronizado en tu cuenta','ok');
    } catch(e){ toast('No se pudo guardar en la nube: '+(e.message||e)); return; }
  } else {
    const list = loadHistoryLocal();
    list.unshift(entry);
    if(list.length>30) list.pop();
    saveHistoryLocal(list);
    toast('Análisis guardado en este dispositivo. Inicia sesión para sincronizarlo entre dispositivos.','ok');
  }
  await renderHistory();
}

async function renderHistory(){
  const list = await loadHistory();
  const sec = $('history-section');
  if(!list.length){ sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  const gradeColor = g => g==='A'?'var(--green)':g==='B'?'var(--amber)':g==='C'?'var(--amber)':'var(--red)';
  $('history-grid').innerHTML = list.map(h=>`
    <div class="hist-card" onclick="openHistory('${h.id}')">
      <div class="hist-grade" style="background:${gradeColor(h.grade)}22;color:${gradeColor(h.grade)};">${h.grade}</div>
      <div class="hist-name">${h.name}</div>
      <div class="hist-market">${MARKETS[h.market]?MARKETS[h.market].name:h.market}</div>
      <div class="hist-metrics">
        <span>Retorno <b class="${h.expRet>=0?'g':'r'}">${h.expRet>=0?'+':''}${fmt(h.expRet,1)}%</b></span>
        <span>Riesgo <b>${fmt(h.riskScore,0)}</b></span>
      </div>
      <div class="hist-date">${h.date}</div>
      <i class="ti ti-trash hist-del" onclick="event.stopPropagation();deleteHistory('${h.id}')"></i>
    </div>`).join('');
}

async function openHistory(id){
  const list = await loadHistory();
  const h = list.find(x=>String(x.id)===String(id));
  if(!h) return;
  currentMarket = h.market;
  lastResult = analyzeWith(h.market, Object.assign({}, h.data));
  lastResult.originalData = Object.assign({}, h.data);
  scenarioState = { retShift:0, volMult:1, horizonMult:1 };
  renderResults();
  show('page-results');
  setStep(3);
}

async function deleteHistory(id){
  if(clUsuario){
    try { await clsb.from('analytics_historial').delete().eq('id', id).eq('user_id', clUsuario.id); }
    catch(e){ toast('No se pudo borrar: '+(e.message||e)); return; }
  } else {
    let list = loadHistoryLocal();
    list = list.filter(x=>String(x.id)!==String(id));
    saveHistoryLocal(list);
  }
  await renderHistory();
  toast('Análisis eliminado','');
}

// ───────────────────────────────────────────────
// COMPARACIÓN DE ACTIVOS
// ───────────────────────────────────────────────
async function openCompare(){
  // Guardar el actual si no está, y mostrar selector
  const list = await loadHistory();
  if(!list.length){
    toast('Guarda al menos un análisis para poder comparar','err');
    saveCurrentAnalysis();
    return;
  }
  show('page-compare');
  renderComparePicker();
}
function goToResultsFromCompare(){ show('page-results'); setStep(3); }

async function renderComparePicker(){
  const list = await loadHistory();
  const current = lastResult;
  $('compare-info').innerHTML = `Comparando <b>${current.data.ticker||MARKETS[current.market].name}</b> (actual) con un análisis guardado. Elige el segundo:`;
  // Selector de candidatos
  const picker = list.map(h=>`<button class="btn btn-ghost btn-sm" onclick="doCompare('${h.id}')">${h.name} · ${MARKETS[h.market]?MARKETS[h.market].name:h.market} (${h.grade})</button>`).join('');
  $('compare-grid').innerHTML = `<div style="grid-column:1/-1;"><div class="cmp-pick">${picker}</div></div>`;
}

async function doCompare(id){
  const list = await loadHistory();
  const h = list.find(x=>String(x.id)===String(id));
  if(!h) return;
  const A = lastResult;
  const B = analyzeWith(h.market, Object.assign({}, h.data));
  const aComp = A.verdict.composite, bComp = B.verdict.composite;
  const aWin = aComp>=bComp;
  const col = (R, isWin, tag) => {
    const v=R.verdict, mc=R.mcRes;
    const gc = v.grade==='A'?'var(--green)':v.grade==='B'||v.grade==='C'?'var(--amber)':'var(--red)';
    return `<div class="cmp-col ${isWin?'winner':''}">
      <div class="cmp-head">
        <div><div class="cmp-name">${R.data.ticker||MARKETS[R.market].name}</div><div class="hist-market">${MARKETS[R.market].name}</div></div>
        <div class="cmp-grade" style="background:${gc}22;color:${gc};">${v.grade}</div>
      </div>
      <div class="cmp-row"><span class="l">Veredicto</span><span class="v" style="color:${gc};">${v.title}</span></div>
      <div class="cmp-row"><span class="l">Puntaje compuesto</span><span class="v">${fmt(v.composite,0)}/100</span></div>
      <div class="cmp-row"><span class="l">Riesgo medido</span><span class="v" style="color:${v.riskScore<35?'var(--green)':v.riskScore<60?'var(--amber)':'var(--red)'};">${fmt(v.riskScore,0)}/100</span></div>
      <div class="cmp-row"><span class="l">Retorno esperado</span><span class="v ${mc.expRet>=0?'g':'r'}">${mc.expRet>=0?'+':''}${fmt(mc.expRet,1)}%</span></div>
      <div class="cmp-row"><span class="l">Prob. de pérdida</span><span class="v">${fmt(mc.probLoss,0)}%</span></div>
      <div class="cmp-row"><span class="l">VaR 95%</span><span class="v r">${fmt(mc.var95Ret,1)}%</span></div>
      ${isWin?'<div class="cmp-badge">★ Mejor perfil riesgo-retorno</div>':''}
    </div>`;
  };
  $('compare-info').innerHTML = `Resultado de la comparación. El activo destacado tiene el mejor balance entre rentabilidad esperada y riesgo, según el puntaje compuesto.`;
  $('compare-grid').innerHTML = col(A, aWin) + col(B, !aWin);
  renderGraficoCorrelacionCompare(A, B);
}

// Gráfico de correlación entre los 2 activos comparados — mismo
// patrón ya construido y verificado para el Simulador: cada serie se
// normaliza a base 100 en su primer punto, así el rendimiento
// relativo de ambos se lee en la misma escala sin importar su precio
// original. Solo tiene sentido si ambos activos tienen un ticker real
// (no aplica a datos ingresados manualmente sin símbolo de mercado) —
// se pide el histórico fresco en el momento, no se depende de que
// haya quedado guardado de una sesión anterior.
async function renderGraficoCorrelacionCompare(A, B){
  const contId = 'compare-correlacion-box';
  let cont = document.getElementById(contId);
  if(!cont){
    cont = document.createElement('div');
    cont.id = contId;
    cont.className = 'card';
    cont.style.gridColumn = '1/-1';
    cont.style.marginTop = '14px';
    $('compare-grid').insertAdjacentElement('afterend', cont);
  }
  const tickerA = (A.data.ticker||'').trim();
  const tickerB = (B.data.ticker||'').trim();
  if(!tickerA || !tickerB || A.market!=='accion' && A.market!=='divisa' || B.market!=='accion' && B.market!=='divisa'){
    cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-line"></i> Correlación de rendimiento</div><div class="info-box">Este gráfico solo está disponible cuando ambos activos tienen un símbolo real de mercado — al menos uno de los dos se ingresó sin símbolo o con datos manuales.</div>`;
    return;
  }
  cont.innerHTML = `<div class="card-title"><i class="ti ti-chart-line"></i> Correlación de rendimiento (6 meses)</div><div style="height:260px;"><canvas id="compare-correlacion-canvas"></canvas></div><div class="info-box" style="margin-top:10px;">Cada línea parte de 100 en el punto inicial — muestra cuánto ha subido o bajado cada activo en términos relativos, sin importar su precio en dólares.</div>`;
  try {
    const [respA, respB] = await Promise.all([
      fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbol=${encodeURIComponent(tickerA)}`, { headers:{ 'apikey':YAHOO_SUPABASE_ANON_KEY, 'Authorization':`Bearer ${YAHOO_SUPABASE_ANON_KEY}` } }),
      fetch(`${YAHOO_SUPABASE_URL}/functions/v1/quick-task?symbol=${encodeURIComponent(tickerB)}`, { headers:{ 'apikey':YAHOO_SUPABASE_ANON_KEY, 'Authorization':`Bearer ${YAHOO_SUPABASE_ANON_KEY}` } }),
    ]);
    const [dA, dB] = await Promise.all([respA.json(), respB.json()]);
    if(!dA.ok || !dB.ok || !dA.historico6Meses?.length || !dB.historico6Meses?.length){
      cont.querySelector('.info-box').outerHTML = `<div class="info-box">No se pudo obtener el histórico real de uno de los dos activos ahora mismo.</div>`;
      return;
    }
    const nPuntos = Math.min(dA.historico6Meses.length, dB.historico6Meses.length);
    const serieA = dA.historico6Meses.slice(-nPuntos);
    const serieB = dB.historico6Meses.slice(-nPuntos);
    const baseA = serieA[0].cierre, baseB = serieB[0].cierre;
    new Chart(document.getElementById('compare-correlacion-canvas'), {
      type: 'line',
      data: {
        labels: serieA.map(p=>p.fecha),
        datasets: [
          { label: tickerA, data: serieA.map(p=>+(p.cierre/baseA*100).toFixed(2)), borderColor:'#4a9eff', backgroundColor:'transparent', borderWidth:1.8, pointRadius:0, tension:.1 },
          { label: tickerB, data: serieB.map(p=>+(p.cierre/baseB*100).toFixed(2)), borderColor:'#00d084', backgroundColor:'transparent', borderWidth:1.8, pointRadius:0, tension:.1 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:true, labels:{color:'#8a9ab8', font:{size:10}}},
          tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.raw.toFixed(2)} (${c.raw>=100?'+':''}${(c.raw-100).toFixed(2)}%)`}} },
        scales: {
          x: { ticks:{color:'#6580b0', font:{size:9}, maxTicksLimit:8}, grid:{display:false} },
          y: { ticks:{color:'#6580b0', font:{size:9}}, grid:{color:'rgba(255,255,255,.06)'} },
        },
      },
    });
  } catch(e){
    const infoBox = cont.querySelector('.info-box');
    if(infoBox) infoBox.outerHTML = `<div class="info-box">No se pudo cargar el gráfico de correlación ahora mismo.</div>`;
  }
}

// ───────────────────────────────────────────────
// HOOKS: guardar datos originales al analizar y refrescar historial
// ───────────────────────────────────────────────
const _origRunAnalysis = runAnalysis;
runAnalysis = function(){
  const { data, missing } = collectData();
  if(missing.length){
    toast('Faltan campos obligatorios: '+missing.slice(0,2).join(', ')+(missing.length>2?'…':''),'err');
    return;
  }
  const result = ANALYZERS[currentMarket](data);
  const mcRes = runMonteCarlo(result.mc);
  const verdict = computeVerdict(result, mcRes, data);
  const stress = buildStress(result, mcRes, data);
  lastResult = { data, result, mcRes, verdict, stress, market:currentMarket, originalData:Object.assign({},data) };
  scenarioState = { retShift:0, volMult:1, horizonMult:1 };
  liveActive = false; $('live-panel').classList.add('hidden'); $('btn-live').classList.remove('btn-primary');
  renderResults();
  show('page-results');
  setStep(3);
};

// Extender renderResults para incluir escenarios
const _origRenderResults = renderResults;
renderResults = function(){
  _origRenderResults();
  if($('scenario-controls')) renderScenarios();
};

// Al volver al inicio, refrescar historial
const _origGoToMarket = goToMarket;
goToMarket = function(){ _origGoToMarket(); renderHistory(); };

// Init sesión e historial al cargar
iniciarSesionEstado();
