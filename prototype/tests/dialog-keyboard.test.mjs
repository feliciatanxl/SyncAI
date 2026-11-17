import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeModal, openModal } from '../js/ui.js';

test('modal wraps keyboard focus and Escape restores the opening control', () => {
  const previousDocument = globalThis.document;
  const previousStyle = globalThis.getComputedStyle;
  const listeners = new Map();
  const control = () => ({
    tabIndex: 0, isConnected: true, getClientRects: () => [{}],
    focus() { globalThis.document.activeElement = this; },
  });
  const [opener, first, last, dialog] = Array.from({ length: 4 }, control);
  dialog.querySelector = () => null;
  const portal = { inert: false };
  const root = {
    hidden: true,
    querySelector: (selector) => selector === '.modal' ? dialog : null,
    querySelectorAll: () => [first, last],
    addEventListener: (event, handler) => listeners.set(event, handler),
    removeEventListener: (event) => listeners.delete(event),
  };
  globalThis.document = {
    activeElement: opener,
    getElementById: (id) => ({ 'portal-root': portal, 'modal-root': root })[id],
  };
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  const dispatch = (key, shiftKey = false) => {
    let prevented = false;
    listeners.get('keydown')({ key, shiftKey, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  };
  try {
    openModal('Schedule preferences');
    assert.equal(portal.inert, true);
    assert.equal(document.activeElement, first);
    dispatch('Tab', true);
    assert.equal(document.activeElement, last);
    dispatch('Tab');
    assert.equal(document.activeElement, first);
    dispatch('Escape');
    assert.equal(root.hidden, true);
    assert.equal(portal.inert, false);
    assert.equal(document.activeElement, opener);
  } finally {
    closeModal();
    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousStyle;
  }
});
