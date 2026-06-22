# CapitalLab — Documentación Técnica

**Versión:** 1.2
**Última actualización:** Junio 2026
**Tipo de proyecto:** Aplicación web de archivo único (SPA)
**Tecnologías:** HTML5 · CSS puro · JavaScript puro (ES6+)

---

## Tabla de Contenidos

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura](#2-arquitectura)
3. [Constantes Globales y Configuración](#3-constantes-globales-y-configuración)
4. [Estado de la Aplicación](#4-estado-de-la-aplicación)
5. [Motor de Precios](#5-motor-de-precios)
6. [Ciclo de Vida de la Sesión de Mercado](#6-ciclo-de-vida-de-la-sesión-de-mercado)
7. [Modelo de Datos de Activos](#7-modelo-de-datos-de-activos)
8. [Cálculos Financieros](#8-cálculos-financieros)
9. [Costos de Transacción y Órdenes](#9-costos-de-transacción-y-órdenes)
10. [Referencia de Módulos](#10-referencia-de-módulos)
11. [Capa de Persistencia](#11-capa-de-persistencia)
12. [Arquitectura de Interfaz y Diseño](#12-arquitectura-de-interfaz-y-diseño)
13. [Exportación e Importación de Datos](#13-exportación-e-importación-de-datos)
14. [Modo Profesor](#14-modo-profesor)
15. [Restricciones Conocidas y Decisiones de Diseño](#15-restricciones-conocidas-y-decisiones-de-diseño)
16. [Extender el Simulador](#16-extender-el-simulador)

---

## 1. Visión General del Proyecto

CapitalLab es un **simulador de mercados financieros del lado del cliente** entregado como un único archivo HTML. No requiere servidor, ni proceso de compilación, ni instalación. Toda la lógica, el estado, los estilos y el marcado están contenidos en el archivo.

La aplicación está dirigida a estudiantes universitarios de programas de finanzas. Simula una sesión de negociación tipo NYSE con actualización de precios en vivo, gestión de cartera, métricas de riesgo, costos de transacción reales, órdenes condicionales, llamadas de margen, un módulo de laboratorio guiado para ejercicios dirigidos por el docente, y un modo profesor para clasificar el desempeño de los estudiantes.

### Versiones

| Archivo | Mercados | Activos | Propósito |
|---|---|---|---|
| `CapitalLab.html` | 5 (Acciones, Bonos, Divisas, Futuros, Derivados) | 150 | Versión principal, desarrollo continuo |
| `CapitalLab_3Mercados.html` | 3 (Acciones, Bonos, Divisas) | 90 | Despliegue de servicio social; Futuros y Derivados reservados para una versión futura |

---

## 2. Arquitectura

```
CapitalLab.html  (~5,750 líneas)
│
├── <head>
│   ├── Google Fonts (Syne, DM Sans, DM Mono)         — CDN; degradación elegante sin red
│   └── Tabler Icons webfont                           — CDN; los iconos degradan a vacío sin red
│
├── <style>  (~1,200 líneas)
│   ├── Propiedades CSS personalizadas (design tokens)
│   ├── Estructura de layout (grid + flexbox)
│   ├── Estilos de componentes (tarjetas, badges, modales, gráficos)
│   └── Breakpoints responsivos (768px, 480px)
│
├── <body>
│   ├── Overlay de barra lateral móvil
│   ├── Barra superior (marca + estado de sesión + indicador de capital)
│   ├── Modal de edición de capital
│   ├── Modal de confirmación/reinicio
│   ├── Barra lateral con watchlist
│   └── Área de contenido principal
│       ├── #page-mercado       — Gráfico de velas, panel de operación, feed de noticias
│       ├── #page-analisis      — Navegación por clase de activo, análisis y dispersión riesgo/retorno
│       ├── #page-personalizado — Activos personalizados
│       ├── #page-cartera       — Cartera con soporte de múltiples estrategias
│       ├── #page-laboratorio   — Módulo de laboratorio guiado con Monte Carlo
│       ├── #page-resultados    — Resultados de sesión e índice CL-30
│       ├── #page-resultados-lab — Historial de simulaciones del laboratorio
│       └── #page-profesor      — Modo profesor: recopilación y clasificación de estudiantes
│
└── <script>  (~4,400 líneas)
    ├── Datos de activos (ALL_STOCKS, ALL_BONDS, ALL_FOREX, ALL_FUTURES, ALL_DERIVATIVES)
    ├── Constantes globales y configuración
    ├── Estado de la aplicación (variables mutables)
    ├── Motor de precios (GBM + correlación CAPM)
    ├── Controlador de sesión de mercado
    ├── Costos de transacción y órdenes condicionales
    ├── Llamada de margen
    ├── Renderizadores de interfaz (uno por página/componente)
    ├── Capa de persistencia (localStorage)
    ├── Utilidades de exportación/importación
    ├── Modo profesor (estado aislado)
    └── initApp() — función de arranque
```

### Modelo de Dependencias

El simulador opera en dos modos según la disponibilidad de red:

| Condición | Efecto |
|---|---|
| **En línea** | Google Fonts, Tabler Icons y Chart.js 4.4.1 se cargan desde CDN. Fidelidad visual completa. |
| **Sin conexión** | Toda la lógica financiera, la gestión de estado y la navegación funcionan con normalidad. Los gráficos no se renderizan (Chart.js no disponible). Las tipografías recurren a la fuente del sistema. |

Chart.js se carga mediante una etiqueta `<script>` sin `defer` ni `async`. Si el CDN es inalcanzable, `Chart` queda indefinido y las llamadas de renderizado de gráficos fallan silenciosamente — no bloquean el resto de la funcionalidad.

---

## 3. Constantes Globales y Configuración

Todas las constantes se declaran al inicio del bloque `<script>`. Son `const` — **nunca deben mutarse en tiempo de ejecución**. Para cambiar el comportamiento del simulador, edita estos valores y recarga.

### Constantes Financieras

```javascript
const RF = 4.5;                   // Tasa libre de riesgo (%) — usada en el cálculo del Sharpe
const INITIAL_CAPITAL = 50000;    // Capital inicial de la sesión de mercado (USD)
const MARGIN_RATIO    = 0.5;      // Apalancamiento máximo: 50% del capital inicial
const MARGIN_LIMIT    = -25000;   // Derivado: MARGIN_RATIO × INITIAL_CAPITAL (negativo)
const MAINTENANCE_MARGIN = 0.25;  // Margen de mantenimiento: 25% del valor de las posiciones
const COMMISSION_RATE = 0.0015;   // Comisión de corretaje: 0.15% del valor operado
const COMMISSION_MIN  = 1.00;     // Comisión mínima por operación (USD)
```

### Constantes del Motor de Precios

```javascript
const SESSION_DURATION_MS  = 14_400_000; // Sesión NYSE simulada de 4 horas
const TICK_MS              = 5_000;      // Intervalo de actualización de precios (5 s reales)
const TICKS_PER_SESSION    = 2_880;      // SESSION_DURATION_MS / TICK_MS
const TRADING_DAYS_YEAR    = 252;        // Calendario bursátil estándar
const TICKS_PER_YEAR       = 725_760;    // TICKS_PER_SESSION × TRADING_DAYS_YEAR
const EFFECTIVE_PERIODS    = 1_400;      // Denominador del GBM — menor = más volatilidad intradía
const RISK_MULTIPLIER      = 3.2;        // Amplificador global aplicado a la σ por tick
```

### Spread por Clase de Activo

```javascript
const SPREAD_BY_TYPE = {
  accion:   0.0010,   // 0.10% — renta variable líquida
  bono:     0.0020,   // 0.20% — renta fija; menor liquidez intradía
  divisa:   0.0006,   // 0.06% — pares FX mayores; spreads más estrechos
  futuro:   0.0008,   // 0.08% — futuros estandarizados; alta liquidez
  derivado: 0.0035,   // 0.35% — derivados OTC; spreads más amplios
};
```

### Constantes de Ingresos Pasivos

```javascript
const INCOME_CYCLE_MS   = 90_000;   // Intervalo de pago de dividendo/cupón (90 segundos)
const INCOME_DAY_FRAC   = INCOME_CYCLE_MS / SESSION_DURATION_MS;  // ≈ 1/160 de la sesión
const INCOME_PEDAGOGIC  = 63;       // Factor de aceleración pedagógica
// Efecto neto: una sesión completa ≈ un trimestre de rendimiento anual (perceptible en clase)
const INCOME_ACCRUAL    = (1 / TRADING_DAYS_YEAR) * INCOME_DAY_FRAC * INCOME_PEDAGOGIC;
```

### Claves de Almacenamiento

```javascript
const STORAGE_KEY   = 'capitallab_v1';          // Estado de sesión del estudiante
const TEACHER_KEY   = 'capitallab_teacher_v1';  // Lista del profesor (aislada)
```

---

## 4. Estado de la Aplicación

Todo el estado mutable vive en variables `let` a nivel de módulo dentro del bloque de script. No hay biblioteca de gestión de estado — el estado se comparte directamente entre funciones.

### Capital y Cartera

```javascript
let capital       = INITIAL_CAPITAL; // Efectivo disponible (USD). Nunca modificado por la marca a mercado.
let labCapital    = 50_000;          // Efectivo del laboratorio — independiente del capital de mercado.
let portfolio     = [];              // Posiciones activas (ver esquema de Posición más abajo).
let txHistory     = [];              // Registro cronológico de transacciones.
let navHistory    = [];              // Instantáneas del patrimonio por tick: [{ t, value, invested }]
let pendingOrders = [];              // Órdenes límite/stop-loss en espera de activación.
```

### Sesión

```javascript
let marketSession = {
  open:        false,
  openTime:    null,       // Objeto Date — definido en openMarket()
  closeTime:   null,       // Objeto Date — definido en closeMarket()
  tickTimer:   null,       // Handle de setInterval para tickPrices()
  clockTimer:  null,       // Handle de setInterval para el contador regresivo
  newsTimer:   null,       // Handle de setInterval — dispara generatePeriodicNews() cada 60 s
  incomeTimer: null,       // Handle de setInterval — dispara payPassiveIncome() cada 90 s
};
let marketSessionLog = []; // Registros de cada ciclo de apertura/cierre para la página de Resultados.
```

### Precios en Vivo

```javascript
// Estos arreglos se inicializan en initApp() como copias de ALL_* con currentPrice inyectado.
// Los arreglos ALL_* nunca se mutan — son la fuente de verdad de los datos estáticos
// del activo (nombre, sigma, ret, etc.).
let STOCKS, BONDS, FOREX, FUTURES, DERIVATIVES;
```

### Múltiples Carteras

```javascript
let savedPortfolios  = []; // Hasta 3 estrategias guardadas: [{ name, capital, portfolio, txHistory, savedAt, color }]
let activePortfolioIdx = -1; // -1 = sesión actual sin guardar; 0–2 = índice de ranura guardada
```

### Noticias e Impactos

```javascript
let newsFeed     = [];   // [{ id, time, headline, body, type, ticker, movePct, unread }]
let newsImpacts  = {};   // { assetId: { perTick: float, ticks: int } } — efecto causal en el precio
let newsUnreadCount = 0;
```

### Modo Profesor (estado aislado)

```javascript
let teacherRoster   = []; // [{ student, section, group, retPct, sharpe, pnl, sigma, var95, txCount, posCount, portVal, capital, holdingsDetail, txLog, navCurve, labRuns, version, importedAt }]
let teacherSortKey  = 'retPct';     // criterio de clasificación: retPct | sharpe | pnl
let teacherSectionFilter = 'all';   // filtro por sección/materia
let teacherGroupView = false;       // agrupar la tabla de ranking por grupo
```

### Laboratorio

```javascript
let labConfig = {
  capital:      50_000,
  horizon:      6,        // meses (usado solo para mostrar el retorno anualizado del Lab)
  target:       8,        // retorno objetivo (%) para la evaluación
  started:      false,
  startCapital: 0,
};
let labPickedIds = []; // IDs de activos seleccionados para la cartera del laboratorio
let labHistory   = []; // Resultados de simulaciones Monte Carlo previas
```

### Estado de Interfaz

```javascript
let selectedAsset         = null;    // Objeto del activo mostrado actualmente (referencia en vivo)
let currentHorizonMonths  = 12;      // Horizonte interno para cálculos anualizados (no visible al usuario)
let wlFilter              = 'all';   // Filtro de tipo del watchlist
let wlSort                = 'default'; // Orden del watchlist: 'default' | 'gainers' | 'losers' | 'az'
let wlPage                = 1;       // Página actual del watchlist (paginación)
let anCurrentClass        = 'accion'; // Clase de activo activa en el módulo de Análisis
let anSelectedId          = null;    // ID del activo seleccionado en Análisis
```

---

## 5. Motor de Precios

El motor de precios impulsa todas las actualizaciones de precios en vivo. Se ejecuta en cada tick mientras la sesión de mercado está abierta.

### Punto de Entrada

```
setInterval(tickPrices, TICK_MS)  →  definido en openMarket()
```

### `tickPrices()` — Flujo Completo de Ejecución

```
1. Capturar precios previos → prevPrices{}
2. Generar factor aleatorio de mercado → marketZ (normal Box-Muller)
3. Tirar por evento de régimen de mercado (3% de probabilidad por tick):
     60% → caída:  −3% a −12%
     40% → repunte: +2% a +7%
4. Para cada activo en [STOCKS, BONDS, FOREX, FUTURES, DERIVATIVES]:
     a. Calcular σ por tick mediante candleSigma(asset.sigma)
     b. Calcular deriva = (asset.ret / 100) / EFFECTIVE_PERIODS
     c. Obtener beta (explícita para acciones; por tipo para el resto)
     d. sistemático   = beta × MARKET_VOL × marketZ
     e. idiosincrático = candleSigma × randn() × 0.7
     f. shock = deriva + sistemático + idiosincrático + (beta × eventoMercado)
     g. Tirar por shock específico del activo (3% de probabilidad, 58% sesgo bajista)
     h. Aplicar impacto causal de noticias desde newsImpacts[asset.id] si está activo
     i. nuevoPrecio = max(0.0001, currentPrice × (1 + shock))
     j. Actualizar asset.currentPrice, asset.change
     k. Registrar vela → addCandle(asset)
5. Marcar a mercado las posiciones de la cartera (sincronizar pos.currentPrice)
6. Verificar llamada de margen → checkMarginCall()
7. Verificar órdenes pendientes → checkPendingOrders()
8. Re-renderizar el ticker del watchlist
9. Re-renderizar la página activa (mercado, análisis, cartera o resultados)
10. Autoguardado → autosave()
```

### Mapeo de Beta

Los activos sin un campo `beta` explícito reciben uno según su tipo:

| Tipo | Beta por defecto |
|---|---|
| `accion` | Valor del campo en los datos del activo |
| `bono` | 0.25 |
| `divisa` | 0.45 |
| `futuro` | 1.15 |
| `derivado` | 1.30 |

### Volatilidad por Tick

```javascript
function candleSigma(annualSigma) {
  return ((annualSigma / 100) / Math.sqrt(EFFECTIVE_PERIODS)) * RISK_MULTIPLIER;
}
```

Convierte la sigma anualizada de un activo (%) a una desviación estándar por tick, amplificada por `RISK_MULTIPLIER` para que los movimientos intradía sean pedagógicamente visibles.

### Generación de Números Aleatorios

```javascript
// Transformación de Box-Muller — normal estándar N(0,1)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
```

`Math.random()` (Xorshift128+ en V8) es suficiente para fines de simulación. No se requiere generador criptográfico.

---

## 6. Ciclo de Vida de la Sesión de Mercado

```
El usuario pulsa "Abrir Mercado"
        │
        ▼
openMarket()
  ├── marketSession.open = true
  ├── Capturar precios de apertura → asset.sessionOpenPrice
  ├── Generar 4 noticias de apertura escalonadas (generateOpeningNews)
  ├── Iniciar tickTimer  → setInterval(tickPrices, TICK_MS)
  ├── Iniciar clockTimer → setInterval(updateSessionBadge, 1000)
  ├── Iniciar newsTimer  → setInterval(generatePeriodicNews, 60_000)
  └── Iniciar incomeTimer → setInterval(payPassiveIncome, INCOME_CYCLE_MS)

        │
        │  Cada 5 segundos: tickPrices()
        │  Cada 60 segundos: generatePeriodicNews()  (genera impactos causales en precios)
        │  Cada 90 segundos: payPassiveIncome()
        │
        ▼
El usuario pulsa "Cerrar Mercado" (o expira la sesión)
        │
        ▼
closeMarket()
  ├── marketSession.open = false
  ├── Limpiar impactos de noticias y órdenes pendientes
  ├── Detener los 4 temporizadores (clearInterval)
  ├── Generar noticias de cierre (generateClosingNews)
  ├── Registrar la sesión en marketSessionLog[]
  └── saveProgress()
```

### Expiración de la Sesión

El contador regresivo es solo visual — la sesión **no se cierra automáticamente** cuando el temporizador llega a cero. El usuario debe cerrar el mercado explícitamente. Esto es intencional: permite que los ejercicios de aula se extiendan más allá de la ventana nominal de 4 horas.

---

## 7. Modelo de Datos de Activos

### Esquema de Activo Estático (arreglos ALL_*)

Estos son arreglos de origen de solo lectura. Nunca se mutan en tiempo de ejecución.

```javascript
// Acciones
{
  id:       'AAPL',
  name:     'Apple Inc.',
  ticker:   'AAPL',
  sector:   'Tecnología',
  country:  'EE.UU.',
  price:    189.50,        // precio base/de referencia (USD)
  beta:     1.19,          // sensibilidad al mercado (solo acciones)
  sigma:    22.1,          // volatilidad anualizada (%)
  ret:      12.4,          // retorno anual esperado (%)
  profile:  '...',         // descripción narrativa para el módulo de Análisis
  rating:   'AAA',         // calificación crediticia
  dividend: 0.92,          // dividendo anual por acción (USD)
  type:     'accion',
  fs: {                    // estados financieros (historial de 3 años)
    income:  [{ year, revenue, grossProfit, ebit, netIncome }],
    balance: [{ year, assets, equity, debt }],
    cashflow:[{ year, operating, investing, financing }],
  }
}

// Bonos
{
  id, name, ticker, sector, country, price, sigma, ret, profile, rating,
  coupon:   5.25,   // tasa de cupón anual (%)
  maturity: '2034', // año de vencimiento
  type:     'bono',
}

// Divisas
{
  id, name, ticker, price, sigma, ret, profile, rating,
  country: 'USD/EUR',
  gdp:     '26.9T',   // PIB del país de la moneda base
  type:    'divisa',
}

// Futuros y Derivados
{
  id, name, ticker, sector, country, price, sigma, ret, profile, rating,
  type: 'futuro',   // o 'derivado'
}
```

### Activo en Vivo (extensión en tiempo de ejecución)

Cuando se ejecuta `initApp()`, cada activo se copia a los arreglos en vivo (STOCKS, BONDS, etc.) con campos adicionales inyectados:

```javascript
asset.currentPrice      // float — actualizado cada tick
asset.change            // float — % de cambio respecto a asset.price (apertura)
asset.sessionOpenPrice  // float — precio en la apertura de sesión (definido en openMarket)
// Las velas se almacenan en candleHistory[asset.id], no en el objeto del activo.
```

### Esquema de Posición (portfolio[])

```javascript
{
  id:           'AAPL',
  type:         'accion',
  name:         'Apple Inc.',
  ticker:       'AAPL',
  qty:          10,
  buyPrice:     191.25,     // costo base promedio (execPrice al momento de la compra)
  currentPrice: 193.80,     // sincronizado desde el activo en vivo en cada tick
  invested:     1912.50,    // costo base total (incluye comisión de adquisición)
  sigma:        22.1,       // copiado del activo para cálculos a nivel de cartera
  beta:         1.19,
  ret:          12.4,
  dividend:     0.92,       // o coupon — para ingresos pasivos
}
```

---

## 8. Cálculos Financieros

### Ratio de Sharpe

El Sharpe se calcula de forma diferenciada por clase de activo, porque el "retorno en exceso sobre la tasa libre de riesgo" solo es económicamente válido cuando `ret` es un retorno total comparable.

```javascript
function computeSharpe(asset) {
  let excess;
  switch (asset.type) {
    case 'divisa':
      // El diferencial cambiario ya representa un retorno en exceso; no se resta RF.
      excess = asset.ret;
      break;
    default:
      excess = asset.ret - RF;   // acciones, bonos, futuros, derivados
  }
  return excess / asset.sigma;
}
// RF = 4.5% (constante)
```

### Métricas de Cartera (`computePortfolioMetrics`)

Calcula métricas ponderadas por valor de mercado sobre todas las posiciones abiertas usando un **modelo CAPM de un factor** que refleja la diversificación (no asume correlación perfecta):

```
portSigma = √(sysSigmaW² + idioVar)

donde:
  sysSigmaW = Σ(wᵢ × βᵢ × MARKET_SIGMA_ANNUAL)   // riesgo sistemático (correlacionado)
  idioVar   = Σ(wᵢ² × max(0, σᵢ² − (βᵢ × σₘ)²))  // varianza idiosincrásica (diversificable)

MARKET_SIGMA_ANNUAL = 12%  // volatilidad de mercado de referencia
```

Devuelve: `{ value, wRet, wSigma, sharpe, var95, beta }`

La componente sistemática se suma linealmente (correlacionada vía el factor común de mercado), mientras que la idiosincrásica se agrega en cuadratura (independiente entre activos, por tanto diversificable). El resultado es un VaR de cartera menor que el caso de correlación perfecta (ρ=1), reflejando correctamente el beneficio de la diversificación.

### VaR Histórico de Sesión (`computeHistVaR`)

Método principal — Simulación Histórica:

```
1. Recolectar los retornos por vela de la sesión: rᵢ = (cᵢ − cᵢ₋₁) / cᵢ₋₁
2. Ordenar los retornos ascendentemente (de peor a mejor)
3. VaR(95%) = |returns[floor(0.05 × n)]|  (cola izquierda, percentil 5)
4. Expresado como % de pérdida por período de vela (intradía)
```

Respaldo (< 10 velas) — Paramétrico:

```
VaR(95%) = asset.sigma × 1.645   (anual, no intradía)
```

> **Nota de diseño:** El VaR histórico **no se anualiza** intencionalmente, porque los retornos subyacentes provienen de la simulación intradía amplificada. Anualizarlos produciría cifras engañosamente grandes dado que `RISK_MULTIPLIER = 3.2`. El VaR histórico mide la pérdida potencial en el horizonte de una vela (intradía), y se etiqueta en la interfaz como "histórico (sesión)".

### Beta por Activo de Cartera

```javascript
function betaForAsset(asset) {
  if (typeof asset.beta === 'number') return asset.beta;
  switch (asset.type) {
    case 'bono':     return 0.25;
    case 'divisa':   return 0.45;
    case 'futuro':   return 1.15;
    case 'derivado': return 1.30;
    default:         return 1.0;
  }
}
```

### Devengo de Ingresos Pasivos

Los dividendos (acciones) y cupones (bonos) se acreditan al efectivo cada `INCOME_CYCLE_MS`:

```javascript
// Acciones:
income = asset.dividend × INCOME_ACCRUAL × qty

// Bonos (sobre el valor nominal, no el precio de mercado):
income = (asset.coupon / 100) × INCOME_ACCRUAL × (asset.price × qty)
```

Donde `INCOME_ACCRUAL = (1 / 252) × (90_000 / 14_400_000) × 63`.

Esto hace que una sesión completa rinda aproximadamente **un trimestre** del rendimiento anual — una calibración pedagógica deliberada y documentada. Nótese que el cupón se calcula sobre el **valor nominal** del bono, no sobre el precio de compra, conforme a la convención financiera correcta.

### Llamada de Margen (`checkMarginCall`)

Se evalúa después de cada tick. Refleja el riesgo real del apalancamiento mediante un margen de mantenimiento.

```
function checkMarginCall():
  Si el efectivo es positivo (sin deuda) → no hacer nada.
  patrimonio = efectivo + valor de posiciones
  Si patrimonio ≥ MAINTENANCE_MARGIN × valor de posiciones → margen suficiente, no hacer nada.
  En caso contrario (llamada de margen):
    Liquidar posiciones de MAYOR pérdida no realizada primero,
    cruzando el spread al bid y cobrando comisión,
    hasta restaurar el margen o agotar la cartera.
    Registrar cada liquidación como "Liquidación" en txHistory.
    Notificar al usuario y generar una noticia del evento.
```

`MAINTENANCE_MARGIN = 0.25` (25% del valor de las posiciones). Esta lógica solo actúa cuando el inversor está apalancado (efectivo negativo), y prioriza liquidar las posiciones más perdedoras para cubrir la deuda de la forma más eficiente.

### Proyección de Precios (Lab / Análisis)

Usa una **simulación determinista con semilla** para proyecciones reproducibles:

```javascript
function computePrices(months) {
  const seed = months * 1000;
  function rnd(i) {
    let x = Math.sin(seed + i) * 10_000;
    return x - Math.floor(x);  // pseudoaleatorio en [0, 1)
  }
  // Proyecta precio = precioBase × (1 + retornoMensual)^meses × (1 + ruido)
}
```

### Simulación Monte Carlo del Laboratorio (`simulateLab`)

El laboratorio ejecuta un **Monte Carlo real de 5,000 trayectorias** sobre el horizonte seleccionado y reporta la distribución de resultados, no una sola trayectoria.

```
Para cada una de N_PATHS = 5,000 trayectorias:
  Para cada mes del horizonte:
    shock = (retornoMensual/100) + (sigmaMensual/100) × z   // z normal Box-Muller
    valor = valor × (1 + shock)
    8% de probabilidad mensual de crash (−5% a −35%)
  Registrar valor final.

Reportar de la distribución de valores finales:
  - Percentiles P5 (pesimista), P50 (mediana), P95 (optimista)
  - Probabilidad de alcanzar la meta
  - Probabilidad de pérdida
  - Probabilidad de ruina (pérdida ≥ 95%)
  - VaR empírico al 5% directamente de la distribución
```

La volatilidad de cartera del laboratorio incorpora correlación parcial entre clases (ρ = 0.35), coherente con el VaR de cartera del mercado. El resultado representativo es la mediana (P50), no una corrida aislada y ruidosa.

---

## 9. Costos de Transacción y Órdenes

### Precio de Ejecución y Comisión

```javascript
// Modelo de spread: el comprador paga el ask, el vendedor recibe el bid
function execPrice(midPrice, type, side) {
  const half = spreadFor(type) / 2;
  return side === 'buy' ? midPrice * (1 + half) : midPrice * (1 - half);
}

// Comisión: porcentaje del valor operado con un mínimo
function commissionFor(value) {
  return Math.max(COMMISSION_MIN, Math.abs(value) * COMMISSION_RATE);
}
```

Toda operación (a mercado, por orden, o liquidación por margen) cruza el spread correspondiente a su clase de activo y paga comisión. En una compra, el efectivo que sale es `valor + comisión`; en una venta, el efectivo que entra es `valor − comisión`.

### Tipos de Orden

El simulador soporta órdenes a mercado (ejecución inmediata) y tres tipos de órdenes condicionales que se evalúan en cada tick:

| Tipo | Condición de activación | Uso |
|---|---|---|
| **Límite de compra** | Precio ≤ nivel | Comprar cuando el precio baja al nivel deseado |
| **Límite de venta / Take-profit** | Precio ≥ nivel | Asegurar ganancias en un objetivo |
| **Stop-loss** | Precio ≤ nivel | Limitar pérdidas vendiendo si el precio cae |

```javascript
// Estructura de una orden pendiente
{
  id, assetId, type, ticker, name,
  kind,     // 'limit-buy' | 'limit-sell' | 'stop-loss'
  side,     // 'buy' | 'sell'
  qty, trigger,  // cantidad y precio de activación
}
```

`checkPendingOrders()` recorre `pendingOrders[]` en cada tick; cuando el precio cruza el nivel de activación, ejecuta la orden mediante `executeOrderAt()` (respetando spread, comisión y límite de margen) y genera una noticia y una notificación. Las órdenes que no pueden ejecutarse (por margen o unidades insuficientes) permanecen pendientes. Las órdenes pendientes expiran al cerrar la sesión.

---

## 10. Referencia de Módulos

### `openMarket()` / `closeMarket()` / `toggleMarketSession()`

Controlan el ciclo de vida de la sesión. `toggleMarketSession` es el manejador del botón que llama a uno u otro según `marketSession.open`.

### `tickPrices()`

Bucle central de precios. Ver [Sección 5](#5-motor-de-precios) para el flujo completo de ejecución.

### `renderWatchlist()`

Renderiza la lista de activos de la barra lateral. Respeta `wlFilter` (tipo), `wlSort` (orden) y el estado de paginación (`wlPage`, 25 activos por página). Se llama en cada tick y al cambiar filtros/orden.

### `setAnalysisClass(cls)` / `renderAnalysisGrid()` / `selectAnalysisAsset(id, type)`

Navegación del módulo de Análisis rediseñado. `setAnalysisClass` cambia la clase de activo activa (Acciones, Bonos, Divisas, Futuros, Derivados); `renderAnalysisGrid` puebla la grilla de tarjetas de esa clase; `selectAnalysisAsset` muestra el panel de análisis completo del activo elegido.

### `showAssetDetail(id, type)`

Cambia el panel principal a la página de Mercado y puebla todos los KPIs, el gráfico de velas y el panel de operación del activo seleccionado.

### `executeDirect(side)` / `executeOrderAt(asset, side, qty)`

Ejecución de operaciones. `executeDirect` lee la cantidad del panel de operación. `executeOrderAt` es el núcleo de ejecución compartido — calcula `execPrice`, `commissionFor`, actualiza `capital` y `portfolio`, registra en `txHistory` y llama a `notify()`.

### `placePendingOrder()` / `checkPendingOrders()` / `cancelOrder(id)` / `renderOrderList()`

Gestión de órdenes condicionales. Ver [Sección 9](#9-costos-de-transacción-y-órdenes).

### `checkMarginCall()`

Se ejecuta después de cada tick. Liquida posiciones de forma forzada cuando el patrimonio cae bajo el margen de mantenimiento estando el inversor apalancado. Ver [Sección 8](#8-cálculos-financieros).

### `payPassiveIncome()`

Calcula los dividendos y cupones de la cartera actual, los acredita a `capital`, registra las transacciones y genera una noticia. Se ejecuta cada 90 segundos mientras el mercado está abierto.

### `computePortfolioMetrics(positions)`

Analítica de cartera basada en CAPM. Devuelve retorno ponderado, sigma, Sharpe, VaR y beta. Usada tanto por la página de Cartera como por la de Resultados.

### `computeHistVaR(asset, confidence)`

VaR por simulación histórica a partir de las velas de la sesión. Recurre al método paramétrico si faltan datos. Ver [Sección 8](#8-cálculos-financieros).

### `simulateLab()`

Simulación Monte Carlo del módulo Laboratorio. Ejecuta N trayectorias sobre el horizonte seleccionado y grafica la distribución de resultados frente al retorno objetivo del estudiante.

### `renderPortfolio()` / `renderResults()` / `renderResultsLab()`

Renderizadores de página completos. Cada uno reconstruye el DOM de la página al ser llamado. Se invocan en cada tick (si la página está activa) y en la navegación explícita.

### `saveProgress()` / `loadProgress()`

Serializan/deserializan el estado completo de la aplicación hacia/desde `localStorage`. Ver [Sección 11](#11-capa-de-persistencia).

### `generateOpeningNews()` / `generatePeriodicNews()` / `generateClosingNews()`

Funciones de generación de noticias. Las de apertura disparan 4 ítems escalonados al abrir la sesión. Las periódicas se disparan cada 60 segundos y **generan impactos causales en los precios** (`newsImpacts`). Las de cierre se disparan al cerrar. Todas escriben en `newsFeed[]` y disparan `renderNewsFeed()`.

### `generateNewsItem(asset, movePct)`

Crea un ítem de noticia para un activo y movimiento de precio dados. Selecciona una plantilla aleatoria de un repertorio de 31 plantillas en 5 tipos de activo. `movePct` positivo → enfoque alcista; negativo → bajista.

### `saveCurrentPortfolio()` / `switchPortfolio(idx)` / `togglePortfolioCompare()`

Gestión de múltiples carteras. Se pueden guardar hasta 3 estrategias como instantáneas nombradas. `switchPortfolio` intercambia el estado completo (capital, cartera, historial) a una ranura guardada.

### `computeStudentMetrics()` / `exportForTeacher()` / `importStudent(event)` / `renderTeacher()` / `exportTeacherCSV()`

Funciones del modo profesor. Ver [Sección 14](#14-modo-profesor).

### `initApp()`

Función de arranque (IIFE) que se ejecuta al cargar la página:
1. Copia los arreglos ALL_* a los arreglos en vivo STOCKS/BONDS/FOREX/FUTURES/DERIVATIVES, inyectando `currentPrice`.
2. Carga la lista del profesor (`loadTeacherRoster`).
3. Llama a `loadProgress()` — restaura la sesión previa si existe.
4. Inicializa el watchlist, el módulo de Análisis y la página por defecto.
5. Registra los manejadores de eventos (atajos de teclado, redimensionamiento).

---

## 11. Capa de Persistencia

### Clave de Almacenamiento: `capitallab_v1`

El estado completo de la sesión se serializa a JSON y se escribe en `localStorage` en cada tick (vía `autosave()`) y en acciones explícitas del usuario (operaciones, reinicios, guardado de carteras).

### Carga Útil del Estado

```javascript
{
  capital,
  labCapital,
  portfolio,           // Position[]
  txHistory,           // Transaction[]
  labHistory,          // Resultados de simulaciones del lab
  navHistory,          // [{ t, value, invested }]
  pendingOrders,       // órdenes condicionales
  marketSessionLog,
  savedPortfolios,
  newsFeed,
  labConfig,
  labPickedIds,
  savedAt: cadena ISO,
}
```

### Clave del Profesor: `capitallab_teacher_v1`

La lista del profesor se almacena bajo una **clave separada**, completamente aislada de la sesión del estudiante. Persiste de forma independiente de `resetSession()` — reiniciar la sesión del estudiante no borra la lista del profesor, y viceversa.

### Manejo de Fallos de Almacenamiento

Tanto `saveProgress()` como `loadProgress()` están envueltos en `try/catch`. Los fallos registran una advertencia en `console.warn` y son silenciosos en lo demás — no interrumpen la experiencia del usuario. Esto maneja los errores de cuota excedida (por ejemplo, modo incógnito con `localStorage` lleno).

---

## 12. Arquitectura de Interfaz y Diseño

### Estructura del Layout

```css
.shell {
  display: grid;
  grid-template-rows: 48px 30px 1fr;  /* barra superior / barra de mercado / contenido */
  height: 100vh;                        /* sobreescrito por --vh en móvil */
}
.shell-body {
  display: grid;
  grid-template-columns: 230px 1fr;    /* barra lateral / principal */
}
```

### Layout Móvil (`max-width: 768px`)

La estructura cambia de grid a flexbox para evitar que `1fr` resuelva a cero en ciertas versiones de iOS Safari:

```css
@media (max-width: 768px) {
  .shell { display: flex; flex-direction: column; }
  .shell-body { flex: 1; min-height: 0; }
}
```

### Corrección de `100vh` en iOS Safari

```javascript
(function fixViewportHeight() {
  function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  setVH();
  window.addEventListener('resize', setVH);
})();
```

Se usa como `height: calc(var(--vh, 1vh) * 100)` en la estructura. Resuelve el bug de Safari donde `100vh` incluye la altura de la barra de direcciones, causando desbordamiento del layout.

### Navegación

El cambio de página lo maneja `goPage(pageId)`:

```javascript
function goPage(p) {
  // Ocultar todos los elementos .page
  // Mostrar #page-{p}
  // Actualizar estados activos de los botones de navegación
  // Disparar el render específico de la página si corresponde
}
```

IDs de página: `mercado`, `analisis`, `personalizado`, `cartera`, `laboratorio`, `resultados`, `resultados-lab`, `profesor`.

### Tokens de Diseño (propiedades CSS personalizadas)

```css
:root {
  /* Escala de fondo */
  --c0: #0b0e14;   /* fondo de página */
  --c1: #10141d;   /* barra lateral / superior */
  --c2: #151a27;   /* superficie de tarjeta */
  --c3: #1c2333;   /* fondo de input */
  --c4: #242d42;   /* bordes */

  /* Colores de acento */
  --accent:  #2962ff;  /* azul primario */
  --accent2: #00c4ff;  /* cian de resalte */
  --green:   #00d084;
  --red:     #ff4757;
  --amber:   #ffb400;

  /* Escala de texto */
  --t1: #e8edf8;   /* texto primario */
  --t2: #7a8ab0;   /* texto secundario */
  --t3: #3d4d72;   /* texto atenuado */

  /* Tipografía */
  --font-head: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
}
```

### Instancias de Gráficos

Todas las instancias de Chart.js se almacenan en variables a nivel de módulo para permitir su destrucción antes de recrearlas (previene fugas de memoria del canvas):

```javascript
function dc(chart) {
  if (chart) chart.destroy();
  return null;
}
// Uso: mktChartInst = dc(mktChartInst); // destruir antes de recrear
```

---

## 13. Exportación e Importación de Datos

### Respaldo JSON (`exportProgress`)

Exporta el estado completo de la sesión como archivo `.json`. El nombre incluye la fecha actual: `CapitalLab_progreso_AAAA-MM-DD.json`.

### Importación JSON (`importProgress`)

Lee un archivo JSON previamente exportado vía `FileReader`, valida la estructura y llama a `loadProgress()` para restaurar el estado.

### Libro de Operaciones CSV (`exportTransactionsCSV`)

Exporta `txHistory[]` como CSV UTF-8 con BOM (`\uFEFF`) para compatibilidad con Excel.

Columnas: `Hora, Operación, Activo, Tipo, Cantidad, Precio ejecución, Valor bruto, Comisión, Efecto neto sobre capital`.

Convención del efecto neto:
- **Compra:** `−(bruto + comisión)` → el capital disminuye
- **Venta / Ingreso:** `+(bruto − comisión)` → el capital aumenta

### Exportación PDF (`exportPDF`)

Genera un PDF multisección de la sesión actual usando el motor de impresión del navegador (CSS `@media print` con `window.print()`). No requiere biblioteca PDF externa.

### Exportación del Estudiante (`exportForTeacher`)

Serializa las métricas del estudiante a un archivo JSON para su entrega al docente:

```javascript
{
  _capitallab_student: true,     // marcador de validación
  version: 'CapitalLab Student v2',
  student: 'Nombre completo',
  section: 'Mercado Financiero', // sección o materia (texto libre)
  group: 'Grupo A',              // grupo (opcional; puede ir vacío)
  metrics: { retPct, sharpe, pnl, sigma, var95, txCount, posCount, portVal, capital },
  holdings: [{ ticker, type, qty }],          // resumen (compatibilidad v1)
  holdingsDetail: [{ ticker, name, type, qty, buyPrice, currentPrice, value, pnl, pnlPct }],
  txHistory: [ /* libro de operaciones, hasta 300 */ ],
  navHistory: [ /* curva de patrimonio muestreada, hasta 60 puntos */ ],
  labHistory: [ /* simulaciones del laboratorio, hasta 20 */ ],
  exportedAt: 'cadena local',
}
```

Al exportar, el estudiante ingresa su **nombre**, su **sección/materia** (por ejemplo, "Mercado Financiero") y opcionalmente su **grupo**. La sección y el grupo permiten al docente filtrar y organizar la lista de estudiantes.

---

## 14. Modo Profesor

El modo profesor es un **módulo separado y aislado** dentro del mismo archivo. **No** comparte estado con la sesión del estudiante — tiene su propia clave de almacenamiento (`capitallab_teacher_v1`) y su propio arreglo de lista (`teacherRoster`). Importar estudiantes no altera `portfolio`, `capital` ni ningún dato de la sesión propia.

### Flujo

```
Estudiante:
  1. Completa su sesión
  2. Pulsa "Para profesor" en la barra superior
  3. Ingresa su nombre, su sección/materia y opcionalmente su grupo
     → se descarga el archivo: CapitalLab_estudiante_{nombre}.json

Profesor:
  1. Abre el mismo CapitalLab.html
  2. Navega al Modo Profesor
  3. Importa uno o varios archivos JSON de estudiantes
     (la validación rechaza automáticamente los archivos que no son exports válidos)
  4. renderTeacher() muestra la tabla de clasificación con columnas de Sección y Grupo
  5. Puede ordenar por: retPct | sharpe | pnl
  6. Puede filtrar por sección (setSectionFilter) para ver una materia a la vez
  7. Puede activar "Agrupar por grupo" (toggleGroupView): la tabla se divide en
     sub-rankings por grupo; los estudiantes sin grupo se agrupan bajo "Sin grupo"
  8. Ve estadísticas del conjunto filtrado (total, retorno y Sharpe promedio, mejor desempeño)
  9. Puede abrir el detalle de progreso de cada estudiante (openStudentDetail)
 10. Puede exportar a CSV o PDF: el ranking completo (exportTeacherCSV / exportTeacherPDF)
     o el análisis individual del estudiante abierto (exportStudentCSV / exportStudentPDF).
     Todas las exportaciones incluyen sección y grupo.
```

### Filtro y Agrupación

El estado `teacherSectionFilter` controla qué sección se muestra (`'all'` = todas). El selector de secciones se puebla automáticamente con las secciones presentes en la lista importada. El estado `teacherGroupView` (booleano, activable/desactivable con la casilla "Agrupar por grupo") determina si la tabla se renderiza como un ranking único o dividida en sub-rankings por grupo, cada uno con su propia numeración y medallas.

### Validación de Importación

Cada archivo importado debe contener el marcador `_capitallab_student === true` junto con los campos `student` y `metrics`. Los archivos que no cumplen se rechazan con un mensaje claro, sin afectar la lista existente. Si un estudiante con el mismo nombre ya existe, su registro se reemplaza (evita duplicados).

### `computeStudentMetrics()`

Calcula las métricas en tiempo real de la sesión actual para exportar:

```javascript
{
  retPct,    // retorno total de la cartera (%)
  sharpe,    // ratio de Sharpe de la cartera
  pnl,       // ganancia/pérdida absoluta (USD)
  sigma,     // sigma ponderada de la cartera
  var95,     // VaR de la cartera al 95% de confianza
  txCount,   // total de transacciones
  posCount,  // posiciones abiertas
  portVal,   // valor actual de la cartera (marca a mercado)
  capital,   // efectivo disponible
}
```

### Tabla de Clasificación

Los estudiantes se muestran ordenados por el criterio seleccionado (descendente), con medallas para los tres primeros lugares y todas las métricas por estudiante. Las estadísticas de grupo incluyen el número de estudiantes, el retorno y Sharpe promedio, y el mejor desempeño. La exportación a CSV produce un ranking listo para calificar.

---

## 15. Restricciones Conocidas y Decisiones de Diseño

| Restricción | Justificación |
|---|---|
| Archivo HTML único | Cero fricción de despliegue en entornos educativos. Sin servidor, sin npm, sin compilación. |
| Sin framework | Evita la cadena de herramientas de compilación como dependencia. JavaScript puro es suficiente para el nivel de complejidad. |
| Chart.js solo vía CDN | Mantiene el tamaño del archivo manejable. El modo sin conexión degrada con elegancia (gráficos ocultos, lógica intacta). |
| `Math.random()` para el GBM | La aleatoriedad criptográfica es innecesaria; el objetivo es la fidelidad de la simulación, no la impredecibilidad. |
| `localStorage` para persistencia | Sin sistema de cuentas. Los datos son locales al dispositivo, portables entre sesiones vía exportación JSON. |
| Intercambio profesor-estudiante por archivos | Coherente con el modelo de archivo único sin servidor. No requiere cuentas ni infraestructura en la nube. |
| `RISK_MULTIPLIER = 3.2` | Amplificación deliberada para que los movimientos de precio sean visibles en un período de clase de 60–90 minutos. |
| VaR histórico no anualizado | Anualizar los retornos intradía amplificados produciría cifras engañosas dado el multiplicador de riesgo pedagógico. |
| Ingreso pasivo acelerado (63×) | Sin aceleración, el ingreso sería imperceptible en una sesión de clase. El factor está documentado y es auditable. |
| La sesión no se cierra automáticamente | Permite flexibilidad en el aula; el docente puede extender una sesión más allá de la ventana nominal de 4 horas. |
| Modelo de correlación de un factor | Un Cholesky completo con matriz de covarianzas pertenece a una fase de investigación avanzada; el modelo de un factor es defendible y suficiente para el nivel de licenciatura. |

---

## 16. Extender el Simulador

### Agregar un Nuevo Activo

1. Agrega un objeto al arreglo `ALL_*` correspondiente siguiendo el esquema de la [Sección 7](#7-modelo-de-datos-de-activos).
2. Asegúrate de que `id` sea único entre **todos** los arreglos.
3. Recarga — el activo aparecerá en el watchlist y en todos los cálculos automáticamente.

### Agregar un Nuevo Tipo de Activo

1. Crea un nuevo arreglo `ALL_NUEVOTIPO` con un valor de campo `type` consistente.
2. Agrega una entrada en `SPREAD_BY_TYPE`.
3. Agrega una beta por defecto en `betaForAsset()`.
4. Inclúyelo en `allAssets()` y `allBase()`.
5. Manéjalo en `payPassiveIncome()`, `renderPortfolio()` y `renderResults()` según sea necesario.

### Modificar Parámetros de Riesgo

Todos los parámetros de riesgo están en la [Sección 3](#3-constantes-globales-y-configuración). Palancas clave:

| Para lograr | Cambiar |
|---|---|
| Precios más volátiles | Aumentar `RISK_MULTIPLIER` o disminuir `EFFECTIVE_PERIODS` |
| Sesiones más largas | Aumentar `SESSION_DURATION_MS` |
| Actualizaciones más rápidas | Disminuir `TICK_MS` (mínimo recomendado ~2000ms; menos estresa el bucle de render) |
| Más crashes | Aumentar la probabilidad de crash (`0.03`) o el sesgo bajista en `tickPrices()` |
| Spreads más estrechos | Disminuir los valores en `SPREAD_BY_TYPE` |
| Llamadas de margen más estrictas | Aumentar `MAINTENANCE_MARGIN` |

### Validar Cambios en JavaScript

Después de cualquier edición al bloque de script:

```bash
# Extraer el bloque de script y verificar la sintaxis
node -e "
const fs = require('fs');
const html = fs.readFileSync('CapitalLab.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
new Function(match[1]);
console.log('Sintaxis OK');
"
```

O abre el archivo en Chrome DevTools y revisa la consola en busca de errores de ejecución inmediatamente después de cargar.

---

*Documentación Técnica de CapitalLab — Universidad de Panamá, Facultad de Economía, 2026*
*Autores: Justin Jones, Dustin Jones, Emanuel Iturriaga*
