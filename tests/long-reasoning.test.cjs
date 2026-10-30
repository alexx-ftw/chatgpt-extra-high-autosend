const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const responseDelay of [31_000, 60_000, 480_000]) {
  test(`response after ${responseDelay} ms does not produce an early warning`, async () => {
    const page = readyComposer(null, { responseDelay });
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.phase, 'Envío observado');
    assert.equal(page.createdPanels, 0);
    assert.ok(page.elapsedMs >= page.sentAt + responseDelay);
    assert.match(page.diagnostic(), /Resultado del envío: respuesta visible/);
    assert.equal(page.listenerCount, 0);
  });
}

test('a visible Stop control keeps observation silent without a user bubble', async () => {
  const page = readyComposer(null, { noBubble: true, stopUntil: 60_000, responseDelay: 50_000 });
  await page.run();
  assert.equal(page.createdPanels, 0);
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.sends, 1);
});

test('a conversation transition with a cleared editor is pending, not a 30-second failure', async () => {
  const page = readyComposer(null, { noBubble: true, responseDelay: 60_000, onTick(env) {
    if (env.now > 80) {
      page.location.href = 'https://chatgpt.com/c/fixture-conversation';
      env.input.innerText = '\n';
    }
  } });
  await page.run();
  assert.equal(page.createdPanels, 0);
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.sends, 1);
  assert.ok(!page.diagnostic().includes('fixture-conversation'));
});

test('a fetch error later than 30 seconds is still detected without an earlier warning', async () => {
  const page = readyComposer(null, { optimisticOnly: true, errorAt: 45_000 });
  await page.run();
  assert.equal(page.phase, 'Error tras el envío');
  assert.equal(page.createdPanels, 1);
  assert.equal(page.statuses.length, 1);
  assert.match(page.statuses[0], /^E32:/);
  assert.equal(page.sends, 1);
  assert.ok(page.elapsedMs >= page.sentAt + 45_000);
  assert.equal(page.listenerCount, 0);
});

test('the bounded observer exits quietly without claiming success for endless activity', async () => {
  const page = readyComposer(null, { optimisticOnly: true, stopUntil: 900_000 });
  await page.run();
  assert.equal(page.phase, 'Seguimiento finalizado sin confirmar');
  assert.equal(page.createdPanels, 0);
  assert.equal(page.sends, 1);
  assert.ok(page.elapsedMs >= page.sentAt + 600_000);
  assert.ok(page.elapsedMs <= page.sentAt + 601_000);
  assert.match(page.diagnostic(), /Resultado del envío: sin confirmar/);
  assert.doesNotMatch(page.diagnostic(), /Resultado del envío: respuesta visible/);
  assert.equal(page.listenerCount, 0);
});

test('no observable activity still yields E31 after 30 seconds, with one click', async () => {
  const page = readyComposer(null, { acknowledge: false });
  await page.run();
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.equal(page.statuses.length, 1);
  assert.match(page.statuses[0], /^E31:/);
  assert.equal(page.sends, 1);
  assert.ok(page.elapsedMs >= page.sentAt + 30_000);
  assert.ok(page.elapsedMs <= page.sentAt + 31_000);
  assert.equal(page.listenerCount, 0);
});

test('hidden activity markers cannot keep the observer pending', async () => {
  const page = readyComposer(null, { optimisticOnly: true, hiddenBubble: true, hiddenStop: true, stopUntil: 900_000 });
  await page.run();
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.match(page.statuses.at(-1), /^E31:/);
  assert.ok(page.elapsedMs < 31_000);
});

for (const event of ['pagehide', 'popstate', 'manual']) {
  test(`pending observation stops on ${event} without resending or alerting`, async () => {
    let fired = false;
    const page = readyComposer(null, { optimisticOnly: true, onTick(env) {
      if (env.now >= 45_000 && !fired) {
        fired = true;
        if (event === 'manual') env.emitDocument('pointerdown', { isTrusted: true, type: 'pointerdown',
          target: { closest: selector => selector.startsWith('#') ? null : {} } });
        else env.emitWindow(event);
      }
    } });
    await page.run();
    assert.equal(fired, true);
    assert.equal(page.createdPanels, 0);
    assert.equal(page.sends, 1);
    assert.match(page.diagnostic(), /seguimiento interrumpido/);
    assert.equal(page.listenerCount, 0);
  });
}

test('a second conversation opened via history replacement ends the old observation', async () => {
  const page = readyComposer(null, { optimisticOnly: true, onTick(env) {
    if (env.now > 45_000) page.location.href = 'https://chatgpt.com/c/second-fixture-id';
    else if (env.now > 80) page.location.href = 'https://chatgpt.com/c/first-fixture-id';
  } });
  await page.run();
  assert.equal(page.createdPanels, 0);
  assert.equal(page.sends, 1);
  assert.match(page.diagnostic(), /seguimiento interrumpido/);
  assert.ok(!page.diagnostic().includes('fixture-id'));
  assert.equal(page.listenerCount, 0);
});

test('a local-to-conversation transition does not interrupt delayed observation', async () => {
  const page = readyComposer(null, { responseDelay: 60_000, onTick(env) {
    if (env.now > 500) page.location.href = 'https://chatgpt.com/c/final-fixture-id';
    else if (env.now > 80) page.location.href = 'https://chatgpt.com/c/local-chatgpt%3Afixture-id';
  } });
  await page.run();
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.createdPanels, 0);
  assert.equal(page.sends, 1);
  assert.equal(page.listenerCount, 0);
});
