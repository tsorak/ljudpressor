import { normalizeSettings } from './settings.js';

const enabled = document.querySelector('#enabled');
const slider = document.querySelector('#strength');
const value = document.querySelector('#strength-value');
const status = document.querySelector('#status');
const advanced = document.querySelector('#advanced');
let settings;
let tabId;
let saveQueue = Promise.resolve();

function showStrength() {
  value.textContent = `${settings.strength}%${settings.mode === 'advanced' ? ' (advanced)' : ''}`;
  value.title = settings.mode === 'advanced' ? 'Advanced settings are active; move the slider to use simple mode' : '';
  slider.value = settings.strength;
}

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No active tab found');
  tabId = tab.id;
  const [saved, state] = await Promise.all([
    chrome.storage.local.get('settings'),
    chrome.runtime.sendMessage({ target: 'worker', type: 'status', tabId }),
  ]);
  if (state?.error) throw new Error(state.error);
  settings = normalizeSettings(saved.settings);
  enabled.checked = !!state?.active;
  enabled.disabled = false;
  slider.disabled = false;
  showStrength();
  status.textContent = enabled.checked ? 'On for this tab' : 'Off for this tab';
} catch (error) {
  status.textContent = `Cannot access this tab: ${error.message}`;
}

enabled.addEventListener('change', async () => {
  enabled.disabled = true;
  status.textContent = 'Updating tab audio…';
  try {
    const result = await chrome.runtime.sendMessage({ target: 'worker', type: 'toggle', tabId });
    enabled.checked = !!result?.active;
    status.textContent = result?.error || (enabled.checked ? 'On for this tab' : 'Off for this tab');
  } catch (error) {
    enabled.checked = !enabled.checked;
    status.textContent = error.message;
  } finally {
    enabled.disabled = false;
  }
});

function saveStrength() {
  settings.mode = 'simple';
  settings.strength = Number(slider.value);
  showStrength();
  const snapshot = normalizeSettings(settings);
  // Keep slider writes ordered while it is dragged rapidly.
  saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ settings: snapshot }));
  saveQueue.catch((error) => { status.textContent = `Could not save strength: ${error.message}`; });
}

slider.addEventListener('input', saveStrength);
advanced.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
