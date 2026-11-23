# Browser E2E Verification Playbook — Alerta de Fuga (Milestone M6)

This playbook specifies the exact, executable **Playwright MCP** and **Chrome DevTools MCP** verification matrix to run against the completed static application in Milestone M6.

> **Mandatory Rule (`plan` §14.2):** NEVER open `index.html` via `file://`. ES Modules and `fetch('./data/...')` require HTTP serving.

---

## 1. Local HTTP Server Setup

Start a local HTTP server from `/home/david/Documentos/Alerta_de_Fuga`:

```bash
python3 -m http.server 8080
```

Or use the bundled `webapp-testing` server wrapper when running automated Playwright scripts:

```bash
python3 .agents/skills/webapp-testing/scripts/with_server.py \
  --server "python3 -m http.server 8080" --port 8080 -- <your_command>
```

> **CSP Header Note:** `python3 -m http.server` serves static files without parsing `_headers`. Static CSP/headers verification is enforced by `tests/e2e/tier1-features.test.js` (`T1-F18-1`) and `tests/e2e/tier4-scenarios.test.js` (`T4-S12`) via `tests/e2e/helpers/staticServer.js`. In the browser, verify zero inline `<script>`, `<style>`, `style="..."`, `on*=`, external requests, and console CSP issues.

---

## 2. Playwright MCP Verification Matrix (`playwright`)

### 2.1 Boot, Landmarks & Viewport Matrix (`390×844`, `768×1024`, `1280×800`)

1. `browser_navigate` → `{ "url": "http://localhost:8080/" }`
2. Wait for DOM & JSON settlement (`browser_wait_for` or `browser_snapshot`).
3. Inspect landmarks & touch targets via `browser_snapshot({ "boxes": true })`:
   - Verify `<html lang="es">`, skip link `Saltar al contenido`, `<header>`, `<nav>`, `<main id="main-content">`, `<footer>`, and **single `<h1>`**.
   - Verify primary interactive buttons have bounding box `width >= 44 && height >= 44` CSS px where possible.
4. For each viewport `(390, 844)`, `(768, 1024)`, `(1280, 800)`:
   - Call `browser_resize({ "width": W, "height": H })`
   - Call `browser_evaluate` to assert:
     - `document.documentElement.scrollWidth <= window.innerWidth` (`0` horizontal scroll)
     - `document.querySelectorAll('h1').length === 1`
     - All `<img>` elements (including SVGs) have `complete === true && naturalWidth > 0`
     - Zero inline `style` attributes or `on*=` attributes (`document.querySelectorAll('[style], [onclick]').length === 0`)
   - Capture visual evidence on key mobile (`390×844`) and desktop (`1280×800`) screens with `browser_take_screenshot({ "scale": "css", "fullPage": true })`.

### 2.2 Keyboard-Only Accessibility & Modal Focus Return (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`)

1. At `http://localhost:8080/`:
   - `browser_press_key({ "key": "Tab" })` → verify focus lands on skip link `Saltar al contenido`; `browser_press_key({ "key": "Enter" })` → verify `document.activeElement.id === 'main-content'`.
2. **Guía visual (`guideModal`):**
   - Tab to Guía visual trigger → `Enter` → verify `[role="dialog"]` opens and focus is inside dialog.
   - Press `Tab` / `Shift+Tab` repeatedly → verify via `browser_evaluate` that `dialog.contains(document.activeElement)` remains `true` (focus trap).
   - `browser_press_key({ "key": "Escape" })` → verify dialog closes and `document.activeElement` equals the Guía visual trigger button.
3. **Ajustes (`settingsModal`) & Reset Confirmation:**
   - Open Ajustes via keyboard → verify Timer toggle, Reduced Motion toggle, and `Restablecer progreso`.
   - Activate `Restablecer progreso` → verify confirmation appears (progress NOT wiped yet) → activate `Cancelar` (or `Escape`) → verify progress intact.
   - Close Ajustes with `Escape` → verify focus returns to Ajustes trigger.
4. **Glosario (`glossaryDrawer`):**
   - Open Glosario mid-level (both from header and from a feedback `glossaryTermId` link) → verify target term and its `analogyLimit` warning are visible → press `Escape` → verify focus returns to exact opener button and level progress/score remain intact.

### 2.3 Full Gameplay Journeys & Level 2 Dual Input

1. **Journey A — Full Happy Path (`1280×800`, Pre-Quiz + Timer ON):**
   - Enable Timer in Ajustes → complete 5 Pre-Quiz questions (verify answers/explanations stay hidden during Pre-Quiz).
   - Complete Nivel 1 (6 requests), Nivel 2 (8 cards: test both `browser_click` button selection AND `browser_drag({ startTarget, endTarget })` on desktop, verifying `assets/ecb-pattern.svg` renders), Nivel 3 (6 mock files: line + mitigation), Nivel 4 (6 phases to `success` terminal).
   - Verify 3-block feedback (`attackerView`, `why`, `correctControl`) + `glossaryTermId` + `owaspRef` renders on every hit/miss, `<progress role="progressbar">` updates `aria-valuenow` + visible `X %` text without inline `style=`, and `aria-live="polite"` announces key transitions.
   - Complete 5 Post-Quiz questions → verify Results shows rank (`Arquitecto Criptográfico`), non-certification disclaimer, weakest objective + source, `X/5 → Y/5` comparison + delta, and 5 recommendations.
