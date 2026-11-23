# Alerta de Fuga — Plan final de implementación

**Subtítulo:** Auditoría criptográfica interactiva  
**Tema:** OWASP Top 10:2025 — A04: Fallas Criptográficas  
**Tipo:** Juego web educativo, estático y responsive  
**Versión:** 3.0 — especificación final para implementación  
**Estado:** Plan aprobado para desarrollo; no representa funcionalidades ya implementadas  
**Idioma inicial:** Español  
**Público:** Estudiantes y público general sin necesidad de conocimientos previos

---

## 1. Resumen ejecutivo

**Alerta de Fuga** es un juego educativo en el que el participante asume el rol de analista junior de ciberseguridad de **NovaPay**, una empresa financiera ficticia. Su misión consiste en detectar fallas criptográficas, proteger información, localizar configuraciones inseguras y responder a una filtración simulada.

El juego enseña mediante **cuatro minijuegos distintos** en lugar de limitarse a una trivia. Cada decisión produce retroalimentación inmediata: qué podría observar o aprovechar un atacante, por qué existe el riesgo y cuál sería el control apropiado. Al inicio y al final se incluyen evaluaciones breves para estimar el aprendizaje.

**Objetivo general:** transformar la comprensión de las fallas criptográficas en una experiencia interactiva, visual y accesible, con decisiones fundamentadas en escenarios realistas.

### Requisitos académicos y evidencias

| Requisito | Solución prevista | Evidencia de aceptación |
|---|---|---|
| Contenido técnico | Casos de fallas criptográficas, riesgos, ejemplos y mitigaciones | Cuatro niveles y glosario revisados frente a OWASP |
| Interactividad | Inspección, clasificación, búsqueda de errores y toma de decisiones ramificadas | Partida íntegra operativa |
| IA generativa | Apoyo documentado en diseño, programación, redacción y/o recursos | Registro verificable en README; sin inventar herramientas utilizadas |
| Interfaz responsive | Móvil primero, teclado, estados claros y contraste adecuado | Pruebas en móvil y escritorio |
| Publicación gratuita | Cloudflare Pages o Netlify | URL HTTPS pública que carga sin instalación |
| Funcionamiento | Pruebas de lógica, contenido y navegación | Cero errores bloqueantes en recorrido completo |
| Entregables | Enlace público, repositorio y descripción del uso de IA | README final y código fuente íntegro |

## 2. Alcance y prioridades

### 2.1 MVP obligatorio

1. Portada con historia, misión, controles y acceso al juego.
2. Guía visual opcional de aproximadamente un minuto.
3. Test previo de cinco preguntas, omitible.
4. Cuatro niveles con **mecánicas realmente distintas**.
5. Feedback educativo después de cada decisión.
6. Barra de exposición, puntos, progreso y reintentos coherentes.
7. Test posterior de cinco preguntas equivalentes (no idénticas) a las iniciales.
8. Pantalla de resultados con puntaje, rango, desempeño por objetivo y cinco recomendaciones.
9. Glosario disponible durante la partida.
10. Diseño responsive, navegación por teclado y ajustes básicos de accesibilidad.
11. Persistencia local de progreso sin datos personales.
12. Publicación HTTPS y README con registro real de IA.

### 2.2 Mejoras opcionales, posteriores al MVP

- Exportación de resumen anónimo de la sesión.
- Sonido con control explícito de activación/desactivación.
- Idiomas adicionales e infraestructura completa de internacionalización.
- Animaciones narrativas y recursos artísticos adicionales.
- Nota introductoria sobre criptografía poscuántica.
- Auditorías de seguridad avanzadas y métricas adicionales.

**Principio de priorización:** primero debe funcionar una partida completa; después se pulen efectos, contenido complementario y automatizaciones.

## 3. Objetivos de aprendizaje

Al completar el juego, la persona podrá:

| ID | Objetivo | Evidencia dentro del juego |
|---|---|---|
| O1 | Reconocer comunicaciones inseguras y controles de transporte | Inspector de paquetes y decisiones de incidente |
| O2 | Diferenciar cifrado, hashing, tokenización y minimización | Clasificador de datos |
| O3 | Identificar algoritmos, modos criptográficos y prácticas débiles | Clasificador y caza de errores |
| O4 | Reconocer fallas de gestión de secretos, claves y aleatoriedad | Caza de errores y simulacro |
| O5 | Seleccionar respuestas proporcionadas ante exposición de información | Clasificador y simulacro |

