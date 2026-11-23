---
name: game-design-alerta
description: >-
  Use this skill when designing, implementing, or reviewing the four interactive
  minigames, scoring/exposure engine, pre/post quizzes, glossary, or pedagogical
  feedback for Alerta de Fuga (OWASP A04:2025).
---

# Game Design & Pedagogical Accuracy — Alerta de Fuga

## Cuatro mecánicas diferenciadas (no convertir en trivia)

1. **Nivel 1 — El Túnel Abierto (`js/minigames/inspector.js`):** inspector de solicitudes de red (protocolo, TLS, certificado, cabeceras, carga simulada) con decisiones: *Permitir*, *Exigir HTTPS/configuración segura* o *Bloquear*.
2. **Nivel 2 — La Bóveda de Texto Plano (`js/minigames/classifier.js`):** clasificación de registros en controles (`Hash de contraseñas`, `Cifrado autenticado AES-GCM`, `Tokenizar o reducir exposición`, `Eliminar / no almacenar`). Si hay drag-and-drop en escritorio, incluir siempre selección + botones para teclado y táctil.
3. **Nivel 3 — Llaves bajo el Tapete (`js/minigames/codeHunt.js`):** inspección de archivos ficticios no ejecutables; el jugador señala la línea/región vulnerable y elige la mitigación.
4. **Nivel 4 — Simulacro de Brecha (`js/minigames/branchingIncident.js`):** grafo de incidente ramificado en 6 fases (Detección → Contención → Evaluación → Protección → Recuperación → Cierre) con 3 opciones por nodo, sin nodos huérfanos ni ciclos no deseados.

## Contrato de módulos y motor

- Cada minijuego implementa `mount(container, levelData, callbacks)` y `destroy()`.
- El minijuego nunca muta el estado global directamente; notifica elecciones mediante `callbacks`.
- `destroy()` limpia listeners, temporizadores y referencias DOM.

## Reglas de puntuación y exposición (`js/engine/scoring.js`)

- Acierto: `+100` base. Racha: `+50` base en el 3.º, 6.º, 9.º... acierto consecutivo **dentro del mismo intento de nivel** (nunca entre niveles).
- Fallo: `0` puntos, racha a `0`, exposición `min(100, exposure + penalty)` con penalizaciones de `10`, `15`, `20` o `25`.
- `maxBaseLevel = 100 * N + 50 * Math.floor(N / 3)` (en nivel 4 usar `N` de la ruta jugada o normalización explícita).
- Temporizador opcional: detenido antes de mostrar feedback; bono `0–30` sumado a `visibleScore`, sin alterar `basePercent` ni el rango final.
- Si `exposure === 100`, el intento falla y no entra en el rango final; ofrecer reintento sin borrar niveles ya completados.
- En reintentos, solo el intento completado elegido cuenta para el rango final; evitar división por cero en tasas por `objectiveId`.

## Retroalimentación y evaluaciones

- Mostrar feedback siempre (acierto o fallo) en 3 bloques cortos (~3 frases principales):
  1. **Qué podría aprovechar el atacante**
  2. **Por qué ocurre**
  3. **Cómo prevenirlo** + enlace al término del glosario y referencia técnica (`owaspRef`).
- Test previo y posterior: 5 preguntas cada uno cubriendo exactamente `O1`–`O5`, equivalentes en dificultad pero con escenarios distintos. Si se omite el previo, mostrar solo `Y/5` sin delta ficticio.

## Validación

- Ejecutar `node --test tests/scoring.test.js tests/data-integrity.test.js` y verificar:
  - Todas las fórmulas de puntaje, racha, exposición `0–100`, reintentos y objetivo más débil.
  - Unicidad de IDs, cobertura `O1–O5` en ambos tests, referencias válidas al glosario y grafo alcanzable en nivel 4.
