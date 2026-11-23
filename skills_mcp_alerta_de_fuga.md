# Skills y MCP recomendados para Alerta de Fuga

> Proyecto: **Alerta de Fuga — Auditoría Criptográfica (OWASP A04:2025)**  
> Objetivo: construir, probar y publicar un juego educativo web con cuatro niveles interactivos, usando HTML, CSS y JavaScript modular.

## 1. Criterio de selección

Priorizar herramientas que mejoren la **experiencia de juego**, la **precisión técnica**, las **pruebas funcionales** y la **publicación**. Evitar instalar herramientas solo por acumular integraciones.

- **Skill:** conjunto de instrucciones y procedimientos reutilizables para orientar al agente.
- **MCP:** conexión que permite al agente interactuar con un navegador o servicio externo.
- **Nota:** los nombres de algunas skills a continuación describen capacidades deseadas; **no todos son paquetes instalables con esos nombres exactos**.

## 2. Skills sugeridas

| Skill/capacidad | Aplicación concreta | Prioridad |
|---|---|---|
| Frontend Design | Diseño responsive, consistencia visual, estados y HUD de juego | Alta |
| Web App Testing | Pruebas de navegación, niveles, puntuaciones y resultados | Alta |
| Game Design / Game Development | Mecánicas diferenciadas, progresión y feedback pedagógico | Alta |
| Web Accessibility | WCAG 2.2 AA, teclado, contraste, foco y movimiento reducido | Alta |
| Web Security Review | CSP, XSS, validación de datos y ausencia de secretos | Alta |
| Technical Documentation | README, registro de uso de IA y guía de despliegue | Media |
| Performance Optimization | Optimización de recursos y rendimiento en teléfonos | Media |

### Skills concretas para empezar

El repositorio [anthropics/skills](https://github.com/anthropics/skills) incluye skills como `frontend-design` y `webapp-testing`. Si tu agente es compatible con el instalador `skills`, puedes probar:

```bash
npx skills add anthropics/skills --skill frontend-design
npx skills add anthropics/skills --skill webapp-testing
```

Antes de ejecutar, verifica en el repositorio que la skill siga disponible y que tu agente admita esa instalación. Para las otras capacidades, busca skills compatibles o define instrucciones de proyecto propias.

## 3. MCP recomendados

### 3.1 Playwright MCP — prioridad alta

**Repositorio:** https://github.com/microsoft/playwright-mcp

Permite que el agente interactúe con el juego desde un navegador y compruebe:

- Recorrido completo: inicio → test previo → niveles 1–4 → test posterior → resultados.
- Respuestas correctas e incorrectas, exposición acumulada y reinicios.
- Comportamiento en tamaños de pantalla móvil y escritorio.
- Navegación por teclado, modales y glosario.

### 3.2 Chrome DevTools MCP — prioridad alta

**Repositorio:** https://github.com/ChromeDevTools/chrome-devtools-mcp

Útil para diagnosticar errores de consola, solicitudes fallidas, rendimiento y problemas del DOM/CSS. Complementa a Playwright, pero no hace falta usar ambos al mismo tiempo para una misma prueba.

### 3.3 GitHub MCP — recomendable al integrar el repositorio

**Repositorio:** https://github.com/github/github-mcp-server

Permite gestionar y revisar contenido del repositorio según los permisos concedidos. No reemplaza las pruebas locales ni el control de versiones convencional.

### 3.4 Cloudflare MCP — opcional

**Repositorio de referencia:** https://github.com/cloudflare/mcp-server-cloudflare

Revisar qué operaciones admite la versión disponible. Para un sitio estático, puede ser más sencillo publicar conectando un repositorio GitHub directamente a **Cloudflare Pages**. No asumir que cualquier MCP de Cloudflare implementa despliegue de Pages.

## 4. Configuración mínima de MCP (ejemplo)

Ejemplo genérico para agentes compatibles con un archivo de configuración `mcpServers`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

> **Importante:** la ubicación del archivo, su esquema, las opciones del proceso y la gestión de permisos dependen de la aplicación anfitriona (Antigravity, OpenCode, etc.). Verifica la documentación de tu agente. Se necesita Node.js y un navegador compatible; pueden requerirse componentes adicionales.

## 5. Uso por etapa

| Etapa | Skill/capacidad | MCP |
|---|---|---|
| Diseño de interfaces | Frontend Design | No obligatorio |
| Implementación de minijuegos | Game Design + JavaScript | No obligatorio |
| Pruebas de los cuatro niveles | Web App Testing | Playwright MCP |
| Diagnóstico de errores y rendimiento | Performance Optimization | Chrome DevTools MCP |
| Accesibilidad | Web Accessibility | Playwright MCP |
| Revisión de seguridad | Web Security Review | Chrome DevTools MCP (apoyo) |
| Código y versiones | Technical Documentation | GitHub MCP (opcional) |
| Publicación | Guía de despliegue | Cloudflare MCP (opcional) |

## 6. Pruebas mínimas antes de entregar

- [ ] Los cuatro niveles pueden completarse sin errores.
- [ ] La puntuación, las rachas, la exposición y los reinicios se calculan correctamente.
- [ ] El test previo y el posterior evalúan los mismos objetivos con preguntas equivalentes.
- [ ] Los conceptos de TLS/HSTS, hash, AES-GCM, RSA-OAEP y datos bancarios se explican correctamente.
- [ ] El juego funciona con mouse, teclado y pantallas táctiles.
- [ ] El diseño se adapta a móvil y escritorio.
- [ ] No hay errores de consola ni recursos faltantes.
- [ ] La web está publicada con un enlace público HTTPS.
- [ ] El repositorio contiene el código fuente completo y un README.
- [ ] El README documenta las herramientas de IA realmente utilizadas y sus aportes.

## 7. Recomendación final

**Empieza con dos skills (`frontend-design` y `webapp-testing`) y dos MCP (Playwright y Chrome DevTools).** Añade GitHub MCP únicamente si aporta valor a tu flujo; para la publicación, utiliza primero la integración GitHub → Cloudflare Pages o Netlify.

La prioridad del proyecto no es tener más herramientas, sino entregar una experiencia de aprendizaje **correcta, jugable, accesible y publicada**.

## Referencias

- https://github.com/anthropics/skills
- https://github.com/microsoft/playwright-mcp
- https://github.com/ChromeDevTools/chrome-devtools-mcp
- https://github.com/github/github-mcp-server
- https://github.com/cloudflare/mcp-server-cloudflare
- https://developers.cloudflare.com/pages/