**Criterio pedagógico:** cada reto debe evaluar una decisión concreta y explicar sus consecuencias. No se deben presentar analogías como si fueran equivalencias técnicas exactas.

## 4. Narrativa y flujo

**Contexto:** NovaPay presenta indicios de exposición de datos. El participante, como analista junior, audita cuatro componentes del sistema mientras una barra de **Exposición** refleja el impacto acumulado de decisiones incorrectas.

```text
INICIO
  ├── Guía visual (opcional)
  ├── Ajustes
  └── Test previo (5 preguntas; opcional)
           ↓
  NIVEL 1: El Túnel Abierto
           ↓
  NIVEL 2: La Bóveda de Texto Plano
           ↓
  NIVEL 3: Llaves bajo el Tapete
           ↓
  NIVEL 4: Simulacro de Brecha
           ↓
  TEST POSTERIOR (5 preguntas)
           ↓
  RESULTADOS + RECOMENDACIONES
           ├── Reintentar
           └── Volver a inicio
```

- Cada nivel se desbloquea al completar el anterior; una opción de reintentar permite repetir niveles completados.
- Los errores incrementan la exposición hasta un máximo de 100 %.
- Al llegar a 100 %, se muestra una explicación del fallo y se ofrece **Reintentar nivel**; no se borra el progreso anterior.
- La exposición se reinicia a 0 % al empezar un nuevo nivel o reintento.
- El jugador no recibe castigo por detenerse a leer las explicaciones.

## 5. Diseño de los cuatro niveles

Cada reto se guarda como dato estructurado con identificador, objetivo educativo, escenario, opciones, respuesta o evaluación correcta, severidad, retroalimentación y referencia documental. **No se deben almacenar claves reales, números de tarjeta reales ni información de personas reales.**

### Nivel 1 — El Túnel Abierto

**Mecánica:** inspector de solicitudes de red. El usuario revisa protocolo, versión TLS, certificado, directivas y contenido simulado; luego elige entre **Permitir**, **Exigir HTTPS/configuración segura** o **Bloquear**.

**Propósito:** O1; comprender protección en tránsito, certificados y configuraciones de transporte.

| # | Situación | Decisión/enseñanza esperada |
|---|---|---|
| 1 | Inicio de sesión por `http://` con credenciales legibles en el ejemplo | No transmitir credenciales; exigir HTTPS |
| 2 | API de pagos con TLS 1.3, certificado válido y controles adecuados | Permitir bajo las condiciones presentadas |
| 3 | Visita inicial por HTTP susceptible a degradación, sin HSTS ni precarga | Migrar a HTTPS, redirigir apropiadamente y usar HSTS/preload cuando corresponda |
| 4 | Certificado vencido o no confiable en una pasarela | Bloquear la operación hasta restaurar la confianza; no ignorar la advertencia |
| 5 | Checkout HTTPS que intenta cargar JavaScript activo desde HTTP | Bloquear contenido inseguro y corregir origen HTTPS |
| 6 | Endpoint que admite únicamente TLS 1.0 y RC4 | Rechazar la configuración obsoleta y actualizar a protocolos y suites aceptables |

**Precisión obligatoria:** la falta de HSTS no prueba por sí sola una interceptación; HSTS reduce el riesgo de degradación en visitas posteriores y, mediante *preload*, puede proteger la primera visita. Un certificado autofirmado no es automáticamente inseguro en todo contexto: lo relevante es si existe una cadena de confianza válida para el entorno y cliente previstos.

### Nivel 2 — La Bóveda de Texto Plano

**Mecánica:** clasificar tarjetas de registros según el tratamiento recomendado. En escritorio puede existir arrastrar y soltar; **siempre** debe haber alternativa mediante selección y botones, compatible con táctil y teclado.

**Propósito:** O2, O3 y O5.

**Controles disponibles:** `Hash de contraseñas (Argon2id / bcrypt en legado)`, `Cifrado autenticado (AES-GCM, nonce único)`, `Tokenizar o reducir exposición`, `Eliminar / no almacenar`.

