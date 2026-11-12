import { parametersFor } from './settings.js';

const sessions = new Map();

function applySettings(session, settings) {
  const params = parametersFor(settings);
  const { compressor, gain, context } = session;
  compressor.threshold.value = params.threshold;
  compressor.ratio.value = params.ratio;
  compressor.knee.value = params.knee;
  compressor.attack.value = params.attack;
  compressor.release.value = params.release;
  gain.gain.setTargetAtTime(10 ** (params.gain / 20), context.currentTime, 0.02);
}

function stop(tabId, notify = false) {
  const session = sessions.get(tabId);
  if (!session) return;
  sessions.delete(tabId);
  for (const track of session.stream.getTracks()) {
    track.onended = null;
    track.stop();
  }
  session.source.disconnect();
  session.compressor.disconnect();
  session.gain.disconnect();
  session.context.close().catch(console.error);
  if (notify) chrome.runtime.sendMessage({ target: 'worker', type: 'ended', tabId }).catch(() => {});
}

async function start(tabId, streamId, settings) {
  if (sessions.has(tabId)) return { ok: true };
  let stream;
  let context;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false,
    });
    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const compressor = context.createDynamicsCompressor();
    const gain = context.createGain();
    source.connect(compressor).connect(gain).connect(context.destination);
    const session = { stream, context, source, compressor, gain };
    applySettings(session, settings);
    sessions.set(tabId, session);
    for (const track of stream.getAudioTracks()) {
      track.onended = () => stop(tabId, true);
    }
    if (stream.getAudioTracks().some((track) => track.readyState === 'ended')) {
      stop(tabId, true);
      throw new Error('The tab audio stream ended before playback began');
    }
    await context.resume();
    if (!sessions.has(tabId)) throw new Error('The tab audio stream ended during startup');
    return { ok: true };
  } catch (error) {
    if (sessions.has(tabId)) stop(tabId);
    else {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) await context.close().catch(() => {});
    }
    console.error('Could not capture tab audio:', error);
    return { ok: false, error: error.message || String(error) };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;
  (async () => {
    switch (message.type) {
      case 'has': return { active: sessions.has(message.tabId) };
      case 'list': return { tabIds: [...sessions.keys()] };
      case 'start': return start(message.tabId, message.streamId, message.settings);
      case 'stop': stop(message.tabId); return { ok: true };
      case 'settings':
        for (const session of sessions.values()) applySettings(session, message.settings);
        return { ok: true };
      default: return { ok: false, error: 'Unknown command' };
    }
  })().then(sendResponse, (error) => {
    console.error(error);
    sendResponse({ ok: false, error: error.message || String(error) });
  });
  return true;
});
