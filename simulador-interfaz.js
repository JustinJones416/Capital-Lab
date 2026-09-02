/* Proyecto CapitalLab — desarrollo original: Justin Jones, Universidad de Panamá, Facultad de Economía. Registro interno de autoría, no eliminar. */
function renderLabHistory(){
  const panel = document.getElementById('lab-history-panel');
  const clearBtn = document.getElementById('lab-history-clear-btn');
  if(!panel) return;

  if(labHistory.length === 0){
    panel.innerHTML='<div style="text-align:center;padding:2rem;color:var(--t3);font-size:13px;"><i class="ti ti-flask" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3;"></i>Aún no hay sesiones registradas. Configura el laboratorio y haz clic en "Simular resultado del horizonte".</div>';
    if(clearBtn) clearBtn.style.display='none';
    return;
  }
  if(clearBtn) clearBtn.style.display='flex';

  // Summary KPIs across all sessions
  const totalSessions = labHistory.length;
  const passed = labHistory.filter(s=>s.passed).length;
  const avgRet = labHistory.reduce((s,h)=>s+h.achieved,0)/totalSessions;
  const bestRet = Math.max(...labHistory.map(h=>h.achieved));
  const worstRet = Math.min(...labHistory.map(h=>h.achieved));

  panel.innerHTML=`
    <!-- Summary row -->
    <div class="grid-4-resp" style="gap:10px;margin-bottom:16px;">
      ${[
        ['Sesiones totales', totalSessions, 'var(--accent2)'],
        ['Metas alcanzadas', passed+' / '+totalSessions, passed===totalSessions?'var(--green)':'var(--amber)'],
        ['Mejor rentabilidad', (bestRet>=0?'+':'')+bestRet.toFixed(2)+'%', bestRet>=0?'var(--green)':'var(--red)'],
        ['Rentabilidad prom.', (avgRet>=0?'+':'')+avgRet.toFixed(2)+'%', avgRet>=0?'var(--green)':'var(--red)'],
      ].map(([l,v,c])=>`
        <div class="metric" style="border-color:rgba(0,196,255,.12);">
          <div class="metric-label">${conAyuda(l)}</div>
          <div class="metric-val mono" style="color:${c};">${v}</div>
        </div>`).join('')}
    </div>

    <!-- Sessions table -->
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Estrategia</th>
          <th>Perfil</th>
          <th>Horizonte</th>
          <th>Capital inicial</th>
          <th>Capital final</th>
          <th>${conAyuda('Rentabilidad')}</th>
          <th>Meta</th>
          <th>${conAyuda('Sharpe')}</th>
          <th>Calificación</th>
          <th>Activos</th>
        </tr>
      </thead>
      <tbody>
        ${labHistory.map((h,i)=>{
          const calColor = h.calific==='Excelente'?'badge-green':h.calific==='Aprobado'?'badge-green':h.calific==='Regular'?'badge-amber':'badge-red';
          return`<tr>
            <td class="mono" style="color:var(--t3);">${totalSessions-i}</td>
            <td style="font-size:10px;color:var(--t3);white-space:nowrap;">${h.date}</td>
            <td style="font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${h.strat}">${h.strat}</td>
            <td><span class="badge ${h.perfil==='conservador'?'badge-green':h.perfil==='moderado'?'badge-amber':'badge-red'}">${h.perfil.charAt(0).toUpperCase()+h.perfil.slice(1)}</span></td>
            <td class="mono">${h.months} m.</td>
            <td class="mono">$${fmt(h.init)}</td>
            <td class="mono ${h.achieved>=0?'g':'r'}" style="font-weight:600;">$${fmt(h.finalVal)}</td>
            <td class="mono ${h.achieved>=0?'g':'r'}" style="font-weight:600;">${h.achieved>=0?'+':''}${h.achieved.toFixed(2)}%</td>
            <td class="mono" style="color:var(--amber);">${h.target}%</td>
            <td class="mono ${h.sharpe>0.5?'g':h.sharpe>0?'a':'r'}">${h.sharpe}</td>
            <td><span class="badge ${calColor}">${h.calific}</span></td>
            <td style="font-size:10px;color:var(--t3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${h.picked}">${h.picked}</td>
          </tr>
          <!-- Detail row: allocation breakdown -->
          <tr style="background:rgba(0,0,0,.2);">
            <td colspan="12" style="padding:6px 10px;">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:10px;color:var(--t3);">Distribución:</span>
                ${h.alloc.b>0?`<span style="font-size:10px;color:var(--green);">Bonos ${h.alloc.b}%</span>`:''}
                ${h.alloc.a>0?`<span style="font-size:10px;color:var(--accent2);">Acciones ${h.alloc.a}%</span>`:''}
                ${h.alloc.d>0?`<span style="font-size:10px;color:var(--amber);">Divisas ${h.alloc.d}%</span>`:''}
                ${h.alloc.f>0?`<span style="font-size:10px;color:var(--red);">Futuros ${h.alloc.f}%</span>`:''}
                ${h.alloc.dv>0?`<span style="font-size:10px;color:var(--accent2);">Derivados ${h.alloc.dv}%</span>`:''}
                <span style="font-size:10px;color:var(--t3);margin-left:auto;">σ ${h.sigma}% · VaR $${fmt(h.var95)} · Ef.riesgo ${h.riskEff}% · Ef.capital ${h.capEff}% · Ops. en mercado: ${h.txCount}</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function clearLabHistory(){
  if(labHistory.length===0) return;
  labHistory=[];
  autosave();
  renderLabHistory();
  notify('Historial del laboratorio limpiado');
}

// ═══════════════════ RESULTADOS LAB (página completa) ═══════════════════
function renderResultsLab(){
  const el=document.getElementById('rlab-content');
  if(!el)return;

  if(labHistory.length===0){
    el.innerHTML=`
      <div style="text-align:center;padding:4rem 2rem;color:var(--t3);">
        <i class="ti ti-flask" style="font-size:48px;display:block;margin-bottom:12px;opacity:.2;"></i>
        <div style="font-size:15px;margin-bottom:8px;">No hay sesiones de laboratorio registradas aún</div>
        <div style="font-size:12px;">Ve al Laboratorio, configura el capital y el horizonte, y ejecuta una simulación.</div>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="goPage('laboratorio')"><i class="ti ti-flask"></i> Ir al Laboratorio</button>
      </div>`;
    return;
  }

  // ── Global summary ──
  const total     = labHistory.length;
  const passed    = labHistory.filter(h=>h.passed).length;
  const avgRet    = labHistory.reduce((s,h)=>s+h.achieved,0)/total;
  const avgSharpe = labHistory.reduce((s,h)=>s+h.sharpe,0)/total;
  const bestH     = labHistory.reduce((b,h)=>h.achieved>b.achieved?h:b);
  const passRate  = (passed/total*100).toFixed(0);

  let html=`
    <!-- ── KPI banner ── -->
    <div class="metric-grid" style="margin-bottom:18px;">
      <div class="metric"><div class="metric-label">Sesiones totales</div><div class="metric-val mono" style="color:var(--accent2);">${total}</div></div>
      <div class="metric"><div class="metric-label">Metas alcanzadas</div><div class="metric-val mono" style="color:${passed===total?'var(--green)':'var(--amber)'};">${passed} / ${total} (${passRate}%)</div></div>
      <div class="metric"><div class="metric-label">Rentabilidad promedio</div><div class="metric-val mono ${avgRet>=0?'g':'r'}">${avgRet>=0?'+':''}${avgRet.toFixed(2)}%</div></div>
      <div class="metric"><div class="metric-label">Sharpe promedio</div><div class="metric-val mono ${avgSharpe>0.5?'g':avgSharpe>0?'a':'r'}">${avgSharpe.toFixed(2)}</div></div>
    </div>

    <!-- ── Best session highlight ── -->
    <div class="info-box ${bestH.passed?'success':'warn'}" style="margin-bottom:18px;padding:14px 16px;">
      <div style="font-size:12px;color:var(--t3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;">Mejor sesión registrada</div>
      <b style="font-size:14px;color:var(--t1);">${bestH.strat}</b>
      <span style="font-size:12px;color:var(--t2);margin-left:10px;">${bestH.date}</span>
      <span class="badge badge-green" style="margin-left:8px;">${bestH.achieved>=0?'+':''}${bestH.achieved.toFixed(2)}%</span>
      <span class="badge ${bestH.calific==='Excelente'||bestH.calific==='Aprobado'?'badge-green':bestH.calific==='Regular'?'badge-amber':'badge-red'}" style="margin-left:6px;">${bestH.calific}</span>
      <div style="font-size:11px;color:var(--t3);margin-top:6px;">Activos: <b style="color:var(--t1);">${bestH.picked}</b></div>
    </div>

    <!-- ── Session cards ── -->
    ${labHistory.map((h,i)=>{
      const n=total-i;
      const pColor=h.passed?'var(--green)':'var(--red)';
      const calBadge=h.calific==='Excelente'?'badge-green':h.calific==='Aprobado'?'badge-green':h.calific==='Regular'?'badge-amber':'badge-red';

      // Build picked assets list with full badges — use stored pickedIds if available
      const ids_to_show = h.pickedIds && h.pickedIds.length>0 ? h.pickedIds : [];
      const pickedList = ids_to_show.length>0
        ? ids_to_show.map(id=>{
            const a=allAssets().find(x=>x.id===id);
            if(!a)return`<span class="picked-chip" style="font-size:10px;">${id}</span>`;
            const icon=a.type==='accion'?'📈':a.type==='bono'?'🏦':a.type==='divisa'?'💱':a.type==='futuro'?'📊':'🔷';
            const badgeCls=a.type==='accion'?'badge-blue':a.type==='bono'?'badge-green':a.type==='divisa'?'badge-amber':a.type==='futuro'?'badge-red':'badge-cyan';
            return`<span class="picked-chip" style="font-size:10px;">${icon} ${a.name.substring(0,22)} <span class="badge ${badgeCls}" style="font-size:8px;padding:1px 5px;">${a.ticker}</span></span>`;
          }).join('')
        : h.picked && h.picked!=='Todos los activos disponibles'
          ? h.picked.split(', ').filter(Boolean).map(t=>`<span class="picked-chip" style="font-size:10px;">${t}</span>`).join('')
          : '';

      // Allocation bars
      const allocBar=(pct,color,label)=>pct>0?`
        <div style="margin-bottom:5px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;color:var(--t2);">
            <span>${label}</span><span style="color:${color};font-weight:600;">${pct}%</span>
          </div>
          <div style="height:5px;border-radius:3px;background:var(--c4);">
            <div style="width:${pct}%;height:5px;border-radius:3px;background:${color};"></div>
          </div>
        </div>`:''

      return`
      <div class="card" style="margin-bottom:14px;border-color:${h.passed?'rgba(0,208,132,.2)':'rgba(255,71,87,.15)'};">
        <!-- Session header -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${h.passed?'rgba(0,208,132,.15)':'rgba(255,71,87,.12)'};border:1.5px solid ${pColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:var(--font-mono);color:${pColor};flex-shrink:0;">${n}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-head);font-size:15px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.strat}</div>
            <div style="font-size:11px;color:var(--t3);">${h.date} · ${h.months} meses · ${h.perfil.charAt(0).toUpperCase()+h.perfil.slice(1)}</div>
          </div>
          <span class="badge ${calBadge}" style="font-size:11px;padding:4px 12px;">${h.calific}</span>
          <span style="font-size:22px;font-family:var(--font-mono);font-weight:700;color:${pColor};">${h.achieved>=0?'+':''}${h.achieved.toFixed(2)}%</span>
        </div>

        <div class="grid2" style="gap:14px;">
          <!-- Left: metrics -->
          <div>
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Métricas de la simulación</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
              ${[
                ['Capital inicial','$'+fmt(h.init),''],
                ['Capital final','$'+fmt(h.finalVal),h.achieved>=0?'g':'r'],
                ['Meta del profesor',h.target+'%','a'],
                ['Resultado',h.passed?'✓ Alcanzada':'✗ No alcanzada',h.passed?'g':'r'],
                ['Ratio Sharpe',h.sharpe,h.sharpe>0.5?'g':h.sharpe>0?'a':'r'],
                ['Riesgo σ',h.sigma+'%','a'],
                ['VaR 95%','$'+fmt(h.var95),'r'],
                ['Efic. de riesgo',h.riskEff+'%',h.riskEff>60?'g':h.riskEff>40?'a':'r'],
                ['Efic. de capital',h.capEff+'%',h.capEff>100?'g':h.capEff>80?'a':'r'],
                ['Ops. en mercado',h.txCount,''],
              ].map(([l,v,c])=>`
                <div style="background:var(--c3);border-radius:var(--r);padding:8px 10px;">
                  <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">${conAyuda(l)}</div>
                  <div class="mono ${c}" style="font-size:13px;font-weight:500;">${v}</div>
                </div>`).join('')}
            </div>

            <!-- Allocation bars -->
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Distribución del portafolio</div>
            ${allocBar(h.alloc.b,'var(--green)','Bonos')}
            ${allocBar(h.alloc.a,'var(--accent2)','Acciones')}
            ${allocBar(h.alloc.d,'var(--amber)','Divisas')}
            ${allocBar(h.alloc.f,'var(--red)','Futuros')}
            ${allocBar(h.alloc.dv,'var(--cyan, #00c4ff)','Derivados')}
          </div>

          <!-- Right: selected assets full list -->
          <div>
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Activos seleccionados para esta sesión</div>
            ${pickedList
              ? `<div class="lab-picked-list" style="min-height:auto;flex-wrap:wrap;">${pickedList}</div>`
              : `<div class="info-box" style="font-size:11px;">Todos los activos disponibles (sin selección específica)</div>`
            }
            <div style="margin-top:12px;">
              <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Informe ejecutivo de la simulación</div>
              <div class="info-box ${h.passed?'success':h.achieved>0?'warn':'danger'}" style="font-size:11.5px;line-height:1.7;">
                ${(()=>{
                  const primRiesgo=(h.achieved-RF).toFixed(2);
                  const annRet=(h.achieved/h.months*12).toFixed(2);
                  if(h.passed){
                    return`<b>Objetivo de rentabilidad alcanzado.</b> El portafolio generó un retorno de <b>+${h.achieved.toFixed(2)}%</b> en ${h.months} meses,
                    superando la meta asignada de <b>${h.target}%</b> y la tasa libre de riesgo de referencia de <b>${RF}%</b> en <b>+${primRiesgo}%</b>.
                    El Ratio de Sharpe de <b>${h.sharpe}</b> indica ${h.sharpe>1?'una compensación eficiente del riesgo asumido — gestión activa de calidad superior':'una compensación del riesgo dentro de parámetros aceptables'}.
                    La volatilidad σ del portafolio (<b>${h.sigma}%</b>) mantuvo la eficiencia de riesgo en <b>${h.riskEff}%</b>, con un retorno anualizado estimado de <b>+${annRet}%</b>.`;
                  } else if(h.achieved>0){
                    return`<b>Retorno positivo, objetivo de rentabilidad no alcanzado.</b> El portafolio generó <b>+${h.achieved.toFixed(2)}%</b> en ${h.months} meses, por debajo de la meta de <b>${h.target}%</b> en <b>${(h.target-h.achieved).toFixed(2)} p.p.</b>
                    La prima sobre la tasa libre de riesgo fue de <b>${primRiesgo>=0?'+':''}${primRiesgo}%</b>.
                    La volatilidad σ de <b>${h.sigma}%</b> redujo la consistencia del retorno, con un Sharpe de <b>${h.sharpe}</b>.
                    Para incrementar el retorno ajustado por riesgo, se recomienda aumentar la ponderación en activos de mayor rentabilidad esperada sin escalar proporcionalmente la volatilidad del portafolio.`;
                  } else {
                    return`<b>Drawdown registrado — objetivo no alcanzado.</b> El portafolio presentó una pérdida de <b>${h.achieved.toFixed(2)}%</b> respecto al capital inicial de <b>$${fmt(h.init)}</b> en el horizonte de ${h.months} meses.
                    La volatilidad σ de <b>${h.sigma}%</b> con un Sharpe de <b>${h.sharpe}</b> refleja ineficiencia en la relación riesgo-retorno.
                    El VaR estimado de <b>$${fmt(h.var95)}</b> materializó pérdidas durante el período de simulación.
                    Se recomienda reestructurar la asignación de activos priorizando instrumentos de renta fija y reduciendo la exposición a instrumentos especulativos (futuros, derivados) que amplifican la volatilidad sin generar retorno excedente suficiente.`;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}

    <!-- ── Clear button ── -->
    <div style="text-align:right;margin-top:6px;">
      <button class="btn btn-ghost btn-sm" onclick="clearLabHistory();renderResultsLab();"><i class="ti ti-trash"></i> Limpiar historial</button>
    </div>`;

  el.innerHTML=html;
}

// ═══════════════════ RESULTS ═══════════════════
function renderResults(){
  // ── Metrics ──
  const tI = portfolio.reduce((s,p)=>s+p.invested,0);
  const cV = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const pnl = cV - tI;
  const retPct = tI>0 ? (pnl/tI*100) : 0;          // rendimiento realizado del período (real)
  // Métricas ponderadas por valor de mercado, con correlación de un factor.
  const pmR = computePortfolioMetrics(portfolio);
  const aS = pmR.wSigma;                            // sigma de cartera (no promedio simple)
  const aR = pmR.wRet;                              // retorno esperado ponderado
  const sh = pmR.sharpe;                            // Sharpe de cartera correcto

  document.getElementById('res-ret').textContent = (retPct>=0?'+':'')+retPct.toFixed(2)+'%';
  document.getElementById('res-ret').className   = 'metric-val mono '+(retPct>=0?'g':'r');
  document.getElementById('res-sigma').textContent = aS.toFixed(1)+'%';
  document.getElementById('res-sharpe').textContent = sh.toFixed(2);
  document.getElementById('res-ops').textContent = txHistory.length;

  // ── Market session KPIs ──
  const completedSessions = marketSessionLog.filter(s=>s.closedAt);
  const totalSessions     = marketSessionLog.length;
  const totalMsTraded     = marketSessionLog.reduce((s,l)=>s+(l.durationMs||0),0);
  const hoursTraded       = (totalMsTraded/3600000).toFixed(1);
  // A "trading day" in this simulator = one 4-hour session
  const tradingDays       = completedSessions.length;
  const isOpen            = marketSession.open;

  const setStat = (id, val, cls='') => {
    const el = document.getElementById(id);
    if(el){ el.textContent=val; if(cls) el.className='metric-val mono '+cls; }
  };
  setStat('res-sessions',    totalSessions > 0 ? totalSessions : '—',    'accent2');
  setStat('res-trading-days',tradingDays   > 0 ? tradingDays+' día'+(tradingDays!==1?'s':'') : '—', 'accent2');
  setStat('res-time-traded', totalMsTraded > 0 ? hoursTraded+' h' : '—', 'accent2');
  setStat('res-mkt-status',  isOpen ? '● ABIERTO' : totalSessions>0?'◼ CERRADO':'Sin sesiones', isOpen?'g':'r');

  // ── SERIE 7: Synthetic Market Index (CL-30) ──
  const idxEl = document.getElementById('res-market-index');
  if (idxEl) {
    // Equal-weighted index across all 5 asset classes using session change
    const classes = [
      {label:'Renta Variable', arr:STOCKS,      color:'#2962ff'},
      {label:'Renta Fija',     arr:BONDS,       color:'#00d084'},
      {label:'Divisas',        arr:FOREX,       color:'#ffb400'},
      {label:'Futuros',        arr:FUTURES,     color:'#ff4757'},
      {label:'Derivados',      arr:DERIVATIVES, color:'#00c4ff'},
    ];
    let totalChg = 0, count = 0;
    const classChanges = classes.map(c => {
      const chgs = (c.arr||[]).map(a=>a.change||0);
      const avg = chgs.length ? chgs.reduce((s,v)=>s+v,0)/chgs.length : 0;
      totalChg += avg * (c.arr||[]).length;
      count += (c.arr||[]).length;
      const gainers = chgs.filter(v=>v>0).length;
      return {...c, avg, gainers, total:(c.arr||[]).length};
    });
    const indexLevel = 1000 * (1 + (count?totalChg/count:0)/100);
    const indexChg = count ? totalChg/count : 0;

    idxEl.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="font-size:32px;font-family:var(--font-mono);font-weight:700;color:var(--t1);">${indexLevel.toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:16px;font-family:var(--font-mono);font-weight:600;color:${indexChg>=0?'var(--green)':'var(--red)'};">${indexChg>=0?'▲ +':'▼ '}${indexChg.toFixed(2)}%</div>
        <div style="font-size:11px;color:var(--t3);">Base 1,000 pts · Índice equiponderado de 150 activos</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        ${classChanges.map(c=>`
          <div style="background:var(--c3);border-radius:var(--r);padding:10px;border-left:3px solid ${c.color};">
            <div style="font-size:10px;color:var(--t3);margin-bottom:3px;">${c.label}</div>
            <div style="font-size:15px;font-family:var(--font-mono);font-weight:600;color:${c.avg>=0?'var(--green)':'var(--red)'};">${c.avg>=0?'+':''}${c.avg.toFixed(2)}%</div>
            <div style="font-size:9px;color:var(--t3);margin-top:2px;">${c.gainers}/${c.total} al alza</div>
          </div>`).join('')}
      </div>`;
  }

  // ── Session log table ──
  const logEl = document.getElementById('res-session-log');
  if (logEl) {
    if (marketSessionLog.length === 0) {
      logEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--t3);font-size:13px;">No se han registrado sesiones de mercado. Ve al Mercado y abre una sesión para comenzar.</div>';
    } else {
      logEl.innerHTML = `
        <table>
          <thead><tr>
            <th>#</th>
            <th>Apertura</th>
            <th>Cierre</th>
            <th>Duración</th>
            <th>Operaciones</th>
            <th>Estado</th>
          </tr></thead>
          <tbody>
            ${marketSessionLog.map((s,i)=>{
              const dur = s.durationMs ? (s.durationMs/3600000).toFixed(2)+' h' : '—';
              const isActive = !s.closedAt;
              return `<tr>
                <td class="mono" style="color:var(--t3);">${i+1}</td>
                <td style="font-size:11px;color:var(--t2);">${s.openedAt}</td>
                <td style="font-size:11px;color:var(--t2);">${s.closedAt || '—'}</td>
                <td class="mono">${dur}</td>
                <td class="mono">${s.txCount ?? (isActive ? txHistory.length : '—')}</td>
                <td><span class="badge ${isActive?'badge-green':'badge-blue'}">${isActive?'Activa':'Completada'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="font-size:10px;color:var(--t3);margin-top:8px;text-align:right;">
          ${tradingDays} sesión(es) completada(s) · ${totalSessions} sesión(es) total · ${hoursTraded} horas operadas
        </div>`;
    }
  }

  // ── Bar chart: avg return by type ──
  resBarInst = dc(resBarInst);
  const bTR = {accion:[],bono:[],divisa:[],futuro:[],derivado:[]};
  portfolio.forEach(p=>{
    // Use real P&L: currentPrice vs buyPrice
    const cur = p.currentPrice || p.buyPrice;
    const r = (cur - p.buyPrice) / p.buyPrice * 100;
    if(bTR[p.type]) bTR[p.type].push(r);
  });
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
  {const _c=document.getElementById('res-bar');if(_c&&typeof Chart!=='undefined'){
    resBarInst=new Chart(_c,{type:'bar',data:{
      labels:['Acciones','Bonos','Divisas','Futuros','Derivados'],
      datasets:[{
        data:[avg(bTR.accion),avg(bTR.bono),avg(bTR.divisa),avg(bTR.futuro),avg(bTR.derivado)],
        backgroundColor:['rgba(41,98,255,.75)','rgba(0,208,132,.75)','rgba(255,180,0,.75)','rgba(255,71,87,.75)','rgba(0,196,255,.75)'],
        borderRadius:4
      }]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>(c.raw>=0?'+':'')+c.raw.toFixed(2)+'%'}}},
        scales:{
          x:{ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},
          y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.03)'},
             // Force symmetric scale so gains and losses both show
             suggestedMin: Math.min(0, ...Object.values(bTR).flat()) - 2,
             suggestedMax: Math.max(0, ...Object.values(bTR).flat()) + 2,
          }
        }
      }
    });
  }}

  // ── Scatter: risk vs return per position ──
  resScatterInst = dc(resScatterInst);
  const pts = portfolio.map(p=>({
    x: p.sigma,
    y: ((p.currentPrice||p.buyPrice) - p.buyPrice) / p.buyPrice * 100,
    label: p.ticker
  }));
  {const _c=document.getElementById('res-scatter');if(_c&&typeof Chart!=='undefined'){
    resScatterInst=new Chart(_c,{type:'scatter',data:{datasets:[{
      data:pts,
      backgroundColor: pts.map(pt=>pt.y>=0?'rgba(0,208,132,.75)':'rgba(255,71,87,.75)'),
      pointRadius:8
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const d=c.dataset.data[c.dataIndex];return d.label+': σ='+d.x.toFixed(1)+'% · '+(d.y>=0?'+':'')+d.y.toFixed(2)+'%';}}}},
      scales:{
        x:{title:{display:true,text:'Riesgo σ%',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'}},
        y:{title:{display:true,text:'Retorno%',color:'#3d4d72'},ticks:{color:'#3d4d72',font:{size:10}},grid:{color:'rgba(255,255,255,.03)'},
           suggestedMin: Math.min(0, ...pts.map(p=>p.y)) - 2,
           suggestedMax: Math.max(0, ...pts.map(p=>p.y)) + 2,
        }
      }
    }
    });
  }}

  // ── Positions table ──
  document.getElementById('res-table').innerHTML = portfolio.length===0
    ? '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:1.5rem;">Sin posiciones activas.</td></tr>'
    : portfolio.map(p=>{
        const cur = p.currentPrice || p.buyPrice;
        const r   = (cur - p.buyPrice) / p.buyPrice * 100;
        const pnlAmt = (cur - p.buyPrice) * p.qty;
        const s   = p.sigma>0 ? (r-RF)/p.sigma : 0;
        return `<tr>
          <td><div style="font-weight:500;">${p.name}</div><div style="font-size:10px;color:var(--t3);">${p.ticker}</div></td>
          <td><span class="badge ${p.type==='accion'?'badge-blue':p.type==='bono'?'badge-green':p.type==='divisa'?'badge-amber':p.type==='futuro'?'badge-red':'badge-cyan'}">${p.type}</span></td>
          <td class="mono">$${fmt(p.invested)}</td>
          <td class="mono">$${fmt(cur*p.qty)}</td>
          <td class="mono ${r>=0?'g':'r'}" style="font-weight:600;">${r>=0?'+':''}${r.toFixed(2)}%</td>
          <td class="mono ${pnlAmt>=0?'g':'r'}">${pnlAmt>=0?'+$':'-$'}${fmt(Math.abs(pnlAmt))}</td>
          <td class="mono">${p.sigma.toFixed(1)}%</td>
          <td><span class="badge ${r>5?'badge-green':r>0?'badge-amber':r>-5?'badge-red':'badge-red'}">${r>5?'Ganancia':r>0?'Leve alza':r>-5?'Pérdida leve':'Pérdida'}</span></td>
        </tr>`;
      }).join('');

  // ── Transaction history ──
  const txHtml = txHistory.length===0
    ? '<div style="text-align:center;padding:1.5rem;color:var(--t3);font-size:13px;">No hay transacciones registradas aún.</div>'
    : `<table>
        <thead><tr>
          <th>Hora</th><th>Operación</th><th>Activo</th><th>Cantidad</th><th>Precio</th><th>Total</th>
        </tr></thead>
        <tbody>
          ${txHistory.filter(t=>t.action==='Compra'||t.action==='Venta').map(t=>`<tr>
            <td class="mono" style="font-size:10px;color:var(--t3);">${t.date}</td>
            <td><span class="badge ${t.action==='Compra'?'badge-green':'badge-red'}">${t.action}</span></td>
            <td style="font-weight:500;">${t.name}</td>
            <td class="mono">${t.qty} u.</td>
            <td class="mono">$${fmt(t.price)}</td>
            <td class="mono ${t.action==='Compra'?'r':'g'}">${t.action==='Compra'?'-':'+'}$${fmt(t.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  // ── Evaluation + inject tx history ──
  // ── FINANCIAL ANALYSIS ──
  const tI2      = tI;
  const var95r   = pmR.var95;                       // VaR-95 diversificado (no asume ρ=1)
  const beta     = pmR.beta;                         // beta de cartera ponderada por valor
  // Retorno del período realizado (NO anualizado artificialmente): la sesión intradía no
  // admite una anualización directa creíble, por lo que se reporta el rendimiento del período.
  const retPeriodo = retPct;
  const treynor  = beta&&beta>0?(retPct-RF)/beta:null;
  // Information Ratio simplificado: exceso sobre RF por unidad de riesgo total de cartera.
  // (Sin benchmark explícito, el tracking error no es definible; se usa σ de cartera como proxy.)
  const infoR    = aS>0?((retPct-RF)/aS):null;
  const winners  = portfolio.filter(p=>(p.currentPrice||p.buyPrice)>p.buyPrice);
  const losers   = portfolio.filter(p=>(p.currentPrice||p.buyPrice)<p.buyPrice);
  const maxPos   = portfolio.reduce((b,p)=>p.invested>b.invested?p:b,{invested:0,name:'—'});
  const winRate  = portfolio.length?winners.length/portfolio.length*100:0;
  const types    = [...new Set(portfolio.map(p=>p.type))];

  // Evaluation labels
  const shRating  = sh>2?'Superior':sh>1?'Muy bueno':sh>0.5?'Aceptable':sh>0?'Subóptimo':'Ineficiente';
  const shColor   = sh>1?'var(--green)':sh>0.5?'var(--green)':sh>0?'var(--amber)':'var(--red)';
  const volRating = aS<8?'Conservador':aS<15?'Moderado':aS<25?'Agresivo':'Especulativo';
  const volColor  = aS<8?'var(--green)':aS<15?'var(--amber)':'var(--red)';
  const divRating = types.length>=4?'Amplia':types.length>=3?'Moderada':types.length>=2?'Limitada':'Concentrada';
  const divColor  = types.length>=4?'var(--green)':types.length>=3?'var(--amber)':'var(--red)';
  const retRating = retPct>=10?'Alfa positivo':retPct>=RF?'Sobre la tasa libre':retPct>=0?'Positivo':retPct>=-5?'Drawdown leve':'Drawdown severo';
  const retColor  = retPct>=RF?'var(--green)':retPct>=0?'var(--amber)':'var(--red)';

  // Dictamen
  const grade = retPct>=10&&sh>0.5?'A+  — Gestión óptima':
                retPct>=RF&&sh>0?'A   — Desempeño superior a tasa libre':
                retPct>=0?'B   — Desempeño positivo con margen de mejora':
                retPct>=-5?'C   — Drawdown controlado; revisar estrategia':
                'D   — Pérdidas significativas; reestructurar portafolio';
  const gradeColor = retPct>=RF&&sh>0?'var(--green)':retPct>=0?'var(--amber)':'var(--red)';

  document.getElementById('res-evaluation').innerHTML=`

    <!-- ─── INDICADORES CLAVE ─── -->
    <div class="grid-4-resp" style="gap:10px;margin-bottom:16px;">
      ${[
        ['Rentabilidad total',(retPct>=0?'+':'')+retPct.toFixed(2)+'%',retColor,retRating],
        ['Ratio Sharpe',sh.toFixed(2),shColor,shRating],
        ['Volatilidad σ prom.',aS.toFixed(1)+'%',volColor,volRating],
        ['Diversificación',types.length+' clases',divColor,divRating],
      ].map(([l,v,c,r])=>`
        <div style="background:var(--c3);border-radius:var(--r2);padding:14px;text-align:center;border-top:3px solid ${c};">
          <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">${l}</div>
          <div style="font-size:20px;font-family:var(--font-mono);font-weight:700;color:${c};line-height:1.1;">${v}</div>
          <div style="font-size:10px;color:${c};margin-top:4px;font-weight:600;">${r}</div>
        </div>`).join('')}
    </div>

    <!-- ─── ANÁLISIS CUANTITATIVO ─── -->
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><i class="ti ti-chart-dots" style="color:var(--accent2);"></i> Análisis cuantitativo del portafolio</div>
      <div class="grid2" style="gap:16px;">

        <!-- Columna izquierda: métricas -->
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--c4);">Métricas de retorno y riesgo</div>
          ${[
            ['Capital bajo gestión',              '$'+fmt(tI2),                          ''],
            ['Valor de mercado (MtM)',             '$'+fmt(cV),                           ''],
            ['Resultado neto (P&L)',               (pnl>=0?'+$':'-$')+fmt(Math.abs(pnl)), pnl>=0?'g':'r'],
            ['Retorno del período',                (retPct>=0?'+':'')+retPct.toFixed(2)+'%', retPct>=0?'g':'r'],
            ['Retorno del período (realizado)',     (retPeriodo>=0?'+':'')+retPeriodo.toFixed(2)+'%', retPeriodo>=0?'g':'r'],
            ['Tasa libre de riesgo (RF)',          RF.toFixed(2)+'%',                     ''],
            ['Prima de riesgo (Retorno − RF)',     (retPct-RF>=0?'+':'')+( retPct-RF).toFixed(2)+'%', retPct>=RF?'g':'r'],
            ['Alfa vs. tasa libre de riesgo',      retPct>=RF?'Generación de alfa':'Destrucción de valor', retPct>=RF?'g':'r'],
          ].map(([l,v,c])=>`
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);">
              <span style="color:var(--t2);">${conAyuda(l)}</span>
              <span class="mono ${c}" style="font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>

        <!-- Columna derecha: ratios de eficiencia -->
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--c4);">Ratios de eficiencia y riesgo</div>
          ${[
            ['Ratio de Sharpe (Retorno/Riesgo)',  sh.toFixed(4),                                             sh>1?'g':sh>0.5?'g':sh>0?'a':'r'],
            ['Ratio de Treynor',                  treynor!==null?treynor.toFixed(4):'N/A (sin beta)',        treynor&&treynor>0?'g':'a'],
            ['Beta promedio ponderado',            beta!==null?beta.toFixed(3):'N/A',                        ''],
            ['Volatilidad σ (anualizada)',         aS.toFixed(2)+'%',                                         'a'],
            ['VaR 95% paramétrico (1 año)',        '$'+fmt(var95r),                                           'r'],
            ['CVaR estimado (99%)',                '$'+fmt(var95r*1.38),                                      'r'],
            ['Máxima concentración (una posición)','$'+fmt(maxPos.invested)+' · '+maxPos.name.substring(0,18), ''],
            ['Tasa de acierto (win rate)',         winners.length+' / '+portfolio.length+' ('+winRate.toFixed(0)+'%)', winRate>=50?'g':'r'],
          ].map(([l,v,c])=>`
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);">
              <span style="color:var(--t2);">${conAyuda(l)}</span>
              <span class="mono ${c}" style="font-weight:500;">${v}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Composición por clase de activo -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--c4);">
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Exposición por clase de activo (% del AUM gestionado)</div>
        <div class="grid-5-resp" style="gap:8px;">
          ${['accion','bono','divisa','futuro','derivado'].map(t=>{
            const v=portfolio.filter(p=>p.type===t).reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
            const pctv=cV>0?(v/cV*100):0;
            const col=t==='accion'?'#2962ff':t==='bono'?'#00d084':t==='divisa'?'#ffb400':t==='futuro'?'#ff4757':'#00c4ff';
            const label=t==='accion'?'Renta Variable':t==='bono'?'Renta Fija':t==='divisa'?'Divisas (FX)':t==='futuro'?'Futuros':'Derivados OTC';
            return`<div style="background:var(--c3);border-radius:var(--r);padding:10px;text-align:center;">
              <div style="font-size:9px;color:var(--t3);margin-bottom:4px;">${label}</div>
              <div style="font-size:18px;font-family:var(--font-mono);font-weight:700;color:${col};">${pctv.toFixed(1)}%</div>
              <div style="height:3px;border-radius:2px;background:var(--c4);margin-top:6px;"><div style="width:${pctv}%;height:3px;border-radius:2px;background:${col};"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ─── INFORME DE EVALUACIÓN FINAL ─── -->
    <div class="card" style="margin-bottom:14px;border-color:${retPct>=RF&&sh>0?'rgba(0,208,132,.25)':retPct>=0?'rgba(255,180,0,.2)':'rgba(255,71,87,.2)'};">
      <div class="card-title"><i class="ti ti-file-analytics" style="color:${gradeColor};"></i> Informe de evaluación del gestor de cartera</div>

      <!-- Calificación -->
      <div style="display:flex;align-items:center;gap:16px;padding:14px;background:var(--c3);border-radius:var(--r2);margin-bottom:14px;">
        <div style="font-size:32px;font-family:var(--font-mono);font-weight:900;color:${gradeColor};letter-spacing:-1px;flex-shrink:0;">${grade.split('  —')[0]}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:${gradeColor};margin-bottom:3px;">${grade.split('  —')[1]||''}</div>
          <div style="font-size:11px;color:var(--t2);">Calificación de desempeño · ${portfolio.length} posiciones activas · ${txHistory.length} operaciones ejecutadas</div>
        </div>
      </div>

      <!-- Análisis narrativo por sección -->
      <div class="grid2" style="gap:14px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Análisis de retorno</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.75;">
            ${tI>0?`
            El portafolio registra un retorno neto de <b style="color:${retColor};">${retPct>=0?'+':''}${retPct.toFixed(2)}%</b> sobre el capital gestionado de <b>$${fmt(tI)}</b>.
            ${retPct>=RF
              ? `La rentabilidad supera la tasa libre de riesgo de referencia (<b>${RF}%</b>), generando una prima de riesgo positiva de <b>+${(retPct-RF).toFixed(2)}%</b>. El portafolio ha creado valor por encima del costo de oportunidad.`
              : retPct>=0
              ? `La rentabilidad es positiva pero se ubica por debajo de la tasa libre de riesgo de referencia (<b>${RF}%</b>). El retorno ajustado por riesgo indica una prima negativa de <b>${(retPct-RF).toFixed(2)}%</b>, sugiriendo que el riesgo asumido no ha sido compensado adecuadamente.`
              : `El portafolio presenta un drawdown de <b>${retPct.toFixed(2)}%</b> respecto al capital inicial. La exposición actual genera pérdidas no realizadas de <b>$${fmt(Math.abs(pnl))}</b>, requiriendo reevaluación de las posiciones con mayor destrucción de valor.`
            }`:
            'Sin posiciones registradas. Configure su portafolio en la sección de Mercado.'}
          </div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Gestión del riesgo</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.75;">
            ${portfolio.length>0?`
            La volatilidad anualizada promedio ponderada del portafolio es <b style="color:var(--amber);">σ = ${aS.toFixed(2)}%</b>, clasificando el perfil de riesgo como <b>${volRating}</b>.
            El Ratio de Sharpe de <b style="color:${shColor};">${sh.toFixed(2)}</b> indica que por cada unidad de riesgo asumida, el portafolio genera ${sh>0?`<b>${sh.toFixed(2)} unidades de retorno excedente</b>`:'un retorno excedente negativo, señal de ineficiencia en la gestión del riesgo'}.
            El VaR paramétrico al 95% de confianza estima una pérdida máxima esperada de <b style="color:var(--red);">$${fmt(var95r)}</b> en un horizonte de 12 meses bajo condiciones normales de mercado.
            La tasa de acierto (win rate) del <b>${winRate.toFixed(0)}%</b> con ${winners.length} posiciones ganadoras sobre ${portfolio.length} totales ${winRate>=50?'sugiere una selección de activos por encima del umbral de eficiencia':'indica un desempeño por debajo del umbral de eficiencia estadística'}.'`:
            'Configure posiciones para generar el análisis de riesgo.'}
          </div>
        </div>
      </div>

      <!-- Recomendaciones -->
      ${portfolio.length>0?`
      <div style="padding-top:12px;border-top:1px solid var(--c4);">
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Recomendaciones estratégicas del analista</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${[
            types.length<3?['var(--amber)','ti-alert-triangle','Riesgo de concentración','El portafolio está expuesto en menos de 3 clases de activos. Se recomienda incorporar instrumentos de renta fija y/o divisas para reducir el riesgo no sistemático mediante diversificación interclase.']:null,
            sh<0.5&&sh>=0?['var(--amber)','ti-activity','Eficiencia del capital subóptima',`El Ratio de Sharpe de ${sh.toFixed(2)} está por debajo del umbral técnico de 0.50. Considere rebalancear hacia activos con mayor retorno ajustado por riesgo (mayor ratio Sharpe individual) o reducir posiciones de alta volatilidad con bajo retorno.`]:null,
            sh<0?['var(--red)','ti-trending-down','Destrucción de valor ajustada por riesgo',`Sharpe negativo (${sh.toFixed(2)}) indica que el portafolio rinde por debajo de la tasa libre de riesgo. El riesgo asumido no está siendo compensado. Evalúe liquidar posiciones perdedoras y reasignar capital a instrumentos de mayor certeza de retorno.`]:null,
            losers.length>winners.length?['var(--red)','ti-arrow-down','Mayor proporción de posiciones perdedoras',`${losers.length} de ${portfolio.length} posiciones registran retorno negativo. Evalúe stop-loss técnico en posiciones con pérdidas superiores al 5% y considere el rebalanceo hacia los activos que muestran momentum positivo.`]:null,
            retPct>=10&&sh>1?['var(--green)','ti-award','Desempeño de gestión activa superior',`El portafolio supera el benchmark de renta libre con un Sharpe de ${sh.toFixed(2)} y un retorno de +${retPct.toFixed(2)}%. Considere mantener las posiciones ganadoras y evaluar incrementar exposición en las clases de activos con mejor contribución al retorno total.`]:null,
            beta!==null&&beta>1.3?['var(--amber)','ti-bolt','Alta sensibilidad al mercado (Beta elevado)',`Beta promedio de ${beta.toFixed(2)} indica que el portafolio amplifica los movimientos del mercado en un ${((beta-1)*100).toFixed(0)}%. En escenarios de corrección de mercado, las pérdidas serían proporcionalmente superiores. Considere reducir beta mediante instrumentos de baja correlación.`]:null,
          ].filter(Boolean).map(([color,icon,title,desc])=>`
            <div style="display:flex;gap:10px;padding:10px 12px;background:var(--c3);border-radius:var(--r);border-left:3px solid ${color};">
              <i class="ti ${icon}" style="color:${color};font-size:16px;flex-shrink:0;margin-top:1px;"></i>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--t1);margin-bottom:3px;">${title}</div>
                <div style="font-size:11px;color:var(--t2);line-height:1.6;">${desc}</div>
              </div>
            </div>`).join('')||`
            <div class="info-box success" style="font-size:12px;">
              El portafolio no presenta alertas de gestión de riesgo en los parámetros evaluados. Continúe monitoreando las fluctuaciones de mercado mediante el sistema de actualización automática.
            </div>`}
        </div>
      </div>`:''
    }

    </div>

    <!-- ─── HISTORIAL DE TRANSACCIONES ─── -->
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><i class="ti ti-history" style="color:var(--accent2);"></i> Registro de operaciones ejecutadas</div>
      ${txHtml}
    </div>
    <div style="font-size:10px;color:var(--t3);text-align:center;margin-top:8px;padding-top:6px;border-top:1px solid var(--c4);">
      CapitalLab · Simulador de Mercados Financieros · Facultad de Economía / Finanzas y Banca · Universidad de Panamá · 2026
    </div>`;
  autoColapsarEnMovil(document.getElementById('page-resultados'));
  aplicarAyudaTerminos();
}

// ═══════════════════ INIT (see window.load at bottom) ═══════════════════

// ═══════════════════ FLUCTUATION SYSTEM ═══════════════════
// Each asset keeps a rolling window of OHLC candles (last 60 × 10-sec ticks)
const candleHistory = {};
const CANDLE_COUNT  = 60;
// Volatility amplification for visible, realistic intraday movement.
// ── Derivación temporal defendible ──
//   Sesión bursátil: 4 horas (SESSION_DURATION_MS).
//   Cadencia de precios: 1 tick cada 5 s (TICK_MS) → 720 ticks/hora → 2 880 ticks/sesión.
//   Año bursátil estándar: 252 sesiones de negociación.
//   TICKS_PER_YEAR = 2 880 × 252 = 725 760 ticks por año.
// Cada tick representa así un intervalo de mercado real de 5 segundos.
// EFFECTIVE_PERIODS controla la intensidad de la volatilidad intradía (menor = más riesgo/movimiento).
const TICKS_PER_SESSION = (SESSION_DURATION_MS / TICK_MS);   // 2 880 ticks por sesión de 4 h
const TRADING_DAYS_YEAR = 252;                                // sesiones bursátiles al año
const TICKS_PER_YEAR    = TICKS_PER_SESSION * TRADING_DAYS_YEAR; // 725 760
const EFFECTIVE_PERIODS = 1400;   // lower = more intraday volatility / risk
const RISK_MULTIPLIER   = 3.2;    // global risk amplifier — notable up/down swings

// Generate per-tick sigma from annual sigma (amplified for visible movement)
function candleSigma(annualSigma) {
  return ((annualSigma / 100) / Math.sqrt(EFFECTIVE_PERIODS)) * RISK_MULTIPLIER;
}

// Seed initial candle history for an asset
function initCandles(asset) {
  const id = asset.id;
  if (candleHistory[id]) return;
  const cs   = candleSigma(asset.sigma);
  const candles = [];
  let price = asset.currentPrice || asset.price;
  for (let i = CANDLE_COUNT; i > 0; i--) {
    const drift = (asset.ret / 100) / EFFECTIVE_PERIODS;
    const r1 = (Math.random() - 0.5) * 2;
    const r2 = (Math.random() - 0.5) * 2;
    const r3 = (Math.random() - 0.5) * 2;
    const open  = price;
    const close = Math.max(0.01, open * (1 + drift + r1 * cs));
    const high  = Math.max(open, close) * (1 + Math.abs(r2) * cs * 0.8);
    const low   = Math.min(open, close) * (1 - Math.abs(r3) * cs * 0.8);
    candles.push({ o: +open.toFixed(getDecimals(asset)), h: +high.toFixed(getDecimals(asset)), l: +low.toFixed(getDecimals(asset)), c: +close.toFixed(getDecimals(asset)) });
    price = close;
  }
  candleHistory[id] = candles;
  // align currentPrice to last candle close
  asset.currentPrice = candles[candles.length - 1].c;
}

function getDecimals(asset) {
  if (!asset) return 2;
  if (asset.type === 'divisa' && (asset.price || 0) > 100) return 0;
  if ((asset.price || 0) < 10) return 4;
  return 2;
}

// Add one new candle to history (called on each fluctuation)
function addCandle(asset) {
  const id  = asset.id;
  const prev = candleHistory[id];
  const lastClose = prev ? prev[prev.length - 1].c : (asset.currentPrice || asset.price);
  // Use the REAL current price computed by tickPrices as the close
  const close = asset.currentPrice || asset.price;
  const open  = lastClose;
  // Wick spread proportional to the move magnitude
  const moveAbs = Math.abs(close - open);
  const wickSpread = Math.max(moveAbs * 0.4, open * 0.0008);
  const high  = Math.max(open, close) + Math.abs((Math.random()-0.5)) * wickSpread;
  const low   = Math.min(open, close) - Math.abs((Math.random()-0.5)) * wickSpread;
  const dec   = getDecimals(asset);
  const newCandle = { o: +open.toFixed(dec), h: +high.toFixed(dec), l: +Math.max(0.01,low).toFixed(dec), c: +close.toFixed(dec) };
  if (prev) {
    prev.push(newCandle);
    if (prev.length > CANDLE_COUNT) prev.shift();
  } else {
    candleHistory[id] = [newCandle];
  }
  return newCandle;
}

// ═══════════════════ MARKET SESSION ENGINE ═══════════════════
// NYSE-style: 4-hour session, prices tick every 5 seconds (TICK_MS) via GBM
// Capital (cash) is never altered by price movements — only portfolio MtM changes

// ═══════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN CON PRECIOS REALES — recalibra el precio BASE del que
// arranca la simulación (nunca toca el motor de simulación en sí, que
// sigue corriendo igual que siempre). Es enteramente opcional: si
// Yahoo Finance no responde, tarda demasiado, o da cualquier error,
// esta función simplemente no hace nada — el simulador sigue
// funcionando exactamente igual, con sus precios base normales.
// ═══════════════════════════════════════════════════════════════════
const SIM_YAHOO_URL = 'https://zppwrnznsnphxbcqsxsg.supabase.co';
const SIM_YAHOO_ANON_KEY = 'sb_publishable_QDlqCn_sV9kDtrSs4cvQzQ_8ji-2CcO';
// El nombre real de la función en Supabase — ajústelo aquí si el slug
// que le asignó Supabase es distinto al que se está usando ahora.
const SIM_YAHOO_FUNCION = 'datos-yahoo-finance';

// Futuros: el simulador usa tickers estilo "CL1!" (notación de
// TradingView), pero Yahoo Finance usa su propia notación ("CL=F").
// Solo los futuros de esta lista tienen una correspondencia real y
// confiable — el resto se queda con su precio simulado, sin forzar
// una sincronización que no sería de fiar.
const FUTUROS_YAHOO_MAP = { 'CL1!':'CL=F', 'GC1!':'GC=F', 'ES1!':'ES=F', 'ZW1!':'ZW=F', '6E1!':'6E=F' };

// Cuánto tiempo puede tener una cotización de Yahoo antes de
// considerarla "congelada" (mercado cerrado) en vez de "real ahora
// mismo". 20 minutos da margen de sobra para cualquier demora normal
// de Yahoo durante horario de mercado, pero rechaza sin ambigüedad
// cualquier cosa de horas o días de antigüedad (fin de semana,
// feriado, fuera de horario bursátil).
const MAX_ANTIGUEDAD_COTIZACION_MS = 20 * 60 * 1000;

async function sincronizarPreciosRealesSimulador(){
  // El modo invitado (sin cuenta, sin conexión requerida) nunca debe
  // intentar llamar a esta función en la nube — usa siempre precios
  // simulados, tanto por diseño (no se pide cuenta) como para que la
  // versión offline descargable funcione de verdad sin internet, sin
  // generar peticiones de red que de todas formas van a fallar.
  if(guestMode) return;
  // Bonos y derivados (opciones, swaps, CDS, forwards) no tienen una
  // fuente gratuita y confiable en Yahoo Finance — se quedan siempre
  // con su precio simulado, sin ninguna sincronización real.
  const accionesConTicker = STOCKS.filter(a => a.ticker);
  const divisasConTicker = FOREX.filter(a => a.ticker && a.ticker.includes('/'));
  const futurosConMapa = FUTURES.filter(a => FUTUROS_YAHOO_MAP[a.ticker]);
  const todosLosActivos = [...accionesConTicker, ...divisasConTicker, ...futurosConMapa];
  if(!todosLosActivos.length) return;

  // El símbolo real que se le pide a Yahoo puede ser distinto del
  // ticker interno del simulador — los futuros necesitan su propio
  // símbolo, y algunas acciones usan un guion en vez de un punto
  // (Berkshire Hathaway clase B es "BRK-B" en Yahoo, no "BRK.B").
  const simboloAPedir = a => FUTUROS_YAHOO_MAP[a.ticker] || a.ticker.replace('.', '-');

  const controlador = new AbortController();
  const limiteTiempo = setTimeout(()=>controlador.abort(), 6000); // nunca espera más de 6 segundos
  try {
    const lista = todosLosActivos.map(simboloAPedir).join(',');
    const respuesta = await fetch(`${SIM_YAHOO_URL}/functions/v1/${SIM_YAHOO_FUNCION}?symbols=${encodeURIComponent(lista)}`, {
      headers: { 'apikey': SIM_YAHOO_ANON_KEY, 'Authorization': `Bearer ${SIM_YAHOO_ANON_KEY}` },
      signal: controlador.signal,
    });
    clearTimeout(limiteTiempo);
    if(!respuesta.ok) return; // sin romper nada, simplemente no se actualiza
    const d = await respuesta.json();
    if(!d.ok || !Array.isArray(d.cotizaciones) || !d.cotizaciones.length) return;

    let actualizados = 0;
    let anclasNuevasCongeladas = 0;
    const activosAnclados = []; // los que recibieron precio real esta ronda
    const ahoraMs = Date.now();
    // El servidor normaliza "EUR/USD" a "EURUSD=X" antes de responder
    // — la comparación tiene que aplicar esa misma conversión, o una
    // divisa nunca encontraría su propio activo correspondiente.
    const normalizarParaComparar = s => (s||'').toUpperCase().replace(/=X$/,'').replace(/[\/\-!]/g,'');
    d.cotizaciones.forEach(c => {
      const activo = todosLosActivos.find(a => normalizarParaComparar(simboloAPedir(a)) === normalizarParaComparar(c.simbolo));
      // Validación defensiva: un precio real absurdo (cero, negativo,
      // o una variación descabellada frente al precio base original)
      // se descarta, para no meter un dato corrupto a la simulación.
      if(!activo || !c.precioActual || c.precioActual <= 0) return;
      // Un precio real razonable no debería ser menos de la décima
      // parte ni más de diez veces el precio base actual — fuera de
      // ese rango, es casi seguro un error de datos, no un movimiento
      // real de mercado, y se descarta para no corromper la simulación.
      if(c.precioActual < activo.price * 0.1 || c.precioActual > activo.price * 10) return;

      // ¿Es esta cotización nueva información, o es la misma que ya
      // aplicamos antes? Yahoo devuelve el mismo cierre congelado una
      // y otra vez mientras el mercado esté cerrado (mismo tiempoUTC
      // en cada sondeo) — sin este control, cada sincronización de
      // 10s volvería a "clavar" el precio en ese mismo valor viejo,
      // sin dejar nunca que el motor de simulación avance desde ahí,
      // el problema opuesto al que se quiere resolver.
      const esInformacionNueva = !activo.__ultimoTiempoUTCAplicado
        || !c.tiempoUTC
        || c.tiempoUTC !== activo.__ultimoTiempoUTCAplicado;
      if(!esInformacionNueva) return; // ya se aplicó este mismo dato antes; se deja al simulador en paz

      // El precio real SIEMPRE se usa como ancla en cuanto es nuevo,
      // sin importar qué tan viejo sea (aunque sea el cierre del
      // viernes) — es siempre mejor punto de partida que el precio
      // base fijo del código. "Usa siempre el precio más reciente
      // como inicio, y de ahí vete al fallback del simulador."
      activo.price = c.precioActual;
      if(activo.currentPrice !== undefined) activo.currentPrice = c.precioActual;
      if(c.tiempoUTC) activo.__ultimoTiempoUTCAplicado = c.tiempoUTC;
      activo._urlYahoo = `https://finance.yahoo.com/quote/${encodeURIComponent(simboloAPedir(activo))}`;
      delete candleHistory[activo.id];

      // Esta es la SEGUNDA decisión, independiente de la primera: si
      // ADEMÁS esta cotización es fresca (mercado realmente abierto
      // ahora mismo), se marca __ultimoRealMs para que tickPrices()
      // pause la simulación en este activo — el precio real manda
      // tick a tick. Si es una cotización nueva pero vieja (el cierre
      // del viernes, recién aplicado por primera vez esta sesión), NO
      // se marca — el motor de simulación toma el control de
      // inmediato y sigue el movimiento desde este precio real como
      // punto de partida, en vez de quedarse congelado en él.
      const esFresca = c.tiempoUTC && (ahoraMs - c.tiempoUTC * 1000) < MAX_ANTIGUEDAD_COTIZACION_MS;
      if(esFresca){
        activo.__ultimoRealMs = ahoraMs;
      } else {
        delete activo.__ultimoRealMs;
        anclasNuevasCongeladas++;
      }
      activosAnclados.push(activo);
      actualizados++;
    });

    if(actualizados > 0){
      const esPrimeraSincronizacion = !window.__ultimaSincronizacionReal;
      window.__ultimaSincronizacionReal = new Date();
      window.__mercadoRealAbierto = anclasNuevasCongeladas < actualizados; // hay al menos un activo con dato fresco de verdad
      // Solo se refresca lo que ya está visible, sin recargar nada ni
      // interrumpir cualquier cosa que el estudiante esté haciendo.
      try {
        allAssets().forEach(a => { if(!candleHistory[a.id]) initCandles(a); });
        // initCandles() genera CANDLE_COUNT (60) períodos de caminata
        // aleatoria y, al terminar, sobreescribe currentPrice con el
        // cierre de esa caminata — un comportamiento correcto quien
        // inicializa un activo sin ancla real, pero que aquí
        // literalmente borraba el precio real recién anclado, dejando
        // el precio mostrado hasta 8-9% lejos del real (el bug
        // reportado: MSFT mostraba $360 con $483 real). Se re-ancla
        // explícitamente después, solo para los activos que sí
        // recibieron un precio real esta ronda.
        activosAnclados.forEach(a => {
          a.currentPrice = a.price;
          const hist = candleHistory[a.id];
          if(hist && hist.length){
            const dec = getDecimals(a);
            hist[hist.length-1].c = +a.price.toFixed(dec);
            hist[hist.length-1].h = Math.max(hist[hist.length-1].h, +a.price.toFixed(dec));
            hist[hist.length-1].l = Math.min(hist[hist.length-1].l, +a.price.toFixed(dec));
          }
        });
      } catch(e){}
      try { renderAssetList(); } catch(e){}
      try { renderWatchlist(); } catch(e){}
      try { if(selectedAsset) showAssetDetail(selectedAsset.id, selectedAsset.type); } catch(e){}
      try { actualizarIndicadorSincronizacion(actualizados); } catch(e){}
      // El aviso solo se muestra la primera vez de la sesión — con
      // resincronización cada 10s, repetirlo cada vez sería un toast
      // constante y molesto en vez de una confirmación útil.
      if(esPrimeraSincronizacion){
        try { notify(`${actualizados} precio(s) anclados a la cotización real de mercado ✓`); } catch(e){}
      }
    }
  } catch(e){
    clearTimeout(limiteTiempo);
    // Cualquier error (tiempo agotado, sin red, Yahoo caído, límite de
    // solicitudes) se descarta en silencio — el simulador continúa
    // funcionando con sus precios base normales, sin ninguna
    // interrupción ni mensaje de error visible para el estudiante.
  }
}

// Antes esto se llamaba UNA sola vez, al iniciar sesión — el precio
// real quedaba fijo desde ese instante y todo lo demás era simulación
// pura, sin importar cuánto durara la sesión. Ahora se repite cada 45
// segundos: mientras el mercado real esté abierto, el precio se
// mantiene anclado a la cotización real de Yahoo casi en vivo; cuando
// cierra (noches, fines de semana), la función de arriba detecta la
// cotización congelada y deja de forzarla, así que el motor de
// simulación (tickPrices) sigue moviendo el precio desde ahí sin
// interrupciones. 45s es sostenible — no satura el endpoint no
// oficial de Yahoo, que ya de por sí exige cookie+token para datos
// profundos y podría empezar a bloquear si se le pidiera cada pocos
// segundos.
// Antes esto se llamaba UNA sola vez, al iniciar sesión — el precio
// real quedaba fijo desde ese instante y todo lo demás era simulación
// pura, sin importar cuánto durara la sesión. Ahora se repite cada 10
// segundos — lo más seguido que es razonable pedirle al endpoint no
// oficial de Yahoo sin arriesgarse a que empiece a bloquear las
// solicitudes (no es una API con licencia de datos en tiempo real; es
// el mismo endpoint que usa el sitio web de Yahoo). Combinado con que
// tickPrices() ahora se salta el activo mientras tenga un ancla real
// fresca (ver __ultimoRealMs más abajo), el resultado práctico es que
// el precio real manda de verdad mientras el mercado esté abierto, no
// solo "tira" del simulador cada tanto.
const SYNC_REAL_MS = 10000;
// Cuánto se considera "fresco" un ancla real antes de que tickPrices()
// vuelva a tomar el control con su propio modelo — un poco más que
// SYNC_REAL_MS, para no parpadear entre real y simulado si una
// sincronización individual se demora un poco más de lo normal.
const UMBRAL_ANCLA_REAL_FRESCA_MS = SYNC_REAL_MS + 5000;
let __intervaloSyncReal = null;
function iniciarSincronizacionRealPeriodica(){
  if(__intervaloSyncReal) return; // ya está corriendo, no duplicar
  __intervaloSyncReal = setInterval(()=>{ try{ sincronizarPreciosRealesSimulador(); }catch(e){} }, SYNC_REAL_MS);
}

// ═══════════════════════════════════════════════════════════════════
// INDICADOR DE DATOS EN TIEMPO REAL — transparencia para el
// estudiante: saber con certeza si lo que está viendo arrancó de un
// precio real de mercado, o si el simulador está en su modo base
// normal porque la fuente real no estaba disponible en ese momento.
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MI TESIS DE INVERSIÓN — un espacio donde el estudiante registra sus
// propias opciones y su razonamiento, ya sea escrito a mano o traído
// directo desde Analytics tras generar una tesis con IA allá. Se
// guarda en este navegador, igual que el resto del progreso sin cuenta
// vinculada a un servidor externo — es una libreta personal, no una
// operación real de compra.
// ═══════════════════════════════════════════════════════════════════
const TESIS_STORAGE_KEY = 'capitallab_mi_tesis_v1';

function cargarMiTesis(){
  try { const raw = localStorage.getItem(TESIS_STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function guardarMiTesis(lista){
  try { localStorage.setItem(TESIS_STORAGE_KEY, JSON.stringify(lista)); } catch(e){}
}

const TESIS_TIPO_LABEL = { accion:'Acción', bono:'Bono', divisa:'Divisa', futuro:'Futuro', derivado:'Derivado' };
function renderFormularioTesis(){
  const select = document.getElementById('tesis-form-activo');
  if(!select) return;
  const opciones = allAssets().map(a => `<option value="${a.id}|${a.type}">${a.ticker||a.name} · ${TESIS_TIPO_LABEL[a.type]||a.type}</option>`).join('');
  select.innerHTML = opciones;
}

function agregarOpcionTesis(){
  const select = document.getElementById('tesis-form-activo');
  const razon = document.getElementById('tesis-form-razon').value.trim();
  if(!select.value){ if(typeof notify==='function') notify('Elige un activo primero.', 'error'); return; }
  if(!razon){ if(typeof notify==='function') notify('Escribe por qué elegirías esta opción.', 'error'); return; }
  const [id, type] = select.value.split('|');
  const asset = allAssets().find(a=>a.id===id && a.type===type);
  if(!asset) return;
  const lista = cargarMiTesis();
  lista.unshift({
    id: Date.now(),
    ticker: asset.ticker || asset.name,
    nombre: asset.name,
    tipo: asset.type,
    razon,
    origen: 'manual',
    fecha: new Date().toLocaleDateString('es-PA', {day:'2-digit', month:'short', year:'numeric'}),
    fechaHora: new Date().toISOString(),
  });
  guardarMiTesis(lista);
  document.getElementById('tesis-form-razon').value = '';
  renderMiTesis();
  if(typeof notify==='function') notify('Agregado a tu tesis de inversión ✓', 'success');
}

function quitarOpcionTesis(id){
  const lista = cargarMiTesis().filter(x => String(x.id) !== String(id));
  guardarMiTesis(lista);
  renderMiTesis();
}

function renderMiTesis(){
  const lista = cargarMiTesis();
  const cont = document.getElementById('tesis-lista');
  const vacio = document.getElementById('tesis-lista-vacia');
  if(!cont || !vacio) return;
  if(!lista.length){ vacio.style.display='block'; cont.innerHTML=''; return; }
  vacio.style.display='none';
  const origenLabel = { analytics:'Traído de Analytics', academy:'Traído de Academy', manual:'Agregado a mano' };
  const origenIcon = { analytics:'ti-chart-line', academy:'ti-school', manual:'ti-pencil' };
  cont.innerHTML = lista.map(op => `
    <div class="card" style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <b style="font-family:var(--font-mono);">${op.ticker}</b>
          <span style="font-size:10px;color:var(--t3);background:var(--c2);padding:2px 8px;border-radius:10px;"><i class="ti ${origenIcon[op.origen]||'ti-pencil'}"></i> ${origenLabel[op.origen]||'Agregado a mano'}</span>
        </div>
        <div style="font-size:13px;color:var(--t2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${op.razon}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
          <span style="font-size:10.5px;color:var(--t3);">${op.fecha}</span>
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:10.5px;" onclick="verTesisCompleta(${op.id})">Ver completa</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="quitarOpcionTesis(${op.id})" title="Quitar"><i class="ti ti-trash"></i></button>
    </div>
  `).join('');
}

// Muestra el texto íntegro de una tesis en un modal aparte, con fecha
// y hora completas — antes el texto se veía cortado en la tarjeta
// sin ninguna forma de leerlo entero (y, para las tesis traídas de
// Analytics, se cortaba literalmente a 220 caracteres antes de llegar
// aquí; eso ya se corrigió en el origen, pero esta vista sigue siendo
// útil para cualquier tesis larga, venga de donde venga).
function verTesisCompleta(id){
  const lista = cargarMiTesis();
  const op = lista.find(x => String(x.id) === String(id));
  if(!op) return;
  const fechaCompleta = op.fechaHora
    ? new Date(op.fechaHora).toLocaleString('es-PA', {day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})
    : op.fecha;
  const overlay = document.createElement('div');
  overlay.className = 'export-modal-overlay';
  overlay.innerHTML = `<div class="export-modal" style="max-width:520px;">
    <button class="modal-close" onclick="this.closest('.export-modal-overlay').remove();"><i class="ti ti-x"></i></button>
    <h2><i class="ti ti-notebook" style="color:var(--gold, #e8b94a);"></i> ${op.ticker}</h2>
    <div style="font-size:11.5px;color:var(--t3, #7a8ab0);margin-bottom:14px;">${fechaCompleta}</div>
    <div style="font-size:13.5px;color:var(--t1, #e8edf8);line-height:1.65;white-space:pre-wrap;">${op.razon}</div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
}

// ───── Enlace directo desde otra herramienta de CapitalLab ─────
function aplicarEnlaceDirectoCapitalLab(){
  const enlace = window.__enlaceDirectoCapitalLab;
  if(!enlace) return;
  const asset = allAssets().find(a => a.ticker === enlace.ticker && a.type === enlace.tipo)
             || allAssets().find(a => a.ticker === enlace.ticker);
  if(!asset){ window.__enlaceDirectoCapitalLab = null; return; }

  if(enlace.tesis){
    // Viene de Analytics con una tesis ya generada por IA — se
    // registra automáticamente en Mi Tesis de Inversión, y se le
    // avisa al estudiante de forma clara, sin que se pierda ese
    // trabajo que ya hizo del otro lado.
    const lista = cargarMiTesis();
    const yaExiste = lista.some(x => x.ticker===asset.ticker && x.origen==='analytics' && x.razon===enlace.tesis);
    if(!yaExiste){
      lista.unshift({ id:Date.now(), ticker:asset.ticker||asset.name, nombre:asset.name, tipo:asset.type, razon:enlace.tesis, origen:'analytics', fecha:new Date().toLocaleDateString('es-PA',{day:'2-digit',month:'short',year:'numeric'}), fechaHora:new Date().toISOString() });
      guardarMiTesis(lista);
    }
    goPage('tesis');
    setTimeout(()=>{
      const aviso = document.getElementById('tesis-import-aviso');
      if(aviso){
        aviso.style.display='block';
        aviso.innerHTML = `<div class="card" style="border-color:var(--accent2);background:rgba(74,158,255,.08);"><i class="ti ti-chart-line" style="color:var(--accent2);"></i> Trajiste una tesis de <b>${asset.name}</b> desde Analytics, ya está guardada abajo. Puedes seguir agregando más opciones para comparar.</div>`;
      }
      renderMiTesis();
    }, 200);
  } else {
    // Viene de Academy o de un enlace directo sin tesis — se lleva
    // al estudiante directo al detalle de ese activo en el Mercado.
    goPage('mercado');
    setTimeout(()=>{ try { showAssetDetail(asset.id, asset.type); } catch(e){} }, 200);
    if(enlace.origen==='academy' && typeof notify==='function'){
      notify(`Llegaste desde Academy para practicar con ${asset.name} ✓`, 'success');
    }
  }
  window.__enlaceDirectoCapitalLab = null;
}

function actualizarIndicadorSincronizacion(cantidadActualizados){
  let badge = document.getElementById('badge-datos-reales');
  if(!badge){
    badge = document.createElement('div');
    badge.id = 'badge-datos-reales';
    badge.style.cssText = 'position:fixed;bottom:16px;right:16px;background:var(--c1,#10141d);border:1px solid var(--green,#1e8e5a);border-radius:20px;padding:7px 8px 7px 14px;font-size:11.5px;color:var(--t2,#b8c4dc);z-index:400;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:help;transition:opacity .4s ease;';
    document.body.appendChild(badge);
  }
  badge.style.opacity = '1';
  badge.style.display = 'flex';
  const hora = new Date().toLocaleTimeString('es-PA', {hour:'2-digit', minute:'2-digit'});
  // El endpoint de Yahoo Finance que se usa aquí no es una API con
  // licencia formal de datos en tiempo real (esas se pagan) — es el
  // mismo que usa el sitio web de Yahoo, y en la práctica suele estar
  // a segundos del precio real durante horario de mercado, sin una
  // garantía formal de latencia exacta. Mientras el mercado esté
  // abierto, este precio se resincroniza cada 10 segundos y el motor
  // de simulación se pausa para ese activo — el precio real manda.
  badge.title = 'Precio real de Yahoo Finance, resincronizado cada 10 segundos mientras el mercado esté abierto. Fuera de horario bursátil (noches, fines de semana), se usa el último precio real conocido y el simulador continúa el movimiento desde ahí.';
  badge.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#1e8e5a;flex-shrink:0;"></span> Datos reales de mercado · ${cantidadActualizados} activos · ${hora} <button onclick="event.stopPropagation();this.closest('#badge-datos-reales').style.display='none';" style="background:transparent;border:none;color:var(--t3,#7a8ab0);cursor:pointer;padding:2px 4px;margin-left:2px;font-size:13px;line-height:1;" title="Cerrar">✕</button>`;

  // Antes, esta notificación se creaba una vez y se quedaba fija en
  // pantalla para siempre — no existía ningún código que la ocultara
  // de nuevo. Ahora, cada vez que se muestra (o se vuelve a
  // sincronizar), se reinicia un temporizador que la oculta sola
  // pasado un tiempo razonable, sin interrumpir al estudiante si
  // sigue mirándola (se puede cerrar antes con el botón).
  if(window.__temporizadorBadgeDatosReales) clearTimeout(window.__temporizadorBadgeDatosReales);
  window.__temporizadorBadgeDatosReales = setTimeout(() => {
    const b = document.getElementById('badge-datos-reales');
    if(b) b.style.display = 'none';
  }, 12000);
}

function tickPrices() {
  if (!marketSession.open) return;

  // allAssets() reconstruye un arreglo nuevo de 150 elementos cada vez
  // que se llama (sin ningún caché) — antes se llamaba varias veces
  // dentro de este mismo ciclo, incluso una vez POR CADA posición de
  // la cartera del estudiante, multiplicando el costo real según
  // cuántas posiciones tenga. Ahora se calcula una sola vez, con un
  // mapa de búsqueda instantánea en vez de una búsqueda lineal repetida.
  const prevPrices = {};
  const todosLosActivosDelTick = allAssets();
  const mapaActivosPorClave = new Map(todosLosActivosDelTick.map(a => [a.id+'|'+a.type, a]));
  todosLosActivosDelTick.forEach(a => prevPrices[a.id] = a.currentPrice || a.price);

  // ── SERIE 1: One-factor market correlation model (CAPM-style) ──
  // A single market-wide shock affects all assets proportionally to their beta,
  // producing realistic co-movement. Each asset also has its idiosyncratic shock.
  // betaFor() maps every asset type to a market sensitivity even if no explicit beta.
  const marketZ = randn();                          // common market factor (this tick)
  const MARKET_VOL = 0.0016 * RISK_MULTIPLIER;       // market factor volatility per tick
  const betaFor = a => {
    if (typeof a.beta === 'number') return a.beta;   // stocks have explicit beta
    switch (a.type) {
      case 'bono':     return 0.25;   // bonds: low market correlation
      case 'divisa':   return 0.45;   // FX: moderate
      case 'futuro':   return 1.15;   // futures: high
      case 'derivado': return 1.30;   // derivatives: highest
      default:         return 1.0;
    }
  };
  // Occasional market-wide regime shock (affects everything at once)
  // Downward bias: crashes are more frequent and sharper than rallies (realistic fat tails)
  let marketEvent = 0;
  if (Math.random() < 0.03) {  // 3% chance per tick of a market-wide regime move
    const isCrash = Math.random() < 0.6;  // 60% of regime events are downward (bias)
    if (isCrash) {
      marketEvent = -(0.03 + Math.random() * 0.09);  // crash: -3% to -12%
    } else {
      marketEvent = (0.02 + Math.random() * 0.05);   // rally: +2% to +7%
    }
  }

  // Geometric Brownian Motion per tick — amplified for visible, risky movement
  [STOCKS, BONDS, FOREX, FUTURES, DERIVATIVES].forEach(arr => {
    arr.forEach(a => {
      // Si este activo tiene un ancla de precio real fresca (llegó de
      // Yahoo hace menos de UMBRAL_ANCLA_REAL_FRESCA_MS), el precio
      // real manda: no se le aplica ningún shock simulado este tick.
      // Solo se registra la vela para que el gráfico siga su curso —
      // el motor de simulación vuelve a tomar el control
      // automáticamente en cuanto el ancla se enfríe (mercado
      // cerrado, o la sincronización deja de encontrar datos frescos).
      if(a.__ultimoRealMs && (Date.now() - a.__ultimoRealMs) < UMBRAL_ANCLA_REAL_FRESCA_MS){
        const referenciaCambioReal = a.sessionOpenPrice != null ? a.sessionOpenPrice : a.price;
        a.change = +((a.currentPrice - referenciaCambioReal) / referenciaCambioReal * 100).toFixed(2);
        addCandle(a);
        return;
      }
      const cs    = candleSigma(a.sigma);
      const drift = (a.ret / 100) / EFFECTIVE_PERIODS;
      const beta  = betaFor(a);
      // Shock = drift + systematic (market) + idiosyncratic + market regime event
      const systematic   = beta * MARKET_VOL * marketZ;
      const idiosyncratic= cs * randn() * 0.7;        // reduced weight since market adds variance
      let shock = drift + systematic + idiosyncratic + (beta * marketEvent);
      // Idiosyncratic shock event: 3% chance of a sharp asset-specific move (downward bias)
      if (Math.random() < 0.03) {
        const dir = Math.random() < 0.58 ? -1 : 1;    // 58% downward
        shock += (0.025 + Math.random() * 0.085) * dir;
      }
      // Impacto CAUSAL de noticias: si hay una noticia activa sobre este activo, su shock
      // programado se absorbe gradualmente tick a tick (el mercado reacciona a la noticia).
      const imp = newsImpacts[a.id];
      if (imp && imp.ticks > 0) {
        shock += imp.perTick;
        imp.ticks -= 1;
        if (imp.ticks <= 0) delete newsImpacts[a.id];
      }
      const newPrice = Math.max(0.0001, (a.currentPrice || a.price) * (1 + shock));
      const dec = getDecimals(a);
      a.currentPrice = +newPrice.toFixed(dec);
      // Antes esto comparaba contra el precio base del activo (a.price,
      // fijo desde el arranque), mientras que "Variación de sesión" en
      // el detalle comparaba contra el precio de apertura de la sesión
      // actual (a.sessionOpenPrice) — dos referencias distintas que
      // podían mostrar signos opuestos al mismo tiempo en pantalla, sin
      // ninguna etiqueta que aclarara la diferencia. Ahora usan la
      // misma referencia en toda la aplicación (cinta, listas,
      // ganadores/perdedores, y el encabezado del detalle).
      const referenciaCambio = a.sessionOpenPrice != null ? a.sessionOpenPrice : a.price;
      a.change       = +((a.currentPrice - referenciaCambio) / referenciaCambio * 100).toFixed(2);
      addCandle(a);
    });
  });

  // Sync portfolio MtM — cash capital is immutable
  portfolio.forEach(pos => {
    const live = mapaActivosPorClave.get(pos.id+'|'+pos.type);
    if (live) pos.currentPrice = live.currentPrice;
  });

  renderTicker(prevPrices);

  // Corresponsal de Mercado con IA — solo cuando ocurrió un evento
  // real de todo el mercado en este tick (no en cada tick normal), y
  // solo si ya pasó el enfriamiento mínimo desde la última vez, para
  // no saturar la API con eventos que ocurren varias veces por minuto.
  if(marketEvent !== 0){
    try { dispararCorresponsalMercadoIA(marketEvent, prevPrices); } catch(e){}
  }

  if (selectedAsset) {
    const updated = mapaActivosPorClave.get(selectedAsset.id+'|'+selectedAsset.type);
    if (updated) { selectedAsset = updated; updateMarketToolbar(updated); updateTradeCalc(); drawCandlestickChart(updated); }
  }
  updateNavCapital();
  checkMarginCall();   // evalúa liquidación forzada por apalancamiento tras el movimiento de precios
  checkPendingOrders(); // evalúa órdenes límite/stop-loss pendientes
  try { renderWatchlist(); } catch(e) {}
  const resPage = document.getElementById('page-resultados');
  if (resPage && resPage.classList.contains('active')) renderResults();
  const portPage = document.getElementById('page-cartera');
  if (portPage && portPage.classList.contains('active')) renderPortfolio(true);
  const anPage = document.getElementById('page-analisis');
  if (anPage && anPage.classList.contains('active')) { try { renderAnalysisGrid(); } catch(e){} }
  const newsPage = document.getElementById('page-noticias');
  if (newsPage && newsPage.classList.contains('active')) { try { renderNewsCenter(); } catch(e){} }
  autosave();
  verificarAlertasPrecio();
}

// Box-Muller transform: standard normal random variable
function randn() {
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function updateSessionBadge() {
  const badge = document.getElementById('mkt-session-badge');
  const dot   = document.getElementById('mkt-session-dot');
  const lbl   = document.getElementById('mkt-session-label');
  const timer = document.getElementById('mkt-session-timer');
  const btn   = document.getElementById('mkt-session-btn');
  const btnLbl= document.getElementById('mkt-session-btn-label');
  const btnIco= document.getElementById('mkt-session-btn-icon');
  const dotTop= document.getElementById('topbar-mkt-dot');
  if (!badge) return;

  if (marketSession.open) {
    const remaining = Math.max(0, marketSession.closeTime - Date.now());
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    badge.className  = 'session-open';
    dot.className    = 'dot-open';
    lbl.textContent  = 'MERCADO ABIERTO';
    timer.textContent= ` ${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    if(btn){ btn.style.background='rgba(255,71,87,.14)';btn.style.color='var(--red)';btn.style.borderColor='rgba(255,71,87,.3)'; }
    if(btnLbl) btnLbl.textContent='Cerrar mercado';
    if(btnIco) btnIco.className='ti ti-player-stop';
    if(dotTop){ dotTop.style.background='var(--green)'; dotTop.style.boxShadow='0 0 5px var(--green)'; dotTop.title='Mercado abierto — los precios se mueven en vivo'; }
    if (remaining <= 0) closeMarket();
  } else {
    badge.className  = 'session-closed';
    dot.className    = 'dot-closed';
    lbl.textContent  = 'MERCADO CERRADO';
    timer.textContent= '';
    if(btn){ btn.style.background='rgba(0,208,132,.12)';btn.style.color='var(--green)';btn.style.borderColor='rgba(0,208,132,.3)'; }
    if(btnLbl) btnLbl.textContent='Abrir mercado';
    if(btnIco) btnIco.className='ti ti-player-play';
    if(dotTop){ dotTop.style.background='var(--t3)'; dotTop.style.boxShadow='none'; dotTop.title='Mercado cerrado — los precios no se mueven en vivo, pero sí puedes operar'; }
  }
}

function openMarket() {
  if (marketSession.open) return;
  marketSession.open      = true;
  marketSession.openTime  = Date.now();
  marketSession.closeTime = Date.now() + SESSION_DURATION_MS;
  // Snapshot opening price for each asset — base reference for the session
  allAssets().forEach(a => { a.sessionOpenPrice = a.currentPrice || a.price; });
  // Log this session start
  marketSessionLog.push({ openedAt: new Date().toLocaleString('es-PA'), closedAt: null, durationMs: SESSION_DURATION_MS });
  // Tick timer: price update every 5 seconds (TICK_MS)
  marketSession.tickTimer  = setInterval(tickPrices, TICK_MS);
  // Clock timer: update badge every second
  marketSession.clockTimer = setInterval(updateSessionBadge, 1000);
  // News timer: generate 1-2 news items every 60 seconds
  marketSession.newsTimer  = setInterval(generatePeriodicNews, 60000);
  // SERIE 2 — Income timer: pay dividends & coupons every 90 seconds
  marketSession.incomeTimer = setInterval(payPassiveIncome, 90000);

  updateSessionBadge();

  // ── OPENING BELL: fire 4 news items immediately ──
  generateOpeningNews();

  notify('Sesión de mercado abierta — 4 horas · Precios actualizando en tiempo real ✓');
}

function closeMarket() {
  if (!marketSession.open) return;
  marketSession.open = false;
  newsImpacts = {};   // limpia impactos de noticias pendientes
  pendingOrders = []; // las órdenes pendientes expiran al cerrar la sesión
  if (marketSession.tickTimer)  clearInterval(marketSession.tickTimer);
  if (marketSession.clockTimer) clearInterval(marketSession.clockTimer);
  if (marketSession.newsTimer)  clearInterval(marketSession.newsTimer);
  if (marketSession.incomeTimer)clearInterval(marketSession.incomeTimer);
  marketSession.tickTimer  = null;
  marketSession.clockTimer = null;
  marketSession.newsTimer  = null;
  marketSession.incomeTimer= null;
  // Complete the session log entry
  const last = marketSessionLog[marketSessionLog.length - 1];
  if (last && !last.closedAt) {
    last.closedAt    = new Date().toLocaleString('es-PA');
    last.durationMs  = Date.now() - marketSession.openTime;
    last.txCount     = txHistory.length;
  }
  updateSessionBadge();
  autosave();
  // Freeze closing prices as the definitive position
  portfolio.forEach(pos => {
    const live = allAssets().find(a => a.id === pos.id && a.type === pos.type);
    if (live) pos.currentPrice = live.currentPrice;
  });
  // ── CLOSING BELL news ──
  generateClosingNews();
  notify('🔔 Sesión de mercado cerrada — posiciones de cierre registradas');
  renderPortfolio();
}

function toggleMarketSession() {
  if (marketSession.open) closeMarket(); else openMarket();
}

// Legacy alias — called from initApp but no longer needed for auto-start
function resetCountdown() { updateSessionBadge(); }
function manualFluctuate(){ /* removed — session engine handles all ticks */ }

// ── CANDLESTICK RENDERER ──
function drawCandlestickChart(asset) {
  if (!asset) return;
  if (!candleHistory[asset.id]) initCandles(asset);
  const candles = candleHistory[asset.id];
  if (!candles || candles.length < 2) return;

  const canvas = document.getElementById('candle-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight;
  // Guard: if the canvas is hidden (zero size), retry on next frame instead of drawing blank.
  // Only retry while the market page is active, to avoid an infinite loop on hidden pages.
  if (W === 0 || H === 0) {
    const mktActive = document.getElementById('page-mercado')?.classList.contains('active');
    if (mktActive) requestAnimationFrame(() => drawCandlestickChart(asset));
    return;
  }
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 60, r: 12, t: 14, b: 24 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;
  const n   = candles.length;

  const prices = candles.flatMap(c => [c.h, c.l]);
  const minP   = Math.min(...prices);
  const maxP   = Math.max(...prices);
  const range  = maxP - minP || maxP * 0.01;
  const padded = range * 0.1;
  const lo = minP - padded;
  const hi = maxP + padded;
  const toY = p => pad.t + cH * (1 - (p - lo) / (hi - lo));
  const toX = i => pad.l + (cW / n) * (i + 0.5);
  const bodyW = Math.max(1.5, (cW / n) * 0.65);

  // Background fill
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, W, H);

  // Background grid — teal-tinted like TradingView
  ctx.strokeStyle = 'rgba(0,196,255,0.06)';
  ctx.lineWidth   = 1;
  const gridCols = 10;
  const gridRows = 6;
  for (let gi = 0; gi <= gridRows; gi++) {
    const y = pad.t + (cH / gridRows) * gi;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  }
  for (let gi = 0; gi <= gridCols; gi++) {
    const x = pad.l + (cW / gridCols) * gi;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
  }

  // Y-axis price labels
  ctx.fillStyle = '#6580b0';
  ctx.font      = '9px DM Mono';
  ctx.textAlign = 'right';
  for (let gi = 0; gi <= gridRows; gi++) {
    const y     = pad.t + (cH / gridRows) * gi;
    const price = hi - (hi - lo) / gridRows * gi;
    ctx.fillText(formatPrice(price, asset), pad.l - 4, y + 3);
  }

  // X-axis labels (every ~10 candles)
  ctx.fillStyle = '#6580b0';
  ctx.textAlign = 'center';
  ctx.font = '9px DM Mono';
  for (let i = 0; i < n; i += Math.floor(n / 6)) {
    const ago = n - i;
    const label = ago === 0 ? 'Ahora' : `-${ago * 15}m`;
    ctx.fillText(label, toX(i), H - pad.b + 12);
  }

  // Draw candles
  candles.forEach((c, i) => {
    const x      = toX(i);
    const isUp   = c.c >= c.o;
    const color  = isUp ? '#00d084' : '#ff4757';
    const wickColor = isUp ? 'rgba(0,208,132,.7)' : 'rgba(255,71,87,.7)';

    // Wick (high-low)
    ctx.strokeStyle = wickColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(c.h));
    ctx.lineTo(x, toY(c.l));
    ctx.stroke();

    // Body (open-close)
    const bodyTop = toY(Math.max(c.o, c.c));
    const bodyBot = toY(Math.min(c.o, c.c));
    const bodyH   = Math.max(1.5, bodyBot - bodyTop);
    ctx.fillStyle  = color;
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
  });

  // Price line (last close)
  const lastClose = candles[candles.length - 1].c;
  const ly = toY(lastClose);
  ctx.strokeStyle = 'rgba(0,196,255,.5)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(W - pad.r, ly); ctx.stroke();
  ctx.setLineDash([]);

  // Price tag at right edge
  ctx.fillStyle    = '#00c4ff';
  ctx.textAlign    = 'right';
  ctx.font         = 'bold 10px DM Mono';
  ctx.fillText(formatPrice(lastClose, asset), W - pad.r, ly - 3);

  // Geometría guardada para el crosshair — se recalcula igual en cada
  // movimiento del mouse, sin tener que rehacer todo drawCandlestickChart
  // solo para saber a qué vela corresponde una posición X del cursor.
  window.__candleLayout = { asset, candles, pad, cW, cH, W, H, lo, hi, n, toX, toY, bodyW };

  // Actualiza la cabecera O/H/L/C — por defecto muestra la vela más
  // reciente; con el cursor sobre el gráfico, muestra la vela bajo el
  // mouse en su lugar (ver dibujarCrosshairVela más abajo).
  actualizarHudVela(candles[candles.length - 1], candles[0], asset);

  configurarInteraccionCandlestick();
}

// Cabecera O/H/L/C/Var — reutilizable para la vela más reciente (por
// defecto) o la vela bajo el cursor (al pasar el mouse sobre el
// gráfico). "primera" siempre es la primera vela de la sesión, para
// que la variación mostrada sea siempre "desde el inicio de la
// sesión hasta la vela indicada", consistente sin importar cuál vela
// se esté mirando.
function actualizarHudVela(vela, primera, asset){
  const pctChg = ((vela.c - primera.c) / primera.c * 100).toFixed(2);
  const pctColor = vela.c >= primera.c ? 'var(--green)' : 'var(--red)';
  const hud = document.getElementById('candle-hud');
  if (!hud) return;
  hud.innerHTML = `
    <div class="chud-item"><div class="chud-lbl">O</div><div class="chud-val">${formatPrice(vela.o,asset)}</div></div>
    <div class="chud-item"><div class="chud-lbl">H</div><div class="chud-val" style="color:var(--green)">${formatPrice(vela.h,asset)}</div></div>
    <div class="chud-item"><div class="chud-lbl">L</div><div class="chud-val" style="color:var(--red)">${formatPrice(vela.l,asset)}</div></div>
    <div class="chud-item"><div class="chud-lbl">C</div><div class="chud-val">${formatPrice(vela.c,asset)}</div></div>
    <div class="chud-item"><div class="chud-lbl">Var.</div><div class="chud-val" style="color:${pctColor}">${vela.c>=primera.c?'+':''}${pctChg}%</div></div>`;
}

// Crosshair interactivo — antes el gráfico de velas era completamente
// estático, sin ninguna forma de ver el valor exacto de una vela
// específica sin adivinar por posición en la pantalla. Ahora, al
// pasar el mouse, se dibuja una cruz punteada en la vela más cercana
// al cursor y la cabecera muestra sus valores exactos — el mismo
// patrón que cualquier gráfico de trading real (TradingView, la app
// de cualquier broker).
let __candlestickListenersListos = false;
function configurarInteraccionCandlestick(){
  if (__candlestickListenersListos) return; // no duplicar listeners en cada redibujado
  const canvas = document.getElementById('candle-canvas');
  if (!canvas) return;
  __candlestickListenersListos = true;

  let cuadroPendiente = null;

  canvas.addEventListener('mousemove', (e) => {
    if (cuadroPendiente) return; // ya hay un redibujado pedido para el siguiente frame
    cuadroPendiente = requestAnimationFrame(() => {
      cuadroPendiente = null;
      const layout = window.__candleLayout;
      if (!layout) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Índice de la vela más cercana a la posición X del cursor.
      const idx = Math.max(0, Math.min(layout.n - 1, Math.round((mouseX - layout.pad.l) / (layout.cW / layout.n) - 0.5)));
      const vela = layout.candles[idx];
      if (!vela) return;

      dibujarCandlestickBase(layout);
      dibujarCrosshairVela(layout, idx, vela);
      actualizarHudVela(vela, layout.candles[0], layout.asset);
    });
  });

  canvas.addEventListener('mouseleave', () => {
    const layout = window.__candleLayout;
    if (!layout) return;
    dibujarCandlestickBase(layout);
    actualizarHudVela(layout.candles[layout.candles.length - 1], layout.candles[0], layout.asset);
  });
}

// Redibuja el gráfico completo desde la geometría ya calculada, sin
// recalcular nada — usado para "limpiar" el crosshair anterior antes
// de dibujar el nuevo, en cada movimiento del mouse.
function dibujarCandlestickBase(layout){
  drawCandlestickChart(layout.asset);
}

// Dibuja la cruz punteada (línea vertical + horizontal) sobre la vela
// bajo el cursor, más un resaltado sutil de esa vela específica.
function dibujarCrosshairVela(layout, idx, vela){
  const canvas = document.getElementById('candle-canvas');
  const ctx = canvas.getContext('2d');
  const x = layout.toX(idx);
  const yClose = layout.toY(vela.c);

  ctx.save();
  ctx.strokeStyle = 'rgba(122,138,176,.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  // Línea vertical, a todo lo alto del área de velas
  ctx.beginPath();
  ctx.moveTo(x, layout.pad.t);
  ctx.lineTo(x, layout.H - layout.pad.b);
  ctx.stroke();
  // Línea horizontal, a la altura del cierre de la vela bajo el cursor
  ctx.beginPath();
  ctx.moveTo(layout.pad.l, yClose);
  ctx.lineTo(layout.W - layout.pad.r, yClose);
  ctx.stroke();
  ctx.setLineDash([]);

  // Resaltado sutil de la vela bajo el cursor
  ctx.fillStyle = 'rgba(122,138,176,.12)';
  ctx.fillRect(x - layout.bodyW, layout.pad.t, layout.bodyW * 2, layout.cH);
  ctx.restore();
}

function formatPrice(p, asset) {
  if (!asset) return p.toFixed(2);
  if (asset.type === 'divisa' && asset.price > 100) return Math.round(p).toLocaleString('es-PA');
  if (asset.price < 10) return p.toFixed(4);
  return p.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── UPDATE MARKET TOOLBAR (called on fluctuation) ──
function updateMarketToolbar(asset) {
  const p   = asset.currentPrice || asset.price;
  const chg = asset.change || 0;
  document.getElementById('mkt-price').textContent = asset.type === 'divisa' && p > 100 ? '$' + Math.round(p).toLocaleString('es-PA') : (p > 10 ? '$' + p.toFixed(2) : '$' + p.toFixed(4));
  document.getElementById('mkt-price').style.display = '';
  document.getElementById('mkt-change').textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
  document.getElementById('mkt-change').style.display = '';
  document.getElementById('mkt-change').className = 'mt-change ' + (chg >= 0 ? 'g' : 'r');

  // Fully refresh the KPI grid so every live value updates each tick
  const kpis = document.getElementById('mkt-kpis');
  if (kpis && selectedAsset && selectedAsset.id === asset.id) {
    const sharpe = computeSharpe(asset);
    const openP  = asset.sessionOpenPrice != null ? asset.sessionOpenPrice : asset.price;
    const sessionChg = openP > 0 ? ((p - openP) / openP * 100) : 0;
    const hv = computeHistVaR(asset, 0.95);
    const esPrecioEnVivo = asset.__ultimoRealMs && (Date.now() - asset.__ultimoRealMs) < UMBRAL_ANCLA_REAL_FRESCA_MS;
    kpis.innerHTML = [
      ['Precio apertura sesión', '$' + fmt(openP), ''],
      [esPrecioEnVivo?'Precio actual (en vivo)':'Precio actual (simulado)', '$' + fmt(p), chg >= 0 ? 'g' : 'r'],
      ['Variación de sesión', (sessionChg >= 0 ? '+' : '') + sessionChg.toFixed(2) + '%', sessionChg >= 0 ? 'g' : 'r'],
      ['Retorno esperado anual', asset.ret.toFixed(1) + '%', 'g'],
      ['Riesgo σ anual', asset.sigma.toFixed(1) + '%', 'a'],
      ['Ratio Sharpe', sharpe.toFixed(2), sharpe > 0.5 ? 'g' : sharpe > 0 ? 'a' : 'r'],
      ['VaR 95% (' + hv.method + ')', hv.pct.toFixed(1) + '%', 'r'],
      [asset.type === 'accion' ? 'Beta (riesgo sist.)' : asset.type === 'bono' ? 'Cupón anual' : 'Volatilidad anual',
       asset.type === 'accion' ? (asset.beta||0).toFixed(2) : asset.type === 'bono' ? (asset.coupon||0).toFixed(2) + '%' : asset.sigma.toFixed(1) + '%', ''],
    ].map(([l, v, c], i) => `<div class="detail-kpi${i===1||i===2?' dk-primary':''}"><div class="dk-label">${conAyuda(l)}</div><div class="dk-val mono ${c}">${v}</div></div>`).join('');
    // Flash the live price KPI
    const liveKpi = kpis.children[1]?.querySelector('.dk-val');
    if (liveKpi) { liveKpi.classList.remove('price-flash-up','price-flash-dn'); void liveKpi.offsetWidth; liveKpi.classList.add(chg >= 0 ? 'price-flash-up' : 'price-flash-dn'); }
  }
}

// ── LIVE TICKER ──
function renderTicker(prevPrices) {
  const assets = allAssets().slice(0, 20);
  const makeItems = () => assets.map(a => {
    const p   = a.currentPrice || a.price;
    const chg = a.change || 0;
    const prev = prevPrices ? prevPrices[a.id] : null;
    const flashClass = prev && p > prev ? 'up' : prev && p < prev ? 'dn' : '';
    const priceStr = a.type === 'divisa' && a.price > 100 ? Math.round(p).toLocaleString('es-PA') : p.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: a.price < 10 ? 4 : 2 });
    return `<div class="ticker-item"><span class="t-sym">${a.ticker}</span><span class="t-px ${flashClass}">${priceStr}</span><span class="${chg >= 0 ? 'up' : 'dn'}">${chg >= 0 ? '▲' : '▼'}${Math.abs(chg).toFixed(2)}%</span></div>`;
  }).join('');

  const scroll = document.getElementById('ticker-scroll');
  if (scroll) {
    const items = makeItems();
    scroll.innerHTML = items + items; // duplicate for seamless loop
  }
}

// ── UPDATED updateNavCapital: show total value (cash + portfolio) with P&L color ──
function updateNavCapital() {
  const portVal      = portfolio.reduce((s, p) => s + (p.currentPrice || p.buyPrice) * p.qty, 0);
  const totalInvested= portfolio.reduce((s, p) => s + p.invested, 0);
  const pnl          = portVal - totalInvested;
  // Registro REAL de la evolución del patrimonio (capital disponible + valor de cartera).
  // Se muestrea durante la sesión abierta; sustituye la antigua proyección retroactiva ficticia.
  if (marketSession && marketSession.open) {
    navHistory.push({ t: Date.now(), value: +(capital + portVal).toFixed(2), invested: +totalInvested.toFixed(2) });
    if (navHistory.length > 600) navHistory.shift();   // limita memoria (~50 min a 5s/tick)
  }
  const el = document.getElementById('nav-capital');
  const pill = el ? el.closest('.cap-pill') : null;

  if (el) {
    // Primary: available cash (changes immediately on every buy/sell)
    // SERIE 5: can be negative (margin/leverage) — show with sign
    el.textContent = (capital < 0 ? '-' : '') + fmt(capital);
    el.style.color = capital < 0 ? 'var(--red)' : '';
  }

  // Secondary: portfolio P&L indicator next to capital
  let secondEl = document.getElementById('nav-pnl-badge');
  if (!secondEl && pill) {
    secondEl = document.createElement('span');
    secondEl.id = 'nav-pnl-badge';
    secondEl.style.cssText = 'font-size:10px;font-family:var(--font-mono);padding:2px 7px;border-radius:4px;margin-left:4px;';
    pill.appendChild(secondEl);
  }
  if (secondEl) {
    if (portfolio.length === 0) {
      secondEl.textContent = '';
      secondEl.style.display = 'none';
    } else {
      secondEl.style.display = 'inline';
      if (pnl > 0) {
        secondEl.textContent = '▲ +$' + fmt(pnl);
        secondEl.style.color = 'var(--green)';
        secondEl.style.background = 'rgba(0,208,132,.1)';
      } else if (pnl < 0) {
        secondEl.textContent = '▼ -$' + fmt(Math.abs(pnl));
        secondEl.style.color = 'var(--red)';
        secondEl.style.background = 'rgba(255,71,87,.1)';
      } else {
        secondEl.textContent = '● $' + fmt(portVal);
        secondEl.style.color = 'var(--t2)';
        secondEl.style.background = 'rgba(255,255,255,.05)';
      }
    }
  }

  // Color the pill border/text based on portfolio P&L
  if (pill) {
    if (pnl > 0)      { pill.style.borderColor='rgba(0,208,132,.35)'; pill.style.color='var(--green)'; }
    else if (pnl < 0) { pill.style.borderColor='rgba(255,71,87,.3)';  pill.style.color='var(--red)';   }
    else              { pill.style.borderColor=''; pill.style.color=''; }
  }
}

// ═══════════════════ PERSISTENCIA (localStorage) ═══════════════════
// Con sesiones múltiples, cada sesión de clase tiene su propio progreso
// guardado por separado (para no mezclar el trading de una clase con otra).
// Sin sesión activa (invitado o sin iniciar sesión), usa una clave fija local.
function storageKey(){
  return 'capitallab_v1_' + (typeof currentUser!=='undefined' && currentUser && currentUser.sesion_id ? currentUser.sesion_id : 'local');
}

function saveProgress() {
  try {
    const state = {
      capital,
      labCapital,
      portfolio,
      txHistory,
      labHistory,
      navHistory,
      pendingOrders,
      marketSessionLog,
      savedPortfolios,
      newsFeed,
      labConfig,
      labPickedIds,
      diarioTrading,
      metaPersonal,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(), JSON.stringify(state));
    // Flash the save indicator
    const dot = document.getElementById('save-dot');
    if (dot) { dot.classList.add('flash'); setTimeout(()=>dot.classList.remove('flash'), 1800); }
    sincronizarProgresoNube();
  } catch(e) {
    console.warn('No se pudo guardar en localStorage:', e.message);
  }
}

// ══════════════════════════════════════════════════
// SINCRONIZACIÓN CON LA NUBE — respaldo del progreso + vista en vivo del docente
// ══════════════════════════════════════════════════
// No sustituye a localStorage (que sigue siendo la fuente de verdad local),
// solo manda una copia a Supabase para que el Modo Profesor pueda mostrar
// el avance de cada estudiante sin depender de exportar/importar archivos.
// Cada estudiante conserva su propio mercado simulado (no se unifica el
// precio entre estudiantes en esta fase); lo que se sincroniza es SU
// resultado: efectivo, valor total, retorno y cantidad de operaciones.
let _ultimoSyncNube = 0;
let _ultimaLongitudTxSincronizada = 0;
let _ultimoPuntoHistorial = 0;

// Guarda un punto de la evolución del valor de cartera, con un límite propio
// de una vez cada 3 minutos (no hace falta un punto por cada operación,
// alcanza con ver la tendencia general a lo largo de la sesión).
async function registrarPuntoHistorialCartera(valorTotal, retornoPct){
  if(!sb || !currentUser || !currentUser.usuario_id || !currentUser.sesion_id) return;
  const ahora = Date.now();
  if(ahora - _ultimoPuntoHistorial < 180000) return; // 3 minutos
  _ultimoPuntoHistorial = ahora;
  try {
    const { data: fila } = await sb.from('portafolios').select('valor_historial')
      .eq('usuario_id', currentUser.usuario_id).eq('sesion_id', currentUser.sesion_id).maybeSingle();
    const historialActual = (fila && Array.isArray(fila.valor_historial)) ? fila.valor_historial : [];
    const nuevoPunto = { fecha: new Date().toISOString(), valor: Math.round(valorTotal*100)/100, retorno: Math.round(retornoPct*100)/100 };
    const actualizado = [...historialActual, nuevoPunto].slice(-60); // últimos 60 puntos
    await sb.from('portafolios').update({ valor_historial: actualizado })
      .eq('usuario_id', currentUser.usuario_id).eq('sesion_id', currentUser.sesion_id);

    // Además del historial reciente de 60 puntos (para el gráfico de
    // evolución dentro de Mi Cartera), se guarda también un punto
    // durable del día en portafolios_historial — esa tabla nunca
    // recorta datos viejos, así que sostiene el seguimiento de
    // crecimiento de largo plazo para los informes, sin depender de
    // que el estudiante siga activo o vuelva a entrar el mismo día.
    capturarHistorialCartera(valorTotal, retornoPct);
  } catch(e){
    console.warn('No se pudo registrar el punto de historial de cartera:', e.message);
  }
}

function sincronizarProgresoNube(forzar){
  if(!sb || !currentUser || !currentUser.usuario_id || !currentUser.sesion_id || guestMode) return;
  const ahora = Date.now();
  if(!forzar && ahora - _ultimoSyncNube < 4000) return; // no más de una vez cada 4s, salvo forzado
  _ultimoSyncNube = ahora;

  try {
    // Registrar como operaciones (log de actividad) solo las transacciones nuevas
    // desde la última sincronización. txHistory usa unshift, así que las más
    // recientes están al principio del arreglo.
    const nuevas = txHistory.length - _ultimaLongitudTxSincronizada;
    if(nuevas > 0 && nuevas <= txHistory.length){
      const registros = txHistory.slice(0, nuevas).map(tx => ({
        usuario_id: currentUser.usuario_id,
        sesion_id: currentUser.sesion_id,
        simbolo: tx.name || '—',
        tipo: tx.action === 'Compra' ? 'compra' : 'venta',
        cantidad: tx.qty || 0,
        precio_ejecucion: tx.price || 0,
      }));
      sb.from('operaciones').insert(registros).then(({error})=>{
        if(error) console.warn('No se pudo registrar la operación en la nube:', error.message);
      });
    }
    _ultimaLongitudTxSincronizada = txHistory.length;

    // Foto del estado actual de la cartera (efectivo + valor de posiciones a precio actual)
    const valorPosiciones = portfolio.reduce((s,p)=>s+((p.currentPrice||p.buyPrice||0)*p.qty), 0);
    const valorTotal = capital + valorPosiciones;
    const retornoPct = ((valorTotal - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    // Historial de sesiones de Laboratorio (versión resumida, sin los arreglos
    // muy pesados como la lista completa de activos elegidos por id).
    const labResumen = (labHistory||[]).slice(0, 20).map(h => ({
      date: h.date, strat: h.strat, perfil: h.perfil, months: h.months,
      init: h.init, finalVal: h.finalVal, achieved: h.achieved, target: h.target,
      passed: h.passed, sharpe: h.sharpe, sigma: h.sigma, picked: h.picked,
    }));
    if(labResumen.some(h=>h.passed)) desbloquearLogro('meta_laboratorio');

    sb.from('portafolios').upsert({
      usuario_id: currentUser.usuario_id,
      sesion_id: currentUser.sesion_id,
      efectivo_disponible: capital,
      valor_total: valorTotal,
      retorno_pct: retornoPct,
      num_operaciones: txHistory.length,
      ultima_actividad: new Date().toISOString(),
      lab_historial: labResumen,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'usuario_id,sesion_id' }).then(({error})=>{
      if(error) console.warn('No se pudo sincronizar la cartera con la nube:', error.message);
      else { registrarPuntoHistorialCartera(valorTotal, retornoPct); verificarLogrosTrading(); }
    });
  } catch(e){
    console.warn('Sincronización con la nube omitida:', e.message);
  }
}

function loadProgress() {
  try {
    let raw = localStorage.getItem(storageKey());
    if (!raw) {
      // Migración desde la versión anterior (una sola clave global, sin
      // sesiones múltiples): si existe, se copia una vez a la clave nueva.
      const legacy = localStorage.getItem('capitallab_v1');
      if (legacy) { raw = legacy; localStorage.setItem(storageKey(), legacy); }
    }
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (typeof state.capital === 'number')    capital          = state.capital;
    if (typeof state.labCapital === 'number') labCapital       = state.labCapital;
    if (Array.isArray(state.portfolio))       portfolio        = state.portfolio;
    if (Array.isArray(state.txHistory))       txHistory        = state.txHistory;
    if (Array.isArray(state.labHistory))      labHistory       = state.labHistory;
    if (Array.isArray(state.navHistory))      navHistory       = state.navHistory;
    if (Array.isArray(state.pendingOrders))   pendingOrders    = state.pendingOrders;
    if (Array.isArray(state.marketSessionLog))marketSessionLog = state.marketSessionLog;
    if (Array.isArray(state.savedPortfolios)) savedPortfolios  = state.savedPortfolios;
    if (Array.isArray(state.newsFeed))        newsFeed         = state.newsFeed;
    if (state.labConfig)                      labConfig        = {...labConfig, ...state.labConfig};
    if (Array.isArray(state.labPickedIds))    labPickedIds     = state.labPickedIds;
    if (Array.isArray(state.diarioTrading))   diarioTrading    = state.diarioTrading;
    if (state.metaPersonal)                   metaPersonal     = state.metaPersonal;
    return true;
  } catch(e) {
    console.warn('No se pudo cargar progreso:', e.message);
    return false;
  }
}

function exportProgress() {
  try {
    const state = {
      capital, labCapital, portfolio, txHistory, labHistory,
      marketSessionLog, labConfig, labPickedIds,
      exportedAt: new Date().toLocaleString('es-PA'),
      version: 'CapitalLab v1',
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `CapitalLab progreso ${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Progreso exportado correctamente ✓');
  } catch(e) {
    notify('Error al exportar: '+e.message,'error');
  }
}

// ══════════════════════════════════════════════════
// SERIE 6: EXPORT TRANSACTIONS TO CSV
// ══════════════════════════════════════════════════
function exportTransactionsCSV() {
  // Cupones y dividendos son ingresos pasivos recurrentes que no
  // aportan al objetivo de un libro de operaciones (compras y
  // ventas reales) — se excluyen de la exportación, aunque sí se
  // pueden seguir viendo dentro de la app, en Mi Cartera, con su
  // propio interruptor para mostrarlos u ocultarlos a gusto.
  const operacionesReales = txHistory.filter(t=>t.action==='Compra'||t.action==='Venta');
  if (operacionesReales.length === 0) {
    notify('No hay operaciones de compra o venta para exportar','error');
    return;
  }
  const headers = ['Hora','Operación','Activo','Tipo','Cantidad','Precio ejecución','Valor bruto','Comisión','Efecto neto sobre capital'];
  const rows = operacionesReales.map(t => {
    const fee = t.fee || 0;
    // Efecto neto: compra = −(bruto+comisión); venta/ingreso = +(bruto−comisión)
    const effect = t.action === 'Compra' ? -(t.total + fee) : (t.total - fee);
    return [
      '"'+t.date+'"',
      t.action,
      '"'+t.name+'"',
      t.type || '—',
      (t.qty === '' || t.qty == null) ? '—' : t.qty,
      t.price > 0 ? t.price.toFixed(2) : '—',
      t.total.toFixed(2),
      fee > 0 ? fee.toFixed(2) : '0.00',
      (effect >= 0 ? '+' : '') + effect.toFixed(2),
    ].join(',');
  });
  // Summary footer — coherente con lo que realmente se exportó
  // arriba: solo compras y ventas, sin cupones ni dividendos.
  const compras  = operacionesReales.filter(t=>t.action==='Compra').length;
  const ventas   = operacionesReales.filter(t=>t.action==='Venta').length;
  const totalFees= operacionesReales.reduce((s,t)=>s+(t.fee||0),0);
  const csv = [
    'CapitalLab — Libro de Operaciones',
    'Exportado:,'+new Date().toLocaleString('es-PA'),
    'Total operaciones:,'+operacionesReales.length,
    'Compras:,'+compras+',Ventas:,'+ventas,
    'Costos de transacción acumulados:,'+totalFees.toFixed(2),
    '',
    headers.join(','),
    ...rows,
  ].join('\n');

  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `CapitalLab operaciones ${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  notify('Libro de operaciones exportado a CSV ✓');
}

function exportTransactionsPDF(){
  const operacionesReales = txHistory.filter(t=>t.action==='Compra'||t.action==='Venta');
  if(operacionesReales.length === 0){ notify('No hay operaciones de compra o venta para exportar', 'error'); return; }
  const compras = operacionesReales.filter(t=>t.action==='Compra').length;
  const ventas  = operacionesReales.filter(t=>t.action==='Venta').length;
  const totalFees = operacionesReales.reduce((s,t)=>s+(t.fee||0),0);
  const inner = pdfHeader('Libro de operaciones')
    + `<div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Total operaciones</div><div class="kpi-val">${operacionesReales.length}</div></div>
        <div class="kpi"><div class="kpi-lbl">Compras</div><div class="kpi-val">${compras}</div></div>
        <div class="kpi"><div class="kpi-lbl">Ventas</div><div class="kpi-val">${ventas}</div></div>
        <div class="kpi"><div class="kpi-lbl">Costos de transacción</div><div class="kpi-val">$${totalFees.toFixed(2)}</div></div>
       </div>
       <div class="section-title">Historial completo</div>
       <table><tr><th>Fecha</th><th>Operación</th><th>Activo</th><th class="right">Cantidad</th><th class="right">Precio</th><th class="right">Efecto neto</th></tr>
       ${operacionesReales.map(t=>{
         const fee = t.fee || 0;
         const effect = t.action === 'Compra' ? -(t.total+fee) : (t.total-fee);
         return `<tr><td>${t.date}</td><td><span class="badge ${t.action==='Compra'?'badge-buy':'badge-sell'}">${t.action}</span></td><td>${t.name}</td><td class="right mono">${(t.qty===''||t.qty==null)?'—':t.qty}</td><td class="right mono">${t.price>0?'$'+t.price.toFixed(2):'—'}</td><td class="right mono ${effect>=0?'g':'r'}">${effect>=0?'+':''}$${Math.abs(effect).toFixed(2)}</td></tr>`;
       }).join('')}
       </table>`
    + pdfFooter();
  openPrintWindow(inner, 'Libro de operaciones — CapitalLab');
}

function importProgress(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const state = JSON.parse(e.target.result);
      if (typeof state.capital !== 'number' || !Array.isArray(state.txHistory)) {
        notify('Archivo inválido — no corresponde a un progreso de CapitalLab','error');
        return;
      }
      capital           = state.capital;
      labCapital        = state.labCapital        ?? 50000;
      portfolio         = state.portfolio         || [];
      txHistory         = state.txHistory         || [];
      labHistory        = state.labHistory        || [];
      navHistory        = state.navHistory        || [];
      pendingOrders     = state.pendingOrders     || [];
      marketSessionLog  = state.marketSessionLog  || [];
      labConfig    = {...labConfig, ...(state.labConfig||{})};
      labPickedIds = state.labPickedIds || [];
      // Sync currentPrices after load
      portfolio.forEach(pos=>{
        const live=allAssets().find(a=>a.id===pos.id&&a.type===pos.type);
        if(live)pos.currentPrice=live.currentPrice;
      });
      saveProgress();
      updateNavCapital();
      renderLabHistory();
      renderResultsLab();
      notify('Progreso importado correctamente ✓ — '+
        (state.exportedAt?'Guardado el '+state.exportedAt:''));
    } catch(err) {
      notify('Error al leer el archivo: '+err.message,'error');
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be re-imported
  event.target.value = '';
}

function confirmReset() {
  document.getElementById('reset-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('reset-modal').classList.remove('open');
}
function resetSession() {
  closeModal();
  capital           = 50000;
  labCapital        = 50000;
  portfolio         = [];
  txHistory         = [];
  labHistory        = [];
  navHistory        = [];
  pendingOrders     = [];
  marketSessionLog  = [];
  savedPortfolios   = [];
  newsFeed          = [];
  newsImpacts       = {};
  marginCallCount   = 0;
  newsUnreadCount   = 0;
  txHistory    = [];
  labHistory   = [];
  labPickedIds = [];
  labConfig    = {capital:50000, horizon:6, target:8, started:false, startCapital:0};
  localStorage.removeItem(storageKey());
  updateNavCapital();
  renderLabHistory();
  // Reset lab UI
  const labBody = document.getElementById('lab-body');
  if (labBody) labBody.style.display = 'none';
  const labResult = document.getElementById('lab-result-card');
  if (labResult) { labResult.style.display='none'; labResult.innerHTML=''; }
  notify('Sesión reiniciada — capital restablecido a $50,000');
}

// ── Autosave hook: patch key state-mutating functions ──
// Called after every buy/sell/lab action so data is never lost
function autosave() { saveProgress(); }

// ═══════════════════ EXPORTAR PDF ═══════════════════
// ══════════════════════════════════════════════════
// MOTOR DE REPORTES PDF — estilos y utilidades compartidas
// Usadas por el PDF del estudiante (exportPDF) y los del modo profesor.
// ══════════════════════════════════════════════════
function pdfStyles(){
  // Cada regla va prefijada con .capitallab-pdf-render — sin esto, los
  // nombres de clase (.kpi, .info-box, .badge, .mono) chocarían con
  // clases que la app YA usa para su propia interfaz, y por el
  // momento en que se genera el PDF se vería la app real corrompida
  // visualmente. Con el prefijo, estas reglas solo aplican dentro del
  // contenedor oculto que arma el PDF, nunca fuera de él.
  const p = '.capitallab-pdf-render';
  return `
  ${p} { font-family: 'Inter', Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a2233 !important; background: #fff; width: 700px; padding: 20px 24px; }
  ${p} * { box-sizing: border-box; }
  /* Saltos de página forzados — antes solo se aplicaban a 4 lugares
     puntuales del código (secciones grandes completas), pero ningún
     elemento individual (una fila de tabla, una tarjeta de KPI, una
     tarjeta de sesión de Laboratorio) tenía protección contra
     cortarse a la mitad entre dos páginas del PDF — el motor
     (html2pdf, configurado con pagebreak:{mode:['css','legacy']})
     SÍ respeta estas reglas, solo faltaba declararlas. Se usan ambas
     sintaxis (con y sin guion) por compatibilidad — el motor de
     captura interno no siempre reconoce la más moderna por sí sola. */
  ${p} .kpi, ${p} tr, ${p} .info-box, ${p} .lab-card, ${p} .hdr, ${p} .footer,
  ${p} .medal, ${p} .rank-medal, ${p} .badge {
    page-break-inside: avoid; break-inside: avoid;
  }
  /* Un título de sección nunca debe quedar solo al final de una
     página, con su contenido recién empezando en la siguiente. */
  ${p} .section-title { page-break-after: avoid; break-after: avoid-page; }
  ${p} .hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #0F1420; border-radius: 8px; margin-bottom: 18px; gap: 14px; }
  ${p} .hdr-left { display: flex; align-items: center; gap: 12px; }
  ${p} .hdr-logo { width: 42px; height: 42px; border-radius: 9px; flex-shrink: 0; }
  ${p} .brand { font-size: 20pt; font-weight: 800; letter-spacing: -.5px; line-height: 1; color: #fff; }
  ${p} .brand span { color: #00C4FF; }
  ${p} .hdr-meta { text-align: right; font-size: 8pt; color: #9FB0CC; line-height: 1.6; }
  ${p} .hdr-meta b { color: #fff; font-size: 9pt; }
  ${p} .section { margin-top: 18px; margin-bottom: 8px; }
  ${p} .section-title { font-size: 11.5pt; font-weight: 700; color: #0F1420; border-left: 4px solid #00C4FF; padding-left: 8px; line-height: 1.2; margin: 18px 0 8px; }
  ${p} .section-sub { font-size: 8pt; color: #666; margin-left: 12px; margin-top: 2px; }
  ${p} .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin: 10px 0; }
  ${p} .kpi { background: #F5F7FA; border: 1px solid #E0E4ED; border-top: 3px solid #00C4FF; border-radius: 6px; padding: 9px 11px; }
  ${p} .kpi-lbl { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3px; }
  ${p} .kpi-val { font-size: 15pt; font-weight: 700; font-family: 'DM Mono', 'Courier New', monospace; color: #0F1420; line-height: 1.1; }
  ${p} table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
  ${p} th { background: #0F1420; color: #fff !important; font-weight: 600; padding: 6px 8px; text-align: left; font-size: 8pt; }
  ${p} td { padding: 5px 7px; border-bottom: 1px solid #eee; vertical-align: middle; color: #1a2233 !important; }
  ${p} tr:nth-child(even) td { background: #f9fafb; }
  ${p} .mono { font-family: 'DM Mono', 'Courier New', monospace; }
  ${p} .g { color: #00A86B !important; font-weight: 700; }
  ${p} .r { color: #E02D2D !important; font-weight: 700; }
  ${p} .a { color: #C87000 !important; font-weight: 700; }
  ${p} .right { text-align: right; }
  ${p} .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 7pt; font-weight: 700; color: #fff; }
  ${p} .rank-medal { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:8pt; font-weight:700; }
  ${p} .info-box { background: #EEF7FF; border-left: 3px solid #00C4FF; padding: 8px 11px; border-radius: 0 4px 4px 0; font-size: 8.5pt; margin: 10px 0; line-height: 1.55; color: #1a2233 !important; }
  ${p} .info-box b, ${p} .info-box strong, ${p} .info-box i, ${p} .info-box span { color: inherit !important; }
  ${p} .info-box.success { background: #EFFAF3; border-left-color: #00A86B; }
  ${p} .info-box.danger  { background: #FDF0F0; border-left-color: #E02D2D; }
  ${p} .info-box.gold  { background: #FBF6E9; border-left-color: #D4AF37; }
  ${p} .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #999; display: flex; justify-content: space-between; }
  ${p} .empty { text-align: center; padding: 14px; color: #aaa; font-size: 9pt; border: 1px dashed #ddd; border-radius: 6px; }
  /* Protección general — cualquier <b>/<span>/<div> genérico dentro
     del contenedor hereda el color del texto normal, sin importar si
     el CSS real de la app (que sigue activo en el mismo documento)
     trae su propia regla para esos mismos elementos. Las clases de
     color con más especificidad (.g/.r/.a, etc.) siguen ganando por
     encima de esto. */
  ${p} b, ${p} strong, ${p} i, ${p} em, ${p} span, ${p} div, ${p} p, ${p} li { color: inherit; }
  /* Clases que también usa exportTeacherPDF (ranking de estudiantes) —
     antes vivían en la copia separada de estilos de openPrintableDoc;
     ahora que ambos sistemas comparten uno solo, se agregan aquí. */
  ${p} .medal { font-weight: 700; }
  ${p} .rank-1 { color: #D4AF37; } ${p} .rank-2 { color: #7A8694; } ${p} .rank-3 { color: #A96A28; }
  ${p} .r-clr { color: #D32F2F !important; }
  ${p} th.r, ${p} td.r { text-align: right; }
  ${p} td.txt { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
  ${p} .badge-buy { background: #E3F6EC; color: #00875A; }
  ${p} .badge-sell { background: #EEF2FF; color: #2962FF; }
  ${p} .badge-liq { background: #FDEAEA; color: #D32F2F; }
  /* Clases que usa exportPDF (Reporte de Progreso — posiciones,
     transacciones y tarjetas de sesiones de Laboratorio) — antes
     vivían en su propia copia completa y aislada de estilos (un
     tercer sistema paralelo); ahora comparte este mismo. */
  ${p} .lab-card { border: 1px solid #E0E4ED; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; break-inside: avoid; }
  ${p} .lab-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  ${p} .lab-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 700; flex-shrink: 0; }
  ${p} .lab-strat { font-size: 10pt; font-weight: 700; flex: 1; color: #1a2233 !important; }
  ${p} .lab-meta { font-size: 7.5pt; color: #666 !important; }
  ${p} .lab-kpis { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; margin-bottom: 8px; }
  ${p} .lab-kpi { background: #F5F7FA; border-radius: 4px; padding: 5px 7px; }
  ${p} .lab-kpi .lbl { font-size: 7pt; color: #777 !important; margin-bottom: 1px; }
  ${p} .lab-kpi .val { font-size: 9pt; font-weight: 700; font-family: 'DM Mono', 'Courier New', monospace; color: #1a2233 !important; }
  ${p} .alloc-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  ${p} .alloc-item { font-size: 7.5pt; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  ${p} .asset-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  ${p} .asset-chip { font-size: 7pt; padding: 2px 7px; border-radius: 10px; border: 1px solid; }
  `;
}

function pdfHeader(subtitle){
  const date = new Date().toLocaleString('es-PA');
  return `<div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="logo-capitallab.png" alt="CapitalLab">
      <div class="brand">Capital<span>Lab</span></div>
    </div>
    <div class="hdr-meta">
      <b>${subtitle}</b><br>
      Facultad de Economía / Finanzas y Banca<br>
      Universidad de Panamá<br>
      Generado: ${date}
    </div>
  </div>`;
}

function pdfFooter(){
  const dateShort = new Date().toLocaleDateString('es-PA');
  return `<div class="footer">
    <span>CapitalLab · Simulador de Mercados Financieros · Facultad de Economía / Finanzas y Banca · Universidad de Panamá</span>
    <span>Reporte generado: ${dateShort}</span>
  </div>`;
}

// ── Descarga real de PDF, sin ventana emergente ──
// Antes, exportar a PDF abría una ventana nueva y disparaba
// window.print(), dejando que la persona eligiera "Guardar como PDF"
// del propio diálogo de impresión del sistema. En computadora
// funciona razonable, pero en celular es donde realmente falla: las
// ventanas emergentes suelen bloquearse, y el diálogo de impresión
// del navegador en móvil no siempre ofrece una forma clara de
// terminar con un archivo PDF descargado — a veces ni aparece la
// opción. Ahora se genera un archivo PDF real en el propio dispositivo
// (con html2pdf.js) y se descarga directo, exactamente igual que ya
// funcionan las exportaciones a CSV — mismo comportamiento confiable
// en computadora y en celular, sin depender de ningún diálogo del
// sistema operativo.
async function descargarPDFDesdeHTML(bodyHtml, nombreArchivo){
  if(typeof html2pdf === 'undefined'){
    notify('No se pudo cargar el generador de PDF. Revisa tu conexión a internet.', 'error');
    return false;
  }
  // El motor de captura (html2canvas, usado por dentro de html2pdf.js)
  // mide mal la altura de cualquier elemento con position:fixed o
  // position:absolute — sin importar si está fuera de pantalla o con
  // z-index negativo, el PDF salía completamente en blanco (0 de
  // altura detectada). La solución que sí funciona: dejar el
  // contenedor en flujo normal del documento (sin position especial),
  // y taparlo de la vista con una capa de carga a pantalla completa
  // en su lugar — nunca se ve, pero se captura bien.
  const capa = document.createElement('div');
  capa.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0F1420;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;font-family:Inter,Arial,sans-serif;';
  capa.innerHTML = `<div class="auth-spinner" style="width:32px;height:32px;"></div><div style="font-size:13px;color:#9FB0CC;">Generando PDF…</div>`;

  const contenedor = document.createElement('div');
  contenedor.className = 'capitallab-pdf-render';
  contenedor.innerHTML = bodyHtml;

  const estilo = document.createElement('style');
  estilo.id = 'capitallab-pdf-estilos-temp';
  estilo.textContent = pdfStyles();

  document.head.appendChild(estilo);
  document.body.appendChild(contenedor);
  document.body.appendChild(capa);

  try {
    await html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: nombreArchivo.endsWith('.pdf') ? nombreArchivo : nombreArchivo + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }).from(contenedor).save();
    return true;
  } catch(e){
    notify('No se pudo generar el PDF: ' + (e.message||e), 'error');
    return false;
  } finally {
    contenedor.remove();
    estilo.remove();
    capa.remove();
  }
}

// Mantiene el mismo nombre y firma que antes (bodyHtml, title) para no
// tener que tocar cada uno de los más de 10 lugares que ya llaman a
// esta función — solo cambió cómo entrega el resultado por dentro.
// Retorna la promesa real (no solo `true` de inmediato) para que quien
// sí necesite esperar a que el PDF termine de generarse (como el
// Centro de Exportación, al encadenar varias descargas seguidas)
// pueda hacerlo con un await normal.
function openPrintWindow(bodyHtml, title){
  return descargarPDFDesdeHTML(bodyHtml, title || 'CapitalLab');
}

function exportPDF(){
  const date = new Date().toLocaleString('es-PA');
  const dateShort = new Date().toLocaleDateString('es-PA');

  // ── helpers ──
  const fmtN = n => typeof n==='number' ? Math.abs(n).toLocaleString('es-PA',{minimumFractionDigits:2,maximumFractionDigits:2}) : n;
  const fmtM = n => typeof n==='number' ? (n<0?'-$':'$')+fmtN(n) : '—';
  const pct  = n => typeof n==='number' ? (n>=0?'+':'')+n.toFixed(2)+'%' : '—';
  const clr  = n => n>=0 ? '#00a86b' : '#e02d2d';

  // ── Portfolio metrics (usando el motor coherente computePortfolioMetrics) ──
  const totalInv = portfolio.reduce((s,p)=>s+p.invested,0);
  const portVal  = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const pnl      = portVal - totalInv;
  const retPct   = totalInv>0 ? pnl/totalInv*100 : 0;
  const pmPDF    = computePortfolioMetrics(portfolio);
  const avgS     = pmPDF.wSigma;       // sigma de cartera ponderada (no promedio simple)
  const sharpe   = pmPDF.sharpe;       // Sharpe de cartera coherente

  // ── Type badge color ──
  const tc = t => t==='accion'?'#2962ff':t==='bono'?'#00a86b':t==='divisa'?'#e07b00':t==='futuro'?'#cc2200':'#0099cc';

  // ── Lab summary ──
  const labSessions = labHistory.length;
  const labPassed   = labHistory.filter(h=>h.passed).length;
  const labAvgRet   = labSessions ? labHistory.reduce((s,h)=>s+h.achieved,0)/labSessions : 0;

  // ─────────────────────────────────────────────────
  // BUILD HTML DOCUMENT
  // ─────────────────────────────────────────────────
  const inner = `
<!-- ══ RESUMEN GLOBAL ══ -->
<div class="section">
  <div class="section-title">Resumen general</div>
</div>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-lbl">Capital disponible</div>
    <div class="kpi-val" style="color:#0077cc;">$${fmtN(capital)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Valor del portafolio</div>
    <div class="kpi-val">$${fmtN(portVal)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Ganancia / Pérdida</div>
    <div class="kpi-val" style="color:${clr(pnl)};">${fmtM(pnl)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Retorno total</div>
    <div class="kpi-val" style="color:${clr(retPct)};">${pct(retPct)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Posiciones activas</div>
    <div class="kpi-val">${portfolio.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Transacciones</div>
    <div class="kpi-val">${txHistory.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Ratio Sharpe</div>
    <div class="kpi-val" style="color:${sharpe>0.5?'#00a86b':sharpe>0?'#c87000':'#e02d2d'};">${sharpe.toFixed(2)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Sesiones de lab.</div>
    <div class="kpi-val">${labSessions}</div>
  </div>
</div>

<!-- ══ POSICIONES ACTIVAS ══ -->
<div class="section">
  <div class="section-title">Posiciones activas del portafolio</div>
  <div class="section-sub">Valoración al precio actual de mercado</div>
</div>
${portfolio.length===0
  ? '<div class="empty">Sin posiciones activas registradas.</div>'
  : `<table>
    <thead>
      <tr>
        <th>Activo</th><th>Tipo</th><th>Qty</th>
        <th>P. compra</th><th>P. actual</th>
        <th>Invertido</th><th>Valor actual</th>
        <th>G/P ($)</th><th>Retorno %</th><th>σ</th>
      </tr>
    </thead>
    <tbody>
      ${portfolio.map(p=>{
        const cur=p.currentPrice||p.buyPrice;
        const gp=(cur-p.buyPrice)*p.qty;
        const r=(cur-p.buyPrice)/p.buyPrice*100;
        return`<tr>
          <td><b>${p.name}</b><br><span style="color:#888;font-size:7.5pt;">${p.ticker}</span></td>
          <td><span class="badge" style="background:${tc(p.type)};">${p.type}</span></td>
          <td class="mono">${p.qty}</td>
          <td class="mono">$${fmtN(p.buyPrice)}</td>
          <td class="mono">$${fmtN(cur)}</td>
          <td class="mono">$${fmtN(p.invested)}</td>
          <td class="mono"><b>$${fmtN(cur*p.qty)}</b></td>
          <td class="mono ${gp>=0?'g':'r'}">${fmtM(gp)}</td>
          <td class="mono ${r>=0?'g':'r'}">${pct(r)}</td>
          <td class="mono a">${p.sigma.toFixed(1)}%</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`
}

<!-- ══ HISTORIAL DE TRANSACCIONES ══ -->
<div class="section">
  <div class="section-title">Historial de compras y ventas</div>
  <div class="section-sub">${txHistory.filter(t=>t.action==='Compra'||t.action==='Venta').length} operación(es) · Compras: ${txHistory.filter(t=>t.action==='Compra').length} · Ventas: ${txHistory.filter(t=>t.action==='Venta').length}</div>
</div>
${txHistory.filter(t=>t.action==='Compra'||t.action==='Venta').length===0
  ? '<div class="empty">Sin transacciones registradas.</div>'
  : `<table>
    <thead>
      <tr>
        <th>Hora</th><th>Operación</th><th>Activo</th><th>Tipo</th>
        <th>Cantidad</th><th>Precio unitario</th><th>Total</th><th>Efecto capital</th>
      </tr>
    </thead>
    <tbody>
      ${txHistory.filter(t=>t.action==='Compra'||t.action==='Venta').map(t=>`<tr>
        <td class="mono" style="color:#888;">${t.date}</td>
        <td><span class="badge" style="background:${t.action==='Compra'?'#00a86b':'#e02d2d'};">${t.action}</span></td>
        <td><b>${t.name}</b></td>
        <td><span class="badge" style="background:${tc(t.type||'accion')};">${t.type||'—'}</span></td>
        <td class="mono">${t.qty} u.</td>
        <td class="mono">$${fmtN(t.price)}</td>
        <td class="mono"><b>$${fmtN(t.total)}</b></td>
        <td class="mono ${t.action==='Compra'?'r':'g'}">${t.action==='Compra'?'−$':'+$'}${fmtN(t.total)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}

<!-- ══ RESULTADOS DEL LABORATORIO ══ -->
<div class="section" style="margin-top:24px;">
  <div class="section-title">Resultados del Laboratorio</div>
  <div class="section-sub">${labSessions} sesión(es) · ${labPassed} meta(s) alcanzada(s) · Rentabilidad promedio: ${pct(labAvgRet)}</div>
</div>

${labSessions===0
  ? '<div class="empty">Sin sesiones de laboratorio registradas.</div>'
  : `<div class="kpi-grid" style="margin-bottom:14px;">
      <div class="kpi">
        <div class="kpi-lbl">Sesiones totales</div>
        <div class="kpi-val" style="color:#0077cc;">${labSessions}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Metas alcanzadas</div>
        <div class="kpi-val" style="color:${labPassed===labSessions?'#00a86b':'#c87000'};">${labPassed} / ${labSessions}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Rentabilidad prom.</div>
        <div class="kpi-val" style="color:${clr(labAvgRet)};">${pct(labAvgRet)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Mejor sesión</div>
        <div class="kpi-val" style="color:#00a86b;">${pct(Math.max(...labHistory.map(h=>h.achieved)))}</div>
      </div>
    </div>
    ${labHistory.map((h,i)=>{
      const n=labSessions-i;
      const calColor=h.calific==='Excelente'||h.calific==='Aprobado'?'#00a86b':h.calific==='Regular'?'#c87000':'#e02d2d';
      const allocItems=[
        h.alloc.b>0?`<span class="alloc-item" style="background:#e8f7ef;color:#00a86b;">Bonos ${h.alloc.b}%</span>`:'',
        h.alloc.a>0?`<span class="alloc-item" style="background:#e8eeff;color:#2962ff;">Acciones ${h.alloc.a}%</span>`:'',
        h.alloc.d>0?`<span class="alloc-item" style="background:#fff8e6;color:#c87000;">Divisas ${h.alloc.d}%</span>`:'',
        h.alloc.f>0?`<span class="alloc-item" style="background:#ffeaea;color:#e02d2d;">Futuros ${h.alloc.f}%</span>`:'',
        h.alloc.dv>0?`<span class="alloc-item" style="background:#e6f8ff;color:#0099cc;">Derivados ${h.alloc.dv}%</span>`:'',
      ].join('');

      // Full asset list from stored pickedIds
      const assetChips = (h.pickedIds||[]).map(id=>{
        const a=allAssets().find(x=>x.id===id);
        if(!a)return`<span class="asset-chip" style="border-color:#ccc;color:#666;">${id}</span>`;
        const c=tc(a.type);
        return`<span class="asset-chip" style="border-color:${c};color:${c};">${a.name.substring(0,24)} (${a.ticker})</span>`;
      }).join('');

      const summary = h.passed
        ? `Capital creció ${pct(h.achieved)}, superando la meta de ${h.target}%. Eficiencia de riesgo: ${h.riskEff}%. Ratio Sharpe: ${h.sharpe}.`
        : h.achieved>0
          ? `Capital creció ${pct(h.achieved)} sin alcanzar la meta de ${h.target}%. Volatilidad σ=${h.sigma}%.`
          : `Capital sufrió una pérdida de ${pct(h.achieved)}. Revisar distribución y exposición especulativa.`;

      return`<div class="lab-card">
        <div class="lab-card-header">
          <div class="lab-num" style="background:${h.passed?'#e8f7ef':'#ffeaea'};color:${calColor};border:1.5px solid ${calColor};">${n}</div>
          <div>
            <div class="lab-strat">${h.strat}</div>
            <div class="lab-meta">${h.date} · ${h.months} meses · ${h.perfil.charAt(0).toUpperCase()+h.perfil.slice(1)} · Meta: ${h.target}%</div>
          </div>
          <span class="badge" style="background:${calColor};margin-left:auto;">${h.calific}</span>
          <span style="font-size:14pt;font-weight:700;font-family:'Courier New',monospace;color:${clr(h.achieved)};">${pct(h.achieved)}</span>
        </div>
        <div class="lab-kpis">
          <div class="lab-kpi"><div class="lbl">Capital inicial</div><div class="val">$${fmtN(h.init)}</div></div>
          <div class="lab-kpi"><div class="lbl">Capital final</div><div class="val" style="color:${clr(h.achieved)};">$${fmtN(h.finalVal)}</div></div>
          <div class="lab-kpi"><div class="lbl">Ratio Sharpe</div><div class="val" style="color:${h.sharpe>0.5?'#00a86b':h.sharpe>0?'#c87000':'#e02d2d'};">${h.sharpe}</div></div>
          <div class="lab-kpi"><div class="lbl">Riesgo σ</div><div class="val" style="color:#c87000;">${h.sigma}%</div></div>
          <div class="lab-kpi"><div class="lbl">VaR 95%</div><div class="val" style="color:#e02d2d;">$${fmtN(h.var95)}</div></div>
          <div class="lab-kpi"><div class="lbl">Efic. riesgo</div><div class="val">${h.riskEff}%</div></div>
          <div class="lab-kpi"><div class="lbl">Efic. capital</div><div class="val">${h.capEff}%</div></div>
          <div class="lab-kpi"><div class="lbl">Ops. mercado</div><div class="val">${h.txCount}</div></div>
          <div class="lab-kpi"><div class="lbl">Resultado</div><div class="val" style="color:${calColor};">${h.passed?'✓ Alcanzada':'✗ No alcanzada'}</div></div>
          <div class="lab-kpi"><div class="lbl">Activos elegidos</div><div class="val">${(h.pickedIds||[]).length||'—'}</div></div>
        </div>
        ${allocItems?`<div class="alloc-row">${allocItems}</div>`:''}
        ${assetChips?`<div style="font-size:7.5pt;color:#777;margin-top:8px;margin-bottom:3px;">Activos seleccionados:</div><div class="asset-chips">${assetChips}</div>`:''}
        <div class="info-box ${h.passed?'success':h.achieved>0?'':'danger'}" style="margin-top:8px;">${summary}</div>
      </div>`;
    }).join('')}`
}

  `;

  return openPrintableDoc('Reporte de Progreso', inner);
}


const NEWS_TEMPLATES = {
  accion:{
    bull:[
      ['{n} supera estimaciones de ingresos del trimestre','Los resultados operativos de {n} ({t}) superan el consenso de analistas. El margen neto amplía +{d}% respecto al período anterior, impulsando la demanda institucional.'],
      ['{n} anuncia recompra de acciones por $2.5B','La junta directiva de {n} aprueba un programa de recompra. El mercado interpreta la señal como subvaluación implícita, favoreciendo el precio de {t}.'],
      ['Analistas elevan precio objetivo de {t}','Tres firmas de corretaje revisan al alza el precio objetivo de {n} tras resultados sólidos y perspectivas de margen expansivo.'],
      ['{n} reporta crecimiento de ingresos de {d}%','La empresa publica resultados por encima de lo proyectado, apoyado por expansión en márgenes operativos y control de gastos generales.'],
    ],
    bear:[
      ['{n} decepciona en resultados del trimestre','Los resultados de {n} ({t}) quedan por debajo del consenso. El EBIT registra contracción de {d}% frente al trimestre anterior, generando presión vendedora.'],
      ['Rebaja de perspectiva crediticia afecta a {t}','Una agencia calificadora revisa la perspectiva de {n}, citando deterioro en métricas de apalancamiento y presión sobre el flujo de caja libre.'],
      ['{n} recorta guía de crecimiento anual','La dirección de {n} ajusta los ingresos proyectados a la baja. El mercado descuenta la revisión con presión sobre el precio de {t}.'],
      ['Flujos institucionales salen de {t}','Datos de flujo muestran desinversión neta de posiciones institucionales en {n}, contribuyendo a la presión bajista en el precio.'],
    ],
  },
  bono:{
    bull:[
      ['Sólida demanda en subasta de {t}','La subasta primaria de {n} registra cobertura de 2.8x, indicando alta demanda institucional y compresión de spreads en el secundario.'],
      ['Mejora de perspectiva soberana favorece a {t}','La perspectiva crediticia del emisor de {n} es revisada a positiva, reflejando consolidación fiscal y reducción del déficit.'],
    ],
    bear:[
      ['Ampliación de spread EMBI presiona a {t}','El riesgo país del emisor de {n} amplía {d}pb en jornada, reflejando incertidumbre fiscal y menor apetito por riesgo soberano.'],
      ['Perfil de vencimientos genera presión sobre {t}','Los inversores exigen mayor prima de riesgo para renovar posiciones en {n} ante un perfil de vencimientos desfavorable.'],
    ],
  },
  divisa:{
    bull:[
      ['Datos macro fortalecen al {t}','Indicadores de actividad superiores a lo esperado fortalecen la divisa base del par {t}, reduciendo la incertidumbre sobre política monetaria.'],
      ['Banco central señaliza postura restrictiva: {t}','Declaraciones del banco central del país base sugieren mantenimiento de tasas elevadas, apoyando la apreciación del {t}.'],
    ],
    bear:[
      ['Presión inflacionaria debilita al {t}','Datos de inflación por encima del objetivo del banco central generan presión sobre el {t}, deteriorando el poder adquisitivo real.'],
      ['Déficit de cuenta corriente presiona al {t}','El ensanchamiento del déficit de cuenta corriente del país base presiona al {t}, reflejando desequilibrios en flujos comerciales.'],
    ],
  },
  futuro:{
    bull:[
      ['Ruptura técnica activa compras en {t}','El contrato {n} supera nivel de resistencia clave, activando órdenes sistemáticas. El interés abierto crece {d}%.'],
      ['Reducción de inventarios impulsa a {t}','Datos de inventarios muestran caída mayor a la esperada, reduciendo la oferta disponible y apoyando el precio del contrato {n}.'],
    ],
    bear:[
      ['Toma de ganancias en {t} tras máximos','El contrato {n} experimenta toma de ganancias tras sobrecompra técnica. El volumen vendedor supera al comprador en la sesión intradiaria.'],
      ['Incremento de márgenes reduce posiciones en {t}','La bolsa eleva el requerimiento de margen para {n}, forzando el cierre de posiciones apalancadas y presionando el precio.'],
    ],
  },
  derivado:{
    bull:[['Mayor demanda de cobertura eleva prima de {t}','El incremento de volatilidad implícita eleva la prima de {n}, reflejando mayor disposición del mercado a pagar por cobertura.']],
    bear:[['Contracción de volatilidad comprime prima de {t}','La reducción de volatilidad implícita del subyacente de {n} comprime la prima del instrumento, reduciendo el valor de la cobertura.']],
  },
};

// ═══════════════════════════════════════════════════════════════════
// CORRESPONSAL DE MERCADO CON IA — cuando ocurre un evento real que
// mueve TODO el mercado a la vez (no un activo aislado), la IA
// redacta una sola noticia coherente explicándolo, citando los
// activos realmente más afectados con su número real. Nunca se
// repite, y conecta el dato abstracto con una narrativa creíble.
// Tiene enfriamiento propio, para no saturar la API si el mercado
// tiene varios eventos seguidos en poco tiempo.
// ═══════════════════════════════════════════════════════════════════
window.__ultimoEventoMercadoIA = 0;
const ENFRIAMIENTO_EVENTO_MERCADO_MS = 90000; // 90 segundos entre eventos con IA

async function dispararCorresponsalMercadoIA(marketEvent, prevPrices){
  const ahora = Date.now();
  if(ahora - window.__ultimoEventoMercadoIA < ENFRIAMIENTO_EVENTO_MERCADO_MS) return;
  window.__ultimoEventoMercadoIA = ahora;

  const conMovimiento = allAssets()
    .map(a => ({ name:a.name, ticker:a.ticker, type:a.type, movePct: prevPrices[a.id] ? ((a.currentPrice-prevPrices[a.id])/prevPrices[a.id])*100 : 0 }))
    .filter(a => Number.isFinite(a.movePct) && a.movePct !== 0)
    .sort((a,b) => Math.abs(b.movePct)-Math.abs(a.movePct))
    .slice(0,3);
  if(conMovimiento.length < 2) return; // muy pocos datos para una noticia con sustancia

  const direccion = marketEvent < 0 ? 'caida' : 'repunte';
  const magnitudPct = marketEvent*100;

  try {
    const respuesta = await fetch(`${SIM_IA_URL}/functions/v1/generar-analisis-simulador`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SIM_IA_ANON_KEY,'Authorization':`Bearer ${SIM_IA_ANON_KEY}`},
      body: JSON.stringify({ modo:'evento_mercado', evento:{ direccion, magnitudPct, masAfectados:conMovimiento } }),
    });
    const d = await respuesta.json();
    if(!d.ok) throw new Error(d.error||'Error desconocido.');
    insertarNoticiaDestacada(d.titular, d.cuerpo, direccion, true);
  } catch(e){
    // Sin IA disponible — una noticia destacada básica, generada por
    // reglas fijas, para que el evento real de mercado no pase
    // desapercibido en el centro de noticias de todas formas.
    const tituloLocal = direccion==='caida'
      ? `Mercado registra caída generalizada de ${Math.abs(magnitudPct).toFixed(1)}%`
      : `Mercado registra repunte generalizado de ${magnitudPct.toFixed(1)}%`;
    const cuerpoLocal = `${conMovimiento.map(a=>`${a.name} (${a.movePct>=0?'+':''}${a.movePct.toFixed(2)}%)`).join(', ')} lideran el movimiento de este ${direccion==='caida'?'retroceso':'avance'} generalizado del mercado.`;
    insertarNoticiaDestacada(tituloLocal, cuerpoLocal, direccion, false);
  }
}

function insertarNoticiaDestacada(titular, cuerpo, direccion, esIA){
  const item = {
    id: Date.now()+Math.random(),
    time: new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    headline: titular,
    body: cuerpo,
    type: direccion==='caida' ? 'bear' : 'bull',
    ticker: '—',
    movePct: 0,
    unread: true,
    destacada: true,
    generadaConIA: esIA,
  };
  newsFeed.unshift(item);
  if(newsFeed.length>40) newsFeed.pop();
  newsUnreadCount++;
  try { renderNewsFeed(); } catch(e){}
  try { renderNewsCenter(); } catch(e){}
  try { notify(esIA ? 'Nueva noticia de mercado, redactada por IA ✓' : 'Nueva noticia de mercado', 'success'); } catch(e){}
}

function generateNewsItem(asset,movePct){
  const dir  = movePct>0?'bull':'bear';
  const pool = (NEWS_TEMPLATES[asset.type]||NEWS_TEMPLATES.accion)[dir]||[];
  if(!pool.length) return;
  const tpl  = pool[Math.floor(Math.random()*pool.length)];
  const d    = Math.abs(movePct).toFixed(2);
  const fill = s=>s.replace(/\{n\}/g,asset.name.substring(0,22)).replace(/\{t\}/g,asset.ticker).replace(/\{d\}/g,d);
  const item = {
    id:Date.now()+Math.random(),
    time:new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    headline:fill(tpl[0]),
    body:fill(tpl[1]),
    type:dir,
    ticker:asset.ticker,
    movePct,
    unread:true,
  };
  newsFeed.unshift(item);
  if(newsFeed.length>40)newsFeed.pop();
  newsUnreadCount++;
  renderNewsFeed();
}

function renderNewsFeed(){
  const list=document.getElementById('news-feed-list');
  const badge=document.getElementById('news-unread-count');
  const badgeFlotante=document.getElementById('news-unread-count-flotante');
  if(!list)return;
  [badge, badgeFlotante].forEach(b=>{
    if(!b) return;
    if(newsUnreadCount>0){b.textContent=newsUnreadCount>99?'99+':newsUnreadCount;b.style.display='inline-block';}
    else b.style.display='none';
  });
  if(newsFeed.length===0){
    list.innerHTML='<div class="news-empty"><i class="ti ti-broadcast" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3;"></i>Abre una sesión de mercado para recibir noticias en tiempo real</div>';
    return;
  }
  list.innerHTML=newsFeed.map(item=>`
    <div class="news-item ${item.type}" onclick="markNewsRead(${item.id})">
      <div class="news-time">
        <span class="news-chip ${item.type}">${item.type==='bull'?'▲':item.type==='bear'?'▼':'●'}</span>
        ${item.ticker} · ${item.time}
        ${item.unread?'<span style="width:5px;height:5px;border-radius:50%;background:var(--accent2);display:inline-block;margin-left:4px;vertical-align:middle;"></span>':''}
      </div>
      <div class="news-headline">${item.headline}</div>
      <div class="news-body">${item.body}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════════
// INTERRUPTOR DEL PANEL DE NOTICIAS — pensado por separado para
// escritorio/tablet (colapsa y recupera el espacio para el gráfico)
// y para móvil (se abre como panel deslizante bajo demanda, en vez de
// estar completamente inaccesible como antes, que solo se ocultaba
// fijo por CSS sin ninguna forma de volver a verlo salvo yendo a la
// página completa de Noticias). La preferencia de escritorio/tablet
// se recuerda entre sesiones; en móvil siempre arranca cerrado, para
// no sorprender con un panel abierto tapando la pantalla completa.
// ═══════════════════════════════════════════════════════════════════
const NEWS_PANEL_PREF_KEY = 'capitallab_news_panel_colapsada';

// ═══════════════════════════════════════════════════════════════════
// GLOSARIO CONTEXTUAL — un ícono de ayuda junto a cualquier término
// técnico (Ratio Sharpe, Beta, VaR, TIR, etc.), que muestra su
// explicación al tocar o pasar el cursor. Se aplica automáticamente
// donde sea que aparezca el término en la interfaz, sin tener que
// editar cada una de las más de veinte veces que se repiten estas
// etiquetas a lo largo del simulador.
// ═══════════════════════════════════════════════════════════════════
const GLOSARIO_TERMINOS = {
  'ratio sharpe': 'Mide cuánto retorno obtienes por cada unidad de riesgo que asumes. Se calcula como (retorno del activo − tasa libre de riesgo) / volatilidad. Un Sharpe por encima de 1 se considera bueno; por debajo de 0, el riesgo no se está viendo recompensado.',
  'sharpe promedio': 'El promedio del Ratio Sharpe de todas tus posiciones, ponderado por cuánto capital tienes en cada una. Mide qué tan eficiente es tu cartera completa en convertir riesgo en retorno.',
  'ratio de treynor': 'Similar al Ratio Sharpe, pero mide el retorno obtenido por cada unidad de riesgo sistemático (beta), en vez de la volatilidad total. Útil quando la cartera ya está bien diversificada y solo queda el riesgo de mercado.',
  'riesgo': 'La volatilidad anualizada (sigma, σ): mide cuánto se mueve el precio de un activo típicamente en un año. A mayor volatilidad, mayor incertidumbre sobre el resultado, para bien o para mal.',
  'volatilidad': 'Mide cuánto se mueve el precio de un activo típicamente, expresado como porcentaje anualizado (sigma, σ). A mayor volatilidad, mayor incertidumbre sobre el resultado, para bien o para mal.',
  'volatilidad implícita': 'La volatilidad que el mercado está "pagando" hoy por una opción, deducida de su precio actual, no calculada del historial de precios. Refleja la incertidumbre que el mercado espera hacia adelante.',
  'riesgo promedio σ': 'El promedio de la volatilidad (σ) de todas tus posiciones, ponderado por el capital invertido en cada una.',
  'var 95%': 'El Valor en Riesgo (VaR): la pérdida máxima esperada en un horizonte de tiempo, con 95% de confianza. Un VaR de -20% significa que, en 19 de cada 20 casos típicos, no perderías más del 20% del valor invertido.',
  'cvar estimado (99%)': 'El CVaR (Valor en Riesgo Condicional) va más allá del VaR: mide la pérdida promedio esperada específicamente en el peor 1% de los casos, no solo dónde empieza esa cola de riesgo.',
  'beta': 'Mide cuánto se mueve un activo en relación al mercado general. Un beta mayor a 1 significa más volatilidad que el mercado; menor a 1, menos.',
  'beta de cartera (ponderada)': 'El promedio del beta de todas tus posiciones, ponderado por cuánto capital tienes en cada una. Mide qué tan sensible es tu cartera completa a los movimientos del mercado general.',
  'rendimiento (ytm)': 'El Rendimiento al Vencimiento (Yield to Maturity): el retorno anual total que obtendrías si compras el bono hoy y lo mantienes hasta que vence, incluyendo el cupón y la diferencia entre el precio de compra y el valor nominal.',
  'riesgo país (embi)': 'El EMBI mide, en puntos base, cuánto más paga un país por endeudarse comparado con un bono del Tesoro de EE.UU. considerado libre de riesgo. A mayor EMBI, mayor percepción de riesgo de ese país.',
  'riesgo país': 'Mide cuánto más paga un país por endeudarse comparado con un bono libre de riesgo, reflejando la confianza del mercado en su estabilidad económica y política.',
  'margen inicial': 'El capital propio mínimo que debes aportar para abrir una posición apalancada. El resto lo cubre el apalancamiento (deuda), que amplifica tanto ganancias como pérdidas.',
  'nocional': 'El valor total que representa un contrato de derivado, aunque el capital realmente invertido (la prima o el margen) sea mucho menor. Es la base sobre la que se calculan las ganancias y pérdidas.',
  'tick mínimo': 'El movimiento de precio más pequeño posible en un contrato de futuro, definido por la bolsa donde se negocia.',
  'calificación crediticia': 'Una nota (como AAA, BB, o CCC) que asignan agencias como S&P o Moody\'s, midiendo qué tan probable es que un emisor de deuda pague lo que debe. AAA es la más segura; entre más baja la letra, mayor el riesgo de impago.',
  'calificación s&p': 'La nota de riesgo crediticio asignada por Standard & Poor\'s. AAA es la calificación más alta (menor riesgo de impago); las letras más bajas indican mayor riesgo.',
  'calificación': 'Una nota que mide qué tan probable es que un emisor de deuda pague lo que debe. Entre más alta, más seguro se considera.',
  'retorno esperado': 'El promedio de ganancia (o pérdida) que se espera de una inversión en un año, basado en su comportamiento histórico. No es una promesa: el resultado real de un año en particular puede ser distinto.',
  'rentabilidad': 'La ganancia o pérdida generada por una inversión, expresada como porcentaje del capital invertido.',
  'retorno': 'La ganancia o pérdida generada por una inversión, expresada como porcentaje del capital invertido.',
  'prima de riesgo (retorno − rf)': 'El retorno adicional que un activo ofrece por encima de la tasa libre de riesgo, como compensación por asumir volatilidad. A mayor prima, mayor riesgo que el mercado exige compensar.',
  'tasa libre de riesgo (rf)': 'El retorno de un activo considerado sin riesgo de impago, normalmente un bono del Tesoro de EE.UU. Sirve como punto de referencia para medir si otra inversión compensa bien su riesgo adicional.',
  'alfa vs. tasa libre de riesgo': 'Mide cuánto retorno adicional generó un activo por encima de lo que ofrecería, sin riesgo alguno, invertir en un instrumento libre de riesgo.',
  'tasa de acierto (win rate)': 'El porcentaje de tus operaciones que terminaron en ganancia, del total de operaciones cerradas. No mide cuánto ganaste o perdiste en cada una, solo cuántas veces acertaste.',
  'eficiencia de capital': 'Mide qué tan bien se está usando el capital invertido para generar retorno, comparado con dejarlo sin invertir.',
  'efic. de capital': 'Mide qué tan bien se está usando el capital invertido para generar retorno, comparado con dejarlo sin invertir.',
  'eficiencia de riesgo': 'Mide qué tan bien la cartera convierte el riesgo asumido en retorno real, similar en espíritu al Ratio Sharpe.',
  'efic. de riesgo': 'Mide qué tan bien la cartera convierte el riesgo asumido en retorno real, similar en espíritu al Ratio Sharpe.',
  'duración macaulay': 'El tiempo promedio, ponderado por los pagos que recibes, que toma recuperar el valor de un bono a través de sus cupones y su pago final. A mayor duración, más sensible es el precio del bono a cambios en las tasas de interés.',
  'duración modificada': 'Estima cuánto cambiaría el precio de un bono, en porcentaje, si la tasa de interés subiera o bajara 1 punto porcentual. Una duración modificada de 5 significa que el precio se movería aproximadamente 5% en dirección contraria a la tasa.',
  'convexidad': 'Mide qué tan curva (no lineal) es la relación entre el precio de un bono y los cambios en la tasa de interés. Una convexidad positiva es favorable: el precio sube más de lo que baja ante cambios iguales de tasa en direcciones opuestas.',
  'dv01 (valor bp)': 'Cuánto cambia el valor de una posición si la tasa de interés se mueve exactamente un punto base (0.01%). Útil para medir el riesgo de tasa en términos de dinero real, no solo porcentaje.',
  'delta (δ)': 'Mide cuánto cambia el precio de una opción por cada $1 que se mueve el precio del activo subyacente. Un delta de 0.5 significa que la opción se mueve aproximadamente $0.50 por cada $1 del activo.',
  'gamma (γ)': 'Mide qué tan rápido cambia el delta de una opción cuando se mueve el precio del activo subyacente. Un gamma alto significa que el riesgo de la posición puede cambiar rápidamente.',
  'theta (θ)': 'Mide cuánto valor pierde una opción cada día que pasa, solo por el paso del tiempo, incluso si el precio del activo no se mueve. Casi siempre es negativo para quien compra la opción.',
  'vega (ν)': 'Mide cuánto cambia el precio de una opción si la volatilidad esperada del mercado sube o baja un punto porcentual.',
  'interés abierto': 'El número total de contratos de futuros u opciones que siguen activos (sin cerrar) en el mercado en un momento dado. Un interés abierto creciente sugiere más dinero nuevo entrando a esa posición.',
  'base (futuro − spot)': 'La diferencia entre el precio de un contrato de futuro y el precio actual del activo en el mercado spot. Normalmente converge a cero a medida que se acerca el vencimiento del contrato.',
  'riesgo de crédito': 'La posibilidad de que el emisor de un bono no pague sus intereses o el valor nominal a tiempo, o no pague en absoluto.',
  'riesgo de reinversión': 'El riesgo de que, cuando recibas los pagos de un bono (cupones o el valor final), no encuentres otra inversión con un rendimiento igual de bueno para reinvertirlos.',
  'capital disponible': 'El dinero de tu cuenta que todavía no está invertido en ningún activo — lo que tienes libre para comprar en cualquier momento.',
  'capital inicial': 'El monto con el que empezaste a operar, antes de cualquier ganancia o pérdida — el punto de partida para medir tu retorno.',
  'capital actual': 'El dinero disponible en este momento, después de sumar o restar el efecto de tus operaciones hasta ahora.',
  'ganancia / pérdida': 'La diferencia entre lo que vale tu cartera ahora y lo que invertiste — en dólares, no en porcentaje. Un número positivo es ganancia; uno negativo, pérdida.',
  'ganancia estimada': 'La ganancia en dólares que tendrías si el activo se comporta como su retorno esperado histórico — una proyección, no una garantía.',
  'invertido': 'El monto de capital que de verdad pusiste en esa posición específica, sin contar comisiones ni el resultado de cómo le haya ido después.',
  'valor total': 'La suma de tu efectivo disponible más el valor actual de mercado de todo lo que tienes invertido — tu patrimonio completo en la cartera en este momento.',
  'precio actual': 'El precio de mercado del activo en este instante — cambia constantemente mientras el mercado esté abierto.',
  'valor actual': 'Lo que vale hoy esa posición al precio de mercado presente — cuánto recibirías si la vendieras ahora mismo, antes de comisiones.',
  'escenario mediano (p50)': 'El resultado que queda justo en la mitad de todas las simulaciones posibles — la mitad de los escenarios terminan mejor que este, y la otra mitad peor. Es la estimación "típica", ni optimista ni pesimista.',
  'escenario optimista (p95)': 'Un resultado que solo el 5% de las simulaciones superó — representa un escenario favorable, pero no el mejor posible; hay un 5% de probabilidad de terminar incluso mejor que esto.',
  'escenario pesimista (p5)': 'Un resultado que solo el 5% de las simulaciones terminó peor que este — representa un escenario desfavorable real a considerar, no el peor caso absoluto.',
  'prob de alcanzar meta': 'De todas las simulaciones que se corrieron, el porcentaje que terminó cumpliendo la meta de rentabilidad que se propuso — entre más alto, más realista es esperar alcanzarla con esta estrategia.',
  'prob de pérdida': 'El porcentaje de simulaciones que terminaron con menos capital del que se empezó — una medida directa de qué tan probable es perder dinero con esta cartera, no solo cuánto se podría perder.',
  'prob de ruina (≥95%)': 'El porcentaje de simulaciones donde se perdió el 95% o más del capital — un escenario de pérdida casi total, útil para saber si una estrategia tiene cola de riesgo extremo, aunque sea poco probable.',
  'p&l neto': 'La ganancia o pérdida final en dólares, después de descontar comisiones y otros costos de operar — el número real que te queda, no la ganancia "en teoría" antes de gastos.',
  'costos de transacción': 'El total de comisiones y otros cargos pagados por comprar y vender — dinero que sale de tu resultado final sin importar si la operación fue ganadora o perdedora.',
};

// Reconoce el concepto de fondo detrás de una etiqueta, aunque tenga
// variantes de redacción distintas ("Retorno esperado anual",
// "Rentabilidad prom.", "Riesgo σ prom.") — sin esta normalización,
// cada variante habría necesitado su propia entrada exacta en el
// glosario, y siempre faltaría alguna.
function normalizarTerminoGlosario(texto){
  let t = texto.trim().toLowerCase();
  // Quita calificadores comunes que no cambian el concepto de fondo,
  // uno por uno y con límites de palabra reales, para no cortar a
  // mitad de una palabra más larga (como "esperado" al buscar "esp.").
  t = t.replace(/[σ]/g, ' ');
  t = t.replace(/\(aprox\.?\)/g, ' ');
  t = t.replace(/\(anualizada\)/g, ' ');
  t = t.replace(/\(diversificado\)/g, ' ');
  t = t.replace(/\(1 año\)/g, ' ');
  t = t.replace(/\b1 año\b/g, ' ');
  t = t.replace(/\(realizado\)/g, ' ');
  t = t.replace(/\bparamétrico\b/g, ' ');
  t = t.replace(/\banual(izada)?\b/g, ' ');
  t = t.replace(/\besp\.?\b/g, ' ');
  t = t.replace(/\bprom\.?\b/g, ' ');
  t = t.replace(/\bpromedio\b/g, ' ');
  t = t.replace(/\bponderad[ao]\b/g, ' ');
  t = t.replace(/\baportad[ao]\b/g, ' ');
  t = t.replace(/\bneta?\b/g, ' ');
  t = t.replace(/\btotal\b/g, ' ');
  t = t.replace(/\bdel per[ií]odo\b/g, ' ');
  t = t.replace(/[.,]/g, ' ');
  t = t.replace(/(?<!\d)%(?!\d)/g, ' '); // el símbolo % suelto (no pegado a un número), como en "Retorno %"
  t = t.replace(/\(\s*\)/g, ' '); // paréntesis que quedan vacíos tras quitar un símbolo de arriba (ej. "Riesgo (σ)" → "Riesgo ( )")
  t = t.replace(/\s+/g, ' ').trim();
  // Sinónimos frecuentes hacia la clave canónica del glosario
  const sinonimos = { 'rendimiento esperado':'retorno esperado' };
  return sinonimos[t] || t;
}

// Envuelve una etiqueta técnica con su ícono de ayuda directamente al
// generarla — para los paneles de indicadores y tablas de resultados
// que usan <span> y <td> con estilo en línea, en vez de las clases
// .metric-label/.profile-key que sí cubre el escaneo automático de
// aplicarAyudaTerminos(). Sin esto, "Ratio Sharpe" y otros términos no
// aparecían con su explicación en los lugares donde más se consultan:
// el panel de Indicadores clave y la tabla de resultados de un activo.
function conAyuda(texto){
  const clave = normalizarTerminoGlosario(texto);
  const explicacion = GLOSARIO_TERMINOS[clave];
  if(!explicacion) return texto;
  return `${texto}<i class="ti ti-info-circle icono-ayuda-termino" data-explicacion="${explicacion.replace(/"/g,'&quot;')}" style="font-size:11px;margin-left:4px;color:var(--t3);cursor:pointer;vertical-align:middle;"></i>`;
}

function iniciarAyudaTerminos(){
  if(window.__ayudaTerminosIniciada) return;
  window.__ayudaTerminosIniciada = true;
  document.body.addEventListener('click', (e) => {
    const icono = e.target.closest('.icono-ayuda-termino');
    document.querySelectorAll('.popover-ayuda-termino').forEach(p => p.remove());
    if(!icono) return;
    e.stopPropagation();
    const explicacion = icono.dataset.explicacion;
    const pop = document.createElement('div');
    pop.className = 'popover-ayuda-termino';
    pop.textContent = explicacion;
    document.body.appendChild(pop);
    const r = icono.getBoundingClientRect();
    const anchoMax = 260;
    let izquierda = Math.min(r.left, window.innerWidth - anchoMax - 12);
    izquierda = Math.max(8, izquierda);
    pop.style.cssText = `position:fixed;top:${r.bottom+6}px;left:${izquierda}px;max-width:${anchoMax}px;`;
  });
  // Cada nuevo render de la interfaz puede traer etiquetas nuevas sin
  // ícono todavía — se revisa periódicamente, es barato (solo texto,
  // sin recalcular nada financiero) y así nunca hace falta tocar cada
  // punto donde se dibuja una etiqueta técnica en el simulador.
  setInterval(aplicarAyudaTerminos, 4000);
}

function aplicarAyudaTerminos(){
  document.querySelectorAll('.metric-label, .profile-key, th.con-ayuda, .kpi-lbl, .lbl, .stat-label, .kpi-label').forEach(el => {
    if(el.dataset.ayudaAplicada) return;
    const clave = normalizarTerminoGlosario(el.textContent);
    const explicacion = GLOSARIO_TERMINOS[clave];
    if(!explicacion) { el.dataset.ayudaAplicada='1'; return; }
    el.dataset.ayudaAplicada = '1';
    const icono = document.createElement('i');
    icono.className = 'ti ti-info-circle icono-ayuda-termino';
    icono.dataset.explicacion = explicacion;
    icono.style.cssText = 'font-size:11px;margin-left:4px;color:var(--t3);cursor:pointer;vertical-align:middle;';
    el.appendChild(icono);
  });
}

// El ícono de ayuda se creaba en más de 15 lugares distintos
// (aplicarAyudaTerminos + conAyuda), pero nada escuchaba el clic para
// mostrar la explicación — el ícono aparecía, pero no hacía nada al
// tocarlo. Un solo manejador delegado en document cubre TODOS los
// íconos, sin importar cuándo o dónde se hayan creado, incluidos los
// que se generan después de este punto en el tiempo.
document.addEventListener('click', (e) => {
  const icono = e.target.closest('.icono-ayuda-termino');
  document.querySelectorAll('.popover-ayuda-termino').forEach(p => p.remove());
  if(!icono) return;
  e.stopPropagation();
  const popover = document.createElement('div');
  popover.className = 'popover-ayuda-termino';
  popover.textContent = icono.dataset.explicacion;
  popover.style.cssText = `
    position:fixed; max-width:280px; background:var(--c2, #161b26); color:var(--t1, #e8edf8);
    border:1px solid var(--accent2, #4a9eff); border-radius:8px; padding:10px 12px;
    font-size:12px; line-height:1.5; z-index:9999; box-shadow:0 8px 24px rgba(0,0,0,.4);
  `;
  document.body.appendChild(popover);
  const rectIcono = icono.getBoundingClientRect();
  const rectPopover = popover.getBoundingClientRect();
  // Se ajusta para nunca salirse de la pantalla — clave en móvil,
  // donde el ícono puede estar cerca del borde derecho.
  let left = Math.min(rectIcono.left, window.innerWidth - rectPopover.width - 12);
  left = Math.max(12, left);
  let top = rectIcono.bottom + 6;
  if(top + rectPopover.height > window.innerHeight - 12) top = rectIcono.top - rectPopover.height - 6;
  popover.style.left = left + 'px';
  popover.style.top = top + 'px';
});

function alternarPanelNoticias(){
  const esMovil = window.innerWidth <= 768;
  const contenedor = document.getElementById('market-with-news');
  const panel = document.getElementById('market-news-panel');
  const overlay = document.getElementById('news-panel-overlay-movil');

  if(esMovil){
    const abierta = panel.classList.toggle('news-movil-abierta');
    if(overlay) overlay.classList.toggle('activo', abierta);
  } else {
    const colapsada = contenedor.classList.toggle('news-colapsada');
    try { localStorage.setItem(NEWS_PANEL_PREF_KEY, colapsada ? '1' : '0'); } catch(e){}
    // Red de seguridad contra un fallo de repintado real de Chrome:
    // animar el ancho de la columna del grid mientras el cuerpo de
    // Mercado tiene su propio desplazamiento puede dejar una franja
    // sin repintar (se ve como una zona negra) hasta que algo fuerce
    // a Chrome a recalcular. Se fuerza un reflow real justo cuando
    // termina la animación (250ms), sin esperar a que el estudiante
    // tenga que redimensionar la ventana para que se corrija solo.
    setTimeout(() => {
      const body = document.querySelector('.market-body');
      if(body){ body.style.display='none'; void body.offsetHeight; body.style.display=''; }
    }, 260);
  }
}

// Cierre forzado y completo del panel de noticias — limpia el estado
// de móvil Y de escritorio a la vez, sin importar en cuál se quedó
// atascado. Se usa cada vez que el ancho de la pantalla cambia, para
// que un fondo oscuro nunca pueda quedar cubriendo la pantalla si el
// dispositivo gira o la ventana cambia de tamaño mientras el panel
// estaba abierto (eso era exactamente lo que se veía como una
// "pantalla en negro" que bloqueaba el desplazamiento).
function cerrarPanelNoticiasPorCompleto(){
  const panel = document.getElementById('market-news-panel');
  const overlay = document.getElementById('news-panel-overlay-movil');
  if(panel) panel.classList.remove('news-movil-abierta');
  if(overlay) overlay.classList.remove('activo');
}

function restaurarPreferenciaPanelNoticias(){
  if(window.innerWidth <= 768) return; // en móvil siempre arranca cerrado
  let colapsada = false;
  try { colapsada = localStorage.getItem(NEWS_PANEL_PREF_KEY) === '1'; } catch(e){}
  if(colapsada){
    const contenedor = document.getElementById('market-with-news');
    if(contenedor) contenedor.classList.add('news-colapsada');
  }
}

// Si la ventana cambia de tamaño (girar el dispositivo, cambiar entre
// modo tablet y escritorio, o cualquier redimensión), se cierra el
// panel móvil por completo — así nunca queda un fondo oscuro atascado
// bloqueando la pantalla, sin importar en qué momento se cruce el
// punto de quiebre entre el modo móvil y el modo escritorio.
let __resizeTimeoutPanelNoticias = null;
window.addEventListener('resize', () => {
  clearTimeout(__resizeTimeoutPanelNoticias);
  __resizeTimeoutPanelNoticias = setTimeout(cerrarPanelNoticiasPorCompleto, 150);
});

// Re-dibuja los gráficos de Cartera si cambia la densidad de píxeles
// real del dispositivo (window.devicePixelRatio) — esto pasa al mover
// la ventana entre monitores de distinta resolución (ej. de un
// externo 1x a un laptop 2x). Sin este recálculo, el usuario tendría
// que recargar la página para que los gráficos vuelvan a verse
// nítidos tras el cambio. Antes esto vigilaba breakpoints de un
// zoom de CSS que ya no existe (ver nota en simulador-estilos.css);
// ahora vigila el DPR real, que es lo que dprEfectivo() en
// simulador-motor.js realmente necesita.
let __dprAnterior = window.devicePixelRatio || 1;
let __resizeTimeoutChartsCartera = null;
window.addEventListener('resize', () => {
  clearTimeout(__resizeTimeoutChartsCartera);
  __resizeTimeoutChartsCartera = setTimeout(() => {
    const dprActual = window.devicePixelRatio || 1;
    if (dprActual !== __dprAnterior) {
      __dprAnterior = dprActual;
      if (typeof renderPortfolio === 'function' && document.getElementById('port-evolution')) {
        renderPortfolio(false);
      }
    }
  }, 200);
});


function markNewsRead(id){
  const item=newsFeed.find(n=>n.id===id);
  if(item&&item.unread){item.unread=false;newsUnreadCount=Math.max(0,newsUnreadCount-1);renderNewsFeed();}
}

// ══════════════════════════════════════════════════
// CENTRO DE NOTICIAS — página dedicada estilo portal financiero
// ══════════════════════════════════════════════════
let newsCategory='all';

// Resuelve la categoría de una noticia a partir de su ticker (busca el activo).
function newsCategoryOf(item){
  if(!item.ticker || item.ticker==='—') return 'general';
  const a=allAssets().find(x=>x.ticker===item.ticker);
  return a ? a.type : 'general';
}

const CAT_LABELS={accion:'Acciones',bono:'Bonos',divisa:'Divisas',futuro:'Futuros',derivado:'Derivados',general:'General'};

function setNewsCategory(cat,btn){
  newsCategory=cat;
  document.querySelectorAll('.news-class-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderNewsCenter();
}

function renderNewsCenter(){
  const el=document.getElementById('news-center');
  if(!el)return;
  const items = newsFeed.filter(item=>{
    if(newsCategory==='all') return true;
    return newsCategoryOf(item)===newsCategory;
  });
  if(items.length===0){
    el.innerHTML=`<div class="news-empty"><i class="ti ti-broadcast" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4;"></i>${
      newsFeed.length===0
        ? 'Abre una sesión de mercado para recibir noticias en tiempo real.'
        : 'No hay noticias en esta categoría todavía. Las noticias se generan durante la sesión de mercado.'
    }</div>`;
    return;
  }
  el.innerHTML=items.map(item=>{
    const cat=newsCategoryOf(item);
    const typeLabel=item.type==='bull'?'Alcista':item.type==='bear'?'Bajista':'Neutral';
    if(item.destacada){
      // Noticia de un evento real de todo el mercado — se ve distinta
      // a propósito, con un borde propio y la marca de IA si aplica,
      // para que se note que es un evento genuino, no una más del feed.
      return `<div class="news-art ${item.type}" style="border-left:4px solid ${item.type==='bull'?'#1e8e5a':'#ff4757'};background:linear-gradient(90deg, ${item.type==='bull'?'rgba(30,142,90,.08)':'rgba(255,71,87,.08)'}, transparent);">
        <div class="news-art-meta">
          <span class="news-art-tag ${item.type}"><i class="ti ti-broadcast" style="font-size:10px;"></i> Evento de mercado</span>
          ${item.generadaConIA ? `<span style="font-size:9.5px;color:var(--gold, #e8b94a);display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-sparkles" style="font-size:10px;"></i> Redactado por IA</span>` : ''}
          <span class="news-art-time">${item.time}</span>
        </div>
        <div class="news-art-headline" style="font-size:14.5px;">${item.headline}</div>
        <div class="news-art-body">${item.body}</div>
      </div>`;
    }
    return `<div class="news-art ${item.type}">
      <div class="news-art-meta">
        <span class="news-art-tag ${item.type}">${typeLabel}</span>
        ${item.ticker&&item.ticker!=='—'?`<span class="news-art-ticker">${item.ticker}</span>`:''}
        <span class="news-art-cat">${CAT_LABELS[cat]||'General'}</span>
        <span class="news-art-time">${item.time}</span>
      </div>
      <div class="news-art-headline">${item.headline}</div>
      <div class="news-art-body">${item.body}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════
// SERIE 4: HISTORICAL VaR — uses real candle returns from the session
// Falls back to parametric VaR if insufficient history.
// ══════════════════════════════════════════════════
function computeHistVaR(asset, confidence){
  confidence = confidence || 0.95;
  const candles = candleHistory[asset.id];
  if (!candles || candles.length < 10) {
    // Respaldo: VaR paramétrico anual (σ anual × z al 95%).
    return { pct: asset.sigma * 1.645, method: 'paramétrico (anual)' };
  }
  // Retornos por vela (cada vela representa un período intradía del gráfico).
  const returns = [];
  for (let i = 1; i < candles.length; i++) {
    const r = (candles[i].c - candles[i-1].c) / candles[i-1].c;
    returns.push(r);
  }
  if (returns.length < 5) return { pct: asset.sigma * 1.645, method: 'paramétrico (anual)' };
  // VaR histórico INTRADÍA: percentil de pérdida (cola izquierda) de los retornos por vela
  // observados en la sesión. NO se anualiza: mide la pérdida potencial en el horizonte de
  // una vela al nivel de confianza dado, que es lo que realmente captura el simulador.
  // Anualizarlo distorsionaría la lectura al multiplicar por la volatilidad amplificada.
  returns.sort((a,b)=>a-b);
  const idx = Math.floor((1 - confidence) * returns.length);
  const varReturnPerCandle = Math.abs(returns[Math.max(0, idx)]) * 100;
  return { pct: varReturnPerCandle, method: 'histórico (sesión)' };
}
// Credited to cash capital periodically based on held positions.
// Devengo de ingresos pasivos coherente con el tiempo de mercado.
// Una sesión de 4 h representa 1 día bursátil. El ciclo de pago es cada 90 s reales.
// El rendimiento ANUAL se devenga por día (÷ TRADING_DAYS_YEAR) y de ese día se acredita
// la fracción correspondiente a los 90 s del ciclo respecto a la sesión completa.
// Se aplica un FACTOR PEDAGÓGICO de aceleración para que el ingreso sea perceptible en
// una sesión de clase sin distorsionar la proporción relativa entre dividendos y cupones.
//   Sin aceleración, una sesión completa (~160 ciclos) acreditaría ~1 día de devengo,
//   imperceptible. El factor comprime el devengo anual para que una sesión equivalga
//   aproximadamente a un trimestre de rendimiento, manteniéndose proporcional y auditable.
const INCOME_CYCLE_MS   = 90000;
const INCOME_DAY_FRAC   = INCOME_CYCLE_MS / SESSION_DURATION_MS;        // fracción del día por ciclo (≈1/160)
const INCOME_PEDAGOGIC  = 63;                                          // factor de aceleración pedagógica
// Devengo por ciclo: (tasa_anual / días_año) × fracción_de_sesión × factor_pedagógico.
// Con el factor, una sesión completa ≈ ¼ del rendimiento anual (un trimestre), perceptible.
const INCOME_ACCRUAL    = (1 / TRADING_DAYS_YEAR) * INCOME_DAY_FRAC * INCOME_PEDAGOGIC;
// ══════════════════════════════════════════════════
function payPassiveIncome(){
  if (!marketSession.open || portfolio.length === 0) return;
  let totalIncome = 0;
  const details = [];

  portfolio.forEach(pos => {
    const asset = allAssets().find(a => a.id === pos.id && a.type === pos.type);
    if (!asset) return;
    let income = 0;
    if (pos.type === 'accion' && asset.dividend > 0) {
      // Dividendo anual por acción × fracción de año devengada en este ciclo.
      income = (asset.dividend * INCOME_ACCRUAL) * pos.qty;
    } else if (pos.type === 'bono' && asset.coupon > 0) {
      // Cupón sobre VALOR NOMINAL (no sobre el precio de mercado pagado).
      // Convención: valor facial = price de referencia del bono (par). Devengo proporcional.
      const faceValue = (asset.price || pos.buyPrice) * pos.qty;
      income = (asset.coupon / 100) * INCOME_ACCRUAL * faceValue;
    }
    if (income > 0.0001) {
      totalIncome += income;
      details.push({ name: asset.name, ticker: asset.ticker, type: pos.type, income });
    }
  });

  if (totalIncome > 0.001) {
    capital += totalIncome;   // credited to cash — does not touch positions
    // Register each income payment as a transaction
    details.forEach(d => {
      txHistory.unshift({
        date:   new Date().toLocaleTimeString('es-PA'),
        action: d.type === 'bono' ? 'Cupón' : 'Dividendo',
        name:   d.name,
        type:   d.type,
        qty:    '—',
        price:  0,
        total:  +d.income.toFixed(2),
      });
    });
    updateNavCapital();
    autosave();
    // News item announcing the income
    const now = new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    newsFeed.unshift({
      id: Date.now()+Math.random(), time: now,
      headline: `💰 Ingreso pasivo acreditado: +$${fmt(totalIncome)}`,
      body: `Su cartera recibió $${fmt(totalIncome)} en dividendos y cupones de ${details.length} posición(es). El monto fue acreditado al capital disponible.`,
      type: 'bull', ticker: '—', movePct: 0, unread: true,
    });
    newsUnreadCount++;
    if (newsFeed.length > 40) newsFeed.pop();
    renderNewsFeed();
    notify(`Ingreso pasivo: +$${fmt(totalIncome)} (dividendos y cupones) ✓`);
  }
}

// ── OPENING BELL: 4 staggered news items when market opens ──
function generateOpeningNews(){
  const now = new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const sessionNum = marketSessionLog.length;

  // Immediate opening bell item
  const bellItems = [
    {headline:`🔔 Apertura de sesión de mercado N.° ${sessionNum}`,
     body:`El mercado CapitalLab abre operaciones. Se encuentran disponibles ${allAssets().length} activos en 5 clases: renta variable, renta fija, divisas FX, futuros y derivados OTC. Los precios se actualizan en tiempo real cada 5 segundos.`,
     type:'neutral'},
    {headline:`Análisis pre-apertura: perspectiva de la sesión`,
     body:`Los mercados globales abren con liquidez normal. Los inversores monitorean el comportamiento de los índices de referencia y los spreads soberanos ante el inicio de operaciones de la jornada.`,
     type:'neutral'},
  ];

  // Add 2 random asset-based opening news with slight delay
  const picks = allAssets().sort(()=>Math.random()-0.5).slice(0,4);
  const openingAssetNews = [
    {a:picks[0], headline:`${picks[0].name} (${picks[0].ticker}) inicia sesión en $${(picks[0].currentPrice||picks[0].price).toFixed(2)}`,
     body:`El activo inicia la sesión con variación acumulada de ${picks[0].change||0}% respecto al precio de referencia. Retorno esperado del período: ${picks[0].ret.toFixed(1)}%.`,
     type: (picks[0].change||0)>=0?'bull':'bear'},
    {a:picks[1], headline:`${picks[1].name} (${picks[1].ticker}) — apertura bajo seguimiento`,
     body:`${picks[1].name} abre con precio de mercado de $${(picks[1].currentPrice||picks[1].price).toFixed(2)} y volatilidad σ=${picks[1].sigma.toFixed(1)}%. El instrumento está disponible para operaciones de compra y venta.`,
     type:'neutral'},
  ];

  // Push bell items first
  bellItems.forEach((item,i)=>{
    setTimeout(()=>{
      newsFeed.unshift({id:Date.now()+Math.random(),time:now,headline:item.headline,body:item.body,type:item.type,ticker:'—',movePct:0,unread:true});
      newsUnreadCount++;
      if(newsFeed.length>40)newsFeed.pop();
      renderNewsFeed();
    }, i*400);
  });
  // Push asset-based news with additional delay
  openingAssetNews.forEach((item,i)=>{
    setTimeout(()=>{
      newsFeed.unshift({id:Date.now()+Math.random(),time:now,headline:item.headline,body:item.body,type:item.type,ticker:item.a.ticker,movePct:0,unread:true});
      newsUnreadCount++;
      if(newsFeed.length>40)newsFeed.pop();
      renderNewsFeed();
    }, 1000 + i*500);
  });
}

// ── PERIODIC NEWS: 1-2 items every 60 seconds during session ──
function generatePeriodicNews(){
  if(!marketSession.open) return;
  // Selecciona 1-2 activos al azar y genera noticias CAUSALES: cada noticia programa
  // un shock de precio que se absorberá gradualmente en los próximos ticks (efecto realista,
  // el mercado reacciona a la noticia en lugar de que la noticia solo describa lo ya ocurrido).
  const numItems = Math.random()<0.4?2:1;
  const picks = allAssets().sort(()=>Math.random()-0.5).slice(0,numItems);
  picks.forEach(a=>{
    // Dirección del titular: sesgo según la tendencia de sesión + componente aleatorio.
    const trend = a.change || 0;
    // Magnitud del impacto: noticia significativa mueve el precio. Escala por volatilidad
    // del activo para que activos más volátiles reaccionen más fuerte (coherente con el motor).
    const baseMove = (0.5 + Math.random()*2.0) * (a.sigma/20);   // % de movimiento objetivo
    const dir = (Math.random() < (trend>=0?0.58:0.42)) ? 1 : -1; // leve momentum + ruido
    const targetMove = baseMove * dir;
    // Programa el impacto: se reparte en 4-7 ticks para una absorción gradual y natural.
    const nTicks = 4 + Math.floor(Math.random()*4);
    const perTick = (targetMove/100) / nTicks;
    newsImpacts[a.id] = { perTick, ticks: nTicks };
    // El titular refleja la dirección del impacto que va a causar.
    generateNewsItem(a, targetMove);
  });
}

// ── CLOSING BELL: summary news when market closes ──
function generateClosingNews(){
  const now = new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const gainers = allAssets().filter(a=>(a.change||0)>0).length;
  const losers  = allAssets().filter(a=>(a.change||0)<0).length;
  const portPnl = portfolio.reduce((s,p)=>s+(((p.currentPrice||p.buyPrice)-p.buyPrice)*p.qty),0);

  const items = [
    {headline:`🔔 Cierre de sesión de mercado — Resumen de jornada`,
     body:`La sesión cierra con ${gainers} activos al alza y ${losers} activos a la baja de un total de ${allAssets().length} instrumentos disponibles. ${txHistory.length} operaciones ejecutadas en la sesión.`,
     type:'neutral'},
    {headline:`Resumen de portafolio al cierre`,
     body:`Su portafolio cierra la sesión con un resultado ${portPnl>=0?'positivo':'negativo'} de ${portPnl>=0?'+$':'-$'}${fmt(Math.abs(portPnl))}. Los precios de cierre quedan registrados como posición final de la sesión.`,
     type: portPnl>=0?'bull':'bear'},
  ];
  items.forEach((item,i)=>{
    setTimeout(()=>{
      newsFeed.unshift({id:Date.now()+Math.random(),time:now,headline:item.headline,body:item.body,type:item.type,ticker:'—',movePct:0,unread:true});
      newsUnreadCount++;
      if(newsFeed.length>40)newsFeed.pop();
      renderNewsFeed();
    }, i*300);
  });
}

// ══════════════════════════════════════════════════
// MULTIPLE PORTFOLIOS — MAX 3 SAVED STRATEGIES
// ══════════════════════════════════════════════════
const P_COLORS=['#2962ff','#00d084','#ffb400'];
const P_NAMES=['Estrategia A','Estrategia B','Estrategia C'];

function saveCurrentPortfolio(){
  if(portfolio.length===0&&txHistory.length===0){notify('Sin posiciones ni transacciones para guardar','error');return;}
  if(savedPortfolios.length>=3){notify('Máximo 3 estrategias. Elimina una para continuar.','error');return;}
  const idx=savedPortfolios.length;
  const tI=portfolio.reduce((s,p)=>s+p.invested,0);
  const cV=portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const pnl=cV-tI;
  const rPct=tI>0?(pnl/tI*100):0;
  const sg=portfolio.length?portfolio.reduce((s,p)=>s+p.sigma,0)/portfolio.length:0;
  const sp=sg>0?(rPct-RF)/sg:0;
  savedPortfolios.push({
    name:P_NAMES[idx],color:P_COLORS[idx],capital,
    portfolio:JSON.parse(JSON.stringify(portfolio)),
    txHistory:JSON.parse(JSON.stringify(txHistory)),
    savedAt:new Date().toLocaleString('es-PA'),
    totalInv:tI,portVal:cV,pnl,retPct:rPct,sigma:sg,sharpe:sp,
    txCount:txHistory.length,
  });
  autosave();
  renderPortfolioTabs();
  renderPortfolioCompare();
  notify(`Guardada como "${P_NAMES[idx]}" ✓`);
}

function deletePortfolio(idx){
  savedPortfolios.splice(idx,1);
  savedPortfolios.forEach((p,i)=>{p.name=P_NAMES[i];p.color=P_COLORS[i];});
  if(activePortfolioIdx>=savedPortfolios.length)activePortfolioIdx=-1;
  autosave();
  renderPortfolioTabs();
  renderPortfolioCompare();
  notify('Estrategia eliminada');
}

function renderPortfolioTabs(){
  const el=document.getElementById('port-tabs');
  if(!el)return;
  if(savedPortfolios.length===0){el.innerHTML='';return;}
  el.innerHTML=`
    <button class="port-tab ${activePortfolioIdx===-1?'active':''}" onclick="switchPortfolio(-1)">
      <i class="ti ti-chart-area" style="color:var(--accent2);font-size:13px;"></i> Sesión actual
    </button>
    ${savedPortfolios.map((p,i)=>`
      <button class="port-tab ${activePortfolioIdx===i?'active':''}" onclick="switchPortfolio(${i})" style="${activePortfolioIdx===i?'border-color:'+p.color+';':''}" >
        <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>
        ${p.name}
        <span onclick="event.stopPropagation();deletePortfolio(${i})" title="Eliminar" style="margin-left:2px;color:var(--t3);font-size:16px;line-height:1;cursor:pointer;">×</span>
      </button>`).join('')}`;
}

function switchPortfolio(idx){
  activePortfolioIdx=idx;
  renderPortfolioTabs();
  renderPortfolio();
  if(idx>=0)notify(`Mostrando "${savedPortfolios[idx].name}" · Guardada el ${savedPortfolios[idx].savedAt}`);
}

// Menú de "Más herramientas" en Cartera — junta ocho botones que antes
// vivían sueltos en el encabezado (Expandir tarjetas, Resumen, Asesor,
// Replay, Diario, Meta, Comparador) en un solo lugar, para no saturar la
// pantalla, sobre todo en el celular donde diez botones seguidos
// obligaban a un scroll horizontal o varias filas antes de ver la
// cartera de verdad.
function alternarMenuHerramientasCartera(evento){
  evento.stopPropagation();
  const menu = document.getElementById('menu-herramientas-cartera');
  const abrir = menu.style.display === 'none';
  menu.style.display = abrir ? 'block' : 'none';
  if(abrir){
    const cerrarAlTocarFuera = (e) => {
      if(!menu.contains(e.target)){ menu.style.display = 'none'; document.removeEventListener('click', cerrarAlTocarFuera); }
    };
    setTimeout(()=>document.addEventListener('click', cerrarAlTocarFuera), 10);
  }
}
function cerrarMenuHerramientasCartera(){
  const menu = document.getElementById('menu-herramientas-cartera');
  if(menu) menu.style.display = 'none';
}

// Mismo patrón que el menú de Cartera, ahora también en Inicio — antes
// había seis botones sueltos justo antes del contenido real de la
// cartera, lo primero que se veía al entrar a la aplicación.
function alternarMenuHerramientasInicio(evento){
  evento.stopPropagation();
  const menu = document.getElementById('menu-herramientas-inicio');
  const abrir = menu.style.display === 'none';
  menu.style.display = abrir ? 'block' : 'none';
  if(abrir){
    const cerrarAlTocarFuera = (e) => {
      if(!menu.contains(e.target)){ menu.style.display = 'none'; document.removeEventListener('click', cerrarAlTocarFuera); }
    };
    setTimeout(()=>document.addEventListener('click', cerrarAlTocarFuera), 10);
  }
}
function cerrarMenuHerramientasInicio(){
  const menu = document.getElementById('menu-herramientas-inicio');
  if(menu) menu.style.display = 'none';
}

function togglePortfolioCompare(){
  const sec=document.getElementById('port-compare-section');
  if(!sec)return;
  if(savedPortfolios.length===0){notify('Guarda al menos una estrategia para comparar','error');return;}
  const vis=sec.style.display!=='none';
  sec.style.display=vis?'none':'block';
  if(!vis)renderPortfolioCompare();
  const btn=document.getElementById('compare-btn');
  if(btn)btn.style.background=vis?'':'rgba(41,98,255,.15)';
}

function renderPortfolioCompare(){
  const el=document.getElementById('port-compare-grid');
  if(!el)return;
  const tI=portfolio.reduce((s,p)=>s+p.invested,0);
  const cV=portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const rC=(tI>0?(cV-tI)/tI*100:0);
  const sC=(portfolio.length?portfolio.reduce((s,p)=>s+p.sigma,0)/portfolio.length:0);
  const shC=sC>0?(rC-RF)/sC:0;
  const all=[{
    name:'Sesión actual',color:'var(--accent2)',capital,
    portVal:cV,totalInv:tI,pnl:cV-tI,retPct:rC,sigma:sC,sharpe:shC,
    txCount:txHistory.length,savedAt:'En curso',
  },...savedPortfolios];
  el.innerHTML=all.map(p=>`
    <div class="port-compare-card" style="border-top:3px solid ${p.color};">
      <div class="pcc-name">
        <span>${p.name}</span>
        <span style="font-size:10px;color:var(--t3);">${p.savedAt}</span>
      </div>
      ${[
        ['Capital efectivo','$'+fmt(p.capital),''],
        ['Valor cartera','$'+fmt(p.portVal||0),''],
        ['P&L neto',(p.pnl>=0?'+$':'-$')+fmt(Math.abs(p.pnl||0)),p.pnl>=0?'g':'r'],
        ['Retorno',(p.retPct>=0?'+':'')+p.retPct.toFixed(2)+'%',p.retPct>=0?'g':'r'],
        ['Ratio Sharpe',p.sharpe.toFixed(2),p.sharpe>0.5?'g':p.sharpe>0?'a':'r'],
        ['Volatilidad σ',p.sigma.toFixed(1)+'%','a'],
        ['Operaciones ejecutadas',p.txCount||0,''],
      ].map(([l,v,c])=>`
        <div class="pcc-metric">
          <span style="color:var(--t2);">${conAyuda(l)}</span>
          <span class="mono ${c}">${v}</span>
        </div>`).join('')}
    </div>`).join('');
}

// ══════════════════════════════════════════════════
// MODO PROFESOR — recopilación y clasificación de carteras de estudiantes
// Estado aislado (teacherRoster): no modifica portfolio, capital ni la sesión del estudiante.
// ══════════════════════════════════════════════════

// Calcula las métricas de desempeño de la sesión actual del estudiante (para exportar).
function computeStudentMetrics(){
  const tI = portfolio.reduce((s,p)=>s+p.invested,0);
  const cV = portfolio.reduce((s,p)=>s+(p.currentPrice||p.buyPrice)*p.qty,0);
  const pnl = cV - tI;
  const retPct = tI>0 ? (pnl/tI*100) : 0;
  const pm = computePortfolioMetrics(portfolio);   // métricas ponderadas y coherentes
  return {
    retPct: +retPct.toFixed(2),
    sharpe: +pm.sharpe.toFixed(2),
    pnl: +pnl.toFixed(2),
    sigma: +pm.wSigma.toFixed(2),
    var95: +pm.var95.toFixed(2),
    txCount: txHistory.length,
    posCount: portfolio.length,
    portVal: +cV.toFixed(2),
    capital: +capital.toFixed(2),
  };
}

// El estudiante exporta su desempeño para entregar al profesor.
function exportForTeacher(){
  try {
    let student = prompt('Ingresa tu nombre completo (aparecerá en la lista del profesor):','');
    if(student===null) return;            // canceló
    student = (student||'').trim();
    if(!student){ notify('Debes ingresar un nombre para exportar','error'); return; }
    let section = prompt('Sección o materia (ej. "Mercado Financiero"):','');
    if(section===null) return;            // canceló
    section = (section||'').trim();
    let group = prompt('Grupo (opcional — deja en blanco si no aplica):','');
    if(group===null) group='';            // canceló el grupo: lo dejamos vacío, no abortamos
    group = (group||'').trim();
    const m = computeStudentMetrics();
    // Muestreo de la curva de patrimonio: hasta 60 puntos equiespaciados para mantener
    // el archivo ligero sin perder la forma de la trayectoria.
    const navSampled = (()=>{
      if(!Array.isArray(navHistory) || navHistory.length===0) return [];
      const N=navHistory.length, MAX=60;
      if(N<=MAX) return navHistory.map(p=>({t:p.t, value:p.value, invested:p.invested}));
      const step=N/MAX, out=[];
      for(let i=0;i<N;i+=step){ const p=navHistory[Math.floor(i)]; out.push({t:p.t, value:p.value, invested:p.invested}); }
      out.push(navHistory[N-1]); // siempre incluir el último
      return out;
    })();
    // Detalle de cartera con P&L por posición.
    const holdingsDetail = portfolio.map(p=>{
      const cur=p.currentPrice||p.buyPrice;
      const val=cur*p.qty;
      const pnl=(cur-p.buyPrice)*p.qty;
      const pnlPct=p.buyPrice>0?((cur-p.buyPrice)/p.buyPrice*100):0;
      return { ticker:p.ticker, name:p.name, type:p.type, qty:p.qty,
               buyPrice:+(p.buyPrice||0).toFixed(2), currentPrice:+cur.toFixed(2),
               value:+val.toFixed(2), pnl:+pnl.toFixed(2), pnlPct:+pnlPct.toFixed(2) };
    });
    const payload = {
      _capitallab_student: true,          // marcador de validación
      version: 'CapitalLab Student v2',   // v2: incluye datos de progreso
      student,
      section,                            // sección/materia (ej. "Mercado Financiero")
      group,                              // grupo (opcional)
      metrics: m,
      holdings: portfolio.map(p=>({ticker:p.ticker, type:p.type, qty:p.qty})), // compatibilidad v1
      holdingsDetail,                     // cartera con P&L por posición
      txHistory: txHistory.slice(0,300),  // libro de operaciones (tope de seguridad)
      navHistory: navSampled,             // curva de patrimonio muestreada
      labHistory: Array.isArray(labHistory)? labHistory.slice(0,20).map(h=>({
        date:h.date, strategy:h.strategy, finalValue:h.finalValue,
        achieved:h.achieved, target:h.target, passed:h.passed
      })):[],
      exportedAt: new Date().toLocaleString('es-PA'),
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = student.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40);
    a.href = url; a.download = `CapitalLab estudiante ${safe}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Desempeño exportado para el profesor ✓');
  } catch(e){ notify('Error al exportar: '+e.message,'error'); }
}

// El profesor importa uno o varios archivos de estudiantes.
function importStudent(event){
  const files = Array.from(event.target.files||[]);
  if(files.length===0) return;
  let added=0, rejected=0, done=0;
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try {
        const data = JSON.parse(e.target.result);
        // Validación estricta: debe ser un export de estudiante válido.
        if(!data || data._capitallab_student!==true || !data.student || !data.metrics){
          rejected++;
        } else {
          const m = data.metrics;
          // Evita duplicados por nombre: si ya existe, reemplaza.
          const existing = teacherRoster.findIndex(r=>r.student.toLowerCase()===data.student.toLowerCase());
          const entry = {
            student: data.student,
            section: (data.section||'').trim(),   // sección/materia
            group: (data.group||'').trim(),       // grupo (opcional)
            retPct: +m.retPct||0, sharpe: +m.sharpe||0, pnl: +m.pnl||0,
            sigma: +m.sigma||0, var95: +m.var95||0,
            txCount: +m.txCount||0, posCount: +m.posCount||0,
            portVal: +m.portVal||0, capital: +m.capital||0,
            // Datos de progreso (v2). Si el archivo es v1, quedan vacíos y la vista de detalle lo indica.
            holdingsDetail: Array.isArray(data.holdingsDetail)? data.holdingsDetail : [],
            txLog: Array.isArray(data.txHistory)? data.txHistory : [],
            navCurve: Array.isArray(data.navHistory)? data.navHistory : [],
            labRuns: Array.isArray(data.labHistory)? data.labHistory : [],
            version: data.version||'v1',
            importedAt: new Date().toLocaleString('es-PA'),
          };
          if(existing>=0) teacherRoster[existing]=entry; else teacherRoster.push(entry);
          added++;
        }
      } catch(err){ rejected++; }
      done++;
      // Cuando se procesaron todos los archivos, refresca y notifica una sola vez.
      if(done===files.length){
        saveTeacherRoster();
        renderTeacher();
        let msg = added>0 ? `${added} estudiante(s) importado(s) ✓` : '';
        if(rejected>0) msg += (msg?' · ':'')+`${rejected} archivo(s) inválido(s) rechazado(s)`;
        notify(msg||'No se importó ningún estudiante', rejected>0&&added===0?'error':'success');
      }
    };
    reader.onerror = ()=>{ done++; rejected++; if(done===files.length){ saveTeacherRoster(); renderTeacher(); } };
    reader.readAsText(file);
  });
  event.target.value=''; // permite reimportar el mismo archivo
}

function setTeacherSort(key){ teacherSortKey=key; renderTeacher(); }
function setSectionFilter(sec){ teacherSectionFilter=sec; renderTeacher(); }
function toggleGroupView(on){ teacherGroupView=!!on; renderTeacher(); }

function clearRoster(){
  if(teacherRoster.length===0) return;
  if(!confirm('¿Eliminar todos los estudiantes de la lista? Esta acción no se puede deshacer.')) return;
  teacherRoster=[];
  saveTeacherRoster();
  renderTeacher();
  notify('Lista de estudiantes vaciada');
}

function renderTeacher(){
  const empty = document.getElementById('prof-empty');
  const card = document.getElementById('prof-roster-card');
  const statsEl = document.getElementById('prof-stats');
  if(!empty||!card||!statsEl) return;

  if(teacherRoster.length===0){
    empty.style.display='block';
    card.style.display='none';
    statsEl.innerHTML='';
    return;
  }
  empty.style.display='none';
  card.style.display='block';

  // Poblar el selector de secciones con las secciones presentes en el roster.
  const sections = [...new Set(teacherRoster.map(r=>(r.section||'').trim()).filter(Boolean))].sort();
  const secSel = document.getElementById('prof-section-sel');
  if(secSel){
    const current = teacherSectionFilter;
    secSel.innerHTML = '<option value="all">Todas</option>' +
      sections.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('');
    // Mantener la selección si aún existe; si no, volver a "all".
    secSel.value = (current==='all'||sections.includes(current))?current:'all';
    teacherSectionFilter = secSel.value;
  }

  // Aplicar filtro por sección.
  let roster = teacherRoster.slice();
  if(teacherSectionFilter!=='all'){
    roster = roster.filter(r=>(r.section||'').trim()===teacherSectionFilter);
  }

  // Ordena según el criterio seleccionado (descendente: mejor primero).
  const sorted = roster.sort((a,b)=>(b[teacherSortKey]||0)-(a[teacherSortKey]||0));

  // Estadísticas de grupo
  const n = sorted.length;
  const avg = k => n? sorted.reduce((s,r)=>s+(r[k]||0),0)/n : 0;
  const best = sorted[0];
  statsEl.innerHTML = [
    ['Estudiantes', n, ''],
    ['Retorno promedio', avg('retPct').toFixed(2)+'%', avg('retPct')>=0?'g':'r'],
    ['Sharpe promedio', avg('sharpe').toFixed(2), ''],
    ['Mejor desempeño', best?best.student:'—', 'g'],
  ].map(([l,v,c])=>`<div class="prof-stat-card"><div class="prof-stat-lbl">${conAyuda(l)}</div><div class="prof-stat-val ${c}">${v}</div></div>`).join('');

  // Tabla de clasificación
  const thead = document.querySelector('#prof-table thead');
  const tbody = document.querySelector('#prof-table tbody');
  thead.innerHTML = `<tr>
    <th>#</th><th>Estudiante</th>
    <th>Sección</th><th>Grupo</th>
    <th style="text-align:right;">${conAyuda('Retorno')}</th>
    <th style="text-align:right;">${conAyuda('Sharpe')}</th>
    <th style="text-align:right;">P&L</th>
    <th style="text-align:right;">σ</th>
    <th style="text-align:right;">${conAyuda('VaR 95%')}</th>
    <th style="text-align:right;">Oper.</th>
    <th style="text-align:right;">Posic.</th>
    <th></th>
  </tr>`;

  // Genera una fila de estudiante (posición visual 'pos' 1-based para la medalla).
  const rowHtml = (r,pos)=>{
    const rankClass = pos===1?'prof-rank-1':pos===2?'prof-rank-2':pos===3?'prof-rank-3':'prof-rank-n';
    const medal = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':pos;
    const esc = r.student.replace(/'/g,"\\'");
    return `<tr>
      <td><span class="prof-rank ${rankClass}">${medal}</span></td>
      <td style="font-weight:500;cursor:pointer;" onclick="openStudentDetail('${esc}')" title="Ver progreso detallado">
        <span style="color:var(--accent2);text-decoration:underline dotted;">${r.student}</span>
        <div style="font-size:9px;color:var(--t3);">${r.importedAt}${r.version&&r.version.indexOf('v2')<0?' · datos básicos':''}</div>
      </td>
      <td style="font-size:11px;">${r.section||'—'}</td>
      <td style="font-size:11px;">${r.group||'—'}</td>
      <td class="mono ${r.retPct>=0?'g':'r'}" style="text-align:right;">${r.retPct>=0?'+':''}${r.retPct.toFixed(2)}%</td>
      <td class="mono ${r.sharpe>0.5?'g':r.sharpe>0?'a':'r'}" style="text-align:right;">${r.sharpe.toFixed(2)}</td>
      <td class="mono ${r.pnl>=0?'g':'r'}" style="text-align:right;">${r.pnl>=0?'+$':'-$'}${fmt(Math.abs(r.pnl))}</td>
      <td class="mono" style="text-align:right;">${r.sigma.toFixed(1)}%</td>
      <td class="mono r" style="text-align:right;">$${fmt(r.var95)}</td>
      <td class="mono" style="text-align:right;">${r.txCount}</td>
      <td class="mono" style="text-align:right;">${r.posCount}</td>
      <td style="text-align:right;white-space:nowrap;">
        <span onclick="openStudentDetail('${esc}')" title="Ver detalle" style="cursor:pointer;color:var(--accent2);font-size:15px;margin-right:8px;">⊙</span>
        <span onclick="removeStudent('${esc}')" title="Quitar" style="cursor:pointer;color:var(--red);font-size:15px;">×</span>
      </td>
    </tr>`;
  };

  if(teacherGroupView){
    // Agrupar por grupo (los sin grupo van a "Sin grupo"), cada grupo con su propio ranking.
    const groups = {};
    sorted.forEach(r=>{ const g=(r.group||'').trim()||'Sin grupo'; (groups[g]=groups[g]||[]).push(r); });
    const groupNames = Object.keys(groups).sort((a,b)=> a==='Sin grupo'?1 : b==='Sin grupo'?-1 : a.localeCompare(b));
    tbody.innerHTML = groupNames.map(g=>{
      const header = `<tr class="prof-group-hdr"><td colspan="12"><i class="ti ti-users-group"></i> Grupo: ${g} (${groups[g].length})</td></tr>`;
      const rows = groups[g].map((r,i)=>rowHtml(r,i+1)).join('');
      return header+rows;
    }).join('');
  } else {
    tbody.innerHTML = sorted.map((r,i)=>rowHtml(r,i+1)).join('');
  }
}

function removeStudent(name){
  teacherRoster = teacherRoster.filter(r=>r.student!==name);
  saveTeacherRoster();
  renderTeacher();
}

// ── VISTA DE DETALLE DEL ESTUDIANTE ──
let profDetailChart = null;
let profDetailCurrent = null;   // estudiante actualmente abierto (para exportar)

function openStudentDetail(name){
  const r = teacherRoster.find(s=>s.student===name);
  if(!r){ notify('Estudiante no encontrado','error'); return; }
  profDetailCurrent = r;
  document.getElementById('prof-detail-name').textContent = r.student;
  const esV2 = r.version && r.version.indexOf('v2')>=0;
  const secGrp = [r.section?('Sección: '+r.section):'', r.group?('Grupo: '+r.group):''].filter(Boolean).join(' · ');
  document.getElementById('prof-detail-sub').textContent =
    (secGrp?secGrp+' · ':'') + 'Importado el '+r.importedAt + (esV2?'' : ' · Archivo de versión básica: sin datos de progreso detallado');

  // KPIs resumen
  const kpis = [
    ['Retorno', (r.retPct>=0?'+':'')+r.retPct.toFixed(2)+'%', r.retPct>=0?'g':'r'],
    ['Ratio Sharpe', r.sharpe.toFixed(2), r.sharpe>0.5?'g':r.sharpe>0?'a':'r'],
    ['P&L neto', (r.pnl>=0?'+$':'-$')+fmt(Math.abs(r.pnl)), r.pnl>=0?'g':'r'],
    ['Volatilidad σ', r.sigma.toFixed(1)+'%', 'a'],
    ['VaR 95%', '$'+fmt(r.var95), 'r'],
    ['Operaciones', r.txCount, ''],
    ['Posiciones', r.posCount, ''],
    ['Capital efectivo', '$'+fmt(r.capital), ''],
  ].map(([l,v,c])=>`<div class="metric"><div class="metric-label">${conAyuda(l)}</div><div class="metric-val ${c}" style="font-size:16px;">${v}</div></div>`).join('');

  let body = `<div class="prof-detail-kpis">${kpis}</div>`;

  if(!esV2){
    body += `<div class="info-box warn">Este estudiante exportó con una versión anterior del simulador que no incluye el historial detallado. Solo se muestran las métricas resumen. Pídele que vuelva a exportar con la versión actual para ver su progreso completo.</div>`;
    document.getElementById('prof-detail-body').innerHTML = body;
    document.getElementById('prof-detail-overlay').classList.add('open');
    return;
  }

  // Curva de patrimonio
  body += `<div class="prof-section-lbl">Evolución del patrimonio</div>
    <div class="prof-chart-box"><canvas id="prof-nav-chart"></canvas></div>`;

  // Cartera detallada
  if(r.holdingsDetail && r.holdingsDetail.length){
    body += `<div class="prof-section-lbl">Composición de la cartera (P&L por posición)</div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>Activo</th><th>Tipo</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Precio compra</th><th style="text-align:right;">Precio actual</th><th style="text-align:right;">Valor</th><th style="text-align:right;">P&L</th></tr></thead>
        <tbody>${r.holdingsDetail.map(h=>`<tr>
          <td style="font-weight:500;">${h.ticker}</td>
          <td style="font-size:11px;color:var(--t3);">${({accion:'Acción',bono:'Bono',divisa:'Divisa',futuro:'Futuro',derivado:'Derivado'})[h.type]||h.type}</td>
          <td class="mono" style="text-align:right;">${h.qty}</td>
          <td class="mono" style="text-align:right;">$${fmt(h.buyPrice)}</td>
          <td class="mono" style="text-align:right;">$${fmt(h.currentPrice)}</td>
          <td class="mono" style="text-align:right;">$${fmt(h.value)}</td>
          <td class="mono ${h.pnl>=0?'g':'r'}" style="text-align:right;">${h.pnl>=0?'+':''}${h.pnlPct.toFixed(1)}%</td>
        </tr>`).join('')}</tbody></table></div>`;
  } else {
    body += `<div class="prof-section-lbl">Composición de la cartera</div><div class="info-box">El estudiante cerró la sesión sin posiciones abiertas.</div>`;
  }

  // Libro de operaciones
  if(r.txLog && r.txLog.length){
    const show = r.txLog.slice(0,50);
    body += `<div class="prof-section-lbl">Libro de operaciones (${r.txLog.length} total${r.txLog.length>50?', mostrando 50 más recientes':''})</div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>Hora</th><th>Operación</th><th>Activo</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Comisión</th></tr></thead>
        <tbody>${show.map(t=>`<tr>
          <td style="font-size:11px;">${t.date||'—'}</td>
          <td><span class="badge ${t.action==='Compra'?'badge-green':t.action==='Liquidación'?'badge-red':'badge-blue'}">${t.action||'—'}</span></td>
          <td>${t.name||t.ticker||'—'}</td>
          <td class="mono" style="text-align:right;">${t.qty!=null?t.qty:'—'}</td>
          <td class="mono" style="text-align:right;">${t.price?'$'+fmt(t.price):'—'}</td>
          <td class="mono" style="text-align:right;">${t.fee?'$'+fmt(t.fee):'—'}</td>
        </tr>`).join('')}</tbody></table></div>`;
  } else {
    body += `<div class="prof-section-lbl">Libro de operaciones</div><div class="info-box">Sin operaciones registradas.</div>`;
  }

  // Simulaciones del laboratorio
  if(r.labRuns && r.labRuns.length){
    body += `<div class="prof-section-lbl">Simulaciones del laboratorio (${r.labRuns.length})</div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>Fecha</th><th>Estrategia</th><th style="text-align:right;">Meta</th><th style="text-align:right;">Logrado</th><th style="text-align:right;">Resultado</th></tr></thead>
        <tbody>${r.labRuns.map(l=>`<tr>
          <td style="font-size:11px;">${l.date||'—'}</td>
          <td>${l.strategy||'—'}</td>
          <td class="mono" style="text-align:right;">${l.target!=null?l.target+'%':'—'}</td>
          <td class="mono ${(l.achieved||0)>=0?'g':'r'}" style="text-align:right;">${l.achieved!=null?(l.achieved>=0?'+':'')+(+l.achieved).toFixed(1)+'%':'—'}</td>
          <td><span class="badge ${l.passed?'badge-green':'badge-amber'}">${l.passed?'Aprobado':'No alcanzó'}</span></td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  document.getElementById('prof-detail-body').innerHTML = body;
  document.getElementById('prof-detail-overlay').classList.add('open');

  // Dibujar la curva de patrimonio (tras renderizar el canvas)
  if(profDetailChart){ profDetailChart.destroy(); profDetailChart=null; }
  if(r.navCurve && r.navCurve.length>=2 && typeof Chart!=='undefined'){
    const c=document.getElementById('prof-nav-chart');
    if(c){
      const labels=r.navCurve.map((p,i)=>{ const d=new Date(p.t); return isNaN(d)?('#'+i):d.toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'}); });
      profDetailChart=new Chart(c,{type:'line',data:{labels,datasets:[
        {label:'Patrimonio (NAV)',data:r.navCurve.map(p=>p.value),borderColor:'#00c4ff',backgroundColor:'rgba(0,196,255,.08)',tension:.3,fill:true,pointRadius:0,borderWidth:2},
        {label:'Capital invertido',data:r.navCurve.map(p=>p.invested),borderColor:'rgba(255,180,0,.5)',borderDash:[5,4],fill:false,pointRadius:0,borderWidth:1.5},
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7a8ab0',font:{size:10}}}},scales:{x:{ticks:{color:'#3d4d72',font:{size:10},maxTicksLimit:8},grid:{color:'rgba(255,255,255,.03)'}},y:{ticks:{color:'#3d4d72',font:{size:10},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.03)'}}}}});
    }
  } else {
    const box=document.querySelector('.prof-chart-box');
    if(box) box.innerHTML='<div class="info-box" style="margin:0;">No hay suficientes datos de evolución para graficar (el estudiante operó poco o la sesión fue muy corta).</div>';
  }
}

function closeStudentDetail(){
  document.getElementById('prof-detail-overlay').classList.remove('open');
  if(profDetailChart){ profDetailChart.destroy(); profDetailChart=null; }
  profDetailCurrent=null;
}

// Exporta el análisis individual del estudiante abierto a CSV.
function exportStudentCSV(){
  const r=profDetailCurrent;
  if(!r){ notify('No hay estudiante seleccionado','error'); return; }
  const lines=[
    'CapitalLab — Análisis Individual de Estudiante',
    'Estudiante:,"'+r.student+'"',
    'Sección:,"'+(r.section||'—')+'"',
    'Grupo:,"'+(r.group||'—')+'"',
    'Importado:,'+r.importedAt,
    '',
    'MÉTRICAS DE DESEMPEÑO',
    'Retorno (%),'+r.retPct.toFixed(2),
    'Ratio Sharpe,'+r.sharpe.toFixed(2),
    'P&L neto (USD),'+r.pnl.toFixed(2),
    'Volatilidad (%),'+r.sigma.toFixed(2),
    'VaR 95% (USD),'+r.var95.toFixed(2),
    'Operaciones,'+r.txCount,
    'Posiciones,'+r.posCount,
    'Valor cartera (USD),'+r.portVal.toFixed(2),
    'Capital efectivo (USD),'+r.capital.toFixed(2),
  ];
  if(r.holdingsDetail && r.holdingsDetail.length){
    lines.push('', 'COMPOSICIÓN DE CARTERA',
      'Activo,Tipo,Cantidad,Precio compra,Precio actual,Valor,P&L USD,P&L %');
    r.holdingsDetail.forEach(h=>lines.push(
      `"${h.ticker}",${h.type},${h.qty},${h.buyPrice},${h.currentPrice},${h.value},${h.pnl},${h.pnlPct}`));
  }
  if(r.txLog && r.txLog.length){
    lines.push('', 'LIBRO DE OPERACIONES',
      'Hora,Operación,Activo,Tipo,Cantidad,Precio,Comisión');
    r.txLog.forEach(t=>lines.push(
      `"${t.date||''}",${t.action||''},"${t.name||t.ticker||''}",${t.type||''},${t.qty!=null?t.qty:''},${t.price||''},${t.fee||''}`));
  }
  const csv='\ufeff'+lines.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safe=r.student.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40);
  a.href=url; a.download=`CapitalLab_analisis_${safe}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  notify('Análisis individual exportado a CSV ✓');
}

// Exporta el análisis individual del estudiante abierto a PDF.
function exportStudentPDF(){
  const r=profDetailCurrent;
  if(!r){ notify('No hay estudiante seleccionado','error'); return; }
  const esV2 = r.version && r.version.indexOf('v2')>=0;

  const kpis = `<div class="kpi-grid">
    <div class="kpi"><div class="kpi-lbl">Retorno</div><div class="kpi-val ${r.retPct>=0?'g':'r-clr'}">${r.retPct>=0?'+':''}${r.retPct.toFixed(2)}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Ratio Sharpe</div><div class="kpi-val">${r.sharpe.toFixed(2)}</div></div>
    <div class="kpi"><div class="kpi-lbl">P&L neto</div><div class="kpi-val ${r.pnl>=0?'g':'r-clr'}">${r.pnl>=0?'+':'-'}$${fmt(Math.abs(r.pnl))}</div></div>
    <div class="kpi"><div class="kpi-lbl">Volatilidad σ</div><div class="kpi-val">${r.sigma.toFixed(1)}%</div></div>
    <div class="kpi"><div class="kpi-lbl">VaR 95%</div><div class="kpi-val r-clr">$${fmt(r.var95)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Operaciones</div><div class="kpi-val">${r.txCount}</div></div>
    <div class="kpi"><div class="kpi-lbl">Posiciones</div><div class="kpi-val">${r.posCount}</div></div>
    <div class="kpi"><div class="kpi-lbl">Capital efectivo</div><div class="kpi-val" style="font-size:11pt;">$${fmt(r.capital)}</div></div>
  </div>`;

  const secGrpLine = [r.section?('Sección: '+r.section):'', r.group?('Grupo: '+r.group):''].filter(Boolean).join(' · ');
  let inner = `<div class="section-title">Análisis de desempeño — ${r.student}</div>`;
  if(secGrpLine) inner += `<div style="font-size:9pt;color:#555;margin-bottom:8px;">${secGrpLine}</div>`;
  inner += kpis;

  if(!esV2){
    inner += `<div class="info-box">Este estudiante exportó con una versión anterior del simulador. El reporte incluye únicamente las métricas resumen, sin historial detallado de progreso.</div>`;
  } else {
    // Cartera
    if(r.holdingsDetail && r.holdingsDetail.length){
      inner += `<div class="section-title">Composición de la cartera (P&L por posición)</div>
        <table>
          <thead><tr><th>Activo</th><th class="txt">Tipo</th><th class="r">Cant.</th><th class="r">Precio compra</th><th class="r">Precio actual</th><th class="r">Valor</th><th class="r">P&L %</th></tr></thead>
          <tbody>${r.holdingsDetail.map(h=>`<tr>
            <td class="txt">${h.ticker}</td>
            <td class="txt">${({accion:'Acción',bono:'Bono',divisa:'Divisa',futuro:'Futuro',derivado:'Derivado'})[h.type]||h.type}</td>
            <td class="r">${h.qty}</td>
            <td class="r">$${fmt(h.buyPrice)}</td>
            <td class="r">$${fmt(h.currentPrice)}</td>
            <td class="r">$${fmt(h.value)}</td>
            <td class="r ${h.pnl>=0?'g':'r-clr'}">${h.pnl>=0?'+':''}${h.pnlPct.toFixed(1)}%</td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
    // Libro de operaciones
    if(r.txLog && r.txLog.length){
      const show=r.txLog.slice(0,40);
      inner += `<div class="section-title">Libro de operaciones (${r.txLog.length} total${r.txLog.length>40?', 40 más recientes':''})</div>
        <table>
          <thead><tr><th>Hora</th><th class="txt">Operación</th><th class="txt">Activo</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Comisión</th></tr></thead>
          <tbody>${show.map(t=>`<tr>
            <td class="txt">${t.date||'—'}</td>
            <td class="txt"><span class="badge ${t.action==='Compra'?'badge-buy':t.action==='Liquidación'?'badge-liq':'badge-sell'}">${t.action||'—'}</span></td>
            <td class="txt">${t.name||t.ticker||'—'}</td>
            <td class="r">${t.qty!=null?t.qty:'—'}</td>
            <td class="r">${t.price?'$'+fmt(t.price):'—'}</td>
            <td class="r">${t.fee?'$'+fmt(t.fee):'—'}</td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
    // Simulaciones del laboratorio
    if(r.labRuns && r.labRuns.length){
      inner += `<div class="section-title">Simulaciones del laboratorio (${r.labRuns.length})</div>
        <table>
          <thead><tr><th>Fecha</th><th class="txt">Estrategia</th><th class="r">Meta</th><th class="r">Logrado</th><th class="txt">Resultado</th></tr></thead>
          <tbody>${r.labRuns.map(l=>`<tr>
            <td class="txt">${l.date||'—'}</td>
            <td class="txt">${l.strategy||'—'}</td>
            <td class="r">${l.target!=null?l.target+'%':'—'}</td>
            <td class="r ${(l.achieved||0)>=0?'g':'r-clr'}">${l.achieved!=null?(l.achieved>=0?'+':'')+(+l.achieved).toFixed(1)+'%':'—'}</td>
            <td class="txt"><span class="badge ${l.passed?'badge-buy':'badge-sell'}">${l.passed?'Aprobado':'No alcanzó'}</span></td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
    inner += `<div class="info-box">Reporte individual de progreso generado por CapitalLab. Incluye la composición final de la cartera, el historial de operaciones y, si aplica, las simulaciones del laboratorio realizadas por el estudiante.</div>`;
  }

  if(openPrintableDoc('Análisis Individual — '+r.student, inner))
    notify('PDF del análisis individual descargado.', 'success');
}

// ── HELPER: documento imprimible con la identidad visual de CapitalLab ──
// ── Informe de seguimiento — crecimiento, adopción y actividad a
// través del tiempo, para reportes institucionales (ej. servicio
// social) — a diferencia del ranking (una foto del estado actual),
// este informe muestra la tendencia real desde que arrancó la
// sesión, usando portafolios_historial (que nunca recorta datos
// viejos, a diferencia del historial de 60 puntos de cada estudiante).
// estilos de pdfStyles() — dos sistemas que había que actualizar por
// separado cada vez (y que ya se habían empezado a desalinear). Ahora
// reutiliza exactamente las mismas piezas compartidas (pdfHeader,
// pdfFooter, descargarPDFDesdeHTML) — un solo sistema, una sola vez
// que mantener.
function openPrintableDoc(title, innerHtml){
  const cuerpo = pdfHeader(title) + innerHtml + pdfFooter();
  return descargarPDFDesdeHTML(cuerpo, title || 'CapitalLab');
}

// Exporta el RANKING COMPLETO del modo profesor a PDF.
function exportTeacherPDF(){
  if(teacherRoster.length===0){ notify('No hay estudiantes para exportar','error'); return; }
  const sorted = teacherRoster.slice().sort((a,b)=>(b[teacherSortKey]||0)-(a[teacherSortKey]||0));
  const n = sorted.length;
  const avg = k => sorted.reduce((s,r)=>s+(r[k]||0),0)/n;
  const crit = teacherSortKey==='retPct'?'Retorno':teacherSortKey==='sharpe'?'Ratio Sharpe':'Ganancia/Pérdida';
  const inner = `
    <div class="section-title">Resumen del grupo</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-lbl">Estudiantes</div><div class="kpi-val">${n}</div></div>
      <div class="kpi"><div class="kpi-lbl">Retorno promedio</div><div class="kpi-val ${avg('retPct')>=0?'g':'r-clr'}">${avg('retPct')>=0?'+':''}${avg('retPct').toFixed(2)}%</div></div>
      <div class="kpi"><div class="kpi-lbl">Sharpe promedio</div><div class="kpi-val">${avg('sharpe').toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Mejor desempeño</div><div class="kpi-val" style="font-size:10pt;">${sorted[0].student}</div></div>
    </div>
    <div class="section-title">Clasificación de estudiantes — ordenado por ${crit}</div>
    <table>
      <thead><tr><th>#</th><th>Estudiante</th><th>Sección</th><th>Grupo</th><th class="r">Retorno</th><th class="r">Sharpe</th><th class="r">P&L</th><th class="r">Volat.</th><th class="r">VaR 95%</th><th class="r">Oper.</th><th class="r">Posic.</th></tr></thead>
      <tbody>${sorted.map((r,i)=>{
        const rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'';
        const medal=i===0?'1.°':i===1?'2.°':i===2?'3.°':(i+1);
        return `<tr>
          <td class="medal ${rc}">${medal}</td>
          <td class="txt">${r.student}</td>
          <td class="txt">${r.section||'—'}</td>
          <td class="txt">${r.group||'—'}</td>
          <td class="r ${r.retPct>=0?'g':'r-clr'}">${r.retPct>=0?'+':''}${r.retPct.toFixed(2)}%</td>
          <td class="r">${r.sharpe.toFixed(2)}</td>
          <td class="r ${r.pnl>=0?'g':'r-clr'}">${r.pnl>=0?'+':'-'}$${fmt(Math.abs(r.pnl))}</td>
          <td class="r">${r.sigma.toFixed(1)}%</td>
          <td class="r r-clr">$${fmt(r.var95)}</td>
          <td class="r">${r.txCount}</td>
          <td class="r">${r.posCount}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div class="info-box">Este reporte clasifica a ${n} estudiante(s) según su desempeño en el simulador CapitalLab. El criterio de ordenamiento aplicado es <b>${crit}</b>. Las métricas reflejan el estado de la cartera de cada estudiante al momento de su exportación.</div>`;
  if(openPrintableDoc('Ranking de Estudiantes', inner)) notify('Generando PDF del ranking…');
}

function exportTeacherCSV(){
  if(teacherRoster.length===0){ notify('No hay estudiantes para exportar','error'); return; }
  const sorted = teacherRoster.slice().sort((a,b)=>(b[teacherSortKey]||0)-(a[teacherSortKey]||0));
  const headers = ['Posición','Estudiante','Sección','Grupo','Retorno (%)','Ratio Sharpe','P&L (USD)','Volatilidad (%)','VaR 95% (USD)','Operaciones','Posiciones','Valor cartera (USD)','Capital (USD)','Importado'];
  const rows = sorted.map((r,i)=>[
    i+1, '"'+r.student+'"', '"'+(r.section||'')+'"', '"'+(r.group||'')+'"', r.retPct.toFixed(2), r.sharpe.toFixed(2), r.pnl.toFixed(2),
    r.sigma.toFixed(2), r.var95.toFixed(2), r.txCount, r.posCount,
    r.portVal.toFixed(2), r.capital.toFixed(2), '"'+r.importedAt+'"'
  ].join(','));
  const csv = [
    'CapitalLab — Ranking de Estudiantes (Modo Profesor)',
    'Generado:,'+new Date().toLocaleString('es-PA'),
    'Criterio de orden:,'+(teacherSortKey==='retPct'?'Retorno':teacherSortKey==='sharpe'?'Ratio Sharpe':'Ganancia/Pérdida'),
    'Total estudiantes:,'+sorted.length,
    '',
    headers.join(','),
    ...rows,
  ].join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `CapitalLab ranking ${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  notify('Ranking exportado a CSV ✓');
}

// Persistencia separada del roster del profesor (no se mezcla con el progreso del estudiante).
function saveTeacherRoster(){
  try { localStorage.setItem(TEACHER_KEY, JSON.stringify(teacherRoster)); } catch(e){}
}
function loadTeacherRoster(){
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    if(raw){ const arr = JSON.parse(raw); if(Array.isArray(arr)) teacherRoster = arr; }
  } catch(e){}
}


let _appInitialized = false;
function initApp() {
  if (_appInitialized) return; // evita reinicializar si ya se cargó tras el login
  _appInitialized = true;
  try { computePrices(6); } catch(e) { console.error('computePrices failed', e); }
  try { loadTeacherRoster(); } catch(e) { console.error('loadTeacherRoster failed', e); }
  // Load saved progress BEFORE rendering
  try {
    const loaded = loadProgress();
    if (loaded) {
      portfolio.forEach(pos=>{
        const live = allAssets().find(a=>a.id===pos.id&&a.type===pos.type);
        if(live) pos.currentPrice = live.currentPrice;
      });
      renderLabHistory();
      renderPortfolioTabs();
      renderNewsFeed();
    }
  } catch(e) { console.error('loadProgress failed', e); }
  try { renderAssetList(); }   catch(e) { console.error('renderAssetList failed', e); }
  try { renderCustom(); }      catch(e) { console.error('renderCustom failed', e); }
  try { updateLabConfig(); }   catch(e) { console.error('updateLabConfig failed', e); }
  try { allAssets().forEach(a => initCandles(a)); } catch(e) { console.error('initCandles failed', e); }
  try { renderWatchlist(); }      catch(e) { console.error('renderWatchlist failed', e); }
  try { renderTicker(null); }     catch(e) { console.error('renderTicker failed', e); }
  try { updateSessionBadge(); }   catch(e) { console.error('updateSessionBadge failed', e); }
  try { updateNavCapital(); }     catch(e) { console.error('updateNavCapital failed', e); }
  // Show restore notification if data was found
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const s = JSON.parse(raw);
      const txCount = (s.txHistory||[]).length;
      if (txCount > 0) {
        setTimeout(()=>notify(
          `Progreso restaurado ✓ — ${txCount} transacción(es) · Capital: $${fmt(s.capital||50000)}`
        ), 800);
      }
    }
  } catch(e) {}
  try { restaurarModoEnfoque(); } catch(e){}
  try { restaurarSeccionesNavColapsadas(); } catch(e){}
  try { actualizarRachaActividad(); } catch(e){}
  try { iniciarEscuchaEncuestas(); } catch(e){}
  try { cargarMisSeguidos().then(()=>{ if(misSeguidos.size) iniciarEscuchaOperacionesSeguidos(); }); } catch(e){}
  // La sincronización con precios reales es puramente aditiva: se
  // intenta DESPUÉS de que el simulador ya está completamente
  // funcional con sus precios base, nunca antes ni en su lugar. Si
  // falla por cualquier motivo (Yahoo Finance caído, límite de
  // solicitudes, sin conexión), el simulador sigue exactamente igual
  // que siempre — nadie que lo esté usando lo nota.
  try { restaurarPreferenciaPanelNoticias(); } catch(e){}
  try { iniciarAyudaTerminos(); } catch(e){}
  try { sincronizarPreciosRealesSimulador(); } catch(e){}
  try { iniciarSincronizacionRealPeriodica(); } catch(e){}
}
