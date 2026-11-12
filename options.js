import { normalizeSettings } from './settings.js';

const slider = document.querySelector('#strength');
const value = document.querySelector('#strength-value');
const details = document.querySelector('#advanced-details');
const status = document.querySelector('#status');
const fields = [...document.querySelectorAll('.fields input')];
let settings = normalizeSettings((await chrome.storage.local.get('settings')).settings);
let saveQueue = Promise.resolve();
let saveTimer;

function render() {
  slider.value = settings.strength;
  value.textContent = `${settings.strength}%${settings.mode === 'advanced' ? ' (advanced active)' : ''}`;
  for (const field of fields) field.value = settings.advanced[field.name];
}

function save() {
  clearTimeout(saveTimer);
  const snapshot = normalizeSettings(settings);
  status.textContent = 'Saving…';
  // Serialize writes so an older update cannot overwrite a newer one.
  saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ settings: snapshot }));
  const current = saveQueue;
  current.then(() => {
    if (saveQueue === current) status.textContent = 'Saved. Active tabs updated.';
  }, (error) => {
    if (saveQueue === current) status.textContent = `Could not save: ${error.message}`;
  });
}

slider.addEventListener('input', () => {
  settings.strength = Number(slider.value);
  settings.mode = 'simple';
  value.textContent = `${settings.strength}%`;
  status.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 120);
});

for (const field of fields) {
  field.addEventListener('change', () => {
    settings.advanced[field.name] = field.value;
    settings.mode = 'advanced';
    settings = normalizeSettings(settings);
    render();
    save();
  });
}

if (settings.mode === 'advanced') details.open = true;
render();
