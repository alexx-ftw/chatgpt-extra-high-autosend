const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real userscript initialization and guard in a sandbox. Do not run main
// or send a request. These tests simulate URL transitions, not a live account.
const source = fs.readFileSync(path.join(__dirname, '..', 'chatgpt-extra-high.user.js'), 'utf8');
const seam = source.lastIndexOf('\n  main().catch(');
assert.ok(seam > 0, 'Expected the userscript entrypoint');
const instrumented = source.slice(0, seam) + '\n  globalThis.subject = { guard, diagnostic };\n})();';
const origin = 'https://chatgpt.com/';

function fixture(initial = '?q=Test%20prompt') {
  const events = new Map();
  const location = new URL(initial, origin);
  const window = {
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name)
  };
  window.top = window.self = window;
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: (name, listener) => events.set('document:' + name, listener),
    removeEventListener: name => events.delete('document:' + name)
  };
  const context = vm.createContext({ URL, location, window, document,
    HTMLTextAreaElement: class {}, console, setTimeout, clearTimeout });
  vm.runInContext(instrumented, context);
  assert.ok(context.subject, 'Test URL should start the userscript');
  return {
    ...context.subject, document, events,
    navigate: value => { location.href = new URL(value, origin).href; }
  };
}

const allowed = [
  ['unchanged q', '?q=Test%20prompt', '?q=Test%20prompt'],
  ['q removed', '?q=Test%20prompt', '/'],
  ['q emptied', '?q=Test%20prompt', '?q='],
  ['bare q flag', '?q=Test%20prompt', '?q'],
  ['q whitespace only', '?q=Test%20prompt', '?q=%20%20'],
  ['prompt emptied', '?prompt=Test%20prompt', '?prompt='],
  ['q migrated to prompt', '?q=Test%20prompt', '?prompt=Test%20prompt'],
  ['prompt migrated to q', '?prompt=Test%20prompt', '?q=Test%20prompt'],
  ['empty q plus matching prompt', '?q=Test%20prompt', '?q=&prompt=Test%20prompt'],
  ['second matching alias added', '?q=Test%20prompt', '?q=Test%20prompt&prompt=Test%20prompt'],
  ['outer whitespace normalized', '?q=%20Test%20prompt%20', '?q=Test%20prompt'],
  ['CRLF normalized to LF', '?q=Test%0D%0Aprompt', '?q=Test%0Aprompt'],
  ['URL encoding reserialized', '?q=Test%20prompt', '?q=Test+prompt'],
  ['unrelated parameters and hash', '?q=Test%20prompt', '?q=Test%20prompt&temporary-chat=true#composer'],
  ['unchanged secondary alias preserves q priority', '?q=Test%20prompt&prompt=Other', '?q=Test%20prompt&prompt=Other'],
  ['unused alias cleared', '?q=Test%20prompt&prompt=Other', '?q=Test%20prompt&prompt='],
  ['unchanged placeholder alias', '?q=Test%20prompt&prompt=%25s', '?q=Test%20prompt&prompt=%25s'],
  ['matching repeated q values', '?q=Test%20prompt', '?q=Test%20prompt&q=Test%20prompt']
];
for (const [name, initial, next] of allowed) {
  test('URL guard allows ' + name, () => {
    const f = fixture(initial);
    f.navigate(next);
    assert.doesNotThrow(f.guard);
  });
}

const rejected = [
  ['different q', '?q=Test%20prompt', '?q=Other'],
  ['different prompt', '?prompt=Test%20prompt', '?prompt=Other'],
  ['different newly added alias', '?q=Test%20prompt', '?q=Test%20prompt&prompt=Other'],
  ['different query after consumption', '?q=Test%20prompt', '?q=&prompt=Other'],
  ['old secondary alias becomes active', '?q=Test%20prompt&prompt=Other', '?prompt=Other'],
  ['case changes are not silently accepted', '?q=Test%20prompt', '?q=test%20prompt'],
  ['internal whitespace is not collapsed', '?q=Test%20prompt', '?q=Test%20%20prompt'],
  ['encoded plus is not a space', '?q=Test%2Bprompt', '?q=Test+prompt'],
  ['literal percent encoding is not decoded twice', '?q=Test%2520prompt', '?q=Test%20prompt'],
  ['different repeated q', '?q=Test%20prompt', '?q=Test%20prompt&q=Other'],
  ['different repeated prompt', '?prompt=Test%20prompt', '?prompt=Test%20prompt&prompt=Other']
];
for (const [name, initial, next] of rejected) {
  test('URL guard rejects ' + name, () => {
    const f = fixture(initial);
    f.navigate(next);
    assert.throws(f.guard, /La consulta de la dirección ha cambiado/);
  });
}

test('URL guard rejects a different chat path', () => {
  const f = fixture();
  f.navigate('/c/test-thread');
  assert.throws(f.guard, /La dirección ha cambiado/);
});

test('removing q does not disable the activity guard', () => {
  const f = fixture();
  f.navigate('/');
  f.document.querySelector = () => ({});
  assert.throws(f.guard, /conversación o un envío en curso/);
});

test('Escape still cancels after query cleanup', () => {
  const f = fixture();
  f.navigate('?q=');
  f.events.get('document:keydown')({ isTrusted: true, type: 'keydown', key: 'Escape', target: null });
  assert.throws(f.guard, /Cancelado con Escape/);
});

test('history navigation still cancels even if text is unchanged', () => {
  const f = fixture();
  f.events.get('popstate')();
  assert.throws(f.guard, /Has cambiado de página/);
});

test('diagnostic distinguishes emptied and absent aliases without prompt content', () => {
  const f = fixture('?q=PRIVATE_INITIAL_SENTINEL');
  f.navigate('?q=');
  const report = f.diagnostic();
  assert.match(report, /URL actual: q=vacío; prompt=ausente/);
  assert.ok(!report.includes('PRIVATE_INITIAL_SENTINEL'));
});

test('a conflicting URL is described without including its text', () => {
  const f = fixture('?q=PRIVATE_INITIAL_SENTINEL');
  f.navigate('?q=PRIVATE_CHANGED_SENTINEL');
  assert.throws(f.guard, /La consulta de la dirección ha cambiado/);
  const report = f.diagnostic();
  assert.match(report, /q=texto distinto/);
  assert.ok(!report.includes('PRIVATE_INITIAL_SENTINEL'));
  assert.ok(!report.includes('PRIVATE_CHANGED_SENTINEL'));
});