| # | Situación | Solución esperada |
|---|---|---|
| 1 | Contraseña almacenada en MD5 sin salt | Migrar a hashing adecuado para contraseñas, preferentemente Argon2id |
| 2 | Contraseña con SHA-1 rápido | Migrar a Argon2id; bcrypt cuando exista una justificación de compatibilidad |
| 3 | Datos fiscales que la empresa debe recuperar para un proceso legítimo | Cifrado autenticado con gestión segura de claves y minimización |
| 4 | Saldos cifrados con AES-ECB y patrones repetitivos visibles | Sustituir ECB por un esquema autenticado como AES-GCM |
| 5 | Datos cifrados con AES-GCM reutilizando nonce con la misma clave | Impedir reutilización; rediseñar generación de nonces y gestión de claves |
| 6 | PAN completo que no es necesario conservar para la operación | No almacenar; cuando sea necesario, reducir exposición mediante tokenización y controles PCI DSS |
| 7 | CVV guardado después de la autorización | Eliminar y prohibir almacenamiento; no basta con cifrar o tokenizar |
| 8 | Ubicación histórica y campo no necesario para el propósito actual | Eliminar según la política de retención aplicable |

**Precisión obligatoria:** PAN y CVV se tratan por separado. PCI DSS prohíbe conservar el CVV después de la autorización, **incluso cifrado**. No prometer que tokenizar resuelve automáticamente todas las obligaciones de PCI DSS. La seguridad de AES-GCM depende, entre otras condiciones, de la unicidad del nonce por clave y de una implementación correcta.

### Nivel 3 — Llaves bajo el Tapete

**Mecánica:** búsqueda de errores en archivos ficticios de un repositorio. El jugador identifica la línea o región vulnerable y elige la mitigación correcta.

**Propósito:** O3 y O4. Los fragmentos de código deben ser **simulados y no ejecutables** como infraestructura real.

| # | Archivo ficticio | Falla y remediación esperada |
|---|---|---|
| 1 | `config/payments.js` | API key y secreto de firma escritos directamente; retirar, revocar/rotar y gestionar en servicio de secretos |
| 2 | `.env` versionado | Credenciales expuestas en repositorio; invalidar, eliminar exposición y revisar historial/accesos |
| 3 | `backup/storage.yml` | Clave maestra junto al respaldo; separar custodia y controlar accesos, preferir KMS/HSM cuando aplique |
| 4 | `infra/tls.conf` | Certificado cercano a vencer sin proceso de renovación; automatizar renovación y monitoreo |
| 5 | `auth/resetToken.js` | Uso de `Math.random()` para tokens sensibles; usar CSPRNG apropiado |
| 6 | `crypto/envelope.js` | Cifrado RSA sin padding seguro (`NoPadding`); usar RSA-OAEP con parámetros adecuados o esquema moderno de encapsulación |

**Precisión obligatoria:** RSA sin padding es inseguro. PKCS#1 v1.5 y RSA-OAEP **no son lo mismo**; los riesgos y la recomendación de migración dependen del caso de uso. No mostrar todos los usos de PKCS#1 v1.5 como técnicamente idénticos a `NoPadding`. Diferenciar el almacenamiento de secretos de una mera variable de entorno: una variable de entorno no constituye por sí misma un gestor seguro de secretos.

### Nivel 4 — Simulacro de Brecha

**Mecánica:** incidente ramificado con seis fases, tres alternativas por decisión y efectos visibles en una línea de tiempo, puntaje y exposición.

**Propósito:** integrar O1–O5 mediante decisiones de respuesta a incidentes.

**Escenario:** aparecen archivos `.env` de NovaPay y registros de clientes en un foro ficticio. La filtración es simulada y no se enlaza a recursos reales.

| Fase | Decisión principal | Aprendizaje |
|---|---|---|
| 1. Detección | Validar evidencia sin propagar secretos | Triage y manejo seguro de evidencia |
| 2. Contención | Revocar/rotar credenciales expuestas, limitar acceso | Un secreto comprometido no se arregla ocultándolo |
| 3. Evaluación | Identificar alcance de datos y claves comprometidas | Evaluación de impacto y dependencias |
| 4. Protección | Re-cifrar con claves nuevas cuando corresponda y corregir controles | No reutilizar una clave filtrada |
| 5. Recuperación | Restaurar servicios, validar acceso y monitorear | Recuperación segura y controles preventivos |
| 6. Cierre | Documentar, comunicar según obligaciones aplicables y prevenir recurrencias | Transparencia, lecciones aprendidas y mejora |

