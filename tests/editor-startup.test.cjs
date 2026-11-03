const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

function fallbackPage({ count = 1, hidden = false, readonly = false } = {}) {
  const page = readyComposer(null);
  const { document, input } = page;
  const query = document.querySelectorAll;
  if (hidden) input.getClientRects = () => [];
  if (readonly) input.setAttribute('aria-readonly', 'true');
  document.querySelectorAll = selector => {
    if (selector.includes('data-composer-markdown')) return [];
    if (selector.includes('textarea[name="prompt-textarea"]')) return Array.from({ length: count }, () => input);
    return query(selector);
  };
  return page;
}

test('an identified composer can use one scoped alternate editor', async () => {
  const page = fallbackPage();
  assert.equal(page.findEditor(), page.input);
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.createdPanels, 0);
});

test('no scoped alternate is picked when there are two candidates', () => {
  assert.equal(fallbackPage({ count: 2 }).findEditor() || null, null);
});

test('a hidden fallback is never used', () => {
  assert.equal(fallbackPage({ hidden: true }).findEditor() || null, null);
});

test('a readonly fallback is never used', () => {
  assert.equal(fallbackPage({ readonly: true }).findEditor() || null, null);
});

test('existing exact selectors retain priority without evaluating alternates', async () => {
  const page = readyComposer(null);
  const query = page.document.querySelectorAll;
  page.document.querySelectorAll = selector => {
    if (selector.includes('textarea[name="prompt-textarea"]')) throw new Error('Unexpected fallback query');
    return query(selector);
  };
  assert.equal(page.findEditor(), page.input);
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.sentAt, 80);
});

test('manual editing of a fallback still cancels automation', async () => {
  const page = fallbackPage();
  page.interact({ type: 'beforeinput', isTrusted: true,
    target: { closest: selector => selector.includes('textarea[name="prompt-textarea"]') ? page.input : null } });
  await assert.rejects(page.run(), /Cancelado por edición manual/);
  assert.equal(page.sends, 0);
});

test('a missing editor produces a neutral startup error, not a login assertion', async () => {
  const page = fallbackPage({ count: 0 });
  await assert.rejects(page.run(), error => {
    assert.match(error.message, /E11:/);
    assert.doesNotMatch(error.message, /Comprueba que has iniciado sesión/);
    return true;
  });
  assert.equal(page.sends, 0);
  assert.equal(page.location.searchParams.get('q'), 'Test prompt');
  const report = page.diagnostic();
  assert.match(report, /Arranque actual:.*documento=complete/);
  assert.match(report, /editores principales=0/);
  assert.equal(report.includes('Test prompt'), false);
});

test('a fallback appearing during startup is handled without a second run', async () => {
  let loaded = false;
  const page = readyComposer(null, { onTick({ now }) { if (now >= 1200) loaded = true; } });
  const query = page.document.querySelectorAll;
  page.document.querySelectorAll = selector => {
    if (selector.includes('data-composer-markdown')) return [];
    if (selector.includes('textarea[name="prompt-textarea"]')) return loaded ? [page.input] : [];
    return query(selector);
  };
  await page.run();
  assert.equal(page.sends, 1);
  assert.ok(page.sentAt >= 1200);
});
