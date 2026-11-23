# Instrucciones del proyecto — Alerta de Fuga

Este repositorio aloja **Alerta de Fuga — Auditoría Criptográfica (OWASP A04:2025)**, un juego educativo web estático y responsive basado en [plan_implementacion_alerta_de_fuga.md](plan_implementacion_alerta_de_fuga.md).

## Arquitectura y restricciones técnicas

- **Stack puro:** HTML5, CSS3 y JavaScript ES Modules sin frameworks, sin bundlers y sin CDNs externos en el MVP.
- **Datos desacoplados:** el contenido de niveles, glosario y evaluaciones vive en `data/` (JSON).
- **Sin datos reales ni secretos:** nunca incluir claves reales, tokens reales, números de tarjeta reales (PAN/CVV reales) ni datos personales de terceros en código, JSON ni `localStorage`.
- **Seguridad cliente:** no ejecutar fragmentos de código de los escenarios; no inyectar HTML arbitrario desde JSON (`innerHTML` con datos no confiables); sin scripts ni manejadores de eventos inline (usar `addEventListener`). Mantener compatibilidad con la CSP estricta definida en `_headers`.
- **Contrato de minijuegos:** cada minijuego expone `mount(container, levelData, callbacks)` y `destroy()` para limpiar listeners y temporizadores.

## Precisión técnica obligatoria (OWASP A04:2025 y PCI DSS)

- **Transporte (Nivel 1):** la ausencia de HSTS no demuestra por sí sola una interceptación; HSTS mitiga degradación en visitas posteriores y *preload* protege la primera visita. Un certificado autofirmado depende de la cadena de confianza del entorno/cliente.
- **Almacenamiento y tarjetas (Nivel 2):** tratar PAN y CVV por separado. PCI DSS prohíbe conservar el CVV después de la autorización, **incluso cifrado**. No presentar la tokenización como sustituto total de PCI DSS. Señalar que AES-GCM exige nonce único por clave.
- **Claves y criptografía (Nivel 3):** diferenciar RSA `NoPadding`, PKCS#1 v1.5 y RSA-OAEP (no equiparar todos los usos de PKCS#1 v1.5 con `NoPadding`). Una variable de entorno por sí sola no equivale a un gestor seguro de secretos.
- **Pedagogía:** no presentar analogías como equivalencias técnicas exactas y no describir un ataque consumado cuando el escenario solo muestra una condición de riesgo.

## Reglas de juego, UX y accesibilidad

- **Fórmulas:** respetar las fórmulas exactas de puntuación (`maxBaseLevel = 100 * N + 50 * floor(N / 3)`), exposición (`0–100`, fallo al llegar a `100` sin borrar progreso previo) y rangos (`< 50 %` Aprendiz, `50–84.99 %` Analista, `>= 85 %` Arquitecto Criptográfico).
- **Accesibilidad (WCAG 2.2 AA):** móvil primero (`390×844` y `1280×800`), alternativa completa por teclado y botones para cualquier drag-and-drop, foco visible, Escape y retorno de foco en modales/glosario, soporte a `prefers-reduced-motion`, y estados que nunca dependan solo del color.
- **Transparencia:** no inventar enlaces de despliegue, resultados de pruebas con usuarios ni herramientas de IA no utilizadas.
