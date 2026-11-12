# Ljudpressor

An audio compressor turns down loud peaks, narrowing the gap between quiet and loud sounds. This makes it easier to hear quiet dialogue at a comfortable volume without sudden music or sound effects being too loud.

Ljudpressor is a browser extension for compressing the current tab's audio. Its toolbar dropdown has an on/off switch for the current tab and a simple strength slider. Captured sound is routed back to your speakers through a Web Audio dynamics compressor. Each tab can be switched independently; the same settings apply to all active tabs.

## Install

1. Open your browser's extensions page (usually `chrome://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and select the folder containing `manifest.json`.
3. Pin Ljudpressor to the toolbar for easy access.
4. Open a tab playing audio and click the extension button. Use the switch in the dropdown to start or stop compression for this tab; the green **ON** badge indicates it is active. Adjust the strength slider there whenever you like.
5. Choose **Advanced settings ↗** in the dropdown to open the separate settings tab, with threshold, ratio, attack, release, knee, and output gain controls. Settings are saved automatically and update active tabs.

The browser requires a click **per tab** before capturing audio. Capture survives navigation in that tab but ends when it closes or the browser exits; it cannot resume automatically after a browser restart. Settings *do* survive restarts. Browser-internal pages and some protected content may not allow tab capture. The extension does not record or transmit audio.

If the badge says **ERR**, hover over the extension button for the error message. Reload the extension on the extensions page after changing its source files.

## Development

No build step or third-party dependencies are needed. Run `npm test` (or `node --test`) for the settings tests. The audio capture and playback flow must be tested manually in a compatible Chromium-based browser (version 116 or newer) with a playing tab.
