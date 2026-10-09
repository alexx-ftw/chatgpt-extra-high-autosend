const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const [name, options, maximumMs] of [
  ['ready text and Extra High', {}, 350],
  ['empty editor and Extra High', { empty: true }, 700],
  ['ready text and a Pro-to-Extra-High slider change', { pro: true }, 2000]
]) {
  test('fast path: ' + name, async () => {
    const page = readyComposer(null, options);
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.trigger.innerText, 'Extra High');
    assert.equal(page.createdPanels, 0);
    assert.equal(page.input.innerText, 'Test prompt');
    assert.equal(page.pastes, options.empty ? 1 : 0);
    assert.ok(page.sentAt <= maximumMs, `${page.sentAt} ms exceeds the ${maximumMs} ms simulated budget`);
  });
}

test('a slow Send button still blocks the fast path until enabled', async () => {
  const page = readyComposer(null, { sendEnabledAt: 2000 });
  await page.run();
  assert.equal(page.sends, 1);
  assert.ok(page.sentAt >= 2000);
  assert.equal(page.createdPanels, 0);
});

test('asynchronous paste waits for actual text and does not insert twice', async () => {
  const page = readyComposer(null, { empty: true, pasteDelay: 200 });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.pastes, 1);
  assert.equal(page.fallbackEdits, 0);
  assert.equal(page.input.innerText, 'Test prompt');
});

test('rejected paste retains the existing native editing fallback', async () => {
  const page = readyComposer(null, { empty: true, rejectPaste: true });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.pastes, 1);
  assert.equal(page.fallbackEdits, 1);
  assert.equal(page.input.innerText, 'Test prompt');
});

test('native prefilling avoids a redundant scripted paste', async () => {
  const page = readyComposer(null, { empty: true, nativePrefillAt: 180 });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.pastes, 0);
  assert.equal(page.fallbackEdits, 0);
});

test('text changed during the final stability window cannot be sent', async () => {
  const page = readyComposer(null, { editAt: 200 });
  await assert.rejects(page.run(), /El texto, Extra High o el botón Enviar/);
  assert.equal(page.sends, 0);
  assert.equal(page.input.innerText, 'Different draft');
});
