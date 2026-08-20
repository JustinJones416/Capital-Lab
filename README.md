# CapitalLab 🎓📈

**Ecosistema educativo de finanzas y mercados de capitales**, desarrollado para la **Facultad de Economía / Licenciatura en Finanzas y Banca** de la **Universidad de Panamá**, 2026.

CapitalLab está formado por tres herramientas independientes que trabajan juntas: un simulador de mercados donde se **practica** con dinero virtual, una plataforma académica donde se **aprende** con casos y guías, y una mesa de análisis donde se **decide** con rigor sobre inversiones reales.

| Herramienta | Para qué sirve | Archivo |
|---|---|---|
| 🕹️ **Simulador** | Practicar la compra y venta de activos con dinero virtual, en un mercado que se mueve solo | `Simulador.html` |
| 🎓 **Academy** | Aprender con casos extensos, resúmenes, glosarios y un modo libro, materia por materia | `Academy.html` |
| 📊 **Analytics** | Analizar un activo real (acción o divisa) y recibir una recomendación de inversión fundamentada | `Analytics.html` |

Las tres se pueden abrir desde el menú **"Herramientas"** de la barra superior de cualquiera de ellas, sin salir de la sesión activa.

---

## Tabla de contenidos

- [Simulador](#-simulador)
- [Academy](#-academy)
- [Analytics](#-analytics)
- [Inteligencia artificial en CapitalLab](#inteligencia-artificial-en-capitallab)
- [Arquitectura técnica](#arquitectura-técnica)
- [Instalación y despliegue](#instalación-y-despliegue)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Aviso importante](#aviso-importante)
- [Contexto académico](#contexto-académico)

---

## 🕹️ Simulador

Simulador de mercados financieros con dinero virtual, pensado para practicar decisiones de inversión sin riesgo real.

**Mercados disponibles:** acciones, bonos soberanos y corporativos, divisas, futuros, y derivados (opciones, swaps, CDS, forwards).

**Cómo se mueven los precios:** un motor de simulación estocástico de un factor (estilo CAPM) genera el movimiento de cada activo en vivo, cada 5 segundos, correlacionando todos los activos entre sí según su beta y su tipo. Incluye eventos de mercado ocasionales (caídas y repuntes) con sesgo realista hacia caídas más frecuentes y pronunciadas.

**Sincronización con precios reales:** al iniciar sesión, el simulador recalibra el precio de partida de acciones, divisas, y algunos futuros con la cotización real del mercado (vía Yahoo Finance), y desde ahí el motor de simulación toma el control por completo — el riesgo y la volatilidad que se enseñan en clase nunca se pierden, solo el punto de partida es más realista. Si la fuente de datos reales no está disponible por cualquier motivo, el simulador sigue funcionando con normalidad con sus precios base, sin ninguna interrupción visible.

**Modos de uso:**
- **Mercado** — trading libre en tiempo real, con noticias del mercado, comparación contra el índice sintético CL-30, y un mercado entre estudiantes (P2P) para negociar directamente entre compañeros.
- **Laboratorio** — sesiones con capital asignado por el profesor, horizonte y meta definidos, pensadas para evaluar una estrategia específica.

**Con inteligencia artificial:**
- **Analizar con IA** — en el detalle de cualquier activo, genera una tesis de inversión redactada, integrando su perfil de riesgo, calificación crediticia, y contexto real.
- **Mejores inversiones (IA)** — analiza el mercado completo según el perfil de riesgo declarado por el estudiante (conservador, moderado, agresivo) y recomienda tres opciones con su razonamiento.

**Otras funciones:** modo enfoque, rachas de actividad, encuestas en vivo del profesor, seguimiento de otros estudiantes, reportes exportables en PDF y PowerPoint, y guardado automático de progreso.

---

## 🎓 Academy

Plataforma de estudio por materia, con catorce materias de la Licenciatura en Finanzas y Banca — Mercado Bancario, Mercados Financieros, Negociación y Evaluación Crediticia, Análisis Económico de Estados Financieros, Derivados Financieros, Macroeconomía, y más.

**Cada materia incluye:**
- **Casos extensos** — situaciones reales de varias etapas (hasta 10), con documentos completos para analizar (no solo datos ya resumidos), preguntas de opción múltiple, numéricas, de selección múltiple, de ordenar por prioridad, y casos con ramificación donde la decisión del estudiante cambia el camino del caso.
- **Medidor de consecuencias** — algunas decisiones dentro de un caso suben o bajan un indicador visible (confianza del comité, credibilidad del informe, etc.), reforzando que las decisiones tienen peso real.
- **Sistema de pista en dos niveles** — antes de revelar una fórmula completa, se ofrece primero una pista conceptual que exige recordar o deducir la relación entre los datos, sin salir nunca del caso.
- **Resumen, glosario, tarjetas de repaso y quiz** por materia.
- **Modo libro** — una narrativa guiada capítulo por capítulo para repasar los conceptos centrales de la materia.
- **Lecturas para profundizar** — material de lectura libre, más denso que el resumen, para quien quiera ir más allá de lo necesario para resolver los casos.
- **Cotización real de mercado** — consulta el precio, variación, rango de 52 semanas e histórico real de cualquier acción o par de divisas, sin salir de la plataforma.

**Herramientas del docente:** creación de grupos, calificaciones, mensajería con estudiantes, casos personalizados, y **generación de casos y glosarios con inteligencia artificial** — el docente pide un caso sobre un tema específico, la IA lo genera siguiendo exactamente la estructura pedagógica de la materia, y queda como borrador hasta que el docente lo revisa y aprueba explícitamente. Nunca se publica nada sin esa aprobación.

---

## 📊 Analytics

Mesa de análisis de inversión: se ingresan (o se traen automáticamente) los datos de un activo real, y la herramienta calcula las métricas financieras relevantes, simula miles de escenarios con Monte Carlo, mide el riesgo, y entrega una recomendación fundamentada.

**Mercados analizables:** acciones y divisas.

**Datos reales, con fuente verificable en cada campo:**
- **Acciones populares** — ocho acciones reconocidas con cotización real en vivo, visibles al entrar, con un clic directo al análisis completo.
- **Traer todos los datos reales disponibles** — con solo el símbolo, completa automáticamente precio, EPS, valor en libros, dividendo, beta, acciones en circulación, deuda/patrimonio, ROE, crecimiento de utilidades, y rentabilidad esperada, cada uno con un enlace directo a la página exacta de Yahoo Finance de donde salió ese dato específico.
- **Comparables automáticos** — al traer los datos de una acción, se muestran de inmediato 2–3 empresas reales del mismo sector con su P/E y ROE, para que la valoración tenga contexto relativo, no solo un número aislado.
- **Inflación real por país** (para divisas) — vía la API pública del Banco Mundial, con la fecha exacta del dato oficial más reciente disponible (los datos macro oficiales tienen normalmente 1–2 años de rezago, a diferencia de una cotización bursátil, y se le avisa al usuario).

**Con inteligencia artificial:** un botón genera una tesis de inversión redactada en 3–4 párrafos, integrando los indicadores ya calculados, reconociendo al menos un riesgo real (no solo argumentos a favor), y coherente con la calificación cuantitativa del modelo.

**Reporte profesional (PDF):** exporta un documento formal con el veredicto, la tabla completa de indicadores con su interpretación, y la tesis de IA si ya se generó — listo para entregar o archivar.

**Cuenta opcional:** Analytics funciona por completo sin necesidad de iniciar sesión — todo se guarda en el navegador. Quien decide crear una cuenta obtiene sincronización de su historial de análisis y sus activos seguidos entre dispositivos, con recuperación de contraseña incluida. El historial local ya existente se migra automáticamente a la nube en el momento de crear la cuenta, sin perder nada.

---

## Inteligencia artificial en CapitalLab

Las tres herramientas usan **Gemini 3.6 Flash** (Google AI) para sus funciones de inteligencia artificial, siempre bajo el mismo principio de seguridad:

> **La clave de la API nunca toca el navegador.** Cada función de IA corre en una Edge Function de Supabase, del lado del servidor. El navegador solo envía los datos ya calculados o el pedido específico; la clave vive únicamente como secreto de servidor, nunca en el código fuente ni visible para quien inspeccione la página.

| Función | Dónde vive | Qué hace |
|---|---|---|
| `generar-caso-ia` | Proyecto de Academy | Genera casos y glosarios completos para una materia, a pedido del docente |
| `generar-tesis-analytics` | Proyecto de Analytics | Redacta la tesis de inversión de un activo analizado |
| `generar-analisis-simulador` | Proyecto del Simulador | Redacta tesis de un activo, y recomienda las mejores inversiones del mercado actual |
| `datos-yahoo-finance` | Proyectos de Academy, Analytics y Simulador | Trae cotizaciones y datos fundamentales reales de Yahoo Finance |

---

## Arquitectura técnica

- **Frontend:** HTML, CSS y JavaScript sin frameworks ni build tools — cada herramienta es un único archivo autocontenido, con las fuentes empaquetadas directamente (sin depender de servicios externos que puedan bloquearse).
- **Backend:** [Supabase](https://supabase.com) — autenticación, base de datos Postgres con seguridad a nivel de fila (RLS), y Edge Functions (Deno) para toda lógica que necesite proteger una clave.
- **Datos de mercado:** Yahoo Finance (endpoint público de cotizaciones y de datos fundamentales), consultados siempre del lado del servidor.
- **Datos macroeconómicos:** API pública del Banco Mundial, sin necesidad de clave.
- **Inteligencia artificial:** Gemini 3.6 Flash, vía Google AI Studio.

Cada una de las tres herramientas usa **su propio proyecto de Supabase**, independiente entre sí.

---

## Estructura del repositorio

```
CapitalLab/
├── index.html              → redirige automáticamente al Simulador
├── Simulador.html
├── Academy.html
├── Analytics.html
└── supabase/
    ├── academy/
    │   ├── migraciones .sql
    │   └── functions/generar-caso-ia/, datos-yahoo-finance/
    ├── analytics/
    │   ├── migraciones .sql
    │   └── functions/generar-tesis-analytics/, datos-yahoo-finance/
    └── simulador/
        └── functions/generar-analisis-simulador/, datos-yahoo-finance/
```

---

## Aviso importante

CapitalLab es una herramienta **educativa**. Los precios, análisis, recomendaciones y tesis de inversión generadas (incluidas las asistidas por inteligencia artificial) tienen fines de aprendizaje y no constituyen asesoría financiera profesional ni garantizan resultados reales.
