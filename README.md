# Alerta de Fuga — Auditoría Criptográfica (OWASP A04:2025)

**Alerta de Fuga** es un juego educativo web estático, accesible y responsive en español en el que asumes el rol de analista junior de ciberseguridad de **NovaPay** (una entidad financiera ficticia) para auditar sistemas simulados frente a **OWASP Top 10:2025 — A04: Fallas Criptográficas**.

- **Enlace público del juego:** `PENDIENTE_DE_DESPLIEGUE`
- **Repositorio de código fuente:** https://github.com/AngelitoCastro/alerta-de-fuga

---

## 1. Objetivos pedagógicos (O1–O5)

| ID | Objetivo | Evidencia en el juego |
|---|---|---|
| O1 | Reconocer comunicaciones inseguras y controles de transporte | Nivel 1 (Inspector de red) y Nivel 4 |
| O2 | Diferenciar cifrado, hashing, tokenización y minimización | Nivel 2 (Clasificador de datos) |
| O3 | Identificar algoritmos, modos criptográficos y prácticas débiles | Nivel 2 y Nivel 3 |
| O4 | Reconocer fallas de gestión de secretos, claves y aleatoriedad | Nivel 3 y Nivel 4 |
| O5 | Seleccionar respuestas proporcionadas ante exposición de información | Nivel 2 y Nivel 4 |

El juego incluye un **test previo opcional** (5 preguntas sobre O1–O5, sin revelar soluciones hasta el final) y un **test posterior equivalente** con escenarios diferentes para ofrecer un indicador introductorio de comprensión.

---

## 2. Los cuatro niveles interactivos

1. **Nivel 1 — El Túnel Abierto (`inspector.js`):** inspector de solicitudes de red simuladas (HTTP plano, TLS 1.3 válido, degradación sin HSTS/preload, certificado vencido/no confiable, contenido mixto activo y TLS 1.0/RC4).
2. **Nivel 2 — La Bóveda de Texto Plano (`classifier.js`):** clasificador de ocho registros (MD5, SHA-1, datos fiscales recuperables, AES-ECB con ilustración `ecb-pattern.svg`, reutilización de nonce en AES-GCM, PAN, CVV post-autorización y datos innecesarios) operable mediante **selección y botones por teclado/táctil** así como drag-and-drop en escritorio.
3. **Nivel 3 — Llaves bajo el Tapete (`codeHunt.js`):** búsqueda de vulnerabilidades en seis archivos ficticios no ejecutables (`config/payments.js`, `.env`, `backup/storage.yml`, `infra/tls.conf`, `auth/resetToken.js`, `crypto/envelope.js`), seleccionando línea vulnerable y mitigación.
4. **Nivel 4 — Simulacro de Brecha (`branchingIncident.js`):** respuesta ramificada a una filtración simulada en seis fases (*Detección → Contención → Evaluación → Protección → Recuperación → Cierre*) con línea de tiempo de decisiones y cierre formal o con observaciones.

Cada decisión muestra **retroalimentación en tres bloques** (*qué podría aprovechar el atacante*, *por qué ocurre* y *cómo prevenirlo*), acceso al **glosario de 18 términos** con advertencias sobre los límites de cada analogía y referencias técnicas oficiales.

---

## 3. Cómo ejecutar localmente

> **Importante:** no abras `index.html` directamente con `file://`, porque los ES Modules y `fetch('./data/...')` requieren servirse mediante HTTP.

