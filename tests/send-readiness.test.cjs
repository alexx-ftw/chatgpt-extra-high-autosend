const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const label of ['Max', 'Ultra', 'Persistent', 'None', 'Minimal', 'Medium']) {
  test('a non-target visible level is not Extra High: ' + label, () => {
    const page = readyComposer(null);
    page.trigger.innerText = label;
    page.trigger.setAttribute('data-selected-reasoning-effort', 'max');
    assert.equal(page.isExtraHigh(), false);
  });
}

test('a list of all effort names is not proof of the selected level', () => {
  const page = readyComposer(null);
  page.trigger.innerText = 'GPT-6.1 Sol\nLight\nNone\nMinimal\nLight\nMedium\nHigh\nExtra High\nMax\nUltra\nPersistent';
  assert.equal(page.isExtraHigh(), false);
});

test('legacy max remains valid with an explicit Extra High label', () => {
  const page = readyComposer(null);
  assert.equal(page.isExtraHigh(), true);
});

test('a late effort reset is recovered before the first send', async () => {
  let reset = false;
  const page = readyComposer(null, { onTick(env) {
    if (env.phase === '3/3 Envío' && !reset) {
      reset = true;
      env.trigger.innerText = 'Medium';
      env.trigger.setAttribute('data-selected-reasoning-effort', 'medium');
    }
  } });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.trigger.innerText, 'Extra High');
  assert.equal(page.createdPanels, 0);
  assert.ok(page.sentAt < 3000);
});

test('an empty editor after selection is restored before sending', async () => {
  let cleared = false;
  const page = readyComposer(null, { onTick(env) {
    if (env.phase === '3/3 Envío' && !cleared) { cleared = true; env.input.innerText = '\n'; }
  } });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.pastes, 1);
  assert.equal(page.input.innerText, 'Test prompt');
});

test('a different draft stops promptly without overwriting it', async () => {
  const page = readyComposer(null, { editAt: 40 });
  await assert.rejects(page.run(), /El texto, Extra High o el botón Enviar/);
  assert.equal(page.sends, 0);
  assert.equal(page.input.innerText, 'Different draft');
  assert.ok(page.elapsedMs < 1000, 'Do not wait for the global 90 second deadline');
});

test('missing Send is recorded while waiting, before the eventual cancellation', async () => {
  let removed = false;
  const page = readyComposer(null, { onTick(env) {
    if (!removed) { removed = true; env.form.querySelectorAll = () => []; }
  } });
  await assert.rejects(page.run(), /El texto, Extra High o el botón Enviar/);
  assert.equal(page.sends, 0);
  assert.match(page.diagnostic(), /envío=ausente/);
  assert.equal(page.diagnostic().includes('Test prompt'), false);
});

test('multiple send controls are not resolved by clicking the first one', async () => {
  let changed = false;
  const page = readyComposer(null, { onTick(env) {
    if (!changed) { changed = true; env.form.querySelectorAll = () => [env.send, {...env.send}]; }
  } });
  await assert.rejects(page.run(), /El texto, Extra High o el botón Enviar/);
  assert.equal(page.sends, 0);
  assert.match(page.diagnostic(), /envío=ambiguo/);
});

test('cancellation keeps a snapshot independent of later edits', () => {
  const page = readyComposer(null);
  page.interact({ isTrusted: true, type: 'keydown', key: 'Escape', target: page.input });
  page.trigger.innerText = 'Medium';
  page.trigger.setAttribute('data-selected-reasoning-effort', 'medium');
  page.input.innerText = 'x';
  assert.match(page.diagnostic(), /Estado al detenerse:.*texto=coincide.*Extra High/);
  assert.equal(page.diagnostic().includes('Test prompt'), false);
});

test('manual cancellation wins over an empty-editor repair', async () => {
  let cancelled = false;
  const page = readyComposer(null, { onTick(env) {
    if (env.phase !== '3/3 Envío' || cancelled) return;
    cancelled = true;
    env.input.innerText = '';
    page.interact({ isTrusted: true, type: 'keydown', key: 'Escape', target: env.input });
  } });
  await assert.rejects(page.run(), /Cancelado con Escape/);
  assert.equal(page.sends, 0);
  assert.equal(page.pastes, 0);
});

test('empty editor after the single click never causes resubmission', async () => {
  const page = readyComposer(null, { acknowledge: false, onTick(env) {
    if (page.sends) env.input.innerText = '\n';
  } });
  await page.run();
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.equal(page.sends, 1);
  assert.equal(page.pastes, 0);
  assert.equal(page.createdPanels, 1);
});
