import { normalizeSettings } from './settings.js';

const OFFSCREEN_URL = 'offscreen.html';
let creatingDocument;
const inFlight = new Map();

async function offscreenExists() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await offscreenExists()) return;
  if (!creatingDocument) {
    creatingDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Process and play captured tab audio through a compressor.',
    }).finally(() => { creatingDocument = undefined; });
  }
  await creatingDocument;
}

async function sendOffscreen(type, data = {}) {
  return chrome.runtime.sendMessage({ target: 'offscreen', type, ...data });
}

async function updateBadge(tabId, active, error) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: error ? '#b42318' : '#247a46' });
  await chrome.action.setBadgeText({ tabId, text: error ? 'ERR' : active ? 'ON' : '' });
  await chrome.action.setTitle({
    tabId,
    title: error
      ? `Compressor could not start: ${error}. Click to retry; see extension service worker console for details.`
      : active
        ? 'Compression ON — open controls to turn off'
        : 'Compression OFF — open controls to turn on',
  });
}

async function refreshBadge(tabId) {
  const active = (await offscreenExists()) && (await sendOffscreen('has', { tabId }))?.active;
  await updateBadge(tabId, !!active);
}

async function isActive(tabId) {
  return (await offscreenExists()) && !!(await sendOffscreen('has', { tabId }))?.active;
}

function toggleTab(tabId) {
  // Serialize operations for a tab so rapid clicks cannot start two streams.
  const previous = inFlight.get(tabId) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    if (await isActive(tabId)) {
      await sendOffscreen('stop', { tabId });
      await updateBadge(tabId, false);
      return { active: false };
    }
    await ensureOffscreen();
    const { settings: saved } = await chrome.storage.local.get('settings');
    // Stream IDs expire quickly; obtain one only after the offscreen page exists.
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const result = await sendOffscreen('start', {
      tabId, streamId, settings: normalizeSettings(saved),
    });
    if (!result?.ok) throw new Error(result?.error || 'Audio processing did not start');
    await updateBadge(tabId, true);
    return { active: true };
  }).catch(async (error) => {
    console.error('Ljudpressor:', error);
    try { await updateBadge(tabId, false, error.message || String(error)); } catch { /* tab closed */ }
    return { active: false, error: error.message || String(error) };
  }).finally(() => {
    if (inFlight.get(tabId) === task) inFlight.delete(tabId);
  });
  inFlight.set(tabId, task);
  return task;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'worker') return;
  if (message.type === 'ended') {
    refreshBadge(message.tabId).catch(() => { /* tab closed */ });
    return;
  }
  if (message.type !== 'status' && message.type !== 'toggle') return;
  const response = message.type === 'status'
    ? isActive(message.tabId).then((active) => ({ active }))
    : toggleTab(message.tabId);
  response.then(sendResponse, (error) => sendResponse({ active: false, error: error.message }));
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  offscreenExists().then((exists) => {
    if (exists) return sendOffscreen('settings', {
      settings: normalizeSettings(changes.settings.newValue),
    });
  }).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  offscreenExists().then((exists) => {
    if (exists) return sendOffscreen('stop', { tabId });
  }).catch(() => {});
});

// Recover per-tab indicator state if the service worker was suspended and restarted.
chrome.runtime.onStartup.addListener(() => {
  offscreenExists().then(async (exists) => {
    if (!exists) return;
    const response = await sendOffscreen('list');
    for (const tabId of response?.tabIds || []) await updateBadge(tabId, true);
  }).catch(console.error);
});
