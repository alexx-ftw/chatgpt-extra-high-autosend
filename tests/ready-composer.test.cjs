const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.SCRIPT_UNDER_TEST ||
  path.join(__dirname, '..', 'chatgpt-extra-high.user.js'), 'utf8');
const seam = source.lastIndexOf('\n  main().catch(');
assert.ok(seam > 0);

// Run the real main(), guards, waits and send path against a minimal DOM double
// matching a ready composer. This is not an integration test with ChatGPT.
function readyComposer(nextUrl, options = {}) {
  const location = new URL('https://chatgpt.com/?q=Test%20prompt');
  let now = 0, changed = false, sends = 0;
  let sentAt = null, confirmedAt = null, removedAt = null;
  let panelVisible = false, removals = 0;
  const pendingPanels = [];
  const statusPanel = { remove() { panelVisible = false; removals++; removedAt = now; } };
  class ClockDate extends Date { static now() { return now; } }
  const node = attrs => ({
    isConnected: true,
    getClientRects: () => [{}],
    getAttribute: key => attrs[key] ?? null,
    hasAttribute: key => Object.hasOwn(attrs, key),
    matches: () => false,
    closest: () => null,
    querySelector: () => null
  });
  const input = node({ 'data-composer-markdown': '', contenteditable: 'true' });
  input.innerText = 'Test prompt';
  input.tagName = 'DIV';
  const trigger = node({ 'data-selected-reasoning-effort': 'max', 'aria-expanded': 'false' });
  trigger.innerText = 'Extra High';
  const send = node({ type: 'submit', 'aria-label': 'Send' });
  send.click = () => { sends++; sentAt = now; };
  const form = { querySelectorAll: () => [send] };
  input.closest = selector => selector === 'form' ? form : null;
  const document = {
    body: {}, readyState: 'complete',
    addEventListener() {}, removeEventListener() {},
    getElementById: id => id === 'cgpt-q-extra-high-v131-status' && panelVisible ? statusPanel : null,
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
      if (selector.includes('data-composer-navigation-target="reasoning"')) return [trigger];
      if (selector.includes('data-testid="send-button"')) return [send];
      return [];
    }
  };
  const window = { addEventListener() {}, removeEventListener() {} };
  window.self = window.top = window;
  const history = { state: null, replaceState: (_state, _title, value) => {
    location.href = new URL(value, location).href;
  } };
  const statuses = [];
  const context = vm.createContext({
    URL, document, location, window, history, statuses, console,
    captureStatus(message) { panelVisible = true; statuses.push(message); },
    Date: ClockDate, HTMLTextAreaElement: class {},
    getComputedStyle: () => ({ visibility: 'visible' }),
    setTimeout(callback, delay) {
      now += delay;
      if (!changed && nextUrl) {
        changed = true;
        location.href = new URL(nextUrl, location).href;
      }
      queueMicrotask(callback);
    }
  });
  vm.runInContext(source.slice(0, seam) +
    '\n  notify = globalThis.captureStatus;\n  globalThis.run = main;\n' +
    '  globalThis.getPhase = () => phase;\n  globalThis.report = diagnostic;\n})();', context);
  return {
    run: context.run, statuses, location, input, send, trigger, pendingPanels,
    diagnostic: context.report,
    get phase() { return context.getPhase(); },
    get panelVisible() { return panelVisible; },
    get removals() { return removals; },
    get removedAt() { return removedAt; },
    get confirmedAt() { return confirmedAt; },
    get sends() { return sends; }
  };
}

for (const [name, nextUrl] of [
  ['unchanged URL', null],
  ['q emptied during load', '?q='],
  ['query removed during load', '/'],
  ['q moved to prompt during load', '?prompt=Test%20prompt'],
  ['secondary empty alias added during load', '?q=Test%20prompt&prompt=']
]) {
  test('ready composer reaches one send after ' + name, async () => {
    const page = readyComposer(nextUrl);
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.location.search, '');
    assert.equal(page.input.innerText, 'Test prompt');
    assert.equal(page.phase, 'Envío observado');
  });
}

test('a different query prevents sending even when the old editor text matches', async () => {
  const page = readyComposer('?q=Other');
  await assert.rejects(page.run(), /La consulta de la dirección ha cambiado/);
  assert.equal(page.sends, 0);
  assert.equal(page.input.innerText, 'Test prompt');
});

test('a different chat path prevents sending a ready composer', async () => {
  const page = readyComposer('/c/another-thread');
  await assert.rejects(page.run(), /La dirección ha cambiado/);
  assert.equal(page.sends, 0);
});

// notify is spied on to create a stand-in status panel. The real main() must
// remove that element only after observing activity, not merely after click().
test('confirmed send removes the panel immediately without a success notice', async () => {
  const page = readyComposer(null);
  await page.run();
  assert.equal(page.panelVisible, false, 'Success must not leave the panel on screen');
  assert.equal(page.removals, 1);
  assert.equal(page.removedAt, page.confirmedAt);
  assert.equal(page.sends, 1);
  assert.equal(page.statuses.some(status => status.includes('ha iniciado el mensaje')), false);
  assert.match(page.diagnostic(), /Envío observado/);
});

test('panel stays visible until delayed send acknowledgement', async () => {
  const page = readyComposer(null, { delay: 600 });
  await page.run();
  assert.ok(page.pendingPanels.length >= 3);
  assert.ok(page.pendingPanels.every(Boolean), 'Do not hide the pending-send status');
  assert.equal(page.panelVisible, false);
  assert.equal(page.removedAt, page.confirmedAt);
  assert.equal(page.removals, 1);
});

test('unconfirmed send keeps the error panel and never retries', async () => {
  const page = readyComposer(null, { acknowledge: false });
  await page.run();
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.equal(page.panelVisible, true);
  assert.equal(page.removals, 0);
  assert.equal(page.sends, 1);
  assert.match(page.statuses.at(-1), /^E31:/);
});

test('successful send tolerates an already removed panel without recreating it', async () => {
  const page = readyComposer(null, { panelAlreadyRemoved: true });
  await page.run();
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.panelVisible, false);
  assert.equal(page.removals, 0);
  assert.equal(page.sends, 1);
});
