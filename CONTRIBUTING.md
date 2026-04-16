<![CDATA[# Contributing to AI Tab Notifier

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ai-tab-notifier.git
   cd ai-tab-notifier
   ```
3. **Load** the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the project folder

## 📋 How to Contribute

### Reporting Bugs

- Open a [GitHub Issue](https://github.com/AmanKirmara/ai-tab-notifier/issues/new)
- Include your Chrome version and OS
- Describe the steps to reproduce the bug
- Include screenshots or console logs if possible

### Suggesting Features

- Open an issue with the **"Feature Request"** label
- Describe the feature and why it would be useful
- If possible, suggest an implementation approach

### Submitting Code

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test the extension thoroughly in Chrome
4. Commit with a clear message: `git commit -m 'Add: support for new AI platform'`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request against `main`

## 🏗️ Project Structure

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration |
| `background.js` | Service worker — state management, notifications, badges |
| `content.js` | Injected into AI pages — DOM observation |
| `popup.html/js/css` | Extension popup UI |
| `offscreen.html/js` | Audio playback bridge |

## 🧪 Testing

- Test all 7 supported platforms if your change affects detection logic
- Verify sound plays correctly via the popup's "Test Sound" button
- Check that desktop notifications appear and clicking them focuses the correct tab
- Test with the extension disabled/enabled
- Test with individual platform toggles

## 🎨 Code Style

- Use `'use strict'` in all scripts
- Use meaningful variable/function names
- Add JSDoc comments for functions
- Keep functions focused and small
- Follow existing patterns in the codebase

## 💡 Adding a New AI Platform

1. Add the platform config to `PLATFORM_CONFIGS` in `content.js`
2. Add URL patterns to `manifest.json` → `content_scripts.matches`
3. Add platform metadata to `PLATFORM_META` in `popup.js`
4. Add the platform toggle in `background.js` → `DEFAULT_SETTINGS.platformToggles`
5. Test thoroughly on the platform

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.
]]>
