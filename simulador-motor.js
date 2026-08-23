/* Proyecto CapitalLab — desarrollo original: Justin Jones, Universidad de Panamá, Facultad de Economía. Registro interno de autoría, no eliminar. */
// ══════════════════════════════════════════════════
// AUTENTICACIÓN — Supabase (correo/contraseña, roles, sesiones de clase)
// ══════════════════════════════════════════════════
// TODO antes de publicar: reemplazar con las credenciales reales del proyecto Supabase
// (Panel de Supabase → Project Settings → API). La "anon key" es pública por diseño,
// la seguridad real la dan las políticas de Row Level Security del esquema SQL adjunto.
const SUPABASE_URL = 'https://zppwrnznsnphxbcqsxsg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QDlqCn_sV9kDtrSs4cvQzQ_8ji-2CcO';

let sb = null;
let currentUser = null; // {auth_id, nombre, correo, rol, sesion_id, sesion_nombre}
let authPendingRole = 'estudiante';

function authConfigured(){
  return SUPABASE_URL.indexOf('TU-PROYECTO') === -1 && SUPABASE_ANON_KEY.indexOf('TU-ANON-KEY') === -1;
}

function authMsg(text, type){
  const el = document.getElementById('auth-msg');
  if(!el) return;
  el.textContent = text;
  el.className = 'auth-msg show ' + (type||'error');
}
function authMsgClear(){
  const el = document.getElementById('auth-msg');
  if(el){ el.className = 'auth-msg'; el.textContent=''; }
}

function authSwitchView(view){
  authMsgClear();
  ['login','signup','reset','nueva-password'].forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('active', v===view);
  });
  document.getElementById('tab-login').classList.toggle('active', view==='login');
  document.getElementById('tab-signup').classList.toggle('active', view==='signup');
  // Mientras se está creando la contraseña nueva, no tiene sentido mostrar
  // las pestañas de iniciar/crear cuenta ni la opción de entrar de invitado.
  const tabs = document.querySelector('#auth-gate .auth-tabs');
  const guestSep = document.querySelector('#auth-gate .auth-guest-sep');
  const guestRow = document.querySelector('#auth-gate .auth-guest-row');
  const ocultar = view === 'nueva-password';
  if(tabs) tabs.style.display = ocultar ? 'none' : '';
  if(guestSep) guestSep.style.display = ocultar ? 'none' : '';
  if(guestRow) guestRow.style.display = ocultar ? 'none' : '';
  if(view==='signup'){
    // Al volver a esta vista tras haber creado una sesión, ocultamos el aviso del código.
    document.getElementById('signup-code-result').style.display = 'none';
    document.getElementById('btn-signup').style.display = '';
  }
}

function authSetRole(role){
  authPendingRole = role;
  document.getElementById('role-estudiante').classList.toggle('active', role==='estudiante');
  document.getElementById('role-docente').classList.toggle('active', role==='docente');
  document.getElementById('field-sesion-estudiante').classList.toggle('hidden', role!=='estudiante');
  document.getElementById('field-sesion-docente').classList.toggle('hidden', role!=='docente');
}

// Genera un código corto y legible para compartir (sin caracteres ambiguos como 0/O, 1/I).
function generarCodigoSesion(){
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for(let i=0;i<6;i++) out += abc[Math.floor(Math.random()*abc.length)];
  return out;
}

// Si una llamada a Supabase se queda colgada (sin responder NI fallar — típico de un
// bloqueador de anuncios o un filtro de red bloqueando la petición en silencio), esto
// hace que después de 12 segundos se muestre un error claro en vez de dejar el botón
// girando para siempre sin que la persona sepa qué pasó.
function conTiempoLimite(promesa, segundos=12){
  return Promise.race([
    promesa,
    new Promise((_, reject)=>setTimeout(()=>reject(new Error(
      'La conexión con el servidor tardó demasiado. Es posible que un bloqueador de anuncios o el filtro de red de tu institución esté bloqueando el acceso a Supabase — pruébalo desde otra red o desactiva el bloqueador para este sitio.'
    )), segundos*1000))
  ]);
}

async function authSignup(){
  if(!authConfigured()){ authMsg('Supabase aún no está configurado en este archivo. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.', 'error'); return; }
  const nombre = document.getElementById('signup-name').value.trim();
  const correo = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const rol = authPendingRole;
  const codigoIngresado = rol==='estudiante' ? document.getElementById('signup-sesion-codigo').value.trim() : null;
  const sesionNombre = rol==='docente' ? document.getElementById('signup-sesion-nombre').value.trim() : null;

  if(!nombre || !correo || !password){ authMsg('Completa nombre, correo y contraseña.'); return; }
  if(password.length < 6){ authMsg('La contraseña debe tener al menos 6 caracteres.'); return; }
  if(rol==='estudiante' && !codigoIngresado){ authMsg('Ingresa el código de sesión que te dio tu docente.'); return; }
  if(rol==='docente' && !sesionNombre){ authMsg('Indica el nombre de la sesión de clase que vas a crear.'); return; }

  const btn = document.getElementById('btn-signup');
  btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Creando cuenta…';
  try {
    // Para estudiantes, validar el código ANTES de crear la cuenta de autenticación,
    // así no queda una cuenta huérfana si el código no existe.
    if(rol==='estudiante'){
      const { data: sesiones, error: buscarError } = await conTiempoLimite(
        sb.rpc('buscar_sesion_por_codigo', { p_codigo: codigoIngresado })
      );
      if(buscarError) throw buscarError;
      if(!sesiones || sesiones.length===0) throw new Error('El código de sesión no es válido o la sesión ya no está activa. Verifícalo con tu docente.');
    }

    // No creamos aún la fila en `sesiones_clase` ni en `usuarios`: mientras el
    // correo no esté confirmado no hay sesión de autenticación activa, y las
    // políticas de seguridad (RLS) exigen auth.uid() para poder escribir.
    // En su lugar, guardamos lo necesario en los metadatos de la cuenta y lo
    // completamos en authLoadProfileAndEnter() la primera vez que inicie sesión.
    const { data: signUpData, error: signUpError } = await conTiempoLimite(
      sb.auth.signUp({
        email: correo, password,
        options: {
          // Sin esto, Supabase manda el enlace de confirmación al "Site URL" configurado
          // en el panel (por defecto localhost, algo que solo tiene sentido en desarrollo).
          // Al fijarlo aquí, el enlace siempre apunta a donde realmente está publicado el sitio.
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: {
          pending_nombre: nombre,
          pending_rol: rol,
          pending_sesion_codigo: codigoIngresado || null,
          pending_sesion_nombre: sesionNombre || null,
        }}
      })
    );
    if(signUpError) throw signUpError;
    if(!signUpData.user) throw new Error('No se pudo crear la cuenta. Intenta de nuevo.');

    if(signUpData.session){
      // La confirmación de correo está desactivada en este proyecto: ya hay
      // sesión activa, así que completamos el registro y entramos de una vez.
      await authLoadProfileAndEnter();
    } else {
      authMsg('Cuenta creada. Revisa tu correo para confirmarla — al iniciar sesión por primera vez terminamos de configurar tu cuenta.', 'success');
      setTimeout(()=>authSwitchView('login'), 2600);
    }
  } catch(e){
    authMsg('Error al crear la cuenta: ' + (e.message||e));
  } finally {
    btn.disabled = false; btn.textContent = 'Crear cuenta';
  }
}

async function authLogin(){
  if(!authConfigured()){ authMsg('Supabase aún no está configurado en este archivo. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.', 'error'); return; }
  const correo = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if(!correo || !password){ authMsg('Ingresa tu correo y contraseña.'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Verificando…';
  try {
    const { error } = await conTiempoLimite(sb.auth.signInWithPassword({ email: correo, password }));
    if(error) throw error;
    await authLoadProfileAndEnter();
  } catch(e){
    authMsg('No se pudo iniciar sesión: ' + (e.message||e));
    btn.disabled = false; btn.textContent = 'Iniciar sesión';
  }
}

// Inicia sesión (o crea la cuenta, si es la primera vez) con Google. La
// pantalla de completar perfil ya existente se encarga del resto: como
// Google no manda rol ni código de sesión, cualquier cuenta que entre por
// primera vez y no tenga esos datos pendientes cae ahí sola.
async function authConGoogle(){
  if(!authConfigured() || !sb){ authMsg('Supabase aún no está configurado o no se pudo conectar.', 'error'); return; }
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if(error) throw error;
    // No hay nada más que hacer aquí: signInWithOAuth manda al navegador
    // fuera de la página, a la pantalla de Google. Cuando la persona
    // vuelva, authBoot() se encarga de reconocer la sesión nueva.
  } catch(e){
    authMsg('No se pudo iniciar con Google: ' + (e.message||e), 'error');
  }
}

async function authResetPassword(){
  if(!authConfigured()){ authMsg('Supabase aún no está configurado en este archivo.', 'error'); return; }
  const correo = document.getElementById('reset-email').value.trim();
  if(!correo){ authMsg('Ingresa tu correo electrónico.'); return; }
  const btn = document.getElementById('btn-reset');
  btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Enviando…';
  try {
    const { error } = await conTiempoLimite(sb.auth.resetPasswordForEmail(correo, {
      redirectTo: window.location.origin + window.location.pathname
    }));
    if(error) throw error;
    authMsg('Enlace de recuperación enviado a tu correo.', 'success');
  } catch(e){
    authMsg('No se pudo enviar el correo: ' + (e.message||e));
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar enlace de recuperación';
  }
}

// Es el otro lado del proceso de "olvidé mi contraseña": la persona ya
// entró desde el enlace que le llegó al correo, y esto es lo que
// realmente termina de cambiarle la contraseña — sin esto, el enlace
// solo la traía de vuelta a la app sin poder hacer nada.
async function finalizarRecuperacionPassword(){
  const p1 = document.getElementById('nueva-password-1').value;
  const p2 = document.getElementById('nueva-password-2').value;
  if(!p1 || p1.length < 6){ authMsg('La contraseña nueva debe tener al menos 6 caracteres.', 'error'); return; }
  if(p1 !== p2){ authMsg('Las dos contraseñas no coinciden.', 'error'); return; }
  const btn = document.getElementById('btn-nueva-password');
  btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Guardando…';
  try {
    const { error } = await conTiempoLimite(sb.auth.updateUser({ password: p1 }));
    if(error) throw error;
    // Limpia el token de recuperación de la URL para que, si la persona
    // recarga la página por accidente, no vuelva a caer en esta pantalla.
    history.replaceState(null, '', window.location.pathname);
    authMsg('Contraseña actualizada. Entrando…', 'success');
    await authLoadProfileAndEnter();
  } catch(e){
    authMsg('No se pudo actualizar la contraseña: ' + (e.message||e), 'error');
    btn.disabled = false; btn.textContent = 'Guardar y entrar';
  }
}

async function authResendConfirmation(){
  if(!authConfigured() || !sb){ authMsg('Supabase aún no está configurado o no se pudo conectar. Revisa tu conexión e intenta de nuevo.', 'error'); return; }
  let correo = document.getElementById('login-email').value.trim();
  if(!correo) correo = (prompt('¿A qué correo reenviamos la confirmación?','') || '').trim();
  if(!correo){ authMsg('Ingresa tu correo electrónico primero.'); return; }
  try {
    const { error } = await conTiempoLimite(sb.auth.resend({
      type: 'signup', email: correo,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    }));
    if(error) throw error;
    authMsg('Correo de confirmación reenviado. Si sigue sin llegar en unos minutos, revisa la carpeta de spam.', 'success');
  } catch(e){
    authMsg('No se pudo reenviar el correo: ' + (e.message||e));
  }
}

async function authLogout(){
  if(guestMode){ location.reload(); return; }
  if(!confirm('¿Cerrar tu sesión? Tu progreso ya está guardado, puedes volver a entrar cuando quieras.')) return;
  if(sb){ try { await sb.auth.signOut(); } catch(e){} }
  currentUser = null;
  location.reload();
}

let guestMode = false;

// Entra directo al simulador sin pasar por Supabase — solo para probar la interfaz.
// El progreso se sigue guardando en localStorage como siempre, igual que antes de
// añadir el inicio de sesión; simplemente no queda vinculado a ninguna cuenta real.
function authGuestEnter(role){
  guestMode = true;
  currentUser = {
    auth_id: null,
    nombre: role==='docente' ? 'Docente (invitado)' : 'Estudiante (invitado)',
    correo: '',
    rol: role,
    sesion_id: null,
    sesion_nombre: '',
  };
  document.getElementById('auth-gate').classList.add('hidden');
  const chip = document.getElementById('user-chip');
  chip.style.display = 'flex';
  document.getElementById('user-name-label').textContent = currentUser.nombre;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = 'invitado';
  badge.className = 'role-badge guest';
  const navProfesor = document.getElementById('nav-profesor');
  if(navProfesor) navProfesor.style.display = (role==='estudiante') ? 'none' : '';
  const navSoporte = document.getElementById('nav-soporte');
  if(navSoporte) navSoporte.style.display = (role==='estudiante') ? 'none' : '';
  const seccionGestionG = document.getElementById('wl-nav-section-gestion');
  if(seccionGestionG) seccionGestionG.style.display = (role==='estudiante') ? 'none' : '';
  if(typeof initApp === 'function') initApp();
  renderInicioPage();
  aplicarEnlaceDirectoCapitalLab();
  setTimeout(()=>{ if(typeof notify==='function') notify('Modo de prueba: el progreso no se sincroniza con ninguna cuenta.', 'success'); }, 900);
}

// Trae el perfil (nombre/rol/sesión) desde la tabla `usuarios` y entra a la app.
async function authLoadProfileAndEnter(){
  const { data: { user } } = await sb.auth.getUser();
  if(!user){ authMsg('No se encontró la sesión. Intenta iniciar sesión de nuevo.'); return; }

  let { data: perfil, error } = await sb.from('usuarios').select('*, sesiones_clase(nombre,codigo)').eq('auth_id', user.id).maybeSingle();

  // Primera vez que esta cuenta inicia sesión con éxito: todavía no existe su
  // fila en `usuarios`. Ahora sí hay una sesión de autenticación real (auth.uid()
  // ya resuelve), así que es el momento correcto para crear la sesión de clase
  // (si es docente) o unirse a una (si es estudiante), sin chocar con RLS.
  if(!perfil){
    const meta = user.user_metadata || {};
    if(!meta.pending_rol){
      // Cuenta creada manualmente desde el panel de Supabase (sin pasar por el
      // formulario de registro), por eso no trae los datos pendientes. En vez
      // de dejarla en un callejón sin salida, se le pide completar su perfil aquí.
      mostrarFormularioCompletarPerfil(user);
      return;
    }
    try {
      perfil = await completarRegistroPendiente(user, meta);
    } catch(e){
      authMsg('No se pudo completar tu registro: ' + (e.message||e));
      return;
    }
  }

  currentUser = {
    auth_id: user.id,
    usuario_id: perfil.id,
    nombre: perfil.nombre,
    correo: perfil.correo,
    rol: perfil.rol,
    sesion_id: perfil.sesion_id,
    sesion_nombre: perfil.sesiones_clase ? perfil.sesiones_clase.nombre : '',
    sesion_codigo: perfil.sesiones_clase ? perfil.sesiones_clase.codigo : '',
  };
  document.getElementById('auth-gate').classList.add('hidden');
  const chip = document.getElementById('user-chip');
  chip.style.display = 'flex';
  document.getElementById('user-name-label').textContent = currentUser.nombre;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = currentUser.rol;
  badge.className = 'role-badge ' + currentUser.rol;
  // El modo profesor solo es visible para docentes y superadministradores
  const navProfesor = document.getElementById('nav-profesor');
  if(navProfesor) navProfesor.style.display = (currentUser.rol==='estudiante') ? 'none' : '';
  const navSoporte = document.getElementById('nav-soporte');
  if(navSoporte) navSoporte.style.display = (currentUser.rol==='estudiante') ? 'none' : '';
  const navAdmin = document.getElementById('nav-admin');
  if(navAdmin) navAdmin.style.display = (currentUser.rol==='superadmin') ? '' : 'none';
  const seccionGestion = document.getElementById('wl-nav-section-gestion');
  if(seccionGestion) seccionGestion.style.display = (currentUser.rol==='estudiante') ? 'none' : '';
  const capHint = document.querySelector('.cap-edit-hint');
  if(capHint) capHint.style.display = (currentUser.rol==='estudiante') ? 'none' : '';
  if(typeof initApp === 'function') initApp();
  actualizarBadgeNotificaciones();
  renderInicioPage();
  aplicarEnlaceDirectoCapitalLab();

  if(perfil._codigoRecienGenerado){
    setTimeout(()=>mostrarCodigoSesionPostLogin(perfil._codigoRecienGenerado), 700);
  } else if(currentUser.sesion_nombre && typeof notify==='function'){
    setTimeout(()=>notify(`Sesión: ${currentUser.sesion_nombre} · Código: ${currentUser.sesion_codigo}`, 'success'), 700);
  }
}

// Crea la fila en `sesiones_clase` (docente) o resuelve el código (estudiante),
// y luego crea la fila en `usuarios`. Se llama solo una vez, en el primer login,
// cuando ya existe una sesión de autenticación real.
async function completarRegistroPendiente(user, meta){
  const rol = meta.pending_rol;
  const nombre = meta.pending_nombre || user.email;
  let sesionId = null;
  let codigoGenerado = null;

  if(rol==='docente'){
    for(let intento=0; intento<4; intento++){
      codigoGenerado = generarCodigoSesion();
      const { data: sesionRow, error: sesionError } = await sb.from('sesiones_clase')
        .insert({ nombre: meta.pending_sesion_nombre, codigo: codigoGenerado, docente_id: user.id, capital_inicial: 50000, mercados_activos: 5, activa: true })
        .select('id').single();
      if(!sesionError){ sesionId = sesionRow.id; break; }
      if(sesionError.code !== '23505') throw sesionError; // 23505 = código duplicado, reintentar
      if(intento===3) throw sesionError;
    }
  } else if(rol==='estudiante'){
    const { data: sesiones, error: buscarError } = await sb.rpc('buscar_sesion_por_codigo', { p_codigo: meta.pending_sesion_codigo });
    if(buscarError) throw buscarError;
    if(!sesiones || sesiones.length===0) throw new Error('El código de sesión ya no es válido. Pide uno nuevo a tu docente.');
    sesionId = sesiones[0].id;
  }

  const { data: nuevoPerfil, error: userError } = await sb.from('usuarios')
    .insert({ auth_id: user.id, nombre, correo: user.email, rol, sesion_id: sesionId })
    .select('*, sesiones_clase(nombre,codigo)').single();
  if(userError) throw userError;

  if(rol==='estudiante' && sesionId){
    // Registra la inscripción (para que la sesión aparezca luego en "Mis sesiones").
    // No es crítico si falla — la sesión activa ya quedó fijada en usuarios.sesion_id.
    await sb.from('inscripciones').insert({ usuario_id: nuevoPerfil.id, sesion_id: sesionId }).then(()=>{}, ()=>{});
  }

  if(codigoGenerado) nuevoPerfil._codigoRecienGenerado = codigoGenerado;
  return nuevoPerfil;
}

// Modal breve para mostrarle el código de sesión al docente justo después de
// su primer inicio de sesión (momento en el que se creó la sesión de clase).
function mostrarCodigoSesionPostLogin(codigo){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(4,7,12,.7);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div class="auth-box" style="max-width:380px;">
      <div class="auth-code-result" style="display:block;">
        <div class="auth-code-label">Tu sesión de clase ya está lista — código para tus estudiantes</div>
        <div class="auth-code-value">${codigo}</div>
        <div class="auth-hint">Compárteles este código para que se registren en tu sesión.</div>
        <button class="auth-submit" style="margin-top:12px;" id="btn-cerrar-codigo-modal">Entendido</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-cerrar-codigo-modal').onclick = () => overlay.remove();
}

// Le recuerda al usuario (sobre todo al estudiante) en qué sesión de clase está
// y con qué código entró, para que no se pierda si maneja varias clases o cuentas.
// ══════════════════════════════════════════════════
// NOTIFICACIONES INTERNAS Y ANUNCIOS — todo dentro de la app, sin correo
// ══════════════════════════════════════════════════
// El "visto" se guarda en este navegador (por sesión de clase), no en la
// nube: es solo para saber si mostrar el puntito, no hace falta más.
function claveNotifVistas(){
  return 'capitallab_notif_visto_' + (currentUser?.sesion_id || 'sin-sesion');
}
function marcarNotificacionesVistas(){
  localStorage.setItem(claveNotifVistas(), new Date().toISOString());
  const dot = document.getElementById('notif-dot');
  if(dot) dot.style.display = 'none';
}

async function actualizarBadgeNotificaciones(){
  if(!sb || !currentUser || guestMode || !currentUser.sesion_id) return;
  try {
    const ultimaVista = localStorage.getItem(claveNotifVistas()) || '1970-01-01T00:00:00.000Z';
    const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
    const consultas = [ sb.from('anuncios').select('id,creado_en').eq('sesion_id', currentUser.sesion_id).gt('creado_en', ultimaVista) ];
    if(!esDocente){
      consultas.push(sb.from('calificaciones').select('id,creado_en').eq('usuario_id', currentUser.usuario_id).gt('creado_en', ultimaVista));
      consultas.push(sb.from('alertas_precio').select('id').eq('usuario_id', currentUser.usuario_id).not('disparada_en','is',null).gt('disparada_en', ultimaVista));
    }
    const resultados = await Promise.all(consultas);
    const hayNuevo = resultados.some(r => r.data && r.data.length>0);
    const dot = document.getElementById('notif-dot');
    if(dot) dot.style.display = hayNuevo ? 'block' : 'none';
  } catch(e){ /* silencioso: el badge es solo un aviso visual, no crítico */ }
}

async function mostrarNotificaciones(){
  if(!currentUser) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(4,7,12,.7);display:flex;align-items:center;justify-content:center;padding:20px;';

  if(guestMode || !currentUser.sesion_id){
    overlay.innerHTML = `<div class="auth-box" style="max-width:380px;"><div class="auth-code-result" style="display:block;"><div class="auth-code-label">Sin sesión</div><div class="auth-hint">${guestMode?'El modo de prueba no tiene anuncios ni notificaciones reales.':'Todavía no perteneces a ninguna sesión de clase.'}</div><button class="auth-submit" style="margin-top:12px;" id="btn-cerrar-notif">Cerrar</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-cerrar-notif').onclick = () => overlay.remove();
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    return;
  }

  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  overlay.innerHTML = `
    <div class="auth-box" style="max-width:440px;max-height:85vh;overflow-y:auto;">
      <div class="auth-brand" style="font-size:18px;">Notificaciones</div>
      <div class="auth-sub">${currentUser.sesion_nombre || ''}</div>
      ${esDocente ? `
        <div class="auth-field">
          <label>Publicar un anuncio nuevo</label>
          <input type="text" id="an-titulo" placeholder="Título del anuncio" style="margin-bottom:8px;">
          <textarea id="an-cuerpo" placeholder="Mensaje (opcional)" style="width:100%;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);padding:9px 11px;color:var(--t1);font-family:var(--font-body);font-size:13px;min-height:60px;"></textarea>
          <button class="btn" style="margin-top:8px;width:100%;" id="an-btn-publicar"><i class="ti ti-speakerphone"></i> Publicar anuncio</button>
        </div>
        <div class="auth-msg" id="an-msg"></div>
      ` : ''}
      <div id="notif-lista" style="margin-top:10px;"><div class="auth-hint">Cargando…</div></div>
      <button class="btn btn-ghost" style="width:100%;margin-top:12px;" id="btn-cerrar-notif">Cerrar</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#btn-cerrar-notif').onclick = () => overlay.remove();
  marcarNotificacionesVistas();

  async function cargarFeed(){
    const cont = overlay.querySelector('#notif-lista');
    try {
      // Antes estas consultas se pedían una tras otra (await, await, await),
      // así que la espera total era la suma de las tres. Pidiéndolas al
      // mismo tiempo, la espera pasa a ser la de la más lenta nada más —
      // esto era lo que hacía que el botón de notificaciones se sintiera
      // extremadamente lento para un estudiante.
      const [{ data: anuncios, error: e1 }, calRes, alertasRes] = await conTiempoLimite(Promise.all([
        sb.from('anuncios').select('*').eq('sesion_id', currentUser.sesion_id).order('creado_en',{ascending:false}).limit(15),
        esDocente ? Promise.resolve({data:[]}) : sb.from('calificaciones').select('*').eq('usuario_id', currentUser.usuario_id).order('creado_en',{ascending:false}).limit(15),
        esDocente ? Promise.resolve({data:[]}) : sb.from('alertas_precio').select('*').eq('usuario_id', currentUser.usuario_id).not('disparada_en','is',null).order('disparada_en',{ascending:false}).limit(10),
      ]));
      if(e1) throw e1;
      const cals = calRes.data, alertas = alertasRes.data;
      let items = (anuncios||[]).map(a => ({ tipo:'anuncio', fecha:a.creado_en, titulo:a.titulo, cuerpo:a.cuerpo, id:a.id, fijado:!!a.fijado }));
      if(!esDocente){
        items = items.concat((cals||[]).map(c => ({ tipo:'calificacion', fecha:c.creado_en, titulo:`Nueva calificación: ${c.titulo}`, cuerpo:c.nota_general!=null?`Nota: ${c.nota_general}/100`:null })));
        items = items.concat((alertas||[]).map(a => ({ tipo:'alerta', fecha:a.disparada_en, titulo:`${a.activo_nombre} ${a.direccion==='arriba'?'subió hasta':'bajó hasta'} $${fmt(a.precio_objetivo)}`, cuerpo:null })));
      }
      items.sort((a,b)=> {
        const fa = a.fijado?1:0, fb = b.fijado?1:0;
        if(fa!==fb) return fb-fa; // los fijados siempre primero
        return new Date(b.fecha) - new Date(a.fecha);
      });
      if(!items.length){ cont.innerHTML = '<div class="auth-hint">Todavía no hay anuncios ni novedades en esta sesión.</div>'; return; }
      cont.innerHTML = items.slice(0,20).map(it => `
        <div style="padding:10px 0;border-bottom:1px solid var(--c3);${it.fijado?'background:rgba(212,175,55,.06);border-left:2px solid var(--gold);padding-left:8px;':''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="font-weight:600;font-size:13px;">${it.fijado?'<i class="ti ti-pin" style="font-size:11px;color:var(--gold);margin-right:3px;"></i>':''}<i class="ti ti-${it.tipo==='anuncio'?'speakerphone':it.tipo==='alerta'?'bell-ringing':'certificate'}" style="font-size:12px;color:var(--accent2);margin-right:5px;"></i>${it.titulo}</div>
            ${esDocente && it.tipo==='anuncio' ? `<span style="display:flex;gap:4px;flex-shrink:0;">
              <button class="btn btn-sm" style="padding:2px 7px;" title="${it.fijado?'Desfijar':'Fijar arriba'}" onclick="alternarFijarAnuncio('${it.id}',${!it.fijado})"><i class="ti ti-${it.fijado?'pin-filled':'pin'}" style="font-size:11px;"></i></button>
              <button class="btn btn-sm" style="padding:2px 7px;" title="Borrar anuncio" onclick="borrarAnuncio('${it.id}')"><i class="ti ti-trash" style="font-size:11px;"></i></button>
            </span>` : ''}
          </div>
          ${it.cuerpo ? `<div style="font-size:12.5px;color:var(--t2);margin-top:3px;">${it.cuerpo}</div>` : ''}
          <div style="font-size:10.5px;color:var(--t3);margin-top:4px;">${tiempoRelativo(it.fecha)}</div>
        </div>`).join('');
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
    }
  }
  window._recargarFeedNotificaciones = cargarFeed;
  cargarFeed();

  if(esDocente){
    overlay.querySelector('#an-btn-publicar').onclick = async () => {
      const titulo = overlay.querySelector('#an-titulo').value.trim();
      const cuerpo = overlay.querySelector('#an-cuerpo').value.trim() || null;
      const msg = overlay.querySelector('#an-msg');
      if(!titulo){ msg.className='auth-msg show error'; msg.textContent='Ponle un título al anuncio.'; return; }
      const btn = overlay.querySelector('#an-btn-publicar');
      btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Publicando…';
      try {
        const { error } = await conTiempoLimite(sb.from('anuncios').insert({
          sesion_id: currentUser.sesion_id, docente_id: currentUser.auth_id, titulo, cuerpo,
        }));
        if(error) throw error;
        overlay.querySelector('#an-titulo').value=''; overlay.querySelector('#an-cuerpo').value='';
        notify('Anuncio publicado.', 'success');
        cargarFeed();
      } catch(e){
        msg.className='auth-msg show error'; msg.textContent = 'No se pudo publicar: ' + (e.message||e);
      } finally {
        btn.disabled = false; btn.innerHTML = '<i class="ti ti-speakerphone"></i> Publicar anuncio';
      }
    };
  }
}

async function borrarAnuncio(id){
  if(!confirm('¿Borrar este anuncio?')) return;
  try {
    const { error } = await sb.from('anuncios').delete().eq('id', id);
    if(error) throw error;
    notify('Anuncio borrado.', 'success');
    if(window._recargarFeedNotificaciones) window._recargarFeedNotificaciones();
  } catch(e){
    notify('No se pudo borrar: ' + (e.message||e), 'error');
  }
}

async function alternarFijarAnuncio(id, fijar){
  try {
    const { error } = await sb.from('anuncios').update({ fijado: fijar }).eq('id', id);
    if(error) throw error;
    if(window._recargarFeedNotificaciones) window._recargarFeedNotificaciones();
  } catch(e){
    notify('No se pudo actualizar: ' + (e.message||e), 'error');
  }
}

// Antes era una ventana emergente disparada desde la topbar; ahora vive
// como una sección normal dentro del Panel de Inicio. En un celular, la
// topbar es un espacio demasiado angosto para cualquier texto largo
// ("Mi cuenta", nombres de sesión, etc.) — sacarlo de ahí evita el
// problema de raíz en vez de perseguir píxeles cada vez que se agrega algo.
// ══════════════════════════════════════════════════
// NOTIFICACIONES NATIVAS DEL SISTEMA — para avisos importantes (una
// alerta de precio se disparó, ganaste una subasta) mientras no tienes
// la pestaña abierta. En iPhone, Safari solo lo permite si la app está
// instalada en la pantalla de inicio (no en una pestaña normal del
// navegador) — se detecta eso y se avisa con claridad en vez de mostrar
// un botón que no va a funcionar.
// ══════════════════════════════════════════════════
function soporteNotificacionesNativas(){
  if(!('Notification' in window)) return false;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const esStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if(esIOS && !esStandalone) return false; // Safari normal en iOS no las soporta
  return true;
}

function enviarNotificacionNativa(titulo, cuerpo){
  if(!soporteNotificacionesNativas() || Notification.permission !== 'granted') return;
  if(document.visibilityState === 'visible') return; // ya la está viendo, no hace falta duplicar el aviso
  try { new Notification(titulo, { body: cuerpo, icon: undefined }); } catch(e){ /* silencioso */ }
}

async function activarNotificacionesNativas(){
  if(!soporteNotificacionesNativas()){
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    notify(esIOS
      ? 'En iPhone, Safari solo permite notificaciones si agregas CapitalLab a tu pantalla de inicio (compartir → "Agregar a pantalla de inicio").'
      : 'Tu navegador no soporta notificaciones del sistema.', 'error');
    return;
  }
  const permiso = await Notification.requestPermission();
  actualizarBotonNotificacionesNativas(permiso);
  if(permiso === 'granted') notify('Notificaciones activadas — te avisaremos aunque no tengas la app abierta.', 'success');
  else if(permiso === 'denied') notify('Bloqueaste las notificaciones. Puedes activarlas desde los ajustes de tu navegador.', 'error');
}

// Recibe el permiso ya resuelto como parámetro cuando se acaba de pedir,
// para no arriesgarse a leer `Notification.permission` en un momento
// distinto y mostrar un estado que no coincida con el mensaje que se
// acaba de dar.
function actualizarBotonNotificacionesNativas(permisoConocido){
  const btn = document.getElementById('btn-notif-nativas');
  if(!btn) return;
  if(!soporteNotificacionesNativas()){
    btn.innerHTML = '<i class="ti ti-bell-off"></i> No disponibles en este navegador';
    btn.disabled = true;
    return;
  }
  const permiso = permisoConocido || Notification.permission;
  const activas = permiso === 'granted';
  btn.disabled = activas;
  btn.innerHTML = activas ? '<i class="ti ti-bell-check"></i> Notificaciones activadas' : '<i class="ti ti-bell"></i> Activar notificaciones del sistema';
}

function copiarCodigoSesion(codigo){
  navigator.clipboard?.writeText(codigo).then(
    () => notify(`Código ${codigo} copiado.`, 'success'),
    () => notify('No se pudo copiar. Cópialo a mano: ' + codigo, 'error')
  );
}

async function renderMiCuenta(cont){
  if(!currentUser || !cont) return;
  const esDocente = currentUser.rol === 'docente' || currentUser.rol === 'superadmin';
  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title"><i class="ti ti-user-circle" style="color:var(--accent2);"></i> Mi cuenta</div>
      <div class="auth-field" style="margin-bottom:14px;">
        <label>Nombre</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="ms-mi-nombre" value="${currentUser.nombre.replace(/"/g,'&quot;')}" style="flex:1;">
          <button class="btn btn-sm" id="ms-btn-guardar-nombre"><i class="ti ti-check"></i></button>
        </div>
      </div>
      <div class="auth-field" style="margin-bottom:14px;">
        <label>Avisos del sistema</label>
        <button class="btn btn-sm" id="btn-notif-nativas" onclick="activarNotificacionesNativas()" style="width:100%;justify-content:center;max-width:260px;">
          <i class="ti ti-bell"></i> Activar notificaciones del sistema
        </button>
      </div>
      <div class="auth-field" style="margin-bottom:0;">
        <button class="btn btn-sm" onclick="authLogout()" style="width:100%;justify-content:center;max-width:260px;color:var(--red);">
          <i class="ti ti-logout"></i> Cerrar sesión
        </button>
      </div>
      <div class="auth-msg" id="ms-msg"></div>
    </div>
    <div class="card">
      <div class="card-title"><i class="ti ti-school" style="color:var(--accent2);"></i> Mis sesiones de clase <span class="nav-badge" id="ms-contador" style="margin-left:6px;">—</span></div>
      <div class="card-sub" style="margin-bottom:12px;">${esDocente ? 'Las clases que administras. La marcada como activa es la que ves en Modo Profesor.' : 'Las clases a las que perteneces. La marcada como activa es en la que estás operando ahora.'}</div>
      ${esDocente ? `<button class="btn btn-sm" onclick="abrirCompararSesiones()" style="margin-bottom:12px;"><i class="ti ti-chart-dots"></i> Comparar mis sesiones</button>` : ''}
      <div id="ms-lista" style="margin-bottom:16px;"><div class="auth-hint">Cargando…</div></div>
      ${esDocente ? `
        <div class="auth-field">
          <label>Crear una sesión de clase nueva</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="ms-nueva-sesion" placeholder='Ej. "Mercados Financieros — 2027-1"' style="flex:1;">
            <button class="btn" id="ms-btn-crear"><i class="ti ti-plus"></i></button>
          </div>
        </div>
      ` : `
        <div class="auth-field">
          <label>Unirme a otra sesión con un código</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="ms-nuevo-codigo" placeholder="Ej. MF2026B" style="flex:1;text-transform:uppercase;">
            <button class="btn" id="ms-btn-unirse"><i class="ti ti-plus"></i></button>
          </div>
        </div>
      `}
    </div>`;
  actualizarBotonNotificacionesNativas();
  cont.querySelector('#ms-btn-guardar-nombre').onclick = async () => {
    const nuevoNombre = cont.querySelector('#ms-mi-nombre').value.trim();
    const msg = cont.querySelector('#ms-msg');
    if(!nuevoNombre){ msg.className='auth-msg show error'; msg.textContent='El nombre no puede quedar vacío.'; return; }
    try {
      const { error } = await sb.from('usuarios').update({ nombre: nuevoNombre }).eq('id', currentUser.usuario_id);
      if(error) throw error;
      currentUser.nombre = nuevoNombre;
      document.getElementById('user-name-label').textContent = nuevoNombre;
      notify('Nombre actualizado.', 'success');
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo actualizar: ' + (e.message||e);
    }
  };

  async function cargarListaSesiones(){
    const listaCont = cont.querySelector('#ms-lista');
    try {
      let filas = [];
      if(esDocente){
        const { data, error } = await sb.from('sesiones_clase').select('id,nombre,codigo,activa').eq('docente_id', currentUser.auth_id).order('creado_en', {ascending:false});
        if(error) throw error;
        filas = data || [];
      } else {
        const { data, error } = await sb.from('inscripciones').select('sesiones_clase(id,nombre,codigo,activa)').eq('usuario_id', currentUser.usuario_id);
        if(error) throw error;
        filas = (data||[]).map(r=>r.sesiones_clase).filter(Boolean);
      }
      const contadorEl = cont.querySelector('#ms-contador');
      if(contadorEl) contadorEl.textContent = filas.length;
      if(!filas.length){ listaCont.innerHTML = '<div class="auth-hint">Todavía no perteneces a ninguna sesión.</div>'; return; }
      listaCont.innerHTML = filas.map(s => `
        <div class="ms-fila-sesion" style="border:1px solid var(--c4);border-radius:var(--r);margin-bottom:8px;padding:10px 12px;${s.id===currentUser.sesion_id?'border-color:var(--accent2);background:rgba(0,196,255,.06);':''}${s.activa===false?'opacity:.55;':''}">
          <div class="ms-fila-sesion-info" style="min-width:0;margin-bottom:8px;">
            <div style="font-weight:600;font-size:13px;">${s.nombre} ${s.activa===false?'<span class="nav-badge" style="margin-left:4px;">Archivada</span>':''}</div>
            <div style="font-size:11px;color:var(--t3);font-family:var(--font-mono);display:flex;align-items:center;gap:5px;">${s.codigo} <i class="ti ti-copy" style="font-size:11px;cursor:pointer;" title="Copiar código" onclick="copiarCodigoSesion('${s.codigo}')"></i></div>
          </div>
          <div class="ms-fila-sesion-botones" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${s.id===currentUser.sesion_id
              ? '<span class="nav-badge" style="background:var(--accent2);color:#031320;">Activa</span>'
              : `<button class="btn btn-sm" onclick="cambiarSesionActiva('${s.id}','${s.nombre.replace(/'/g,"\\'")}','${s.codigo}')">Cambiar</button>`}
            ${esDocente ? `<button class="btn btn-sm" title="${s.activa===false?'Reactivar sesión':'Archivar sesión'}" onclick="alternarArchivadoSesion('${s.id}',${s.activa===false})"><i class="ti ti-${s.activa===false?'archive-off':'archive'}"></i></button>` : ''}
            ${esDocente ? `<button class="btn btn-sm" title="Eliminar sesión" style="color:var(--red);" onclick="eliminarSesionClase('${s.id}','${s.nombre.replace(/'/g,"\\'")}')"><i class="ti ti-trash"></i></button>` : ''}
          </div>
        </div>`).join('');
    } catch(e){
      listaCont.innerHTML = '<div class="auth-hint">No se pudo cargar la lista: '+(e.message||e)+'</div>';
    }
  }
  window._recargarListaSesionesActual = cargarListaSesiones;
  cargarListaSesiones();

  if(esDocente){
    cont.querySelector('#ms-btn-crear').onclick = async () => {
      const nombre = cont.querySelector('#ms-nueva-sesion').value.trim();
      const msg = cont.querySelector('#ms-msg');
      if(!nombre){ msg.className='auth-msg show error'; msg.textContent='Ponle un nombre a la sesión.'; return; }
      msg.className='auth-msg';
      try {
        let codigoGenerado, sesionId;
        for(let intento=0; intento<4; intento++){
          codigoGenerado = generarCodigoSesion();
          const { data, error } = await sb.from('sesiones_clase')
            .insert({ nombre, codigo: codigoGenerado, docente_id: currentUser.auth_id, capital_inicial: 50000, mercados_activos: 5, activa: true })
            .select('id').single();
          if(!error){ sesionId = data.id; break; }
          if(error.code !== '23505') throw error;
          if(intento===3) throw error;
        }
        cont.querySelector('#ms-nueva-sesion').value='';
        await cargarListaSesiones();
        msg.className='auth-msg show success'; msg.textContent=`Sesión creada. Código: ${codigoGenerado}`;
        cambiarSesionActiva(sesionId, nombre, codigoGenerado);
      } catch(e){
        msg.className='auth-msg show error'; msg.textContent='No se pudo crear: '+(e.message||e);
      }
    };
  } else {
    cont.querySelector('#ms-btn-unirse').onclick = async () => {
      const codigo = cont.querySelector('#ms-nuevo-codigo').value.trim();
      const msg = cont.querySelector('#ms-msg');
      if(!codigo){ msg.className='auth-msg show error'; msg.textContent='Ingresa un código de sesión.'; return; }
      msg.className='auth-msg';
      try {
        const { data: sesiones, error: buscarError } = await sb.rpc('buscar_sesion_por_codigo', { p_codigo: codigo });
        if(buscarError) throw buscarError;
        if(!sesiones || sesiones.length===0) throw new Error('Código inválido o sesión inactiva.');
        const s = sesiones[0];
        const { error: insError } = await sb.from('inscripciones').insert({ usuario_id: currentUser.usuario_id, sesion_id: s.id });
        if(insError && insError.code !== '23505') throw insError; // 23505 = ya estaba inscrito, no pasa nada
        cont.querySelector('#ms-nuevo-codigo').value='';
        await cargarListaSesiones();
        msg.className='auth-msg show success'; msg.textContent=`Te uniste a "${s.nombre}".`;
        cambiarSesionActiva(s.id, s.nombre, codigo.toUpperCase());
      } catch(e){
        msg.className='auth-msg show error'; msg.textContent='No se pudo unir: '+(e.message||e);
      }
    };
  }
}

// Compara todas las sesiones de clase de un docente lado a lado: cantidad
// de estudiantes, retorno promedio, cuestionarios completados y
// calificaciones dadas en cada una. Útil ahora que un docente puede dar
// varias materias distintas a la vez.
async function abrirCompararSesiones(){
  if(!currentUser) return;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:640px;">
    <h3>Comparar mis sesiones</h3>
    <div class="sub">Panorama de todas tus clases, una junto a la otra.</div>
    <div id="cs-lista" style="margin-top:12px;"><div class="auth-hint">Cargando…</div></div>
    <button class="btn btn-ghost" id="cs-cerrar" style="width:100%;margin-top:14px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cs-cerrar').onclick = () => overlay.remove();

  const cont = overlay.querySelector('#cs-lista');
  try {
    const { data: sesiones, error } = await sb.from('sesiones_clase').select('id,nombre,codigo,activa').eq('docente_id', currentUser.auth_id).order('creado_en',{ascending:false});
    if(error) throw error;
    if(!sesiones || !sesiones.length){
      cont.innerHTML = '<div class="auth-hint">Todavía no tienes ninguna sesión de clase.</div>';
      return;
    }

    // Se piden los datos de todas las sesiones en paralelo, no una por una.
    const datosPorSesion = await Promise.all(sesiones.map(async s => {
      const [{data: estudiantes}, {data: ports}, {data: intentos}, {data: cals}] = await Promise.all([
        sb.from('usuarios').select('id').eq('sesion_id', s.id).eq('rol','estudiante'),
        sb.from('portafolios').select('retorno_pct').eq('sesion_id', s.id),
        sb.from('intentos_cuestionario').select('id').eq('sesion_id', s.id),
        sb.from('calificaciones').select('id').eq('sesion_id', s.id),
      ]);
      const retornos = (ports||[]).map(p=>p.retorno_pct).filter(r=>r!=null);
      const promedio = retornos.length ? (retornos.reduce((a,b)=>a+Number(b),0)/retornos.length) : null;
      return {
        sesion: s,
        estudiantes: (estudiantes||[]).length,
        promedio,
        cuestionariosCompletados: (intentos||[]).length,
        calificacionesDadas: (cals||[]).length,
      };
    }));

    cont.innerHTML = `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr style="text-align:left;color:var(--t3);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--c4);">
          <th style="padding:8px 10px;">Sesión</th>
          <th style="padding:8px 10px;">Estudiantes</th>
          <th style="padding:8px 10px;">Retorno promedio</th>
          <th style="padding:8px 10px;">Cuestionarios resueltos</th>
          <th style="padding:8px 10px;">Calificaciones dadas</th>
        </tr></thead>
        <tbody>
          ${datosPorSesion.map(d => `<tr style="border-bottom:1px solid var(--c3);${d.sesion.id===currentUser.sesion_id?'background:rgba(0,196,255,.06);':''}">
            <td style="padding:8px 10px;font-weight:600;">${d.sesion.nombre} ${d.sesion.activa===false?'<span class="nav-badge">Archivada</span>':''}</td>
            <td style="padding:8px 10px;">${d.estudiantes}</td>
            <td style="padding:8px 10px;color:${d.promedio===null?'var(--t3)':(d.promedio>=0?'var(--green)':'var(--red)')};font-weight:600;">${d.promedio!==null?(d.promedio>=0?'+':'')+d.promedio.toFixed(1)+'%':'—'}</td>
            <td style="padding:8px 10px;">${d.cuestionariosCompletados}</td>
            <td style="padding:8px 10px;">${d.calificacionesDadas}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudo cargar la comparación: '+(e.message||e)+'</div>';
  }
}

// Cambia la sesión de clase activa: guarda el cambio en la nube, reinicia el
// estado local de trading (cada sesión guarda su propio progreso por separado,
// ver storageKey()) y vuelve a cargar lo que corresponda a la nueva sesión.
// Archiva o reactiva una sesión de clase propia. Archivar solo bloquea que
// estudiantes NUEVOS se unan con el código (buscar_sesion_por_codigo exige
// activa=true); los que ya pertenecen a la sesión conservan su acceso.
async function alternarArchivadoSesion(sesionId, reactivar){
  if(!sb || !currentUser) return;
  const confirmMsg = reactivar
    ? '¿Reactivar esta sesión? Los estudiantes podrán volver a unirse con el código.'
    : '¿Archivar esta sesión? Nadie nuevo podrá unirse con el código, pero los estudiantes que ya están adentro conservan su acceso.';
  if(!confirm(confirmMsg)) return;
  try {
    const { error } = await sb.from('sesiones_clase').update({ activa: !!reactivar }).eq('id', sesionId);
    if(error) throw error;
    notify(reactivar ? 'Sesión reactivada.' : 'Sesión archivada.', 'success');
    if(window._recargarListaSesionesActual) window._recargarListaSesionesActual();
  } catch(e){
    notify('No se pudo actualizar la sesión: ' + (e.message||e), 'error');
  }
}

// Elimina una sesión de clase por completo: se lleva consigo a todos los
// estudiantes inscritos, sus carteras, calificaciones, anuncios y asistencia
// de esa sesión. Es irreversible, por eso pide confirmación doble: primero
// una advertencia clara, y después escribir el nombre exacto de la sesión.
async function eliminarSesionClase(sesionId, sesionNombre){
  if(!sb || !currentUser) return;
  const primeraConfirmacion = confirm(
    `¿Eliminar por completo "${sesionNombre}"?\n\nEsto borra para siempre a todos los estudiantes inscritos de esta sesión, sus carteras, calificaciones, anuncios y asistencia. No se puede deshacer.`
  );
  if(!primeraConfirmacion) return;
  const escrito = prompt(`Para confirmar, escribe exactamente el nombre de la sesión:\n\n${sesionNombre}`);
  if(escrito !== sesionNombre){
    if(escrito !== null) notify('El nombre no coincide. No se eliminó la sesión.', 'error');
    return;
  }
  try {
    if(sesionId === currentUser.sesion_id){
      currentUser.sesion_id = null; currentUser.sesion_nombre = ''; currentUser.sesion_codigo = '';
    }
    const { error } = await sb.from('sesiones_clase').delete().eq('id', sesionId);
    if(error) throw error;
    notify('Sesión eliminada.', 'success');
    if(window._recargarListaSesionesActual) window._recargarListaSesionesActual();
  } catch(e){
    notify('No se pudo eliminar la sesión: ' + (e.message||e), 'error');
  }
}

async function cambiarSesionActiva(sesionId, sesionNombre, sesionCodigo){
  if(!sb || !currentUser || sesionId === currentUser.sesion_id) return;
  try {
    await sb.from('usuarios').update({ sesion_id: sesionId }).eq('id', currentUser.usuario_id);
  } catch(e){
    notify('No se pudo cambiar de sesión: ' + (e.message||e), 'error');
    return;
  }
  currentUser.sesion_id = sesionId;
  currentUser.sesion_nombre = sesionNombre;
  currentUser.sesion_codigo = sesionCodigo;

  // Reinicia el estado de trading en memoria (cada sesión es independiente)
  // y carga lo que ya hubiera guardado antes en esta sesión, si aplica.
  capital = 50000; labCapital = 50000; portfolio = []; txHistory = [];
  labHistory = []; navHistory = []; pendingOrders = []; marketSessionLog = []; diarioTrading = []; metaPersonal = null;
  savedPortfolios = []; newsFeed = []; labPickedIds = [];
  labConfig = {capital:50000, horizon:6, target:8, started:false, startCapital:0};
  loadProgress();

  document.getElementById('user-role-badge').className = 'role-badge ' + currentUser.rol;
  renderAssetList(); renderCustom(); renderWatchlist(); renderPortfolioTabs();
  // Los gráficos de Cartera medían su contenedor en el mismo instante
  // de la inicialización de la sesión, antes de que el navegador
  // terminara de calcular el diseño final — quedándose con una
  // medida incorrecta para siempre, sin que ni el propio resize() de
  // Chart.js la corrigiera después. Se espera al siguiente repintado
  // real antes de crearlos.
  requestAnimationFrame(()=>requestAnimationFrame(renderPortfolio));
  renderLabHistory(); updateNavCapital();
  if(document.getElementById('page-profesor').classList.contains('active')){ cargarRosterProfesor(); iniciarRealtimeProfesor(); }
  notify(`Cambiaste a: ${sesionNombre}`, 'success');
  actualizarBadgeNotificaciones();
}

// Para cuentas creadas directamente desde el panel de Supabase (Authentication →
// Users → Add user), que no pasaron por el formulario de registro de la app y por
// lo tanto no traen nombre/rol/sesión guardados. Se les pide completar esos datos
// aquí, en su primer inicio de sesión, en vez de dejarlos sin poder entrar.
function mostrarFormularioCompletarPerfil(user){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(4,7,12,.7);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div class="auth-box" style="max-width:400px;">
      <div class="auth-brand" style="font-size:18px;">Completa tu perfil</div>
      <div class="auth-sub">Tu cuenta (${user.email}) todavía no tiene nombre ni rol asignado.</div>
      <div class="auth-msg" id="cp-msg"></div>
      <div class="auth-field">
        <label>Nombre completo</label>
        <input type="text" id="cp-nombre" placeholder="Nombre y apellido" value="${(user.user_metadata?.full_name || user.user_metadata?.name || '').replace(/"/g,'&quot;')}">
      </div>
      <div class="auth-field">
        <label>Rol</label>
        <div class="auth-role-row">
          <div class="auth-role-opt active" id="cp-role-estudiante">Estudiante</div>
          <div class="auth-role-opt" id="cp-role-docente">Docente</div>
        </div>
      </div>
      <div class="auth-field" id="cp-field-estudiante">
        <label>Código de sesión</label>
        <input type="text" id="cp-codigo" placeholder="Ej. MF2026B" style="text-transform:uppercase;">
      </div>
      <div class="auth-field hidden" id="cp-field-docente">
        <label>Nombre de la sesión de clase</label>
        <input type="text" id="cp-sesion-nombre" placeholder='Ej. "Mercados Financieros — 2026-2"'>
      </div>
      <button class="auth-submit" id="cp-btn">Continuar</button>
      <button class="btn btn-ghost" id="cp-cancelar" style="width:100%;margin-top:10px;">Cancelar y volver al inicio</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#cp-cancelar').onclick = async () => {
    // La persona ya tiene una sesión real de Google/Supabase abierta en este
    // punto, aunque todavía no tenga fila en `usuarios` — por eso cancelar
    // no basta con cerrar la ventana: hay que cerrar esa sesión también,
    // o si no, la próxima vez que entre va a caer otra vez aquí mismo.
    overlay.remove();
    try { await sb.auth.signOut(); } catch(e){}
    location.reload();
  };
  const cerrarConEscape = (e) => { if(e.key==='Escape'){ document.removeEventListener('keydown', cerrarConEscape); overlay.querySelector('#cp-cancelar').click(); } };
  document.addEventListener('keydown', cerrarConEscape);

  let cpRol = 'estudiante';
  overlay.querySelector('#cp-role-estudiante').onclick = () => {
    cpRol = 'estudiante';
    overlay.querySelector('#cp-role-estudiante').classList.add('active');
    overlay.querySelector('#cp-role-docente').classList.remove('active');
    overlay.querySelector('#cp-field-estudiante').classList.remove('hidden');
    overlay.querySelector('#cp-field-docente').classList.add('hidden');
  };
  overlay.querySelector('#cp-role-docente').onclick = () => {
    cpRol = 'docente';
    overlay.querySelector('#cp-role-docente').classList.add('active');
    overlay.querySelector('#cp-role-estudiante').classList.remove('active');
    overlay.querySelector('#cp-field-docente').classList.remove('hidden');
    overlay.querySelector('#cp-field-estudiante').classList.add('hidden');
  };

  overlay.querySelector('#cp-btn').onclick = async () => {
    const cpMsg = overlay.querySelector('#cp-msg');
    const nombre = overlay.querySelector('#cp-nombre').value.trim();
    const codigo = overlay.querySelector('#cp-codigo').value.trim();
    const sesionNombre = overlay.querySelector('#cp-sesion-nombre').value.trim();
    if(!nombre){ cpMsg.className='auth-msg show error'; cpMsg.textContent='Ingresa tu nombre.'; return; }
    if(cpRol==='estudiante' && !codigo){ cpMsg.className='auth-msg show error'; cpMsg.textContent='Ingresa el código de sesión.'; return; }
    if(cpRol==='docente' && !sesionNombre){ cpMsg.className='auth-msg show error'; cpMsg.textContent='Ingresa el nombre de la sesión a crear.'; return; }

    const btn = overlay.querySelector('#cp-btn');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Guardando…';
    try {
      const meta = {
        pending_rol: cpRol,
        pending_nombre: nombre,
        pending_sesion_codigo: cpRol==='estudiante' ? codigo : null,
        pending_sesion_nombre: cpRol==='docente' ? sesionNombre : null,
      };
      const perfil = await completarRegistroPendiente(user, meta);
      overlay.remove();
      await authLoadProfileAndEnter();
      if(perfil._codigoRecienGenerado){
        setTimeout(()=>mostrarCodigoSesionPostLogin(perfil._codigoRecienGenerado), 400);
      }
    } catch(e){
      cpMsg.className='auth-msg show error'; cpMsg.textContent = 'No se pudo guardar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Continuar';
    }
  };
}

// ══════════════════════════════════════════════════
// MODO PROFESOR — panel de estudiantes en la nube
// ══════════════════════════════════════════════════
let profCalificaciones = {}; // usuario_id -> fila de calificaciones
let profPortafolios = {}; // usuario_id -> fila de portafolios (valor, retorno, actividad)
let profRealtimeChannel = null;

function nivelCalificacion(nota){
  if(nota===null||nota===undefined) return 'sin';
  if(nota>=80) return 'alta';
  if(nota>=60) return 'media';
  return 'baja';
}

function formatearFechaHora(iso){
  try {
    const d=new Date(iso);
    return d.toLocaleDateString('es-PA',{day:'2-digit',month:'short'}) + ' · ' + d.toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'});
  } catch(e){ return '—'; }
}

// Tiempo relativo ("hace 2 min") para mensajes recientes del chat — más
// fácil de leer de un vistazo que una fecha y hora completas cuando
// alguien acaba de escribir. Para algo de hace más de un día, usa la
// fecha completa de siempre, donde sí hace falta el detalle.
function tiempoRelativo(iso){
  try {
    const ahora = Date.now();
    const fecha = new Date(iso).getTime();
    const segundos = Math.floor((ahora - fecha) / 1000);
    if(segundos < 0) return formatearFechaHora(iso); // reloj desincronizado, mejor mostrar la fecha exacta
    if(segundos < 60) return 'ahora mismo';
    const minutos = Math.floor(segundos / 60);
    if(minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if(horas < 24) return `hace ${horas} h`;
    return formatearFechaHora(iso);
  } catch(e){ return formatearFechaHora(iso); }
}

// ── Control de asistencia ──
async function abrirTomaAsistencia(){
  if(!sb || !currentUser || !currentUser.sesion_id){ notify('No hay sesión activa.', 'error'); return; }
  const sesionId = currentUser.sesion_id;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `
    <div class="grade-modal" style="max-width:460px;">
      <h3>Tomar asistencia</h3>
      <div class="sub">Marca quién estuvo presente en esta jornada.</div>
      <div class="grade-field">
        <label>Fecha</label>
        <input type="date" id="as-fecha" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div id="as-lista" style="margin:12px 0;"><div class="auth-hint">Cargando estudiantes…</div></div>
      <div class="auth-msg" id="as-msg"></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost" id="as-cancelar" style="flex:1;">Cerrar</button>
        <button class="auth-submit" id="as-guardar" style="flex:1;margin-top:0;">Guardar asistencia</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#as-cancelar').onclick = () => overlay.remove();

  async function cargarParaFecha(){
    const cont = overlay.querySelector('#as-lista');
    const fecha = overlay.querySelector('#as-fecha').value;
    cont.innerHTML = '<div class="auth-hint">Cargando estudiantes…</div>';
    try {
      const { data: estudiantes, error } = await sb.from('usuarios').select('id,nombre').eq('sesion_id', sesionId).eq('rol','estudiante').order('nombre');
      if(error) throw error;
      if(!estudiantes || !estudiantes.length){ cont.innerHTML = '<div class="auth-hint">Todavía no hay estudiantes registrados.</div>'; return; }
      const { data: existente } = await sb.from('asistencia').select('usuario_id,presente').eq('sesion_id', sesionId).eq('fecha', fecha);
      const marcados = {}; (existente||[]).forEach(a=>{ marcados[a.usuario_id] = a.presente; });
      cont.innerHTML = estudiantes.map(e => `
        <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px;border-bottom:1px solid var(--c3);cursor:pointer;min-height:24px;">
          <span style="font-size:13px;">${e.nombre}</span>
          <input type="checkbox" data-usuario="${e.id}" class="as-check" ${marcados[e.id]!==false?'checked':''} style="width:22px;height:22px;">
        </label>`).join('');
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
    }
  }
  overlay.querySelector('#as-fecha').onchange = cargarParaFecha;
  cargarParaFecha();

  overlay.querySelector('#as-guardar').onclick = async () => {
    const msg = overlay.querySelector('#as-msg');
    const fecha = overlay.querySelector('#as-fecha').value;
    const checks = overlay.querySelectorAll('.as-check');
    if(!checks.length){ msg.className='auth-msg show error'; msg.textContent='No hay estudiantes para registrar.'; return; }
    const registros = Array.from(checks).map(c => ({
      sesion_id: sesionId, usuario_id: c.dataset.usuario, docente_id: currentUser.auth_id,
      fecha, presente: c.checked,
    }));
    const btn = overlay.querySelector('#as-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Guardando…';
    try {
      const { error } = await conTiempoLimite(sb.from('asistencia').upsert(registros, { onConflict: 'sesion_id,usuario_id,fecha' }));
      if(error) throw error;
      notify('Asistencia guardada.', 'success');
      overlay.remove();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo guardar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Guardar asistencia';
    }
  };
}

// Después de guardar/editar/borrar una calificación, refresca cualquier
// vista que la esté mostrando: el roster del Modo Profesor (en memoria) y,
// si la persona está viendo la página "Calificaciones" en ese momento,
// también esa página (antes se quedaba desactualizada hasta cambiar de pestaña).
function refrescarVistasCalificaciones(){
  cargarRosterProfesor();
  const pagCal = document.getElementById('page-calificaciones');
  if(pagCal && pagCal.classList.contains('active')) renderCalificacionesPage();
}

async function cargarRosterProfesor(esManual){
  if(!sb || !currentUser || currentUser.rol==='estudiante'){ return; }
  const info = document.getElementById('prof-cloud-sesion-info');
  const tbody = document.getElementById('prof-cloud-tbody');
  const empty = document.getElementById('prof-cloud-empty');
  const badge = document.getElementById('prof-cloud-badge');
  const btnActualizar = document.getElementById('prof-cloud-btn-actualizar');
  if(!info || !tbody) return;

  if(guestMode){
    info.textContent = 'El modo de prueba sin cuenta no tiene estudiantes reales conectados.';
    badge.textContent = '0';
    tbody.innerHTML=''; empty.style.display='block';
    return;
  }

  // Retroalimentación visible del botón: mientras carga, gira el ícono y
  // se deshabilita, para que un clic nunca se sienta como que no hizo nada.
  if(esManual && btnActualizar){
    btnActualizar.disabled = true;
    btnActualizar.innerHTML = '<i class="ti ti-refresh" style="animation:spin .7s linear infinite;"></i> Actualizando…';
  }

  try {
    // sesion_id del docente: si currentUser.sesion_id no está (docente creado antes de
    // esta función), lo resolvemos desde sesiones_clase por docente_id.
    let sesionId = currentUser.sesion_id;
    let sesionNombre = currentUser.sesion_nombre;
    let sesionCodigo = currentUser.sesion_codigo;
    if(!sesionId){
      const { data: miSesion } = await sb.from('sesiones_clase').select('id,nombre,codigo').eq('docente_id', currentUser.auth_id).eq('activa', true).limit(1).maybeSingle();
      if(miSesion){ sesionId = miSesion.id; sesionNombre = miSesion.nombre; sesionCodigo = miSesion.codigo; }
    }
    if(!sesionId){
      info.textContent = 'Todavía no tienes una sesión de clase creada.';
      badge.textContent = '0'; tbody.innerHTML=''; empty.style.display='block';
      return;
    }

    const { data: estudiantes, error } = await conTiempoLimite(
      sb.from('usuarios').select('id,nombre,correo,creado_en').eq('sesion_id', sesionId).eq('rol','estudiante').order('creado_en', {ascending:false})
    );
    if(error) throw error;

    const { data: calRows } = await sb.from('calificaciones').select('*').eq('sesion_id', sesionId).order('creado_en', {ascending:false});
    profCalificaciones = {};
    (calRows||[]).forEach(c=>{
      if(!profCalificaciones[c.usuario_id]) profCalificaciones[c.usuario_id] = [];
      profCalificaciones[c.usuario_id].push(c);
    });

    const { data: portRows } = await sb.from('portafolios').select('*').eq('sesion_id', sesionId);
    profPortafolios = {};
    (portRows||[]).forEach(p=>{ profPortafolios[p.usuario_id] = p; });

    badge.textContent = (estudiantes||[]).length;
    rosterProfesorCache = { estudiantes: estudiantes||[], sesionId, sesionNombre };
    const filtroActual = (document.getElementById('prof-cloud-buscar')||{}).value || '';
    renderRosterProfesorTabla(filtrarEstudiantes(estudiantes||[], filtroActual), sesionId, sesionNombre);

    info.innerHTML = `<b>${sesionNombre}</b> · Código <span style="font-family:var(--font-mono);color:var(--accent2);">${sesionCodigo}</span>
      <span style="color:var(--t3);"> · Actualizado ${new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'})}</span>`;
    if(esManual) notify('Lista actualizada.', 'success');
  } catch(e){
    info.textContent = 'No se pudo cargar la lista: ' + (e.message||e);
  } finally {
    if(esManual && btnActualizar){
      btnActualizar.disabled = false;
      btnActualizar.innerHTML = '<i class="ti ti-refresh"></i> Actualizar ahora';
    }
  }
}

// Se guarda la última lista completa de estudiantes para poder filtrarla
// al instante mientras se escribe, sin volver a consultar la nube.
let rosterProfesorCache = { estudiantes: [], sesionId: null, sesionNombre: '' };

function filtrarEstudiantes(estudiantes, query){
  const q = (query||'').trim().toLowerCase();
  if(!q) return estudiantes;
  return estudiantes.filter(e => e.nombre.toLowerCase().includes(q) || (e.correo||'').toLowerCase().includes(q));
}

function filtrarRosterProfesor(query){
  const { estudiantes, sesionId, sesionNombre } = rosterProfesorCache;
  renderRosterProfesorTabla(filtrarEstudiantes(estudiantes, query), sesionId, sesionNombre);
}

function renderRosterProfesorTabla(estudiantes, sesionId, sesionNombre){
  const tbody = document.getElementById('prof-cloud-tbody');
  const empty = document.getElementById('prof-cloud-empty');
  const hayFiltro = !!(document.getElementById('prof-cloud-buscar')||{}).value;
  if(!estudiantes.length){
    tbody.innerHTML='';
    empty.textContent = hayFiltro ? 'Ningún estudiante coincide con esa búsqueda.' : 'Aún no se ha registrado ningún estudiante en tu sesión.';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  tbody.innerHTML = estudiantes.map(est=>{
    const cals = profCalificaciones[est.id] || [];
    const masReciente = cals[0];
    const nivel = masReciente ? nivelCalificacion(masReciente.nota_general) : 'sin';
    const notaTxt = masReciente && masReciente.nota_general!==null && masReciente.nota_general!==undefined
      ? masReciente.nota_general + (cals.length>1 ? ` (${cals.length})` : '')
      : (cals.length ? `${cals.length} sin nota` : 'Sin calificar');
    const port = profPortafolios[est.id];
    const valorTxt = port && port.valor_total!=null ? '$'+Number(port.valor_total).toLocaleString('es-PA',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
    const retorno = port && port.retorno_pct!=null ? Number(port.retorno_pct) : null;
    const retornoTxt = retorno!==null ? (retorno>=0?'+':'')+retorno.toFixed(1)+'%' : '—';
    const retornoColor = retorno===null ? 'var(--t3)' : (retorno>=0 ? 'var(--green)' : 'var(--red)');
    const nombreEsc = est.nombre.replace(/'/g,"\\'");
    return `<tr data-usuario-id="${est.id}">
      <td style="font-weight:600;">${est.nombre}<div style="font-size:10.5px;color:var(--t3);font-weight:400;">${est.correo}</div></td>
      <td style="color:var(--t3);white-space:nowrap;">${formatearFechaHora(est.creado_en)}</td>
      <td style="white-space:nowrap;"><span style="font-weight:600;">${valorTxt}</span> <span style="color:${retornoColor};font-size:11.5px;">${retornoTxt}</span></td>
      <td><span class="grade-pill ${nivel}">${notaTxt}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm" title="Ver resumen completo" onclick="abrirDetalleEstudiante('${est.id}','${nombreEsc}','${sesionId}')"><i class="ti ti-eye"></i></button>
        <button class="btn btn-sm" title="Exportar informe de ${nombreEsc}" onclick="exportarInformeEstudiantePDF('${est.id}','${nombreEsc}','${sesionId}')"><i class="ti ti-printer"></i></button>
        <button class="btn btn-sm" onclick="abrirModalCalificar('${est.id}','${nombreEsc}','${sesionId}')"><i class="ti ti-pencil"></i> Calificar</button>
      </td>
    </tr>`;
  }).join('');
}

function iniciarRealtimeProfesor(){
  if(!sb || !currentUser || currentUser.rol==='estudiante' || guestMode) return;
  detenerRealtimeProfesor();
  const sesionId = currentUser.sesion_id;
  if(!sesionId) return;
  const dot = document.getElementById('prof-cloud-live-dot');
  profRealtimeChannel = sb.channel('roster-'+sesionId)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'usuarios', filter:`sesion_id=eq.${sesionId}` }, (payload) => {
      if(payload.new && payload.new.rol==='estudiante'){
        notify(`Nuevo estudiante registrado: ${payload.new.nombre}`, 'success');
        cargarRosterProfesor();
      }
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'portafolios', filter:`sesion_id=eq.${sesionId}` }, (payload) => {
      // Un estudiante compró/vendió o su cartera se actualizó: refrescar la tabla.
      if(payload.new && payload.new.usuario_id){
        cargarRosterProfesor();
      }
    })
    .subscribe((status) => { if(dot) dot.style.display = (status==='SUBSCRIBED') ? 'inline-block' : 'none'; });
}

function detenerRealtimeProfesor(){
  if(profRealtimeChannel && sb){ sb.removeChannel(profRealtimeChannel); profRealtimeChannel = null; }
  const dot = document.getElementById('prof-cloud-live-dot');
  if(dot) dot.style.display = 'none';
}

// ══════════════════════════════════════════════════
// SALA EN VIVO — mapa de calor y feed de actividad en tiempo real
// ══════════════════════════════════════════════════
let salaVivoChannel = null;
let salaVivoUsuarios = {}; // usuario_id -> nombre, para no repetir consultas

// ══════════════════════════════════════════════════
// MODO PRESENTACIÓN — pantalla completa para proyectar en clase, con
// código QR para que los estudiantes se unan escaneando con el celular.
// ══════════════════════════════════════════════════
let presentacionInterval = null;

async function abrirModoPresentacion(){
  if(!currentUser || !currentUser.sesion_id || guestMode){ notify('Necesitas una sesión de clase activa para presentar.', 'error'); return; }
  const sesionNombre = currentUser.sesion_nombre || '';
  const sesionCodigo = currentUser.sesion_codigo || '';
  const urlUnion = window.location.origin + window.location.pathname + '?codigo=' + encodeURIComponent(sesionCodigo);
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&color=0-0-0&bgcolor=255-255-255&data=' + encodeURIComponent(urlUnion);

  const overlay = document.createElement('div');
  overlay.id = 'presentacion-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:6000;background:radial-gradient(circle at 50% 0%, #0d1a2e, #04070c 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#fff;text-align:center;';
  overlay.innerHTML = `
    <button onclick="cerrarModoPresentacion()" style="position:absolute;top:24px;right:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:16px;"><i class="ti ti-x"></i></button>
    <div style="font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent2);margin-bottom:10px;">CapitalLab · Sesión de clase</div>
    <div style="font-family:var(--font-head);font-size:clamp(28px,5vw,52px);font-weight:700;margin-bottom:28px;max-width:900px;">${sesionNombre}</div>
    <div style="display:flex;gap:60px;align-items:center;flex-wrap:wrap;justify-content:center;margin-bottom:32px;">
      <div>
        <img src="${qrSrc}" alt="Código QR para unirse" style="width:220px;height:220px;border-radius:16px;background:#fff;padding:12px;box-shadow:0 20px 50px rgba(0,0,0,.4);">
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:10px;">Escanea con la cámara del celular</div>
      </div>
      <div>
        <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">O entra con el código</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:var(--font-mono);font-size:clamp(48px,8vw,90px);font-weight:700;letter-spacing:.1em;color:var(--gold);">${sesionCodigo}</div>
          <button onclick="copiarCodigoSesion('${sesionCodigo}')" title="Copiar código" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;width:36px;height:36px;border-radius:8px;cursor:pointer;flex-shrink:0;"><i class="ti ti-copy"></i></button>
        </div>
      </div>
    </div>
    <div id="pres-stats" style="display:flex;gap:40px;flex-wrap:wrap;justify-content:center;">
      <div class="auth-hint" style="color:rgba(255,255,255,.5);">Cargando estadísticas en vivo…</div>
    </div>
  `;
  document.body.appendChild(overlay);

  try { await document.documentElement.requestFullscreen?.(); } catch(e){ /* algunos navegadores lo bloquean, no pasa nada */ }

  const actualizarStats = async () => {
    if(!sb || !document.getElementById('presentacion-overlay')) return;
    try {
      const { data: estudiantes } = await sb.from('usuarios').select('id').eq('sesion_id', currentUser.sesion_id).eq('rol','estudiante');
      const { data: ports } = await sb.from('portafolios').select('retorno_pct').eq('sesion_id', currentUser.sesion_id);
      const retornos = (ports||[]).map(p=>p.retorno_pct).filter(r=>r!=null);
      const promedio = retornos.length ? (retornos.reduce((a,b)=>a+Number(b),0)/retornos.length).toFixed(1) : '—';
      const cont = document.getElementById('pres-stats');
      if(cont) cont.innerHTML = `
        <div><div style="font-size:34px;font-weight:700;">${(estudiantes||[]).length}</div><div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Estudiantes unidos</div></div>
        <div><div style="font-size:34px;font-weight:700;color:${promedio!=='—'&&promedio>=0?'#00d084':'#ff4757'};">${promedio!=='—'?(promedio>=0?'+':'')+promedio+'%':'—'}</div><div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Retorno promedio</div></div>
      `;
    } catch(e){ /* silencioso: no interrumpir la presentación por un error de red */ }
  };
  actualizarStats();
  presentacionInterval = setInterval(actualizarStats, 8000);

  document.addEventListener('keydown', cerrarPresentacionConEscape);
}

function cerrarPresentacionConEscape(e){
  if(e.key==='Escape') cerrarModoPresentacion();
}

function cerrarModoPresentacion(){
  const overlay = document.getElementById('presentacion-overlay');
  if(overlay) overlay.remove();
  if(presentacionInterval){ clearInterval(presentacionInterval); presentacionInterval = null; }
  document.removeEventListener('keydown', cerrarPresentacionConEscape);
  if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
}

function cambiarTabProfesor(tab){
  const tabLista = document.getElementById('prof-tab-lista');
  const tabVivo = document.getElementById('prof-tab-vivo');
  const panelLista = document.getElementById('prof-panel-lista');
  const panelVivo = document.getElementById('prof-panel-vivo');
  if(!tabLista || !tabVivo || !panelLista || !panelVivo) return;
  tabLista.classList.toggle('active', tab==='lista');
  tabVivo.classList.toggle('active', tab==='vivo');
  panelLista.style.display = tab==='lista' ? '' : 'none';
  panelVivo.style.display = tab==='vivo' ? '' : 'none';
  if(tab==='vivo') iniciarSalaEnVivo();
  else detenerSalaEnVivo();
}

async function iniciarSalaEnVivo(){
  if(!sb || !currentUser || !currentUser.sesion_id || guestMode) return;
  const sesionId = currentUser.sesion_id;
  const heatmap = document.getElementById('prof-vivo-heatmap');
  const feed = document.getElementById('prof-vivo-feed');
  if(!heatmap || !feed) return;

  detenerSalaEnVivo(); // por si ya había una suscripción de una visita anterior

  try {
    const { data: estudiantes } = await sb.from('usuarios').select('id,nombre').eq('sesion_id', sesionId).eq('rol','estudiante');
    salaVivoUsuarios = {}; (estudiantes||[]).forEach(e=>{ salaVivoUsuarios[e.id] = e.nombre; });

    const { data: ports } = await sb.from('portafolios').select('usuario_id,valor_total,retorno_pct,ultima_actividad').eq('sesion_id', sesionId);
    renderHeatmapSalaVivo(ports||[]);
  } catch(e){
    heatmap.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }

  salaVivoChannel = sb.channel('sala-vivo-'+sesionId)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'operaciones', filter:`sesion_id=eq.${sesionId}` }, (payload) => {
      agregarAlFeedSalaVivo(payload.new);
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'portafolios', filter:`sesion_id=eq.${sesionId}` }, async () => {
      const { data: ports } = await sb.from('portafolios').select('usuario_id,valor_total,retorno_pct,ultima_actividad').eq('sesion_id', sesionId);
      renderHeatmapSalaVivo(ports||[]);
    })
    .subscribe();
}

function detenerSalaEnVivo(){
  if(salaVivoChannel && sb){ sb.removeChannel(salaVivoChannel); salaVivoChannel = null; }
}

function renderHeatmapSalaVivo(ports){
  const heatmap = document.getElementById('prof-vivo-heatmap');
  if(!heatmap) return;
  const nombres = Object.keys(salaVivoUsuarios);
  if(!nombres.length){ heatmap.innerHTML = '<div class="auth-hint">Todavía no hay estudiantes registrados en esta sesión.</div>'; return; }

  const portMap = {}; ports.forEach(p=>{ portMap[p.usuario_id] = p; });
  heatmap.innerHTML = nombres.map(uid => {
    const nombre = salaVivoUsuarios[uid];
    const p = portMap[uid];
    const retorno = p?.retorno_pct!=null ? Number(p.retorno_pct) : null;
    // Antes el fondo se saturaba con la intensidad del retorno Y el texto
    // usaba ese mismo color — con retornos altos, el número casi
    // desaparecía contra su propio fondo (el mismo problema que ya se
    // había corregido en el mapa de calor sectorial de Análisis, aquí
    // sin corregir todavía). Ahora el fondo siempre queda tenue, y el
    // número usa un color fijo de alto contraste.
    let fondo = 'var(--c3)', textoColor = 'var(--t3)';
    if(retorno!==null){
      fondo = retorno>=0 ? 'rgba(0,208,132,.1)' : 'rgba(255,71,87,.1)';
      textoColor = retorno>=0 ? 'var(--green)' : 'var(--red)';
    }
    const bordeColor = retorno===null ? 'transparent' : (retorno>=0 ? 'var(--green)' : 'var(--red)');
    const activoHaceRato = p?.ultima_actividad && (Date.now() - new Date(p.ultima_actividad).getTime()) < 120000;
    return `<div data-uid="${uid}" style="background:${fondo};border:1px solid ${bordeColor};border-radius:var(--r);padding:10px;text-align:center;position:relative;transition:background .4s;">
      ${activoHaceRato ? '<span style="position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--accent2);box-shadow:0 0 5px var(--accent2);"></span>' : ''}
      <div style="font-size:12px;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nombre}</div>
      <div style="font-size:15px;font-weight:700;color:${textoColor};">${retorno!==null?(retorno>=0?'+':'')+retorno.toFixed(1)+'%':'—'}</div>
    </div>`;
  }).join('');
}

function agregarAlFeedSalaVivo(op){
  const feed = document.getElementById('prof-vivo-feed');
  if(!feed) return;
  const placeholder = feed.querySelector('.auth-hint');
  if(placeholder) placeholder.remove();

  const nombre = salaVivoUsuarios[op.usuario_id] || 'Estudiante';
  const esCompra = op.tipo === 'compra';
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--c3);animation:logro-entrada .3s ease;';
  el.innerHTML = `
    <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${esCompra?'rgba(0,208,132,.15)':'rgba(255,71,87,.15)'};">
      <i class="ti ${esCompra?'ti-arrow-up-right':'ti-arrow-down-right'}" style="font-size:14px;color:${esCompra?'var(--green)':'var(--red)'};"></i>
    </div>
    <div style="flex:1;font-size:12.5px;">
      <b>${nombre}</b> ${esCompra?'compró':'vendió'} ${op.cantidad}u de <b>${op.simbolo}</b> a $${Number(op.precio_ejecucion).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2})}
      <div style="color:var(--t3);font-size:10.5px;">hace un momento</div>
    </div>`;
  feed.insertBefore(el, feed.firstChild);
  // Mantener el feed a un tamaño manejable
  while(feed.children.length > 30) feed.removeChild(feed.lastChild);
  // Destella brevemente la tarjeta de ese estudiante en el mapa de calor,
  // para que sea fácil ver de un vistazo quién acaba de operar.
  const tarjeta = document.querySelector(`#prof-vivo-heatmap [data-uid="${op.usuario_id}"]`);
  if(tarjeta){
    const fondoOriginal = tarjeta.style.background;
    tarjeta.style.background = 'rgba(0,196,255,.35)';
    setTimeout(()=>{ tarjeta.style.background = fondoOriginal; }, 900);
  }
}

// ══════════════════════════════════════════════════
// EXPORTACIÓN — informe individual y de salón (PDF)
// ══════════════════════════════════════════════════
// Reutiliza el motor de PDF ya usado en el resto de la app
// (pdfStyles / pdfHeader / pdfFooter / openPrintWindow).

function bloqueEstudiantePDF(estNombre, estCorreo, port, calificaciones, labHist, asistencia){
  const retorno = port?.retorno_pct!=null ? Number(port.retorno_pct) : null;
  const retornoClass = retorno===null ? '' : (retorno>=0 ? 'g' : 'r');
  const retornoTxt = retorno!==null ? (retorno>=0?'+':'')+retorno.toFixed(2)+'%' : '—';
  const fmtMoney = v => v!=null ? '$'+Number(v).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const asistPresentes = (asistencia||[]).filter(a=>a.presente).length;
  const asistTotal = (asistencia||[]).length;

  return `
    <div class="section">
      <div class="section-title">${estNombre}</div>
      <div class="section-sub">${estCorreo||''}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-lbl">Efectivo disponible</div><div class="kpi-val">${fmtMoney(port?.efectivo_disponible)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Valor total cartera</div><div class="kpi-val">${fmtMoney(port?.valor_total)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Retorno</div><div class="kpi-val ${retornoClass}">${retornoTxt}</div></div>
      <div class="kpi"><div class="kpi-lbl">Operaciones</div><div class="kpi-val">${port?.num_operaciones ?? 0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Asistencia</div><div class="kpi-val">${asistTotal?`${asistPresentes}/${asistTotal}`:'—'}</div></div>
    </div>

    <div class="section"><div class="section-title" style="font-size:10pt;">Sesiones de Laboratorio</div></div>
    ${(labHist&&labHist.length) ? `
      <table>
        <tr><th>Fecha</th><th>Estrategia</th><th>Perfil</th><th>Horizonte</th><th>Meta</th><th class="right">Resultado</th><th>Estado</th></tr>
        ${labHist.map(h=>`<tr>
          <td>${h.date||'—'}</td><td>${h.strat||'—'}</td><td>${h.perfil||'—'}</td>
          <td>${h.months?h.months+' meses':'—'}</td><td>${h.target!=null?h.target+'%':'—'}</td>
          <td class="right ${h.passed?'g':'r'}">${h.achieved!=null?h.achieved+'%':'—'}</td>
          <td>${h.passed?'Cumplida':'No cumplida'}</td>
        </tr>`).join('')}
      </table>
    ` : `<div class="empty">Sin sesiones de laboratorio registradas.</div>`}

    <div class="section"><div class="section-title" style="font-size:10pt;">Calificaciones y retroalimentación</div></div>
    ${(calificaciones&&calificaciones.length) ? calificaciones.map(c=>`
      <div class="info-box ${c.nota_general==null?'':(c.nota_general>=80?'success':c.nota_general<60?'danger':'')}">
        <b>${c.titulo}</b> — ${c.categoria||'General'} — <span class="mono">${c.nota_general!=null?c.nota_general+'/100':'Sin nota numérica'}</span><br>
        ${c.comentario ? `<i>"${c.comentario}"</i><br>` : ''}
        <span style="color:#999;font-size:7.5pt;">${formatearFechaHora(c.creado_en)}</span>
      </div>
    `).join('') : `<div class="empty">Sin calificaciones registradas todavía.</div>`}
  `;
}

// Informe de UN estudiante — pensado para descargarlo y enviárselo directamente,
// incluye su cartera, sus sesiones de laboratorio y toda su retroalimentación.
// ══════════════════════════════════════════════════
// PORTAFOLIO DE EVIDENCIAS — el informe más completo que existe: junta
// cartera, laboratorio, calificaciones, asistencia, cuestionarios, logros
// y retos en un solo documento, con la gráfica de evolución real
// renderizada como imagen (no solo números), pensado para servir como
// evidencia formal de evaluación.
// ══════════════════════════════════════════════════

// Versión de la gráfica de evolución segura para la ventana de impresión:
// usa colores fijos en vez de variables CSS (la ventana de impresión no
// carga la hoja de estilos de la app, solo pdfStyles()).
function graficaEvolucionSVGImpresion(puntos){
  if(!puntos || puntos.length < 2) return '<div class="empty">No hay suficientes datos para graficar la evolución.</div>';
  const w = 680, h = 160, pad = 10;
  const valores = puntos.map(p=>p.valor);
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = (max - min) || 1;
  const xStep = (w - pad*2) / (puntos.length - 1);
  const coords = puntos.map((p,i) => {
    const x = pad + i*xStep;
    const y = h - pad - ((p.valor - min) / rango) * (h - pad*2);
    return [x,y];
  });
  const linea = coords.map(([x,y],i) => (i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
  const area = linea + ` L${coords[coords.length-1][0].toFixed(1)},${h-pad} L${coords[0][0].toFixed(1)},${h-pad} Z`;
  const subio = puntos[puntos.length-1].valor >= puntos[0].valor;
  const color = subio ? '#00a86b' : '#d81d34';
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:120px;">
    <path d="${area}" fill="${color}" opacity="0.1"></path>
    <path d="${linea}" fill="none" stroke="${color}" stroke-width="2"></path>
  </svg>`;
}

// ══════════════════════════════════════════════════
// RESUMEN DE ACTIVIDADES PARA PRESENTAR — junta en una sola pantalla
// todo lo que un estudiante ha hecho en CapitalLab (cartera, Laboratorio
// si lo usó, subastas del Mercado P2P si participó, y sus operaciones),
// pensado para mostrarlo en una reunión de clase frente a compañeros y
// docente, con exportación a PDF o a PowerPoint. No crea nada que no
// exista — si no ha usado el Laboratorio o no ha participado en
// subastas, esas secciones simplemente no aparecen.
// ══════════════════════════════════════════════════
async function recopilarResumenActividades(){
  const valorTotal = capital + portfolio.reduce((s,p)=>s+(p.qty*(p.currentPrice||p.buyPrice)),0);
  const retornoPct = ((valorTotal - 50000) / 50000) * 100;
  const pm = computePortfolioMetrics(portfolio);
  const topPosiciones = [...portfolio].sort((a,b)=>(b.qty*(b.currentPrice||b.buyPrice))-(a.qty*(a.currentPrice||a.buyPrice))).slice(0,5);

  // Laboratorio — solo si ya tiene sesiones registradas, nunca se crea una nueva aquí.
  const labSesiones = labHistory.length ? labHistory.slice(0, 5) : [];

  // Subastas del Mercado P2P en las que participó (ganadas o vendidas), si existen.
  let subastas = [];
  if(sb && currentUser && currentUser.usuario_id && !guestMode){
    try {
      const { data } = await sb.from('ofertas_p2p').select('*')
        .eq('sesion_id', currentUser.sesion_id).eq('tipo','subasta').eq('estado','cumplida')
        .or(`vendedor_id.eq.${currentUser.usuario_id},comprador_id.eq.${currentUser.usuario_id}`)
        .order('creado_en',{ascending:false}).limit(10);
      subastas = data || [];
    } catch(e){ subastas = []; }
  }

  // Órdenes — las operaciones más recientes registradas en esta cartera.
  const ordenes = txHistory.slice(0, 10);

  return { valorTotal, retornoPct, pm, topPosiciones, labSesiones, subastas, ordenes };
}

async function abrirResumenParaPresentar(){
  if(!currentUser || guestMode){ notify('Necesitas una cuenta real para generar este resumen.', 'error'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:640px;max-height:88vh;overflow-y:auto;">
    <h3><i class="ti ti-presentation"></i> Resumen para presentar</h3>
    <div class="sub">Todo lo que has hecho en CapitalLab, listo para mostrar en clase.</div>
    <div id="rp-contenido"><div class="auth-hint">Preparando tu resumen…</div></div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
      <button class="btn btn-ghost" id="rp-cerrar" style="flex:1;min-width:100px;min-height:44px;">Cerrar</button>
      <button class="btn btn-ghost" id="rp-informe" style="flex:1;min-width:140px;min-height:44px;border-color:var(--gold, #e8b94a);color:var(--gold, #e8b94a);"><i class="ti ti-brain"></i> Informe Académico (IA)</button>
      <button class="btn" id="rp-pdf" style="flex:1;min-width:100px;min-height:44px;"><i class="ti ti-file-type-pdf"></i> Exportar PDF</button>
      <button class="btn" id="rp-ppt" style="flex:1;min-width:100px;min-height:44px;background:rgba(212,102,0,.15);color:#e08000;"><i class="ti ti-presentation"></i> Exportar PPT</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#rp-cerrar').onclick = () => overlay.remove();

  const datos = await recopilarResumenActividades();
  overlay.querySelector('#rp-contenido').innerHTML = renderResumenActividadesHTML(datos);
  overlay.querySelector('#rp-pdf').onclick = () => exportarResumenActividadesPDF(datos);
  overlay.querySelector('#rp-ppt').onclick = () => exportarResumenActividadesPPT(datos);
  overlay.querySelector('#rp-informe').onclick = () => generarInformeAcademicoIA(datos, overlay);
}

// ═══════════════════════════════════════════════════════════════════
// INFORME ACADÉMICO CON IA — extiende el Resumen para presentar con
// reflexión, errores detectados, y recomendaciones, basado siempre en
// los datos reales de la sesión del estudiante. Nunca asigna una
// calificación numérica, eso es exclusivo del profesor humano.
// ═══════════════════════════════════════════════════════════════════
async function generarInformeAcademicoIA(datos, overlay){
  const cont = overlay.querySelector('#rp-contenido');
  const botonInforme = overlay.querySelector('#rp-informe');
  botonInforme.disabled = true; botonInforme.style.opacity = '.6';
  botonInforme.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Generando…';
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  const actividad = {
    valorTotal: datos.valorTotal.toFixed(2),
    retornoPct: datos.retornoPct.toFixed(1),
    posiciones: datos.topPosiciones.map(p => ({ name:p.name, type:p.type, pesoPct: datos.valorTotal ? (((p.qty*(p.currentPrice||p.buyPrice))/datos.valorTotal)*100).toFixed(1) : 0, gananciaPct: p.buyPrice ? (((p.currentPrice-p.buyPrice)/p.buyPrice)*100).toFixed(1) : 0 })),
    ordenes: datos.ordenes.map(o => ({ side:o.side, ticker:o.ticker, name:o.name, qty:o.qty })),
    labSesiones: datos.labSesiones.map(l => ({ target:l.target, horizon:l.horizon, passed:l.passed })),
    perfilDeclarado: window.__perfilRiesgoDeclarado || 'moderado',
  };

  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'informe_academico', actividad }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    cont.insertAdjacentHTML('beforeend', renderInformeAcademicoHTML(d, false));
  } catch(e){
    // Sin IA disponible — un informe básico por reglas fijas, con los
    // mismos datos reales, para que el estudiante y el profesor nunca
    // se queden sin nada que revisar.
    cont.insertAdjacentHTML('beforeend', renderInformeAcademicoHTML(generarInformeAcademicoLocal(actividad), true));
  } finally {
    botonInforme.disabled = false; botonInforme.style.opacity='1'; botonInforme.innerHTML = '<i class="ti ti-brain"></i> Informe Académico (IA)';
    botonInforme.style.display = 'none'; // ya se generó, no hace falta pedirlo de nuevo en esta misma vista
  }
}

function renderInformeAcademicoHTML(d, esLocal){
  const aviso = esLocal
    ? `<div style="background:rgba(232,185,74,.1);border:1px solid var(--amber, #e8b94a);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--amber, #e8b94a);"><i class="ti ti-plug-connected-x"></i> La IA no está disponible ahora mismo, este es un informe básico por reglas.</div>`
    : '';
  return `
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--c4);">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><i class="ti ti-brain" style="color:var(--gold, #e8b94a);"></i> Informe Académico</div>
      ${aviso}
      <div style="font-size:12.5px;color:var(--t2);margin-bottom:12px;"><b>Perfil observado:</b> ${d.perfilObservado}</div>
      <div style="font-weight:600;font-size:12px;margin-bottom:5px;">Decisiones clave</div>
      ${d.decisionesClave.map(x=>`<div style="font-size:12px;color:var(--t2);padding:4px 0 4px 14px;border-left:2px solid var(--accent2, #4a9eff);margin-bottom:4px;">${x}</div>`).join('')}
      <div style="font-weight:600;font-size:12px;margin:12px 0 5px;">Riesgos o errores a revisar</div>
      ${d.erroresPrincipales.map(x=>`<div style="font-size:12px;color:var(--t2);padding:4px 0 4px 14px;border-left:2px solid var(--red, #ff4757);margin-bottom:4px;">${x}</div>`).join('')}
      <div style="font-weight:600;font-size:12px;margin:12px 0 5px;">Reflexión</div>
      <p style="font-size:12.5px;color:var(--t2);line-height:1.6;">${d.reflexion}</p>
      <div style="font-weight:600;font-size:12px;margin:12px 0 5px;">Recomendaciones para tu próxima sesión</div>
      ${d.recomendaciones.map(x=>`<div style="font-size:12px;color:var(--t2);padding:4px 0 4px 14px;border-left:2px solid var(--green, #1e8e5a);margin-bottom:4px;">${x}</div>`).join('')}
      <div style="font-size:10.5px;color:var(--t3);margin-top:12px;font-style:italic;">Este informe es una guía de reflexión, no una calificación. La evaluación formal corresponde a tu profesor.</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// REFLEXIÓN SOBRE RESTRICCIONES INCUMPLIDAS — cierra el ciclo del
// Laboratorio con restricciones: no solo muestra el dato de qué se
// incumplió, sino que la IA hace la pregunta concreta de qué
// decisión cambiaría, citando el porcentaje real de esa cartera
// específica, nunca una pregunta genérica.
// ═══════════════════════════════════════════════════════════════════
async function generarReflexionRestriccionesIA(){
  const boton = document.getElementById('btn-reflexion-lab');
  const cont = document.getElementById('reflexion-restricciones-resultado');
  boton.disabled = true; boton.style.opacity = '.6';
  boton.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Pensando…';
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  const contexto = {
    restricciones: window.__ultimasRestriccionesLab || [],
    alocacion: window.__ultimaAlocacionLab || {},
    metaAlcanzada: window.__ultimoContextoLab?.metaAlcanzada,
    retornoPct: window.__ultimoContextoLab?.retornoPct,
  };
  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'reflexion_restricciones', contexto }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    cont.innerHTML = renderReflexionRestriccionesHTML(d, false);
  } catch(e){
    cont.innerHTML = renderReflexionRestriccionesHTML(generarReflexionRestriccionesLocal(contexto), true);
  } finally {
    boton.style.display = 'none';
  }
}

function renderReflexionRestriccionesHTML(d, esLocal){
  const aviso = esLocal
    ? `<div style="background:rgba(232,185,74,.1);border:1px solid var(--amber, #e8b94a);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11px;color:var(--amber, #e8b94a);"><i class="ti ti-plug-connected-x"></i> La IA no está disponible ahora mismo, esta es una reflexión básica por reglas.</div>`
    : '';
  return `${aviso}
    <div style="background:linear-gradient(135deg, var(--c2, #18212f), var(--c1, #131a26));border:1px solid var(--gold, #e8b94a);border-left-width:3px;border-radius:10px;padding:14px 16px;">
      <div style="font-size:12.5px;color:var(--t2);margin-bottom:8px;">${d.diagnostico}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:var(--t1);line-height:1.6;font-style:italic;">"${d.preguntaReflexiva}"</div>
    </div>`;
}

function generarReflexionRestriccionesLocal(contexto){
  const incumplida = (contexto.restricciones||[]).find(r=>!r.cumple);
  if(!incumplida) return { diagnostico:'Todas las restricciones se cumplieron en esta sesión.', preguntaReflexiva:'¿Qué harías distinto para intentar un retorno todavía mayor sin arriesgar el cumplimiento de las reglas?' };
  return {
    diagnostico: `Tu cartera incumplió "${incumplida.nombre}": el límite era ${incumplida.limite} y tuviste ${incumplida.real}.`,
    preguntaReflexiva: `Si tuvieras que ajustar tu asignación para cumplir con ${incumplida.nombre.toLowerCase()} (límite ${incumplida.limite}), ¿qué porcentaje reducirías, y hacia cuál otro tipo de activo lo moverías?`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MENTOR IA — el primer espacio conversacional real del simulador.
// Todas las demás funciones de IA son de un solo disparo (un botón,
// una respuesta fija); este panel permite preguntas libres, con
// memoria real de lo ya conversado en esta sesión, y contexto real
// de la cartera y la página donde está el estudiante en ese momento.
// ═══════════════════════════════════════════════════════════════════
let mentorHistorialChat = [];

// ═══════════════════════════════════════════════════════════════
// TICKET DE SOPORTE TÉCNICO — solo docentes y superadmin. Recopila
// automáticamente el entorno del navegador (nunca se le pide al
// usuario que lo escriba a mano), y envía el reporte al equipo
// técnico. No aparece en ningún lugar visible del flujo normal de
// trabajo — el único rastro es el correo que reciben los
// administradores, y la lista que ellos pueden consultar aparte.
// ═══════════════════════════════════════════════════════════════════
function abrirReferenciaCalificaciones(){
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `<div class="export-modal" style="max-width:520px;">
    <button class="modal-close" onclick="this.closest('.export-modal-overlay').remove();"><i class="ti ti-x"></i></button>
    <h2><i class="ti ti-award" style="color:var(--gold, #e8b94a);"></i> Niveles de Calificación CapitalLab</h2>
    <p style="font-size:12.5px;color:var(--t2, #b8c4dc);margin-bottom:14px;">Combina el retorno esperado y el riesgo real de cada activo (Ratio Sharpe) en una sola letra, para que estudiantes, inversionistas, y profesores puedan ver rápido qué tan favorable es su relación riesgo-retorno. Nunca se basa en una sola métrica aislada: un activo de alto retorno pero riesgo desproporcionado no sale "Excelente" solo por ser rentable.</p>
    ${Object.entries(NIVELES_CALIFICACION_CAPITALLAB).map(([letra,n]) => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--c4, #242d42);">
        <div style="width:36px;height:36px;border-radius:50%;background:${n.color}22;border:2px solid ${n.color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${n.color};flex-shrink:0;">${letra}</div>
        <div>
          <div style="font-size:12.5px;font-weight:600;color:${n.color};">${n.titulo}</div>
          <div style="font-size:11px;color:var(--t3);line-height:1.4;">${n.descripcion}</div>
        </div>
      </div>
    `).join('')}
    <div style="font-size:10.5px;color:var(--t3);margin-top:12px;font-style:italic;">Un activo con calificación crediticia por debajo de grado sólido (A o mejor) nunca alcanza A+ o A en esta escala, sin importar su Sharpe — el riesgo de impago es real y esta escala lo respeta. Esta calificación no constituye una recomendación financiera.</div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
}

function abrirLanzadorHerramientas(){
  document.getElementById('lanzador-herramientas-overlay').style.display = 'flex';
}

function abrirTicketSoporte(){
  document.getElementById('ticket-soporte-overlay').style.display = 'flex';
  document.getElementById('ticket-soporte-msg').textContent = '';
  ['ticket-error','ticket-intentaba','ticket-intento-solucion','ticket-como-resolvio','ticket-email'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  if(currentUser?.correo) document.getElementById('ticket-email').value = currentUser.correo;
}

function recopilarEntornoNavegador(){
  // Todo lo que el navegador expone por sí solo, sin preguntarle
  // nada al profesor — si algún dato no está disponible, se omite en
  // vez de mostrar undefined en el reporte que reciben los admins.
  const nav = navigator;
  return {
    navegador: nav.userAgent || 'no disponible',
    idioma: nav.language || 'no disponible',
    resolucionPantalla: `${screen.width}x${screen.height}`,
    tamanoVentana: `${window.innerWidth}x${window.innerHeight}`,
    plataforma: nav.platform || 'no disponible',
    enLinea: nav.onLine,
    paginaActual: document.querySelector('.page.active')?.id?.replace('page-','') || 'desconocida',
    url: window.location.href,
    fechaHora: new Date().toLocaleString('es-PA'),
  };
}

async function enviarTicketSoporte(){
  const error = document.getElementById('ticket-error').value.trim();
  const email = document.getElementById('ticket-email').value.trim();
  const msg = document.getElementById('ticket-soporte-msg');
  if(!error){ msg.style.color='var(--red)'; msg.textContent = 'Cuéntanos qué error tuviste, es el único campo obligatorio junto al correo.'; return; }
  if(!email || !email.includes('@')){ msg.style.color='var(--red)'; msg.textContent = 'Escribe un correo de contacto válido.'; return; }

  const boton = document.getElementById('ticket-soporte-btn-enviar');
  boton.disabled = true; boton.style.opacity = '.6';
  boton.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Enviando…';
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  msg.textContent = '';

  const cuerpo = {
    errorDescripcion: error,
    queIntentaba: document.getElementById('ticket-intentaba').value.trim() || null,
    intentoSolucion: document.getElementById('ticket-intento-solucion').value.trim() || null,
    comoLoResolvio: document.getElementById('ticket-como-resolvio').value.trim() || null,
    emailContacto: email,
    nombreUsuario: currentUser?.nombre || 'invitado',
    rol: currentUser?.rol || 'invitado',
    sesionNombre: currentUser?.sesion_nombre || null,
    entorno: recopilarEntornoNavegador(),
  };

  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/reportar-ticket-soporte`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify(cuerpo),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    msg.style.color = 'var(--green)';
    msg.innerHTML = '<i class="ti ti-circle-check"></i> Reporte enviado. El equipo técnico lo recibió por correo.';
    setTimeout(()=>{ document.getElementById('ticket-soporte-overlay').style.display='none'; }, 1800);
  } catch(e){
    msg.style.color = 'var(--red)';
    // El fetch al endpoint de tickets falla con "Failed to fetch" cuando la
    // función Edge no está desplegada en Supabase (no hay respuesta HTTP,
    // solo un error de red genérico del navegador). Mientras ese endpoint
    // no exista, no perdemos lo que el usuario ya escribió: lo copiamos al
    // portapapeles para que lo pueda pegar en el canal de soporte que use.
    let copiado = false;
    try{
      await navigator.clipboard.writeText(JSON.stringify(cuerpo, null, 2));
      copiado = true;
    }catch(_e){ /* portapapeles no disponible; seguimos sin bloquear el flujo */ }
    msg.innerHTML = 'No se pudo enviar el reporte (el servidor de soporte no respondió). '
      + (copiado
          ? '<strong>Tu reporte se copió al portapapeles</strong> — pégalo donde le escribas al equipo técnico.'
          : 'Vuelve a intentarlo en unos minutos.');
  } finally {
    boton.disabled = false; boton.style.opacity = '1';
    boton.innerHTML = '<i class="ti ti-send"></i> Enviar reporte';
  }
}

function alternarMentorIA(){
  const panel = document.getElementById('mentor-ia-panel');
  const abriendo = panel.style.display === 'none';
  panel.style.display = abriendo ? 'flex' : 'none';
  if(abriendo && !mentorHistorialChat.length){
    agregarMensajeMentor('mentor', '¡Hola! Soy tu Mentor IA. Puedo ayudarte a entender tu cartera, un concepto financiero, o una decisión que estés por tomar. ¿En qué te ayudo?');
  }
  if(abriendo) setTimeout(()=>document.getElementById('mentor-ia-input')?.focus(), 100);
}

function agregarMensajeMentor(rol, texto){
  mentorHistorialChat.push({ rol, texto });
  const cont = document.getElementById('mentor-ia-mensajes');
  const esUsuario = rol === 'usuario';
  const burbuja = document.createElement('div');
  burbuja.style.cssText = `align-self:${esUsuario?'flex-end':'flex-start'};max-width:85%;background:${esUsuario?'var(--accent2, #4a9eff)':'var(--c2, #161b26)'};color:${esUsuario?'#fff':'var(--t1, #e8edf8)'};padding:9px 13px;border-radius:14px;${esUsuario?'border-bottom-right-radius:4px;':'border-bottom-left-radius:4px;'}font-size:13px;line-height:1.5;white-space:pre-wrap;`;
  burbuja.textContent = texto;
  cont.appendChild(burbuja);
  cont.scrollTop = cont.scrollHeight;
}

function recopilarContextoMentor(){
  const posiciones = (portfolio||[]).map(p => ({
    name: p.name, type: p.type,
    pesoPct: (() => { const total = (portfolio||[]).reduce((s,x)=>s+((x.currentPrice||x.buyPrice)*x.qty),0); return total ? (((p.currentPrice||p.buyPrice)*p.qty/total)*100).toFixed(1) : 0; })(),
    gananciaPct: p.buyPrice ? (((p.currentPrice-p.buyPrice)/p.buyPrice)*100).toFixed(1) : 0,
  }));
  const valorTotal = (portfolio||[]).reduce((s,p)=>s+((p.currentPrice||p.buyPrice)*p.qty),0);
  const invertido = (portfolio||[]).reduce((s,p)=>s+(p.invested||0),0);
  const retornoPct = invertido ? (((valorTotal-invertido)/invertido)*100).toFixed(1) : 0;
  return {
    valorTotal: valorTotal.toFixed(2), retornoPct, posiciones,
    perfilDeclarado: window.__perfilRiesgoDeclarado || 'moderado',
    paginaActual: document.querySelector('.page.active')?.id?.replace('page-','') || 'desconocida',
  };
}

async function enviarPreguntaMentor(){
  const input = document.getElementById('mentor-ia-input');
  const pregunta = input.value.trim();
  if(!pregunta) return;
  input.value = '';
  agregarMensajeMentor('usuario', pregunta);

  const boton = document.getElementById('mentor-ia-btn-enviar');
  boton.disabled = true; boton.style.opacity = '.6';
  const cont = document.getElementById('mentor-ia-mensajes');
  const indicadorCarga = document.createElement('div');
  indicadorCarga.id = 'mentor-ia-cargando';
  indicadorCarga.style.cssText = 'align-self:flex-start;font-size:12px;color:var(--t3);display:flex;align-items:center;gap:6px;';
  indicadorCarga.innerHTML = '<i class="ti ti-loader-2" style="animation:girarSimIA 1s linear infinite;"></i> Escribiendo…';
  if(!document.getElementById('sim-ia-estilo-girar')){
    const st=document.createElement('style'); st.id='sim-ia-estilo-girar';
    st.textContent='@keyframes girarSimIA{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  cont.appendChild(indicadorCarga);
  cont.scrollTop = cont.scrollHeight;

  // El historial que se manda a Gemini es el de antes de esta
  // pregunta (el turno actual va aparte, ver la función del servidor).
  const historialPrevio = mentorHistorialChat.slice(0, -1).map(m => ({ rol:m.rol, texto:m.texto }));

  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'mentor_chat', pregunta, historial:historialPrevio, contexto:recopilarContextoMentor() }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    document.getElementById('mentor-ia-cargando')?.remove();
    agregarMensajeMentor('mentor', d.respuesta);
  } catch(e){
    document.getElementById('mentor-ia-cargando')?.remove();
    agregarMensajeMentor('mentor', generarRespuestaMentorLocal(pregunta, recopilarContextoMentor()));
  } finally {
    boton.disabled = false; boton.style.opacity = '1';
  }
}

function generarRespuestaMentorLocal(pregunta, contexto){
  // Sin IA disponible — un reconocimiento honesto, con los datos
  // reales que sí se pueden dar sin necesitar redacción de IA, en vez
  // de dejar al estudiante sin ninguna respuesta en el chat.
  const q = pregunta.toLowerCase();
  if(q.includes('cartera') || q.includes('portafolio')){
    return `La IA no está disponible ahora mismo, pero puedo darte el dato directo: tu cartera vale US$${contexto.valorTotal} en este momento, con un retorno acumulado de ${contexto.retornoPct}% y ${contexto.posiciones.length} posición(es) activa(s).`;
  }
  return 'La IA no está disponible ahora mismo, así que no puedo redactar una respuesta completa a esa pregunta. Intenta de nuevo en un momento, o revisa el panel de Análisis para ver los datos directos de cualquier activo.';
}

function generarInformeAcademicoLocal(actividad){
  const mayor = actividad.posiciones.reduce((a,b)=> (parseFloat(b.pesoPct)>parseFloat(a?.pesoPct||0) ? b : a), null);
  const tiposDistintos = new Set(actividad.posiciones.map(p=>p.type));
  const errores = [];
  if(mayor && parseFloat(mayor.pesoPct) >= 40) errores.push(`${mayor.name} representa el ${mayor.pesoPct}% de tu cartera, una concentración alta en una sola posición.`);
  if(tiposDistintos.size === 1 && actividad.posiciones.length) errores.push('Toda tu cartera está en un solo tipo de mercado, sin diversificar entre acciones, bonos, o divisas.');
  if(!errores.length) errores.push('No se detectaron riesgos evidentes de concentración con las reglas básicas disponibles.');
  return {
    perfilObservado: `Con un retorno de ${actividad.retornoPct}% y ${actividad.posiciones.length} posiciones activas, tus decisiones reflejan un perfil ${Math.abs(actividad.retornoPct)>15?'más agresivo':'moderado'} en esta sesión.`,
    decisionesClave: actividad.ordenes.slice(0,3).map(o => `${o.side==='buy'?'Compraste':'Vendiste'} ${o.qty} unidades de ${o.ticker||o.name}.`),
    erroresPrincipales: errores,
    reflexion: 'Este es un análisis básico por reglas fijas, no generado por IA. Revisa tus decisiones con tu profesor para una reflexión más completa.',
    recomendaciones: ['Considera diversificar entre más tipos de mercado si tu cartera está concentrada en uno solo.', 'Compara tu retorno actual contra tu meta declarada al inicio de la sesión.'],
  };
}

function renderResumenActividadesHTML(d){
  const gan = d.retornoPct >= 0;
  let html = `
    <div style="background:var(--c2);border-radius:var(--r2);padding:14px;margin-bottom:14px;">
      <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Mi cartera</div>
      <div style="font-size:26px;font-weight:700;">$${d.valorTotal.toLocaleString('es-PA',{maximumFractionDigits:0})}</div>
      <div style="font-size:15px;font-weight:600;color:${gan?'var(--green)':'var(--red)'};">${gan?'+':''}${d.retornoPct.toFixed(2)}% desde el capital inicial</div>
    </div>`;

  if(d.topPosiciones.length){
    html += `<div style="font-weight:700;font-size:13px;margin-bottom:6px;">Principales posiciones</div>`;
    html += d.topPosiciones.map(p => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--c3);">
      <span>${p.name}</span><span class="mono">$${(p.qty*(p.currentPrice||p.buyPrice)).toLocaleString('es-PA',{maximumFractionDigits:0})}</span>
    </div>`).join('');
  }

  if(d.labSesiones.length){
    html += `<div style="font-weight:700;font-size:13px;margin:14px 0 6px;">Laboratorio — sesiones completadas</div>`;
    html += d.labSesiones.map(h => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--c3);">
      <span>${h.horizon||'—'} meses · meta ${h.target||0}%</span><span style="color:${h.passed?'var(--green)':'var(--red)'};">${h.passed?'Meta cumplida':'No alcanzada'}</span>
    </div>`).join('');
  }

  if(d.subastas.length){
    html += `<div style="font-weight:700;font-size:13px;margin:14px 0 6px;">Subastas del Mercado entre Estudiantes</div>`;
    html += d.subastas.map(s => {
      const fuiVendedor = s.vendedor_id === currentUser.usuario_id;
      return `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--c3);">
        <span>${fuiVendedor?'Vendí':'Gané'} ${s.cantidad}u de ${s.activo_nombre}</span><span class="mono">$${(s.cantidad*s.precio_actual).toLocaleString('es-PA',{maximumFractionDigits:0})}</span>
      </div>`;
    }).join('');
  }

  if(d.ordenes.length){
    html += `<div style="font-weight:700;font-size:13px;margin:14px 0 6px;">Órdenes recientes</div>`;
    html += d.ordenes.map(o => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--c3);">
      <span>${o.action} · ${o.name}</span><span class="mono">${o.qty}u a $${fmt(o.price)}</span>
    </div>`).join('');
  }

  return html;
}

function exportarResumenActividadesPDF(d){
  const gan = d.retornoPct >= 0;
  const body = pdfHeader(`Resumen de actividades — ${currentUser.nombre}`)
    + `<div class="section"><div class="section-title">Mi cartera</div>
       <div class="section-sub">Valor total: $${d.valorTotal.toLocaleString('es-PA',{maximumFractionDigits:0})} · Retorno: ${gan?'+':''}${d.retornoPct.toFixed(2)}%</div></div>`
    + (d.topPosiciones.length ? `<table><tr><th>Posición</th><th class="right">Valor</th></tr>${d.topPosiciones.map(p=>`<tr><td>${p.name}</td><td class="right">$${(p.qty*(p.currentPrice||p.buyPrice)).toLocaleString('es-PA',{maximumFractionDigits:0})}</td></tr>`).join('')}</table>` : '')
    + (d.labSesiones.length ? `<div class="section"><div class="section-title">Laboratorio</div></div><table><tr><th>Horizonte</th><th>Meta</th><th>Resultado</th></tr>${d.labSesiones.map(h=>`<tr><td>${h.horizon||'—'} meses</td><td>${h.target||0}%</td><td>${h.passed?'Meta cumplida':'No alcanzada'}</td></tr>`).join('')}</table>` : '')
    + (d.subastas.length ? `<div class="section"><div class="section-title">Subastas del Mercado entre Estudiantes</div></div><table><tr><th>Activo</th><th>Cantidad</th><th class="right">Valor</th></tr>${d.subastas.map(s=>`<tr><td>${s.activo_nombre}</td><td>${s.cantidad}u</td><td class="right">$${(s.cantidad*s.precio_actual).toLocaleString('es-PA',{maximumFractionDigits:0})}</td></tr>`).join('')}</table>` : '')
    + (d.ordenes.length ? `<div class="section"><div class="section-title">Órdenes recientes</div></div><table><tr><th>Operación</th><th>Activo</th><th class="right">Cantidad</th><th class="right">Precio</th></tr>${d.ordenes.map(o=>`<tr><td>${o.action}</td><td>${o.name}</td><td class="right">${o.qty}u</td><td class="right">$${fmt(o.price)}</td></tr>`).join('')}</table>` : '')
    + pdfFooter();
  openPrintWindow(body, `Resumen de actividades — ${currentUser.nombre}`);
}

async function exportarResumenActividadesPPT(d){
  if(typeof PptxGenJS === 'undefined'){ notify('No se pudo cargar el generador de PowerPoint. Revisa tu conexión a internet.', 'error'); return; }
  notify('Generando PowerPoint…', 'success');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name:'CL', width:13.333, height:7.5 });
  pptx.layout = 'CL';
  const NAVY='10141D', GOLD='D4AF37', CYAN='00C4FF', GREEN='00D084', RED='FF4757', WHITE='FFFFFF';

  let s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText('Resumen de Actividades', { x:0.6, y:2.6, w:12, h:1, fontSize:40, bold:true, color:WHITE, fontFace:'Arial' });
  s.addText(currentUser.nombre, { x:0.6, y:3.5, w:12, h:0.6, fontSize:22, color:CYAN, fontFace:'Arial' });
  s.addText('CapitalLab · Simulador de Mercados Financieros · Universidad de Panamá', { x:0.6, y:6.6, w:12, h:0.4, fontSize:12, color:'7A8AB0', fontFace:'Arial' });

  const gan = d.retornoPct >= 0;
  s = pptx.addSlide(); s.background = { color: NAVY };
  s.addText('Mi Cartera', { x:0.6, y:0.4, w:12, h:0.7, fontSize:28, bold:true, color:WHITE, fontFace:'Arial' });
  s.addText('$'+d.valorTotal.toLocaleString('es-PA',{maximumFractionDigits:0}), { x:0.6, y:1.4, w:6, h:1, fontSize:44, bold:true, color:WHITE, fontFace:'Arial' });
  s.addText((gan?'+':'')+d.retornoPct.toFixed(2)+'%', { x:0.6, y:2.4, w:6, h:0.6, fontSize:24, bold:true, color:gan?GREEN:RED, fontFace:'Arial' });
  if(d.topPosiciones.length){
    const filas = [[{text:'Posición',options:{bold:true,color:GOLD}},{text:'Valor',options:{bold:true,color:GOLD}}]]
      .concat(d.topPosiciones.map(p=>[p.name, '$'+(p.qty*(p.currentPrice||p.buyPrice)).toLocaleString('es-PA',{maximumFractionDigits:0})]));
    s.addTable(filas, { x:0.6, y:3.3, w:9, fontSize:14, color:WHITE, border:{type:'solid',color:'242D42',pt:1}, fill:{color:'1C2333'} });
  }

  if(d.labSesiones.length){
    s = pptx.addSlide(); s.background = { color: NAVY };
    s.addText('Laboratorio', { x:0.6, y:0.4, w:12, h:0.7, fontSize:28, bold:true, color:WHITE, fontFace:'Arial' });
    const filas = [[{text:'Horizonte',options:{bold:true,color:GOLD}},{text:'Meta',options:{bold:true,color:GOLD}},{text:'Resultado',options:{bold:true,color:GOLD}}]]
      .concat(d.labSesiones.map(h=>[(h.horizon||'—')+' meses', (h.target||0)+'%', h.passed?'Meta cumplida':'No alcanzada']));
    s.addTable(filas, { x:0.6, y:1.3, w:10, fontSize:14, color:WHITE, border:{type:'solid',color:'242D42',pt:1}, fill:{color:'1C2333'} });
  }

  if(d.subastas.length){
    s = pptx.addSlide(); s.background = { color: NAVY };
    s.addText('Subastas del Mercado entre Estudiantes', { x:0.6, y:0.4, w:12, h:0.7, fontSize:26, bold:true, color:WHITE, fontFace:'Arial' });
    const filas = [[{text:'Activo',options:{bold:true,color:GOLD}},{text:'Cantidad',options:{bold:true,color:GOLD}},{text:'Valor',options:{bold:true,color:GOLD}}]]
      .concat(d.subastas.map(sub=>[sub.activo_nombre, sub.cantidad+'u', '$'+(sub.cantidad*sub.precio_actual).toLocaleString('es-PA',{maximumFractionDigits:0})]));
    s.addTable(filas, { x:0.6, y:1.3, w:10, fontSize:14, color:WHITE, border:{type:'solid',color:'242D42',pt:1}, fill:{color:'1C2333'} });
  }

  if(d.ordenes.length){
    s = pptx.addSlide(); s.background = { color: NAVY };
    s.addText('Órdenes Recientes', { x:0.6, y:0.4, w:12, h:0.7, fontSize:28, bold:true, color:WHITE, fontFace:'Arial' });
    const filas = [[{text:'Operación',options:{bold:true,color:GOLD}},{text:'Activo',options:{bold:true,color:GOLD}},{text:'Cantidad',options:{bold:true,color:GOLD}},{text:'Precio',options:{bold:true,color:GOLD}}]]
      .concat(d.ordenes.map(o=>[o.action, o.name, o.qty+'u', '$'+fmt(o.price)]));
    s.addTable(filas, { x:0.4, y:1.3, w:12.5, fontSize:12, color:WHITE, border:{type:'solid',color:'242D42',pt:1}, fill:{color:'1C2333'} });
  }

  await pptx.writeFile({ fileName: `resumen-actividades-${(currentUser.nombre||'estudiante').replace(/\s+/g,'_')}.pptx` });
  notify('PowerPoint generado.', 'success');
}

async function exportarPortafolioEvidenciasPDF(usuarioId, nombre, sesionId){
  if(!sb){ notify('No hay conexión con la nube para exportar.', 'error'); return; }
  notify('Generando Portafolio de Evidencias…', 'success');
  try {
    const [{data:usr},{data:port},{data:cals},{data:sesion},{data:asist},{data:intentos},{data:logros},{data:retosPart}] = await Promise.all([
      sb.from('usuarios').select('nombre,correo').eq('id', usuarioId).maybeSingle(),
      sb.from('portafolios').select('*').eq('usuario_id', usuarioId).eq('sesion_id', sesionId).maybeSingle(),
      sb.from('calificaciones').select('*').eq('usuario_id', usuarioId).eq('sesion_id', sesionId).order('creado_en',{ascending:false}),
      sb.from('sesiones_clase').select('nombre,codigo').eq('id', sesionId).maybeSingle(),
      sb.from('asistencia').select('fecha,presente').eq('usuario_id', usuarioId).eq('sesion_id', sesionId),
      sb.from('intentos_cuestionario').select('nota,completado_en,cuestionarios(titulo)').eq('usuario_id', usuarioId).eq('sesion_id', sesionId),
      sb.from('logros_desbloqueados').select('codigo_logro,desbloqueado_en').eq('usuario_id', usuarioId).eq('sesion_id', sesionId),
      sb.from('retos_participantes').select('valor_inicial,retos(titulo,meta_retorno,fecha_fin)').eq('usuario_id', usuarioId),
    ]);

    const nombreFinal = usr?.nombre || nombre;
    const valorActual = port?.valor_total;

    const bloqueBase = bloqueEstudiantePDF(nombreFinal, usr?.correo, port, cals||[], port?.lab_historial||[], asist||[]);

    const bloqueCuestionarios = `
      <div class="section"><div class="section-title" style="font-size:10pt;">Cuestionarios resueltos</div></div>
      ${(intentos&&intentos.length) ? `
        <table><tr><th>Cuestionario</th><th class="right">Nota</th><th>Fecha</th></tr>
          ${intentos.map(i=>`<tr><td>${i.cuestionarios?.titulo||'—'}</td><td class="right ${i.nota>=60?'g':'r'}">${i.nota??'—'}/100</td><td>${formatearFechaHora(i.completado_en)}</td></tr>`).join('')}
        </table>` : `<div class="empty">Todavía no ha resuelto ningún cuestionario.</div>`}`;

    const bloqueLogros = `
      <div class="section"><div class="section-title" style="font-size:10pt;">Logros desbloqueados</div></div>
      ${(logros&&logros.length) ? `
        <table><tr><th>Logro</th><th>Fecha</th></tr>
          ${logros.map(l=>`<tr><td>${CATALOGO_LOGROS[l.codigo_logro]?.titulo||l.codigo_logro}</td><td>${formatearFechaHora(l.desbloqueado_en)}</td></tr>`).join('')}
        </table>` : `<div class="empty">Todavía no ha desbloqueado ningún logro.</div>`}`;

    const bloqueRetos = `
      <div class="section"><div class="section-title" style="font-size:10pt;">Retos semanales</div></div>
      ${(retosPart&&retosPart.length) ? `
        <table><tr><th>Reto</th><th class="right">Meta</th><th class="right">Resultado</th></tr>
          ${retosPart.filter(r=>r.retos).map(r=>{
            const ret = valorActual!=null && r.valor_inicial>0 ? ((valorActual-r.valor_inicial)/r.valor_inicial)*100 : null;
            return `<tr><td>${r.retos.titulo}</td><td class="right">${r.retos.meta_retorno>=0?'+':''}${r.retos.meta_retorno}%</td><td class="right ${ret!=null&&ret>=r.retos.meta_retorno?'g':'r'}">${ret!=null?(ret>=0?'+':'')+ret.toFixed(2)+'%':'—'}</td></tr>`;
          }).join('')}
        </table>` : `<div class="empty">No ha participado en ningún reto todavía.</div>`}`;

    const bloqueEvolucion = `
      <div class="section"><div class="section-title" style="font-size:10pt;">Evolución del valor de cartera</div></div>
      ${graficaEvolucionSVGImpresion(port?.valor_historial)}`;

    const body = pdfHeader('Portafolio de Evidencias — ' + (sesion?.nombre||''))
      + bloqueBase
      + `<div style="page-break-before:always;"></div>`
      + bloqueEvolucion
      + bloqueCuestionarios
      + bloqueLogros
      + bloqueRetos
      + pdfFooter();
    openPrintWindow(body, `Portafolio de Evidencias — ${nombreFinal}`);
  } catch(e){
    notify('No se pudo generar el portafolio: ' + (e.message||e), 'error');
  }
}

async function exportarInformeEstudiantePDF(usuarioId, nombre, sesionId){
  if(!sb){ notify('No hay conexión con la nube para exportar.', 'error'); return; }
  notify('Generando informe…', 'success');
  try {
    const [{data: usr}, {data: port}, {data: cals}, {data: sesion}, {data: asist}] = await Promise.all([
      sb.from('usuarios').select('nombre,correo').eq('id', usuarioId).maybeSingle(),
      sb.from('portafolios').select('*').eq('usuario_id', usuarioId).eq('sesion_id', sesionId).maybeSingle(),
      sb.from('calificaciones').select('*').eq('usuario_id', usuarioId).eq('sesion_id', sesionId).order('creado_en',{ascending:false}),
      sb.from('sesiones_clase').select('nombre').eq('id', sesionId).maybeSingle(),
      sb.from('asistencia').select('fecha,presente').eq('usuario_id', usuarioId).eq('sesion_id', sesionId),
    ]);
    const nombreFinal = usr?.nombre || nombre;
    const body = pdfHeader(sesion?.nombre || 'Informe del estudiante')
      + bloqueEstudiantePDF(nombreFinal, usr?.correo, port, cals||[], port?.lab_historial||[], asist||[])
      + pdfFooter();
    openPrintWindow(body, `Informe — ${nombreFinal}`);
  } catch(e){
    notify('No se pudo generar el informe: ' + (e.message||e), 'error');
  }
}

// Informe de TODO el salón — un solo documento con cada estudiante en su
// propia sección, para el archivo del docente o para presentar resultados.
async function exportarInformeSalonPDF(){
  if(!sb || !currentUser || !currentUser.sesion_id){ notify('No hay sesión activa para exportar.', 'error'); return; }
  notify('Generando informe del salón…', 'success');
  try {
    const sesionId = currentUser.sesion_id;
    const [{data: sesion}, {data: estudiantes}, {data: ports}, {data: cals}, {data: asistRows}] = await Promise.all([
      sb.from('sesiones_clase').select('nombre,codigo').eq('id', sesionId).maybeSingle(),
      sb.from('usuarios').select('id,nombre,correo').eq('sesion_id', sesionId).eq('rol','estudiante').order('nombre'),
      sb.from('portafolios').select('*').eq('sesion_id', sesionId),
      sb.from('calificaciones').select('*').eq('sesion_id', sesionId).order('creado_en',{ascending:false}),
      sb.from('asistencia').select('usuario_id,fecha,presente').eq('sesion_id', sesionId),
    ]);
    if(!estudiantes || !estudiantes.length){ notify('Todavía no hay estudiantes registrados en esta sesión.', 'error'); return; }

    const portMap = {}; (ports||[]).forEach(p=>{ portMap[p.usuario_id]=p; });
    const calMap = {}; (cals||[]).forEach(c=>{ (calMap[c.usuario_id]=calMap[c.usuario_id]||[]).push(c); });
    const asistMap = {}; (asistRows||[]).forEach(a=>{ (asistMap[a.usuario_id]=asistMap[a.usuario_id]||[]).push(a); });

    const resumenFilas = estudiantes.map(e=>{
      const p = portMap[e.id];
      const retorno = p?.retorno_pct!=null ? Number(p.retorno_pct) : null;
      const asistE = asistMap[e.id]||[];
      const asistTxt = asistE.length ? `${asistE.filter(a=>a.presente).length}/${asistE.length}` : '—';
      return `<tr>
        <td>${e.nombre}</td>
        <td class="right">${p?.valor_total!=null?'$'+Number(p.valor_total).toLocaleString('es-PA',{minimumFractionDigits:0,maximumFractionDigits:0}):'—'}</td>
        <td class="right ${retorno===null?'':(retorno>=0?'g':'r')}">${retorno!==null?(retorno>=0?'+':'')+retorno.toFixed(1)+'%':'—'}</td>
        <td class="right">${p?.num_operaciones??0}</td>
        <td class="right">${asistTxt}</td>
        <td class="right">${(calMap[e.id]||[]).length}</td>
      </tr>`;
    }).join('');

    const detalle = estudiantes.map((e,i)=>
      `<div style="${i>0?'page-break-before:always;':''}">` +
      bloqueEstudiantePDF(e.nombre, e.correo, portMap[e.id], calMap[e.id]||[], portMap[e.id]?.lab_historial||[], asistMap[e.id]||[]) +
      `</div>`
    ).join('');

    const body = pdfHeader(sesion?.nombre || 'Informe del salón')
      + `<div class="section"><div class="section-title">Resumen general</div><div class="section-sub">${estudiantes.length} estudiante(s) · Código de sesión: ${sesion?.codigo||'—'}</div></div>`
      + `<table><tr><th>Estudiante</th><th class="right">Valor cartera</th><th class="right">Retorno</th><th class="right">Operac.</th><th class="right">Asistencia</th><th class="right">Calificaciones</th></tr>${resumenFilas}</table>`
      + `<div style="page-break-before:always;"></div>`
      + detalle
      + pdfFooter();
    openPrintWindow(body, `Informe del salón — ${sesion?.nombre||''}`);
  } catch(e){
    notify('No se pudo generar el informe: ' + (e.message||e), 'error');
  }
}

// ── Página "Calificaciones" (nav principal) — adaptable por rol ──
// Botón "Exportar" de la página Calificaciones: cada rol exporta lo suyo.
function exportarDesdeCalificaciones(){
  if(!currentUser) return;
  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  if(esDocente){
    exportarInformeSalonPDF();
  } else {
    exportarInformeEstudiantePDF(currentUser.usuario_id, currentUser.nombre, currentUser.sesion_id);
  }
}

// Guarda las calificaciones tal como llegan de la nube en la página
// "Calificaciones" (vista docente), para que el botón de editar de ahí
// pueda encontrarlas sin tener que volver a consultarlas.
let calPageDataMap = {};
function editarDesdeCalPage(calId, nombreEst){
  const cal = calPageDataMap[calId];
  if(!cal){ notify('No se encontró la calificación.', 'error'); return; }
  abrirModalCalificar(cal.usuario_id, nombreEst, cal.sesion_id, cal);
}

// ══════════════════════════════════════════════════
// LOGROS — insignias por hitos alcanzados
// ══════════════════════════════════════════════════
const CATALOGO_LOGROS = {
  primera_operacion:     { icono:'ti-flag',               titulo:'Primera operación',        desc:'Registraste tu primera compra o venta.' },
  diez_operaciones:      { icono:'ti-repeat',              titulo:'Operador activo',          desc:'Registraste 10 operaciones o más.' },
  cartera_diversificada: { icono:'ti-chart-pie',           titulo:'Cartera diversificada',     desc:'Tienes posiciones abiertas en 3 activos distintos o más.' },
  retorno_positivo:      { icono:'ti-trending-up',         titulo:'En números verdes',         desc:'Tu cartera alcanzó un retorno positivo.' },
  explorador_mercados:   { icono:'ti-world',               titulo:'Explorador de mercados',    desc:'Operaste en acciones, bonos y divisas.' },
  primer_cuestionario:   { icono:'ti-list-check',          titulo:'Primer cuestionario',       desc:'Resolviste tu primer cuestionario.' },
  cuestionario_perfecto: { icono:'ti-star',                titulo:'Cuestionario perfecto',     desc:'Obtuviste 100 de 100 en un cuestionario.' },
  meta_laboratorio:      { icono:'ti-target-arrow',        titulo:'Meta cumplida',             desc:'Completaste una sesión de Laboratorio alcanzando tu meta.' },
};

let _logrosDesbloqueadosCache = null;

async function cargarLogrosDesbloqueados(forzar){
  if(!sb || !currentUser || !currentUser.usuario_id || !currentUser.sesion_id) return new Set();
  if(_logrosDesbloqueadosCache && !forzar) return _logrosDesbloqueadosCache;
  try {
    const { data } = await sb.from('logros_desbloqueados').select('codigo_logro').eq('usuario_id', currentUser.usuario_id).eq('sesion_id', currentUser.sesion_id);
    _logrosDesbloqueadosCache = new Set((data||[]).map(d=>d.codigo_logro));
  } catch(e){ _logrosDesbloqueadosCache = new Set(); }
  return _logrosDesbloqueadosCache;
}

async function desbloquearLogro(codigo){
  if(!sb || !currentUser || !currentUser.usuario_id || !currentUser.sesion_id || guestMode) return;
  if(!CATALOGO_LOGROS[codigo]) return;
  const cache = await cargarLogrosDesbloqueados();
  if(cache.has(codigo)) return; // ya lo tenía, no repetir el aviso
  try {
    const { error } = await sb.from('logros_desbloqueados').insert({
      usuario_id: currentUser.usuario_id, sesion_id: currentUser.sesion_id, codigo_logro: codigo,
    });
    if(error){ if(error.code!=='23505') console.warn('No se pudo registrar el logro:', error.message); return; }
    cache.add(codigo);
    mostrarCelebracionLogro(codigo);
  } catch(e){ /* silencioso: un logro que no se pudo guardar no debe interrumpir nada más */ }
}

function mostrarCelebracionLogro(codigo){
  const l = CATALOGO_LOGROS[codigo];
  if(!l) return;
  // Contenedor compartido: cada nueva celebración se apila debajo de la
  // anterior en vez de superponerse todas en el mismo punto de la pantalla.
  let stack = document.getElementById('logro-toast-stack');
  if(!stack){
    stack = document.createElement('div');
    stack.id = 'logro-toast-stack';
    stack.style.cssText = 'position:fixed;top:70px;right:20px;z-index:4000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.style.cssText = 'background:var(--c1);border:1px solid var(--gold);border-radius:var(--r2);padding:14px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:320px;animation:logro-entrada .35s ease;pointer-events:auto;';
  el.innerHTML = `
    <div style="width:42px;height:42px;border-radius:50%;background:rgba(212,175,55,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <i class="ti ${l.icono}" style="font-size:20px;color:var(--gold);"></i>
    </div>
    <div>
      <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.04em;font-weight:700;">Logro desbloqueado</div>
      <div style="font-weight:700;font-size:13.5px;">${l.titulo}</div>
      <div style="font-size:11.5px;color:var(--t3);">${l.desc}</div>
    </div>`;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 400); }, 5000);
}

// Revisa los logros relacionados con el mercado, con lo que ya está en
// memoria (sin consultas extra a la nube). Se llama junto con cada sync.
function verificarLogrosTrading(){
  if(!currentUser || !currentUser.usuario_id || guestMode) return;
  if(txHistory.length >= 1) desbloquearLogro('primera_operacion');
  if(txHistory.length >= 10) desbloquearLogro('diez_operaciones');
  const activosAbiertos = new Set(portfolio.map(p=>p.id+'_'+p.type));
  if(activosAbiertos.size >= 3) desbloquearLogro('cartera_diversificada');
  const valorPosiciones = portfolio.reduce((s,p)=>s+((p.currentPrice||p.buyPrice||0)*p.qty), 0);
  if((capital + valorPosiciones) > INITIAL_CAPITAL) desbloquearLogro('retorno_positivo');
  const tiposOperados = new Set(portfolio.map(p=>p.type).concat(txHistory.map(t=>t.type)));
  if(['accion','bono','divisa'].every(t=>tiposOperados.has(t))) desbloquearLogro('explorador_mercados');
}

// Tarjeta compacta para el Panel de Inicio: todos los logros, desbloqueados
// a color y con fecha, los que faltan en gris con su criterio.
async function tarjetaLogrosHTML(){
  const desbloqueados = await cargarLogrosDesbloqueados();
  const codigos = Object.keys(CATALOGO_LOGROS);
  return `
    <div class="card">
      <div class="card-title"><i class="ti ti-award" style="color:var(--gold);"></i> Mis logros (${desbloqueados.size}/${codigos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;margin-top:6px;">
        ${codigos.map(cod => {
          const l = CATALOGO_LOGROS[cod];
          const logrado = desbloqueados.has(cod);
          return `<div title="${l.desc}" style="text-align:center;padding:10px 4px;border-radius:var(--r);${logrado?'background:rgba(212,175,55,.1);':'opacity:.4;'}">
            <div style="width:38px;height:38px;margin:0 auto 6px;border-radius:50%;background:${logrado?'rgba(212,175,55,.18)':'var(--c3)'};display:flex;align-items:center;justify-content:center;">
              <i class="ti ${l.icono}" style="font-size:17px;color:${logrado?'var(--gold)':'var(--t3)'};"></i>
            </div>
            <div style="font-size:10px;line-height:1.25;color:${logrado?'var(--t1)':'var(--t3)'};">${l.titulo}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// Página dedicada "Logros" — el mismo catálogo, ahora con la fecha exacta
// de cada insignia y su descripción completa a la vista, no solo el ícono.
async function renderLogrosPage(){
  const cont = document.getElementById('logros-contenido');
  const sub = document.getElementById('logros-page-sub');
  if(!cont || !currentUser) return;

  if(guestMode){
    sub.textContent = 'El modo de prueba no guarda logros reales.';
    cont.innerHTML = '<div class="card"><div class="auth-hint">Crea una cuenta real para empezar a desbloquear logros.</div></div>';
    return;
  }

  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  if(esDocente){
    sub.textContent = 'Los logros son individuales de cada estudiante.';
    cont.innerHTML = `<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.6;">Los logros los desbloquean tus estudiantes a medida que usan el simulador. Para ver los de alguien en particular, entra a <b>Modo Profesor</b> y abre el detalle de ese estudiante con el ícono del ojo.</div><button class="btn" style="margin-top:12px;" onclick="goPage('profesor')"><i class="ti ti-school"></i> Ir a Modo Profesor</button></div>`;
    return;
  }

  sub.textContent = 'Insignias que vas desbloqueando mientras usas el simulador.';
  cont.innerHTML = '<div class="auth-hint">Cargando…</div>';
  try {
    const { data, error } = await sb.from('logros_desbloqueados').select('codigo_logro,desbloqueado_en').eq('usuario_id', currentUser.usuario_id).eq('sesion_id', currentUser.sesion_id);
    if(error) throw error;
    const fechaPorCodigo = {}; (data||[]).forEach(d=>{ fechaPorCodigo[d.codigo_logro] = d.desbloqueado_en; });
    const codigos = Object.keys(CATALOGO_LOGROS);
    const pendientes = codigos.filter(c => !fechaPorCodigo[c]);
    const pctGeneral = Math.round(((codigos.length - pendientes.length) / codigos.length) * 100);
    cont.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;font-size:13px;">Progreso general</div>
          <div class="mono" style="font-size:13px;color:var(--gold);">${codigos.length - pendientes.length}/${codigos.length}</div>
        </div>
        <div style="height:8px;background:var(--c3);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pctGeneral}%;background:var(--gold);transition:width .4s;"></div>
        </div>
        ${pendientes.length ? `<div style="font-size:11.5px;color:var(--t3);margin-top:8px;"><i class="ti ti-target-arrow" style="color:var(--gold);"></i> Siguiente: <b style="color:var(--t1);">${CATALOGO_LOGROS[pendientes[0]].titulo}</b> — ${CATALOGO_LOGROS[pendientes[0]].desc}</div>` : `<div style="font-size:11.5px;color:var(--green);margin-top:8px;"><i class="ti ti-confetti"></i> ¡Desbloqueaste todos los logros!</div>`}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn" style="background:rgba(212,175,55,.12);color:var(--gold);border:1px solid rgba(212,175,55,.3);min-height:44px;" onclick="exportarPortafolioEvidenciasPDF('${currentUser.usuario_id}','${currentUser.nombre.replace(/'/g,"\\'")}','${currentUser.sesion_id}')"><i class="ti ti-folder-star"></i> Exportar mi Portafolio de Evidencias</button>
        <button class="btn" style="background:rgba(0,196,255,.12);color:var(--accent2);border:1px solid rgba(0,196,255,.3);min-height:44px;" onclick="abrirInsigniaDesempeno()"><i class="ti ti-mood-smile"></i> Ver mi Tarjeta de Desempeño</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">
      ${codigos.map(cod => {
        const l = CATALOGO_LOGROS[cod];
        const logrado = !!fechaPorCodigo[cod];
        return `<div class="card" style="${logrado?'':'opacity:.55;'}">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="width:44px;height:44px;flex-shrink:0;border-radius:50%;background:${logrado?'rgba(212,175,55,.18)':'var(--c3)'};display:flex;align-items:center;justify-content:center;">
              <i class="ti ${l.icono}" style="font-size:20px;color:${logrado?'var(--gold)':'var(--t3)'};"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:14px;">${l.titulo}</div>
              <div style="font-size:10.5px;color:${logrado?'var(--gold)':'var(--t3)'};">${logrado ? 'Desbloqueado · '+formatearFechaHora(fechaPorCodigo[cod]) : 'Bloqueado'}</div>
            </div>
          </div>
          <div style="font-size:12.5px;color:var(--t2);">${l.desc}</div>
          ${logrado ? `<button class="btn btn-sm" style="width:100%;margin-top:10px;" onclick="compartirLogro('${cod}')"><i class="ti ti-share"></i> Compartir</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudieron cargar tus logros: '+(e.message||e)+'</div>';
  }
}

// ══════════════════════════════════════════════════
// PANEL DE INICIO — resumen de un vistazo al entrar
// ══════════════════════════════════════════════════
// Mini-gráfica de tendencia para las tarjetas del Panel de Inicio — reusa
// navHistory, que ya se registra localmente en cada tick, sin pedir nada
// nuevo a la nube. Puramente visual: la trayectoria de un vistazo, no
// solo el número final.
function miniSparklineSVG(valores){
  if(!valores || valores.length < 2) return '';
  const w = 120, h = 32, pad = 2;
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = (max - min) || 1;
  const xStep = (w - pad*2) / (valores.length - 1);
  const puntos = valores.map((v,i) => {
    const x = pad + i*xStep;
    const y = h - pad - ((v - min) / rango) * (h - pad*2);
    return [x,y];
  });
  const linea = puntos.map(([x,y],i) => (i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
  const subio = valores[valores.length-1] >= valores[0];
  const color = subio ? 'var(--green)' : 'var(--red)';
  return `<svg viewBox="0 0 ${w} ${h}" style="width:70px;height:20px;display:block;margin-top:4px;"><path d="${linea}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function renderInicioPage(){
  const titulo = document.getElementById('inicio-titulo');
  const sub = document.getElementById('inicio-sub');
  const cont = document.getElementById('inicio-contenido');
  if(!titulo || !cont) return;

  if(!currentUser){ return; }

  const primerNombre = (currentUser.nombre||'').split(' ')[0] || 'de vuelta';
  titulo.textContent = `Hola, ${primerNombre}`;

  if(guestMode){
    sub.textContent = 'Estás en modo de prueba, sin cuenta real.';
    cont.innerHTML = `
      <div class="card">
        <div class="card-title"><i class="ti ti-flask" style="color:var(--accent2);"></i> Modo de prueba</div>
        <div style="font-size:13px;color:var(--t2);line-height:1.6;">Puedes explorar todo el simulador libremente, pero nada de lo que hagas aquí se guarda en una cuenta real. Cuando quieras, cierra sesión y crea una cuenta para conservar tu progreso.</div>
        <button class="btn" style="margin-top:12px;" onclick="goPage('mercado')"><i class="ti ti-chart-candle"></i> Ir al mercado</button>
      </div>`;
    return;
  }

  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';

  if(!currentUser.sesion_id){
    sub.textContent = 'Todavía no perteneces a ninguna sesión de clase.';
    cont.innerHTML = `<div id="mi-cuenta-card"></div>`;
    renderMiCuenta(document.getElementById('mi-cuenta-card'));
    return;
  }

  sub.textContent = currentUser.sesion_nombre ? `Sesión: ${currentUser.sesion_nombre}` : '';
  cont.innerHTML = '<div class="auth-hint">Cargando tu resumen…</div>';

  try {
    if(esDocente){
      const sesionId = currentUser.sesion_id;
      const [{data: estudiantes}, {data: ports}, {data: cuest}, {data: anuncios}] = await Promise.all([
        sb.from('usuarios').select('id').eq('sesion_id', sesionId).eq('rol','estudiante'),
        sb.from('portafolios').select('retorno_pct').eq('sesion_id', sesionId),
        sb.from('cuestionarios').select('id,titulo,activo').eq('sesion_id', sesionId).order('creado_en',{ascending:false}).limit(5),
        sb.from('anuncios').select('titulo,creado_en').eq('sesion_id', sesionId).order('creado_en',{ascending:false}).limit(3),
      ]);
      const numEst = (estudiantes||[]).length;
      const retornos = (ports||[]).map(p=>p.retorno_pct).filter(r=>r!=null);
      const promedio = retornos.length ? (retornos.reduce((a,b)=>a+Number(b),0)/retornos.length).toFixed(1) : null;
      const cuestActivos = (cuest||[]).filter(c=>c.activo!==false).length;

      cont.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Estudiantes</div>
            <div style="font-size:22px;font-weight:700;">${numEst}</div>
          </div>
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Retorno promedio</div>
            <div style="font-size:22px;font-weight:700;color:${promedio===null?'var(--t3)':(promedio>=0?'var(--green)':'var(--red)')};">${promedio!==null?(promedio>=0?'+':'')+promedio+'%':'—'}</div>
          </div>
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Cuestionarios activos</div>
            <div style="font-size:22px;font-weight:700;">${cuestActivos}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div class="card">
            <div class="card-title"><i class="ti ti-school" style="color:var(--accent2);"></i> Accesos rápidos</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn" onclick="goPage('profesor')"><i class="ti ti-users-group"></i> Ver a mis estudiantes</button>
              <button class="btn" onclick="goPage('cuestionarios')"><i class="ti ti-list-check"></i> Cuestionarios</button>
              <button class="btn" onclick="mostrarNotificaciones()"><i class="ti ti-speakerphone"></i> Publicar un anuncio</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title"><i class="ti ti-speakerphone" style="color:var(--accent2);"></i> Tus últimos anuncios</div>
            ${(anuncios&&anuncios.length) ? anuncios.map(a=>`<div style="padding:6px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">${a.titulo}<div style="color:var(--t3);font-size:10.5px;">${formatearFechaHora(a.creado_en)}</div></div>`).join('') : '<div class="auth-hint">Todavía no has publicado ningún anuncio.</div>'}
          </div>
        </div>
        <div id="mi-cuenta-card" style="margin-top:16px;"></div>`;
      renderMiCuenta(document.getElementById('mi-cuenta-card'));
    } else {
      const sesionId = currentUser.sesion_id;
      const valorPosiciones = portfolio.reduce((s,p)=>s+((p.currentPrice||p.buyPrice||0)*p.qty), 0);
      const valorTotal = capital + valorPosiciones;
      const retornoPct = ((valorTotal - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

      const [{data: cuestActivos}, {data: misIntentos}, {data: anuncios}, {data: misCals}, {data: sesionInfo}] = await Promise.all([
        sb.from('cuestionarios').select('id,titulo').eq('sesion_id', sesionId).eq('activo', true),
        sb.from('intentos_cuestionario').select('cuestionario_id').eq('usuario_id', currentUser.usuario_id),
        sb.from('anuncios').select('titulo,creado_en').eq('sesion_id', sesionId).order('creado_en',{ascending:false}).limit(3),
        sb.from('calificaciones').select('titulo,nota_general,creado_en').eq('usuario_id', currentUser.usuario_id).order('creado_en',{ascending:false}).limit(3),
        sb.from('sesiones_clase').select('mostrar_ranking').eq('id', sesionId).maybeSingle(),
      ]);
      const idsResueltos = new Set((misIntentos||[]).map(i=>i.cuestionario_id));
      const pendientes = (cuestActivos||[]).filter(c=>!idsResueltos.has(c.id));

      let rankingTxt = '';
      if(sesionInfo?.mostrar_ranking){
        const { data: ports } = await sb.from('portafolios').select('usuario_id,retorno_pct').eq('sesion_id', sesionId).order('retorno_pct',{ascending:false});
        if(ports && ports.length){
          const puesto = ports.findIndex(p=>p.usuario_id===currentUser.usuario_id) + 1;
          if(puesto>0) rankingTxt = `Estás en el puesto <b>${puesto}</b> de ${ports.length}.`;
        }
      }

      // Guía de primeros pasos: mezcla hitos reales (logros ya guardados en
      // la nube) con visitas simples a ciertas páginas (guardadas solo en
      // este navegador). Se oculta sola una vez completados los cuatro.
      const logrosSet = await cargarLogrosDesbloqueados();
      const pasos = [
        { hecho: localStorage.getItem('cl_visito_mercado_'+sesionId)==='1', texto:'Explora el Mercado', pagina:'mercado', icono:'ti-chart-candle' },
        { hecho: logrosSet.has('primera_operacion'), texto:'Realiza tu primera operación', pagina:'mercado', icono:'ti-flag' },
        { hecho: logrosSet.has('primer_cuestionario'), texto:'Resuelve tu primer cuestionario', pagina:'cuestionarios', icono:'ti-list-check' },
        { hecho: localStorage.getItem('cl_visito_calificaciones_'+sesionId)==='1', texto:'Revisa tus calificaciones', pagina:'calificaciones', icono:'ti-certificate' },
      ];
      const todosHechos = pasos.every(p=>p.hecho);
      const guiaHTML = todosHechos ? '' : `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><i class="ti ti-map-2" style="color:var(--accent2);"></i> Primeros pasos</div>
          <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
            ${pasos.map(p => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--c3);${p.hecho?'':'cursor:pointer;'}" ${p.hecho?'':`onclick="goPage('${p.pagina}')"`}>
                <div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${p.hecho?'var(--green)':'var(--c3)'};">
                  <i class="ti ${p.hecho?'ti-check':p.icono}" style="font-size:12px;color:${p.hecho?'#04342c':'var(--t3)'};"></i>
                </div>
                <span style="font-size:13px;color:${p.hecho?'var(--t3)':'var(--t1)'};text-decoration:${p.hecho?'line-through':'none'};">${p.texto}</span>
              </div>`).join('')}
          </div>
        </div>`;

      cont.innerHTML = guiaHTML + `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Valor de cartera</div>
            <div style="font-size:22px;font-weight:700;">$${valorTotal.toLocaleString('es-PA',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
            ${miniSparklineSVG(navHistory.slice(-30).map(p=>p.value))}
          </div>
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Racha de días activos</div>
            <div style="font-size:22px;font-weight:700;color:var(--gold);"><i class="ti ti-flame" style="font-size:18px;"></i> ${rachaActividad} día${rachaActividad===1?'':'s'}</div>
            <div style="font-size:10px;color:var(--t3);margin-top:4px;">${rachaActividad>=3?'¡Sigue así!':'Entra mañana para sumar otro día'}</div>
          </div>
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Retorno</div>
            <div style="font-size:22px;font-weight:700;color:${retornoPct>=0?'var(--green)':'var(--red)'};">${retornoPct>=0?'+':''}${retornoPct.toFixed(2)}%</div>
            ${miniSparklineSVG(navHistory.slice(-30).map(p=>p.value))}
          </div>
          <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
            <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Cuestionarios pendientes</div>
            <div style="font-size:22px;font-weight:700;">${pendientes.length}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px;position:relative;">
          <button class="btn btn-sm" onclick="alternarMenuHerramientasInicio(event)"><i class="ti ti-tools"></i> Herramientas <i class="ti ti-chevron-down" style="font-size:11px;"></i></button>
          <div id="menu-herramientas-inicio" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--c1);border:1px solid var(--c4);border-radius:var(--r2);box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:200;min-width:230px;padding:6px;">
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:2px;background:rgba(0,196,255,.1);color:var(--accent2);" onclick="abrirAsesorCartera();cerrarMenuHerramientasInicio();"><i class="ti ti-bulb"></i> Asesor de Cartera</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:2px;" onclick="abrirReplayCartera();cerrarMenuHerramientasInicio();"><i class="ti ti-player-play"></i> Replay de mi Cartera</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:2px;" onclick="abrirDiarioTrading();cerrarMenuHerramientasInicio();"><i class="ti ti-notebook"></i> Diario de Trading</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:2px;" onclick="abrirMetaPersonal();cerrarMenuHerramientasInicio();"><i class="ti ti-flag"></i> Meta Personal</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;margin-bottom:2px;background:rgba(212,175,55,.1);color:var(--gold);" onclick="abrirInsigniaDesempeno();cerrarMenuHerramientasInicio();"><i class="ti ti-mood-smile"></i> Tarjeta de Desempeño</button>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;" onclick="abrirComparadorIndice();cerrarMenuHerramientasInicio();"><i class="ti ti-scale"></i> Yo vs. el Mercado</button>
          </div>
        </div>
        ${rankingTxt ? `<div class="info-box-app" style="background:rgba(0,196,255,.08);border:1px solid var(--accent2);border-radius:var(--r);padding:10px 14px;font-size:13px;margin-bottom:16px;"><i class="ti ti-trophy" style="color:var(--accent2);margin-right:6px;"></i>${rankingTxt}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div class="card">
            <div class="card-title"><i class="ti ti-list-check" style="color:var(--accent2);"></i> Cuestionarios pendientes</div>
            ${pendientes.length ? pendientes.slice(0,4).map(c=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">
                <span>${c.titulo}</span>
                <button class="btn btn-sm" onclick="goPage('cuestionarios')">Resolver</button>
              </div>`).join('') : '<div class="auth-hint">No tienes cuestionarios pendientes por ahora.</div>'}
          </div>
          <div class="card">
            <div class="card-title"><i class="ti ti-speakerphone" style="color:var(--accent2);"></i> Anuncios recientes</div>
            ${(anuncios&&anuncios.length) ? anuncios.map(a=>`<div style="padding:6px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">${a.titulo}<div style="color:var(--t3);font-size:10.5px;">${formatearFechaHora(a.creado_en)}</div></div>`).join('') : '<div class="auth-hint">Sin anuncios todavía.</div>'}
          </div>
          <div class="card">
            <div class="card-title"><i class="ti ti-certificate" style="color:var(--accent2);"></i> Calificaciones recientes</div>
            ${(misCals&&misCals.length) ? misCals.map(c=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--c3);font-size:12.5px;"><span>${c.titulo}</span><span class="grade-pill ${nivelCalificacion(c.nota_general)}">${c.nota_general??'—'}</span></div>`).join('') : '<div class="auth-hint">Sin calificaciones todavía.</div>'}
          </div>
        </div>
        <div style="margin-top:14px;">${await tarjetaLogrosHTML()}</div>
        <div id="mi-cuenta-card" style="margin-top:16px;"></div>`;
      renderMiCuenta(document.getElementById('mi-cuenta-card'));
    }
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudo cargar tu resumen: '+(e.message||e)+'</div>';
  }
}

// ══════════════════════════════════════════════════
// CUESTIONARIOS — banco de preguntas de opción múltiple
// ══════════════════════════════════════════════════
let cuestionariosCache = {};

function editarCuestionarioDesdeCache(id){
  const c = cuestionariosCache[id];
  if(!c){ notify('No se encontró el cuestionario.', 'error'); return; }
  abrirEditorCuestionario(c);
}

async function renderCuestionariosPage(){
  if(!currentUser || guestMode || !currentUser.sesion_id){
    document.getElementById('cuest-lista').innerHTML = '';
    document.getElementById('cuest-empty').style.display = 'block';
    return;
  }
  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  document.getElementById('cuest-btn-nuevo').style.display = esDocente ? '' : 'none';
  document.getElementById('cuest-page-sub').textContent = currentUser.sesion_nombre
    ? (esDocente ? `Cuestionarios de: ${currentUser.sesion_nombre}` : `Sesión: ${currentUser.sesion_nombre}`)
    : 'Cuestionarios de opción múltiple.';

  const cont = document.getElementById('cuest-lista');
  const empty = document.getElementById('cuest-empty');
  cont.innerHTML = '<div class="auth-hint">Cargando…</div>'; empty.style.display='none';
  try {
    const { data: cuestionarios, error } = await sb.from('cuestionarios').select('*').eq('sesion_id', currentUser.sesion_id).order('creado_en',{ascending:false});
    if(error) throw error;
    if(!cuestionarios || !cuestionarios.length){ cont.innerHTML=''; empty.style.display='block'; return; }
    cuestionariosCache = {}; cuestionarios.forEach(c=>{ cuestionariosCache[c.id] = c; });

    let misIntentos = {};
    if(!esDocente){
      const { data: intentos } = await sb.from('intentos_cuestionario').select('cuestionario_id,nota').eq('usuario_id', currentUser.usuario_id);
      (intentos||[]).forEach(i=>{ misIntentos[i.cuestionario_id] = i.nota; });
    }

    let conteoPreguntas = {};
    const { data: todasPreguntas } = await sb.from('preguntas').select('id,cuestionario_id').in('cuestionario_id', cuestionarios.map(c=>c.id));
    (todasPreguntas||[]).forEach(p=>{ conteoPreguntas[p.cuestionario_id] = (conteoPreguntas[p.cuestionario_id]||0) + 1; });

    cont.innerHTML = cuestionarios.map(c => {
      const numPreguntas = conteoPreguntas[c.id] || 0;
      const yaResuelto = misIntentos[c.id] !== undefined;
      return `<div style="padding:14px;border:1px solid var(--c4);border-radius:var(--r2);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14.5px;">${c.titulo} ${c.activo===false?'<span class="nav-badge">Inactivo</span>':''}</div>
          ${c.descripcion ? `<div style="font-size:12.5px;color:var(--t2);margin-top:3px;">${c.descripcion}</div>` : ''}
          <div style="font-size:11px;color:var(--t3);margin-top:5px;">${numPreguntas} pregunta${numPreguntas===1?'':'s'}${c.tiempo_limite_minutos ? ` · <i class="ti ti-clock" style="font-size:10px;"></i> ${c.tiempo_limite_minutos} min` : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${esDocente
            ? `<button class="btn btn-sm" onclick="verResultadosCuestionario('${c.id}','${c.titulo.replace(/'/g,"\\'")}')"><i class="ti ti-chart-bar"></i> Resultados</button>
               <button class="btn btn-sm" onclick="editarCuestionarioDesdeCache('${c.id}')"><i class="ti ti-pencil"></i> Editar</button>
               <button class="btn btn-sm" onclick="abrirDuplicarCuestionario('${c.id}')" title="Duplicar a otra sesión"><i class="ti ti-copy"></i></button>
               <button class="btn btn-sm" onclick="alternarActivoCuestionario('${c.id}',${c.activo===false})">${c.activo===false?'Activar':'Desactivar'}</button>
               <button class="btn btn-sm" style="color:var(--red);" onclick="borrarCuestionario('${c.id}')"><i class="ti ti-trash"></i></button>`
            : (yaResuelto
              ? `<span class="grade-pill ${nivelCalificacion(misIntentos[c.id])}">${misIntentos[c.id]}/100</span>`
              : (c.activo===false ? '<span class="nav-badge">No disponible</span>' : `<button class="btn btn-sm" onclick="tomarCuestionario('${c.id}','${c.titulo.replace(/'/g,"\\'")}')"><i class="ti ti-player-play"></i> Resolver</button>`))}
        </div>
      </div>`;
    }).join('');
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }
}

// ── Construcción de un cuestionario nuevo (docente) ──
// Plantillas de ejemplo, listas para usar o personalizar. No se guardan en
// la nube hasta que el docente las guarda como cuestionario propio — solo
// llenan el editor con contenido de partida para que sea fácil entender
// cómo se arma uno, sin tener que empezar desde cero.
// Plantillas rápidas para el modal de calificar: solo llenan categoría y
// título, la nota y el comentario los pone el docente para cada estudiante.
const PLANTILLAS_RUBRICA = [
  { categoria: 'Examen', titulo: 'Examen parcial' },
  { categoria: 'Examen', titulo: 'Examen final' },
  { categoria: 'Participación', titulo: 'Participación en clase' },
  { categoria: 'Rentabilidad', titulo: 'Desempeño de cartera — corte del mes' },
  { categoria: 'Gestión de riesgo', titulo: 'Diversificación y manejo de riesgo' },
  { categoria: 'Otro', titulo: 'Cumplimiento del Laboratorio' },
];

const PLANTILLAS_CUESTIONARIOS = [
  {
    titulo: 'Repaso: Mercado de Acciones',
    descripcion: 'Conceptos básicos de renta variable, riesgo y diversificación.',
    preguntas: [
      { texto: '¿Qué diferencia a una acción de un bono?', opciones: ['Es un instrumento de renta variable, no de deuda','Ambos son exactamente lo mismo','Un bono nunca paga intereses','Una acción siempre garantiza ganancias'], correcta: 0 },
      { texto: '¿Qué mide el ratio Sharpe?', opciones: ['El precio de una acción','El retorno obtenido por cada unidad de riesgo asumida','La inflación anual','El tipo de cambio'], correcta: 1 },
      { texto: '¿Por qué se recomienda diversificar una cartera?', opciones: ['Para aumentar las comisiones','Para reducir el número de operaciones','Para reducir el riesgo combinando activos de distintos sectores','No tiene ningún efecto real'], correcta: 2 },
      { texto: '¿Qué mide el Valor en Riesgo (VaR) al 95%?', opciones: ['La ganancia mínima garantizada','El precio justo de una acción','El número de acciones en circulación','La pérdida máxima esperada con 95% de confianza'], correcta: 3 },
    ],
  },
  {
    titulo: 'Repaso: Mercado de Bonos',
    descripcion: 'Precios, rendimiento y duración de instrumentos de renta fija.',
    preguntas: [
      { texto: '¿Qué relación existe entre el precio de un bono y la tasa de interés de mercado?', opciones: ['Relación inversa: si sube la tasa, baja el precio','Relación directa: suben juntos','No existe ninguna relación','Depende únicamente del emisor'], correcta: 0 },
      { texto: '¿Qué mide la duración de un bono?', opciones: ['El tiempo que tarda en emitirse','La sensibilidad del precio ante cambios en la tasa de interés','El monto exacto del cupón','El número de inversionistas que lo poseen'], correcta: 1 },
      { texto: '¿Qué es el rendimiento al vencimiento (YTM)?', opciones: ['El precio de emisión del bono','El valor nominal del bono','El retorno total si se mantiene el bono hasta su vencimiento','La tasa de inflación del país emisor'], correcta: 2 },
      { texto: '¿Por qué un bono corporativo suele rendir más que uno soberano de plazo similar?', opciones: ['Porque son más baratos de comprar','Porque pagan en otra moneda','No hay ninguna diferencia real','Por el mayor riesgo de crédito del emisor'], correcta: 3 },
    ],
  },
  {
    titulo: 'Repaso: Mercado de Divisas',
    descripcion: 'Tipo de cambio, riesgo país e indicadores macroeconómicos.',
    preguntas: [
      { texto: '¿Qué significa que una moneda se "aprecie"?', opciones: ['Que gana valor frente a otra moneda','Que pierde valor frente a otra moneda','Que deja de cotizarse en el mercado','Que se elimina del sistema financiero'], correcta: 0 },
      { texto: '¿Qué mide el riesgo país?', opciones: ['El precio del petróleo','La percepción de estabilidad económica y política de un país','La cantidad de bancos que operan ahí','El tamaño del territorio nacional'], correcta: 1 },
      { texto: '¿Cuál de estos factores afecta más directamente el tipo de cambio?', opciones: ['El color de la bandera del país','El número de días feriados','El diferencial de tasas de interés entre países','El clima de la región'], correcta: 2 },
      { texto: 'En un par de divisas como USD/EUR, ¿qué representa la primera moneda?', opciones: ['La moneda cotizada','Es irrelevante cuál va primero','Siempre representa a la moneda más fuerte','La moneda base'], correcta: 3 },
    ],
  },
  {
    titulo: 'Gestión de Riesgo y Rentabilidad',
    descripcion: 'Conceptos generales que aplican a los tres mercados del simulador.',
    preguntas: [
      { texto: '¿Qué es el capital inicial en el simulador?', opciones: ['El monto virtual con el que un estudiante comienza a operar','Una comisión que se cobra por cada operación','El valor de una sola acción','El límite máximo de pérdida permitido'], correcta: 0 },
      { texto: '¿Qué indica un retorno negativo en la cartera?', opciones: ['Que la cuenta fue bloqueada','Que el valor actual es menor al capital inicial','Que nunca se ha operado','Que el mercado está cerrado'], correcta: 1 },
      { texto: '¿Qué estrategia reduce mejor el riesgo de una cartera concentrada en un solo activo?', opciones: ['Comprar más del mismo activo','Vender todo y dejar de operar','Diversificar entre acciones, bonos y divisas','Aumentar el apalancamiento'], correcta: 2 },
      { texto: '¿Para qué sirve el Laboratorio dentro de CapitalLab?', opciones: ['Para ver noticias del mercado','Para calificar exámenes','Para cambiar de sesión de clase','Para practicar una estrategia bajo un horizonte y una meta definidos'], correcta: 3 },
    ],
  },
];

function abrirEditorCuestionario(cuestionarioExistente){
  if(!currentUser || !currentUser.sesion_id) return;
  const esEdicion = !!cuestionarioExistente;
  let preguntas = [{ texto:'', opciones:['',''], correcta:0 }];
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:560px;">
    <h3>${esEdicion ? 'Editar cuestionario' : 'Nuevo cuestionario'}</h3>
    <div class="sub">Opción múltiple, calificado automáticamente. Los estudiantes no pueden ver la respuesta correcta.</div>
    ${esEdicion ? '' : `
    <div class="grade-field">
      <label>Empezar desde una plantilla (opcional)</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${PLANTILLAS_CUESTIONARIOS.map((t,ti) => `<button class="btn btn-sm" data-plantilla="${ti}" style="font-size:11.5px;">${t.titulo}</button>`).join('')}
      </div>
      <div class="auth-hint">Carga el título y las preguntas de ejemplo; puedes editar cualquier parte antes de guardar.</div>
    </div>`}
    <div class="grade-field"><label>Título</label><input type="text" id="cq-titulo" placeholder='Ej. "Repaso: mercado de bonos"'></div>
    <div class="grade-field"><label>Descripción (opcional)</label><input type="text" id="cq-desc" placeholder="Instrucciones breves para el estudiante"></div>
    <div class="grade-field"><label>Tiempo límite en minutos (opcional)</label><input type="number" id="cq-tiempo" min="1" placeholder="Sin límite si se deja vacío"></div>
    <div id="cq-preguntas">${esEdicion ? '<div class="auth-hint">Cargando preguntas…</div>' : ''}</div>
    <button class="btn btn-sm" id="cq-btn-agregar" style="margin-bottom:12px;" ${esEdicion?'disabled':''}><i class="ti ti-plus"></i> Agregar pregunta</button>
    <div class="auth-msg" id="cq-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="cq-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="cq-guardar" style="flex:1;margin-top:0;" ${esEdicion?'disabled':''}>${esEdicion?'Guardar cambios':'Guardar cuestionario'}</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cq-cancelar').onclick = () => overlay.remove();

  function renderPreguntas(){
    const cont = overlay.querySelector('#cq-preguntas');
    cont.innerHTML = preguntas.map((p,pi) => `
      <div style="background:var(--c2);border-radius:var(--r);padding:12px;margin-bottom:10px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" data-p="${pi}" class="cq-texto" value="${(p.texto||'').replace(/"/g,'&quot;')}" placeholder="Texto de la pregunta ${pi+1}" style="flex:1;">
          ${preguntas.length>1 ? `<button class="btn btn-sm" data-quitar-p="${pi}" style="color:var(--red);"><i class="ti ti-trash"></i></button>` : ''}
        </div>
        ${p.opciones.map((op,oi) => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="radio" name="cq-correcta-${pi}" data-p="${pi}" data-o="${oi}" class="cq-radio" ${p.correcta===oi?'checked':''}>
            <input type="text" data-p="${pi}" data-o="${oi}" class="cq-opcion" value="${(op||'').replace(/"/g,'&quot;')}" placeholder="Opción ${oi+1}" style="flex:1;">
            ${p.opciones.length>2 ? `<button class="btn btn-sm" data-quitar-o="${pi}:${oi}" style="padding:4px 8px;"><i class="ti ti-x" style="font-size:11px;"></i></button>` : ''}
          </div>`).join('')}
        <button class="btn btn-sm" data-add-o="${pi}" style="margin-top:4px;">+ Opción</button>
      </div>`).join('');

    cont.querySelectorAll('.cq-texto').forEach(el => el.oninput = () => { preguntas[+el.dataset.p].texto = el.value; });
    cont.querySelectorAll('.cq-opcion').forEach(el => el.oninput = () => { preguntas[+el.dataset.p].opciones[+el.dataset.o] = el.value; });
    cont.querySelectorAll('.cq-radio').forEach(el => el.onclick = () => { preguntas[+el.dataset.p].correcta = +el.dataset.o; });
    cont.querySelectorAll('[data-add-o]').forEach(el => el.onclick = () => { preguntas[+el.dataset.addO].opciones.push(''); renderPreguntas(); });
    cont.querySelectorAll('[data-quitar-o]').forEach(el => el.onclick = () => {
      const [pi,oi] = el.dataset.quitarO.split(':').map(Number);
      preguntas[pi].opciones.splice(oi,1);
      if(preguntas[pi].correcta>=preguntas[pi].opciones.length) preguntas[pi].correcta = 0;
      renderPreguntas();
    });
    cont.querySelectorAll('[data-quitar-p]').forEach(el => el.onclick = () => { preguntas.splice(+el.dataset.quitarP,1); renderPreguntas(); });
  }
  if(!esEdicion) renderPreguntas();
  overlay.querySelector('#cq-btn-agregar').onclick = () => { preguntas.push({texto:'',opciones:['',''],correcta:0}); renderPreguntas(); };
  overlay.querySelectorAll('[data-plantilla]').forEach(btn => btn.onclick = () => {
    const t = PLANTILLAS_CUESTIONARIOS[+btn.dataset.plantilla];
    overlay.querySelector('#cq-titulo').value = t.titulo;
    overlay.querySelector('#cq-desc').value = t.descripcion;
    preguntas = t.preguntas.map(p => ({ texto: p.texto, opciones: [...p.opciones], correcta: p.correcta }));
    renderPreguntas();
    notify('Plantilla cargada — puedes editar cualquier parte antes de guardar.', 'success');
  });

  if(esEdicion){
    (async () => {
      const msg = overlay.querySelector('#cq-msg');
      try {
        overlay.querySelector('#cq-titulo').value = cuestionarioExistente.titulo;
        overlay.querySelector('#cq-desc').value = cuestionarioExistente.descripcion || '';
        overlay.querySelector('#cq-tiempo').value = cuestionarioExistente.tiempo_limite_minutos || '';
        const { data: pregs, error } = await sb.from('preguntas').select('*, respuestas_correctas(indice_correcto)').eq('cuestionario_id', cuestionarioExistente.id).order('orden');
        if(error) throw error;
        preguntas = (pregs||[]).map(p => ({
          texto: p.texto,
          opciones: [...(p.opciones||[])],
          correcta: p.respuestas_correctas?.indice_correcto ?? 0,
        }));
        if(!preguntas.length) preguntas = [{ texto:'', opciones:['',''], correcta:0 }];
        renderPreguntas();
        overlay.querySelector('#cq-btn-agregar').disabled = false;
        overlay.querySelector('#cq-guardar').disabled = false;
      } catch(e){
        msg.className='auth-msg show error'; msg.textContent = 'No se pudieron cargar las preguntas: ' + (e.message||e);
      }
    })();
  }

  overlay.querySelector('#cq-guardar').onclick = async () => {
    const msg = overlay.querySelector('#cq-msg');
    const titulo = overlay.querySelector('#cq-titulo').value.trim();
    const descripcion = overlay.querySelector('#cq-desc').value.trim() || null;
    const tiempoLimite = overlay.querySelector('#cq-tiempo').value ? +overlay.querySelector('#cq-tiempo').value : null;
    if(!titulo){ msg.className='auth-msg show error'; msg.textContent='Ponle un título al cuestionario.'; return; }
    for(const p of preguntas){
      if(!p.texto.trim()){ msg.className='auth-msg show error'; msg.textContent='Todas las preguntas necesitan texto.'; return; }
      if(p.opciones.some(o=>!o.trim())){ msg.className='auth-msg show error'; msg.textContent='Ninguna opción puede quedar vacía.'; return; }
    }
    const btn = overlay.querySelector('#cq-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Guardando…';
    try {
      let cuestionarioId;
      if(esEdicion){
        const { error: eUpd } = await conTiempoLimite(sb.from('cuestionarios').update({ titulo, descripcion, tiempo_limite_minutos: tiempoLimite }).eq('id', cuestionarioExistente.id));
        if(eUpd) throw eUpd;
        cuestionarioId = cuestionarioExistente.id;
        // Se reemplazan todas las preguntas por las actuales del formulario —
        // más simple y confiable que tratar de calcular diferencias, y como
        // `respuestas_correctas` depende de `preguntas` con on delete cascade,
        // se limpia sola al borrar las preguntas viejas.
        const { error: eDel } = await sb.from('preguntas').delete().eq('cuestionario_id', cuestionarioId);
        if(eDel) throw eDel;
      } else {
        const { data: cuestionario, error: e1 } = await conTiempoLimite(sb.from('cuestionarios').insert({
          sesion_id: currentUser.sesion_id, docente_id: currentUser.auth_id, titulo, descripcion, tiempo_limite_minutos: tiempoLimite,
        }).select('id').single());
        if(e1) throw e1;
        cuestionarioId = cuestionario.id;
      }

      for(let i=0;i<preguntas.length;i++){
        const p = preguntas[i];
        const { data: pregunta, error: e2 } = await sb.from('preguntas').insert({
          cuestionario_id: cuestionarioId, texto: p.texto.trim(), opciones: p.opciones.map(o=>o.trim()), orden: i,
        }).select('id').single();
        if(e2) throw e2;
        const { error: e3 } = await sb.from('respuestas_correctas').insert({ pregunta_id: pregunta.id, indice_correcto: p.correcta });
        if(e3) throw e3;
      }
      overlay.remove();
      notify(esEdicion ? 'Cuestionario actualizado.' : 'Cuestionario creado.', 'success');
      renderCuestionariosPage();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo guardar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = esEdicion ? 'Guardar cambios' : 'Guardar cuestionario';
    }
  };
}

async function alternarActivoCuestionario(id, activar){
  try {
    const { error } = await sb.from('cuestionarios').update({ activo: !!activar }).eq('id', id);
    if(error) throw error;
    notify(activar?'Cuestionario activado.':'Cuestionario desactivado.', 'success');
    renderCuestionariosPage();
  } catch(e){ notify('No se pudo actualizar: ' + (e.message||e), 'error'); }
}

async function borrarCuestionario(id){
  if(!confirm('¿Borrar este cuestionario? Se pierden también los intentos que hayan hecho los estudiantes.')) return;
  try {
    const { error } = await sb.from('cuestionarios').delete().eq('id', id);
    if(error) throw error;
    notify('Cuestionario borrado.', 'success');
    renderCuestionariosPage();
  } catch(e){ notify('No se pudo borrar: ' + (e.message||e), 'error'); }
}

// Copia un cuestionario completo (título, descripción, preguntas y sus
// respuestas correctas) a otra sesión del mismo docente, para no tener
// que reconstruirlo si da la misma materia en varias clases.
async function abrirDuplicarCuestionario(id){
  if(!currentUser) return;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:400px;">
    <h3>Duplicar cuestionario</h3>
    <div class="sub">Se copian todas las preguntas y sus respuestas correctas.</div>
    <div id="dq-lista"><div class="auth-hint">Cargando tus otras sesiones…</div></div>
    <button class="btn btn-ghost" id="dq-cerrar" style="width:100%;margin-top:14px;">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#dq-cerrar').onclick = () => overlay.remove();

  try {
    const { data: sesiones, error } = await sb.from('sesiones_clase').select('id,nombre,codigo').eq('docente_id', currentUser.auth_id).neq('id', currentUser.sesion_id).order('creado_en',{ascending:false});
    if(error) throw error;
    const cont = overlay.querySelector('#dq-lista');
    if(!sesiones || !sesiones.length){
      cont.innerHTML = '<div class="auth-hint">No tienes otras sesiones de clase todavía. Crea una desde "Mis sesiones" antes de duplicar.</div>';
      return;
    }
    cont.innerHTML = sesiones.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border:1px solid var(--c4);border-radius:var(--r);margin-bottom:6px;">
        <div style="font-size:13px;font-weight:600;">${s.nombre}</div>
        <button class="btn btn-sm" onclick="duplicarCuestionarioA('${id}','${s.id}')">Copiar aquí</button>
      </div>`).join('');
  } catch(e){
    overlay.querySelector('#dq-lista').innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }
}

async function duplicarCuestionarioA(idOrigen, sesionDestinoId){
  try {
    notify('Duplicando…', 'success');
    const { data: original, error: e1 } = await sb.from('cuestionarios').select('titulo,descripcion').eq('id', idOrigen).single();
    if(e1) throw e1;
    const { data: preguntas, error: e2 } = await sb.from('preguntas').select('*, respuestas_correctas(indice_correcto)').eq('cuestionario_id', idOrigen).order('orden');
    if(e2) throw e2;

    const { data: nuevo, error: e3 } = await sb.from('cuestionarios').insert({
      sesion_id: sesionDestinoId, docente_id: currentUser.auth_id, titulo: original.titulo, descripcion: original.descripcion,
    }).select('id').single();
    if(e3) throw e3;

    for(const p of (preguntas||[])){
      const { data: preguntaNueva, error: e4 } = await sb.from('preguntas').insert({
        cuestionario_id: nuevo.id, texto: p.texto, opciones: p.opciones, orden: p.orden,
      }).select('id').single();
      if(e4) throw e4;
      await sb.from('respuestas_correctas').insert({ pregunta_id: preguntaNueva.id, indice_correcto: p.respuestas_correctas?.indice_correcto ?? 0 });
    }
    document.querySelectorAll('.grade-modal-overlay').forEach(o=>o.remove());
    notify('Cuestionario duplicado correctamente.', 'success');
  } catch(e){
    notify('No se pudo duplicar: ' + (e.message||e), 'error');
  }
}

async function verResultadosCuestionario(id, titulo){
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal"><h3>Resultados: ${titulo}</h3><div class="sub"></div><div id="cq-res-lista"><div class="auth-hint">Cargando…</div></div><button class="btn btn-ghost" style="width:100%;margin-top:14px;" id="cq-res-cerrar">Cerrar</button></div>`;
  document.body.appendChild(overlay);
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cq-res-cerrar').onclick = () => overlay.remove();
  try {
    const { data, error } = await sb.from('intentos_cuestionario').select('*, usuarios!intentos_cuestionario_usuario_id_fkey(nombre)').eq('cuestionario_id', id).order('nota',{ascending:false});
    if(error) throw error;
    const cont = overlay.querySelector('#cq-res-lista');
    if(!data || !data.length){ cont.innerHTML = '<div class="auth-hint">Todavía nadie lo ha resuelto.</div>'; return; }
    const promedio = (data.reduce((s,d)=>s+(d.nota||0),0)/data.length).toFixed(1);
    cont.innerHTML = `<div style="font-size:12.5px;color:var(--t3);margin-bottom:10px;">Promedio del grupo: <b style="color:var(--t1);">${promedio}/100</b> · ${data.length} respondieron</div>` +
      data.map(d => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--c3);font-size:13px;">
        <span>${d.usuarios?.nombre || 'Estudiante'}</span>
        <span class="grade-pill ${nivelCalificacion(d.nota)}">${d.nota}/100</span>
      </div>`).join('');
  } catch(e){
    overlay.querySelector('#cq-res-lista').innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }
}

// ── Resolver un cuestionario (estudiante) ──
async function tomarCuestionario(id, titulo){
  try {
    const { data: preguntas, error } = await sb.from('preguntas').select('*').eq('cuestionario_id', id).order('orden');
    if(error) throw error;
    if(!preguntas || !preguntas.length){ notify('Este cuestionario todavía no tiene preguntas.', 'error'); return; }

    const tiempoLimite = cuestionariosCache[id]?.tiempo_limite_minutos || null;
    let segundosRestantes = tiempoLimite ? tiempoLimite * 60 : null;
    let intervaloRegresivo = null;

    const overlay = document.createElement('div');
    overlay.className = 'grade-modal-overlay';
    overlay.innerHTML = `<div class="grade-modal" style="max-width:540px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <h3 style="margin-bottom:0;">${titulo}</h3>
        ${tiempoLimite ? `<span id="tq-cronometro" class="nav-badge" style="background:rgba(212,175,55,.15);color:var(--gold);font-family:var(--font-mono);white-space:nowrap;"><i class="ti ti-clock" style="font-size:11px;"></i> --:--</span>` : ''}
      </div>
      <div class="sub">${tiempoLimite ? `Tienes ${tiempoLimite} minuto${tiempoLimite===1?'':'s'} para responder. Se envía solo cuando se acabe el tiempo.` : 'Selecciona una opción por pregunta.'} No se puede volver a intentar después de enviar.</div>
      ${preguntas.map((p,pi) => `
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;font-size:13.5px;margin-bottom:8px;">${pi+1}. ${p.texto}</div>
          ${(p.opciones||[]).map((op,oi) => `
            <label style="display:flex;align-items:center;gap:8px;padding:11px 4px;font-size:13px;cursor:pointer;min-height:22px;">
              <input type="radio" name="tq-${p.id}" value="${oi}" class="tq-radio" data-pregunta="${p.id}" style="width:18px;height:18px;flex-shrink:0;">
              ${op}
            </label>`).join('')}
        </div>`).join('')}
      <div class="auth-msg" id="tq-msg"></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost" id="tq-cancelar" style="flex:1;">Cancelar</button>
        <button class="auth-submit" id="tq-enviar" style="flex:1;margin-top:0;">Enviar respuestas</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.querySelector('#tq-cancelar').onclick = () => { if(intervaloRegresivo) clearInterval(intervaloRegresivo); overlay.remove(); };

    const enviarRespuestas = async (auto) => {
      if(intervaloRegresivo) clearInterval(intervaloRegresivo);
      const msg = overlay.querySelector('#tq-msg');
      const respuestas = preguntas.map(p => {
        const marcado = overlay.querySelector(`input[name="tq-${p.id}"]:checked`);
        return { pregunta_id: p.id, indice_elegido: marcado ? +marcado.value : -1 };
      });
      if(!auto && respuestas.some(r=>r.indice_elegido===-1)){ msg.className='auth-msg show error'; msg.textContent='Responde todas las preguntas antes de enviar.'; return; }

      const btn = overlay.querySelector('#tq-enviar');
      btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Enviando…';
      try {
        const { data: nota, error: errEnvio } = await conTiempoLimite(sb.rpc('enviar_intento_cuestionario', {
          p_cuestionario_id: id, p_respuestas: respuestas,
        }));
        if(errEnvio) throw errEnvio;
        overlay.remove();
        notify(auto ? `Se acabó el tiempo — cuestionario enviado. Tu nota: ${nota}/100` : `Cuestionario enviado. Tu nota: ${nota}/100`, 'success');
        desbloquearLogro('primer_cuestionario');
        if(nota >= 100) desbloquearLogro('cuestionario_perfecto');
        renderCuestionariosPage();
        actualizarBadgeNotificaciones();
      } catch(e){
        msg.className='auth-msg show error'; msg.textContent = 'No se pudo enviar: ' + (e.message||e);
        btn.disabled = false; btn.textContent = 'Enviar respuestas';
      }
    };
    overlay.querySelector('#tq-enviar').onclick = () => enviarRespuestas(false);

    if(tiempoLimite){
      const cronometroEl = overlay.querySelector('#tq-cronometro');
      const actualizarCronometro = () => {
        const min = Math.floor(segundosRestantes/60), seg = segundosRestantes%60;
        cronometroEl.innerHTML = `<i class="ti ti-clock" style="font-size:11px;"></i> ${min}:${String(seg).padStart(2,'0')}`;
        if(segundosRestantes <= 60) cronometroEl.style.color = 'var(--red)';
        if(segundosRestantes <= 0){
          notify('Se acabó el tiempo, enviando tus respuestas…', 'error');
          enviarRespuestas(true);
        }
        segundosRestantes--;
      };
      actualizarCronometro();
      intervaloRegresivo = setInterval(actualizarCronometro, 1000);
    }
  } catch(e){
    notify('No se pudo cargar el cuestionario: ' + (e.message||e), 'error');
  }
}

// ══════════════════════════════════════════════════
// TABLA DE POSICIONES — ranking en vivo por sesión
// ══════════════════════════════════════════════════
let rankingPosicionesCache = null;
async function renderPosicionesPage(){
  const cont = document.getElementById('pos-lista');
  const empty = document.getElementById('pos-empty');
  const toggleWrap = document.getElementById('pos-toggle-wrap');
  if(!currentUser || guestMode || !currentUser.sesion_id){ cont.innerHTML=''; empty.style.display='block'; toggleWrap.style.display='none'; document.getElementById('reto-card').style.display='none'; return; }
  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  cont.innerHTML = '<div class="auth-hint">Cargando…</div>'; empty.style.display='none';
  renderRetoActivo();

  try {
    const { data: sesion } = await sb.from('sesiones_clase').select('nombre,mostrar_ranking').eq('id', currentUser.sesion_id).maybeSingle();
    document.getElementById('pos-page-sub').textContent = sesion?.nombre ? `Sesión: ${sesion.nombre}` : 'Ranking de retorno.';

    if(esDocente){
      toggleWrap.style.display = 'flex';
      document.getElementById('pos-toggle-visible').checked = !!sesion?.mostrar_ranking;
      document.getElementById('pos-btn-exportar').style.display = '';
    } else {
      toggleWrap.style.display = 'none';
      if(!sesion?.mostrar_ranking){
        cont.innerHTML = '<div class="auth-hint">Tu docente todavía no activó la tabla de posiciones para esta sesión.</div>';
        return;
      }
    }

    const { data: ports, error } = await sb.from('portafolios').select('usuario_id,valor_total,retorno_pct').eq('sesion_id', currentUser.sesion_id).order('retorno_pct',{ascending:false});
    if(error) throw error;
    if(!ports || !ports.length){ cont.innerHTML=''; empty.style.display='block'; return; }

    const { data: usuarios } = await sb.from('usuarios').select('id,nombre').eq('sesion_id', currentUser.sesion_id);
    const nombreMap = {}; (usuarios||[]).forEach(u=>{ nombreMap[u.id] = u.nombre; });
    rankingPosicionesCache = ports.map(p => ({ nombre: nombreMap[p.usuario_id]||'Estudiante', retorno: p.retorno_pct!=null?Number(p.retorno_pct):0, valor: p.valor_total }));

    const medallas = ['🥇','🥈','🥉'];
    const promedioSesion = ports.reduce((s,p)=>s+(p.retorno_pct!=null?Number(p.retorno_pct):0),0) / ports.length;
    const miPos = ports.find(p=>p.usuario_id===currentUser.usuario_id);
    let resumenHtml = '';
    if(!esDocente && miPos){
      const miRetorno = miPos.retorno_pct!=null ? Number(miPos.retorno_pct) : 0;
      const diferencia = miRetorno - promedioSesion;
      resumenHtml = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div style="flex:1;min-width:140px;background:var(--c2);border-radius:var(--r2);padding:12px;">
          <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Tu retorno</div>
          <div style="font-size:20px;font-weight:700;color:${miRetorno>=0?'var(--green)':'var(--red)'};">${miRetorno>=0?'+':''}${miRetorno.toFixed(2)}%</div>
        </div>
        <div style="flex:1;min-width:140px;background:var(--c2);border-radius:var(--r2);padding:12px;">
          <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Promedio de la clase</div>
          <div style="font-size:20px;font-weight:700;">${promedioSesion>=0?'+':''}${promedioSesion.toFixed(2)}%</div>
        </div>
        <div style="flex:1;min-width:140px;background:var(--c2);border-radius:var(--r2);padding:12px;">
          <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;">Diferencia</div>
          <div style="font-size:20px;font-weight:700;color:${diferencia>=0?'var(--green)':'var(--red)'};">${diferencia>=0?'+':''}${diferencia.toFixed(2)}%</div>
        </div>
      </div>`;
    }
    cont.innerHTML = resumenHtml + ports.map((p,i) => {
      const soyYo = p.usuario_id === currentUser.usuario_id;
      const retorno = p.retorno_pct!=null ? Number(p.retorno_pct) : 0;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--r);margin-bottom:6px;${soyYo?'background:rgba(0,196,255,.08);border:1px solid var(--accent2);':'border:1px solid var(--c3);'}">
        <div style="width:28px;text-align:center;font-weight:700;font-size:14px;color:var(--t2);">${i<3 ? (i+1) : '#'+(i+1)}</div>
        <div style="flex:1;font-weight:600;font-size:13.5px;">${nombreMap[p.usuario_id] || 'Estudiante'}${soyYo?' <span style="color:var(--accent2);">(tú)</span>':''}</div>
        <div style="font-size:13px;color:${retorno>=0?'var(--green)':'var(--red)'};font-weight:700;">${retorno>=0?'+':''}${retorno.toFixed(2)}%</div>
      </div>`;
    }).join('');
  } catch(e){
    cont.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }
}

// Exporta el ranking ya cargado en pantalla a CSV — pensado para que el
// docente se lleve una copia del desempeño de la clase a un momento
// dado, sin depender de volver a entrar a la aplicación para verlo.
function exportarRankingCSV(){
  if(!rankingPosicionesCache || !rankingPosicionesCache.length){ notify('Todavía no hay datos del ranking para exportar.', 'error'); return; }
  const filas = rankingPosicionesCache.map((p,i) => [i+1, '"'+p.nombre+'"', p.retorno.toFixed(2), (p.valor||0).toFixed(2)].join(','));
  const csv = ['Puesto,Estudiante,Retorno (%),Valor de cartera ($)', ...filas].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ranking_${(currentUser?.sesion_nombre||'sesion').replace(/[^a-z0-9]/gi,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify('Ranking exportado.', 'success');
}

async function alternarVisibilidadRanking(visible){
  if(!currentUser || !currentUser.sesion_id) return;
  try {
    const { error } = await sb.from('sesiones_clase').update({ mostrar_ranking: !!visible }).eq('id', currentUser.sesion_id);
    if(error) throw error;
    notify(visible ? 'Tus estudiantes ya pueden ver la tabla de posiciones.' : 'La tabla de posiciones quedó oculta para tus estudiantes.', 'success');
  } catch(e){
    notify('No se pudo actualizar: ' + (e.message||e), 'error');
  }
}

// ══════════════════════════════════════════════════
// RETOS SEMANALES — desafíos cortos con meta y cuenta regresiva, con su
// propia tabla de posiciones aparte del ranking general de la sesión.
// ══════════════════════════════════════════════════
let retoIntervaloCuentaRegresiva = null;

function formatearCuentaRegresiva(fechaFin){
  const restante = new Date(fechaFin).getTime() - Date.now();
  if(restante <= 0) return 'Terminado';
  const dias = Math.floor(restante / 86400000);
  const horas = Math.floor((restante % 86400000) / 3600000);
  const min = Math.floor((restante % 3600000) / 60000);
  if(dias > 0) return `${dias}d ${horas}h restantes`;
  if(horas > 0) return `${horas}h ${min}m restantes`;
  return `${min}m restantes`;
}

async function renderRetoActivo(){
  const card = document.getElementById('reto-card');
  const cont = document.getElementById('reto-contenido');
  if(!card || !cont || !currentUser || !currentUser.sesion_id) return;
  if(retoIntervaloCuentaRegresiva){ clearInterval(retoIntervaloCuentaRegresiva); retoIntervaloCuentaRegresiva = null; }

  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  try {
    const { data: retos } = await sb.from('retos').select('*').eq('sesion_id', currentUser.sesion_id).eq('activo', true).order('creado_en',{ascending:false}).limit(1);
    const reto = retos && retos[0];

    if(!reto){
      if(!esDocente){ card.style.display = 'none'; return; }
      card.style.display = 'block';
      cont.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div class="card-title" style="margin-bottom:2px;"><i class="ti ti-swords" style="color:var(--gold);"></i> Reto semanal</div>
            <div style="font-size:12.5px;color:var(--t3);">Lanza un desafío corto con su propia tabla de posiciones.</div>
          </div>
          <button class="btn btn-sm" onclick="abrirCrearReto()"><i class="ti ti-plus"></i> Crear un reto</button>
        </div>`;
      return;
    }

    card.style.display = 'block';
    const { data: participantes } = await sb.from('retos_participantes').select('usuario_id,valor_inicial').eq('reto_id', reto.id);
    const idsParticipantes = new Set((participantes||[]).map(p=>p.usuario_id));

    // Si el estudiante todavía no está inscrito en este reto, se une ahora
    // mismo, tomando el valor actual de su cartera como línea base.
    if(!esDocente && !idsParticipantes.has(currentUser.usuario_id)){
      const valorPosiciones = portfolio.reduce((s,p)=>s+((p.currentPrice||p.buyPrice||0)*p.qty), 0);
      const valorActual = capital + valorPosiciones;
      await sb.from('retos_participantes').insert({ reto_id: reto.id, usuario_id: currentUser.usuario_id, valor_inicial: valorActual }).then(()=>{}, ()=>{});
    }

    const { data: portsActuales } = await sb.from('portafolios').select('usuario_id,valor_total').eq('sesion_id', currentUser.sesion_id);
    const valorActualMap = {}; (portsActuales||[]).forEach(p=>{ valorActualMap[p.usuario_id] = p.valor_total; });

    const { data: usuarios } = await sb.from('usuarios').select('id,nombre').eq('sesion_id', currentUser.sesion_id);
    const nombreMap = {}; (usuarios||[]).forEach(u=>{ nombreMap[u.id] = u.nombre; });

    const ranking = (participantes||[]).map(p => {
      const actual = valorActualMap[p.usuario_id];
      const retorno = (actual!=null && p.valor_inicial>0) ? ((actual - p.valor_inicial)/p.valor_inicial)*100 : null;
      return { usuario_id: p.usuario_id, nombre: nombreMap[p.usuario_id]||'Estudiante', retorno };
    }).sort((a,b)=>(b.retorno??-999)-(a.retorno??-999));

    const terminado = new Date(reto.fecha_fin).getTime() <= Date.now();
    const miFila = ranking.find(r=>r.usuario_id===currentUser.usuario_id);

    cont.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div>
          <div class="card-title" style="margin-bottom:2px;"><i class="ti ti-swords" style="color:var(--gold);"></i> ${reto.titulo}</div>
          <div style="font-size:12.5px;color:var(--t3);">Meta: <b style="color:var(--t1);">${reto.meta_retorno>=0?'+':''}${reto.meta_retorno}%</b> de retorno${!esDocente&&miFila&&miFila.retorno!=null?` · Vas en <b style="color:${miFila.retorno>=0?'var(--green)':'var(--red)'};">${miFila.retorno>=0?'+':''}${miFila.retorno.toFixed(2)}%</b>`:''}</div>
          ${(!esDocente && miFila && miFila.retorno!=null) ? (() => {
            const pct = reto.meta_retorno !== 0 ? Math.min(100, Math.max(0, (miFila.retorno/reto.meta_retorno)*100)) : 0;
            const logrado = miFila.retorno >= reto.meta_retorno;
            const colorBarra = logrado ? 'var(--green)' : (miFila.retorno<0 ? 'var(--red)' : 'var(--gold)');
            return `<div style="width:100%;max-width:280px;height:6px;border-radius:4px;background:var(--c3);margin-top:8px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${colorBarra};border-radius:4px;transition:width .4s;"></div>
            </div>
            <div style="font-size:10px;color:var(--t3);margin-top:3px;">${logrado?'¡Meta alcanzada! 🎉':pct.toFixed(0)+'% del camino hacia la meta'}</div>`;
          })() : ''}
        </div>
        <div style="text-align:right;">
          <span class="nav-badge" style="background:${terminado?'var(--c3)':'rgba(212,175,55,.15)'};color:${terminado?'var(--t3)':'var(--gold)'};font-size:11.5px;">${formatearCuentaRegresiva(reto.fecha_fin)}</span>
          ${esDocente ? `<button class="btn btn-sm" style="margin-left:8px;color:var(--red);" onclick="finalizarReto('${reto.id}')" title="Finalizar reto"><i class="ti ti-flag"></i></button>` : ''}
        </div>
      </div>
      ${ranking.length ? ranking.slice(0,8).map((r,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:var(--r);margin-bottom:4px;${r.usuario_id===currentUser.usuario_id?'background:rgba(0,196,255,.08);border:1px solid var(--accent2);':''}">
          <div style="width:20px;text-align:center;font-size:12px;color:var(--t3);">${i+1}</div>
          <div style="flex:1;font-size:12.5px;">${r.nombre}${r.usuario_id===currentUser.usuario_id?' <span style="color:var(--accent2);">(tú)</span>':''}</div>
          <div style="font-size:12.5px;font-weight:700;color:${r.retorno==null?'var(--t3)':(r.retorno>=0?'var(--green)':'var(--red)')};">${r.retorno!=null?(r.retorno>=0?'+':'')+r.retorno.toFixed(2)+'%':'—'}</div>
        </div>`).join('') : '<div class="auth-hint">Todavía nadie tiene datos suficientes en este reto.</div>'}
    `;

    retoIntervaloCuentaRegresiva = setInterval(() => {
      const badge = card.querySelector('.nav-badge');
      if(badge && !terminado) badge.textContent = formatearCuentaRegresiva(reto.fecha_fin);
    }, 30000);
  } catch(e){
    card.style.display = 'none';
  }
}

function abrirCrearReto(){
  if(!currentUser || !currentUser.sesion_id) return;
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  const manana = new Date(Date.now()+7*86400000).toISOString().slice(0,16);
  overlay.innerHTML = `<div class="grade-modal" style="max-width:420px;">
    <h3>Nuevo reto semanal</h3>
    <div class="sub">Se crea con su propia tabla de posiciones, aparte del ranking general.</div>
    <div class="grade-field"><label>Título</label><input type="text" id="rt-titulo" placeholder='Ej. "Reto de la semana: bonos"'></div>
    <div class="grade-field"><label>Meta de retorno (%)</label><input type="number" id="rt-meta" value="5" step="0.5"></div>
    <div class="grade-field"><label>Termina</label><input type="datetime-local" id="rt-fin" value="${manana}"></div>
    <div class="auth-msg" id="rt-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="rt-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="rt-guardar" style="flex:1;margin-top:0;">Lanzar reto</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#rt-cancelar').onclick = () => overlay.remove();
  overlay.querySelector('#rt-guardar').onclick = async () => {
    const msg = overlay.querySelector('#rt-msg');
    const titulo = overlay.querySelector('#rt-titulo').value.trim();
    const meta = +overlay.querySelector('#rt-meta').value;
    const fin = overlay.querySelector('#rt-fin').value;
    if(!titulo){ msg.className='auth-msg show error'; msg.textContent='Ponle un título al reto.'; return; }
    if(!fin){ msg.className='auth-msg show error'; msg.textContent='Elige cuándo termina.'; return; }
    const btn = overlay.querySelector('#rt-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Creando…';
    try {
      // Desactiva cualquier reto anterior de esta sesión antes de lanzar el nuevo.
      await sb.from('retos').update({ activo: false }).eq('sesion_id', currentUser.sesion_id).eq('activo', true);
      const { error } = await conTiempoLimite(sb.from('retos').insert({
        sesion_id: currentUser.sesion_id, docente_id: currentUser.auth_id, titulo,
        meta_retorno: meta, fecha_fin: new Date(fin).toISOString(),
      }));
      if(error) throw error;
      overlay.remove();
      notify('Reto lanzado.', 'success');
      renderRetoActivo();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo crear: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Lanzar reto';
    }
  };
}

async function finalizarReto(id){
  if(!confirm('¿Finalizar este reto ahora? Ya no se podrá reactivar.')) return;
  try {
    const { error } = await sb.from('retos').update({ activo: false }).eq('id', id);
    if(error) throw error;
    notify('Reto finalizado.', 'success');
    renderRetoActivo();
  } catch(e){
    notify('No se pudo finalizar: ' + (e.message||e), 'error');
  }
}

// ══════════════════════════════════════════════════
// SUPERADMINISTRADOR — panorama de toda la plataforma
// ══════════════════════════════════════════════════
async function cargarTicketsSoporte(){
  const cont = document.getElementById('admin-tickets');
  if(!cont || !currentUser || currentUser.rol!=='superadmin') return;
  try {
    const { data, error } = await sb.from('tickets_soporte').select('*').order('created_at', { ascending:false }).limit(50);
    if(error) throw error;
    if(!data || !data.length){
      cont.innerHTML = '<div class="auth-hint">No hay tickets reportados todavía.</div>';
      return;
    }
    cont.innerHTML = data.map(t => `
      <div style="border:1px solid var(--c4);border-left:3px solid ${t.estado==='resuelto'?'var(--green)':'var(--amber)'};border-radius:8px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px;">
          <div style="font-size:12.5px;font-weight:600;">${t.nombre_usuario||'desconocido'} <span style="font-weight:400;color:var(--t3);">(${t.rol||'sin rol'}${t.sesion_nombre?' · '+t.sesion_nombre:''})</span></div>
          <span class="nav-badge" style="background:${t.estado==='resuelto'?'var(--green)':'var(--amber)'};color:#000;flex-shrink:0;">${t.estado}</span>
        </div>
        <div style="font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:6px;">${t.error_descripcion}</div>
        ${t.que_intentaba?`<div style="font-size:11px;color:var(--t3);">Intentaba: ${t.que_intentaba}</div>`:''}
        ${t.intento_solucion?`<div style="font-size:11px;color:var(--t3);">Intentó: ${t.intento_solucion}</div>`:''}
        ${t.como_lo_resolvio?`<div style="font-size:11px;color:var(--green);">Se resolvió con: ${t.como_lo_resolvio}</div>`:''}
        ${t.respuesta?`<div style="font-size:11.5px;color:var(--t2);margin-top:8px;padding:8px 10px;background:var(--c2);border-left:3px solid var(--accent2);border-radius:4px;"><b style="color:var(--accent2);font-size:10.5px;text-transform:uppercase;">Tu respuesta</b><br>${t.respuesta.replace(/\n/g,'<br>')}<div style="font-size:10px;color:var(--t3);margin-top:5px;">${t.respondido_en?new Date(t.respondido_en).toLocaleString('es-PA'):''}</div></div>`:''}
        <div id="respuesta-box-${t.id}" style="display:none;margin-top:8px;">
          <textarea id="respuesta-txt-${t.id}" placeholder="Escribe tu respuesta para ${t.email_contacto}…" style="width:100%;min-height:80px;padding:8px 10px;background:var(--c2);border:1px solid var(--c4);border-radius:var(--r);color:var(--t1);font-family:var(--font-body);font-size:12.5px;resize:vertical;"></textarea>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="btn btn-primary btn-sm" onclick="enviarRespuestaTicket('${t.id}')"><i class="ti ti-send"></i> Enviar respuesta</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('respuesta-box-${t.id}').style.display='none';">Cancelar</button>
          </div>
          <div id="respuesta-msg-${t.id}" style="font-size:11px;margin-top:6px;"></div>
        </div>
        <div style="font-size:10px;color:var(--t3);margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span>${t.email_contacto} · ${new Date(t.created_at).toLocaleString('es-PA')}</span>
          <span style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('respuesta-box-${t.id}').style.display='block';document.getElementById('respuesta-txt-${t.id}').focus();"><i class="ti ti-mail-forward"></i> ${t.respuesta?'Responder de nuevo':'Responder'}</button>
            ${t.estado!=='resuelto'?`<button class="btn btn-ghost btn-sm" onclick="marcarTicketResuelto('${t.id}')">Marcar como resuelto</button>`:''}
          </span>
        </div>
      </div>
    `).join('');
  } catch(e){
    cont.innerHTML = `<div class="auth-hint" style="color:var(--red);">No se pudieron cargar los tickets: ${e.message||e}</div>`;
  }
}

// Envía la respuesta del superadministrador al correo de quien reportó
// el ticket, vía la Edge Function responder-ticket-soporte (la clave de
// Resend vive del lado del servidor, nunca en el navegador). La
// respuesta se guarda en la base de datos aunque el correo falle, así
// que nunca se pierde lo escrito.
async function enviarRespuestaTicket(id){
  const txt = document.getElementById('respuesta-txt-'+id);
  const msg = document.getElementById('respuesta-msg-'+id);
  const respuesta = (txt?.value || '').trim();
  if(!respuesta){ msg.style.color='var(--red)'; msg.textContent='Escribe una respuesta antes de enviar.'; return; }

  msg.style.color='var(--t3)'; msg.textContent='Enviando…';
  try {
    const { data: sesion } = await sb.auth.getSession();
    const token = sesion?.session?.access_token;
    const respuestaHttp = await fetch(`${SIM_IA_URL}/functions/v1/responder-ticket-soporte`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey': SIM_IA_ANON_KEY,
        'Authorization': `Bearer ${token || SIM_IA_ANON_KEY}`,
      },
      body: JSON.stringify({ ticketId: id, respuesta }),
    });
    const d = await respuestaHttp.json();
    if(!d.ok) throw new Error(d.error || 'Error desconocido.');
    if(d.correoEnviado){
      notify('Respuesta enviada por correo.', 'success');
    } else {
      // El aviso viene tal cual del servidor (ej. el 403 de Resend en
      // modo de prueba); se muestra completo en vez de ocultarlo.
      msg.style.color='var(--amber)';
      msg.textContent = d.aviso || 'Respuesta guardada, pero el correo no se envió.';
      notify('Respuesta guardada (el correo no se pudo enviar).', 'warning');
    }
    cargarTicketsSoporte();
  } catch(e){
    msg.style.color='var(--red)';
    msg.textContent = 'No se pudo enviar: ' + (e.message||e);
  }
}

async function marcarTicketResuelto(id){
  try {
    const { error } = await sb.from('tickets_soporte').update({ estado:'resuelto' }).eq('id', id);
    if(error) throw error;
    cargarTicketsSoporte();
  } catch(e){
    if(typeof notify==='function') notify('No se pudo actualizar: '+(e.message||e), 'error');
  }
}

async function renderAdminPage(){
  const resumen = document.getElementById('admin-resumen');
  const listaCont = document.getElementById('admin-sesiones');
  cargarTicketsSoporte();
  if(!currentUser || currentUser.rol!=='superadmin'){
    // Se avisa que la sección existe y es restringida, sin explicar el
    // mecanismo exacto para obtener ese rol — hacerlo público dentro del
    // propio sitio sería revelar la forma de conseguir el nivel de acceso
    // más alto de toda la plataforma a cualquiera que la visite.
    resumen.innerHTML = '';
    listaCont.innerHTML = `<div class="info-box" style="font-size:12.5px;">
      <b>Esta sección es exclusiva del Superadministrador.</b><br>
      Tu cuenta actual no tiene ese rol asignado. Si necesitas acceso, contacta a quien administra la plataforma.
    </div>`;
    return;
  }
  resumen.innerHTML = '<div class="auth-hint">Cargando…</div>';
  listaCont.innerHTML = '<div class="auth-hint">Cargando…</div>';
  try {
    const [{data: sesiones, error: e1}, {data: usuarios, error: e2}, {data: ports, error: e3}] = await Promise.all([
      sb.from('sesiones_clase').select('id,nombre,codigo,activa,creado_en,docente_id').order('creado_en',{ascending:false}),
      sb.from('usuarios').select('id,auth_id,nombre,correo,rol,sesion_id'),
      sb.from('portafolios').select('sesion_id,retorno_pct'),
    ]);
    if(e1) throw e1; if(e2) throw e2; if(e3) throw e3;

    const totalDocentes = (usuarios||[]).filter(u=>u.rol==='docente').length;
    const totalEstudiantes = (usuarios||[]).filter(u=>u.rol==='estudiante').length;
    const sesionesActivas = (sesiones||[]).filter(s=>s.activa!==false).length;

    resumen.innerHTML = `
      <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Sesiones totales</div>
        <div style="font-size:22px;font-weight:700;">${(sesiones||[]).length}</div>
      </div>
      <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Sesiones activas</div>
        <div style="font-size:22px;font-weight:700;color:var(--green);">${sesionesActivas}</div>
      </div>
      <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Docentes</div>
        <div style="font-size:22px;font-weight:700;">${totalDocentes}</div>
      </div>
      <div style="background:var(--c2);border-radius:var(--r2);padding:14px;">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase;">Estudiantes</div>
        <div style="font-size:22px;font-weight:700;">${totalEstudiantes}</div>
      </div>`;

    const docenteMap = {}; (usuarios||[]).forEach(u=>{ if(u.rol==='docente'||u.rol==='superadmin') docenteMap[u.auth_id || u.id] = u; });
    const conteoEstPorSesion = {};
    (usuarios||[]).forEach(u=>{ if(u.rol==='estudiante' && u.sesion_id) conteoEstPorSesion[u.sesion_id] = (conteoEstPorSesion[u.sesion_id]||0)+1; });

    if(!sesiones || !sesiones.length){ listaCont.innerHTML = '<div class="auth-hint">Todavía no hay sesiones creadas en la plataforma.</div>'; return; }

    // ── TORNEO INTER-SESIONES — compara el retorno promedio de cada
    // sesión activa contra las demás, para tener una vista de "qué clase
    // le está yendo mejor" a nivel de toda la plataforma, no solo dentro
    // de una sesión individual.
    const retornosPorSesion = {};
    (ports||[]).forEach(p => { if(p.retorno_pct!=null){ (retornosPorSesion[p.sesion_id] = retornosPorSesion[p.sesion_id]||[]).push(Number(p.retorno_pct)); } });
    const torneo = sesiones.filter(s => s.activa!==false && retornosPorSesion[s.id]?.length)
      .map(s => ({ nombre: s.nombre, promedio: retornosPorSesion[s.id].reduce((a,b)=>a+b,0)/retornosPorSesion[s.id].length, n: retornosPorSesion[s.id].length }))
      .sort((a,b) => b.promedio - a.promedio);
    let torneoHtml = '';
    if(torneo.length >= 2){
      torneoHtml = `<div class="card" style="margin-bottom:16px;">
        <div class="card-title"><i class="ti ti-trophy" style="color:var(--gold);"></i> Torneo entre sesiones</div>
        <div class="card-sub" style="margin-bottom:10px;">Retorno promedio de cada sesión activa, comparado entre sí.</div>
        ${torneo.map((t,i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--c3);">
          <div style="width:26px;font-weight:700;color:var(--t3);">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</div>
          <div style="flex:1;font-size:13px;font-weight:600;">${t.nombre} <span style="color:var(--t3);font-weight:400;">(${t.n} estudiante${t.n===1?'':'s'})</span></div>
          <div style="font-weight:700;color:${t.promedio>=0?'var(--green)':'var(--red)'};">${t.promedio>=0?'+':''}${t.promedio.toFixed(1)}%</div>
        </div>`).join('')}
      </div>`;
    }

    listaCont.innerHTML = torneoHtml + `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead><tr style="text-align:left;color:var(--t3);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--c4);">
        <th style="padding:8px 10px;">Sesión</th><th style="padding:8px 10px;">Código</th><th style="padding:8px 10px;">Docente responsable</th><th style="padding:8px 10px;">Estudiantes</th><th style="padding:8px 10px;">Estado</th>
      </tr></thead>
      <tbody>${sesiones.map(s => {
        return `<tr style="border-bottom:1px solid var(--c3);">
          <td style="padding:8px 10px;font-weight:600;">${s.nombre}</td>
          <td style="padding:8px 10px;font-family:var(--font-mono);color:var(--t3);">${s.codigo}</td>
          <td style="padding:8px 10px;color:var(--t2);">${docenteMap[s.docente_id]?.nombre || '—'}</td>
          <td style="padding:8px 10px;">${conteoEstPorSesion[s.id]||0}</td>
          <td style="padding:8px 10px;">${s.activa===false ? '<span class="nav-badge">Archivada</span>' : '<span class="nav-badge" style="background:rgba(0,208,132,.15);color:var(--green);">Activa</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } catch(e){
    resumen.innerHTML = '';
    listaCont.innerHTML = '<div class="auth-hint">No se pudo cargar: '+(e.message||e)+'</div>';
  }
}

async function renderCalificacionesPage(){
  const cont = document.getElementById('cal-lista');
  const empty = document.getElementById('cal-empty');
  const sub = document.getElementById('cal-page-sub');
  if(!cont) return;

  if(guestMode || !sb || !currentUser){
    cont.innerHTML=''; empty.style.display='block';
    empty.querySelector('div')?.remove();
    empty.innerHTML = '<i class="ti ti-certificate" style="font-size:32px;display:block;margin-bottom:10px;opacity:.5;"></i>En modo de prueba no hay calificaciones reales.';
    return;
  }

  const esDocente = currentUser.rol==='docente' || currentUser.rol==='superadmin';
  document.getElementById('cal-buscar').style.display = esDocente ? '' : 'none';
  document.getElementById('cal-btn-expandir').style.display = esDocente ? '' : 'none';
  if(esDocente) setTimeout(()=>document.getElementById('cal-buscar')?.focus(), 150);
  cont.innerHTML = '<div class="auth-hint">Cargando…</div>'; empty.style.display='none';

  if(!esDocente){
    sub.textContent = currentUser.sesion_nombre ? `Sesión: ${currentUser.sesion_nombre}` : 'Tus calificaciones registradas por tu docente.';
    try {
      const { data, error } = await sb.from('calificaciones').select('*').eq('usuario_id', currentUser.usuario_id).order('creado_en', {ascending:false});
      if(error) throw error;
      if(!data || !data.length){ cont.innerHTML=''; empty.style.display='block'; return; }
      cont.innerHTML = data.map(h => {
        const nivel = nivelCalificacion(h.nota_general);
        return `<div style="padding:14px;border:1px solid var(--c4);border-radius:var(--r2);margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div>
              <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;">${h.categoria || 'General'}</div>
              <div style="font-weight:700;font-size:14.5px;">${h.titulo}</div>
            </div>
            <span class="grade-pill ${nivel}" style="font-size:14px;">${h.nota_general ?? '—'}</span>
          </div>
          ${h.comentario ? `<div style="color:var(--t2);font-size:13px;margin-top:8px;font-style:italic;">"${h.comentario}"</div>` : ''}
          <div style="color:var(--t3);font-size:10.5px;margin-top:8px;">${formatearFechaHora(h.creado_en)}</div>
        </div>`;
      }).join('');
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudieron cargar tus calificaciones: '+(e.message||e)+'</div>';
    }
  } else {
    sub.textContent = currentUser.sesion_nombre ? `Todas las calificaciones que has dado en: ${currentUser.sesion_nombre}` : 'Todas las calificaciones que has dado.';
    try {
      const sesionId = currentUser.sesion_id;
      if(!sesionId){ cont.innerHTML=''; empty.style.display='block'; return; }
      const { data, error } = await sb.from('calificaciones').select('*, usuarios!calificaciones_usuario_id_fkey(nombre)').eq('sesion_id', sesionId).order('creado_en', {ascending:false});
      if(error) throw error;
      if(!data || !data.length){ cont.innerHTML=''; empty.style.display='block'; return; }
      // Guardamos las calificaciones tal cual llegaron para que el botón de
      // editar de esta página pueda encontrarlas sin volver a consultar la nube,
      // y también para poder filtrarlas al escribir sin volver a pedirlas.
      calPageDataMap = {}; data.forEach(h=>{ calPageDataMap[h.id] = h; });
      calPageDataCache = data;
      renderFilasCalificacionesDocente(data);
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudieron cargar las calificaciones: '+(e.message||e)+'</div>';
    }
  }
}

let calPageDataCache = [];
function filtrarCalificacionesPagina(query){
  const q = (query||'').trim().toLowerCase();
  const filtradas = !q ? calPageDataCache : calPageDataCache.filter(h =>
    (h.usuarios?.nombre||'').toLowerCase().includes(q) || (h.titulo||'').toLowerCase().includes(q));
  renderFilasCalificacionesDocente(filtradas, !!q);
}

function renderFilasCalificacionesDocente(data, esFiltro){
  const cont = document.getElementById('cal-lista');
  const empty = document.getElementById('cal-empty');
  if(!cont) return;
  if(!data.length){
    cont.innerHTML = '';
    empty.style.display = 'block';
    empty.innerHTML = `<i class="ti ti-certificate" style="font-size:32px;display:block;margin-bottom:10px;opacity:.5;"></i>${esFiltro?'Ninguna calificación coincide con esa búsqueda.':'Todavía no hay calificaciones registradas.'}`;
    return;
  }
  empty.style.display = 'none';

  // En vez de una lista larga con una fila por cada calificación (un
  // mismo estudiante puede aparecer muchas veces), se agrupa por
  // estudiante: una tarjeta por persona, que se abre al tocarla para ver
  // sus calificaciones — así no hay que desplazarse por todo, ni siquiera
  // buscando, para encontrar a alguien en particular.
  const porEstudiante = {};
  data.forEach(h => {
    const key = h.usuario_id || h.usuarios?.nombre || 'sin-id';
    if(!porEstudiante[key]) porEstudiante[key] = { nombre: h.usuarios?.nombre || 'Estudiante', calificaciones: [] };
    porEstudiante[key].calificaciones.push(h);
  });

  const entradasOrdenadas = Object.entries(porEstudiante).sort((a,b) => a[1].nombre.localeCompare(b[1].nombre, 'es'));
  cont.innerHTML = entradasOrdenadas.map(([key, est], idx) => {
    const notas = est.calificaciones.map(c=>c.nota_general).filter(n=>n!=null);
    const promedio = notas.length ? (notas.reduce((a,b)=>a+Number(b),0)/notas.length) : null;
    const nivelProm = promedio!=null ? nivelCalificacion(Math.round(promedio)) : '';
    const panelId = 'cal-panel-'+idx;
    return `<div style="border:1px solid var(--c4);border-radius:var(--r2);margin-bottom:10px;overflow:hidden;">
      <div style="padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;" onclick="alternarPanelEstudianteCal('${panelId}')">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <i class="ti ti-chevron-right" id="${panelId}-flecha" style="font-size:14px;color:var(--t3);transition:transform .2s;flex-shrink:0;"></i>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:14px;">${est.nombre}</div>
            <div style="font-size:11px;color:var(--t3);">${est.calificaciones.length} ${est.calificaciones.length===1?'calificación':'calificaciones'}</div>
          </div>
        </div>
        ${promedio!=null ? `<span class="grade-pill ${nivelProm}" style="font-size:13px;flex-shrink:0;" title="Promedio">${promedio.toFixed(1)}</span>` : ''}
      </div>
      <div id="${panelId}" style="display:none;padding:0 14px 14px;border-top:1px solid var(--c3);">
        ${est.calificaciones.map(h => {
          const nivel = nivelCalificacion(h.nota_general);
          const nombreEst = est.nombre.replace(/'/g,"\\'");
          return `<div style="padding:12px 0;border-bottom:1px solid var(--c3);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div>
                <div style="font-size:10.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-top:8px;">${h.categoria || 'General'}</div>
                <div style="font-weight:700;font-size:14px;">${h.titulo}</div>
              </div>
              <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span class="grade-pill ${nivel}" style="font-size:13px;">${h.nota_general ?? '—'}</span>
                <button class="btn btn-sm" title="Editar" onclick="event.stopPropagation();editarDesdeCalPage('${h.id}','${nombreEst}')"><i class="ti ti-pencil"></i></button>
              </span>
            </div>
            ${h.comentario ? `<div style="color:var(--t2);font-size:12.5px;margin-top:6px;font-style:italic;">"${h.comentario}"</div>` : ''}
            <div style="color:var(--t3);font-size:10px;margin-top:6px;">${formatearFechaHora(h.creado_en)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  // Si se estaba filtrando por el buscador y solo queda un estudiante en
  // los resultados, se abre solo — no tiene sentido hacerlo tocar dos veces.
  const claves = Object.keys(porEstudiante);
  if(esFiltro && claves.length===1) alternarPanelEstudianteCal('cal-panel-0', true);
}

function alternarPanelEstudianteCal(panelId, forzarAbierto){
  const panel = document.getElementById(panelId);
  const flecha = document.getElementById(panelId+'-flecha');
  if(!panel) return;
  const abrir = forzarAbierto !== undefined ? forzarAbierto : panel.style.display === 'none';
  panel.style.display = abrir ? 'block' : 'none';
  if(flecha) flecha.style.transform = abrir ? 'rotate(90deg)' : 'rotate(0deg)';
}

// Con muchos estudiantes, abrir uno por uno es lento — este botón los
// abre o cierra todos de una vez. Decide qué hacer mirando si la mayoría
// están cerrados (los abre) o abiertos (los cierra).
function alternarTodosPanelesCal(){
  const paneles = document.querySelectorAll('#cal-lista [id^="cal-panel-"]:not([id$="-flecha"])');
  if(!paneles.length) return;
  const cerrados = Array.from(paneles).filter(p => p.style.display === 'none').length;
  const abrirTodos = cerrados >= paneles.length / 2;
  paneles.forEach(p => alternarPanelEstudianteCal(p.id, abrirTodos));
}

// ── Calificación con rúbrica ──
// Califica a varios estudiantes a la vez con la misma categoría, título,
// nota y comentario — pensado para cosas como "Participación en clase",
// donde repetir el mismo modal uno por uno es trabajo de sobra.
function abrirCalificacionMasiva(){
  if(!currentUser || !currentUser.sesion_id) return;
  const estudiantes = rosterProfesorCache.estudiantes || [];
  if(!estudiantes.length){ notify('No hay estudiantes registrados en esta sesión todavía.', 'error'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `<div class="grade-modal" style="max-width:460px;">
    <h3>Calificar a todos</h3>
    <div class="sub">Se crea una calificación idéntica para cada estudiante marcado.</div>
    <div class="grade-field">
      <label>Plantilla rápida (opcional)</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${PLANTILLAS_RUBRICA.map((t,ti) => `<button class="btn btn-sm" data-rubrica="${ti}" style="font-size:11px;">${t.titulo}</button>`).join('')}
      </div>
    </div>
    <div class="grade-field"><label>Categoría</label>
      <select id="cm-categoria">${['Rentabilidad','Gestión de riesgo','Participación','Examen','Otro'].map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    </div>
    <div class="grade-field"><label>Título</label><input type="text" id="cm-titulo" placeholder='Ej. "Participación — semana 3"'></div>
    <div class="grade-field"><label>Nota (0-100)</label><input type="number" id="cm-nota" min="0" max="100" step="0.1"></div>
    <div class="grade-field"><label>Comentario (opcional, igual para todos)</label><input type="text" id="cm-comentario"></div>
    <div class="grade-field">
      <label>Estudiantes (${estudiantes.length})</label>
      <div style="max-height:180px;overflow-y:auto;border:1px solid var(--c4);border-radius:var(--r);padding:8px;">
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px;font-weight:600;border-bottom:1px solid var(--c3);margin-bottom:4px;">
          <input type="checkbox" id="cm-todos" checked style="width:auto;"> Seleccionar todos
        </label>
        ${estudiantes.map(e => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px;">
          <input type="checkbox" class="cm-est" value="${e.id}" checked style="width:auto;"> ${e.nombre}
        </label>`).join('')}
      </div>
    </div>
    <div class="auth-msg" id="cm-msg"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="cm-cancelar" style="flex:1;">Cancelar</button>
      <button class="auth-submit" id="cm-guardar" style="flex:1;margin-top:0;">Calificar seleccionados</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{if(e.target===overlay)overlay.remove();};
  overlay.querySelector('#cm-cancelar').onclick = () => overlay.remove();
  overlay.querySelectorAll('[data-rubrica]').forEach(btn => btn.onclick = () => {
    const t = PLANTILLAS_RUBRICA[+btn.dataset.rubrica];
    overlay.querySelector('#cm-categoria').value = t.categoria;
    overlay.querySelector('#cm-titulo').value = t.titulo;
  });
  overlay.querySelector('#cm-todos').onchange = (e) => {
    overlay.querySelectorAll('.cm-est').forEach(cb => cb.checked = e.target.checked);
  };

  overlay.querySelector('#cm-guardar').onclick = async () => {
    const msg = overlay.querySelector('#cm-msg');
    const categoria = overlay.querySelector('#cm-categoria').value;
    const titulo = overlay.querySelector('#cm-titulo').value.trim();
    const nota = overlay.querySelector('#cm-nota').value;
    const comentario = overlay.querySelector('#cm-comentario').value.trim() || null;
    const seleccionados = Array.from(overlay.querySelectorAll('.cm-est:checked')).map(cb => cb.value);
    if(!titulo){ msg.className='auth-msg show error'; msg.textContent='Ponle un título.'; return; }
    if(!seleccionados.length){ msg.className='auth-msg show error'; msg.textContent='Selecciona al menos un estudiante.'; return; }
    const btn = overlay.querySelector('#cm-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Calificando…';
    try {
      const filas = seleccionados.map(usuario_id => ({
        usuario_id, sesion_id: currentUser.sesion_id, docente_id: currentUser.auth_id,
        categoria, titulo, nota_general: nota===''?null:+nota, comentario,
      }));
      const { error } = await conTiempoLimite(sb.from('calificaciones').insert(filas));
      if(error) throw error;
      overlay.remove();
      notify(`${filas.length} estudiante(s) calificados.`, 'success');
      cargarRosterProfesor();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo calificar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = 'Calificar seleccionados';
    }
  };
}

function abrirModalCalificar(usuarioId, nombre, sesionId, editando){
  const historial = profCalificaciones[usuarioId] || [];
  const esEdicion = !!editando;
  const nombreEsc = nombre.replace(/'/g,"\\'");
  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `
    <div class="grade-modal">
      <h3>${esEdicion ? 'Editar calificación' : 'Calificar a '+nombre}</h3>
      <div class="sub">${esEdicion ? `Estás editando una calificación de ${nombre}.` : 'Puedes agregar varias calificaciones distintas para el mismo estudiante (exámenes, participación, etc.). El estudiante sí puede ver estas calificaciones en su sección "Calificaciones".'}</div>
      ${esEdicion ? '' : `
      <div class="grade-field">
        <label>Plantilla rápida (opcional)</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${PLANTILLAS_RUBRICA.map((t,ti) => `<button class="btn btn-sm" data-rubrica="${ti}" style="font-size:11px;">${t.titulo}</button>`).join('')}
        </div>
      </div>`}
      <div class="grade-field">
        <label>Categoría</label>
        <select id="gm-categoria">
          ${['Rentabilidad','Gestión de riesgo','Participación','Examen','Otro'].map(c=>
            `<option value="${c}" ${editando?.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="grade-field">
        <label>Título</label>
        <input type="text" id="gm-titulo" value="${editando?.titulo ? editando.titulo.replace(/"/g,'&quot;') : ''}" placeholder='Ej. "Examen parcial — Mercado de acciones"'>
      </div>
      <div class="grade-field">
        <label>Nota (0–100)</label>
        <input type="number" min="0" max="100" id="gm-nota" value="${editando && editando.nota_general!=null ? editando.nota_general : ''}" placeholder="Ej. 85">
      </div>
      <div class="grade-field">
        <label>Comentario (opcional)</label>
        <textarea id="gm-comentario" placeholder="Observaciones para el estudiante…">${editando?.comentario || ''}</textarea>
      </div>
      <div class="auth-msg" id="gm-msg"></div>
      <div style="display:flex;gap:10px;">
        ${esEdicion ? `<button class="btn btn-sm" id="gm-borrar" title="Borrar esta calificación" style="flex:0;color:var(--red);"><i class="ti ti-trash"></i></button>` : ''}
        <button class="btn btn-ghost" id="gm-cancelar" style="flex:1;">Cancelar</button>
        <button class="auth-submit" id="gm-guardar" style="flex:1;margin-top:0;">${esEdicion ? 'Guardar cambios' : 'Guardar calificación'}</button>
      </div>
      ${historial.length ? `
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--c4);">
          <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Calificaciones anteriores</div>
          ${historial.map(h => `
            <div style="padding:8px 0;border-bottom:1px solid var(--c3);font-size:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-weight:600;">${h.titulo}</span>
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="color:var(--accent2);font-weight:700;">${h.nota_general ?? '—'}</span>
                  <button class="btn btn-sm" style="padding:3px 7px;" title="Editar esta calificación" onclick="abrirEdicionCalificacion('${usuarioId}','${nombreEsc}','${sesionId}','${h.id}')"><i class="ti ti-pencil" style="font-size:11px;"></i></button>
                </span>
              </div>
              <div style="color:var(--t3);font-size:10.5px;">${h.categoria || 'General'} · ${formatearFechaHora(h.creado_en)}</div>
              ${h.comentario ? `<div style="color:var(--t2);margin-top:3px;">"${h.comentario}"</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{ if(e.target===overlay) overlay.remove(); };
  overlay.querySelector('#gm-cancelar').onclick = () => overlay.remove();
  overlay.querySelectorAll('[data-rubrica]').forEach(btn => btn.onclick = () => {
    const t = PLANTILLAS_RUBRICA[+btn.dataset.rubrica];
    overlay.querySelector('#gm-categoria').value = t.categoria;
    overlay.querySelector('#gm-titulo').value = t.titulo;
  });
  if(esEdicion && overlay.querySelector('#gm-borrar')){
    overlay.querySelector('#gm-borrar').onclick = async () => {
      if(!confirm(`¿Borrar la calificación "${editando.titulo}"? Esto no se puede deshacer.`)) return;
      const btn = overlay.querySelector('#gm-borrar');
      btn.disabled = true;
      try {
        const { error } = await conTiempoLimite(sb.from('calificaciones').delete().eq('id', editando.id));
        if(error) throw error;
        overlay.remove();
        notify('Calificación borrada.', 'success');
        refrescarVistasCalificaciones();
      } catch(e){
        const msg = overlay.querySelector('#gm-msg');
        msg.className='auth-msg show error'; msg.textContent = 'No se pudo borrar: ' + (e.message||e);
        btn.disabled = false;
      }
    };
  }
  overlay.querySelector('#gm-guardar').onclick = async () => {
    const msg = overlay.querySelector('#gm-msg');
    const categoria = overlay.querySelector('#gm-categoria').value;
    const titulo = overlay.querySelector('#gm-titulo').value.trim();
    const notaVal = overlay.querySelector('#gm-nota').value.trim();
    const nota = notaVal==='' ? null : Number(notaVal);
    const comentario = overlay.querySelector('#gm-comentario').value.trim() || null;
    if(!titulo){ msg.className='auth-msg show error'; msg.textContent='Ponle un título a la calificación.'; return; }
    if(nota!==null && (isNaN(nota) || nota<0 || nota>100)){ msg.className='auth-msg show error'; msg.textContent='La nota debe estar entre 0 y 100.'; return; }

    const btn = overlay.querySelector('#gm-guardar');
    btn.disabled = true; btn.innerHTML = '<span class="auth-spinner"></span> Guardando…';
    try {
      if(esEdicion){
        const { error } = await conTiempoLimite(sb.from('calificaciones').update({
          categoria, titulo, nota_general: nota, comentario, actualizado_en: new Date().toISOString(),
        }).eq('id', editando.id));
        if(error) throw error;
      } else {
        const { error } = await conTiempoLimite(sb.from('calificaciones').insert({
          usuario_id: usuarioId, sesion_id: sesionId, docente_id: currentUser.auth_id,
          categoria, titulo, nota_general: nota, comentario,
        }));
        if(error) throw error;
      }
      overlay.remove();
      notify(esEdicion ? 'Calificación actualizada.' : 'Calificación guardada.', 'success');
      refrescarVistasCalificaciones();
    } catch(e){
      msg.className='auth-msg show error'; msg.textContent = 'No se pudo guardar: ' + (e.message||e);
      btn.disabled = false; btn.textContent = esEdicion ? 'Guardar cambios' : 'Guardar calificación';
    }
  };
}

// Cierra cualquier modal de calificar/detalle abierto y reabre el modal de
// calificar en modo edición, con los datos de esa calificación ya cargados.
function abrirEdicionCalificacion(usuarioId, nombre, sesionId, calId){
  document.querySelectorAll('.grade-modal-overlay').forEach(o=>o.remove());
  const historial = profCalificaciones[usuarioId] || [];
  const cal = historial.find(h=>h.id===calId);
  if(!cal){ notify('No se encontró la calificación.', 'error'); return; }
  abrirModalCalificar(usuarioId, nombre, sesionId, cal);
}

// Botón "Ver" del roster: resumen completo del estudiante sin llenar la
// tabla principal de columnas — cartera detallada + todas sus calificaciones.
// Mini-gráfica de línea (SVG) para mostrar la evolución del valor de cartera
// a lo largo de la sesión, sin depender de ninguna librería externa.
function graficaEvolucionSVG(puntos){
  if(!puntos || puntos.length < 2) return '<div class="auth-hint">Todavía no hay suficientes datos para graficar la evolución (se necesitan al menos dos puntos).</div>';
  const w = 460, h = 120, pad = 8;
  const valores = puntos.map(p=>p.valor);
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = (max - min) || 1;
  const xStep = (w - pad*2) / (puntos.length - 1);
  const coords = puntos.map((p,i) => {
    const x = pad + i*xStep;
    const y = h - pad - ((p.valor - min) / rango) * (h - pad*2);
    return [x,y];
  });
  const linea = coords.map(([x,y],i) => (i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
  const area = linea + ` L${coords[coords.length-1][0].toFixed(1)},${h-pad} L${coords[0][0].toFixed(1)},${h-pad} Z`;
  const ultimo = puntos[puntos.length-1];
  const primero = puntos[0];
  const subio = ultimo.valor >= primero.valor;
  const color = subio ? '#00d084' : '#ff4757';
  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block;">
      <path d="${area}" fill="${color}" opacity="0.08"></path>
      <path d="${linea}" fill="none" stroke="${color}" stroke-width="2"></path>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--t3);margin-top:4px;">
      <span>${formatearFechaHora(primero.fecha)} · $${primero.valor.toLocaleString('es-PA')}</span>
      <span>${formatearFechaHora(ultimo.fecha)} · $${ultimo.valor.toLocaleString('es-PA')}</span>
    </div>`;
}

function abrirDetalleEstudiante(usuarioId, nombre, sesionId){
  const port = profPortafolios[usuarioId] || {};
  const historial = profCalificaciones[usuarioId] || [];
  const labHist = port.lab_historial || [];
  const retorno = port.retorno_pct!=null ? Number(port.retorno_pct) : null;
  const retornoTxt = retorno!==null ? (retorno>=0?'+':'')+retorno.toFixed(2)+'%' : '—';
  const retornoColor = retorno===null ? 'var(--t3)' : (retorno>=0 ? 'var(--green)' : 'var(--red)');
  const nombreEsc = nombre.replace(/'/g,"\\'");

  const overlay = document.createElement('div');
  overlay.className = 'grade-modal-overlay';
  overlay.innerHTML = `
    <div class="grade-modal" style="max-width:520px;">
      <h3>${nombre}</h3>
      <div class="sub">Resumen de su sesión</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;">
        <div style="background:var(--c2);border-radius:var(--r);padding:12px;">
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;">Efectivo disponible</div>
          <div style="font-size:16px;font-weight:700;">${port.efectivo_disponible!=null ? '$'+Number(port.efectivo_disponible).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</div>
        </div>
        <div style="background:var(--c2);border-radius:var(--r);padding:12px;">
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;">Valor total de cartera</div>
          <div style="font-size:16px;font-weight:700;">${port.valor_total!=null ? '$'+Number(port.valor_total).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</div>
        </div>
        <div style="background:var(--c2);border-radius:var(--r);padding:12px;">
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;">Retorno</div>
          <div style="font-size:16px;font-weight:700;color:${retornoColor};">${retornoTxt}</div>
        </div>
        <div style="background:var(--c2);border-radius:var(--r);padding:12px;">
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;">Operaciones registradas</div>
          <div style="font-size:16px;font-weight:700;">${port.num_operaciones ?? 0}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:14px;">Última actividad: ${port.ultima_actividad ? formatearFechaHora(port.ultima_actividad) : 'Sin actividad registrada'}</div>

      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Evolución del valor de cartera</div>
      ${graficaEvolucionSVG(port.valor_historial)}

      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px;border-top:1px solid var(--c4);padding-top:14px;">Asistencia</div>
      <div id="det-asistencia"><div class="auth-hint">Cargando…</div></div>

      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px;border-top:1px solid var(--c4);padding-top:14px;">Logros</div>
      <div id="det-logros"><div class="auth-hint">Cargando…</div></div>

      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;border-top:1px solid var(--c4);padding-top:14px;">
        Sesiones de Laboratorio (${labHist.length})
      </div>
      ${labHist.length ? labHist.map(h => `
        <div style="padding:8px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-weight:600;">${h.strat || 'Estrategia sin nombre'}</span>
            <span style="color:${h.passed?'var(--green)':'var(--red)'};font-weight:700;">${h.achieved!=null?h.achieved+'%':'—'}</span>
          </div>
          <div style="color:var(--t3);font-size:10.5px;">${h.perfil||''} · ${h.months||'—'} meses · meta ${h.target??'—'}% · ${h.passed?'Cumplida':'No cumplida'} · ${h.date||''}</div>
        </div>
      `).join('') : '<div class="auth-hint">Todavía no tiene sesiones de laboratorio.</div>'}

      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px;border-top:1px solid var(--c4);padding-top:14px;">
        Calificaciones (${historial.length})
      </div>
      ${historial.length ? historial.map(h => `
        <div style="padding:8px 0;border-bottom:1px solid var(--c3);font-size:12.5px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-weight:600;">${h.titulo}</span>
            <span style="display:flex;align-items:center;gap:6px;">
              <span style="color:var(--accent2);font-weight:700;">${h.nota_general ?? '—'}</span>
              <button class="btn btn-sm" style="padding:3px 7px;" title="Editar" onclick="abrirEdicionCalificacion('${usuarioId}','${nombreEsc}','${sesionId}','${h.id}')"><i class="ti ti-pencil" style="font-size:11px;"></i></button>
            </span>
          </div>
          <div style="color:var(--t3);font-size:10.5px;">${h.categoria || 'General'} · ${formatearFechaHora(h.creado_en)}</div>
          ${h.comentario ? `<div style="color:var(--t2);margin-top:3px;">"${h.comentario}"</div>` : ''}
        </div>
      `).join('') : '<div class="auth-hint">Todavía no tiene calificaciones.</div>'}

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-ghost" id="det-cerrar" style="flex:1;">Cerrar</button>
        <button class="btn" id="det-exportar" title="Informe rápido"><i class="ti ti-file-type-pdf"></i></button>
        <button class="btn" id="det-portafolio" style="background:rgba(212,175,55,.12);color:var(--gold);border:1px solid rgba(212,175,55,.3);" title="Portafolio de Evidencias completo"><i class="ti ti-folder-star"></i> Portafolio de Evidencias</button>
        <button class="auth-submit" id="det-calificar" style="flex:1;margin-top:0;">Calificar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{ if(e.target===overlay) overlay.remove(); };
  overlay.querySelector('#det-cerrar').onclick = () => overlay.remove();
  overlay.querySelector('#det-exportar').onclick = () => exportarInformeEstudiantePDF(usuarioId, nombreEsc, sesionId);
  overlay.querySelector('#det-portafolio').onclick = () => exportarPortafolioEvidenciasPDF(usuarioId, nombreEsc, sesionId);
  overlay.querySelector('#det-calificar').onclick = () => { overlay.remove(); abrirModalCalificar(usuarioId, nombre, sesionId); };

  (async () => {
    const cont = overlay.querySelector('#det-asistencia');
    if(!cont) return;
    try {
      const { data, error } = await sb.from('asistencia').select('fecha,presente').eq('usuario_id', usuarioId).eq('sesion_id', sesionId).order('fecha',{ascending:false});
      if(error) throw error;
      if(!data || !data.length){ cont.innerHTML = '<div class="auth-hint">Todavía no se ha registrado asistencia.</div>'; return; }
      const presentes = data.filter(a=>a.presente).length;
      cont.innerHTML = `
        <div style="font-size:13px;margin-bottom:8px;"><b>${presentes}</b> de <b>${data.length}</b> jornadas registradas</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${data.slice(0,20).map(a=>`<span title="${a.fecha}" style="width:20px;height:20px;border-radius:4px;background:${a.presente?'var(--green)':'var(--red)'};opacity:.8;"></span>`).join('')}
        </div>`;
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudo cargar la asistencia.</div>';
    }
  })();

  (async () => {
    const cont = overlay.querySelector('#det-logros');
    if(!cont) return;
    try {
      const { data, error } = await sb.from('logros_desbloqueados').select('codigo_logro').eq('usuario_id', usuarioId).eq('sesion_id', sesionId);
      if(error) throw error;
      const codigos = (data||[]).map(d=>d.codigo_logro).filter(c=>CATALOGO_LOGROS[c]);
      if(!codigos.length){ cont.innerHTML = '<div class="auth-hint">Todavía no ha desbloqueado ningún logro.</div>'; return; }
      cont.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${codigos.map(c => { const l = CATALOGO_LOGROS[c]; return `<span title="${l.desc}" style="display:flex;align-items:center;gap:5px;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);border-radius:14px;padding:4px 10px 4px 6px;font-size:11px;"><i class="ti ${l.icono}" style="font-size:13px;color:var(--gold);"></i>${l.titulo}</span>`; }).join('')}
      </div>`;
    } catch(e){
      cont.innerHTML = '<div class="auth-hint">No se pudieron cargar los logros.</div>';
    }
  })();
}

async function authBoot(){
  // ═══════════════════════════════════════════════════════════════
  // ENLACE DIRECTO DESDE OTRA HERRAMIENTA DE CAPITALLAB — Academy o
  // Analytics pueden mandar aquí un activo específico (y, desde
  // Analytics, el resumen de una tesis ya generada con IA), para que
  // el estudiante llegue directo al contexto correcto, sin tener que
  // buscarlo de nuevo. Se guarda ahora, antes de iniciar sesión, y se
  // aplica después de que la app arranque de verdad.
  // ═══════════════════════════════════════════════════════════════
  const paramsEnlace = new URLSearchParams(window.location.search);
  if(paramsEnlace.get('ticker')){
    window.__enlaceDirectoCapitalLab = {
      ticker: paramsEnlace.get('ticker'),
      tipo: paramsEnlace.get('tipo') || 'accion',
      origen: paramsEnlace.get('origen') || null,
      tesis: paramsEnlace.get('tesis') ? decodeURIComponent(paramsEnlace.get('tesis')) : null,
    };
  }

  // Si se entra desde un enlace o código QR compartido (?codigo=XXXXX), se
  // deja la pestaña de registro lista, en modo estudiante, con el código
  // ya escrito — así solo falta poner nombre, correo y contraseña.
  const parametros = new URLSearchParams(window.location.search);
  const codigoURL = parametros.get('codigo');
  if(codigoURL){
    const campo = document.getElementById('signup-sesion-codigo');
    if(campo) campo.value = codigoURL.toUpperCase();
    if(typeof authSetRole==='function') authSetRole('estudiante');
    if(typeof authSwitchView==='function') authSwitchView('signup');
  }
  // Si se entra desde el enlace del correo de "recuperar contraseña",
  // Supabase deja "type=recovery" en la URL. Antes, la app no revisaba
  // esto para nada: entraba directo a la cuenta con la contraseña VIEJA
  // todavía activa, sin darle nunca la oportunidad de poner una nueva.
  // Esta bandera evita ese auto-inicio de sesión mientras se muestra la
  // pantalla de "Crea tu contraseña nueva".
  const esEnlaceDeRecuperacion = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
  if(esEnlaceDeRecuperacion && typeof authSwitchView==='function') authSwitchView('nueva-password');

  if(!authConfigured()){
    authMsg('Este archivo aún no tiene configuradas las credenciales de Supabase (SUPABASE_URL / SUPABASE_ANON_KEY). Edítalas antes de usar el inicio de sesión, o usa el modo de prueba sin cuenta.', 'error');
    return;
  }
  if(typeof supabase === 'undefined'){
    authMsg('No se pudo cargar la librería de Supabase (revisa tu conexión a internet). Puedes usar el modo de prueba sin cuenta mientras tanto.', 'error');
    return;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if(session && !esEnlaceDeRecuperacion){
      await authLoadProfileAndEnter();
    }
    // Antes, si el token de sesión quedaba vencido o inválido (algo común
    // en Safari de iOS cuando el celular estuvo dormido o cambió de red
    // por mucho tiempo), la app se quedaba en un estado a medias: parecía
    // que seguías con la sesión iniciada, pero cada consulta a la base de
    // datos fallaba en silencio por las reglas de seguridad, así que todo
    // se veía simplemente "vacío" (sin cuestionarios, sin nada) sin ningún
    // aviso de qué estaba pasando. Esto lo detecta y avisa claramente.
    sb.auth.onAuthStateChange((evento, sesionNueva) => {
      if(evento === 'PASSWORD_RECOVERY' && typeof authSwitchView==='function'){
        authSwitchView('nueva-password');
        return;
      }
      if(evento === 'SIGNED_OUT' && currentUser && !guestMode){
        currentUser = null;
        alert('Tu sesión expiró o se cerró en otro lugar. Por favor, vuelve a iniciar sesión.');
        location.reload();
      }
    });
    iniciarVigilanciaDeSesion();
  } catch(e){
    authMsg('No se pudo conectar con el servidor: ' + (e.message||e) + '. Puedes usar el modo de prueba sin cuenta mientras tanto.', 'error');
  }
}
document.addEventListener('DOMContentLoaded', authBoot);

// Revisa cada cierto tiempo, y cada vez que el celular "despierta" la
// pestaña (por ejemplo, tras tener la pantalla bloqueada un rato largo),
// que la sesión siga siendo válida DE VERDAD contra el servidor — no solo
// que exista un token guardado localmente, que es lo que fallaba antes.
let intervaloVigilanciaSesion = null;
function iniciarVigilanciaDeSesion(){
  if(intervaloVigilanciaSesion) clearInterval(intervaloVigilanciaSesion);
  intervaloVigilanciaSesion = setInterval(verificarSesionValida, 5 * 60000);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') verificarSesionValida();
  });
}
async function verificarSesionValida(){
  if(!sb || !currentUser || guestMode) return;
  try {
    const { data: { user }, error } = await sb.auth.getUser();
    if(error || !user){
      currentUser = null;
      alert('Tu sesión expiró. Por favor, vuelve a iniciar sesión para seguir usando CapitalLab.');
      location.reload();
    }
  } catch(e){ /* problema de red pasajero: no interrumpir, se reintenta en el próximo chequeo */ }
}

// ═══════════════════ DATA ═══════════════════
const RF=4.5;
const ALL_STOCKS=[
  {id:'AAPL',name:'Apple Inc.',ticker:'AAPL',sector:'Tecnología',country:'EE.UU.',price:189.5,beta:1.19,sigma:22.1,ret:12.4,profile:'Apple Inc. fundada en 1976 por Steve Jobs. Mayor capitalización del mundo. iPhone domina cerca del 17% del mercado global de teléfonos inteligentes. Ingresos año fiscal 2024: $391B. Utilidad neta: $93.7B. Calificación crediticia: AAA.',rating:'AAA',dividend:0.92,type:'accion',
   fs:{
     income:[
       {year:2024,revenue:391035,grossProfit:180683,ebit:123216,netIncome:93736},
       {year:2023,revenue:383285,grossProfit:169148,ebit:114301,netIncome:96995},
       {year:2022,revenue:394328,grossProfit:170782,ebit:119437,netIncome:99803},
     ],
     balance:[
       {year:2024,assets:364980,liabilities:308030,equity:56950,cash:29943,debt:106629},
       {year:2023,assets:352583,liabilities:290437,equity:62146,cash:29965,debt:111088},
       {year:2022,assets:352755,liabilities:302083,equity:50672,cash:23646,debt:120069},
     ],
     cashflow:[
       {year:2024,operating:118254,investing:2935,financing:-121983},
       {year:2023,operating:110543,investing:3705,financing:-108488},
       {year:2022,operating:122151,investing:-22354,financing:-110749},
     ]
   }
  },
  {id:'MSFT',name:'Microsoft Corp.',ticker:'MSFT',sector:'Tecnología',country:'EE.UU.',price:415.3,beta:0.94,sigma:18.7,ret:10.8,profile:'Microsoft fundada en 1975 por Bill Gates y Paul Allen. Líder en software empresarial, sistemas operativos y la nube Azure. Inversión estratégica de gran escala en OpenAI e inteligencia artificial. Ingresos año fiscal 2024: $245.1B. Utilidad neta: $88.1B. Calificación crediticia: AAA.',rating:'AAA',dividend:0.75,type:'accion',
   fs:{
     income:[
       {year:2024,revenue:245122,grossProfit:171008,ebit:109433,netIncome:88136},
       {year:2023,revenue:211915,grossProfit:146052,ebit:88523,netIncome:72361},
       {year:2022,revenue:198270,grossProfit:135620,ebit:83383,netIncome:72738},
     ],
     balance:[
       {year:2024,assets:512163,liabilities:243686,equity:268477,cash:75543,debt:67127},
       {year:2023,assets:411976,liabilities:205753,equity:206223,cash:34704,debt:59965},
       {year:2022,assets:364840,liabilities:198298,equity:166542,cash:13931,debt:61270},
     ],
     cashflow:[
       {year:2024,operating:118548,investing:-96471,financing:-46282},
       {year:2023,operating:87582,investing:-22680,financing:-43935},
       {year:2022,operating:89035,investing:-30311,financing:-58876},
     ]
   }
  },
  {id:'AMZN',name:'Amazon.com Inc.',ticker:'AMZN',sector:'Comercio/Nube',country:'EE.UU.',price:185.7,beta:1.31,sigma:27.4,ret:15.2,profile:'Amazon fundada en 1994 por Jeff Bezos. 38% del e-commerce EE.UU. AWS lidera la nube global con 31%. Ingresos 2023: $575B.',rating:'AA+',dividend:0,type:'accion',
   fs:{
     income:[
       {year:2023,revenue:574785,grossProfit:270042,ebit:36852,netIncome:30425},
       {year:2022,revenue:513983,grossProfit:225152,ebit:12248,netIncome:-2722},
       {year:2021,revenue:469822,grossProfit:197478,ebit:24879,netIncome:33364},
     ],
     balance:[
       {year:2023,assets:527854,liabilities:369272,equity:158578,cash:73387,debt:67150},
       {year:2022,assets:462675,liabilities:316633,equity:146042,cash:53888,debt:67765},
       {year:2021,assets:420549,liabilities:282304,equity:138245,cash:96049,debt:48744},
     ],
     cashflow:[
       {year:2023,operating:84946,investing:-49833,financing:-15879},
       {year:2022,operating:46752,investing:-37601,financing:9718},
       {year:2021,operating:46327,investing:-58154,financing:6291},
     ]
   }
  },
  {id:'TSLA',name:'Tesla Inc.',ticker:'TSLA',sector:'Automotriz/EV',country:'EE.UU.',price:248.6,beta:2.04,sigma:54.8,ret:22.3,profile:'Tesla fundada en 2003. Líder en EVs con 20% del mercado global. CEO Elon Musk. Gigafactories en EE.UU., China y Alemania. Ingresos 2023: $97B.',rating:'BBB',dividend:0,type:'accion',
   fs:{
     income:[
       {year:2023,revenue:96773,grossProfit:17660,ebit:8891,netIncome:14997},
       {year:2022,revenue:81462,grossProfit:20853,ebit:13656,netIncome:12556},
       {year:2021,revenue:53823,grossProfit:13606,ebit:6523,netIncome:5519},
     ],
     balance:[
       {year:2023,assets:106618,liabilities:43009,equity:62634,cash:29094,debt:2656},
       {year:2022,assets:82338,liabilities:36440,equity:44704,cash:22185,debt:1597},
       {year:2021,assets:62131,liabilities:30548,equity:30189,cash:17576,debt:5245},
     ],
     cashflow:[
       {year:2023,operating:13256,investing:-15584,financing:2589},
       {year:2022,operating:14724,investing:-11973,financing:-3527},
       {year:2021,operating:11497,investing:-7868,financing:-5203},
     ]
   }
  },
  {id:'NVDA',name:'NVIDIA Corp.',ticker:'NVDA',sector:'Semiconductores/IA',country:'EE.UU.',price:876.4,beta:1.72,sigma:48.2,ret:38.7,profile:'NVIDIA fundada en 1993 por Jensen Huang. Posición dominante en GPUs para inteligencia artificial y centros de datos, con más del 80% del mercado. Capitalización de mercado superó los $3 billones en 2025. Ingresos año fiscal 2025: $130.5B. Motor central de la infraestructura de IA a nivel mundial.',rating:'A+',dividend:0.16,type:'accion',
   fs:{
     income:[
       {year:2025,revenue:130497,grossProfit:97858,ebit:81454,netIncome:72880},
       {year:2024,revenue:60922,grossProfit:44301,ebit:32972,netIncome:29760},
       {year:2023,revenue:26974,grossProfit:15356,ebit:4224,netIncome:4368},
     ],
     balance:[
       {year:2025,assets:111601,liabilities:32274,equity:79327,cash:43210,debt:8460},
       {year:2024,assets:65728,liabilities:22975,equity:42978,cash:25984,debt:8462},
       {year:2023,assets:41193,liabilities:17575,equity:22101,cash:13296,debt:9709},
     ],
     cashflow:[
       {year:2025,operating:64089,investing:-20421,financing:-24930},
       {year:2024,operating:28090,investing:-10610,financing:-13633},
       {year:2023,operating:5641,investing:-9830,financing:1865},
     ]
   }
  },
  {id:'JPM',name:'JPMorgan Chase',ticker:'JPM',sector:'Banca',country:'EE.UU.',price:202.4,beta:1.12,sigma:19.4,ret:9.8,profile:'JPMorgan Chase fundado en 1799. Mayor banco de EE.UU. por activos ($3.9T). CEO Jamie Dimon. Operaciones en 100+ países. Dividend yield: 2.3%.',rating:'A+',dividend:4.60,type:'accion',
   fs:{
     income:[
       {year:2023,revenue:158104,grossProfit:null,ebit:null,netIncome:49552},
       {year:2022,revenue:128695,grossProfit:null,ebit:null,netIncome:37676},
       {year:2021,revenue:121649,grossProfit:null,ebit:null,netIncome:48334},
     ],
     balance:[
       {year:2023,assets:3875393,liabilities:3534419,equity:327921,cash:575681,debt:292392},
       {year:2022,assets:3665743,liabilities:3341226,equity:292332,cash:477247,debt:300168},
       {year:2021,assets:3743567,liabilities:3432060,equity:294127,cash:702017,debt:272921},
     ],
     cashflow:[
       {year:2023,operating:0,investing:0,financing:0},
       {year:2022,operating:0,investing:0,financing:0},
       {year:2021,operating:0,investing:0,financing:0},
     ]
   }
  },
  {id:'BVPS',name:'Bancolombia S.A.',ticker:'CIB',sector:'Banca regional',country:'Colombia',price:28.4,beta:0.88,sigma:21.6,ret:8.9,profile:'Bancolombia fundado en 1945. Mayor banco de Colombia. Opera en 9 países latinoamericanos. Activos: $75B USD. Dividend yield: 5–7%.',rating:'BBB-',dividend:1.80,type:'accion',
   fs:{
     income:[
       {year:2023,revenue:6840,grossProfit:null,ebit:null,netIncome:1420},
       {year:2022,revenue:5980,grossProfit:null,ebit:null,netIncome:1280},
       {year:2021,revenue:4650,grossProfit:null,ebit:null,netIncome:820},
     ],
     balance:[
       {year:2023,assets:75200,liabilities:68400,equity:6800,cash:4200,debt:12500},
       {year:2022,assets:68900,liabilities:62800,equity:6100,cash:3800,debt:11200},
       {year:2021,assets:60400,liabilities:55100,equity:5300,cash:3100,debt:9800},
     ],
     cashflow:[
       {year:2023,operating:2400,investing:-900,financing:-700},
       {year:2022,operating:2100,investing:-800,financing:-600},
       {year:2021,operating:1900,investing:-700,financing:-550},
     ]
   }
  },
  {id:'BLX',name:'Bladex',ticker:'BLX',sector:'Banca regional',country:'Panamá',price:59.06,beta:0.82,sigma:19.8,ret:11.4,profile:'Banco Latinoamericano de Comercio Exterior (Bladex), fundado en 1977 y con sede en Ciudad de Panamá. Creado originalmente por los bancos centrales de 23 países de América Latina y el Caribe para promover el comercio exterior y la integración económica de la región. Cotiza en la Bolsa de Nueva York (NYSE) desde 1992. Utilidad neta récord de $205.9M en 2024 (+24% interanual), con un retorno sobre patrimonio (ROE) de 16.2%.',rating:'BBB',dividend:2.75,type:'accion',
   fs:{
     income:[
       {year:2024,revenue:303,grossProfit:null,ebit:null,netIncome:205.9},
       {year:2023,revenue:266,grossProfit:null,ebit:null,netIncome:166.2},
       {year:2022,revenue:180,grossProfit:null,ebit:null,netIncome:92.0},
     ],
     balance:[
       {year:2024,assets:11988,liabilities:10717,equity:1271,cash:1918,debt:6588},
       {year:2023,assets:10543,liabilities:9412,equity:1131,cash:1400,debt:5789},
       {year:2022,assets:9064,liabilities:8030,equity:1034,cash:1269,debt:4967},
     ],
     cashflow:[
       {year:2024,operating:210,investing:-1160,financing:940},
       {year:2023,operating:175,investing:-980,financing:790},
       {year:2022,operating:95,investing:-620,financing:510},
     ]
   }
  },
  {id:'GOOGL',name:'Alphabet Inc.',ticker:'GOOGL',sector:'Tecnología',country:'EE.UU.',price:171.4,beta:1.05,sigma:24.3,ret:11.2,rating:'AA+',dividend:0.0,type:'accion',profile:'Alphabet Inc. es una empresa del sector tecnología con domicilio en EE.UU.. Cotiza bajo el símbolo GOOGL con beta de 1.05 y volatilidad anualizada de 24.3%. Calificación crediticia AA+.',
   fs:{
     income:[
       {year:2023,revenue:307394,grossProfit:182527,ebit:84293,netIncome:73795},
       {year:2022,revenue:282836,grossProfit:156633,ebit:74842,netIncome:59972},
       {year:2021,revenue:257637,grossProfit:146698,ebit:78714,netIncome:76033},
     ],
     balance:[
       {year:2023,assets:402392,liabilities:119013,equity:283379,cash:110916,debt:28746},
       {year:2022,assets:365264,liabilities:109120,equity:256144,cash:113762,debt:29677},
       {year:2021,assets:359268,liabilities:107633,equity:251635,cash:139649,debt:28505},
     ],
     cashflow:[
       {year:2023,operating:101746,investing:-27063,financing:-71265},
       {year:2022,operating:91495,investing:-20298,financing:-69757},
       {year:2021,operating:91652,investing:-35523,financing:-61362},
     ]
   }
  },
  {id:'META',name:'Meta Platforms',ticker:'META',sector:'Tecnología',country:'EE.UU.',price:502.3,beta:1.21,sigma:29.8,ret:13.5,rating:'AA',dividend:0.0,type:'accion',profile:'Meta Platforms es una empresa del sector tecnología con domicilio en EE.UU.. Cotiza bajo el símbolo META con beta de 1.21 y volatilidad anualizada de 29.8%. Calificación crediticia AA.',
   fs:{
     income:[
       {year:2023,revenue:134902,grossProfit:108936,ebit:46751,netIncome:39098},
       {year:2022,revenue:116609,grossProfit:93457,ebit:28944,netIncome:23200},
       {year:2021,revenue:117929,grossProfit:97362,ebit:46753,netIncome:39370},
     ],
     balance:[
       {year:2023,assets:229623,liabilities:53935,equity:153168,cash:41862,debt:18385},
       {year:2022,assets:185727,liabilities:60014,equity:125713,cash:40738,debt:9923},
       {year:2021,assets:165987,liabilities:41108,equity:124879,cash:47998,debt:0},
     ],
     cashflow:[
       {year:2023,operating:71113,investing:-27931,financing:-19500},
       {year:2022,operating:50475,investing:-28970,financing:-22136},
       {year:2021,operating:57683,investing:-7572,financing:-50728},
     ]
   }
  },
  {id:'BRK',name:'Berkshire Hathaway',ticker:'BRK.B',sector:'Finanzas',country:'EE.UU.',price:408.7,beta:0.88,sigma:16.2,ret:9.1,rating:'AAA',dividend:0.0,type:'accion',profile:'Berkshire Hathaway es una empresa del sector finanzas con domicilio en EE.UU.. Cotiza bajo el símbolo BRK.B con beta de 0.88 y volatilidad anualizada de 16.2%. Calificación crediticia AAA.',
   fs:{
     income:[
       {year:2023,revenue:364482,grossProfit:0,ebit:0,netIncome:96223},
       {year:2022,revenue:302089,grossProfit:0,ebit:0,netIncome:-22819},
       {year:2021,revenue:276094,grossProfit:0,ebit:0,netIncome:89795},
     ],
     balance:[
       {year:2023,assets:1069978,liabilities:508924,equity:561054,cash:167640,debt:128299},
       {year:2022,assets:948452,liabilities:476667,equity:471785,cash:128651,debt:122139},
       {year:2021,assets:958784,liabilities:444010,equity:514770,cash:146715,debt:118599},
     ],
     cashflow:[
       {year:2023,operating:49185,investing:-31570,financing:-9497},
       {year:2022,operating:37239,investing:-44329,financing:4769},
       {year:2021,operating:39713,investing:-29998,financing:-15966},
     ]
   }
  },
  {id:'JNJ',name:'Johnson & Johnson',ticker:'JNJ',sector:'Salud',country:'EE.UU.',price:152.8,beta:0.54,sigma:14.1,ret:7.2,rating:'AAA',dividend:3.05,type:'accion',profile:'Johnson & Johnson es una empresa del sector salud con domicilio en EE.UU.. Cotiza bajo el símbolo JNJ con beta de 0.54 y volatilidad anualizada de 14.1%. Calificación crediticia AAA.',
   fs:{
     income:[
       {year:2023,revenue:85159,grossProfit:57050,ebit:24461,netIncome:35153},
       {year:2022,revenue:94943,grossProfit:63451,ebit:24578,netIncome:17941},
       {year:2021,revenue:93775,grossProfit:62450,ebit:24011,netIncome:20878},
     ],
     balance:[
       {year:2023,assets:167558,liabilities:118046,equity:68761,cash:21859,debt:29322},
       {year:2022,assets:187378,liabilities:110574,equity:76804,cash:23519,debt:39592},
       {year:2021,assets:182018,liabilities:108457,equity:74023,cash:31635,debt:33510},
     ],
     cashflow:[
       {year:2023,operating:22791,investing:-16001,financing:-13780},
       {year:2022,operating:21194,investing:-9258,financing:-13407},
       {year:2021,operating:23393,investing:-7591,financing:-13670},
     ]
   }
  },
  {id:'V',name:'Visa Inc.',ticker:'V',sector:'Finanzas',country:'EE.UU.',price:278.5,beta:0.96,sigma:20.4,ret:11.8,rating:'AA+',dividend:1.8,type:'accion',profile:'Visa Inc. es una empresa del sector finanzas con domicilio en EE.UU.. Cotiza bajo el símbolo V con beta de 0.96 y volatilidad anualizada de 20.4%. Calificación crediticia AA+.',
   fs:{
     income:[
       {year:2023,revenue:32653,grossProfit:26468,ebit:21881,netIncome:17273},
       {year:2022,revenue:29310,grossProfit:23700,ebit:18814,netIncome:14957},
       {year:2021,revenue:24105,grossProfit:19493,ebit:15804,netIncome:12311},
     ],
     balance:[
       {year:2023,assets:90499,liabilities:51282,equity:38733,cash:16286,debt:20612},
       {year:2022,assets:85501,liabilities:49869,equity:35632,cash:15689,debt:20200},
       {year:2021,assets:82896,liabilities:47297,equity:35599,cash:16487,debt:19978},
     ],
     cashflow:[
       {year:2023,operating:20755,investing:-1015,financing:-17743},
       {year:2022,operating:18849,investing:1394,financing:-15278},
       {year:2021,operating:15227,investing:-2098,financing:-13730},
     ]
   }
  },
  {id:'WMT',name:'Walmart Inc.',ticker:'WMT',sector:'Consumo',country:'EE.UU.',price:68.4,beta:0.49,sigma:17.3,ret:8.4,rating:'AA',dividend:0.83,type:'accion',profile:'Walmart Inc. es una empresa del sector consumo con domicilio en EE.UU.. Cotiza bajo el símbolo WMT con beta de 0.49 y volatilidad anualizada de 17.3%. Calificación crediticia AA.',
   fs:{
     income:[
       {year:2023,revenue:648125,grossProfit:157983,ebit:27012,netIncome:15511},
       {year:2022,revenue:611289,grossProfit:147568,ebit:20428,netIncome:11680},
       {year:2021,revenue:572754,grossProfit:143754,ebit:25942,netIncome:13673},
     ],
     balance:[
       {year:2023,assets:252399,liabilities:168544,equity:83861,cash:9867,debt:49787},
       {year:2022,assets:243197,liabilities:165139,equity:78034,cash:8625,debt:47831},
       {year:2021,assets:244860,liabilities:162828,equity:91891,cash:14760,debt:44567},
     ],
     cashflow:[
       {year:2023,operating:35726,investing:-19926,financing:-15991},
       {year:2022,operating:28841,investing:-16753,financing:-17517},
       {year:2021,operating:36361,investing:-9787,financing:-25767},
     ]
   }
  },
  {id:'XOM',name:'Exxon Mobil',ticker:'XOM',sector:'Energía',country:'EE.UU.',price:118.9,beta:0.92,sigma:25.7,ret:9.6,rating:'AA-',dividend:3.8,type:'accion',profile:'Exxon Mobil es una empresa del sector energía con domicilio en EE.UU.. Cotiza bajo el símbolo XOM con beta de 0.92 y volatilidad anualizada de 25.7%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:344582,grossProfit:72703,ebit:55755,netIncome:36010},
       {year:2022,revenue:413680,grossProfit:98912,ebit:77893,netIncome:55740},
       {year:2021,revenue:285640,grossProfit:67428,ebit:23512,netIncome:23040},
     ],
     balance:[
       {year:2023,assets:376317,liabilities:163779,equity:204802,cash:31539,debt:41573},
       {year:2022,assets:369067,liabilities:166594,equity:202409,cash:29640,debt:40559},
       {year:2021,assets:338923,liabilities:168620,equity:168577,cash:6802,debt:47704},
     ],
     cashflow:[
       {year:2023,operating:55369,investing:-18634,financing:-39595},
       {year:2022,operating:76797,investing:-13313,financing:-37312},
       {year:2021,operating:48129,investing:-10234,financing:-37339},
     ]
   }
  },
  {id:'KO',name:'Coca-Cola Co.',ticker:'KO',sector:'Consumo',country:'EE.UU.',price:62.3,beta:0.58,sigma:13.8,ret:6.9,rating:'A+',dividend:1.94,type:'accion',profile:'Coca-Cola Co. es una empresa del sector consumo con domicilio en EE.UU.. Cotiza bajo el símbolo KO con beta de 0.58 y volatilidad anualizada de 13.8%. Calificación crediticia A+.',
   fs:{
     income:[
       {year:2023,revenue:45754,grossProfit:27234,ebit:11311,netIncome:10714},
       {year:2022,revenue:43004,grossProfit:25004,ebit:10909,netIncome:9542},
       {year:2021,revenue:38655,grossProfit:23298,ebit:10308,netIncome:9771},
     ],
     balance:[
       {year:2023,assets:97703,liabilities:68460,equity:29512,cash:9366,debt:42130},
       {year:2022,assets:92763,liabilities:66937,equity:25826,cash:9519,debt:39148},
       {year:2021,assets:94354,liabilities:53203,equity:40768,cash:9684,debt:40125},
     ],
     cashflow:[
       {year:2023,operating:11599,investing:-560,financing:-10306},
       {year:2022,operating:11018,investing:-2618,financing:-9070},
       {year:2021,operating:12625,investing:-4150,financing:-6786},
     ]
   }
  },
  {id:'DIS',name:'Walt Disney Co.',ticker:'DIS',sector:'Comunicación',country:'EE.UU.',price:98.7,beta:1.32,sigma:28.4,ret:9.2,rating:'A-',dividend:0.0,type:'accion',profile:'Walt Disney Co. es una empresa del sector comunicación con domicilio en EE.UU.. Cotiza bajo el símbolo DIS con beta de 1.32 y volatilidad anualizada de 28.4%. Calificación crediticia A-.',
   fs:{
     income:[
       {year:2023,revenue:88898,grossProfit:30425,ebit:12891,netIncome:2354},
       {year:2022,revenue:82722,grossProfit:28321,ebit:9854,netIncome:3145},
       {year:2021,revenue:67418,grossProfit:22287,ebit:5972,netIncome:1995},
     ],
     balance:[
       {year:2023,assets:205579,liabilities:95308,equity:99277,cash:14182,debt:46286},
       {year:2022,assets:203631,liabilities:98049,equity:99100,cash:11615,debt:48369},
       {year:2021,assets:203609,liabilities:97064,equity:93025,cash:15959,debt:48540},
     ],
     cashflow:[
       {year:2023,operating:9866,investing:-4869,financing:-5419},
       {year:2022,operating:6002,investing:-4513,financing:-3236},
       {year:2021,operating:5566,investing:-3171,financing:-1330},
     ]
   }
  },
  {id:'MCD',name:"McDonald's Corp.",ticker:'MCD',sector:'Consumo',country:'EE.UU.',price:289.6,beta:0.67,sigma:16.9,ret:8.7,rating:'BBB+',dividend:6.68,type:'accion',profile:"McDonald's Corp. es una empresa del sector consumo con domicilio en EE.UU.. Cotiza bajo el símbolo MCD con beta de 0.67 y volatilidad anualizada de 16.9%. Calificación crediticia BBB+.",
   fs:{
     income:[
       {year:2023,revenue:25494,grossProfit:14563,ebit:11647,netIncome:8469},
       {year:2022,revenue:23183,grossProfit:13207,ebit:10371,netIncome:6177},
       {year:2021,revenue:23223,grossProfit:13753,ebit:10356,netIncome:7545},
     ],
     balance:[
       {year:2023,assets:56147,liabilities:60429,equity:-4708,cash:4579,debt:38629},
       {year:2022,assets:50436,liabilities:56732,equity:-6003,cash:2584,debt:35922},
       {year:2021,assets:53854,liabilities:58450,equity:-4601,cash:4709,debt:35623},
     ],
     cashflow:[
       {year:2023,operating:9614,investing:-2926,financing:-7104},
       {year:2022,operating:7410,investing:-2284,financing:-5879},
       {year:2021,operating:8581,investing:-1681,financing:-7456},
     ]
   }
  },
  {id:'NKE',name:'Nike Inc.',ticker:'NKE',sector:'Consumo',country:'EE.UU.',price:94.2,beta:1.08,sigma:26.1,ret:9.8,rating:'AA-',dividend:1.48,type:'accion',profile:'Nike Inc. es una empresa del sector consumo con domicilio en EE.UU.. Cotiza bajo el símbolo NKE con beta de 1.08 y volatilidad anualizada de 26.1%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:51217,grossProfit:22877,ebit:6723,netIncome:5070},
       {year:2022,revenue:46710,grossProfit:21479,ebit:6679,netIncome:6046},
       {year:2021,revenue:44538,grossProfit:21479,ebit:6789,netIncome:5727},
     ],
     balance:[
       {year:2023,assets:37531,liabilities:22772,equity:14004,cash:7511,debt:8927},
       {year:2022,assets:40321,liabilities:23682,equity:15281,cash:10612,debt:8927},
       {year:2021,assets:37740,liabilities:24341,equity:12767,cash:9889,debt:9413},
     ],
     cashflow:[
       {year:2023,operating:5836,investing:-1148,financing:-5279},
       {year:2022,operating:5188,investing:-394,financing:-4488},
       {year:2021,operating:6657,investing:-3851,financing:-2356},
     ]
   }
  },
  {id:'PFE',name:'Pfizer Inc.',ticker:'PFE',sector:'Salud',country:'EE.UU.',price:28.4,beta:0.62,sigma:22.8,ret:7.4,rating:'A+',dividend:1.68,type:'accion',profile:'Pfizer Inc. es una empresa del sector salud con domicilio en EE.UU.. Cotiza bajo el símbolo PFE con beta de 0.62 y volatilidad anualizada de 22.8%. Calificación crediticia A+.',
   fs:{
     income:[
       {year:2023,revenue:58496,grossProfit:40130,ebit:3955,netIncome:2119},
       {year:2022,revenue:100330,grossProfit:67844,ebit:37700,netIncome:31372},
       {year:2021,revenue:81288,grossProfit:51547,ebit:22034,netIncome:21979},
     ],
     balance:[
       {year:2023,assets:226501,liabilities:128606,equity:89014,cash:12694,debt:71179},
       {year:2022,assets:197205,liabilities:102306,equity:94806,cash:22318,debt:38978},
       {year:2021,assets:181476,liabilities:104008,equity:77201,cash:31069,debt:36486},
     ],
     cashflow:[
       {year:2023,operating:8700,investing:-31633,financing:16986},
       {year:2022,operating:29267,investing:-19255,financing:-10330},
       {year:2021,operating:32922,investing:-3595,financing:-29325},
     ]
   }
  },
  {id:'BAC',name:'Bank of America',ticker:'BAC',sector:'Finanzas',country:'EE.UU.',price:39.8,beta:1.34,sigma:28.7,ret:9.4,rating:'A-',dividend:0.96,type:'accion',profile:'Bank of America es una empresa del sector finanzas con domicilio en EE.UU.. Cotiza bajo el símbolo BAC con beta de 1.34 y volatilidad anualizada de 28.7%. Calificación crediticia A-.',
   fs:{
     income:[
       {year:2023,revenue:98581,grossProfit:0,ebit:0,netIncome:26515},
       {year:2022,revenue:94950,grossProfit:0,ebit:0,netIncome:27528},
       {year:2021,revenue:89113,grossProfit:0,ebit:0,netIncome:31978},
     ],
     balance:[
       {year:2023,assets:3180151,liabilities:2888163,equity:291646,cash:333703,debt:652020},
       {year:2022,assets:3051375,liabilities:2778149,equity:273197,cash:230093,debt:609395},
       {year:2021,assets:3169495,liabilities:2899053,equity:270066,cash:348221,debt:541870},
     ],
     cashflow:[
       {year:2023,operating:73682,investing:-39510,financing:-30877},
       {year:2022,operating:48891,investing:-227883,financing:180685},
       {year:2021,operating:89531,investing:-282993,financing:160768},
     ]
   }
  },
  {id:'INTC',name:'Intel Corp.',ticker:'INTC',sector:'Tecnología',country:'EE.UU.',price:31.2,beta:1.18,sigma:33.5,ret:8.1,rating:'A',dividend:0.5,type:'accion',profile:'Intel Corp. es una empresa del sector tecnología con domicilio en EE.UU.. Cotiza bajo el símbolo INTC con beta de 1.18 y volatilidad anualizada de 33.5%. Calificación crediticia A.',
   fs:{
     income:[
       {year:2023,revenue:54228,grossProfit:21711,ebit:93,netIncome:1689},
       {year:2022,revenue:63054,grossProfit:27365,ebit:2335,netIncome:8014},
       {year:2021,revenue:79024,grossProfit:43815,ebit:19456,netIncome:19868},
     ],
     balance:[
       {year:2023,assets:191572,liabilities:81607,equity:109895,cash:7079,debt:49266},
       {year:2022,assets:182103,liabilities:78216,equity:103886,cash:11144,debt:37684},
       {year:2021,assets:168406,liabilities:67815,equity:95391,cash:4827,debt:33510},
     ],
     cashflow:[
       {year:2023,operating:11471,investing:-25577,financing:11868},
       {year:2022,operating:15433,investing:-21433,financing:5043},
       {year:2021,operating:29456,investing:-24449,financing:-2329},
     ]
   }
  },
  {id:'CSCO',name:'Cisco Systems',ticker:'CSCO',sector:'Tecnología',country:'EE.UU.',price:49.6,beta:0.89,sigma:20.3,ret:8.9,rating:'AA-',dividend:1.6,type:'accion',profile:'Cisco Systems es una empresa del sector tecnología con domicilio en EE.UU.. Cotiza bajo el símbolo CSCO con beta de 0.89 y volatilidad anualizada de 20.3%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:56998,grossProfit:36692,ebit:15585,netIncome:12613},
       {year:2022,revenue:51557,grossProfit:32956,ebit:13973,netIncome:11812},
       {year:2021,revenue:49818,grossProfit:32522,ebit:13973,netIncome:10591},
     ],
     balance:[
       {year:2023,assets:101852,liabilities:57932,equity:43748,cash:10123,debt:8416},
       {year:2022,assets:94002,liabilities:52258,equity:41736,cash:7079,debt:9504},
       {year:2021,assets:97497,liabilities:55418,equity:42079,cash:9388,debt:11529},
     ],
     cashflow:[
       {year:2023,operating:19886,investing:-3815,financing:-12099},
       {year:2022,operating:13219,investing:-2840,financing:-12099},
       {year:2021,operating:15454,investing:1085,financing:-13089},
     ]
   }
  },
  {id:'SAN',name:'Banco Santander',ticker:'SAN',sector:'Finanzas',country:'España',price:4.8,beta:1.28,sigma:30.2,ret:9.7,rating:'A',dividend:0.12,type:'accion',profile:'Banco Santander es una empresa del sector finanzas con domicilio en España. Cotiza bajo el símbolo SAN con beta de 1.28 y volatilidad anualizada de 30.2%. Calificación crediticia A.',
   fs:{
     income:[
       {year:2023,revenue:57647,grossProfit:0,ebit:0,netIncome:12392},
       {year:2022,revenue:52117,grossProfit:0,ebit:0,netIncome:9605},
       {year:2021,revenue:46404,grossProfit:0,ebit:0,netIncome:8124},
     ],
     balance:[
       {year:2023,assets:1797000,liabilities:1701000,equity:96000,cash:223000,debt:289000},
       {year:2022,assets:1734000,liabilities:1637000,equity:97000,cash:210000,debt:276000},
       {year:2021,assets:1595000,liabilities:1498000,equity:97000,cash:195000,debt:261000},
     ],
     cashflow:[
       {year:2023,operating:28000,investing:-12000,financing:-9000},
       {year:2022,operating:24000,investing:-10000,financing:-8000},
       {year:2021,operating:22000,investing:-9000,financing:-7500},
     ]
   }
  },
  {id:'TSM',name:'Taiwan Semicon.',ticker:'TSM',sector:'Tecnología',country:'Taiwán',price:172.5,beta:1.15,sigma:31.4,ret:13.8,rating:'AA-',dividend:0.55,type:'accion',profile:'Taiwan Semicon. es una empresa del sector tecnología con domicilio en Taiwán. Cotiza bajo el símbolo TSM con beta de 1.15 y volatilidad anualizada de 31.4%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:69298,grossProfit:37810,ebit:29077,netIncome:26900},
       {year:2022,revenue:73558,grossProfit:43525,ebit:36000,netIncome:34000},
       {year:2021,revenue:56822,grossProfit:30900,ebit:23000,netIncome:21300},
     ],
     balance:[
       {year:2023,assets:192000,liabilities:68000,equity:124000,cash:49000,debt:30000},
       {year:2022,assets:184000,liabilities:70000,equity:114000,cash:52000,debt:28000},
       {year:2021,assets:150000,liabilities:60000,equity:90000,cash:44000,debt:24000},
     ],
     cashflow:[
       {year:2023,operating:48000,investing:-29000,financing:-7000},
       {year:2022,operating:56000,investing:-36000,financing:-4000},
       {year:2021,operating:46000,investing:-34000,financing:-1000},
     ]
   }
  },
  {id:'TM',name:'Toyota Motor',ticker:'TM',sector:'Automotriz',country:'Japón',price:211.3,beta:0.84,sigma:21.6,ret:8.3,rating:'A+',dividend:3.2,type:'accion',profile:'Toyota Motor es una empresa del sector automotriz con domicilio en Japón. Cotiza bajo el símbolo TM con beta de 0.84 y volatilidad anualizada de 21.6%. Calificación crediticia A+.',
   fs:{
     income:[
       {year:2023,revenue:296000,grossProfit:0,ebit:30000,netIncome:32000},
       {year:2022,revenue:279000,grossProfit:0,ebit:27000,netIncome:23000},
       {year:2021,revenue:265000,grossProfit:0,ebit:29000,netIncome:28000},
     ],
     balance:[
       {year:2023,assets:560000,liabilities:360000,equity:200000,cash:60000,debt:200000},
       {year:2022,assets:540000,liabilities:350000,equity:190000,cash:55000,debt:195000},
       {year:2021,assets:520000,liabilities:340000,equity:180000,cash:50000,debt:190000},
     ],
     cashflow:[
       {year:2023,operating:38000,investing:-30000,financing:-5000},
       {year:2022,operating:35000,investing:-28000,financing:-4000},
       {year:2021,operating:37000,investing:-29000,financing:-6000},
     ]
   }
  },
  {id:'NVO',name:'Novo Nordisk',ticker:'NVO',sector:'Salud',country:'Dinamarca',price:128.9,beta:0.71,sigma:24.9,ret:14.2,rating:'AA-',dividend:1.1,type:'accion',profile:'Novo Nordisk es una empresa del sector salud con domicilio en Dinamarca. Cotiza bajo el símbolo NVO con beta de 0.71 y volatilidad anualizada de 24.9%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:33700,grossProfit:28000,ebit:15000,netIncome:12100},
       {year:2022,revenue:25500,grossProfit:21000,ebit:11000,netIncome:8900},
       {year:2021,revenue:20800,grossProfit:17000,ebit:9000,netIncome:7000},
     ],
     balance:[
       {year:2023,assets:45000,liabilities:22000,equity:23000,cash:5000,debt:8000},
       {year:2022,assets:35000,liabilities:18000,equity:17000,cash:4000,debt:6000},
       {year:2021,assets:30000,liabilities:15000,equity:15000,cash:3500,debt:5000},
     ],
     cashflow:[
       {year:2023,operating:14000,investing:-3000,financing:-9000},
       {year:2022,operating:11000,investing:-2500,financing:-7500},
       {year:2021,operating:9000,investing:-2000,financing:-6000},
     ]
   }
  },
  {id:'SHEL',name:'Shell plc',ticker:'SHEL',sector:'Energía',country:'Reino Unido',price:68.2,beta:0.95,sigma:24.1,ret:8.8,rating:'AA-',dividend:2.6,type:'accion',profile:'Shell plc es una empresa del sector energía con domicilio en Reino Unido. Cotiza bajo el símbolo SHEL con beta de 0.95 y volatilidad anualizada de 24.1%. Calificación crediticia AA-.',
   fs:{
     income:[
       {year:2023,revenue:323183,grossProfit:0,ebit:0,netIncome:19359},
       {year:2022,revenue:381314,grossProfit:0,ebit:0,netIncome:42309},
       {year:2021,revenue:261504,grossProfit:0,ebit:0,netIncome:20101},
     ],
     balance:[
       {year:2023,assets:406270,liabilities:217000,equity:189270,cash:40000,debt:82000},
       {year:2022,assets:443000,liabilities:240000,equity:203000,cash:44000,debt:84000},
       {year:2021,assets:404000,liabilities:230000,equity:174000,cash:37000,debt:89000},
     ],
     cashflow:[
       {year:2023,operating:54200,investing:-18000,financing:-35000},
       {year:2022,operating:68400,investing:-20000,financing:-43000},
       {year:2021,operating:45100,investing:-12000,financing:-30000},
     ]
   }
  },
  {id:'BABA',name:'Alibaba Group',ticker:'BABA',sector:'Tecnología',country:'China',price:78.4,beta:1.42,sigma:38.7,ret:10.4,rating:'A+',dividend:0.0,type:'accion',profile:'Alibaba Group es una empresa del sector tecnología con domicilio en China. Cotiza bajo el símbolo BABA con beta de 1.42 y volatilidad anualizada de 38.7%. Calificación crediticia A+.',
   fs:{
     income:[
       {year:2023,revenue:130350,grossProfit:49000,ebit:18000,netIncome:10600},
       {year:2022,revenue:134570,grossProfit:48000,ebit:15000,netIncome:9700},
       {year:2021,revenue:109480,grossProfit:45000,ebit:12000,netIncome:8900},
     ],
     balance:[
       {year:2023,assets:264000,liabilities:90000,equity:165000,cash:80000,debt:20000},
       {year:2022,assets:255000,liabilities:88000,equity:158000,cash:75000,debt:19000},
       {year:2021,assets:245000,liabilities:85000,equity:150000,cash:70000,debt:18000},
     ],
     cashflow:[
       {year:2023,operating:24000,investing:-15000,financing:-8000},
       {year:2022,operating:22000,investing:-14000,financing:-7000},
       {year:2021,operating:31000,investing:-20000,financing:-9000},
     ]
   }
  },
  {id:'MELI',name:'MercadoLibre',ticker:'MELI',sector:'Tecnología',country:'Argentina',price:1684.0,beta:1.55,sigma:42.3,ret:16.8,rating:'BBB',dividend:0.0,type:'accion',profile:'MercadoLibre es una empresa del sector tecnología con domicilio en Argentina. Cotiza bajo el símbolo MELI con beta de 1.55 y volatilidad anualizada de 42.3%. Calificación crediticia BBB.',
   fs:{
     income:[
       {year:2023,revenue:14473,grossProfit:6800,ebit:1300,netIncome:987},
       {year:2022,revenue:10537,grossProfit:4900,ebit:800,netIncome:482},
       {year:2021,revenue:7069,grossProfit:3200,ebit:200,netIncome:83},
     ],
     balance:[
       {year:2023,assets:13900,liabilities:10500,equity:3400,cash:2700,debt:1900},
       {year:2022,assets:10400,liabilities:8200,equity:2200,cash:2300,debt:1700},
       {year:2021,assets:8400,liabilities:6700,equity:1700,cash:2000,debt:1500},
     ],
     cashflow:[
       {year:2023,operating:2700,investing:-1500,financing:-300},
       {year:2022,operating:2000,investing:-1200,financing:500},
       {year:2021,operating:1300,investing:-900,financing:1500},
     ]
   }
  },
  {id:'VALE',name:'Vale S.A.',ticker:'VALE',sector:'Materiales',country:'Brasil',price:11.8,beta:1.38,sigma:35.9,ret:10.2,rating:'BBB-',dividend:1.4,type:'accion',profile:'Vale S.A. es una empresa del sector materiales con domicilio en Brasil. Cotiza bajo el símbolo VALE con beta de 1.38 y volatilidad anualizada de 35.9%. Calificación crediticia BBB-.',
   fs:{
     income:[
       {year:2023,revenue:41784,grossProfit:16000,ebit:12000,netIncome:7980},
       {year:2022,revenue:43839,grossProfit:18000,ebit:14000,netIncome:18800},
       {year:2021,revenue:54502,grossProfit:28000,ebit:24000,netIncome:22440},
     ],
     balance:[
       {year:2023,assets:89000,liabilities:45000,equity:44000,cash:5000,debt:12000},
       {year:2022,assets:92000,liabilities:47000,equity:45000,cash:4500,debt:13000},
       {year:2021,assets:95000,liabilities:48000,equity:47000,cash:11000,debt:14000},
     ],
     cashflow:[
       {year:2023,operating:13000,investing:-5000,financing:-9000},
       {year:2022,operating:17000,investing:-6000,financing:-12000},
       {year:2021,operating:24000,investing:-7000,financing:-15000},
     ]
   }
  }
];
const ALL_BONDS=[
  {id:'UST10',name:'Tesoro EE.UU. 10Y',ticker:'UST-10Y',country:'EE.UU.',price:97.5,coupon:4.25,maturity:10,rating:'AAA',sigma:4.2,ret:4.25,profile:'Bono del Tesoro a 10 años, activo libre de riesgo global. Respaldado por el gobierno federal. Tasa refleja política monetaria de la Fed.',rp:0.1,type:'bono',ytm:4.51,duration:6.54,convexity:36.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:98.56,
   bondDoc:{issuer:'Departamento del Tesoro de los Estados Unidos',totalIssuance:'$120,000 M',couponFrequency:'Semestral',dayCount:'Act/Act',clearing:'Fedwire / DTC',callable:false,yieldCurve:[{tenor:'3M',yield:5.28},{tenor:'6M',yield:5.30},{tenor:'2Y',yield:4.88},{tenor:'5Y',yield:4.55},{tenor:'10Y',yield:4.25},{tenor:'30Y',yield:4.48}],duration:8.42,convexity:0.82,cashFlows:[{period:1,year:0.5,coupon:2125,principal:0,total:2125},{period:2,year:1.0,coupon:2125,principal:0,total:2125},{period:3,year:2.0,coupon:2125,principal:0,total:2125},{period:5,year:5.0,coupon:2125,principal:0,total:2125},{period:10,year:10.0,coupon:2125,principal:100000,total:102125}]}
  },
  {id:'GER10',name:'Bono Alemán 10Y',ticker:'GER-10Y',country:'Alemania',price:98.2,coupon:2.50,maturity:10,rating:'AAA',sigma:3.8,ret:2.50,profile:'Bono soberano del Gobierno Federal Alemán a 10 años, referencia de la zona euro. Alemania mantiene calificación AAA con deuda/PIB de 66%. Activo refugio europeo por excelencia.',rp:0.05,type:'bono',ytm:2.68,duration:7.4,convexity:46.5,couponFreq:'Semestral',faceValue:100,dirtyPrice:98.83,
   bondDoc:{issuer:'República Federal de Alemania — Finanzagentur GmbH',totalIssuance:'€26,000 M',couponFrequency:'Anual',dayCount:'Act/Act ICMA',clearing:'Euroclear / Clearstream',callable:false,yieldCurve:[{tenor:'1Y',yield:3.62},{tenor:'2Y',yield:2.88},{tenor:'5Y',yield:2.65},{tenor:'10Y',yield:2.50},{tenor:'30Y',yield:2.65}],duration:8.95,convexity:0.91,cashFlows:[{period:1,year:1.0,coupon:2500,principal:0,total:2500},{period:3,year:3.0,coupon:2500,principal:0,total:2500},{period:5,year:5.0,coupon:2500,principal:0,total:2500},{period:10,year:10.0,coupon:2500,principal:100000,total:102500}]}
  },
  {id:'BON-PA',name:'Bono Rep. Panamá',ticker:'PAN-30',country:'Panamá',price:94.8,coupon:3.87,maturity:15,rating:'BBB',sigma:8.4,ret:5.20,profile:'Panamá mantiene grado de inversión. Dolarización elimina riesgo cambiario. Canal de Panamá genera ingresos estratégicos. Deuda/PIB: 55%.',rp:1.8,type:'bono',ytm:5.57,duration:8.9,convexity:67.3,couponFreq:'Semestral',faceValue:100,dirtyPrice:95.77,
   bondDoc:{issuer:'República de Panamá — Ministerio de Economía y Finanzas',totalIssuance:'$2,000 M',couponFrequency:'Semestral',dayCount:'30/360',clearing:'DTC / Euroclear',callable:false,yieldCurve:[{tenor:'5Y',yield:4.90},{tenor:'10Y',yield:5.10},{tenor:'15Y',yield:5.20},{tenor:'30Y',yield:5.55}],duration:10.84,convexity:1.42,cashFlows:[{period:1,year:0.5,coupon:1935,principal:0,total:1935},{period:3,year:3.0,coupon:1935,principal:0,total:1935},{period:5,year:5.0,coupon:1935,principal:0,total:1935},{period:10,year:10.0,coupon:1935,principal:0,total:1935},{period:15,year:15.0,coupon:1935,principal:100000,total:101935}]}
  },
  {id:'COL-10',name:'TES Colombia 10Y',ticker:'COL-10Y',country:'Colombia',price:89.4,coupon:7.00,maturity:10,rating:'BB+',sigma:12.1,ret:8.60,profile:'Títulos del Ministerio de Hacienda de Colombia. Alta rentabilidad refleja riesgo moderado. EMBI Colombia: ~250bps.',rp:2.5,type:'bono',ytm:9.79,duration:5.62,convexity:26.8,couponFreq:'Semestral',faceValue:100,dirtyPrice:91.15,
   bondDoc:{issuer:'República de Colombia — Ministerio de Hacienda y Crédito Público',totalIssuance:'COP 15.2 B',couponFrequency:'Semestral',dayCount:'Act/365',clearing:'DCV (Depósito Central de Valores)',callable:false,yieldCurve:[{tenor:'1Y',yield:10.20},{tenor:'3Y',yield:9.50},{tenor:'5Y',yield:8.90},{tenor:'10Y',yield:8.60}],duration:7.12,convexity:0.68,cashFlows:[{period:1,year:0.5,coupon:3500,principal:0,total:3500},{period:3,year:3.0,coupon:3500,principal:0,total:3500},{period:5,year:5.0,coupon:3500,principal:0,total:3500},{period:10,year:10.0,coupon:3500,principal:100000,total:103500}]}
  },
  {id:'MEX-10',name:'Cetes México 1Y',ticker:'CETES-1Y',country:'México',price:99.1,coupon:10.50,maturity:1,rating:'BBB-',sigma:6.8,ret:10.50,profile:'Certificados de la Tesorería de México. Alta tasa refleja política del Banxico contra inflación. México grado de inversión.',rp:2.1,type:'bono',ytm:11.41,duration:0.84,convexity:0.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:101.72,
   bondDoc:{issuer:'Gobierno Federal de México — SHCP / Banco de México',totalIssuance:'MXN 800,000 M',couponFrequency:'Descuento (cero cupón)',dayCount:'Act/360',clearing:'INDEVAL',callable:false,yieldCurve:[{tenor:'28d',yield:11.00},{tenor:'91d',yield:10.85},{tenor:'182d',yield:10.60},{tenor:'364d',yield:10.50}],duration:1.0,convexity:0.01,cashFlows:[{period:1,year:1.0,coupon:10500,principal:100000,total:110500}]}
  },
  {id:'ARG-10',name:'Bono Argentina 2030',ticker:'AL30',country:'Argentina',price:42.5,coupon:0.50,maturity:5,rating:'CCC',sigma:35.6,ret:28.4,profile:'Argentina en reestructuración soberana. Inflación 200%+, EMBI 1800bps. Inversión especulativa de altísimo riesgo con potencial retorno extraordinario.',rp:18.0,type:'bono',ytm:55.46,duration:4.53,convexity:17.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:42.62,
   bondDoc:{issuer:'República Argentina — Ministerio de Economía',totalIssuance:'$16,200 M (post-reestructuración 2020)',couponFrequency:'Semestral (step-up)',dayCount:'30/360',clearing:'DTC / Euroclear / Caja de Valores',callable:false,yieldCurve:[{tenor:'5Y',yield:28.4},{tenor:'10Y',yield:22.0},{tenor:'30Y',yield:18.5}],duration:3.85,convexity:0.18,cashFlows:[{period:1,year:0.5,coupon:250,principal:0,total:250},{period:2,year:1.0,coupon:500,principal:0,total:500},{period:3,year:2.0,coupon:750,principal:0,total:750},{period:5,year:5.0,coupon:1000,principal:100000,total:101000}]}
  },
  {id:'UST2',name:'Bono EE.UU. 2Y',ticker:'UST-2Y',country:'EE.UU.',price:99.1,coupon:4.75,maturity:2,rating:'AAA',sigma:1.8,ret:4.75,rp:0.0,type:'bono',ytm:5.2,duration:1.69,convexity:2.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:100.29,profile:'Bono EE.UU. 2Y emitido por EE.UU.. Cupón anual de 4.75% con vencimiento a 2 años. Calificación AAA, spread de riesgo país 0.0%.'},
  {id:'UST30',name:'Bono EE.UU. 30Y',ticker:'UST-30Y',country:'EE.UU.',price:95.4,coupon:4.25,maturity:30,rating:'AAA',sigma:7.2,ret:4.25,rp:0.0,type:'bono',ytm:4.41,duration:12.43,convexity:131.3,couponFreq:'Semestral',faceValue:100,dirtyPrice:96.46,profile:'Bono EE.UU. 30Y emitido por EE.UU.. Cupón anual de 4.25% con vencimiento a 30 años. Calificación AAA, spread de riesgo país 0.0%.'},
  {id:'GER2',name:'Bono Alemán 2Y',ticker:'GER-2Y',country:'Alemania',price:99.6,coupon:2.8,maturity:2,rating:'AAA',sigma:1.5,ret:2.8,rp:0.05,type:'bono',ytm:3.0,duration:1.75,convexity:2.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:100.3,profile:'Bono Alemán 2Y emitido por Alemania. Cupón anual de 2.8% con vencimiento a 2 años. Calificación AAA, spread de riesgo país 0.05%.'},
  {id:'GER30',name:'Bono Alemán 30Y',ticker:'GER-30Y',country:'Alemania',price:94.8,coupon:2.65,maturity:30,rating:'AAA',sigma:8.1,ret:2.65,rp:0.05,type:'bono',ytm:2.83,duration:15.57,convexity:206.1,couponFreq:'Semestral',faceValue:100,dirtyPrice:95.46,profile:'Bono Alemán 30Y emitido por Alemania. Cupón anual de 2.65% con vencimiento a 30 años. Calificación AAA, spread de riesgo país 0.05%.'},
  {id:'GB10',name:'Gilt Británico 10Y',ticker:'GB-10Y',country:'Reino Unido',price:96.7,coupon:4.05,maturity:10,rating:'AA',sigma:6.4,ret:4.05,rp:0.3,type:'bono',ytm:4.39,duration:6.63,convexity:37.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:97.71,profile:'Gilt Británico 10Y emitido por Reino Unido. Cupón anual de 4.05% con vencimiento a 10 años. Calificación AA, spread de riesgo país 0.3%.'},
  {id:'FR10',name:'OAT Francés 10Y',ticker:'FR-10Y',country:'Francia',price:97.2,coupon:3.15,maturity:10,rating:'AA-',sigma:6.2,ret:3.15,rp:0.2,type:'bono',ytm:3.44,duration:7.05,convexity:42.2,couponFreq:'Semestral',faceValue:100,dirtyPrice:97.99,profile:'OAT Francés 10Y emitido por Francia. Cupón anual de 3.15% con vencimiento a 10 años. Calificación AA-, spread de riesgo país 0.2%.'},
  {id:'IT10',name:'BTP Italiano 10Y',ticker:'IT-10Y',country:'Italia',price:93.5,coupon:4.35,maturity:10,rating:'BBB',sigma:7.8,ret:4.35,rp:1.8,type:'bono',ytm:5.05,duration:6.51,convexity:36.0,couponFreq:'Semestral',faceValue:100,dirtyPrice:94.59,profile:'BTP Italiano 10Y emitido por Italia. Cupón anual de 4.35% con vencimiento a 10 años. Calificación BBB, spread de riesgo país 1.8%.'},
  {id:'ES10',name:'Bono Español 10Y',ticker:'ES-10Y',country:'España',price:95.1,coupon:3.45,maturity:10,rating:'A',sigma:6.9,ret:3.45,rp:0.9,type:'bono',ytm:3.97,duration:6.91,convexity:40.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:95.96,profile:'Bono Español 10Y emitido por España. Cupón anual de 3.45% con vencimiento a 10 años. Calificación A, spread de riesgo país 0.9%.'},
  {id:'JP10',name:'Bono Japonés 10Y',ticker:'JP-10Y',country:'Japón',price:98.9,coupon:0.95,maturity:10,rating:'A+',sigma:5.1,ret:0.95,rp:0.2,type:'bono',ytm:1.06,duration:8.41,convexity:60.1,couponFreq:'Semestral',faceValue:100,dirtyPrice:99.14,profile:'Bono Japonés 10Y emitido por Japón. Cupón anual de 0.95% con vencimiento a 10 años. Calificación A+, spread de riesgo país 0.2%.'},
  {id:'CN10',name:'Bono Chino 10Y',ticker:'CN-10Y',country:'China',price:97.8,coupon:2.45,maturity:10,rating:'A+',sigma:5.8,ret:2.45,rp:0.6,type:'bono',ytm:2.67,duration:7.43,convexity:46.9,couponFreq:'Semestral',faceValue:100,dirtyPrice:98.41,profile:'Bono Chino 10Y emitido por China. Cupón anual de 2.45% con vencimiento a 10 años. Calificación A+, spread de riesgo país 0.6%.'},
  {id:'BR10',name:'Bono Brasileño 10Y',ticker:'BR-10Y',country:'Brasil',price:88.4,coupon:11.25,maturity:10,rating:'BB',sigma:11.2,ret:11.25,rp:2.4,type:'bono',ytm:12.56,duration:4.6,convexity:18.0,couponFreq:'Semestral',faceValue:100,dirtyPrice:91.21,profile:'Bono Brasileño 10Y emitido por Brasil. Cupón anual de 11.25% con vencimiento a 10 años. Calificación BB, spread de riesgo país 2.4%.'},
  {id:'MX5',name:'Bono Mexicano 5Y',ticker:'MX-5Y',country:'México',price:94.2,coupon:8.75,maturity:5,rating:'BBB',sigma:6.8,ret:8.75,rp:1.6,type:'bono',ytm:9.98,duration:3.29,convexity:9.2,couponFreq:'Semestral',faceValue:100,dirtyPrice:96.39,profile:'Bono Mexicano 5Y emitido por México. Cupón anual de 8.75% con vencimiento a 5 años. Calificación BBB, spread de riesgo país 1.6%.'},
  {id:'CL10',name:'Bono Chileno 10Y',ticker:'CL-10Y',country:'Chile',price:93.8,coupon:5.95,maturity:10,rating:'A',sigma:7.1,ret:5.95,rp:1.2,type:'bono',ytm:6.61,duration:5.9,convexity:29.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:95.29,profile:'Bono Chileno 10Y emitido por Chile. Cupón anual de 5.95% con vencimiento a 10 años. Calificación A, spread de riesgo país 1.2%.'},
  {id:'PE10',name:'Bono Peruano 10Y',ticker:'PE-10Y',country:'Perú',price:92.1,coupon:6.45,maturity:10,rating:'BBB',sigma:8.2,ret:6.45,rp:1.7,type:'bono',ytm:7.31,duration:5.75,convexity:28.1,couponFreq:'Semestral',faceValue:100,dirtyPrice:93.71,profile:'Bono Peruano 10Y emitido por Perú. Cupón anual de 6.45% con vencimiento a 10 años. Calificación BBB, spread de riesgo país 1.7%.'},
  {id:'ZA10',name:'Bono Sudafricano 10Y',ticker:'ZA-10Y',country:'Sudáfrica',price:85.6,coupon:10.85,maturity:10,rating:'BB-',sigma:12.4,ret:10.85,rp:3.1,type:'bono',ytm:12.53,duration:4.68,convexity:18.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:88.31,profile:'Bono Sudafricano 10Y emitido por Sudáfrica. Cupón anual de 10.85% con vencimiento a 10 años. Calificación BB-, spread de riesgo país 3.1%.'},
  {id:'TR10',name:'Bono Turco 10Y',ticker:'TR-10Y',country:'Turquía',price:78.3,coupon:24.5,maturity:10,rating:'B',sigma:18.7,ret:24.5,rp:4.8,type:'bono',ytm:27.27,duration:3.15,convexity:8.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:84.42,profile:'Bono Turco 10Y emitido por Turquía. Cupón anual de 24.5% con vencimiento a 10 años. Calificación B, spread de riesgo país 4.8%.'},
  {id:'IN10',name:'Bono Indio 10Y',ticker:'IN-10Y',country:'India',price:96.4,coupon:7.05,maturity:10,rating:'BBB-',sigma:7.4,ret:7.05,rp:1.5,type:'bono',ytm:7.42,duration:5.55,convexity:26.2,couponFreq:'Semestral',faceValue:100,dirtyPrice:98.16,profile:'Bono Indio 10Y emitido por India. Cupón anual de 7.05% con vencimiento a 10 años. Calificación BBB-, spread de riesgo país 1.5%.'},
  {id:'ID10',name:'Bono Indonesio 10Y',ticker:'ID-10Y',country:'Indonesia',price:94.7,coupon:6.65,maturity:10,rating:'BBB',sigma:8.1,ret:6.65,rp:1.9,type:'bono',ytm:7.21,duration:5.68,convexity:27.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:96.36,profile:'Bono Indonesio 10Y emitido por Indonesia. Cupón anual de 6.65% con vencimiento a 10 años. Calificación BBB, spread de riesgo país 1.9%.'},
  {id:'PA5',name:'Bono Panamá 5Y',ticker:'PA-5Y',country:'Panamá',price:96.2,coupon:5.25,maturity:5,rating:'BBB',sigma:5.4,ret:5.25,rp:1.3,type:'bono',ytm:6.04,duration:3.69,convexity:11.6,couponFreq:'Semestral',faceValue:100,dirtyPrice:97.51,profile:'Bono Panamá 5Y emitido por Panamá. Cupón anual de 5.25% con vencimiento a 5 años. Calificación BBB, spread de riesgo país 1.3%.'},
  {id:'CR10',name:'Bono Costa Rica 10Y',ticker:'CR-10Y',country:'Costa Rica',price:90.8,coupon:7.85,maturity:10,rating:'BB',sigma:9.6,ret:7.85,rp:2.6,type:'bono',ytm:8.86,duration:5.35,convexity:24.3,couponFreq:'Semestral',faceValue:100,dirtyPrice:92.76,profile:'Bono Costa Rica 10Y emitido por Costa Rica. Cupón anual de 7.85% con vencimiento a 10 años. Calificación BB, spread de riesgo país 2.6%.'},
  {id:'CORP-AAPL',name:'Bono Corp. Apple 10Y',ticker:'AAPL-BND',country:'EE.UU.',price:97.5,coupon:3.85,maturity:10,rating:'AAA',sigma:5.9,ret:3.85,rp:0.1,type:'bono',ytm:4.11,duration:6.72,convexity:38.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:98.46,profile:'Bono Corp. Apple 10Y emitido por EE.UU.. Cupón anual de 3.85% con vencimiento a 10 años. Calificación AAA, spread de riesgo país 0.1%.'},
  {id:'CORP-MSFT',name:'Bono Corp. Microsoft 10Y',ticker:'MSFT-BND',country:'EE.UU.',price:98.1,coupon:3.65,maturity:10,rating:'AAA',sigma:5.7,ret:3.65,rp:0.1,type:'bono',ytm:3.84,duration:6.81,convexity:39.4,couponFreq:'Semestral',faceValue:100,dirtyPrice:99.01,profile:'Bono Corp. Microsoft 10Y emitido por EE.UU.. Cupón anual de 3.65% con vencimiento a 10 años. Calificación AAA, spread de riesgo país 0.1%.'},
  {id:'CORP-KO',name:'Bono Corp. Coca-Cola 10Y',ticker:'KO-BND',country:'EE.UU.',price:96.3,coupon:4.15,maturity:10,rating:'A+',sigma:6.1,ret:4.15,rp:0.4,type:'bono',ytm:4.53,duration:6.59,convexity:36.9,couponFreq:'Semestral',faceValue:100,dirtyPrice:97.34,profile:'Bono Corp. Coca-Cola 10Y emitido por EE.UU.. Cupón anual de 4.15% con vencimiento a 10 años. Calificación A+, spread de riesgo país 0.4%.'},
  {id:'HY-US',name:'Bono Alto Rendimiento US',ticker:'HY-US',country:'EE.UU.',price:91.2,coupon:7.95,maturity:7,rating:'BB',sigma:9.8,ret:7.95,rp:2.2,type:'bono',ytm:9.33,duration:4.27,convexity:15.5,couponFreq:'Semestral',faceValue:100,dirtyPrice:93.19,profile:'Bono Alto Rendimiento US emitido por EE.UU.. Cupón anual de 7.95% con vencimiento a 7 años. Calificación BB, spread de riesgo país 2.2%.'}
];
const ALL_FOREX=[
  {id:'EURUSD',name:'Euro / Dólar',ticker:'EUR/USD',country:'Eurozona',price:1.082,sigma:8.2,ret:3.7,riskCountry:'Bajo',profile:'El EUR/USD es el par de divisas más negociado del mundo, con cerca del 24% del volumen diario global. La dirección del par está determinada por las decisiones del Banco Central Europeo (BCE) y la Reserva Federal de Estados Unidos (Fed). Es sensible a diferenciales de tasas de interés, datos de empleo e inflación de ambas regiones.',rp:0.3,type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:-3,
   gdp:{total:'18,350',perCapita:'38,200',growth:0.6,inflation:2.9,unemployment:6.1,currency:'Euro (EUR)',mainSectors:'Servicios (74%), Industria (20%), Agricultura (2%)',outlook:'Recuperación gradual. El BCE inició ciclo de recorte de tasas. Alemania, Francia e Italia como motores principales.',rating:'AAA/AA+'}
  },
  {id:'GBPUSD',name:'Libra / Dólar',ticker:'GBP/USD',country:'Reino Unido',price:1.268,sigma:9.8,ret:4.1,riskCountry:'Bajo',profile:'La libra esterlina es una de las monedas con mayor historia en el sistema financiero internacional. Tras el Brexit, el Banco de Inglaterra opera con plena autonomía respecto a la política monetaria europea. El par es sensible a los datos del PIB, inflación y empleo del Reino Unido, así como a las negociaciones comerciales con la Unión Europea.',rp:0.4,type:'divisa',rateBase:5.5,rateQuote:5.25,rateDiff:0.25,tradeBalance:98,
   gdp:{total:'3,070',perCapita:'45,800',growth:0.4,inflation:3.2,unemployment:4.2,currency:'Libra esterlina (GBP)',mainSectors:'Servicios financieros (30%), Manufactura (10%), Servicios (60%)',outlook:'Recuperación post-Brexit lenta. BoE mantiene tasas restrictivas. Presión inflacionaria persistente en servicios.',rating:'AA−'}
  },
  {id:'USDJPY',name:'Dólar / Yen',ticker:'USD/JPY',country:'Japón',price:154.7,sigma:7.5,ret:2.8,riskCountry:'Muy bajo',profile:'El yen japonés es una de las principales monedas refugio del mundo. Japón mantiene una política monetaria ultraexpansiva con control de la curva de rendimientos (YCC). El Banco de Japón interviene activamente en el mercado. Japón es la cuarta economía más grande del mundo por PIB nominal.',rp:0.1,type:'divisa',rateBase:5.5,rateQuote:0.1,rateDiff:5.4,tradeBalance:-77,
   gdp:{total:'4,231',perCapita:'33,800',growth:1.9,inflation:3.3,unemployment:2.6,currency:'Yen japonés (JPY)',mainSectors:'Manufactura (27%), Servicios (70%), Exportaciones tecnológicas',outlook:'Salida gradual de política monetaria ultralaxa. Debilidad del yen impulsa exportaciones. Envejecimiento poblacional presiona crecimiento potencial.',rating:'A+'}
  },
  {id:'USDCOP',name:'Dólar / Peso Col.',ticker:'USD/COP',country:'Colombia',price:3948,sigma:18.4,ret:6.2,riskCountry:'Moderado',profile:'El peso colombiano mantiene una alta correlación con el precio del petróleo Brent, dada la importancia del sector energético en la economía nacional. La incertidumbre en torno a la política energética del gobierno ha incrementado la percepción de riesgo. El EMBI de Colombia se sitúa alrededor de 250 puntos base, reflejando un riesgo país moderado.',rp:2.5,type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:-27,
   gdp:{total:'363',perCapita:'7,200',growth:1.6,inflation:9.3,unemployment:10.2,currency:'Peso colombiano (COP)',mainSectors:'Petróleo y minería (10%), Servicios (56%), Manufactura (11%)',outlook:'Inflación en descenso pero aún elevada. Banrep en ciclo de recorte de tasas. Incertidumbre por reforma energética y política fiscal del gobierno Petro.',rating:'BB+'}
  },
  {id:'USDMXN',name:'Dólar / Peso Mex.',ticker:'USD/MXN',country:'México',price:17.15,sigma:12.1,ret:5.8,riskCountry:'Moderado',profile:'El peso mexicano es una de las monedas de mercados emergentes más operadas a nivel global. El fenómeno del nearshoring ha impulsado la inversión extranjera directa y fortalecido la economía. El Banco de México mantiene tasas de interés elevadas para controlar la inflación. El par es muy sensible a la relación comercial con Estados Unidos en el marco del T-MEC.',rp:2.1,type:'divisa',rateBase:5.5,rateQuote:11.25,rateDiff:-5.75,tradeBalance:-54,
   gdp:{total:'1,322',perCapita:'10,200',growth:3.2,inflation:4.9,unemployment:2.9,currency:'Peso mexicano (MXN)',mainSectors:'Manufactura (20%), Petróleo y gas (7%), Servicios (63%)',outlook:'Nearshoring impulsa inversión extranjera directa récord. Banxico con tasas restrictivas. Resultado electoral 2024 con impacto en política fiscal y certidumbre jurídica.',rating:'BBB−'}
  },
  {id:'USDBRL',name:'Dólar / Real Bra.',ticker:'USD/BRL',country:'Brasil',price:5.02,sigma:16.8,ret:7.4,riskCountry:'Moderado-alto',profile:'Real brasileño con alta volatilidad por incertidumbre fiscal. Mayor economía de Latinoamérica. Banco Central de Brasil aplica política monetaria agresiva contra la inflación. Las exportaciones de materias primas (soja, petróleo) determinan la tendencia del BRL.',rp:3.2,type:'divisa',rateBase:5.5,rateQuote:11.75,rateDiff:-6.25,tradeBalance:92,
   gdp:{total:'2,173',perCapita:'10,300',growth:2.9,inflation:4.6,unemployment:7.8,currency:'Real brasileño (BRL)',mainSectors:'Servicios (73%), Industria (20%), Agricultura (7%)',outlook:'Crecimiento sólido impulsado por agro y servicios. Preocupaciones fiscales generan presión sobre el real. BCB con tasa Selic elevada para controlar inflación.',rating:'BB'}
  },
  {id:'USDARS',name:'Dólar / Peso Arg.',ticker:'USD/ARS',country:'Argentina',price:896,sigma:65.2,ret:45.0,riskCountry:'Muy alto',profile:'Argentina atraviesa un período de alta inestabilidad macroeconómica, con tasas de inflación superiores al 200% anual y severas restricciones cambiarias. El Banco Central de la República Argentina opera con reservas internacionales negativas. Existe una brecha significativa entre el tipo de cambio oficial y el paralelo. Se trata de una inversión de carácter exclusivamente especulativo.',rp:18.0,type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:-76,
   gdp:{total:'621',perCapita:'13,400',growth:-2.5,inflation:211.4,unemployment:6.2,currency:'Peso argentino (ARS)',mainSectors:'Servicios (53%), Industria (23%), Agro (7%), Minería (3%)',outlook:'Ajuste fiscal severo bajo gobierno Milei. Inflación en descenso desde pico de 211%. Reservas negativas del BCRA. Proceso de renegociación con FMI en curso. Alto riesgo de volatilidad.',rating:'CCC'}
  },
  {id:'USDCHF',name:'Dólar / Franco Suizo',ticker:'USD/CHF',country:'Suiza',price:0.882,sigma:8.4,ret:1.2,rating:'AAA',rp:0.1,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:1.75,rateDiff:3.75,tradeBalance:-75,profile:'Dólar / Franco Suizo (USD/CHF). Par cambiario asociado a Suiza. Volatilidad anualizada de 8.4%, calificación soberana AAA, riesgo país 0.1%.',gdp:{total:'905',perCapita:'99,100',growth:1.3,inflation:1.4,unemployment:2.0,currency:'Franco suizo (CHF)',mainSectors:'Servicios financieros (74%), Industria farmacéutica, Relojería',outlook:'Refugio de estabilidad. El SNB mantiene política prudente. Baja inflación y moneda fuerte como activo de refugio.',rating:'AAA'}},
  {id:'USDCAD',name:'Dólar / Dólar Canadiense',ticker:'USD/CAD',country:'Canadá',price:1.365,sigma:9.1,ret:1.8,rating:'AAA',rp:0.2,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:5.0,rateDiff:0.5,tradeBalance:54,profile:'Dólar / Dólar Canadiense (USD/CAD). Par cambiario asociado a Canadá. Volatilidad anualizada de 9.1%, calificación soberana AAA, riesgo país 0.2%.',gdp:{total:'2,140',perCapita:'53,200',growth:1.1,inflation:3.4,unemployment:5.8,currency:'Dólar canadiense (CAD)',mainSectors:'Energía, Servicios (70%), Manufactura, Minería',outlook:'Economía ligada a materias primas y a EE.UU. El Banco de Canadá inicia distensión monetaria.',rating:'AAA'}},
  {id:'AUDUSD',name:'Dólar Australiano / Dólar',ticker:'AUD/USD',country:'Australia',price:0.658,sigma:11.2,ret:2.4,rating:'AAA',rp:0.3,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:4.35,rateDiff:1.15,tradeBalance:-38,profile:'Dólar Australiano / Dólar (AUD/USD). Par cambiario asociado a Australia. Volatilidad anualizada de 11.2%, calificación soberana AAA, riesgo país 0.3%.',gdp:{total:'1,690',perCapita:'64,500',growth:1.5,inflation:4.1,unemployment:3.9,currency:'Dólar australiano (AUD)',mainSectors:'Minería, Servicios (65%), Agricultura, Educación',outlook:'Fuerte exposición a commodities y a China. El RBA mantiene tasas elevadas por inflación persistente.',rating:'AAA'}},
  {id:'NZDUSD',name:'Dólar Neozelandés / Dólar',ticker:'NZD/USD',country:'Nueva Zelanda',price:0.612,sigma:11.8,ret:2.6,rating:'AA',rp:0.4,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:5.5,rateDiff:0.0,tradeBalance:-65,profile:'Dólar Neozelandés / Dólar (NZD/USD). Par cambiario asociado a Nueva Zelanda. Volatilidad anualizada de 11.8%, calificación soberana AA, riesgo país 0.4%.',gdp:{total:'250',perCapita:'48,500',growth:0.6,inflation:4.7,unemployment:4.0,currency:'Dólar neozelandés (NZD)',mainSectors:'Agricultura, Turismo, Servicios',outlook:'Economía pequeña y abierta, sensible a lácteos y turismo. Tasas altas para contener inflación.',rating:'AA+'}},
  {id:'USDCNY',name:'Dólar / Yuan Chino',ticker:'USD/CNY',country:'China',price:7.24,sigma:6.8,ret:1.4,rating:'A+',rp:0.6,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.45,rateDiff:2.05,tradeBalance:38,profile:'Dólar / Yuan Chino (USD/CNY). Par cambiario asociado a China. Volatilidad anualizada de 6.8%, calificación soberana A+, riesgo país 0.6%.',gdp:{total:'17,790',perCapita:'12,600',growth:5.2,inflation:0.2,unemployment:5.2,currency:'Yuan renminbi (CNY)',mainSectors:'Manufactura (38%), Servicios (54%), Tecnología',outlook:'Crecimiento moderado con presión deflacionaria. Estímulos para sostener la demanda interna y el sector inmobiliario.',rating:'A+'}},
  {id:'USDINR',name:'Dólar / Rupia India',ticker:'USD/INR',country:'India',price:83.4,sigma:7.2,ret:2.1,rating:'BBB-',rp:1.5,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:6.5,rateDiff:-1.0,tradeBalance:47,profile:'Dólar / Rupia India (USD/INR). Par cambiario asociado a India. Volatilidad anualizada de 7.2%, calificación soberana BBB-, riesgo país 1.5%.',gdp:{total:'3,730',perCapita:'2,600',growth:7.0,inflation:5.1,unemployment:7.1,currency:'Rupia india (INR)',mainSectors:'Servicios TI, Manufactura, Agricultura',outlook:'Economía de mayor crecimiento entre las grandes. Demografía favorable e inversión en infraestructura.',rating:'BBB-'}},
  {id:'USDSGD',name:'Dólar / Dólar Singapur',ticker:'USD/SGD',country:'Singapur',price:1.348,sigma:6.4,ret:1.1,rating:'AAA',rp:0.1,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:3.5,rateDiff:2.0,tradeBalance:-63,profile:'Dólar / Dólar Singapur (USD/SGD). Par cambiario asociado a Singapur. Volatilidad anualizada de 6.4%, calificación soberana AAA, riesgo país 0.1%.',gdp:{total:'500',perCapita:'84,500',growth:1.1,inflation:3.7,unemployment:2.0,currency:'Dólar de Singapur (SGD)',mainSectors:'Servicios financieros, Comercio, Tecnología',outlook:'Centro financiero y comercial. Política monetaria gestionada vía tipo de cambio. Estabilidad y rating elevado.',rating:'AAA'}},
  {id:'USDHKD',name:'Dólar / Dólar Hong Kong',ticker:'USD/HKD',country:'Hong Kong',price:7.81,sigma:2.1,ret:0.4,rating:'AA+',rp:0.3,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:1,profile:'Dólar / Dólar Hong Kong (USD/HKD). Par cambiario asociado a Hong Kong. Volatilidad anualizada de 2.1%, calificación soberana AA+, riesgo país 0.3%.',gdp:{total:'380',perCapita:'50,700',growth:2.5,inflation:1.8,unemployment:3.0,currency:'Dólar de Hong Kong (HKD)',mainSectors:'Servicios financieros, Comercio, Logística',outlook:'Centro financiero anclado al dólar (peg). Sensible a flujos con China continental.',rating:'AA+'}},
  {id:'USDSEK',name:'Dólar / Corona Sueca',ticker:'USD/SEK',country:'Suecia',price:10.62,sigma:12.4,ret:2.2,rating:'AAA',rp:0.2,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:4.0,rateDiff:1.5,tradeBalance:-90,profile:'Dólar / Corona Sueca (USD/SEK). Par cambiario asociado a Suecia. Volatilidad anualizada de 12.4%, calificación soberana AAA, riesgo país 0.2%.',gdp:{total:'600',perCapita:'56,300',growth:0.2,inflation:4.1,unemployment:7.7,currency:'Corona sueca (SEK)',mainSectors:'Manufactura, Servicios, Tecnología',outlook:'Economía exportadora afectada por el sector inmobiliario. El Riksbank evalúa flexibilización.',rating:'AAA'}},
  {id:'USDNOK',name:'Dólar / Corona Noruega',ticker:'USD/NOK',country:'Noruega',price:10.88,sigma:13.1,ret:2.4,rating:'AAA',rp:0.2,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:4.5,rateDiff:1.0,tradeBalance:-72,profile:'Dólar / Corona Noruega (USD/NOK). Par cambiario asociado a Noruega. Volatilidad anualizada de 13.1%, calificación soberana AAA, riesgo país 0.2%.',gdp:{total:'485',perCapita:'89,200',growth:1.1,inflation:4.8,unemployment:3.6,currency:'Corona noruega (NOK)',mainSectors:'Petróleo y gas, Pesca, Servicios',outlook:'Superávit por hidrocarburos y fondo soberano. El Norges Bank mantiene tasas restrictivas.',rating:'AAA'}},
  {id:'USDZAR',name:'Dólar / Rand Sudafricano',ticker:'USD/ZAR',country:'Sudáfrica',price:18.42,sigma:18.7,ret:3.8,rating:'BB-',rp:3.1,riskCountry:'Alto',type:'divisa',rateBase:5.5,rateQuote:8.25,rateDiff:-2.75,tradeBalance:-96,profile:'Dólar / Rand Sudafricano (USD/ZAR). Par cambiario asociado a Sudáfrica. Volatilidad anualizada de 18.7%, calificación soberana BB-, riesgo país 3.1%.',gdp:{total:'400',perCapita:'6,500',growth:0.9,inflation:5.3,unemployment:32.1,currency:'Rand sudafricano (ZAR)',mainSectors:'Minería, Servicios financieros, Manufactura',outlook:'Crecimiento débil, desempleo estructural alto y restricciones energéticas. Riesgo país elevado.',rating:'BB-'}},
  {id:'USDTRY',name:'Dólar / Lira Turca',ticker:'USD/TRY',country:'Turquía',price:32.18,sigma:28.4,ret:8.2,rating:'B',rp:4.8,riskCountry:'Muy alto',type:'divisa',rateBase:5.5,rateQuote:45.0,rateDiff:-39.5,tradeBalance:-97,profile:'Dólar / Lira Turca (USD/TRY). Par cambiario asociado a Turquía. Volatilidad anualizada de 28.4%, calificación soberana B, riesgo país 4.8%.',gdp:{total:'1,110',perCapita:'13,000',growth:4.5,inflation:64.8,unemployment:9.4,currency:'Lira turca (TRY)',mainSectors:'Manufactura, Turismo, Agricultura',outlook:'Inflación muy elevada tras años de política heterodoxa. Giro reciente hacia ortodoxia monetaria con tasas altas.',rating:'B'}},
  {id:'USDCLP',name:'Dólar / Peso Chileno',ticker:'USD/CLP',country:'Chile',price:948.0,sigma:14.2,ret:2.8,rating:'A',rp:1.2,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:-32,profile:'Dólar / Peso Chileno (USD/CLP). Par cambiario asociado a Chile. Volatilidad anualizada de 14.2%, calificación soberana A, riesgo país 1.2%.',gdp:{total:'—',perCapita:'—',growth:1.5,inflation:3.0,unemployment:5.0,currency:'Moneda local',mainSectors:'Servicios, Industria, Agricultura',outlook:'Datos macroeconómicos de referencia con fines educativos.',rating:'BBB'}},
  {id:'USDPEN',name:'Dólar / Sol Peruano',ticker:'USD/PEN',country:'Perú',price:3.74,sigma:9.8,ret:2.1,rating:'BBB',rp:1.7,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:-57,profile:'Dólar / Sol Peruano (USD/PEN). Par cambiario asociado a Perú. Volatilidad anualizada de 9.8%, calificación soberana BBB, riesgo país 1.7%.',gdp:{total:'—',perCapita:'—',growth:1.5,inflation:3.0,unemployment:5.0,currency:'Moneda local',mainSectors:'Servicios, Industria, Agricultura',outlook:'Datos macroeconómicos de referencia con fines educativos.',rating:'BBB'}},
  {id:'EURGBP',name:'Euro / Libra Esterlina',ticker:'EUR/GBP',country:'Eurozona',price:0.852,sigma:7.8,ret:1.4,rating:'AA',rp:0.3,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:71,profile:'Euro / Libra Esterlina (EUR/GBP). Par cambiario asociado a Eurozona. Volatilidad anualizada de 7.8%, calificación soberana AA, riesgo país 0.3%.',gdp:{total:'—',perCapita:'—',growth:1.5,inflation:3.0,unemployment:5.0,currency:'Moneda local',mainSectors:'Servicios, Industria, Agricultura',outlook:'Datos macroeconómicos de referencia con fines educativos.',rating:'BBB'}},
  {id:'EURJPY',name:'Euro / Yen Japonés',ticker:'EUR/JPY',country:'Eurozona',price:163.2,sigma:9.4,ret:1.8,rating:'AA',rp:0.3,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:92,profile:'Euro / Yen Japonés (EUR/JPY). Par cambiario asociado a Eurozona. Volatilidad anualizada de 9.4%, calificación soberana AA, riesgo país 0.3%.',gdp:{total:'—',perCapita:'—',growth:1.5,inflation:3.0,unemployment:5.0,currency:'Moneda local',mainSectors:'Servicios, Industria, Agricultura',outlook:'Datos macroeconómicos de referencia con fines educativos.',rating:'BBB'}},
  {id:'EURCHF',name:'Euro / Franco Suizo',ticker:'EUR/CHF',country:'Eurozona',price:0.954,sigma:6.8,ret:1.1,rating:'AAA',rp:0.2,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:82,profile:'Euro / Franco Suizo (EUR/CHF). Par cambiario asociado a Eurozona. Volatilidad anualizada de 6.8%, calificación soberana AAA, riesgo país 0.2%.',gdp:{total:'—',perCapita:'—',growth:1.5,inflation:3.0,unemployment:5.0,currency:'Moneda local',mainSectors:'Servicios, Industria, Agricultura',outlook:'Datos macroeconómicos de referencia con fines educativos.',rating:'BBB'}},
  {id:'GBPJPY',name:'Libra / Yen Japonés',ticker:'GBP/JPY',country:'Reino Unido',price:191.4,sigma:11.2,ret:2.2,rating:'AA',rp:0.4,riskCountry:'Bajo',type:'divisa',rateBase:5.5,rateQuote:5.25,rateDiff:0.25,tradeBalance:51,profile:'Libra / Yen Japonés (GBP/JPY). Par cambiario asociado a Reino Unido. Volatilidad anualizada de 11.2%, calificación soberana AA, riesgo país 0.4%.',gdp:{total:'3,340',perCapita:'49,100',growth:0.5,inflation:3.4,unemployment:4.2,currency:'Libra esterlina (GBP)',mainSectors:'Servicios financieros, Manufactura, Servicios',outlook:'Recuperación post-Brexit lenta. El BoE mantiene tasas restrictivas con inflación persistente en servicios.',rating:'AA-'}},
  {id:'AUDJPY',name:'Dólar Australiano / Yen',ticker:'AUD/JPY',country:'Australia',price:98.7,sigma:12.8,ret:2.6,rating:'AA',rp:0.5,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:4.35,rateDiff:1.15,tradeBalance:70,profile:'Dólar Australiano / Yen (AUD/JPY). Par cambiario asociado a Australia. Volatilidad anualizada de 12.8%, calificación soberana AA, riesgo país 0.5%.',gdp:{total:'1,690',perCapita:'64,500',growth:1.5,inflation:4.1,unemployment:3.9,currency:'Dólar australiano (AUD)',mainSectors:'Minería, Servicios (65%), Agricultura, Educación',outlook:'Fuerte exposición a commodities y a China. El RBA mantiene tasas elevadas por inflación persistente.',rating:'AAA'}},
  {id:'USDMXN2',name:'Dólar / Peso Mexicano',ticker:'USD/MXN',country:'México',price:17.08,sigma:13.4,ret:2.9,rating:'BBB',rp:1.6,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:11.25,rateDiff:-5.75,tradeBalance:-54,profile:'Dólar / Peso Mexicano (USD/MXN). Par cambiario asociado a México. Volatilidad anualizada de 13.4%, calificación soberana BBB, riesgo país 1.6%.',gdp:{total:'1,790',perCapita:'13,800',growth:3.2,inflation:4.7,unemployment:2.8,currency:'Peso mexicano (MXN)',mainSectors:'Manufactura, Servicios, Remesas, Energía',outlook:'Beneficiario del nearshoring. Banxico mantiene tasas altas; peso fuerte por diferencial de tasas con EE.UU.',rating:'BBB'}},
  {id:'USDPLN',name:'Dólar / Zloty Polaco',ticker:'USD/PLN',country:'Polonia',price:3.94,sigma:12.1,ret:2.4,rating:'A-',rp:0.9,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:58,profile:'Dólar / Zloty Polaco (USD/PLN). Par cambiario asociado a Polonia. Volatilidad anualizada de 12.1%, calificación soberana A-, riesgo país 0.9%.',gdp:{total:'810',perCapita:'21,500',growth:2.7,inflation:6.2,unemployment:2.9,currency:'Esloti polaco (PLN)',mainSectors:'Manufactura, Servicios, Agricultura',outlook:'Crecimiento sólido en Europa Central. Convergencia con la UE; inflación en descenso.',rating:'A-'}},
  {id:'USDTHB',name:'Dólar / Baht Tailandés',ticker:'USD/THB',country:'Tailandia',price:36.2,sigma:7.4,ret:1.6,rating:'BBB+',rp:1.1,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.0,rateDiff:2.5,tradeBalance:88,profile:'Dólar / Baht Tailandés (USD/THB). Par cambiario asociado a Tailandia. Volatilidad anualizada de 7.4%, calificación soberana BBB+, riesgo país 1.1%.',gdp:{total:'510',perCapita:'7,300',growth:1.9,inflation:1.3,unemployment:1.0,currency:'Baht tailandés (THB)',mainSectors:'Turismo, Manufactura, Agricultura',outlook:'Recuperación apoyada en turismo. Baja inflación; exposición a la demanda regional.',rating:'BBB+'}},
  {id:'USDKRW',name:'Dólar / Won Coreano',ticker:'USD/KRW',country:'Corea del Sur',price:1342.0,sigma:9.8,ret:2.0,rating:'AA',rp:0.7,riskCountry:'Moderado',type:'divisa',rateBase:5.5,rateQuote:3.5,rateDiff:2.0,tradeBalance:-1,profile:'Dólar / Won Coreano (USD/KRW). Par cambiario asociado a Corea del Sur. Volatilidad anualizada de 9.8%, calificación soberana AA, riesgo país 0.7%.',gdp:{total:'1,710',perCapita:'33,100',growth:1.4,inflation:3.6,unemployment:2.8,currency:'Won surcoreano (KRW)',mainSectors:'Tecnología, Manufactura, Exportaciones',outlook:'Economía exportadora de semiconductores y automóviles. Sensible al ciclo tecnológico global.',rating:'AA'}}
];

// ── FUTUROS ──
const ALL_FUTURES=[
  {id:'CL1',name:'Petróleo Crudo WTI',ticker:'CL1!',sector:'Energía',country:'Global',price:78.4,beta:1.45,sigma:32.8,ret:8.2,rating:'N/A',dividend:0,type:'futuro',spot:77.224,basis:1.176,openInterest:229,curveState:'Contango',expiry:'Trimestral',
   profile:'Contrato de futuros del crudo West Texas Intermediate (WTI), referencia de petróleo en América. Cotiza en el NYMEX (CME Group). El precio refleja oferta/demanda global, decisiones de la OPEP+ y tensiones geopolíticas en Medio Oriente. Contrato estándar: 1,000 barriles.',
   specs:{exchange:'NYMEX/CME',contractSize:'1,000 barriles',tickSize:'$0.01/barril',margin:'$5,000–$7,000 aprox.',settlement:'Entrega física',expiryNote:'Mes próximo al vencimiento'}
  },
  {id:'GC1',name:'Oro',ticker:'GC1!',sector:'Metales preciosos',country:'Global',price:2345.0,beta:0.18,sigma:14.2,ret:6.1,rating:'N/A',dividend:0,type:'futuro',spot:2373.14,basis:-28.14,openInterest:498,curveState:'Backwardation',expiry:'Trimestral',
   profile:'Contrato de futuros del oro en el COMEX (CME Group). El oro actúa como reserva de valor y activo refugio. Su precio sube en contextos de incertidumbre geopolítica, inflación elevada y debilidad del dólar. Los bancos centrales son los mayores compradores institucionales.',
   specs:{exchange:'COMEX/CME',contractSize:'100 onzas troy',tickSize:'$0.10/onza',margin:'$9,000–$12,000 aprox.',settlement:'Entrega física o cash',expiryNote:'Feb, Apr, Jun, Aug, Oct, Dec'}
  },
  {id:'ES1',name:'S&P 500 E-mini',ticker:'ES1!',sector:'Índices',country:'EE.UU.',price:5248.0,beta:1.0,sigma:18.6,ret:10.2,rating:'N/A',dividend:0,type:'futuro',spot:5169.28,basis:78.72,openInterest:917,curveState:'Contango',expiry:'Trimestral',
   profile:'Futuro sobre el índice S&P 500, que representa las 500 mayores empresas cotizadas en EE.UU. Es el contrato de futuros de índices más negociado del mundo. Se utiliza para cobertura de carteras de renta variable y como indicador del sentimiento del mercado bursátil americano.',
   specs:{exchange:'CME Group',contractSize:'$50 × S&P 500',tickSize:'0.25 puntos ($12.50)',margin:'$12,000–$15,000 aprox.',settlement:'Cash (liquidación en efectivo)',expiryNote:'Mar, Jun, Sep, Dic'}
  },
  {id:'ZW1',name:'Trigo CBOT',ticker:'ZW1!',sector:'Agrícola',country:'Global',price:584.5,beta:0.52,sigma:28.4,ret:4.8,rating:'N/A',dividend:0,type:'futuro',spot:591.514,basis:-7.014,openInterest:478,curveState:'Backwardation',expiry:'Trimestral',
   profile:'Futuro sobre trigo blando de invierno en el CBOT (CME Group). Referencia para el mercado global de granos. El precio es altamente sensible a condiciones climáticas, producción de EE.UU., Ucrania y Rusia, y a la demanda de países importadores como Egipto y China.',
   specs:{exchange:'CBOT/CME',contractSize:'5,000 bushels',tickSize:'1/4 centavo/bushel ($12.50)',margin:'$1,500–$2,500 aprox.',settlement:'Entrega física',expiryNote:'Mar, May, Jul, Sep, Dic'}
  },
  {id:'6E1',name:'Euro FX Futuro',ticker:'6E1!',sector:'Divisas',country:'Eurozona',price:1.082,beta:0.38,sigma:8.4,ret:3.7,rating:'N/A',dividend:0,type:'futuro',spot:1.0658,basis:0.0162,openInterest:547,curveState:'Contango',expiry:'Trimestral',
   profile:'Contrato de futuros sobre el tipo de cambio EUR/USD en el CME. Se utiliza para cobertura cambiaria por importadores, exportadores y gestores de fondos con exposición al euro. Es el contrato de futuros de divisas más negociado del mundo.',
   specs:{exchange:'CME Group',contractSize:'125,000 euros',tickSize:'$0.00005/EUR ($6.25)',margin:'$2,000–$3,500 aprox.',settlement:'Entrega física de euros',expiryNote:'Mar, Jun, Sep, Dic'}
  },
  {id:'BTC1',name:'Bitcoin CME',ticker:'BTC1!',sector:'Criptoactivos',country:'Global',price:67500,beta:2.85,sigma:72.4,ret:42.0,rating:'N/A',dividend:0,type:'futuro',spot:68310.0,basis:-810.0,openInterest:791,curveState:'Backwardation',expiry:'Trimestral',
   profile:'Contrato de futuros sobre Bitcoin regulado en el CME Group. Permite exposición al precio del BTC sin custodia directa. Alta volatilidad y liquidez creciente. Utilizado por institucionales para cobertura y especulación. Aprobación de ETFs spot en 2024 impulsó adopción institucional.',
   specs:{exchange:'CME Group',contractSize:'5 BTC',tickSize:'$5/BTC ($25/contrato)',margin:'$50,000–$80,000 aprox.',settlement:'Cash (precio de referencia CF Benchmarks)',expiryNote:'Mensual y trimestral'}
  },
  {id:'NG1',name:'Futuro Gas Natural',ticker:'NG1!',sector:'Energía',country:'Global',price:2.84,sigma:42.8,ret:7.2,type:'futuro',spot:2.8741,basis:-0.0341,openInterest:670,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Gas Natural (NG1!). Contrato de futuros del sector energía. Volatilidad anualizada de 42.8%, retorno esperado 7.2%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'HG1',name:'Futuro Cobre',ticker:'HG1!',sector:'Materiales',country:'Global',price:4.28,sigma:26.4,ret:8.1,type:'futuro',spot:4.2158,basis:0.0642,openInterest:151,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Cobre (HG1!). Contrato de futuros del sector materiales. Volatilidad anualizada de 26.4%, retorno esperado 8.1%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'SI1',name:'Futuro Plata',ticker:'SI1!',sector:'Materiales',country:'Global',price:29.4,sigma:31.2,ret:7.8,type:'futuro',spot:28.959,basis:0.441,openInterest:800,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Plata (SI1!). Contrato de futuros del sector materiales. Volatilidad anualizada de 31.2%, retorno esperado 7.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'PL1',name:'Futuro Platino',ticker:'PL1!',sector:'Materiales',country:'Global',price:968.0,sigma:28.6,ret:6.4,type:'futuro',spot:953.48,basis:14.52,openInterest:642,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Platino (PL1!). Contrato de futuros del sector materiales. Volatilidad anualizada de 28.6%, retorno esperado 6.4%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'ZC1',name:'Futuro Maíz',ticker:'ZC1!',sector:'Agrícola',country:'Global',price:442.5,sigma:24.1,ret:5.2,type:'futuro',spot:447.81,basis:-5.31,openInterest:593,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Maíz (ZC1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 24.1%, retorno esperado 5.2%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'ZS1',name:'Futuro Soja',ticker:'ZS1!',sector:'Agrícola',country:'Global',price:1184.0,sigma:22.8,ret:5.8,type:'futuro',spot:1198.208,basis:-14.208,openInterest:574,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Soja (ZS1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 22.8%, retorno esperado 5.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'KC1',name:'Futuro Café',ticker:'KC1!',sector:'Agrícola',country:'Global',price:238.5,sigma:34.2,ret:6.9,type:'futuro',spot:234.9225,basis:3.5775,openInterest:311,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Café (KC1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 34.2%, retorno esperado 6.9%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'SB1',name:'Futuro Azúcar',ticker:'SB1!',sector:'Agrícola',country:'Global',price:19.8,sigma:29.4,ret:5.4,type:'futuro',spot:19.503,basis:0.297,openInterest:729,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Azúcar (SB1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 29.4%, retorno esperado 5.4%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'CT1',name:'Futuro Algodón',ticker:'CT1!',sector:'Agrícola',country:'Global',price:78.2,sigma:27.1,ret:4.8,type:'futuro',spot:79.1384,basis:-0.9384,openInterest:269,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Algodón (CT1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 27.1%, retorno esperado 4.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'CC1',name:'Futuro Cacao',ticker:'CC1!',sector:'Agrícola',country:'Global',price:7842.0,sigma:38.6,ret:7.1,type:'futuro',spot:7724.37,basis:117.63,openInterest:618,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Cacao (CC1!). Contrato de futuros del sector agrícola. Volatilidad anualizada de 38.6%, retorno esperado 7.1%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'NQ1',name:'Futuro Nasdaq 100',ticker:'NQ1!',sector:'Índices',country:'EE.UU.',price:18420.0,sigma:21.4,ret:11.2,type:'futuro',spot:18641.04,basis:-221.04,openInterest:684,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Nasdaq 100 (NQ1!). Contrato de futuros del sector índices. Volatilidad anualizada de 21.4%, retorno esperado 11.2%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'YM1',name:'Futuro Dow Jones',ticker:'YM1!',sector:'Índices',country:'EE.UU.',price:39250.0,sigma:16.8,ret:8.4,type:'futuro',spot:38661.25,basis:588.75,openInterest:439,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Dow Jones (YM1!). Contrato de futuros del sector índices. Volatilidad anualizada de 16.8%, retorno esperado 8.4%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'RTY1',name:'Futuro Russell 2000',ticker:'RTY1!',sector:'Índices',country:'EE.UU.',price:2042.0,sigma:23.8,ret:9.1,type:'futuro',spot:2066.504,basis:-24.504,openInterest:298,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Russell 2000 (RTY1!). Contrato de futuros del sector índices. Volatilidad anualizada de 23.8%, retorno esperado 9.1%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'DAX1',name:'Futuro DAX 40',ticker:'DAX1!',sector:'Índices',country:'Alemania',price:18180.0,sigma:18.4,ret:9.8,type:'futuro',spot:17907.3,basis:272.7,openInterest:137,curveState:'Contango',expiry:'Trimestral',profile:'Futuro DAX 40 (DAX1!). Contrato de futuros del sector índices. Volatilidad anualizada de 18.4%, retorno esperado 9.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'FTSE1',name:'Futuro FTSE 100',ticker:'FTSE1!',sector:'Índices',country:'Reino Unido',price:8124.0,sigma:15.2,ret:7.6,type:'futuro',spot:8221.488,basis:-97.488,openInterest:984,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro FTSE 100 (FTSE1!). Contrato de futuros del sector índices. Volatilidad anualizada de 15.2%, retorno esperado 7.6%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'N225',name:'Futuro Nikkei 225',ticker:'N225!',sector:'Índices',country:'Japón',price:38420.0,sigma:19.8,ret:9.4,type:'futuro',spot:37843.7,basis:576.3,openInterest:528,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Nikkei 225 (N225!). Contrato de futuros del sector índices. Volatilidad anualizada de 19.8%, retorno esperado 9.4%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'ETH1',name:'Futuro Ethereum',ticker:'ETH1!',sector:'Cripto',country:'Global',price:3284.0,sigma:58.4,ret:14.2,type:'futuro',spot:3323.408,basis:-39.408,openInterest:969,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Ethereum (ETH1!). Contrato de futuros del sector cripto. Volatilidad anualizada de 58.4%, retorno esperado 14.2%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'ZB1',name:'Futuro Bono T 30Y',ticker:'ZB1!',sector:'Renta Fija',country:'EE.UU.',price:118.4,sigma:9.8,ret:3.2,type:'futuro',spot:116.624,basis:1.776,openInterest:937,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Bono T 30Y (ZB1!). Contrato de futuros del sector renta fija. Volatilidad anualizada de 9.8%, retorno esperado 3.2%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'ZN1',name:'Futuro Nota T 10Y',ticker:'ZN1!',sector:'Renta Fija',country:'EE.UU.',price:110.2,sigma:6.4,ret:2.8,type:'futuro',spot:111.5224,basis:-1.3224,openInterest:368,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Nota T 10Y (ZN1!). Contrato de futuros del sector renta fija. Volatilidad anualizada de 6.4%, retorno esperado 2.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'6J1',name:'Futuro Yen Japonés',ticker:'6J1!',sector:'Divisas',country:'Japón',price:0.00642,sigma:9.2,ret:1.8,type:'futuro',spot:0.0063,basis:0.0001,openInterest:431,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Yen Japonés (6J1!). Contrato de futuros del sector divisas. Volatilidad anualizada de 9.2%, retorno esperado 1.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'6B1',name:'Futuro Libra Esterlina',ticker:'6B1!',sector:'Divisas',country:'Reino Unido',price:1.272,sigma:8.8,ret:2.1,type:'futuro',spot:1.2873,basis:-0.0153,openInterest:278,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Libra Esterlina (6B1!). Contrato de futuros del sector divisas. Volatilidad anualizada de 8.8%, retorno esperado 2.1%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'6C1',name:'Futuro Dólar Canadiense',ticker:'6C1!',sector:'Divisas',country:'Canadá',price:0.732,sigma:8.4,ret:1.9,type:'futuro',spot:0.7408,basis:-0.0088,openInterest:281,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Dólar Canadiense (6C1!). Contrato de futuros del sector divisas. Volatilidad anualizada de 8.4%, retorno esperado 1.9%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'RB1',name:'Futuro Gasolina',ticker:'RB1!',sector:'Energía',country:'Global',price:2.42,sigma:34.8,ret:6.8,type:'futuro',spot:2.3837,basis:0.0363,openInterest:422,curveState:'Contango',expiry:'Trimestral',profile:'Futuro Gasolina (RB1!). Contrato de futuros del sector energía. Volatilidad anualizada de 34.8%, retorno esperado 6.8%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}},
  {id:'HO1',name:'Futuro Diésel',ticker:'HO1!',sector:'Energía',country:'Global',price:2.68,sigma:32.4,ret:6.4,type:'futuro',spot:2.7122,basis:-0.0322,openInterest:797,curveState:'Backwardation',expiry:'Trimestral',profile:'Futuro Diésel (HO1!). Contrato de futuros del sector energía. Volatilidad anualizada de 32.4%, retorno esperado 6.4%.',specs:{exchange:'CME/ICE',contractSize:'Estándar',tickSize:'0.01',margin:'8-12%',settlement:'Mensual'}}
];

// ── DERIVADOS ──
const ALL_DERIVATIVES=[
  {id:'AAPL-CALL',name:'Opción Call Apple',ticker:'AAPL 200C',sector:'Opciones / Acciones',country:'EE.UU.',price:8.45,beta:1.9,sigma:38.2,ret:18.5,rating:'N/A',dividend:0,type:'derivado',delta:0.48,gamma:0.04,theta:-0.12,vega:0.18,impliedVol:28.4,strike:200,intrinsic:5.07,
   profile:'Opción de compra (Call) sobre acciones de Apple Inc. con precio de ejercicio (strike) de $200. Otorga el derecho, no la obligación, de comprar 100 acciones de AAPL a $200 hasta la fecha de vencimiento. Prima actual: $8.45/acción.',
   specs:{underlying:'Apple Inc. (AAPL)',type:'Call (opción de compra)',strike:'$200.00',expiry:'Próximo vencimiento mensual',premium:'$8.45 / acción',contractSize:'100 acciones',delta:'0.48',gamma:'0.04',theta:'-0.12 ($/día)',iv:'28.4% (volatilidad implícita)'}
  },
  {id:'IRS-USD',name:'Swap Tasa Interés USD',ticker:'IRS-5Y-USD',sector:'Swaps / Tasas',country:'EE.UU.',price:4.85,beta:0.12,sigma:5.8,ret:4.85,rating:'N/A',dividend:0,type:'derivado',delta:0.84,gamma:0.09,theta:-0.24,vega:0.39,impliedVol:14.8,strike:4.61,intrinsic:2.91,
   profile:'Contrato de Swap de Tasas de Interés (IRS) a 5 años en dólares. Una parte paga una tasa fija del 4.85% y recibe SOFR (tasa flotante). Instrumento utilizado por bancos, corporaciones y fondos para gestionar el riesgo de tasas de interés en sus carteras de deuda.',
   specs:{type:'Interest Rate Swap (IRS)',maturity:'5 años',payLeg:'Tasa fija 4.85% (anual)',receiveLeg:'SOFR + spread (flotante)',notional:'$1,000,000 (nocional de referencia)',settlement:'Neto trimestral',counterpartyRisk:'Mitigado por CCP (LCH/CME)',market:'OTC / Mercado extrabursátil'}
  },
  {id:'CDS-COL',name:'CDS Colombia 5Y',ticker:'CDS-COL-5Y',sector:'Credit Default Swap',country:'Colombia',price:250,beta:0.65,sigma:18.4,ret:6.2,rating:'N/A',dividend:0,type:'derivado',delta:0.72,gamma:0.07,theta:-0.22,vega:0.17,impliedVol:25.4,strike:250.0,intrinsic:150.0,
   profile:'Credit Default Swap (CDS) soberano de Colombia a 5 años. El comprador paga 250 puntos base anuales y recibe protección ante un evento de crédito (impago soberano). Es el instrumento de referencia para medir el riesgo crediticio soberano de Colombia en los mercados internacionales.',
   specs:{type:'Credit Default Swap (CDS)',reference:'República de Colombia',maturity:'5 años',spread:'250 puntos base/año',notional:'$10,000,000 (estándar)',trigger:'Impago, reestructuración o moratoria soberana',settlement:'Físico o cash (subasta ISDA)',market:'OTC / ISDA estándar'}
  },
  {id:'USD-FWD',name:'Forward USD/COP',ticker:'FWDUSDCOP-3M',sector:'Forwards / Divisas',country:'Colombia',price:4050,beta:0.72,sigma:19.2,ret:6.5,rating:'N/A',dividend:0,type:'derivado',delta:0.66,gamma:0.05,theta:-0.16,vega:0.11,impliedVol:20.2,strike:4293.0,intrinsic:2430.0,
   profile:'Contrato forward de tipo de cambio USD/COP a 3 meses. Permite fijar hoy el tipo de cambio al que se comprará o venderá un monto de dólares en 3 meses. Ampliamente usado por importadores y exportadores colombianos para cobertura del riesgo cambiario sin necesidad de desembolso inicial.',
   specs:{type:'Forward cambiario (FX Forward)',currency:'USD/COP',maturity:'90 días (3 meses)',forwardRate:'4,050 COP/USD',spotRate:'3,948 COP/USD',points:'102 puntos forward',notional:'$500,000 USD (estándar mínimo)',settlement:'Entrega física o NDF (non-deliverable)'}
  },
  {id:'CLO-UST',name:'CLO Investment Grade',ticker:'CLO-IG-AAA',sector:'Estructurados / CLO',country:'EE.UU.',price:98.2,beta:0.28,sigma:9.4,ret:6.8,rating:'AAA',dividend:0,type:'derivado',delta:0.64,gamma:0.09,theta:-0.24,vega:0.29,impliedVol:18.4,strike:89.36,intrinsic:58.92,
   profile:'Collateralized Loan Obligation (CLO) de tramo senior con calificación AAA. Instrumento de crédito estructurado que empaqueta una cartera diversificada de préstamos corporativos. El tramo AAA tiene prioridad en el cobro y ofrece protección ante impagos en la cartera subyacente.',
   specs:{type:'CLO — Tramo Senior AAA',underlying:'Cartera de ~150 préstamos corporativos',tranche:'Senior (AAA)',coupon:'SOFR + 130 bps',maturity:'10 años (período reinversión: 5 años)',collateral:'Préstamos corporativos diversificados',manager:'Gestora institucional especializada',minimumInvestment:'$250,000 USD'}
  },
  {id:'FRA-EUR',name:'FRA EUR 3×6',ticker:'FRA-3X6-EUR',sector:'FRA / Tasas',country:'Eurozona',price:3.85,beta:0.08,sigma:4.2,ret:3.85,rating:'N/A',dividend:0,type:'derivado',delta:0.76,gamma:0.03,theta:-0.06,vega:0.11,impliedVol:-4.8,strike:3.62,intrinsic:2.31,
   profile:'Forward Rate Agreement (FRA) en euros a período 3×6: acuerdo sobre la tasa de interés aplicable al período que comienza en 3 meses y termina en 6 meses. El comprador se protege ante una subida de tasas EURIBOR. Instrumento fundamental en la gestión de riesgo de tasas a corto plazo.',
   specs:{type:'Forward Rate Agreement (FRA)',currency:'EUR',period:'3×6 (3 meses → 6 meses)',contractRate:'3.85% anual',reference:'EURIBOR 3 meses',notional:'€5,000,000 (estándar)',settlement:'Al inicio del período de referencia (cash)',market:'OTC / interbancario'}
  },
  {id:'MSFT-CALL',name:'Opción Call Microsoft',ticker:'MSFT-C',sector:'Opciones',country:'EE.UU.',price:12.4,sigma:38.2,ret:11.4,type:'derivado',delta:0.36,gamma:0.07,theta:-0.06,vega:0.31,impliedVol:29.2,strike:11.16,intrinsic:7.44,profile:'Opción Call Microsoft (MSFT-C). Instrumento derivado tipo opciones. Volatilidad anualizada de 38.2%, retorno esperado 11.4%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'TSLA-PUT',name:'Opción Put Tesla',ticker:'TSLA-P',sector:'Opciones',country:'EE.UU.',price:18.6,sigma:52.4,ret:9.8,type:'derivado',delta:0.75,gamma:0.06,theta:-0.05,vega:0.3,impliedVol:42.4,strike:17.67,intrinsic:11.16,profile:'Opción Put Tesla (TSLA-P). Instrumento derivado tipo opciones. Volatilidad anualizada de 52.4%, retorno esperado 9.8%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'NVDA-CALL',name:'Opción Call NVIDIA',ticker:'NVDA-C',sector:'Opciones',country:'EE.UU.',price:24.8,sigma:48.7,ret:13.2,type:'derivado',delta:0.43,gamma:0.02,theta:-0.13,vega:0.38,impliedVol:46.7,strike:22.57,intrinsic:14.88,profile:'Opción Call NVIDIA (NVDA-C). Instrumento derivado tipo opciones. Volatilidad anualizada de 48.7%, retorno esperado 13.2%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'SPX-PUT',name:'Opción Put S&P 500',ticker:'SPX-P',sector:'Opciones',country:'EE.UU.',price:42.5,sigma:28.4,ret:7.4,type:'derivado',delta:0.73,gamma:0.04,theta:-0.23,vega:0.28,impliedVol:36.4,strike:42.08,intrinsic:25.5,profile:'Opción Put S&P 500 (SPX-P). Instrumento derivado tipo opciones. Volatilidad anualizada de 28.4%, retorno esperado 7.4%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'IRS-EUR',name:'Swap Tasa Interés EUR',ticker:'IRS-EUR',sector:'Swaps',country:'Eurozona',price:100.2,sigma:8.4,ret:4.2,type:'derivado',delta:0.5,gamma:0.03,theta:-0.1,vega:0.15,impliedVol:3.4,strike:110.22,intrinsic:60.12,profile:'Swap Tasa Interés EUR (IRS-EUR). Instrumento derivado tipo swaps. Volatilidad anualizada de 8.4%, retorno esperado 4.2%.',specs:{type:'Swaps',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'IRS-GBP',name:'Swap Tasa Interés GBP',ticker:'IRS-GBP',sector:'Swaps',country:'Reino Unido',price:99.8,sigma:9.1,ret:4.4,type:'derivado',delta:0.49,gamma:0.04,theta:-0.19,vega:0.24,impliedVol:13.1,strike:106.79,intrinsic:59.88,profile:'Swap Tasa Interés GBP (IRS-GBP). Instrumento derivado tipo swaps. Volatilidad anualizada de 9.1%, retorno esperado 4.4%.',specs:{type:'Swaps',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CDS-ARG',name:'CDS Argentina',ticker:'CDS-ARG',sector:'Crédito',country:'Argentina',price:62.4,sigma:42.8,ret:8.6,type:'derivado',delta:0.37,gamma:0.02,theta:-0.17,vega:0.12,impliedVol:44.8,strike:61.15,intrinsic:37.44,profile:'CDS Argentina (CDS-ARG). Instrumento derivado tipo crédito. Volatilidad anualizada de 42.8%, retorno esperado 8.6%.',specs:{type:'Crédito',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CDS-BRA',name:'CDS Brasil',ticker:'CDS-BRA',sector:'Crédito',country:'Brasil',price:84.2,sigma:28.4,ret:6.8,type:'derivado',delta:0.44,gamma:0.07,theta:-0.14,vega:0.29,impliedVol:27.4,strike:76.62,intrinsic:50.52,profile:'CDS Brasil (CDS-BRA). Instrumento derivado tipo crédito. Volatilidad anualizada de 28.4%, retorno esperado 6.8%.',specs:{type:'Crédito',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CDS-TUR',name:'CDS Turquía',ticker:'CDS-TUR',sector:'Crédito',country:'Turquía',price:58.7,sigma:46.2,ret:9.1,type:'derivado',delta:0.37,gamma:0.06,theta:-0.17,vega:0.32,impliedVol:48.2,strike:56.94,intrinsic:35.22,profile:'CDS Turquía (CDS-TUR). Instrumento derivado tipo crédito. Volatilidad anualizada de 46.2%, retorno esperado 9.1%.',specs:{type:'Crédito',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'FWD-EUR',name:'Forward EUR/USD',ticker:'FWD-EUR',sector:'Forwards',country:'Eurozona',price:1.082,sigma:9.2,ret:2.4,type:'derivado',delta:0.69,gamma:0.02,theta:-0.09,vega:0.24,impliedVol:3.2,strike:1.06,intrinsic:0.65,profile:'Forward EUR/USD (FWD-EUR). Instrumento derivado tipo forwards. Volatilidad anualizada de 9.2%, retorno esperado 2.4%.',specs:{type:'Forwards',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'FWD-JPY',name:'Forward USD/JPY',ticker:'FWD-JPY',sector:'Forwards',country:'Japón',price:151.4,sigma:10.4,ret:2.6,type:'derivado',delta:0.37,gamma:0.08,theta:-0.07,vega:0.12,impliedVol:2.4,strike:148.37,intrinsic:90.84,profile:'Forward USD/JPY (FWD-JPY). Instrumento derivado tipo forwards. Volatilidad anualizada de 10.4%, retorno esperado 2.6%.',specs:{type:'Forwards',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'FRA-USD',name:'FRA Dólar 3x6',ticker:'FRA-USD',sector:'Forwards',country:'EE.UU.',price:98.4,sigma:6.8,ret:3.4,type:'derivado',delta:0.5,gamma:0.07,theta:-0.1,vega:0.35,impliedVol:1.8,strike:89.54,intrinsic:59.04,profile:'FRA Dólar 3x6 (FRA-USD). Instrumento derivado tipo forwards. Volatilidad anualizada de 6.8%, retorno esperado 3.4%.',specs:{type:'Forwards',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CLO-EUR',name:'CLO Europeo AAA',ticker:'CLO-EUR',sector:'Estructurados',country:'Eurozona',price:99.1,sigma:12.4,ret:5.2,type:'derivado',delta:0.64,gamma:0.05,theta:-0.24,vega:0.39,impliedVol:21.4,strike:94.14,intrinsic:59.46,profile:'CLO Europeo AAA (CLO-EUR). Instrumento derivado tipo estructurados. Volatilidad anualizada de 12.4%, retorno esperado 5.2%.',specs:{type:'Estructurados',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'MBS-US',name:'MBS Estadounidense',ticker:'MBS-US',sector:'Estructurados',country:'EE.UU.',price:97.8,sigma:11.2,ret:4.8,type:'derivado',delta:0.59,gamma:0.06,theta:-0.09,vega:0.24,impliedVol:5.2,strike:92.91,intrinsic:58.68,profile:'MBS Estadounidense (MBS-US). Instrumento derivado tipo estructurados. Volatilidad anualizada de 11.2%, retorno esperado 4.8%.',specs:{type:'Estructurados',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'ABS-AUTO',name:'ABS Préstamos Auto',ticker:'ABS-AUT',sector:'Estructurados',country:'EE.UU.',price:98.6,sigma:9.8,ret:4.4,type:'derivado',delta:0.56,gamma:0.03,theta:-0.06,vega:0.11,impliedVol:0.8,strike:92.68,intrinsic:59.16,profile:'ABS Préstamos Auto (ABS-AUT). Instrumento derivado tipo estructurados. Volatilidad anualizada de 9.8%, retorno esperado 4.4%.',specs:{type:'Estructurados',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'VIX-CALL',name:'Opción Call VIX',ticker:'VIX-C',sector:'Opciones',country:'EE.UU.',price:8.4,sigma:68.4,ret:6.2,type:'derivado',delta:0.82,gamma:0.03,theta:-0.22,vega:0.37,impliedVol:75.4,strike:8.57,intrinsic:5.04,profile:'Opción Call VIX (VIX-C). Instrumento derivado tipo opciones. Volatilidad anualizada de 68.4%, retorno esperado 6.2%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'GOLD-CALL',name:'Opción Call Oro',ticker:'GOLD-C',sector:'Opciones',country:'Global',price:32.6,sigma:24.8,ret:8.4,type:'derivado',delta:0.8,gamma:0.05,theta:-0.2,vega:0.35,impliedVol:29.8,strike:33.58,intrinsic:19.56,profile:'Opción Call Oro (GOLD-C). Instrumento derivado tipo opciones. Volatilidad anualizada de 24.8%, retorno esperado 8.4%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'OIL-PUT',name:'Opción Put Petróleo',ticker:'OIL-P',sector:'Opciones',country:'Global',price:4.82,sigma:38.4,ret:5.8,type:'derivado',delta:0.4,gamma:0.05,theta:-0.2,vega:0.35,impliedVol:43.4,strike:4.96,intrinsic:2.89,profile:'Opción Put Petróleo (OIL-P). Instrumento derivado tipo opciones. Volatilidad anualizada de 38.4%, retorno esperado 5.8%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'TRS-EQ',name:'Swap de Retorno Total (Acciones)',ticker:'TRS-EQ',sector:'Swaps',country:'Global',price:101.4,sigma:22.4,ret:9.2,type:'derivado',delta:0.73,gamma:0.06,theta:-0.13,vega:0.28,impliedVol:20.4,strike:100.39,intrinsic:60.84,profile:'Swap de Retorno Total sobre una canasta de acciones (TRS-EQ). Una parte recibe el rendimiento total (precio + dividendos) del activo subyacente a cambio de pagar una tasa de financiamiento — permite exposición sin poseer las acciones directamente. Volatilidad anualizada de 22.4%, retorno esperado 9.2%.',specs:{type:'Swap de Retorno Total',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'VARSWAP',name:'Swap de Varianza',ticker:'VAR-SW',sector:'Swaps',country:'Global',price:98.2,sigma:32.8,ret:7.4,type:'derivado',delta:0.61,gamma:0.06,theta:-0.21,vega:0.16,impliedVol:38.8,strike:91.33,intrinsic:58.92,profile:'Swap de Varianza (VAR-SW). Instrumento derivado tipo swaps. Volatilidad anualizada de 32.8%, retorno esperado 7.4%.',specs:{type:'Swaps',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CAP-USD',name:'Cap Tasa USD',ticker:'CAP-USD',sector:'Opciones',country:'EE.UU.',price:2.84,sigma:18.4,ret:4.2,type:'derivado',delta:0.67,gamma:0.08,theta:-0.07,vega:0.32,impliedVol:10.4,strike:2.58,intrinsic:1.7,profile:'Cap Tasa USD (CAP-USD). Instrumento derivado tipo opciones. Volatilidad anualizada de 18.4%, retorno esperado 4.2%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'FLOOR-EUR',name:'Floor Tasa EUR',ticker:'FLR-EUR',sector:'Opciones',country:'Eurozona',price:2.42,sigma:16.8,ret:3.8,type:'derivado',delta:0.69,gamma:0.06,theta:-0.09,vega:0.24,impliedVol:10.8,strike:2.23,intrinsic:1.45,profile:'Floor Tasa EUR (FLR-EUR). Instrumento derivado tipo opciones. Volatilidad anualizada de 16.8%, retorno esperado 3.8%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'BARRIER-SPX',name:'Opción Barrera S&P',ticker:'BAR-SPX',sector:'Opciones',country:'EE.UU.',price:18.4,sigma:34.2,ret:8.8,type:'derivado',delta:0.61,gamma:0.02,theta:-0.21,vega:0.36,impliedVol:40.2,strike:19.69,intrinsic:11.04,profile:'Opción Barrera S&P (BAR-SPX). Instrumento derivado tipo opciones. Volatilidad anualizada de 34.2%, retorno esperado 8.8%.',specs:{type:'Opciones',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}},
  {id:'CONVERT-AAPL',name:'Bono Convertible Apple',ticker:'CONV-AAPL',sector:'Estructurados',country:'EE.UU.',price:104.2,sigma:18.6,ret:7.2,type:'derivado',delta:0.83,gamma:0.08,theta:-0.23,vega:0.18,impliedVol:26.6,strike:108.37,intrinsic:62.52,profile:'Bono Convertible Apple (CONV-AAPL). Instrumento derivado tipo estructurados. Volatilidad anualizada de 18.6%, retorno esperado 7.2%.',specs:{type:'Estructurados',underlying:'Diversos',notional:'$100,000',maturity:'3-12 meses',market:'OTC'}}
];

// ═══════════════════ STATE ═══════════════════
const INITIAL_CAPITAL = 50000;                 // capital inicial de mercado (referencia)
const MARGIN_RATIO    = 0.5;                    // apalancamiento máximo: 50% del capital inicial
const MARGIN_LIMIT    = -MARGIN_RATIO * INITIAL_CAPITAL; // límite de balance negativo (-$25,000)
// ── LLAMADA DE MARGEN (margin call) ──
// Margen de mantenimiento: patrimonio mínimo que debe conservar el inversor apalancado
// respecto al valor de sus posiciones. Si el equity cae por debajo, el bróker liquida
// posiciones automáticamente (las de mayor pérdida primero) hasta restaurar el margen.
const MAINTENANCE_MARGIN = 0.25;   // 25% del valor de las posiciones
let marginCallCount = 0;           // contador de llamadas de margen de la sesión

// ── COSTOS DE TRANSACCIÓN (microestructura de mercado) ──
// Modelo: comisión porcentual sobre el valor operado (con mínimo en USD) + cruce del
// spread bid-ask (se compra al ask = precio + ½ spread; se vende al bid = precio − ½ spread).
// Los spreads reflejan la liquidez relativa de cada clase de activo.
const COMMISSION_RATE = 0.0015;   // 0.15% del valor operado (comisión de corretaje)
const COMMISSION_MIN  = 1.00;     // comisión mínima en USD por operación
// Spread bid-ask total por clase de activo (fracción del precio medio):
const SPREAD_BY_TYPE = {
  accion:   0.0010,   // 0.10% — acciones líquidas
  bono:     0.0020,   // 0.20% — renta fija, menor liquidez intradía
  divisa:   0.0006,   // 0.06% — FX mayor, spreads muy estrechos
  futuro:   0.0008,   // 0.08% — futuros estandarizados, alta liquidez
  derivado: 0.0035,   // 0.35% — OTC/derivados, spreads amplios
};
function spreadFor(type){ return SPREAD_BY_TYPE[type] != null ? SPREAD_BY_TYPE[type] : 0.0015; }
// Precio efectivo de ejecución: compra al ask (+½ spread), venta al bid (−½ spread).
function execPrice(midPrice, type, op){
  const half = spreadFor(type) / 2;
  return op === 'buy' ? midPrice * (1 + half) : midPrice * (1 - half);
}
// Comisión sobre el valor operado, con mínimo.
function commissionFor(value){ return Math.max(COMMISSION_MIN, Math.abs(value) * COMMISSION_RATE); }

let capital=INITIAL_CAPITAL;          // market cash (never affected by price moves)
let labCapital=50000;       // lab cash — completely independent from market capital
let portfolio=[];
let txHistory=[];
let labHistory=[];
let navHistory=[];          // evolución REAL del patrimonio (NAV) por tick: [{t, value, invested}]
let marketSessionLog=[];    // records of each open/close session
// ── Multiple portfolios (max 3 saved strategies) ──
let savedPortfolios=[];     // [{name, capital, portfolio, txHistory, savedAt, color}]
let activePortfolioIdx=-1;  // -1 = current (unsaved) session
// ── MODO PROFESOR (estado aislado: no toca portfolio/capital del estudiante) ──
let teacherRoster=[];       // [{student, retPct, sharpe, pnl, sigma, var95, txCount, posCount, portVal, capital, importedAt}]
let teacherSortKey='retPct'; // criterio de clasificación: retPct | sharpe | pnl
let teacherSectionFilter='all'; // filtro por sección/materia
let teacherGroupView=false;     // agrupar la tabla por grupo
const TEACHER_KEY='capitallab_teacher_v1'; // persistencia separada del progreso del estudiante
// ── News feed ──
let newsFeed=[];            // [{time, headline, body, type:'bull'|'bear'|'neutral', ticker, unread}]
let newsImpacts={};         // {assetId: {remaining: shockPorTickRestante, ticks: nTicks}} — efecto causal de noticias
let pendingOrders=[];       // órdenes pendientes: [{id, assetId, type, side, kind, qty, trigger, created}]
let newsUnreadCount=0;
let labConfig={capital:50000,horizon:6,target:8,started:false,startCapital:0};
let labPickedIds=[];

// ── Market session state (NYSE-style, 4-hour window) ──
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const TICK_MS             = 5000;                // price update every 5 seconds (more constant)
let marketSession = {
  open:       false,
  openTime:   null,
  closeTime:  null,
  tickTimer:  null,
  clockTimer: null,
  newsTimer:  null,   // periodic news every 60 s
  incomeTimer:null,   // dividends/coupons every 90 s (SERIE 2)
};
let selectedAsset = null;
let mktTypeFilter = 'all';
let currentHorizonMonths = 12;

// live prices (updated per horizon)
let STOCKS,BONDS,FOREX,FUTURES,DERIVATIVES;
function allAssets(){return[...STOCKS,...BONDS,...FOREX,...FUTURES,...DERIVATIVES];}
function allBase(){return[...ALL_STOCKS,...ALL_BONDS,...ALL_FOREX,...ALL_FUTURES,...ALL_DERIVATIVES];}

// chart instances
let mktChartInst,anPriceChart,anRvChart,cProjChartInst,portDonutInst,portEvolInst,portPnlBarInst,portRetBarInst,portScatterInst,labChartInst,resBarInst,resScatterInst;
function dc(c){if(c)c.destroy();return null;}

// Devuelve la densidad de píxeles real del dispositivo (window.devicePixelRatio).
// Antes también multiplicaba por el zoom de CSS del body (para compensar el
// desenfoque que causaba en los gráficos de Cartera), pero ese zoom se
// eliminó por completo de simulador-estilos.css — ver la nota ahí. Esta
// función se mantiene como punto único de referencia de densidad de
// píxeles para Chart.js, con la lógica de zoom ya simplificada.
function dprEfectivo(){
  return window.devicePixelRatio||1;
}

// ═══════════════════ UTILS ═══════════════════
function fmt(n){n=Math.abs(n);return n>=1000?n.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}):n.toFixed(2);}
function fmtS(n){return(n<0?'-$':'$')+fmt(n);}
function notify(msg,type='success'){const el=document.getElementById('notif');el.textContent=msg;el.className='notif '+type+' show';setTimeout(()=>el.classList.remove('show'),3000);}
function riskBadge(s){return s<10?'<span class="badge badge-green">Bajo</span>':s<20?'<span class="badge badge-amber">Moderado</span>':'<span class="badge badge-red">Alto</span>';}
function ratingBadge(r){const g=['AAA','AA+','AA','AA-','A+','A','A-'];const a=['BBB+','BBB','BBB-'];return g.includes(r)?'<span class="badge badge-green">'+r+'</span>':a.includes(r)?'<span class="badge badge-amber">'+r+'</span>':'<span class="badge badge-red">'+r+'</span>';}

// ═══════════════════ MÉTRICAS FINANCIERAS CENTRALIZADAS ═══════════════════
// Una sola fuente de verdad para Sharpe, beta y VaR, defendible ante revisión experta.

// Beta de mercado por activo (sensibilidad sistemática). Acciones traen beta explícita;
// el resto recibe una beta representativa por clase de activo. Idéntico al motor de ticks.
function betaForAsset(a){
  if(a && typeof a.beta === 'number') return a.beta;
  switch(a ? a.type : null){
    case 'bono':     return 0.25;
    case 'divisa':   return 0.45;
    case 'futuro':   return 1.15;
    case 'derivado': return 1.30;
    default:         return 1.0;
  }
}

// Ratio de Sharpe correcto por tipo de activo.
// El numerador debe ser el RETORNO EN EXCESO sobre la tasa libre de riesgo (RF),
// pero "exceso sobre RF" solo es económicamente válido cuando 'ret' es un retorno
// total comparable (acciones, bonos vía YTM). En divisas, 'ret' es el diferencial
// cambiario esperado: ese diferencial YA es un exceso relativo, por lo que NO se le
// resta RF de nuevo. En derivados/futuros se mantiene el exceso sobre RF por convención.
function computeSharpe(asset){
  if(!asset || !asset.sigma) return 0;
  let excess;
  switch(asset.type){
    case 'divisa':
      // El carry/diferencial cambiario ya representa un retorno en exceso.
      excess = asset.ret;
      break;
    case 'accion':
    case 'bono':
    case 'futuro':
    case 'derivado':
    default:
      excess = asset.ret - RF;
  }
  return excess / asset.sigma;
}

// ═══════════════════════════════════════════════════════════════════════
// CALIFICACIÓN CAPITALLAB — distinta de la calificación crediticia
// (AAA, BBB, etc., que mide riesgo de impago de deuda). Esta mide qué
// tan bueno es el activo como inversión, combinando retorno y riesgo
// en una sola letra (nunca solo el retorno aislado, que premiaría a
// un activo de alto riesgo solo por ser rentable). Se basa en el
// Ratio Sharpe real del activo (ya calculado en computeSharpe, el
// mismo número que se muestra en el panel de Análisis), así que un
// activo con alto retorno pero riesgo desproporcionado nunca sale
// "Excelente" solo por su rentabilidad.
// ═══════════════════════════════════════════════════════════════════
const NIVELES_CALIFICACION_CAPITALLAB = {
  'A+': { titulo:'Excelente', color:'#1e8e5a', descripcion:'Retorno alto con riesgo bien compensado. El Ratio Sharpe indica que cada unidad de riesgo asumida se traduce en un retorno claramente favorable.' },
  'A':  { titulo:'Muy sólido', color:'#3aa66b', descripcion:'Buen balance entre retorno y riesgo. El activo compensa razonablemente bien el riesgo que representa.' },
  'B':  { titulo:'Sólido', color:'#4a9eff', descripcion:'Balance aceptable. El retorno compensa el riesgo, aunque sin un margen amplio.' },
  'C':  { titulo:'Neutral / Mixto', color:'#ffb400', descripcion:'El retorno apenas compensa el riesgo asumido, o hay señales mixtas que no permiten una lectura clara en una sola dirección.' },
  'D':  { titulo:'Débil', color:'#ff8c42', descripcion:'El riesgo asumido no se ve suficientemente compensado por el retorno esperado.' },
  'E':  { titulo:'Alto riesgo / Débil', color:'#ff4757', descripcion:'El retorno esperado no compensa el riesgo, o el activo muestra un retorno negativo con volatilidad relevante.' },
};

function calificarActivoCapitalLab(asset){
  if(!asset) return null;
  const sharpe = computeSharpe(asset);
  let letra;
  if(sharpe >= 1.2) letra = 'A+';
  else if(sharpe >= 0.8) letra = 'A';
  else if(sharpe >= 0.4) letra = 'B';
  else if(sharpe >= 0) letra = 'C';
  else if(sharpe >= -0.5) letra = 'D';
  else letra = 'E';

  // Un activo con calificación crediticia débil (deuda de alto
  // riesgo de impago) no puede salir en el nivel más alto, aunque su
  // Sharpe sea bueno — el riesgo de impago es un riesgo real que el
  // Sharpe, calculado sobre volatilidad de precio, no captura.
  const ratingCrediticio = (asset.rating||'').toUpperCase();
  const creditoDebil = ratingCrediticio && !ratingCrediticio.startsWith('A') && ratingCrediticio!=='N/A' && ratingCrediticio!=='';
  if(creditoDebil && (letra==='A+'||letra==='A')) letra = 'B';

  const fortalezas = [];
  const riesgos = [];
  if(asset.ret > 8) fortalezas.push(`Retorno esperado de ${asset.ret.toFixed(1)}%, por encima del promedio de mercado.`);
  if(sharpe > 0.8) fortalezas.push(`Ratio Sharpe de ${sharpe.toFixed(2)}, señal de que el riesgo asumido se compensa bien.`);
  if(asset.sigma < 15) fortalezas.push(`Volatilidad anual de solo ${asset.sigma.toFixed(1)}%, relativamente estable.`);
  if(ratingCrediticio.startsWith('A')) fortalezas.push(`Calificación crediticia sólida (${asset.rating}).`);
  if(asset.sigma > 30) riesgos.push(`Volatilidad anual elevada, de ${asset.sigma.toFixed(1)}%.`);
  if(sharpe < 0.3) riesgos.push(`Ratio Sharpe de ${sharpe.toFixed(2)}, el retorno apenas compensa (o no compensa) el riesgo asumido.`);
  if(creditoDebil) riesgos.push(`Calificación crediticia ${asset.rating}, por debajo del grado más sólido.`);
  if(asset.ret < 0) riesgos.push(`Retorno esperado negativo (${asset.ret.toFixed(1)}%).`);
  if(!fortalezas.length) fortalezas.push('Sin fortalezas destacadas frente al resto del mercado con los datos disponibles.');
  if(!riesgos.length) riesgos.push('Sin riesgos destacados frente al resto del mercado con los datos disponibles.');

  return { letra, sharpe, ...NIVELES_CALIFICACION_CAPITALLAB[letra], fortalezas, riesgos };
}

// Métricas de cartera PONDERADAS por valor de mercado y con correlación de un factor.
// Devuelve: valor, retorno y sigma ponderados, Sharpe y VaR-95 diversificado.
// El VaR usa el modelo de un factor (mismo que el motor): la varianza de la cartera
// se descompone en componente sistemática (vía beta ponderada) + idiosincrásica residual,
// en lugar de asumir correlación perfecta (ρ=1) entre todas las posiciones.
function computePortfolioMetrics(positions){
  const out = { value:0, wRet:0, wSigma:0, sharpe:0, var95:0, beta:0 };
  if(!positions || positions.length === 0) return out;
  let totVal = 0;
  positions.forEach(p=>{ totVal += (p.currentPrice||p.buyPrice)*p.qty; });
  if(totVal <= 0) return out;

  let wRet=0, wBeta=0, sysSigmaW=0, idioVar=0;
  // Sigma del factor de mercado, consistente con MARKET_VOL del motor de ticks,
  // re-anualizada para comparabilidad (factor común a todas las posiciones).
  const MARKET_SIGMA_ANNUAL = 12; // % — desviación anual del factor de mercado (referencia)
  positions.forEach(p=>{
    const v = (p.currentPrice||p.buyPrice)*p.qty;
    const w = v/totVal;
    const beta = betaForAsset(p);
    const sig = p.sigma||0;
    wRet  += w * (p.ret||0);
    wBeta += w * beta;
    // Componente sistemática: se SUMA linealmente (correlacionada vía el factor común).
    sysSigmaW += w * beta * MARKET_SIGMA_ANNUAL;
    // Componente idiosincrásica: parte de sigma no explicada por el mercado; se agrega
    // en cuadratura (independiente entre activos → diversificable).
    const sysPart = beta * MARKET_SIGMA_ANNUAL;
    const idioPart = Math.max(0, (sig*sig) - (sysPart*sysPart));
    idioVar += (w*w) * idioPart;
  });
  // Sigma total de cartera = √(sistemática² + idiosincrásica diversificada)
  const portSigma = Math.sqrt(sysSigmaW*sysSigmaW + idioVar);
  out.value  = totVal;
  out.wRet   = wRet;
  out.wSigma = portSigma;
  out.beta   = wBeta;
  out.sharpe = portSigma>0 ? (wRet - RF)/portSigma : 0;
  out.var95  = totVal * (portSigma/100) * 1.645;
  return out;
}

// ═══════════════════ PRICES ═══════════════════
