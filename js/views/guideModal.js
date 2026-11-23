import { openModal, closeModal } from '../engine/a11y.js';

function createEl(doc, tag, className = '', text = '') {
  const el = doc.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== '') {
    el.textContent = text;
  }
  return el;
}

export function createGuideModal({ container }) {
  if (!container) {
    return {
      open() {},
      close() {},
      destroy() {}
    };
  }

  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];
  let rendered = false;

  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  }

  function ensureRendered() {
    if (rendered) {
      return;
    }
    rendered = true;

    const dialog = createEl(doc, 'div', 'modal-dialog');
    const header = createEl(doc, 'div', 'modal-header');
    const title = createEl(doc, 'h2', 'modal-title', 'Guía rápida (1 minuto)');
    title.id = 'guide-modal-title';
    container.setAttribute('aria-labelledby', 'guide-modal-title');

    const closeTopBtn = createEl(doc, 'button', 'btn btn--ghost modal-close', 'Cerrar');
    closeTopBtn.type = 'button';
    closeTopBtn.setAttribute('aria-label', 'Cerrar guía rápida');
    header.append(title, closeTopBtn);

    const body = createEl(doc, 'div', 'modal-body');

    const intro = createEl(
      doc,
      'p',
      '',
      'Asumes el rol de analista junior de seguridad en NovaPay. Tu objetivo es auditar cuatro componentes simulados frente a OWASP Top 10:2025 A04 (Fallas Criptográficas).'
    );

    const steps = createEl(doc, 'ol', 'guide-steps');
    const guideItems = [
      'Cuatro mecánicas distintas: 1) Inspector de tráfico en red, 2) Clasificador de datos (con teclado/botones y arrastre opcional), 3) Búsqueda de errores en código simulado no ejecutable y 4) Simulacro de brecha ramificado en 6 fases.',
      'Puntos y rachas: cada acierto otorga +100 puntos base; cada 3 aciertos consecutivos dentro del mismo nivel suman +50 puntos de racha. Si activas el temporizador opcional, añade un bono de 0 a 30 puntos sin afectar tu rango final.',
      'Barra de exposición (0 a 100 %): cada decisión riesgosa aumenta la exposición según su gravedad. Al llegar a 100 %, el intento falla y puedes reintentar el nivel sin perder niveles ya completados.',
      'Retroalimentación en 3 bloques: después de cada elección verás qué podría aprovechar un atacante, por qué ocurre el riesgo y cómo prevenirlo, junto al glosario accesible y referencias OWASP.'
    ];

    for (const itemText of guideItems) {
      steps.appendChild(createEl(doc, 'li', 'guide-step', itemText));
    }

    const visualRow = createEl(doc, 'div', 'guide-visual-row');
    const analystCard = createEl(doc, 'div', 'card');
    const analystImg = createEl(doc, 'img');
    analystImg.setAttribute('src', 'assets/analyst.svg');
    analystImg.setAttribute('alt', 'Ilustración de la consola de auditoría del analista');
    analystCard.append(analystImg, createEl(doc, 'p', 'text-muted', 'Controles preventivos y verificación técnica.'));

    const attackerCard = createEl(doc, 'div', 'card');
    const attackerImg = createEl(doc, 'img');
    attackerImg.setAttribute('src', 'assets/attacker.svg');
    attackerImg.setAttribute('alt', 'Ilustración de un escenario de exposición simulada');
    attackerCard.append(attackerImg, createEl(doc, 'p', 'text-muted', 'Impacto potencial si la exposición sube a 100 %.'));

    visualRow.append(analystCard, attackerCard);

    const kbdHint = createEl(
      doc,
      'p',
      'text-muted',
      'Atajos útiles: navega con Tab y Shift+Tab, activa botones con Enter o Espacio y cierra cualquier ventana o el glosario con la tecla Escape.'
    );

    body.append(intro, steps, visualRow, kbdHint);

    const footer = createEl(doc, 'div', 'modal-footer');
    const okBtn = createEl(doc, 'button', 'btn btn--primary', 'Entendido');
    okBtn.type = 'button';
    okBtn.setAttribute('data-autofocus', '');
    footer.appendChild(okBtn);

    dialog.append(header, body, footer);
    container.replaceChildren(dialog);

    const handleClose = () => closeModal(container);
    listen(closeTopBtn, 'click', handleClose);
    listen(okBtn, 'click', handleClose);
    listen(container, 'click', (event) => {
      if (event.target === container) {
        handleClose();
      }
    });
  }

  return {
    open(triggerEl = null) {
      ensureRendered();
      container.setAttribute('role', 'dialog');
      openModal(container, triggerEl, () => {
        container.removeAttribute('role');
      });
    },
    close() {
      closeModal(container);
      container.removeAttribute('role');
    },
    destroy() {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;
      rendered = false;
      container.removeAttribute('role');
      container.replaceChildren();
    }
  };
}
