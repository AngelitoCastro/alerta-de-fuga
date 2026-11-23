/**
 * Lightweight pure-Node DOM, Storage, and HTTP-backed Fetch stub for opaque-box
 * testing of browser ES modules (a11y.js, minigames, views, main.js) without
 * external npm dependencies.
 */

export class StubEvent {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    this.target = null;
    this.currentTarget = null;
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.shiftKey = Boolean(init.shiftKey);
    this.ctrlKey = Boolean(init.ctrlKey);
    this.altKey = Boolean(init.altKey);
    this.metaKey = Boolean(init.metaKey);
    this.detail = init.detail;
    this.dataTransfer = init.dataTransfer ?? null;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
}

export class StubKeyboardEvent extends StubEvent {
  constructor(type, init = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
  }
}

export class StubMouseEvent extends StubEvent {
  constructor(type, init = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
  }
}

export class StubCustomEvent extends StubEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail ?? null;
  }
}

export class StubNode {
  constructor(nodeType, ownerDocument = null) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this._childNodes = [];
    this._listeners = new Map();
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur.nodeType === 9) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  get childNodes() {
    return [...this._childNodes];
  }

  get children() {
    return this._childNodes.filter((n) => n.nodeType === 1);
  }

  get firstChild() {
    return this._childNodes[0] || null;
  }

  get lastChild() {
    return this._childNodes[this._childNodes.length - 1] || null;
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get lastElementChild() {
    const ch = this.children;
    return ch[ch.length - 1] || null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode._childNodes.indexOf(this);
    return idx >= 0 ? this.parentNode._childNodes[idx + 1] || null : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode._childNodes.indexOf(this);
    return idx > 0 ? this.parentNode._childNodes[idx - 1] || null : null;
  }

  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  appendChild(node) {
    if (!node) return node;
    if (node.nodeType === 11) {
      const items = [...node._childNodes];
      for (const item of items) {
        this.appendChild(item);
      }
      return node;
    }
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument || (this.nodeType === 9 ? this : null);
    this._childNodes.push(node);
    return node;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.nodeType === 11) {
      const items = [...newNode._childNodes];
      for (const item of items) {
        this.insertBefore(item, refNode);
      }
      return newNode;
    }
    const idx = this._childNodes.indexOf(refNode);
    if (idx < 0) return this.appendChild(newNode);
    if (newNode.parentNode) {
      newNode.parentNode.removeChild(newNode);
    }
    newNode.parentNode = this;
    newNode.ownerDocument = this.ownerDocument || (this.nodeType === 9 ? this : null);
    this._childNodes.splice(idx, 0, newNode);
    return newNode;
  }

  removeChild(node) {
    const idx = this._childNodes.indexOf(node);
    if (idx >= 0) {
      this._childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }

  replaceChild(newNode, oldNode) {
    this.insertBefore(newNode, oldNode);
    return this.removeChild(oldNode);
  }

  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') {
        this.appendChild(new StubTextNode(n, this.ownerDocument));
      } else if (n) {
        this.appendChild(n);
      }
    }
  }

  prepend(...nodes) {
    const first = this._childNodes[0] || null;
    for (const n of nodes) {
      const node = typeof n === 'string' ? new StubTextNode(n, this.ownerDocument) : n;
      if (node) this.insertBefore(node, first);
    }
  }

  replaceChildren(...nodes) {
    while (this._childNodes.length > 0) {
      this.removeChild(this._childNodes[0]);
    }
    this.append(...nodes);
  }

  addEventListener(type, listener, options) {
    if (typeof listener !== 'function') return;
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const once = typeof options === 'object' && Boolean(options?.once);
    const list = this._listeners.get(type) || [];
    const exists = list.some((entry) => entry.listener === listener && entry.capture === capture);
    if (!exists) {
      list.push({ listener, capture, once });
      this._listeners.set(type, list);
    }
  }

  removeEventListener(type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const list = this._listeners.get(type);
    if (!list) return;
    const filtered = list.filter((entry) => !(entry.listener === listener && entry.capture === capture));
    if (filtered.length > 0) {
      this._listeners.set(type, filtered);
    } else {
      this._listeners.delete(type);
    }
  }

  dispatchEvent(event) {
    if (!event) return true;
    event.target = this;
    const chain = [];
    let cur = this;
    while (cur) {
      chain.push(cur);
      cur = cur.parentNode;
    }
    if (this.ownerDocument?._window && chain[chain.length - 1] === this.ownerDocument) {
      chain.push(this.ownerDocument._window);
    }

    for (let i = 0; i < chain.length; i += 1) {
      const node = chain[i];
      if (i > 0 && !event.bubbles) break;
      event.currentTarget = node;
      const listeners = [...(node._listeners?.get(event.type) || [])];
      for (const entry of listeners) {
        if (entry.once) {
          node.removeEventListener(event.type, entry.listener, entry.capture);
        }
        entry.listener.call(node, event);
        if (event.immediatePropagationStopped) break;
      }
      if (event.propagationStopped) break;
    }
    return !event.defaultPrevented;
  }
}

