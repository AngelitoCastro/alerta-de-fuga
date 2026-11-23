---
name: web-accessibility
description: >-
  Use this skill when building, auditing, or fixing HTML semantics, keyboard
  navigation, ARIA attributes, focus management, contrast, responsive layouts,
  or reduced-motion support against WCAG 2.2 AA in Alerta de Fuga.
---

# Web Accessibility Runbook (WCAG 2.2 AA)

## Requisitos obligatorios

1. **Estructura y semántica**
   - `<html lang="es">`, landmarks semánticos (`header`, `nav`, `main`, `footer`), jerarquía coherente de encabezados (`h1` único por vista) y enlace visible al enfocar **«Saltar al contenido»**.
2. **Contraste y color**
   - Usar los tokens de paleta del plan (`#0B1016`, `#131B26`, `#F0F6FC`, `#A8B8C8`, `#3FB950`, `#F0B429`, `#FF6B6B`, `#58A6FF`) comprobando contraste WCAG AA (≥ 4.5:1 texto normal, ≥ 3:1 texto grande y componentes UI) sobre el fondo real, especialmente en texto sobre botones coloreados.
   - Nunca comunicar estado solo con color: acompañar con texto claro e icono.
3. **Teclado y controles táctiles**
   - Todos los flujos (portada, guía, ajustes, tests, 4 minijuegos, glosario, resultados) deben ser 100 % operables con `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape` y flechas donde corresponda.
   - En el **Nivel 2 (Clasificador)**, ofrecer selección + botones equivalentes al drag-and-drop.
   - Área táctil mínima objetivo: `44 × 44 px`.
4. **Foco, modales y regiones vivas**
   - Indicador `:focus-visible` nítido en todos los controles interactivos.
   - Modales y cajón de glosario: trampa de foco mientras están abiertos, cierre con `Escape` y retorno de foco al disparador al cerrar.
   - `aria-live="polite"` solo para anuncios relevantes (feedback de decisión, cambio de nivel, alertas de exposición) sin saturar lectores de pantalla.
   - Barra de exposición con `role="progressbar"`, etiqueta accesible, `aria-valuemin="0"`, `aria-valuemax="100"` y `aria-valuenow`.
5. **Responsive y movimiento reducido**
   - Probar en `390 × 844`, `1280 × 800` y un ancho intermedio sin scroll horizontal y respetando zoom del navegador.
   - Soportar `@media (prefers-reduced-motion: reduce)` y el ajuste manual en el modal de configuración.

## Validación

- Comprobar recorrido completo por teclado en navegador (Playwright MCP / Chrome DevTools MCP).
- Ejecutar auditoría Lighthouse (meta ≥ 90 en Accesibilidad), recordando que Lighthouse no sustituye las pruebas manuales de conformidad WCAG.