Desde la raíz del proyecto, inicia un servidor HTTP local (por ejemplo con Python 3):

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` en tu navegador.

### Ejecutar pruebas automatizadas (Node.js 24 LTS)

```bash
node --test tests/scoring.test.js tests/data-integrity.test.js
```

Para ejecutar también la suite E2E local sobre servidor HTTP estático:

```bash
node --test tests/e2e/tier1-features.test.js tests/e2e/tier2-boundaries.test.js tests/e2e/tier3-combinations.test.js tests/e2e/tier4-scenarios.test.js
```

---

## 4. Stack y estructura del proyecto

- **Tecnología:** HTML5, CSS3 y JavaScript ES Modules puro. Cero frameworks, cero bundlers, cero CDNs externos y cero dependencias de ejecución.
- **Dirección artística:** **Tropical Cybercrime Thriller** (paleta nocturna violeta `#160D2D`, paneles `#231A3A`/`#2D2545`, acentos atardecer `#FF3377`/`#FF6B35`/`#FFC107`/`#B070D6`, contraste WCAG 2.2 AA verificado) con ilustraciones originales optimizadas localmente en WebP (`assets/hero-cover.webp`, `assets/hero-cover-mobile.webp`, `assets/victory-cover.webp`) y `assets/logo.svg` actualizado.
- **Seguridad cliente:** cabeceras estrictas configuradas en `_headers` (Cloudflare Pages / Netlify) y `vercel.json` (Vercel) con CSP estricta (`script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `font-src 'self'`), renderizado seguro por `textContent` y cero secretos o tarjetas reales.
- **Privacidad:** el progreso se guarda localmente bajo `alerta_de_fuga_progress_v1` sin datos personales, con opción de restablecimiento confirmado y degradación a memoria si `localStorage` no está disponible.

```text
Alerta_de_Fuga/
├── index.html
├── _headers
├── vercel.json
├── README.md
├── assets/
│   ├── analyst.svg
│   ├── attacker.svg
│   ├── ecb-pattern.svg
│   ├── hero-cover.webp
│   ├── hero-cover-mobile.webp
│   ├── logo.svg
│   └── victory-cover.webp
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── minigames.css
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
│   │   ├── a11y.js
│   │   ├── dataLoader.js
│   │   ├── router.js
│   │   ├── scoring.js
│   │   └── state.js
│   ├── minigames/
│   │   ├── inspector.js
│   │   ├── classifier.js
│   │   ├── codeHunt.js
│   │   └── branchingIncident.js
│   └── views/
│       ├── homeView.js
│       ├── guideModal.js
│       ├── quizView.js
│       ├── gameView.js
│       ├── resultsView.js
│       ├── glossaryDrawer.js
│       └── settingsModal.js
└── tests/
    ├── scoring.test.js
    ├── data-integrity.test.js
    └── e2e/
        ├── browser-e2e-playbook.md
        ├── helpers/
        └── tier1..4*.test.js
```

---

## 5. Registro de uso de inteligencia artificial

| Herramienta de IA | Uso concreto | Resultado utilizado | Validación o corrección humana |
|---|---|---|---|
| Google Stitch | Exploración visual y generación de prototipos de referencia y dos ilustraciones originales (*Tropical Cybercrime Thriller*) para portada y cierre de misión | Guía de tokens `DESIGN.md`, referencias de composición y arte original convertido localmente a `assets/hero-cover*.webp` y `assets/victory-cover.webp` (excluyendo referencias de terceros y eliminando CDNs externos) | Revisión de contraste WCAG 2.2 AA, exclusión de material ajeno y reemplazo por recursos locales compatibles con CSP |
| Antigravity (asistente con modelos Gemini) | Configuración de skills/MCP del proyecto, arquitectura modular (motor, datos JSON, estilos, 4 minijuegos, vistas y pruebas automatizadas), integración del rediseño visual y verificación en navegador local | Código fuente en `js/`, `css/`, `assets/`, `data/`, `_headers`, `vercel.json`, `tests/` y documentación | Pendiente de revisión final del autor antes del despliegue público y entrega académica |

---

## 6. Estado de pruebas y limitaciones conocidas

- **Pruebas unitarias e integridad de datos (`node --test`):** implementadas y ejecutables localmente (`tests/scoring.test.js` y `tests/data-integrity.test.js`).
- **Pruebas E2E automatizadas y verificación en navegador:** implementadas sobre servidor HTTP local y comprobadas en escritorio (`1280×800`), ancho intermedio (`768×1024`) y móvil (`390×844`).
- **Despliegue público HTTPS (Fase 5):** `PENDIENTE_DE_DESPLIEGUE`. Verificar las cabeceras HTTP de `_headers` tras publicar en Cloudflare Pages o Netlify.
- **Pruebas con usuarios reales (P1–P5):**

| Sesión | ¿Terminó? | Dificultad observada | Hallazgo | Acción correctiva |
|---|---|---|---|---|
| P1 | Pendiente | Pendiente | Pendiente | Pendiente |
| P2 | Pendiente | Pendiente | Pendiente | Pendiente |
| P3 | Pendiente | Pendiente | Pendiente | Pendiente |
| P4 | Pendiente | Pendiente | Pendiente | Pendiente |
| P5 | Pendiente | Pendiente | Pendiente | Pendiente |

---

## 7. Fuentes técnicas de referencia

- [OWASP Top 10:2025 — A04 Cryptographic Failures](https://top10.owasp.org/2025/A04_2025-Cryptographic_Failures/)
- [OWASP Top 10:2025 — A04 (español)](https://top10.owasp.org/2025/es/A04_2025-Cryptographic_Failures/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [PCI Security Standards Council — CVV después de autorización](https://www.pcisecuritystandards.org/faqs/are-merchants-allowed-to-request-card-verification-codes-values-from-cardholders/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