**Ramas incorrectas:** ocultar el incidente, volver a cifrar con la misma clave filtrada, almacenar CVV, hashear PAN como sustituto universal de controles, retrasar rotación sin justificación o publicar evidencias sensibles.

**Diseño del grafo:** cada elección conduce a un nodo existente y alcanzable. Un nodo puede permitir corrección antes del cierre. Los caminos terminan de forma explícita en éxito, cierre con observaciones o reintento si la exposición llega a 100 %. Se evitarán ciclos no intencionados.

## 6. Mecánica de puntos, exposición y rangos

### 6.1 Reglas

- **Respuesta correcta:** +100 puntos base.
- **Racha:** +50 puntos base al conseguir el 3.º, 6.º, 9.º, etc. acierto consecutivo **dentro del mismo intento de nivel**.
- **Respuesta incorrecta:** 0 puntos por esa decisión, racha vuelve a cero y exposición aumenta según gravedad (10, 15, 20 o 25 puntos porcentuales).
- **Exposición:** inicia en 0 % por nivel, no puede bajar de 0 ni superar 100. El reto debe indicar cuándo una medida de contención reduce exposición, si se decide incluir esa mecánica; para el MVP, los aciertos ordinarios **no la reducen**.
- **Temporizador:** opcional y **no penaliza** cuando se desactiva. Si está activado, puede sumar un bono de 0 a 30 puntos por reto; **no altera el rango**.
- **Retroalimentación:** se muestra independientemente de acertar o fallar. El temporizador se detiene al elegir una respuesta, antes de mostrar feedback.

### 6.2 Fórmulas inequívocas

Para un nivel con `N` decisiones puntuables (en una rama, cuenta el número efectivo de decisiones puntuables de esa ruta):

```text
maxBaseLevel = 100 * N + 50 * floor(N / 3)
basePercent = (baseScore / maxBaseLevel) * 100
visibleScore = baseScore + optionalTimeBonus
exposure = min(100, exposure + penaltyOnWrongAnswer)
```

- El bono por tiempo es independiente del máximo base.
- Si una ruta de nivel 4 tiene número variable de decisiones, registrar el máximo base **correspondiente a la ruta jugada**. Alternativamente, normalizar por un máximo común definido explícitamente; no combinar ambas reglas.
- Para el rango final, calcular el porcentaje como `sum(baseScore de niveles completados) / sum(maxBaseLevel correspondientes) * 100`.
- Para un nivel reintentado, **solo el intento completado elegido para el resultado final** participa en el rango. Guardar mejores puntuaciones por separado, sin sumar puntajes de intentos descartados.
- Cuando `exposure = 100`, el intento queda fallido: no permite pasar de nivel y su puntaje no se agrega al rango final.
- No otorgar rachas entre niveles distintos.

| Porcentaje base final | Rango |
|---|---|
| Menos de 50 % | Aprendiz |
| Desde 50 % hasta menos de 85 % | Analista |
| 85 % o más | Arquitecto Criptográfico |

**Nota de diseño:** el rango describe el resultado *dentro del juego*, no certifica una competencia profesional.

### 6.3 Objetivo más débil

Calcular la tasa de acierto por `objectiveId` considerando decisiones puntuables del intento aceptado y los resultados del test posterior. Mostrar la fuente del cálculo y gestionar empates de forma explícita, por ejemplo con orden de objetivos ascendente. Evitar dividir entre cero cuando un objetivo no tenga decisiones evaluadas.

## 7. Evaluación de aprendizaje

Se prepararán **dos formularios equivalentes de cinco preguntas**, uno previo y otro posterior. Ambos evaluarán **exactamente los mismos cinco objetivos (O1–O5)** con dificultad comparable, pero cambiarán escenarios, ejemplos, orden y alternativas para reducir el efecto de memorización.

- **Previo:** opcional; guardar respuesta y acierto sin mostrar la solución hasta la pantalla final.
- **Posterior:** al finalizar los niveles; mostrar resultado y explicación.
- **Comparación:** indicar `X/5 → Y/5` y diferencia en aciertos solamente cuando ambos tests estén presentes.
- **Previo omitido:** mostrar únicamente `Y/5`, sin mejora calculada ni valores ficticios.
- **Contenido educativo:** no afirmar que cinco preguntas constituyen una prueba científica de aprendizaje; son un indicador introductorio.
- **Privacidad:** no recolectar nombres, correos, IPs mediante lógica de aplicación ni otros datos personales.

