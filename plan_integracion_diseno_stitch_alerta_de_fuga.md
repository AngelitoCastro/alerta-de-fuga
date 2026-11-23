# Alerta de Fuga — Plan final de integración del rediseño de Stitch

**Versión:** 1.0  
**Fecha:** 23 de noviembre de 2026  
**Estado:** Especificación de implementación (no implica que los cambios estén ejecutados)  
**Proyecto:** Alerta de Fuga — juego web educativo sobre fallas criptográficas, OWASP A04:2025  
**Referencia visual principal:** `stitch_alerta_de_fuga_cyber_thriller (1).zip`

---

## 1. Objetivo

Integrar la nueva dirección artística **Tropical Cybercrime Thriller** en la aplicación funcional existente de **Alerta de Fuga**, conservando íntegros los cuatro minijuegos educativos, el motor de puntuación, la progresión, los tests de aprendizaje, las preferencias de accesibilidad y los controles de seguridad.

La experiencia debe combinar **portada y transiciones cinematográficas ilustradas** con **interacciones de ciberseguridad legibles y verificables**. No se trata de reemplazar la aplicación por prototipos estáticos de Stitch, sino de **transferir su lenguaje visual a los componentes reales**.

**Resultado esperado:** la aplicación se siente como un videojuego de investigación de una fuga digital en NovaPay, no como un cuestionario técnico ni como una colección de dashboards.

### Principios no negociables

1. **Conservar las mecánicas:** inspección de tráfico, clasificación de datos, caza de errores y simulación de incidente ramificado.
2. **Primero comprensión, luego decoración:** los elementos visuales no deben ocultar la siguiente acción del jugador ni anticipar respuestas correctas.
3. **Identidad original:** inspiración en ilustración tropical cinematográfica, sin reutilizar obras, logotipos, composiciones o personajes identificables de GTA VI.
4. **Contenido técnico intacto salvo correcciones justificadas:** las explicaciones sobre HTTP/HTTPS, TLS, hashing, cifrado, almacenamiento, RSA y claves deben seguir siendo exactas.
5. **Accesibilidad funcional:** teclado, foco, lectura por tecnologías asistivas, contraste, movimiento reducido y uso móvil.
6. **Entrega sin regresiones:** no introducir errores nuevos y mantener pruebas automatizadas y navegación completa.

---

## 2. Qué contiene realmente el ZIP de Stitch

**Material verificado en el ZIP adjunto:**

| Elemento | Disponible | Uso recomendado |
|---|---|---|
| Portada cinematográfica desktop | `code.html` + `screen.png` | Referencia para Home |
| Nivel 1 — El Túnel Abierto desktop | `code.html` + `screen.png` | Referencia para inspector |
| Nivel 2 — La Bóveda de Texto Plano tropical | `code.html` + `screen.png` | Referencia para clasificador |
| Nivel 3 — Llaves bajo el Tapete desktop | `code.html` + `screen.png` | Referencia para revisión de código |
| Nivel 4 — Simulacro de Brecha tropical | `code.html` + `screen.png` | Referencia para incidente ramificado |
| Resultados / reporte táctico final | `code.html` + `screen.png` | Referencia para Results |
| Guía visual nueva | `tropical_cybercrime_thriller/DESIGN.md` | **Fuente de tokens principal** |
| Guía visual anterior | `alerta_de_fuga_tactical_cyber_threat_interface/DESIGN.md` | Referencia secundaria, no mezclar paletas |
| Imágenes adicionales | Cuatro `screen.png` en carpetas de ilustración/referencia | Revisar individualmente procedencia y derechos antes de incluir |

**Lo que no está demostrado por ese ZIP:** un juego funcional, navegación integrada, tests que pasan, layout móvil completo, persistencia de datos o despliegue listo para producción. Las pantallas HTML son **prototipos de presentación**, no sustitutos verificados de los motores de juego.

**Hallazgo técnico concreto:** los HTML incluyen `cdn.tailwindcss.com`, fuentes de Google, iconos Material Symbols e imágenes `lh3.googleusercontent.com`. Estas dependencias **no son compatibles sin cambios con la CSP estricta basada en recursos propios** prevista para el juego. Se deben reemplazar o alojar localmente cuando corresponda, respetando las licencias y autorizaciones de uso.

---

## 3. Dirección artística aprobada

