<![CDATA[<div align="center">

# ⚡ AI Tab Notifier

**Never miss an AI response again.**

A Chrome extension that monitors your AI tool tabs and notifies you with sound, desktop notifications, and tab highlights when responses are ready.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/AmanKirmara/ai-tab-notifier)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-00C853?logo=google&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 🎯 The Problem

When multitasking with multiple AI tools — ChatGPT, Claude, Gemini, and others — you often switch tabs and lose track of which one has finished generating. You end up constantly checking back, wasting time and breaking your flow.

## ✨ The Solution

**AI Tab Notifier** watches your AI tabs in the background and alerts you the instant a response is ready — with sound, a desktop notification, and a visual badge. Stay focused on your work and let the extension handle the monitoring.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🔔 **Sound Notifications** | Choose from 3 built-in sounds (Chime, Ping, Success) with adjustable volume |
| 💬 **Desktop Notifications** | Native OS notifications with click-to-focus |
| ⚡ **Title Flash** | Tab title flashes "⚡ Response Ready!" so you can spot it in your tab bar |
| 🏷️ **Badge Indicators** | Green (✓ ready) and orange (... generating) badges on the extension icon |
| 🎯 **Tab Cycling** | Press `Ctrl+Shift+A` to cycle through tabs with ready responses |
| ⏱️ **Auto-Dismiss** | Notifications auto-clear after a configurable timeout |
| 🎛️ **Per-Platform Control** | Enable/disable monitoring for each AI tool individually |

## 🤖 Supported Platforms

| Platform | URL |
|---|---|
| **ChatGPT** | `chat.openai.com` / `chatgpt.com` |
| **Claude** | `claude.ai` |
| **Gemini** | `gemini.google.com` |
| **Perplexity** | `perplexity.ai` |
| **DeepSeek** | `chat.deepseek.com` |
| **Grok** | `grok.com` / `x.com/i/grok` |
| **Copilot** | `copilot.microsoft.com` |

---

## 📦 Installation

### From Source (Developer Mode)

1. **Clone the repository**
   ```bash
   git clone https://github.com/AmanKirmara/ai-tab-notifier.git
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)

3. **Load the extension**
   - Click **"Load unpacked"**
   - Select the `ai-tab-notifier` folder

4. **Pin the extension** (optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Pin **AI Tab Notifier** for easy access

---

## 🏗️ Architecture

```
ai-tab-notifier/
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — orchestrates everything
├── content.js           # Content script — detects AI response states via MutationObserver
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic — tabs, history, settings
├── popup.css            # Premium popup styling
├── offscreen.html       # Offscreen document for audio playback
├── offscreen.js         # Audio bridge (Web Audio API fallback)
├── icons/               # Extension icons (16, 48, 128px)
└── sounds/              # Notification sounds (MP3)
```

### How It Works

1. **Content Script** (`content.js`) is injected into supported AI platform pages
2. A `MutationObserver` watches the DOM for generating/idle state changes (stop buttons, loading indicators, etc.)
3. When a response finishes, the content script sends a message to the **Background Service Worker**
4. The service worker triggers:
   - 🔊 Sound via the **Offscreen Document** (since service workers can't use Web Audio)
   - 💬 Desktop notification via `chrome.notifications`
   - 🏷️ Badge update on the extension icon
   - ⚡ Title flash command back to the content script

---

## ⚙️ Configuration

Open the extension popup to customize:

- **🔊 Sound** — Toggle on/off, adjust volume, pick a sound style
- **💬 Notifications** — Enable/disable desktop notifications
- **🏷️ Tab Highlighting** — Highlight tabs with ready responses
- **⚡ Title Flash** — Flash the tab title when a response is ready
- **⏱️ Auto-Dismiss** — Set to 5s, 10s, 30s, or never
- **🎛️ Platform Toggles** — Enable/disable each AI platform individually

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** this repository
2. **Create a branch** for your feature: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

### Ideas for Contributions

- 🆕 Add support for more AI platforms (Mistral, Meta AI, etc.)
- 🎨 Custom notification sounds (upload your own)
- 🌐 Localization / i18n support
- 📊 Usage statistics dashboard
- 🔧 Firefox / Edge extension ports

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with ❤️ for AI power users who multitask like pros
- Uses Chrome's [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) APIs
- Offscreen document pattern for reliable audio in service workers

---

<div align="center">

**If this extension saves you time, give it a ⭐!**

</div>
]]>