## 8. Experiencia visual y accesibilidad

### 8.1 Concepto visual

Estética de **consola de seguridad contemporánea**, con interfaces claras, alertas diferenciables, tarjetas legibles y simulaciones que no se confunden con operaciones reales sobre infraestructura.

| Token | Valor |
|---|---|
| Fondo | `#0B1016` |
| Superficie | `#131B26` |
| Bordes | `#2A394A` |
| Texto principal | `#F0F6FC` |
| Texto secundario | `#A8B8C8` |
| Seguro | `#3FB950` |
| Advertencia | `#F0B429` |
| Peligro | `#FF6B6B` |
| Información/foco | `#58A6FF` |

**No depender solo del color:** acompañar estados de texto e iconos; comprobar contraste sobre los fondos reales de cada componente, incluido texto dentro de botones de color.

### 8.2 Diseño adaptativo

- Móvil primero. Objetivo de prueba: **390 × 844** y escritorio **1280 × 800**, además de anchos intermedios.
- Controles táctiles amplios, idealmente al menos 44 × 44 px cuando sea posible.
- En móvil: navegación y escenario en una columna. En escritorio: escenario principal y panel de estado cuando haya espacio.
- Evitar scroll horizontal; permitir zoom y tamaños de fuente del navegador.
- Apoyar `prefers-reduced-motion` y ofrecer ajuste de animaciones reducidas.
- El temporizador se puede desactivar; evitar urgencia innecesaria para aprender.

### 8.3 Accesibilidad funcional

- HTML semántico, `lang="es"`, encabezados coherentes y enlace «Saltar al contenido».
- Foco visible, orden de tabulación lógico y etiquetas comprensibles.
- Interacción por teclado en los cuatro juegos, incluso cuando haya drag-and-drop visual.
- Glosario y ajustes: modal o panel accesible con manejo correcto de foco y tecla Escape.
- Anuncios `aria-live` reservados para eventos importantes; no saturar lectores de pantalla.
- Barra de exposición con etiqueta, valor actual y límite.
- Pruebas manuales además de herramientas automáticas: **Lighthouse ≥ 90 es una meta de calidad, no prueba de conformidad WCAG**.

## 9. Arquitectura y estructura del proyecto

### 9.1 Decisiones técnicas

- **HTML5 + CSS3 + JavaScript ES Modules puro**, sin framework ni bundler.
- **JSON** para contenido educativo y configuración de los retos.
- `localStorage` para preferencias y progreso básico, no para secretos.
- Sin backend, autenticación, pagos ni conexiones a servicios financieros reales.
- Fuentes de sistema, SVG locales y ausencia de CDN en el MVP.
- Tests de lógica con `node --test`; documentar versión de Node compatible, por ejemplo Node 24 LTS.
- Hosting preferente: **Cloudflare Pages o Netlify** para disponer de soporte al archivo `_headers`.

### 9.2 Carpetas sugeridas

```text
alerta-de-fuga/
├── index.html
├── _headers
├── README.md
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── minigames.css
├── assets/
│   ├── logo.svg
│   ├── analyst.svg
│   ├── attacker.svg
│   └── ecb-pattern.svg
├── data/
│   ├── glossary.json
│   ├── quiz-pre.json
│   ├── quiz-post.json
│   └── levels/
│       ├── nivel-1.json
│       ├── nivel-2.json
│       ├── nivel-3.json
│       └── nivel-4.json
├── js/
│   ├── main.js
│   ├── engine/
│   │   ├── dataLoader.js
│   │   ├── state.js
│   │   ├── scoring.js
│   │   ├── router.js
│   │   └── a11y.js
│   ├── minigames/
│   │   ├── inspector.js
│   │   ├── classifier.js
│   │   ├── codeHunt.js
│   │   └── branchingIncident.js
│   └── views/
│       ├── homeView.js
│       ├── quizView.js
│       ├── gameView.js
│       ├── resultsView.js
│       ├── glossaryDrawer.js
│       └── settingsModal.js
└── tests/
    ├── scoring.test.js
    └── data-integrity.test.js
```

Se **pospone** `i18n/` hasta que exista una necesidad real de otros idiomas. Los textos del MVP se mantienen en español y pueden concentrarse en archivos de datos o módulos sencillos; no duplicarlos sin necesidad.

### 9.3 Contratos mínimos

**Interfaz de los minijuegos:**