**Nombre interno:** Tropical Cybercrime Thriller.  
**Marca pública, única y constante:** **Alerta de Fuga**.  
**Universo narrativo:** NovaPay y una ciudad costera ficticia hiperconectada.

### Identidad

- Ilustración digital original con luz de atardecer, personajes investigadores, ciudad tropical, redes y dispositivos.
- Narrativa visual de thriller de ciberseguridad: las amenazas son datos filtrados, claves expuestas, comunicaciones inseguras e incidentes, no actividades criminales representadas como premio.
- Pantallas introductorias y cierres de misión con arte protagonista; pantallas de juego con arte como marco, no como obstáculo.
- Composición inspirada en viñetas ilustradas y titulares fuertes, sin copiar portadas de videojuegos existentes.
- La información técnica se expresa en chips, etiquetas, tarjetas y pequeños diagramas. El detalle completo permanece disponible bajo demanda.

### Paleta base prioritaria

Derivada de `tropical_cybercrime_thriller/DESIGN.md`. Esta guía contiene dos formas de nombrar colores (tokens de esquema y colores expresivos en la prosa): implementar una **tabla única de equivalencias** y probar contraste antes de publicar.

| Token de aplicación sugerido | Valor guía | Uso |
|---|---|---|
| `--color-bg` | `#160d2d` | Fondo violeta nocturno |
| `--color-surface` | `#231a3a` | Paneles principales |
| `--color-surface-raised` | `#2d2545` | Paneles elevados |
| `--color-text` | `#e9ddff` | Texto base |
| `--color-text-muted` | `#e4bdc2` | Texto secundario; validar contraste por tamaño |
| `--color-pink` | `#ff3377` | CTA y acento cinematográfico |
| `--color-coral` | `#ff6b35` | Acento cálido / progreso narrativo |
| `--color-gold` | `#ffc107` | Logros y recompensas, no única señal de acierto |
| `--color-lavender` | `#b070d6` | Bordes y detalles secundarios |
| `--color-cream` | `#fcf6ee` | Textos claros destacados |

**Cuidado:** en el `DESIGN.md` también figuran `primary: #ffb2bf`, `secondary: #ffb59d` y `tertiary: #fabd00`. No mezclar estos tokens de esquema con los acentos vivos arbitrariamente. Establecer qué valores corresponden a superficie, texto y botones y verificar cada combinación de contraste.

### Tipografía

- **Rubik** para títulos e identidad de las misiones.
- **Space Grotesk** para cuerpo, acciones y etiquetas.
- **Monoespaciada local/de sistema** solo para código, hashes, direcciones o fragmentos técnicos; no para explicaciones largas.
- La portada de Stitch utiliza adicionalmente Chakra Petch/Rajdhani: **normalizar** a las familias elegidas salvo que una comparación visual justifique conservar una tercera familia. Evitar cuatro o cinco tipografías mezcladas.
- Priorizar fuentes locales con licencia permitida o alternativas del sistema, sin depender de Google Fonts en tiempo de ejecución.

### Elementos gráficos

- Títulos grandes, paneles tipo viñeta, bordes violetas, iluminación rosa/coral medida y fondos ilustrados.
- Animaciones breves para transición de misión, logros y consecuencias, siempre desactivables o reducidas.
- No utilizar parpadeos intensos ni efectos de sacudida excesivos.
- Evitar que colores rojos, verdes o iconos de alerta **revelen la solución** del reto antes de que el jugador decida. Separar **telemetría observada** de **evaluación posterior**.

---

## 4. Arquitectura de implementación

### Stack

Conservar el stack real del juego si continúa siendo HTML/CSS/JavaScript ES Modules, JSON y `localStorage`. **No migrar a React, Next.js o Tailwind solo porque Stitch exportó HTML con utilidades Tailwind.** No añadir backend para implementar cambios puramente visuales.

### Integración por componentes

