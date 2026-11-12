export const DEFAULTS = Object.freeze({
  mode: 'simple',
  strength: 50,
  advanced: Object.freeze({
    threshold: -30,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
    knee: 20,
    gain: 0,
  }),
});

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return value === '' || value == null || !Number.isFinite(number)
    ? fallback
    : Math.min(max, Math.max(min, number));
}

export function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const advanced = input.advanced && typeof input.advanced === 'object' ? input.advanced : {};
  return {
    mode: input.mode === 'advanced' ? 'advanced' : 'simple',
    strength: bounded(input.strength, DEFAULTS.strength, 0, 100),
    advanced: {
      threshold: bounded(advanced.threshold, DEFAULTS.advanced.threshold, -60, 0),
      ratio: bounded(advanced.ratio, DEFAULTS.advanced.ratio, 1, 20),
      attack: bounded(advanced.attack, DEFAULTS.advanced.attack, 0, 1),
      release: bounded(advanced.release, DEFAULTS.advanced.release, 0.01, 2),
      knee: bounded(advanced.knee, DEFAULTS.advanced.knee, 0, 40),
      gain: bounded(advanced.gain, DEFAULTS.advanced.gain, -12, 12),
    },
  };
}

export function parametersFor(value) {
  const settings = normalizeSettings(value);
  if (settings.mode === 'advanced') return settings.advanced;
  const fraction = settings.strength / 100;
  return {
    threshold: -18 - 30 * fraction,
    ratio: 2 + 10 * fraction,
    knee: 20 - 10 * fraction,
    attack: 0.01 - 0.007 * fraction,
    release: 0.3 - 0.18 * fraction,
    gain: 0,
  };
}