```js
mount(container, levelData, callbacks)
destroy()
```

`callbacks` comunica elección, puntaje o exposición sin que cada minijuego altere libremente el estado global. `destroy()` elimina listeners, temporizadores y referencias al desmontar.

**Ejemplo de estructura de reto (orientativa):**

```json
{
  "id": "n1-r1",
  "objectiveId": "O1",
  "type": "inspector",
  "title": "Inicio de sesión sin HTTPS",
  "scenario": "Un formulario transmite credenciales por HTTP.",
  "options": [
    { "id": "allow", "label": "Permitir" },
    { "id": "require_https", "label": "Exigir HTTPS" },
    { "id": "block", "label": "Bloquear definitivamente" }
  ],
  "correctOptionId": "require_https",
  "exposureDelta": 20,
  "feedback": {
    "attackerView": "Una persona en posición de interceptar el tráfico podría leer datos transmitidos sin TLS.",
    "why": "HTTP no cifra el contenido durante el tránsito.",
    "correctControl": "Aplicar HTTPS válido y evitar enviar credenciales hasta establecer una conexión protegida.",
    "glossaryTermId": "tls"
  },
  "owaspRef": "https://top10.owasp.org/2025/A04_2025-Cryptographic_Failures/"
}
```

**Importante:** `owaspRef` debe apuntar a una fuente adecuada para la afirmación concreta; cuando se necesite precisión adicional, incluir un Cheat Sheet de OWASP u otra norma pertinente. Los textos de feedback deben poder adaptarse a cada alternativa y no contradecir la elección efectuada.

## 10. Glosario y retroalimentación

### 10.1 Glosario mínimo

`texto-plano`, `mitm`, `tls`, `https`, `hsts`, `certificado-digital`, `hash`, `salt`, `argon2id`, `bcrypt`, `aes-gcm`, `aes-ecb`, `nonce-iv`, `tokenizacion`, `rsa-oaep`, `gestion-secretos`, `csprng`, `minimizacion-datos`.

Cada entrada tendrá: término, definición sencilla, analogía cotidiana cuando aporte claridad, advertencia sobre límites de la analogía y enlace al reto relacionado.

### 10.2 Feedback por decisión

Mostrar tres bloques cortos, preferiblemente con un máximo aproximado de tres frases principales:

1. **Qué podría aprovechar el atacante.** Impacto del fallo en el contexto simulado.
2. **Por qué ocurre.** Causa técnica explicada en lenguaje comprensible.
3. **Cómo prevenirlo.** Acción concreta y enlace al glosario o fuente.

El feedback no debe describir un ataque exitoso cuando el escenario solo muestra una condición de riesgo.

## 11. Persistencia y privacidad

Guardar en `localStorage` una única estructura versionada, por ejemplo `alerta_de_fuga_progress_v1`:

- Niveles desbloqueados.
- Mejor resultado por nivel.
- Resultado del intento completado usado para el rango final.
- Preferencias: temporizador activado y movimiento reducido.
- Resultados agregados de las pruebas, si el usuario decide conservarlos.

No guardar contraseñas, datos de tarjetas, claves de ejemplo utilizables, identificadores personales ni contenido ajeno al juego. Ofrecer un botón **Restablecer progreso** con confirmación. Si falla el acceso a `localStorage`, permitir jugar en memoria durante la sesión.

## 12. Seguridad del sitio

### 12.1 Medidas

- Sitio estático bajo HTTPS y sin servicios externos necesarios para jugar.
- No ejecutar fragmentos de código de los escenarios ni procesar HTML arbitrario procedente de JSON.
- Renderizar contenido como texto seguro salvo elementos construidos de forma controlada.
- Sin scripts ni manejadores de eventos inline; usar `addEventListener`.
- `Content-Security-Policy` restrictiva y adaptada al código efectivamente implementado.
- Control de acceso al repositorio y revisión de secretos antes de publicar.

### 12.2 Archivo `_headers` (Cloudflare Pages / Netlify)

