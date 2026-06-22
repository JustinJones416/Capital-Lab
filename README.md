# CapitalLab 📈
### Plataforma Interactiva de Gestión y Análisis de Mercados Financieros

> Simulador web educativo de mercados financieros desarrollado como proyecto de servicio social para la **Facultad de Economía / Licenciatura en Finanzas y Banca** de la **Universidad de Panamá**, 2026.

---

## Tabla de Contenidos

- [Descripción](#descripción)
- [Demo](#demo)
- [Características Principales](#características-principales)
- [Mercados y Activos](#mercados-y-activos)
- [Arquitectura Técnica](#arquitectura-técnica)
- [Instalación y Uso](#instalación-y-uso)
- [Publicación en la Web](#publicación-en-la-web)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Equipo](#equipo)
- [Contexto Académico](#contexto-académico)

---

## Descripción

**CapitalLab** es un simulador de mercados financieros que funciona completamente en el navegador, sin instalación ni registro. Está diseñado para cerrar la brecha entre la teoría del aula y la operación real de instrumentos financieros, permitiendo a los estudiantes practicar con dinero virtual en un entorno que replica el comportamiento real de los mercados.

Los estudiantes pueden experimentar rentabilidad, riesgo, pérdidas parciales, costos de transacción reales, apalancamiento con llamadas de margen e incluso **balance negativo**, todo sin riesgo económico real. El docente, por su parte, dispone de un módulo dedicado para recopilar y clasificar el desempeño de sus estudiantes.

---

## Demo

> Descarga el archivo `CapitalLab.html` (versión de 5 mercados) o `CapitalLab_3Mercados.html` (versión de 3 mercados para servicio social) y ábrelo directamente en cualquier navegador moderno. No requiere servidor ni conexión a internet para funcionar (las dependencias de interfaz se cargan desde CDN si hay red disponible).

---

## Características Principales

| Funcionalidad | Detalle |
|---|---|
| **Sesión tipo NYSE** | Mercado con duración de 4 horas simuladas, botón Abrir/Cerrar |
| **Precios en tiempo real** | Actualización cada 5 segundos mediante Movimiento Browniano Geométrico (GBM) |
| **Correlación de mercado** | Modelo CAPM de un factor; co-movimiento realista entre activos |
| **Costos de transacción** | Comisión de corretaje (0.15%, mínimo $1) más spread bid-ask diferenciado por clase de activo |
| **Tipos de orden** | Órdenes a mercado, límite de compra, límite de venta/take-profit y stop-loss |
| **Llamada de margen** | Liquidación forzada automática cuando el patrimonio cae bajo el margen de mantenimiento (25%) |
| **Ingresos pasivos** | Dividendos y cupones acreditados automáticamente durante la sesión, con devengo proporcional al tiempo |
| **Noticias causales** | Las noticias generan impactos reales en los precios, absorbidos gradualmente en varios ticks |
| **VaR de cartera diversificado** | Modelo de un factor que refleja la diversificación (no asume correlación perfecta) |
| **VaR histórico de sesión** | Cálculo con retornos reales de las velas; respaldo paramétrico cuando faltan datos |
| **Riesgo expandido** | El balance puede volverse negativo (margen hasta −$25,000); se puede perder todo el capital |
| **Índice sintético CL-30** | Índice equiponderado de mercado, base 1,000 puntos |
| **Múltiples carteras** | Hasta 3 estrategias guardadas simultáneamente para comparación |
| **Modo Profesor** | Recopilación e importación de carteras de estudiantes (con nombre, sección y grupo), tabla de clasificación con filtro por sección y agrupación opcional por grupo, vista de progreso individual y exportación a CSV y PDF |
| **Análisis por clase de activo** | Navegación por pestañas (Acciones, Bonos, Divisas, Futuros, Derivados) con grilla de tarjetas |
| **Laboratorio Monte Carlo** | El docente asigna capital, horizonte y meta; simulación de miles de trayectorias con distribución de resultados |
| **Exportación de datos** | Libro de operaciones a CSV (compatible con Excel, con BOM), respaldo en JSON y reporte en PDF |
| **Compatibilidad móvil** | Diseño responsivo completo; menú hamburguesa; resuelve el bug de `100vh` en iOS Safari |
| **Buscador y filtros** | Watchlist con búsqueda, ordenamiento por alzas/bajas/alfabético, filtro por tipo y paginación |
| **Activos personalizados** | Módulo para agregar instrumentos definidos por el usuario |
| **Persistencia** | Estado guardado en `localStorage`; ningún dato sale del navegador |

---

## Mercados y Activos

El proyecto tiene dos versiones con diferente alcance:

### Versión Principal — 5 Mercados (`CapitalLab.html`)

150 activos distribuidos en 30 por categoría:

| Mercado | Descripción |
|---|---|
| **Acciones** | Renta variable con beta, dividendos y volatilidad |
| **Bonos** | Soberanos y corporativos con cupón, rendimiento y riesgo país |
| **Divisas** | Pares Forex con indicadores macro y PIB |
| **Futuros** | Energía, metales, índices, granos y criptoactivos |
| **Derivados** | Opciones, swaps, forwards y estructurados OTC |

### Versión Servicio Social — 3 Mercados (`CapitalLab_3Mercados.html`)

90 activos (30 por categoría): **Acciones**, **Bonos** y **Divisas**. Futuros y Derivados reservados para desarrollo futuro.

---

## Arquitectura Técnica

```
CapitalLab.html   ← archivo único (~5,750 líneas)
│
├── HTML5 semántico
├── CSS personalizado (variables CSS, tema oscuro)
│   └── Paleta: #0B0E14 (fondo) + #00C4FF (acento) + #00D084 (verde) + #FF4757 (rojo)
└── JavaScript puro (sin frameworks)
    ├── Motor GBM con EFFECTIVE_PERIODS = 1400
    ├── Correlación CAPM de un factor
    ├── Eventos de shock (3% de probabilidad por tick, sesgo bajista)
    ├── Costos de transacción (comisión + spread bid-ask)
    ├── Órdenes condicionales (límite y stop-loss)
    ├── Llamada de margen con liquidación forzada
    ├── Motor de noticias causales (afectan precios)
    ├── Laboratorio Monte Carlo de N trayectorias
    ├── Modo Profesor (estado aislado, persistencia separada)
    └── Persistencia vía localStorage
```

### Constantes clave del motor

```javascript
TICK_MS              = 5000      // actualización de precios cada 5 s
SESSION_DURATION_MS  = 14400000  // sesión de 4 horas simuladas
TICKS_PER_YEAR       = 725760    // 2,880 ticks/sesión × 252 sesiones
EFFECTIVE_PERIODS    = 1400      // volatilidad intradía visible
RISK_MULTIPLIER      = 3.2       // amplificador de riesgo global
MARGIN_LIMIT         = -25000    // límite inferior de balance (apalancamiento)
MAINTENANCE_MARGIN   = 0.25      // margen de mantenimiento para la llamada de margen
COMMISSION_RATE      = 0.0015    // comisión de corretaje (0.15%)
```

### Dependencias externas (CDN)

| Librería | Versión | Uso |
|---|---|---|
| Chart.js | 4.4.1 | Gráficos de velas y distribución |
| Tabler Icons | Latest | Iconografía de la interfaz |
| Google Fonts (Syne, DM Sans, DM Mono) | — | Tipografía |

> El simulador es **funcional sin conexión a internet**. Las dependencias solo añaden gráficos e iconos; la lógica financiera opera íntegramente en JavaScript local.

### Secciones del simulador

1. **Mercado** — Gráfico de velas en vivo, métricas del activo, panel de noticias, watchlist, panel de operación con órdenes avanzadas
2. **Análisis** — Navegación por clase de activo, proyección de precio, riesgo vs rentabilidad, perfil del emisor, indicadores clave
3. **Personalizado** — Activos definidos por el usuario
4. **Mi Cartera** — Posiciones, valoración en vivo, gráficos de evolución/distribución/P&L, múltiples estrategias
5. **Laboratorio** — Módulo guiado con capital y meta asignados por el docente, simulación Monte Carlo
6. **Resultados** — Evaluación general, tabla por posición, índice CL-30
7. **Resultados Lab** — Historial de simulaciones del laboratorio
8. **Modo Profesor** — Recopilación y clasificación de carteras de estudiantes

---

## Instalación y Uso

No se requiere instalación. Pasos:

```bash
# 1. Clonar el repositorio
git clone https://github.com/JustinJones416/Capital-Lab.git

# 2. Abrir el simulador directamente en el navegador
# (doble clic sobre el archivo, o arrastrar a la pestaña del navegador)
open CapitalLab.html            # versión completa (5 mercados)
open CapitalLab_3Mercados.html  # versión servicio social (3 mercados)
```

Compatible con Chrome, Firefox, Safari y Edge en versiones actuales. Funcionalidad móvil completa en iOS Safari y Android Chrome.

---

## Publicación en la Web

Al ser un archivo único, CapitalLab puede publicarse en línea sin configuración de servidor. El archivo debe nombrarse `index.html` para que el servicio de alojamiento lo reconozca como página de inicio.

| Servicio | Método | Costo |
|---|---|---|
| **Netlify Drop** | Arrastrar y soltar el archivo en la web de Netlify | Gratis |
| **GitHub Pages** | Activar Pages sobre el repositorio | Gratis |
| **Netlify + GitHub** | Vincular el repositorio para despliegue automático en cada cambio | Gratis |

> El progreso de cada estudiante se guarda en su propio dispositivo (`localStorage`). El intercambio de datos entre el estudiante y el profesor se realiza mediante archivos exportados, sin requerir cuentas ni servidor central.

---

## Estructura del Proyecto

```
capitallab/
│
├── CapitalLab.html                          # Simulador principal — 5 mercados, 150 activos
├── CapitalLab_3Mercados.html                # Versión servicio social — 3 mercados, 90 activos
│
├── docs/
│   ├── DOCS.md                                       # Documentación técnica completa
│   ├── Anteproyecto_CapitalLab_ServicioSocial.docx   # Marco académico del proyecto
│   └── CapitalLab_Guia_Capacitador.docx              # Guía para docentes y capacitadores
│
├── presentations/
│   ├── CapitalLab_Presentacion.pptx                  # Presentación corporativa — 5 mercados
│   └── CapitalLab_Presentacion_3Mercados.pptx        # Presentación — 3 mercados
│
└── README.md
```

---

## Equipo

Proyecto desarrollado por estudiantes de la **Licenciatura en Finanzas y Banca**, Universidad de Panamá, como proyecto de servicio social 2026:

| Integrante |
|---|
| Justin Jones |
| Dustin Jones |
| Emanuel Iturriaga |

---

## Contexto Académico

| Campo | Valor |
|---|---|
| **Institución** | Universidad de Panamá |
| **Facultad** | Facultad de Economía |
| **Programa** | Licenciatura en Finanzas y Banca |
| **Tipo de proyecto** | Proyecto de desarrollo tecnológico (servicio social) |
| **Año** | 2026 |

CapitalLab fue diseñado para complementar materias de análisis financiero y mercados de capitales. Permite a los estudiantes experimentar en la práctica los conceptos de rentabilidad, riesgo, diversificación, costos de transacción, apalancamiento, VaR, Sharpe y Beta que se estudian teóricamente en el aula.

---

<p align="center">
  <strong>CapitalLab</strong> · Universidad de Panamá · Facultad de Economía · 2026<br>
  Proyecto de servicio social — uso educativo gratuito
</p>
