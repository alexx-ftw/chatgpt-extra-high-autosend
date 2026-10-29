const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const errorAt of [0, 600, 5000]) {
  test(`Failed to fetch after ${errorAt} ms is not a confirmed send`, async () => {
    const page = readyComposer(null, { errorAt, optimisticOnly: true });
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.phase, 'Error tras el envío');
    assert.equal(page.createdPanels, 1);
    assert.match(page.statuses.at(-1), /E32:.*Failed to fetch/);
    assert.match(page.diagnostic(), /Resultado del envío: error: Failed to fetch/);
    assert.ok(page.elapsedMs < 30000);
    await page.copyDiagnostic();
    assert.equal(page.clipboard[0].includes('Test prompt'), false);
  });
}

test('a user bubble or Stop control alone is not proof of a response', async () => {
  const page = readyComposer(null, { optimisticOnly: true });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.match(page.statuses.at(-1), /E31:/);
  assert.doesNotMatch(page.diagnostic(), /La interfaz ha iniciado el mensaje/);
});

test('success needs visible response content and remains silent', async () => {
  const page = readyComposer(null, { responseDelay: 800 });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.createdPanels, 0);
  assert.ok(page.elapsedMs >= page.sentAt + 800);
  assert.match(page.diagnostic(), /Resultado del envío: respuesta visible/);
});

test('visible failure takes priority over response content', async () => {
  const page = readyComposer(null, { errorAt: 0 });
  await page.run();
  assert.equal(page.phase, 'Error tras el envío');
  assert.equal(page.sends, 1);
});

test('hidden stale errors do not turn a response into failure', async () => {
  const page = readyComposer(null, { errorAt: 0, hiddenError: true });
  await page.run();
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.createdPanels, 0);
});

test('the diagnostic classifies local conversation URLs without retaining their ID', async () => {
  let changed = false;
  const page = readyComposer(null, { optimisticOnly: true, errorAt: 600, onTick(env) {
    if (!changed && env.phase === '3/3 Envío' && env.now > 80) {
      changed = true;
      page.location.href = 'https://chatgpt.com/c/local-chatgpt%3Aprivate-fixture-id';
    }
  } });
  await page.run();
  assert.equal(page.sends, 1);
  assert.match(page.diagnostic(), /Ruta actual: conversación local/);
  assert.equal(page.diagnostic().includes('private-fixture-id'), false);
  assert.equal(page.diagnostic().includes('Test prompt'), false);
});

test('inline Retry text may be concatenated with the error label', async () => {
  const page = readyComposer(null, { errorAt: 0, optimisticOnly: true });
  page.errorBanner.innerText = 'Failed to fetchRetry';
  await page.run();
  assert.equal(page.phase, 'Error tras el envío');
  assert.equal(page.sends, 1);
});