| Área | Archivo/ubicación esperada en el juego original | Cambios permitidos |
|---|---|---|
| Tokens | `css/tokens.css` | Nuevos colores, tipografía, sombras, espaciado |
| Estructura adaptable | `css/layout.css` | Grid, HUD móvil, portada, paneles |
| Componentes | `css/components.css` | Botones, tarjetas, chips, modal, feedback |
| Minijuegos | `css/minigames.css` | Estilos específicos sin alterar reglas |
| Home | `js/views/homeView.js` | Portada, misión, selección de niveles |
| Juego/HUD | `js/views/gameView.js` | Organización visual, indicadores, feedback |
| Resultados | `js/views/resultsView.js` | Jerarquía narrativa y estadísticas |
| Inspector | `js/minigames/inspector.js` | Presentación de solicitudes y acciones |
| Clasificador | `js/minigames/classifier.js` | Tarjetas y contenedores accesibles |
| Código | `js/minigames/codeHunt.js` | Marcado de línea y remediación |
| Incidente | `js/minigames/branchingIncident.js` | Escenas de decisión y línea de tiempo |
| Recursos | `assets/` | Arte original verificado y optimizado |
| Contenido | `data/`, `i18n/` | Mantener hechos y respuestas; revisar solo textos necesarios |

**Nota:** las rutas anteriores corresponden a la estructura prevista del proyecto; antes de editar, verificar el repositorio real, archivos existentes y convenciones actuales. No asumir que todo módulo tiene exactamente el mismo nombre o contrato.

### Política de integración

1. Identificar el **componente funcional existente**.
2. Compararlo con `screen.png` y `code.html` de Stitch.
3. Extraer únicamente **patrones visuales y estructura semántica útil**.
4. Implementarlo en los CSS y vistas reales; usar datos del motor, no valores simulados o hardcodeados.
5. Verificar eventos, accesibilidad, estados, puntuaciones y tamaños de pantalla.
6. Ejecutar pruebas antes de continuar al siguiente nivel.

**No pegar el HTML completo de Stitch como nueva pantalla funcional.** No incorporar su CDN, enlaces de imágenes externos, handlers de demostración o valores falsos de telemetría al producto.

---

## 5. Pantallas y comportamiento esperado

### 5.1 Inicio — portada cinematográfica

**Referencia:** `alerta_de_fuga_portada_cinematogr_fica_desktop/`.

- Portada original ilustrada con analistas y ciudad costera ficticia.
- Marca **Alerta de Fuga** dominante.
- Gancho breve: **«La información está en riesgo. Tu misión es contener la fuga.»**
- CTA principal: **«Iniciar misión»**, entra directamente al primer nivel disponible.
- CTA secundario: **«Evaluar mis conocimientos»**, inicia test previo opcional.
- Cuatro tarjetas de capítulo con estado real (bloqueado, disponible, completado), título, resumen y avance.
- Glosario y ajustes visibles pero subordinados a la acción principal.
- Nada de métricas ficticias ni cifras de incidentes presentadas como datos reales.

**Criterio de aceptación:** un jugador nuevo identifica qué hacer en pocos segundos, inicia el nivel 1 sin tener que contestar el test previo y siempre puede localizar ese test como opción.

### 5.2 HUD transversal

- Visible durante la toma de decisiones: **Puntos · Racha · Exposición · Paso del nivel**.
- En móvil, barra compacta `sticky` en la parte superior, sin tapar el contenido ni los controles; tener en cuenta `safe-area-inset`.
- Exposición con número, texto y barra, no solo con color.
- La actualización se anuncia de manera apropiada a lectores de pantalla, sin saturar `aria-live`.
- Evitar ocupar más de lo necesario en pantallas estrechas.
- Opciones de sonido y reducción de movimiento accesibles.

### 5.3 Nivel 1 — El Túnel Abierto

**Referencia:** `alerta_de_fuga_nivel_1_el_t_nel_abierto_desktop/`.

- Presentar solicitudes y detalles observables (esquema, protocolo, TLS, certificado, HSTS, contenido mixto).
- Priorizar el paquete o solicitud seleccionada; resto de la telemetría en panel secundario.
- Controles claros: **Permitir / Exigir HTTPS-HSTS cuando corresponda / Bloquear**.
- No inferir automáticamente «inseguro» por ausencia de HSTS en una conexión HTTPS ya establecida: el reto debe explicar el escenario de degradación y protección correcta.
- Mostrar veredicto **después de responder**, con consecuencia y explicación.

### 5.4 Nivel 2 — La Bóveda de Texto Plano

**Referencia:** `alerta_de_fuga_nivel_2_la_b_veda_de_texto_plano_tropical/`.

