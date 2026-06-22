# CapitalLab 📈
### Plataforma Interactiva de Gestión y Análisis de Mercados Financieros

> Simulador web educativo de mercados financieros desarrollado como proyecto de servicio social para la **Facultad de Economía / Licenciatura en Finanzas y Banca** de la **Universidad de Panamá**, 2026.

---

## Tabla de Contenidos

- [¿De qué se trata el proyecto?](#de-qué-se-trata-el-proyecto)
- [Qué puedes hacer en el simulador](#qué-puedes-hacer-en-el-simulador)
- [Mercados y activos](#mercados-y-activos)
- [Cómo usar el simulador](#cómo-usar-el-simulador)
- [Modo Profesor](#modo-profesor)
- [Cómo instalar y abrir el archivo](#cómo-instalar-y-abrir-el-archivo)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Equipo](#equipo)
- [Contexto académico](#contexto-académico)

---

## ¿De qué se trata el proyecto?

**CapitalLab** es un simulador de mercados financieros que funciona completamente en el navegador. Permite a los estudiantes practicar la compra y venta de instrumentos financieros con **dinero virtual**, en un entorno que imita el comportamiento real de los mercados, sin ningún riesgo económico.

El objetivo es cerrar la brecha entre la teoría del aula y la práctica: en lugar de solo leer sobre rentabilidad, riesgo, diversificación o apalancamiento, el estudiante los **experimenta** gestionando su propia cartera. Puede ganar, perder, equivocarse y aprender de las consecuencias, todo en un espacio seguro.

El simulador arranca con un capital virtual de **$50,000** y abre una "sesión de mercado" durante la cual los precios se mueven en tiempo real. El estudiante decide qué comprar, cuándo vender y cómo equilibrar su cartera. Al final puede revisar sus resultados, sus métricas de riesgo y su evolución.

---

## Qué puedes hacer en el simulador

| Funcionalidad | Detalle |
|---|---|
| **Sesión de mercado en vivo** | Sesión de 4 horas simuladas; los precios se actualizan cada 5 segundos |
| **Comprar y vender** | Operaciones a precio de mercado con costos reales (comisión 0.15% y spread por tipo de activo) |
| **Órdenes avanzadas** | Órdenes límite de compra, límite de venta / take-profit y stop-loss |
| **Apalancamiento y margen** | Puedes operar con margen (hasta −$25,000); si el patrimonio cae demasiado, hay liquidación automática (llamada de margen) |
| **Ingresos pasivos** | Recibes dividendos (acciones) y cupones (bonos) automáticamente durante la sesión |
| **Centro de noticias** | Noticias por categoría de activo y generales que afectan los precios, al estilo de un portal financiero |
| **Análisis por activo** | Perfil completo de cada instrumento: estados financieros, indicadores de riesgo, proyección y datos macro |
| **Mi cartera** | Valoración en vivo, gráficos de evolución y distribución, P&L, y hasta 3 estrategias guardadas para comparar |
| **Laboratorio** | Ejercicio guiado donde el docente asigna capital, horizonte y meta; incluye simulación Monte Carlo de miles de escenarios |
| **Resultados** | Evaluación general, tabla por posición, métricas de riesgo (Sharpe, VaR, Beta) e índice de mercado CL-30 |
| **Exportar** | Tu libro de operaciones a CSV (Excel), un respaldo de tu progreso en JSON, y reportes en PDF |
| **Funciona en el celular** | Diseño adaptado a pantallas móviles, con menú lateral |
| **Tu progreso se guarda solo** | El simulador recuerda tu sesión en el propio dispositivo; ningún dato sale del navegador |

---

## Mercados y activos

La versión completa cubre **5 mercados** con 150 activos (30 por categoría):

| Mercado | Descripción |
|---|---|
| **Acciones** | Renta variable con beta, dividendos, volatilidad y estados financieros (resultados, balance y flujo de efectivo) |
| **Bonos** | Soberanos y corporativos con cupón, rendimiento al vencimiento (YTM), duración y convexidad |
| **Divisas** | Pares Forex con indicadores macroeconómicos (PIB, inflación, tasas de banco central) |
| **Futuros** | Energía, metales, índices, granos y criptoactivos, con precio spot, base y estado de la curva |
| **Derivados** | Opciones y estructurados con griegas (delta, gamma, theta, vega), strike y volatilidad implícita |

---

## Cómo usar el simulador

Una vez que abres el archivo (ver [Cómo instalar y abrir el archivo](#cómo-instalar-y-abrir-el-archivo)), sigue estos pasos:

1. **Abre el mercado.** En la página *Mercado*, pulsa **"Abrir mercado"**. Comienza la sesión y los precios empiezan a moverse cada 5 segundos.

2. **Elige un activo.** Usa el *Watchlist* (panel lateral izquierdo) para buscar y seleccionar un activo. Puedes filtrar por tipo (Acciones, Bonos, FX, Futuros, Derivados) y ordenar por mayores alzas o bajas.

3. **Analiza antes de invertir.** En la página *Análisis* revisa el perfil del activo: su riesgo, rentabilidad esperada, estados financieros (acciones), rendimiento y duración (bonos), datos macro (divisas), etc.

4. **Compra.** En el panel de operación del activo, ingresa la cantidad y pulsa **Comprar**. Verás el costo estimado (incluye comisión y spread). Si quieres, puedes colocar una **orden límite** o un **stop-loss** en vez de comprar al instante.

5. **Gestiona tu cartera.** En *Mi Cartera* ves tus posiciones, su valor en vivo, tu ganancia o pérdida, y gráficos de cómo evoluciona tu patrimonio. Puedes guardar hasta 3 estrategias distintas para compararlas.

6. **Sigue las noticias.** El *Centro de Noticias* muestra eventos que mueven los precios. Reaccionar a tiempo es parte del ejercicio.

7. **Cierra y revisa.** Cuando termines, pulsa **"Cerrar mercado"** y ve a *Resultados* para evaluar tu desempeño: retorno, Sharpe, VaR y posición frente al índice CL-30.

8. **Exporta tu progreso.** Puedes descargar tu libro de operaciones (CSV), un respaldo (JSON) o un reporte (PDF). Si tu profesor usa el Modo Profesor, usa el botón **"Para profesor"** (ver abajo).

> **Consejo:** tu progreso se guarda automáticamente en el navegador. Si cierras y vuelves a abrir el archivo en el mismo dispositivo y navegador, tu sesión seguirá ahí.

---

## Modo Profesor

CapitalLab incluye un **Modo Profesor** para que el docente evalúe el desempeño de sus estudiantes.

**Para el estudiante:**
1. Al terminar su sesión, pulsa el botón **"Para profesor"** en la barra superior.
2. Ingresa su **nombre**, su **sección o materia** (por ejemplo, "Mercado Financiero") y, opcionalmente, su **grupo**.
3. Se descarga un archivo `.json` que el estudiante entrega al docente.

**Para el profesor:**
1. Abre el simulador y entra a la página **Modo Profesor**.
2. Pulsa **"Importar estudiante(s)"** y selecciona los archivos `.json` de sus estudiantes (puede importar varios a la vez).
3. Ve una **tabla de clasificación** con el desempeño de cada estudiante, incluyendo su sección y grupo.
4. Puede **filtrar por sección** para revisar una materia a la vez, y activar **"Agrupar por grupo"** para ver rankings separados por grupo.
5. Al hacer clic en un estudiante, abre su **progreso detallado**: curva de patrimonio, composición de cartera y libro de operaciones.
6. Puede **exportar** el ranking completo o el análisis individual a **CSV o PDF** para calificar.

> El Modo Profesor es independiente de la sesión del estudiante: importar estudiantes no afecta la cartera ni el progreso propio del docente.

---

## Cómo instalar y abrir el archivo

CapitalLab es un **único archivo HTML** que se abre directamente en cualquier navegador. **No necesita instalación, ni internet, ni programas adicionales.** Puedes usarlo aunque no tengas acceso al sitio web.

### Opción 1 — Abrir con doble clic (la más sencilla)

1. Guarda el archivo `CapitalLab.html` en tu computadora (por ejemplo, en el Escritorio o en Descargas).
2. Haz **doble clic** sobre el archivo.
3. Se abrirá en tu navegador predeterminado (Chrome, Edge, Firefox o Safari). ¡Listo para usar!

### Opción 2 — Abrir desde el navegador

1. Abre tu navegador (Chrome, Firefox, Edge o Safari).
2. Pulsa `Ctrl + O` (en Windows/Linux) o `Cmd + O` (en Mac).
3. Busca y selecciona el archivo `CapitalLab.html`.
4. El simulador se abrirá en una pestaña nueva.

### Opción 3 — Arrastrar al navegador

1. Abre una ventana nueva del navegador.
2. **Arrastra** el archivo `CapitalLab.html` desde su carpeta hasta la pestaña del navegador y suéltalo.

### En el celular o tablet

1. Guarda el archivo `CapitalLab.html` en el dispositivo (por ejemplo, en la app *Archivos*).
2. Ábrelo con el navegador (Chrome en Android, Safari en iPhone/iPad). Algunos dispositivos requieren abrirlo desde un gestor de archivos y elegir "Abrir con" → navegador.

> **Importante:** guarda siempre una copia del archivo `CapitalLab.html` en tu computadora o en un respaldo (USB, Google Drive). Mientras tengas el archivo, podrás usar el simulador en cualquier momento, con o sin internet.

---

## Preguntas frecuentes

**¿Necesito conexión a internet?**
No para la lógica del simulador. La conexión solo mejora la apariencia (tipografías e iconos se cargan de internet); sin red, el simulador funciona igual, solo con un estilo visual más simple. Los gráficos requieren conexión la primera vez.

**¿Se pierde mi progreso si cierro el archivo?**
No, mientras uses el mismo navegador y dispositivo: el progreso se guarda automáticamente. Si quieres llevarlo a otro dispositivo, usa "Exportar" para descargar un respaldo y luego "Importar".

**¿Funciona en cualquier navegador?**
Sí: Chrome, Firefox, Edge y Safari en sus versiones actuales, tanto en computadora como en móvil.

**¿Puedo perder dinero real?**
No. Todo el capital es virtual y con fines educativos.

**¿Los datos financieros son reales?**
Son datos representativos con fines educativos, basados en cifras aproximadas de empresas y mercados reales. No deben usarse para decisiones de inversión reales.

---

## Equipo

Proyecto desarrollado por estudiantes de la **Licenciatura en Finanzas y Banca**, Universidad de Panamá, como proyecto de servicio social 2026.

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
