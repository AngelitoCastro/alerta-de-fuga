---
name: web-security-review
description: >-
  Use this skill when implementing or reviewing client-side security, CSP and
  HTTP security headers (_headers), XSS prevention, localStorage hygiene, secret
  scanning, and static deployment hardening for Alerta de Fuga.
---

# Web Security Review Runbook — Alerta de Fuga

## Controles obligatorios

1. **Prevención de XSS y renderizado seguro**
   - Construir el DOM con `document.createElement`, `textContent` y atributos seguros; evitar `innerHTML` con contenido proveniente de JSON o entrada del usuario.
   - Prohibido `eval`, `new Function`, scripts inline (`<script>...</script>`) y manejadores inline (`onclick="..."`); registrar eventos exclusivamente con `addEventListener`.
   - Los ejemplos de código del Nivel 3 son texto simulado, nunca código ejecutable.
2. **Cabeceras de seguridad (`_headers` para Cloudflare Pages / Netlify)**
   - Mantener CSP restrictiva coherente con la arquitectura real:
     `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`
   - Incluir `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
   - Aplicar `Strict-Transport-Security: max-age=31536000` (usar `includeSubDomains` solo si todos los subdominios están bajo control HTTPS; no añadir `preload` automáticamente).
3. **Privacidad y `localStorage`**
   - Usar una sola clave versionada (`alerta_de_fuga_progress_v1`) con progreso y preferencias.
   - Nunca almacenar datos personales, contraseñas, secretos ni tarjetas reales; manejar con gracia si `localStorage` está bloqueado (modo en memoria).
   - Proveer botón **Restablecer progreso** con confirmación.
4. **Ausencia de secretos y datos sensibles reales**
   - Verificar que `data/`, `js/`, `tests/` y `README.md` no contengan claves reales, tokens reales ni PAN/CVV reales (usar valores claramente ficticios/marcadores).

## Validación

- Revisar consola y red en Chrome DevTools MCP al servir localmente (`python3 -m http.server 8080`): 0 violaciones de CSP, 0 peticiones externas inesperadas, 0 recursos 404.
- Tras publicar en HTTPS, inspeccionar las cabeceras HTTP reales de la respuesta para confirmar que `_headers` se aplica.