```text
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

**Notas de implementación:**

- Verificar que la plataforma publica realmente estas cabeceras; GitHub Pages no procesa `_headers` del mismo modo.
- `includeSubDomains` solo debe mantenerse cuando se controla y sirve HTTPS en todos los subdominios afectados. No añadir `preload` automáticamente: requiere comprobar criterios y aceptar implicaciones operativas.
- La CSP puede exigir ajustes si se modifica la arquitectura; probar en el navegador y no relajarla arbitrariamente.
- No se promete una calificación perfecta en herramientas de auditoría ni que las cabeceras sustituyan una revisión de seguridad.

## 13. Plan de implementación

| Fase | Trabajo | Criterio para avanzar |
|---|---|---|
| 1. Base | Estructura, estilos, navegación, datos mínimos, estado y portada | Vistas navegables sin errores |
| 2. Juego | Inspector, clasificador, caza de errores y simulacro | Se puede terminar cada nivel con aciertos y errores |
| 3. Aprendizaje | Feedback, glosario, tests equivalentes y resultados | Recorrido completo consistente |
| 4. Calidad | Responsive, teclado, validación técnica y tests | Sin fallas bloqueantes |
| 5. Entrega | Publicación, README, registro de IA y validación pública | URL y repositorio comprobables |

**Prioridad crítica:** si falta tiempo, reducir animaciones y funciones secundarias, no eliminar la retroalimentación pedagógica ni publicar un nivel sin terminar.

## 14. Pruebas y criterios de aceptación

### 14.1 Automatizadas

Ejecutar, desde la raíz del proyecto:

```bash
node --test tests/scoring.test.js tests/data-integrity.test.js
```

Casos mínimos:

- Acierto, error, tres aciertos seguidos y reinicio de racha.
- Exposición limitada entre 0 y 100; manejo de fallo al llegar a 100.
- Bono de tiempo desactivado sin degradar el rango.
- Suma de puntos y rango final sin duplicar reintentos.
- División por cero evitada al calcular porcentajes.
- JSON válido, identificadores únicos y referencias a objetivos/glosario existentes.
- Cada pregunta de test previo/posterior cubre un objetivo distinto; cinco por formulario.
- Cada nivel contiene sus escenarios previstos; el nivel 4 tiene seis fases funcionales y destinos de grafo válidos.
- No hay secretos reales ni información de pago auténtica en los recursos.

### 14.2 Prueba en navegador

Servidor local (no abrir `index.html` directamente mediante `file://`, porque los módulos y `fetch` pueden requerir HTTP):

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080` y verificar:

1. Inicio → guía → ajustes → test previo → cuatro niveles → test posterior → resultados.
2. Rutas de acierto, error, reintento y exposición 100 %.
3. Navegación con Tab, Shift+Tab, Enter, espacio, Escape y flechas donde corresponda.
4. Clasificador operable con toque, mouse y teclado.
5. Glosario disponible y retorno correcto del foco.
6. Adaptación a 390 × 844, 1280 × 800 y al menos un tamaño intermedio.
7. Sin errores bloqueantes de consola, solicitudes 404 o rutas rotas.
8. Preferencias y progreso recuperables tras recargar.
9. Auditoría Lighthouse para accesibilidad y buenas prácticas; meta ≥ 90, sin confundirla con certificación WCAG.

### 14.3 Pruebas con personas

Recomendado: **cinco participantes del público objetivo**, registrando de manera anónima:

| Sesión | ¿Terminó? | Dificultad observada | Hallazgo | Acción correctiva |
|---|---|---|---|---|
| P1 | Pendiente | Pendiente | Pendiente | Pendiente |
| P2 | Pendiente | Pendiente | Pendiente | Pendiente |
| P3 | Pendiente | Pendiente | Pendiente | Pendiente |
| P4 | Pendiente | Pendiente | Pendiente | Pendiente |
| P5 | Pendiente | Pendiente | Pendiente | Pendiente |

No completar la tabla con resultados inventados. Si se efectúa revisión técnica por otra persona, registrar su alcance y observaciones reales.

### 14.4 Definición de terminado (Definition of Done)

- [ ] Los cuatro minijuegos funcionan y son mecánicamente diferenciables.
- [ ] Todos los escenarios tienen respuesta, explicación y control preventivo coherentes.
- [ ] Se completan partidas con y sin test previo.
- [ ] Puntaje, exposición, rangos y reintentos son consistentes.
- [ ] No se requieren instalaciones, cuentas ni servicios de pago para jugar.
- [ ] Se juega en móvil y escritorio; existe alternativa de teclado para todas las mecánicas.
- [ ] No hay fallos bloqueantes en el recorrido de extremo a extremo.
- [ ] El enlace HTTPS público funciona en una ventana privada.
- [ ] El repositorio contiene el código íntegro y las instrucciones de ejecución.
- [ ] El README describe el uso **real** de IA, con revisión humana.
- [ ] El contenido técnico fue contrastado con las referencias indicadas.

## 15. Publicación gratuita

**Preferencia:** Cloudflare Pages o Netlify, porque admiten hosting estático y reglas de cabeceras mediante `_headers`.

Proceso previsto:

1. Crear repositorio `alerta-de-fuga` en GitHub con el proyecto estático en la raíz.
2. Validar que no existan secretos ni datos sensibles reales.
3. Vincular el repositorio a Cloudflare Pages o Netlify.
4. Configurar la raíz como directorio de publicación; sin comando de build para la versión HTML/CSS/JS pura.
5. Publicar y verificar URL HTTPS desde incógnito y móvil.
6. Confirmar la carga de JSON, JavaScript, SVG y cabeceras de seguridad.
7. Agregar enlace del juego y código fuente al README.

**No insertar enlaces ficticios en la entrega:** reemplazar los campos solo después del despliegue efectivo.

## 16. Documentación y evidencia de IA generativa

El `README.md` del repositorio debe contener:

1. Nombre y descripción de **Alerta de Fuga**.
2. Tema OWASP A04:2025 y objetivos pedagógicos.
3. Capturas o explicación breve de los cuatro niveles.
4. Cómo ejecutar localmente el proyecto.
5. Stack, estructura de carpetas y créditos/licencias.
6. Enlace público del juego y URL del repositorio.
7. Qué herramientas de IA se utilizaron **realmente**, en qué tareas y qué fue corregido o validado manualmente.
8. Estado de pruebas, limitaciones conocidas y fuentes técnicas.

Plantilla de registro (no completar con afirmaciones no verificadas):

| Herramienta de IA | Uso concreto | Resultado utilizado | Validación o corrección humana |
|---|---|---|---|
| Pendiente | Pendiente | Pendiente | Pendiente |

## 17. Riesgos y mitigaciones

| Riesgo | Impacto | Respuesta |
|---|---|---|
| Alcance excesivo | Cuatro niveles incompletos | Congelar extras; priorizar partida de extremo a extremo |
| Explicaciones imprecisas | Aprendizaje incorrecto | Revisar OWASP, PCI DSS y contexto específico |
| Mismos ítems en ambos tests | Memorización en vez de transferencia | Versiones equivalentes con situaciones distintas |
| Interacción basada solo en drag-and-drop | Fallas en móvil/teclado | Selección y botones como alternativa obligatoria |
| Gráfico visual por encima de usabilidad | Confusión o accesibilidad deficiente | Texto claro, contraste, tamaños táctiles y pruebas reales |
| Progreso y puntos inconsistentes | Resultados engañosos | Estado centralizado y pruebas del motor |
| Publicación con rutas rotas o CSP incompatible | Juego inaccesible | Prueba real de hosting y consola tras despliegue |

## 18. Fuentes técnicas de referencia

- **OWASP Top 10:2025 — A04 Cryptographic Failures:** https://top10.owasp.org/2025/A04_2025-Cryptographic_Failures/
- **OWASP Top 10:2025 — A04 (español):** https://top10.owasp.org/2025/es/A04_2025-Cryptographic_Failures/
- **OWASP Password Storage Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- **OWASP Cryptographic Storage Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- **OWASP Transport Layer Security Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html
- **PCI Security Standards Council — CVV después de autorización:** https://www.pcisecuritystandards.org/faqs/are-merchants-allowed-to-request-card-verification-codes-values-from-cardholders/
- **WCAG 2.2:** https://www.w3.org/TR/WCAG22/

---

## 19. Entrega final

**Nombre del proyecto:** Alerta de Fuga  
**Tema:** Fallas criptográficas (OWASP A04:2025)  
**Enlace público:** `PENDIENTE_DE_DESPLIEGUE`  
**Repositorio de código fuente:** `PENDIENTE_DE_PUBLICACIÓN`  
**Descripción y evidencia de IA utilizada:** documentar en `README.md` tras su uso real.

### Declaración de éxito

El proyecto se considerará listo para entrega **únicamente** cuando una persona externa pueda acceder al sitio mediante un enlace público, completar los cuatro niveles sin instalar nada, comprender los riesgos y mecanismos de prevención, consultar sus resultados y acceder al código fuente y documentación del uso de IA.
