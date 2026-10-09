const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.SCRIPT_UNDER_TEST ||
  path.join(__dirname, '..', '..', 'chatgpt-extra-high.user.js'), 'utf8');
const seam = source.lastIndexOf('\n  main().catch(');
assert.ok(seam > 0);

// Run the real main(), guards, waits and send path against a minimal DOM double
// matching a ready composer. This is not an integration test with ChatGPT.
function readyComposer(nextUrl, options = {}) {
  const location = new URL('https://chatgpt.com/?q=Test%20prompt');
  let now = 0, changed = false, sends = 0, pastes = 0, fallbackEdits = 0;
  let pendingPaste = null;
  let sentAt = null, confirmedAt = null, removedAt = null;
  let panelVisible = false, removals = 0, createdPanels = 0;
  let statusPanel = null;
  const pendingPanels = [], statuses = [], clipboard = [];
  // DOM doubles only: the real notify() creates, updates and removes this UI.
  function uiNode(tag) {
    const attrs = {}, children = [], listeners = {};
    let text = '';
    return {
      tagName: tag.toUpperCase(), style: {}, children, listeners,
      setAttribute(key, value) { attrs[key] = value; },
      getAttribute(key) { return attrs[key] ?? null; },
      append(...nodes) { children.push(...nodes); },
      addEventListener(type, callback) { listeners[type] = callback; },
      querySelector(selector) {
        return children.find(child => selector === '[data-autosend-message]'
          ? child.getAttribute('data-autosend-message') !== null
          : child.tagName === selector.toUpperCase()) || null;
      },
      get textContent() { return text; },
      set textContent(value) {
        text = value;
        if (Object.hasOwn(attrs, 'data-autosend-message')) statuses.push(value);
      },
      remove() { panelVisible = false; removals++; removedAt = now; }
    };
  }
  class ClockDate extends Date { static now() { return now; } }
  const node = attrs => ({
    isConnected: true,
    getClientRects: () => [{}],
    focus() { document.activeElement = this; },
    setAttribute(key, value) { attrs[key] = value; },
    getAttribute: key => attrs[key] ?? null,
    hasAttribute: key => Object.hasOwn(attrs, key),
    matches: () => false,
    closest: () => null,
    querySelector: () => null
  });
  const input = node({ 'data-composer-markdown': '', contenteditable: 'true' });
  input.innerText = options.empty ? '' : 'Test prompt';
  input.dispatchEvent = event => {
    if (event.type === 'paste') {
      pastes++;
      if (!options.rejectPaste) {
        const text = event.clipboardData.getData('text/plain');
        if (options.pasteDelay) pendingPaste = { text, at: now + options.pasteDelay };
        else input.innerText = text;
      }
    }
    return true;
  };
  input.tagName = 'DIV';
  const trigger = node({ 'data-selected-reasoning-effort': 'max', 'aria-expanded': 'false' });
  trigger.innerText = 'Extra High';
  const send = node({ type: 'submit', 'aria-label': 'Send' });
  send.click = () => { sends++; sentAt = now; };
  send.matches = selector => selector === ':disabled' && now < (options.sendEnabledAt || 0);
  const form = { querySelectorAll: () => [send] };
  input.closest = selector => selector === 'form' ? form : null;
  let level = options.pro ? 4 : 3, menuOpen = false;
  const levels = ['Light', 'Standard', 'High', 'Extra High', 'Pro'];
  function reflectLevel() {
    trigger.innerText = levels[level];
    trigger.setAttribute('data-selected-reasoning-effort', level === 3 ? 'max' : 'medium');
    trigger.setAttribute('aria-expanded', String(menuOpen));
  }
  const thumb = node({ 'role': 'slider', 'aria-valuemin': '0', 'aria-valuemax': '4' });
  thumb.getAttribute = key => key === 'aria-valuenow' ? String(level) :
    ({ 'role': 'slider', 'aria-valuemin': '0', 'aria-valuemax': '4' }[key] ?? null);
  const row = node({ 'data-reasoning-slider': 'true', 'aria-describedby': 'power-status' });
  row.matches = selector => selector.includes('[data-reasoning-slider]');
  row.querySelector = selector => selector === '[role="slider"]' ? thumb : null;
  const announcement = node({ role: 'status' });
  Object.defineProperty(announcement, 'textContent', { get: () => levels[level] + ', ' + (level + 1) + ' of 5.' });
  const menu = node({ 'role': 'menu', 'data-state': 'open' });
  menu.querySelectorAll = selector => selector.includes('data-reasoning-slider') ? [row] : [];
  menu.contains = element => [menu, row, thumb].includes(element);
  function keyEvent(event, from) {
    if (event.type !== 'keydown') return;
    if (event.key === 'ArrowDown' && from === trigger) menuOpen = true;
    else if (event.key === 'Escape') menuOpen = false;
    else if (menuOpen && from === thumb && /^Arrow(Left|Right)$/.test(event.key)) {
      level = Math.max(0, Math.min(4, level + (event.key === 'ArrowLeft' ? -1 : 1)));
    }
    reflectLevel();
  }
  for (const element of [trigger, row, thumb, menu]) {
    element.dispatchEvent = event => { keyEvent(event, element); return true; };
  }
  reflectLevel();
  const document = {
    body: { append(panel) {
      statusPanel = panel; panelVisible = true; createdPanels++;
    } },
    createElement: uiNode,
    createRange: () => ({ selectNodeContents() {} }),
    execCommand(_command, _showUI, text) { fallbackEdits++; input.innerText = text; return true; },
    readyState: 'complete',
    addEventListener() {}, removeEventListener() {},
    getElementById: id => id === 'power-status' ? announcement :
      id === 'cgpt-q-extra-high-v131-status' && panelVisible ? statusPanel : null,
    querySelector: selector => {
      if (!selector.includes('data-user-message-bubble') || !sends) return null;
      const confirmed = options.acknowledge !== false && now >= sentAt + (options.delay || 0);
      if (!confirmed) { pendingPanels.push(panelVisible); return null; }
      if (confirmedAt === null) {
        confirmedAt = now;
        if (options.panelAlreadyRemoved) panelVisible = false;
      }
      return {};
    },
    querySelectorAll: selector => {
      if (selector.includes('data-composer-markdown')) return [input];
      if (selector.includes('[role="menu"]')) return menuOpen ? [menu] : [];
      if (selector.includes('data-composer-navigation-target="reasoning"')) return [trigger];
      if (selector.includes('data-testid="send-button"')) return [send];
      return [];
    }
  };
  const window = { addEventListener() {}, removeEventListener() {} };
  window.self = window.top = window;
  window.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
  const history = { state: null, replaceState: (_state, _title, value) => {
    location.href = new URL(value, location).href;
  } };
  const context = vm.createContext({
    URL, document, location, window, history, statuses, console,
    navigator: { clipboard: { async writeText(text) { clipboard.push(text); } } },
    Date: ClockDate, HTMLTextAreaElement: class {},
    DataTransfer: class { setData(_type, value) { this.text = value; } getData() { return this.text; } },
    ClipboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    getComputedStyle: () => ({ visibility: 'visible' }),
    setTimeout(callback, delay) {
      now += delay;
      if (pendingPaste && now >= pendingPaste.at) { input.innerText = pendingPaste.text; pendingPaste = null; }
      if (options.nativePrefillAt && now >= options.nativePrefillAt && !input.innerText) input.innerText = 'Test prompt';
      if (options.editAt && now >= options.editAt) input.innerText = 'Different draft';
      if (!changed && nextUrl) {
        changed = true;
        location.href = new URL(nextUrl, location).href;
      }
      queueMicrotask(callback);
    }
  });
  vm.runInContext(source.slice(0, seam) +
    '\n  globalThis.sendNotice = notify;\n  globalThis.run = main;\n' +
    '  globalThis.getPhase = () => phase;\n  globalThis.report = diagnostic;\n})();', context);
  return {
    run: context.run, statuses, location, input, send, trigger, pendingPanels,
    diagnostic: context.report, notify: context.sendNotice, clipboard,
    async copyDiagnostic() { await statusPanel.querySelector('button').listeners.click(); },
    get createdPanels() { return createdPanels; },
    get phase() { return context.getPhase(); },
    get panelVisible() { return panelVisible; },
    get removals() { return removals; },
    get removedAt() { return removedAt; },
    get confirmedAt() { return confirmedAt; },
    get sends() { return sends; },
    get sentAt() { return sentAt; },
    get elapsedMs() { return now; },
    get pastes() { return pastes; },
    get fallbackEdits() { return fallbackEdits; }
  };
}


module.exports = { readyComposer };
