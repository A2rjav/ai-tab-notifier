/**
 * AI Tab Notifier — Popup Script
 * 
 * Manages the extension popup UI:
 * - Active tabs display with live status
 * - Notification history queue
 * - Settings management
 * - Sound preview
 */

(() => {
  'use strict';

  // ─── Platform metadata ────────────────────────────────────────────────────

  const PLATFORM_META = {
    ChatGPT:    { emoji: '🤖', color: '#10a37f' },
    Claude:     { emoji: '🧠', color: '#d97706' },
    Gemini:     { emoji: '✨', color: '#4285f4' },
    Perplexity: { emoji: '🔍', color: '#20b2aa' },
    DeepSeek:   { emoji: '🌊', color: '#4f46e5' },
    Grok:       { emoji: '⚡', color: '#1da1f2' },
    Copilot:    { emoji: '🚀', color: '#0078d4' },
  };

  // ─── DOM Refs ─────────────────────────────────────────────────────────────

  const els = {
    globalToggle: document.getElementById('globalToggle'),
    statusText: document.getElementById('statusText'),
    activeTabsList: document.getElementById('activeTabsList'),
    emptyTabs: document.getElementById('emptyTabs'),
    queueList: document.getElementById('queueList'),
    emptyQueue: document.getElementById('emptyQueue'),
    queueBadge: document.getElementById('queueBadge'),
    clearQueueBtn: document.getElementById('clearQueueBtn'),
    soundToggle: document.getElementById('soundToggle'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    notifToggle: document.getElementById('notifToggle'),
    highlightToggle: document.getElementById('highlightToggle'),
    titleFlashToggle: document.getElementById('titleFlashToggle'),
    autoDismissSelect: document.getElementById('autoDismissSelect'),
    platformToggles: document.getElementById('platformToggles'),
    testSoundBtn: document.getElementById('testSoundBtn'),
  };

  let state = {
    monitoredTabs: {},
    notificationQueue: [],
    settings: {},
  };

  // ─── Tab Navigation ───────────────────────────────────────────────────────

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all tabs and panels
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      // Activate clicked tab and panel
      btn.classList.add('active');
      const panelId = `panel-${btn.dataset.tab}`;
      document.getElementById(panelId).classList.add('active');
    });
  });

  // ─── Load State ───────────────────────────────────────────────────────────

  async function loadState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response) {
          state = response;
        }
        resolve();
      });
    });
  }

  // ─── Render Active Tabs ───────────────────────────────────────────────────

  function renderActiveTabs() {
    const tabs = state.monitoredTabs || {};
    const tabEntries = Object.entries(tabs);

    if (tabEntries.length === 0) {
      els.activeTabsList.innerHTML = '';
      els.emptyTabs.classList.add('visible');
      return;
    }

    els.emptyTabs.classList.remove('visible');

    // Sort: ready first, then generating, then idle
    const sortOrder = { ready: 0, generating: 1, idle: 2 };
    tabEntries.sort(([, a], [, b]) => 
      (sortOrder[a.state] ?? 3) - (sortOrder[b.state] ?? 3)
    );

    els.activeTabsList.innerHTML = tabEntries.map(([tabId, info]) => {
      const meta = PLATFORM_META[info.platform] || { emoji: '🤖', color: '#666' };
      const stateClass = `state-${info.state}`;
      const statusHtml = getStatusHtml(info.state);
      const urlDisplay = info.url ? new URL(info.url).pathname.substring(0, 35) : '';

      return `
        <div class="tab-card ${stateClass}" data-tab-id="${tabId}" title="Click to focus this tab">
          <div class="tab-card-icon">${meta.emoji}</div>
          <div class="tab-card-info">
            <div class="tab-card-platform">${info.platform}</div>
            <div class="tab-card-url">${urlDisplay || 'Loading...'}</div>
          </div>
          ${statusHtml}
        </div>
      `;
    }).join('');

    // Add click handlers
    els.activeTabsList.querySelectorAll('.tab-card').forEach(card => {
      card.addEventListener('click', () => {
        const tabId = parseInt(card.dataset.tabId);
        chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId });
      });
    });

    // Update status text
    const readyCount = tabEntries.filter(([, t]) => t.state === 'ready').length;
    const genCount = tabEntries.filter(([, t]) => t.state === 'generating').length;

    if (readyCount > 0) {
      els.statusText.textContent = `${readyCount} response${readyCount > 1 ? 's' : ''} ready!`;
      els.statusText.style.color = '#10b981';
    } else if (genCount > 0) {
      els.statusText.textContent = `${genCount} AI${genCount > 1 ? 's' : ''} generating...`;
      els.statusText.style.color = '#f59e0b';
    } else {
      els.statusText.textContent = `Monitoring ${tabEntries.length} AI tab${tabEntries.length > 1 ? 's' : ''}`;
      els.statusText.style.color = '';
    }
  }

  function getStatusHtml(tabState) {
    switch (tabState) {
      case 'ready':
        return `<div class="tab-card-status status-ready"><span class="status-dot"></span>Ready!</div>`;
      case 'generating':
        return `<div class="tab-card-status status-generating"><span class="status-dot"></span>Generating...</div>`;
      default:
        return `<div class="tab-card-status status-idle">Idle</div>`;
    }
  }

  // ─── Render Notification Queue ────────────────────────────────────────────

  function renderQueue() {
    const queue = state.notificationQueue || [];

    // Update badge
    if (queue.length > 0) {
      els.queueBadge.textContent = queue.length;
      els.queueBadge.style.display = 'inline-flex';
    } else {
      els.queueBadge.style.display = 'none';
    }

    if (queue.length === 0) {
      els.queueList.innerHTML = '';
      els.emptyQueue.classList.add('visible');
      return;
    }

    els.emptyQueue.classList.remove('visible');

    // Show most recent first
    const sortedQueue = [...queue].reverse().slice(0, 25);

    els.queueList.innerHTML = sortedQueue.map((item) => {
      const meta = PLATFORM_META[item.platform] || { emoji: '🤖' };
      const timeStr = formatTime(item.timestamp);
      const titleDisplay = item.title ? item.title.substring(0, 40) : item.platform;

      return `
        <div class="queue-item" data-tab-id="${item.tabId}" title="Click to focus tab">
          <span class="queue-item-icon">${meta.emoji}</span>
          <div class="queue-item-info">
            <div class="queue-item-platform">${item.platform}</div>
            <div class="queue-item-title">${escapeHtml(titleDisplay)}</div>
          </div>
          <span class="queue-item-time">${timeStr}</span>
        </div>
      `;
    }).join('');

    // Click to focus tab
    els.queueList.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        if (tabId) {
          chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId });
        }
      });
    });
  }

  // ─── Render Settings ──────────────────────────────────────────────────────

  function renderSettings() {
    const s = state.settings || {};

    els.globalToggle.checked = s.enabled !== false;
    els.soundToggle.checked = s.soundEnabled !== false;
    els.volumeSlider.value = Math.round((s.soundVolume || 0.7) * 100);
    els.volumeValue.textContent = `${els.volumeSlider.value}%`;
    els.notifToggle.checked = s.notificationsEnabled !== false;
    els.highlightToggle.checked = s.tabHighlightEnabled !== false;
    els.titleFlashToggle.checked = s.titleFlashEnabled !== false;
    els.autoDismissSelect.value = String(s.autoDismissSeconds || 10);

    // Set active sound option
    document.querySelectorAll('.sound-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sound === (s.selectedSound || 'gentle-chime'));
    });

    // Disabled body class
    document.body.classList.toggle('disabled', !els.globalToggle.checked);
    if (!els.globalToggle.checked) {
      els.statusText.textContent = 'Extension disabled';
    }

    // Render platform toggles
    renderPlatformToggles(s.platformToggles || {});
  }

  function renderPlatformToggles(toggles) {
    const platforms = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'DeepSeek', 'Grok', 'Copilot'];

    els.platformToggles.innerHTML = platforms.map(platform => {
      const meta = PLATFORM_META[platform] || {};
      const checked = toggles[platform] !== false ? 'checked' : '';

      return `
        <div class="platform-toggle-row">
          <span class="platform-name">
            <span class="platform-emoji">${meta.emoji || '🤖'}</span>
            ${platform}
          </span>
          <label class="toggle-switch small">
            <input type="checkbox" data-platform="${platform}" ${checked}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    }).join('');

    // Add change handlers
    els.platformToggles.querySelectorAll('input[data-platform]').forEach(input => {
      input.addEventListener('change', () => {
        const platform = input.dataset.platform;
        if (!state.settings.platformToggles) {
          state.settings.platformToggles = {};
        }
        state.settings.platformToggles[platform] = input.checked;
        updateSettings({ platformToggles: state.settings.platformToggles });
      });
    });
  }

  // ─── Settings Event Handlers ──────────────────────────────────────────────

  function setupSettingsHandlers() {
    // Global toggle
    els.globalToggle.addEventListener('change', () => {
      updateSettings({ enabled: els.globalToggle.checked });
      document.body.classList.toggle('disabled', !els.globalToggle.checked);
      els.statusText.textContent = els.globalToggle.checked 
        ? 'Monitoring AI tabs' 
        : 'Extension disabled';
      els.statusText.style.color = els.globalToggle.checked ? '' : '#ef4444';
    });

    // Sound toggle
    els.soundToggle.addEventListener('change', () => {
      updateSettings({ soundEnabled: els.soundToggle.checked });
    });

    // Volume
    els.volumeSlider.addEventListener('input', () => {
      const vol = els.volumeSlider.value;
      els.volumeValue.textContent = `${vol}%`;
      updateSettings({ soundVolume: vol / 100 });
    });

    // Sound picker
    document.querySelectorAll('.sound-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sound-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateSettings({ selectedSound: btn.dataset.sound });
      });
    });

    // Test sound
    els.testSoundBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'PLAY_SOUND',
        target: 'offscreen',
        sound: state.settings.selectedSound || 'gentle-chime',
        volume: state.settings.soundVolume || 0.7,
      });
      // Visual feedback
      els.testSoundBtn.style.transform = 'scale(0.95)';
      setTimeout(() => { els.testSoundBtn.style.transform = ''; }, 150);
    });

    // Notification toggles
    els.notifToggle.addEventListener('change', () => {
      updateSettings({ notificationsEnabled: els.notifToggle.checked });
    });

    els.highlightToggle.addEventListener('change', () => {
      updateSettings({ tabHighlightEnabled: els.highlightToggle.checked });
    });

    els.titleFlashToggle.addEventListener('change', () => {
      updateSettings({ titleFlashEnabled: els.titleFlashToggle.checked });
    });

    // Auto-dismiss
    els.autoDismissSelect.addEventListener('change', () => {
      updateSettings({ autoDismissSeconds: parseInt(els.autoDismissSelect.value) });
    });

    // Clear queue
    els.clearQueueBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' });
      state.notificationQueue = [];
      renderQueue();
    });
  }

  function updateSettings(partial) {
    state.settings = { ...state.settings, ...partial };
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: state.settings });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Auto-Refresh ─────────────────────────────────────────────────────────

  let refreshInterval;

  function startAutoRefresh() {
    refreshInterval = setInterval(async () => {
      await loadState();
      renderActiveTabs();
      renderQueue();
    }, 2000);
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  async function init() {
    await loadState();
    renderActiveTabs();
    renderQueue();
    renderSettings();
    setupSettingsHandlers();
    startAutoRefresh();
  }

  init();
})();