export class StubTextNode extends StubNode {
  constructor(text, ownerDocument = null) {
    super(3, ownerDocument);
    this.nodeValue = String(text ?? '');
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(val) {
    this.nodeValue = String(val ?? '');
  }

  cloneNode() {
    return new StubTextNode(this.nodeValue, this.ownerDocument);
  }
}

export class StubDocumentFragment extends StubNode {
  constructor(ownerDocument = null) {
    super(11, ownerDocument);
  }

  get textContent() {
    return this._childNodes.map((c) => c.textContent).join('');
  }

  set textContent(val) {
    this._childNodes = [];
    if (val !== '' && val !== null && val !== undefined) {
      this.appendChild(new StubTextNode(String(val), this.ownerDocument));
    }
  }

  querySelector(selector) {
    return querySelectorInSubtree(this, selector, true)[0] || null;
  }

  querySelectorAll(selector) {
    return querySelectorInSubtree(this, selector, false);
  }

  cloneNode(deep = false) {
    const frag = new StubDocumentFragment(this.ownerDocument);
    if (deep) {
      for (const child of this._childNodes) {
        frag.appendChild(child.cloneNode(true));
      }
    }
    return frag;
  }
}

class StubClassList {
  constructor(el) {
    this._el = el;
  }

  _tokens() {
    const raw = this._el.getAttribute('class') || '';
    return raw.trim() ? raw.trim().split(/\s+/) : [];
  }

  _commit(tokens) {
    const unique = [...new Set(tokens.filter(Boolean))];
    if (unique.length === 0) {
      this._el.removeAttribute('class');
    } else {
      this._el.setAttribute('class', unique.join(' '));
    }
  }

  add(...tokens) {
    this._commit([...this._tokens(), ...tokens]);
  }

  remove(...tokens) {
    const removeSet = new Set(tokens);
    this._commit(this._tokens().filter((t) => !removeSet.has(t)));
  }

  toggle(token, force) {
    const has = this.contains(token);
    const shouldAdd = force === undefined ? !has : Boolean(force);
    if (shouldAdd) {
      this.add(token);
      return true;
    }
    this.remove(token);
    return false;
  }

  contains(token) {
    return this._tokens().includes(token);
  }

  replace(oldToken, newToken) {
    if (!this.contains(oldToken)) return false;
    this._commit(this._tokens().map((t) => (t === oldToken ? newToken : t)));
    return true;
  }

  toString() {
    return this._tokens().join(' ');
  }

