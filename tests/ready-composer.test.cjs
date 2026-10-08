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
function readyComposer(nextUrl) {
  const location = new URL('https://chatgpt.com/?q=Test%20prompt');
  let now = 0, changed = false, sends = 0;
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
  send.click = () => { sends++; };
  const form = { querySelectorAll: () => [send] };
  input.closest = selector => selector === 'form' ? form : null;
  const document = {
    body: {}, readyState: 'complete',
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    querySelector: selector => selector.includes('data-user-message-bubble') && sends ? {} : null,
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
    '\n  notify = message => statuses.push(message);\n  globalThis.run = main;\n})();', context);
  return { run: context.run, statuses, location, input, send, trigger, get sends() { return sends; } };
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
    assert.ok(page.statuses.some(status => status.includes('ha iniciado el mensaje')));
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