- Clasificar tarjetas de datos mediante arrastre **y** una alternativa por clic/toque/teclado.
- Contenedores con nombre claro: hashing de contraseñas, cifrado autenticado, tokenización y eliminación de dato innecesario.
- Distinguir entre PAN, que puede tokenizarse según la necesidad, y CVV, que **no debe almacenarse tras la autorización**, incluso cifrado.
- No esconder la respuesta en el color del contenedor ni en el tipo de tarjeta.
- El dato y la elección permanecen legibles durante el arrastre o la selección.

### 5.5 Nivel 3 — Llaves bajo el Tapete

**Referencia:** `alerta_de_fuga_nivel_3_llaves_bajo_el_tapete_desktop/`.

- Código simulado con numeración de líneas legible.
- Flujo evidente: **1. Marca la línea vulnerable → 2. Selecciona la corrección**.
- Resaltar línea elegida sin marcar la respuesta correcta con anticipación.
- Mantener escenarios de secretos embebidos, credenciales públicas, llaves mal almacenadas, CSPRNG y RSA sin padding OAEP.
- Explicar riesgos de RSA sin OAEP con precisión; no equiparar automáticamente todas las variantes PKCS#1 v1.5 a la ausencia completa de padding.

### 5.6 Nivel 4 — Simulacro de Brecha

**Referencia:** `alerta_de_fuga_nivel_4_simulacro_de_brecha_tropical/`.

- Conectar narrativamente las pistas previas con una fuga de NovaPay.
- Una fase, sus evidencias y opciones principales deben dominar la vista; las alertas secundarias pueden plegarse.
- Las decisiones deben modificar **estado y ruta real del grafo**, no solo cambiar el color de una tarjeta.
- Mostrar consecuencias comprensibles, contención, correcciones y falla si la exposición llega al umbral definido.
- No transformar la respuesta a incidentes en una fantasía de acciones ofensivas reales; conservar objetivos defensivos y educativos.

### 5.7 Resultados

**Referencia:** `alerta_de_fuga_pantalla_de_resultados_y_reporte_t_ctico_final_tropical/`.

- Cierre de misión cinematográfico; estadísticas reales provenientes del motor.
- Mostrar puntaje, rango, exposición final, resultados por objetivo y sugerencias de aprendizaje.
- Mostrar cambio pre/post **solo si el test previo existe**; si el usuario lo omitió, indicar solo resultado posterior.
- Explicar el rango y las reglas de oro en lenguaje comprensible.
- CTA para reintentar y volver al inicio; botón de resumen anónimo opcional.
- No afirmar que se otorgó una certificación profesional real. Etiquetas de rango o «acreditación» deben aclararse como **logros internos del juego**.

### 5.8 Pantallas que faltan en el ZIP

El paquete no ofrece HTML de referencia específicos para **selector de misiones independiente, test previo, test posterior, glosario, ajustes ni adaptaciones móviles de todas las vistas**. Diseñarlos como extensiones coherentes del nuevo sistema; no presentar esos diseños como si Stitch ya los hubiera entregado.

---

## 6. Narrativa y experiencia de juego

**Estructura:** un incidente creciente en NovaPay que el jugador investiga desde comunicaciones hasta contención. Los cuatro niveles mantienen su propia mecánica, pero se sienten capítulos de la misma investigación.

- **Prólogo:** se detectan anomalías en las comunicaciones de NovaPay.
- **Misión 1:** se identifican riesgos en tránsito.
- **Misión 2:** se descubren fallas de protección de información almacenada.
- **Misión 3:** se localizan errores de configuración y gestión de secretos.
- **Misión 4:** se toman decisiones para contener la fuga.
- **Epílogo:** resultados, explicación de controles y posibilidad de repetir.

Las transiciones deben ser **breves, omitibles y coherentes con el estado real**. No presentar al jugador como atacante ni reemplazar contenido defensivo por estética de crimen.

### Retroalimentación en dos capas

1. **Inmediata:** «Amenaza contenida», «Exposición +20 %», «+100 puntos», icono y animación breve.
2. **Educativa:** «Qué observó el atacante», «Por qué ocurrió», «Cómo se corrige», con detalle técnico expandible y enlace al glosario.

El sonido, si se incorpora, es **opcional y desactivado por defecto**. Debe inicializarse por gesto del usuario, fallar de forma silenciosa si Web Audio no está disponible y respetar ajustes de accesibilidad.