2. **Journey B — Pre-Quiz Skipped + 100% Exposure Failure + Retry (`390×844` Mobile, Keyboard/Buttons Only):**
   - Click `Omitir test previo` → complete Nivel 1 (`unlockedLevel = 2`).
   - In Nivel 2, complete cards using **ONLY** `Tab`, `Enter`, `Space` (select card + bucket button, zero drag) on misses until `exposure === 100` (`aria-valuenow="100"`).
   - Verify failure screen + `Reintentar nivel`, verify Nivel 1 accepted attempt and `unlockedLevel === 2` remain intact.
   - Retry Nivel 2 and pass via keyboard/button assignment → complete Nivel 3 & 4 (including an `observations`/correction branch test) → complete Post-Quiz → verify Results shows ONLY `Y/5` (no `0/5 → Y/5` or fake delta).

### 2.4 Reduced Motion & `localStorage` Persistence / Reset

1. Call `browser_emulate_media({ "reducedMotion": "reduce" })` and toggle manual `Animaciones reducidas` in Ajustes → verify reduced-motion CSS/attribute applies.
2. Inspect `localStorage` via `browser_evaluate`:
   - `JSON.parse(localStorage.getItem('alerta_de_fuga_progress_v1'))` contains versioned progress & settings, with **zero PII, passwords, real keys, or real PAN/CVV**.
3. Reload page (`browser_navigate` or `location.reload()`) → verify unlocked levels, scores, and `timerEnabled` / `reducedMotion` persist.
4. Confirm `Restablecer progreso` in Ajustes → reload → verify reset to `unlockedLevel === 1` and clean scores.
5. Inspect `browser_console_messages({ "level": "error" })` and `browser_network_requests({ "static": true })`:
   - Assert **0 console errors**, **0 HTTP 404/4xx/5xx**, and **0 external non-localhost requests**.
6. Close browser cleanly (`browser_close`).

---

## 3. Chrome DevTools MCP Verification Matrix (`chrome-devtools`)

1. **Clean-Slate Isolated Context:**
   - `new_page({ "url": "http://localhost:8080/", "isolatedContext": "m6-e2e-clean" })`
2. **Console, CSP & Network Audit:**
   - `list_console_messages({ "pageId": <id>, "includePreservedMessages": true, "types": ["error", "warn", "issue"] })` → assert **0 errors / 0 CSP issues**.
   - `list_network_requests({ "pageId": <id>, "includePreservedRequests": true })` → assert **0 HTTP >= 400** and **0 external origins** (`!url.startsWith('http://localhost:8080')`).
3. **Reload & Corrupted Storage Recovery:**
   - Via `evaluate_script`, seed `localStorage.setItem('alerta_de_fuga_progress_v1', '{corrupt')`, then call `navigate_page({ "pageId": <id>, "type": "reload" })` → verify clean recovery on Inicio with 0 console errors.
4. **Mobile Emulation & Reduced Motion:**
   - `emulate({ "pageId": <id>, "viewport": "390x844x2,mobile,touch", "prefersReducedMotion": "reduce" })`
   - `evaluate_script` → assert `document.documentElement.scrollWidth <= window.innerWidth`.
5. **Lighthouse Audits (Mobile & Desktop):**
   - `lighthouse_audit({ "pageId": <id>, "device": "mobile", "mode": "navigation" })`
   - `lighthouse_audit({ "pageId": <id>, "device": "desktop", "mode": "navigation" })`
   - **Pass threshold:** `Accessibility >= 90` and `Best Practices >= 90` on both `mobile` and `desktop`.
   - **Reminder (`plan` §8.3, `web-accessibility/SKILL.md`):** Lighthouse `>= 90` is a quality metric, NOT proof of full WCAG 2.2 AA conformance; manual keyboard/focus/contrast verification in §2 above is mandatory.
6. Close page cleanly (`close_page({ "pageId": <id> })`).

---

## 4. M6 Browser Gate Failure Criteria

The Milestone M6 browser gate **FAILS** if any of the following occur:
- Any uncaught JS exception, console error, or CSP violation.
- Any HTTP 404 or external CDN/network request.
- Any horizontal overflow (`scrollWidth > innerWidth`) at `390×844`, `768×1024`, or `1280×800`.
- Any flow unreachable by keyboard alone, missing focus trap/Escape/focus return on modals/glossary, or Level 2 lacking keyboard/button parity with drag-and-drop.
- Progress lost on reload (when `localStorage` is available) or wiped on failed `100%` exposure attempt / canceled reset.
- Lighthouse `Accessibility < 90` or `Best Practices < 90` on mobile or desktop.
