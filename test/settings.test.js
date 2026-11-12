import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, parametersFor } from '../settings.js';

test('missing or invalid settings fall back to safe defaults', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
  assert.deepEqual(normalizeSettings({ mode: 'invalid', strength: 'oops', advanced: { ratio: NaN } }), DEFAULTS);
});

test('out-of-range settings are bounded', () => {
  const settings = normalizeSettings({ mode: 'advanced', strength: 999, advanced: {
    threshold: -200, ratio: 999, attack: -1, release: 0, knee: 500, gain: 100,
  } });
  assert.deepEqual(settings, { mode: 'advanced', strength: 100, advanced: {
    threshold: -60, ratio: 20, attack: 0, release: 0.01, knee: 40, gain: 12,
  } });
});

test('simple strength maps to progressively stronger compression', () => {
  const low = parametersFor({ strength: 0 });
  const high = parametersFor({ strength: 100 });
  assert.ok(high.threshold < low.threshold);
  assert.ok(high.ratio > low.ratio);
  assert.equal(low.gain, 0);
  assert.equal(high.gain, 0);
});

test('advanced parameters override the simple slider', () => {
  const settings = normalizeSettings({ mode: 'advanced', strength: 100, advanced: { ratio: 3 } });
  assert.equal(parametersFor(settings).ratio, 3);
});
