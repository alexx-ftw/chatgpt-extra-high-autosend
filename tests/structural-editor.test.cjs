const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

// Synthetic unmarked form or non-form container. Never use private page HTML.
function structuralPage(options = {}) {
  const page = readyComposer(null, options);
  const { document, input, form, send } = page;
  input.setAttribute('name', options.noIdentity ? 'other-field' : 'prompt-textarea');
  input.setAttribute('role', 'textbox');
  if (options.chatLabel) { input.setAttribute('name', 'other-field'); input.setAttribute('aria-label', 'Chat with ChatGPT'); }
  if (options.readonly) input.setAttribute('aria-readonly', 'true');
  if (options.hidden) input.getClientRects = () => [];
  form.matches = selector => !!options.marked && selector.includes('data-composer-surface');
  const baseClosest = input.closest;
  input.closest = selector => {
    if (selector === 'form') return options.noForm ? null : form;
    if (selector.includes('dialog') && options.dialog) return {};
    if (selector.includes('data-composer-surface') && options.marked) return form;
    return baseClosest(selector);
  };
  send.closest = selector => selector === 'form' ? (options.foreignSend ? {} : options.noForm ? null : form) : null;
  const other = { ...input };
  form.querySelectorAll = selector => {
    if (selector.startsWith('textarea, [contenteditable')) return options.multipleEditors ? [input, other] : [input];
    if (selector.includes('data-testid="send-button"')) return options.noSend ? [] : options.multipleSend ? [send, { ...send }] : [send];
    return [];
  };
  const query = document.querySelectorAll;
  document.querySelectorAll = selector => {
    if (selector.includes('data-composer-markdown') || selector.includes('textarea[name="prompt-textarea"]')) return [];
    if (selector.startsWith('textarea, [contenteditable')) return [input];
    return query(selector);
  };
  return page;
}

for (const [name, options] of [
  ['prompt name in unmarked form', {}],
  ['ChatGPT accessible name in unmarked form', { chatLabel: true }],
  ['known composer surface without form', { noForm: true, marked: true, noIdentity: true }]
]) test('structural fallback: ' + name, async () => {
  const page = structuralPage(options);
  assert.equal(page.findEditor(), page.input);
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.createdPanels, 0);
  assert.equal(page.sentAt, 80);
});

for (const [name, options] of [
  ['unidentified editable', { noIdentity: true }],
  ['missing send', { noSend: true }],
  ['ambiguous send', { multipleSend: true }],
  ['ambiguous editables', { multipleEditors: true }],
  ['readonly', { readonly: true }],
  ['hidden', { hidden: true }],
  ['dialog', { dialog: true }],
  ['send in another form', { foreignSend: true }],
  ['no local container', { noForm: true }]
]) test('structural fallback rejects ' + name, () => {
  const page = structuralPage(options);
  assert.equal(page.findEditor() || null, null);
  assert.equal(page.sends, 0);
});

test('structural fallback does not bypass cancellation during manual editing', async () => {
  const page = structuralPage();
  page.interact({ type: 'beforeinput', isTrusted: true, target: page.input });
  await assert.rejects(page.run(), /Cancelado por edición manual/);
  assert.equal(page.sends, 0);
});

test('diagnostic describes an unmatched editable without exposing its attributes or content', () => {
  const page = structuralPage({ noIdentity: true, noSend: true });
  page.input.innerText = 'Private draft should never appear';
  page.input.setAttribute('id', 'private-person-id');
  page.input.setAttribute('aria-label', 'private-person-label');
  const report = page.diagnostic();
  assert.match(report, /estructura editable=/);
  assert.match(report, /sin marca de chat/);
  for (const secret of ['Private draft', 'private-person-id', 'private-person-label', 'Test prompt']) {
    assert.equal(report.includes(secret), false);
  }
});

test('a disabled named send may be discovered but is never clicked until ready', async () => {
  const page = structuralPage({ sendEnabledAt: 2000 });
  await page.run();
  assert.equal(page.sends, 1);
  assert.ok(page.sentAt >= 2000);
});