---

## 7. Seguridad, recursos y propiedad intelectual

### No copiar material ajeno

El ZIP incluye dos imágenes de referencia de GTA VI (`image.png_1` y `image.png_2`) y otras ilustraciones. **Excluir por defecto las imágenes de GTA VI del sitio publicado**; no reutilizar marcas, escenas, personajes o composiciones directamente reconocibles. Para las ilustraciones generadas, verificar autorización de uso, procedencia y coherencia narrativa antes de integrarlas.

### Sustituir dependencias externas de Stitch

- **Tailwind CDN:** no incorporar `https://cdn.tailwindcss.com` en producción; transformar las reglas a CSS del juego. Si se decidiera usar Tailwind, compilarlo durante build, no desde CDN.
- **Google Fonts / Material Symbols:** preferir SVG local y tipografías autorizadas locales o del sistema.
- **Google-hosted image URLs:** obtener versiones locales solo cuando exista permiso de uso; optimizar como WebP/AVIF o SVG según corresponda.
- **CSP:** mantener `script-src 'self'`, `style-src 'self'` y las políticas aplicables; evitar `unsafe-inline` como solución rápida para que funcione el HTML prototipo.
- **Recursos:** texto alternativo cuando sea informativo, `aria-hidden` cuando sea decorativo, dimensiones definidas y lazy loading para ilustraciones secundarias.

### Medios y rendimiento

- Portada con imágenes responsivas (`srcset` cuando aplique) y compresión suficiente para móvil.
- Evitar imágenes gigantes para pequeños iconos.
- No depender de audio, video o animaciones para completar los retos.
- Evitar flashes y efectos fuertes; respetar `prefers-reduced-motion`.
- Mantener el sitio utilizable con conexiones móviles moderadas.

---

## 8. Plan de trabajo por prioridades

### P0 — Integración imprescindible

- [ ] Auditar repositorio y registrar pruebas de referencia antes de editar.
- [ ] Integrar tokens y sistema tipográfico de Tropical Cybercrime Thriller.
- [ ] Portada visual con inicio directo y test opcional.
- [ ] HUD compacto y visible en móvil.
- [ ] Aplicar nueva estructura visual a los cuatro minijuegos sin reemplazar sus motores.
- [ ] Retroalimentación inmediata + detalle técnico expandible.
- [ ] Adaptar resultados sin datos ficticios.
- [ ] Eliminar dependencias remotas de los prototipos de Stitch.
- [ ] Verificar que la partida completa siga funcionando.

### P1 — Experiencia de videojuego

- [ ] Conectar transiciones narrativas entre misiones.
- [ ] Integrar ilustraciones originales y licenciadas.
- [ ] Mejorar selección de capítulos y estados de misión.
- [ ] Diseñar test, glosario y ajustes coherentes con el sistema visual.
- [ ] Crear transiciones y recompensas ligeras sin distraer.

### P2 — Pulido opcional

- [ ] Sonidos procedimentales voluntarios.
- [ ] Iluminación sutil, sombras cromáticas y microinteracciones.
- [ ] Animaciones de cierre y logros internos.
- [ ] Optimización adicional de cargas visuales.

**Regla:** P2 no debe retrasar una entrega pública completa y estable de P0.

---

## 9. Pruebas y criterios de aceptación

### Pruebas automatizadas

1. Ejecutar la **suite real existente** y registrar el resultado inicial.
2. Mantener todas las pruebas válidas en verde tras cada fase. No fijar «255/255» como cifra universal si el repositorio actual cambió.
3. Añadir pruebas para navegación de misiones, ausencia de resultados pre/post inventados, actualizaciones del HUD y manejo de preferencias.
4. Verificar integridad del JSON y del grafo del incidente.
5. Verificar ausencia de código o dependencias que incumplan CSP.
6. No modificar aserciones para ocultar errores; si cambió legítimamente el contrato de estado, actualizar pruebas justificando el cambio.

### Pruebas en navegador real