  [Symbol.iterator]() {
    return this._tokens()[Symbol.iterator]();
  }
}

function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function toKebabCase(str) {
  return str.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

export class StubElement extends StubNode {
  constructor(tagName, ownerDocument = null) {
    super(1, ownerDocument);
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName).toLowerCase();
    this._attrs = new Map();
    this.classList = new StubClassList(this);
    this.style = {
      _props: new Map(),
      setProperty: (k, v) => this.style._props.set(k, String(v)),
      getPropertyValue: (k) => this.style._props.get(k) || '',
      removeProperty: (k) => this.style._props.delete(k),
    };
    this.dataset = new Proxy(
      {},
      {
        get: (_, prop) => {
          if (typeof prop !== 'string') return undefined;
          return this.getAttribute(`data-${toKebabCase(prop)}`) ?? undefined;
        },
        set: (_, prop, val) => {
          this.setAttribute(`data-${toKebabCase(String(prop))}`, String(val));
          return true;
        },
        deleteProperty: (_, prop) => {
          this.removeAttribute(`data-${toKebabCase(String(prop))}`);
          return true;
        },
        ownKeys: () => {
          const keys = [];
          for (const attr of this._attrs.keys()) {
            if (attr.startsWith('data-')) keys.push(toCamelCase(attr.slice(5)));
          }
          return keys;
        },
        getOwnPropertyDescriptor: (_, prop) => {
          const attr = `data-${toKebabCase(String(prop))}`;
          if (!this._attrs.has(attr)) return undefined;
          return { enumerable: true, configurable: true, value: this._attrs.get(attr) };
        },
      },
    );
    this._value = '';
    this._checked = false;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(val) {
    this.setAttribute('id', String(val));
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(val) {
    if (val === '' || val == null) {
      this.removeAttribute('class');
    } else {
      this.setAttribute('class', String(val));
    }
  }

  get role() {
    return this.getAttribute('role');
  }

  set role(val) {
    if (val == null) this.removeAttribute('role');
    else this.setAttribute('role', String(val));
  }

  get type() {
    return this.getAttribute('type') || (this.localName === 'button' ? 'submit' : '');
  }

  set type(val) {
    this.setAttribute('type', String(val));
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  set name(val) {
    this.setAttribute('name', String(val));
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  set href(val) {
    this.setAttribute('href', String(val));
  }

  get src() {
    return this.getAttribute('src') || '';
  }

  set src(val) {
    this.setAttribute('src', String(val));
  }

  get alt() {
    return this.getAttribute('alt') || '';
  }

  set alt(val) {
    this.setAttribute('alt', String(val));
  }

  get htmlFor() {
    return this.getAttribute('for') || '';
  }

  set htmlFor(val) {
    this.setAttribute('for', String(val));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(val) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get hidden() {
    return this.hasAttribute('hidden');
  }

  set hidden(val) {
    if (val) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(val) {
    if (val) this.setAttribute('open', '');
    else this.removeAttribute('open');
  }

  get checked() {
    return this._checked;
  }

  set checked(val) {
    this._checked = Boolean(val);
    if (this._checked) this.setAttribute('checked', '');
    else this.removeAttribute('checked');
  }

  get value() {
    if (this.localName === 'progress') {
      const attrVal = this.getAttribute('value');
      return attrVal == null ? 0 : Number(attrVal);
    }
    return this._value || this.getAttribute('value') || '';
  }

  set value(val) {
    this._value = String(val ?? '');
    if (this.localName === 'progress' || this.localName === 'input') {
      this.setAttribute('value', String(val ?? ''));
    }
  }

  get max() {
    const attrVal = this.getAttribute('max');
    return attrVal == null ? 1 : Number(attrVal);
  }

  set max(val) {
    this.setAttribute('max', String(val));
  }

  get tabIndex() {
    if (this.hasAttribute('tabindex')) {
      const n = Number(this.getAttribute('tabindex'));
      return Number.isNaN(n) ? -1 : n;
    }
    if (this.disabled) return -1;
    if (['button', 'input', 'select', 'textarea', 'summary'].includes(this.localName)) return 0;
    if (this.localName === 'a' && this.hasAttribute('href')) return 0;
    return -1;
  }

  set tabIndex(val) {
    this.setAttribute('tabindex', String(val));
  }

  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    this._attrs.set(key, String(value));
    if (key === 'checked') this._checked = true;
    if (key === 'value') this._value = String(value);
  }

  getAttribute(name) {
    const key = String(name).toLowerCase();
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  removeAttribute(name) {
    const key = String(name).toLowerCase();
    this._attrs.delete(key);
    if (key === 'checked') this._checked = false;
  }

  hasAttribute(name) {
    return this._attrs.has(String(name).toLowerCase());
  }

  get textContent() {
    return this._childNodes.map((c) => c.textContent).join('');
  }

  set textContent(val) {
    this._childNodes = [];
    if (val !== '' && val !== null && val !== undefined) {
      this.appendChild(new StubTextNode(String(val), this.ownerDocument));
    }
  }

  get innerText() {
    return this.textContent;
  }

  set innerText(val) {
    this.textContent = val;
  }

  get innerHTML() {
    return this._childNodes
      .map((child) => {
        if (child.nodeType === 3) return child.nodeValue;
        if (child.nodeType !== 1) return '';
        const attrs = [...child._attrs.entries()]
          .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)
          .join('');
        return `<${child.localName}${attrs}>${child.innerHTML}</${child.localName}>`;
      })
      .join('');
  }

  set innerHTML(val) {
    this._childNodes = [];
    const str = String(val ?? '');
    if (!str.trim()) return;
    parseHtmlIntoElement(str, this, this.ownerDocument);
  }

  focus() {
    if (!this.ownerDocument) return;
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(new StubEvent('focus', { bubbles: false }));
    this.dispatchEvent(new StubEvent('focusin', { bubbles: true }));
  }

  blur() {
    if (!this.ownerDocument) return;
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    this.dispatchEvent(new StubEvent('blur', { bubbles: false }));
    this.dispatchEvent(new StubEvent('focusout', { bubbles: true }));
  }

  click() {
    if (this.disabled) return;
    if (this.localName === 'input' && this.type === 'checkbox') {
      this.checked = !this.checked;
      this.dispatchEvent(new StubEvent('change', { bubbles: true }));
    } else if (this.localName === 'input' && this.type === 'radio') {
      if (this.ownerDocument && this.name) {
        for (const r of this.ownerDocument.querySelectorAll(`input[type="radio"]`)) {
          if (r.name === this.name) r.checked = false;
        }
      }
      this.checked = true;
      this.dispatchEvent(new StubEvent('change', { bubbles: true }));
    }
    this.dispatchEvent(new StubMouseEvent('click'));
  }

  showModal() {
    this.setAttribute('open', '');
    this.setAttribute('aria-modal', 'true');
  }

  close() {
    this.removeAttribute('open');
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 120, height: 48, right: 120, bottom: 48 };
  }

  matches(selector) {
    return matchesComplexSelector(this, selector);
  }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return querySelectorInSubtree(this, selector, true)[0] || null;
  }

  querySelectorAll(selector) {
    return querySelectorInSubtree(this, selector, false);
  }

  cloneNode(deep = false) {
    const el = new StubElement(this.localName, this.ownerDocument);
    for (const [k, v] of this._attrs.entries()) {
      el._attrs.set(k, v);
    }
    el._checked = this._checked;
    el._value = this._value;
    if (deep) {
      for (const child of this._childNodes) {
        el.appendChild(child.cloneNode(true));
      }
    }
    return el;
  }
}

export class StubDocument extends StubNode {
  constructor() {
    super(9, null);
    this.ownerDocument = this;
    this.documentElement = new StubElement('html', this);
    this.documentElement.parentNode = this;
    this.head = new StubElement('head', this);
    this.body = new StubElement('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this._childNodes = [this.documentElement];
    this.activeElement = this.body;
    this.title = '';
    this.readyState = 'complete';
    this._window = null;
  }

  createElement(tagName) {
    return new StubElement(tagName, this);
  }

  createElementNS(_ns, tagName) {
    return new StubElement(tagName, this);
  }

  createTextNode(text) {
    return new StubTextNode(text, this);
  }

  createDocumentFragment() {
    return new StubDocumentFragment(this);
  }

  getElementById(id) {
    const escaped = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.querySelector(`[id="${escaped}"]`);
  }

  querySelector(selector) {
    return querySelectorInSubtree(this.documentElement, selector, true, true)[0] || null;
  }

  querySelectorAll(selector) {
    return querySelectorInSubtree(this.documentElement, selector, false, true);
  }
}

function splitTopLevelCommas(selector) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (quote) {
      current += ch;
      if (ch === quote && selector[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '[' || ch === '(') {
      depth += 1;
      current += ch;
    } else if (ch === ']' || ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function tokenizeComplexSelector(sel) {
  const tokens = [];
  let i = 0;
  while (i < sel.length) {
    if (/\s/.test(sel[i])) {
      while (i < sel.length && /\s/.test(sel[i])) i += 1;
      if (i < sel.length && sel[i] === '>') {
        tokens.push('>');
        i += 1;
        while (i < sel.length && /\s/.test(sel[i])) i += 1;
      } else if (tokens.length > 0 && tokens[tokens.length - 1] !== '>') {
        tokens.push(' ');
      }
      continue;
    }
    if (sel[i] === '>') {
      tokens.push('>');
      i += 1;
      continue;
    }
    let compound = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    let quote = null;
    while (i < sel.length) {
      const ch = sel[i];
      if (quote) {
        compound += ch;
        if (ch === quote && sel[i - 1] !== '\\') quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        compound += ch;
      } else if (ch === '[') {
        bracketDepth += 1;
        compound += ch;
      } else if (ch === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        compound += ch;
      } else if (ch === '(') {
        parenDepth += 1;
        compound += ch;
      } else if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        compound += ch;
      } else if (bracketDepth === 0 && parenDepth === 0 && (/\s/.test(ch) || ch === '>')) {
        break;
      } else {
        compound += ch;
      }
      i += 1;
    }
    if (compound) tokens.push(compound);
  }
  return tokens;
}

function matchesCompound(el, compound) {
  if (!el || el.nodeType !== 1) return false;
  let rest = compound.trim();
  if (!rest || rest === '*') return true;

  // Tag at start
  const tagMatch = rest.match(/^([a-zA-Z0-9_-]+|\*)/);
  if (tagMatch) {
    const tag = tagMatch[1].toLowerCase();
    if (tag !== '*' && el.localName !== tag) return false;
    rest = rest.slice(tagMatch[0].length);
  }

  while (rest.length > 0) {
    if (rest[0] === '#') {
      const m = rest.match(/^#([a-zA-Z0-9_:-]+)/);
      if (!m) return false;
      if (el.id !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '.') {
      const m = rest.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!m) return false;
      if (!el.classList.contains(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '[') {
      let endIdx = 1;
      let q = null;
      while (endIdx < rest.length) {
        const ch = rest[endIdx];
        if (q) {
          if (ch === q && rest[endIdx - 1] !== '\\') q = null;
        } else if (ch === '"' || ch === "'") {
          q = ch;
        } else if (ch === ']') {
          break;
        }
        endIdx += 1;
      }
      const attrExpr = rest.slice(1, endIdx).trim();
      rest = rest.slice(endIdx + 1);
      const opMatch = attrExpr.match(/^([a-zA-Z0-9_:-]+)\s*(\^=|\$=|\*=|=)?\s*(.*)$/);
      if (!opMatch) return false;
      const attrName = opMatch[1];
      const op = opMatch[2];
      let expected = opMatch[3]?.trim() || '';
      if ((expected.startsWith('"') && expected.endsWith('"')) || (expected.startsWith("'") && expected.endsWith("'"))) {
        expected = expected.slice(1, -1);
      }
      const actual = el.getAttribute(attrName);
      if (!op) {
        if (actual === null) return false;
      } else if (actual === null) {
        return false;
      } else if (op === '=' && actual !== expected) {
        return false;
      } else if (op === '^=' && !actual.startsWith(expected)) {
        return false;
      } else if (op === '$=' && !actual.endsWith(expected)) {
        return false;
      } else if (op === '*=' && !actual.includes(expected)) {
        return false;
      }
    } else if (rest.startsWith(':not(')) {
      let depth = 1;
      let idx = 5;
      while (idx < rest.length && depth > 0) {
        if (rest[idx] === '(') depth += 1;
        else if (rest[idx] === ')') depth -= 1;
        idx += 1;
      }
      const inner = rest.slice(5, idx - 1);
      rest = rest.slice(idx);
      if (matchesComplexSelector(el, inner)) return false;
    } else if (rest.startsWith(':disabled')) {
      if (!el.disabled) return false;
      rest = rest.slice(':disabled'.length);
    } else if (rest.startsWith(':enabled')) {
      if (el.disabled) return false;
      rest = rest.slice(':enabled'.length);
    } else if (rest.startsWith(':checked')) {
      if (!el.checked) return false;
      rest = rest.slice(':checked'.length);
    } else if (rest.startsWith(':focus')) {
      if (el.ownerDocument?.activeElement !== el) return false;
      rest = rest.slice(':focus'.length);
    } else {
      return false;
    }
  }

  return true;
}

function matchesComplexSelector(el, selector) {
  const branches = splitTopLevelCommas(selector);
  return branches.some((branch) => {
    const tokens = tokenizeComplexSelector(branch);
    if (tokens.length === 0) return false;
    let idx = tokens.length - 1;
    if (!matchesCompound(el, tokens[idx])) return false;
    idx -= 1;
    let cur = el;
    while (idx >= 0) {
      const comb = tokens[idx];
      const targetCompound = tokens[idx - 1];
      if (!targetCompound) return false;
      if (comb === '>') {
        cur = cur.parentElement;
        if (!cur || !matchesCompound(cur, targetCompound)) return false;
      } else {
        let found = false;
        let p = cur.parentElement;
        while (p) {
          if (matchesCompound(p, targetCompound)) {
            cur = p;
            found = true;
            break;
          }
          p = p.parentElement;
        }
        if (!found) return false;
      }
      idx -= 2;
    }
    return true;
  });
}

function querySelectorInSubtree(root, selector, firstOnly, includeRoot = false) {
  const results = [];
  const visit = (node) => {
    if (firstOnly && results.length > 0) return;
    if (node.nodeType === 1 && (includeRoot || node !== root)) {
      if (matchesComplexSelector(node, selector)) {
        results.push(node);
        if (firstOnly) return;
      }
    }
    for (const child of node._childNodes || []) {
      visit(child);
      if (firstOnly && results.length > 0) return;
    }
  };
  visit(root);
  return results;
}

const VOID_TAGS = new Set(['meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

function parseAttributes(attrText, el) {
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = attrRegex.exec(attrText)) !== null) {
    const name = m[1];
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    el.setAttribute(name, value);
  }
}

export function parseHtmlIntoElement(html, rootEl, doc) {
  const tagOrText = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
  const stack = [rootEl];
  let m;
  while ((m = tagOrText.exec(html)) !== null) {
    if (m[0].startsWith('<!--')) continue;
    if (m[3] !== undefined) {
      const text = m[3];
      if (text) {
        stack[stack.length - 1].appendChild(new StubTextNode(text, doc));
      }
      continue;
    }
    const isClosing = m[0].startsWith('</');
    const tag = m[1].toLowerCase();
    const attrText = m[2] || '';
    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].localName === tag) {
          stack.length = i;
          break;
        }
      }
    } else {
      const el = new StubElement(tag, doc);
      parseAttributes(attrText.replace(/\/$/, ''), el);
      stack[stack.length - 1].appendChild(el);
      const selfClosing = attrText.trim().endsWith('/') || VOID_TAGS.has(tag);
      if (!selfClosing) {
        stack.push(el);
      }
    }
  }
}

export function parseHtmlIntoDocument(html, doc = new StubDocument()) {
  const clean = String(html || '').replace(/<!doctype[^>]*>/i, '');
  const htmlMatch = clean.match(/<html([^>]*)>/i);
  if (htmlMatch) {
    parseAttributes(htmlMatch[1], doc.documentElement);
  }
  const headMatch = clean.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    parseHtmlIntoElement(headMatch[1], doc.head, doc);
    const titleEl = doc.head.querySelector('title');
    if (titleEl) doc.title = titleEl.textContent.trim();
  }
  const bodyMatch = clean.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    parseAttributes(bodyMatch[1], doc.body);
    parseHtmlIntoElement(bodyMatch[2], doc.body, doc);
  } else {
    parseHtmlIntoElement(clean, doc.body, doc);
  }
  return doc;
}

export function createMemoryStorage(options = {}) {
  const map = new Map(Object.entries(options.initial || {}));
  return {
    getItem(key) {
      if (options.throwOnGet) {
        const err = new Error(options.throwOnGet);
        err.name = options.throwOnGet;
        throw err;
      }
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (options.throwOnSet) {
        const err = new Error(options.throwOnSet);
        err.name = options.throwOnSet;
        throw err;
      }
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    _dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

/**
 * Installs stub browser globals temporarily and returns a restore() function.
 */
export function installDomGlobals(options = {}) {
  const doc = options.html ? parseHtmlIntoDocument(options.html) : new StubDocument();
  const storage = options.storage ?? createMemoryStorage();
  const reducedMotion = Boolean(options.reducedMotion);
  const fetchBaseUrl = options.fetchBaseUrl || null;
  const realFetch = globalThis.fetch;

  const windowListeners = new Map();
  const stubWindow = {
    document: doc,
    location: {
      href: fetchBaseUrl ? `${fetchBaseUrl}/` : 'http://127.0.0.1/',
      origin: fetchBaseUrl || 'http://127.0.0.1',
      hash: options.initialHash || '',
      pathname: '/',
      assign(url) {
        this.href = String(url);
      },
    },
    localStorage: storage,
    matchMedia(query) {
      const isReduced = String(query).includes('prefers-reduced-motion') && reducedMotion;
      return {
        matches: isReduced,
        media: String(query),
        addEventListener() {},
        removeEventListener() {},
      };
    },
    addEventListener(type, listener, opts) {
      StubNode.prototype.addEventListener.call({ _listeners: windowListeners }, type, listener, opts);
    },
    removeEventListener(type, listener, opts) {
      StubNode.prototype.removeEventListener.call({ _listeners: windowListeners }, type, listener, opts);
    },
    dispatchEvent(event) {
      return StubNode.prototype.dispatchEvent.call(
        { _listeners: windowListeners, ownerDocument: doc, parentNode: null },
        event,
      );
    },
    requestAnimationFrame(cb) {
      return setTimeout(() => cb(Date.now()), 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    scrollTo() {},
  };
  stubWindow._listeners = windowListeners;
  doc._window = stubWindow;

  const wrappedFetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    if (/^https?:\/\//i.test(rawUrl)) {
      if (fetchBaseUrl && rawUrl.startsWith(fetchBaseUrl)) {
        return realFetch(rawUrl, init);
      }
      throw new Error(`[BLOCKED_EXTERNAL_FETCH] External fetch forbidden by E2E sandbox: ${rawUrl}`);
    }
    if (!fetchBaseUrl) {
      throw new Error(`[MISSING_FETCH_BASE] fetch("${rawUrl}") called without fetchBaseUrl`);
    }
    const targetUrl = new URL(rawUrl, `${fetchBaseUrl}/`).href;
    return realFetch(targetUrl, init);
  };

  const keys = [
    'document',
    'window',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'CustomEvent',
    'KeyboardEvent',
    'MouseEvent',
    'localStorage',
    'matchMedia',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'fetch',
  ];

  const previous = new Map();
  for (const k of keys) {
    previous.set(k, { existed: Object.prototype.hasOwnProperty.call(globalThis, k), value: globalThis[k] });
  }

  globalThis.document = doc;
  globalThis.window = stubWindow;
  globalThis.HTMLElement = StubElement;
  globalThis.Element = StubElement;
  globalThis.Node = StubNode;
  globalThis.Event = StubEvent;
  globalThis.CustomEvent = StubCustomEvent;
  globalThis.KeyboardEvent = StubKeyboardEvent;
  globalThis.MouseEvent = StubMouseEvent;
  globalThis.localStorage = storage;
  globalThis.matchMedia = stubWindow.matchMedia.bind(stubWindow);
  globalThis.requestAnimationFrame = stubWindow.requestAnimationFrame;
  globalThis.cancelAnimationFrame = stubWindow.cancelAnimationFrame;
  globalThis.fetch = wrappedFetch;

  return {
    document: doc,
    window: stubWindow,
    storage,
    restore() {
      for (const k of keys) {
        const prev = previous.get(k);
        if (prev.existed) {
          globalThis[k] = prev.value;
        } else {
          delete globalThis[k];
        }
      }
    },
  };
}