| Escenario | Resultado esperado |
|---|---|
| Primera visita | CTA permite jugar inmediatamente sin test previo obligatorio |
| Test previo omitido | El resumen final no inventa mejora |
| Nivel 1 | Los tres controles responden y explican decisiones |
| Nivel 2 | Clasificación operativa con toque, clic y teclado |
| Nivel 3 | Selección de línea y remediación funcionan |
| Nivel 4 | El grafo toma rutas y consecuencias correctas |
| Respuestas incorrectas | Se actualizan exposición y feedback sin errores |
| Umbral de falla | Reinicio y recuperación adecuados |
| Retomar partida | Persistencia según reglas definidas |
| Glosario y ajustes | Accesibles desde toda la experiencia |
| Móvil 390×844 | HUD visible, controles usables, sin scroll horizontal |
| Tablet 768×1024 | Distribución legible, sin superposiciones |
| Escritorio 1280×800 | Uso eficaz del espacio, sin paneles saturados |
| Teclado | Tab, Enter, Espacio y Escape funcionan apropiadamente |
| Movimiento reducido | Las animaciones prescindibles se detienen |
| Red y consola | Sin 404 de assets ni errores JavaScript inesperados |
| CSP | Sin violaciones durante navegación completa |

### Validación educativa

- Realizar 3–5 sesiones observadas con participantes del público objetivo, si es posible.
- Medir si pueden encontrar el botón de inicio y comprender qué hacer en cada nivel sin asistencia.
- Registrar errores de interpretación, puntos de abandono y confusión entre datos observados y soluciones.
- Corregir primero los errores de comprensión, luego los detalles estéticos.

---

## 10. Despliegue y documentación

1. Mantener repositorio Git con código fuente completo y sin credenciales reales.
2. Publicar en un hosting gratuito compatible (el proyecto ya ha utilizado Vercel; no es obligatorio migrarlo).
3. Comprobar que `_headers` solo funciona donde el proveedor lo soporte; configurar CSP y demás cabeceras **en la plataforma real de despliegue**, no suponer que Vercel lee automáticamente el archivo `_headers` de Cloudflare/Netlify.
4. Verificar HTTPS y recorrer el sitio desde la URL pública, no solo desde localhost.
5. En `README.md` documentar: mecánicas, stack real, cómo ejecutar y probar, fuentes/atribuciones de ilustraciones, cambios de diseño, herramientas de IA utilizadas y sus aportes, limitaciones conocidas y enlace público.

### Evidencias de entrega

- [ ] URL pública jugable.
- [ ] Código completo y README.
- [ ] Capturas desktop y móvil de portada y cuatro niveles.
- [ ] Captura de resultados reales.
- [ ] Reporte de pruebas automatizadas y manuales.
- [ ] Registro verificable de uso de IA (Stitch y otras herramientas realmente utilizadas).

---

## 11. Instrucción lista para un agente de desarrollo

> Implementa en la aplicación existente **Alerta de Fuga** el rediseño **Tropical Cybercrime Thriller** utilizando como referencia `stitch_alerta_de_fuga_cyber_thriller (1).zip`, prioritariamente el `DESIGN.md` de `tropical_cybercrime_thriller`, las seis pantallas `screen.png` y sus HTML de prototipo. **No reescribas los motores del juego, no copies HTML estático como si fuera funcional y no introduzcas CDN externos ni imágenes de GTA VI.** Inspecciona primero el repositorio y ejecuta sus pruebas para establecer una línea base; identifica cada vista existente y modifica principalmente CSS y composición visual. Conserva cuatro minijuegos, puntuaciones, exposición, tests opcionales, glosario, accesibilidad, persistencia y seguridad. Prioriza portada cinematográfica, HUD móvil, controles claros, nueva identidad rosa/coral/violeta y resultados narrativos. Usa ilustraciones originales con derechos comprobados y trata el arte como complemento de la jugabilidad. Verifica navegación de extremo a extremo en móvil y escritorio, CSP, consola, red y suite automatizada. Entrega un resumen por archivo modificado, pruebas ejecutadas, resultados y cualquier limitación.

---

## 12. Definición de terminado

La integración estará terminada cuando **una persona ajena al proyecto** pueda abrir la URL pública, reconocer claramente la identidad cinematográfica de **Alerta de Fuga**, comenzar a jugar, completar los cuatro minijuegos y llegar a resultados educativos correctos **sin ayuda, fallas funcionales, dependencias externas inesperadas ni barreras importantes de accesibilidad**.

**Importante:** este documento es una **especificación de integración** basada en el ZIP de Stitch y en los requisitos tratados para el juego. No certifica que el código existente o la versión desplegada cumplan todavía esos criterios.
