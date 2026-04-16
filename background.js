/**
 * AI Tab Notifier — Background Service Worker
 * 
 * Orchestrates notifications, badges, tab management, and sound playback.
 * Receives messages from content scripts and manages extension state.
 */

// ─── State Management ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 0.7,
  selectedSound: 'gentle-chime',
  notificationsEnabled: true,
  tabHighlightEnabled: true,
  titleFlashEnabled: true,
  autoDismissSeconds: 10,
  platformToggles: {
    ChatGPT: true,
    Claude: true,
    Gemini: true,
    Perplexity: true,
    DeepSeek: true,
    Grok: true,
    Copilot: true,
  },
};

// In-memory state (synced to storage for persistence)
let monitoredTabs = {}; // tabId -> { platform, state, url, timestamp }
let notificationQueue = []; // { platform, url, timestamp, tabId }
let settings = { ...DEFAULT_SETTINGS };

// ─── Initialization ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  // Set defaults if not already set
  const stored = await chrome.storage.local.get(['settings', 'notificationQueue']);
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  }
  if (stored.notificationQueue) {
    notificationQueue = stored.notificationQueue;
  }

  console.log('[AI Tab Notifier] Extension installed/updated');
});

// Restore state on service worker wake-up
async function restoreState() {
  try {
    const stored = await chrome.storage.local.get(['settings', 'monitoredTabs', 'notificationQueue']);
    if (stored.settings) settings = { ...DEFAULT_SETTINGS, ...stored.settings };
    if (stored.monitoredTabs) monitoredTabs = stored.monitoredTabs;
    if (stored.notificationQueue) notificationQueue = stored.notificationQueue;
  } catch (e) {
    console.error('[AI Tab Notifier] Failed to restore state:', e);
  }
}

restoreState();

// ─── Persist State ──────────────────────────────────────────────────────────

async function persistState() {
  try {
    await chrome.storage.local.set({
      monitoredTabs,
      notificationQueue: notificationQueue.slice(-50), // keep last 50
    });
  } catch (e) {
    console.error('[AI Tab Notifier] Failed to persist state:', e);
  }
}

async function persistSettings() {
  try {
    await chrome.storage.local.set({ settings });
  } catch (e) {
    console.error('[AI Tab Notifier] Failed to persist settings:', e);
  }
}

// ─── Message Handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (msg.type) {
    case 'TAB_REGISTERED':
      handleTabRegistered(tabId, msg);
      sendResponse({ ok: true });
      break;

    case 'AI_GENERATING':
      handleGenerating(tabId, msg);
      sendResponse({ ok: true });
      break;

    case 'AI_RESPONSE_READY':
      handleResponseReady(tabId, msg);
      sendResponse({ ok: true });
      break;

    case 'TAB_FOCUSED':
      handleTabFocused(tabId, msg);
      sendResponse({ ok: true });
      break;

    // Popup requests
    case 'GET_STATE':
      sendResponse({
        monitoredTabs,
        notificationQueue,
        settings,
      });
      break;

    case 'UPDATE_SETTINGS':
      settings = { ...settings, ...msg.settings };
      persistSettings();
      sendResponse({ ok: true });
      break;

    case 'CLEAR_QUEUE':
      notificationQueue = [];
      persistState();
      sendResponse({ ok: true });
      break;

    case 'FOCUS_TAB':
      focusTab(msg.tabId);
      sendResponse({ ok: true });
      break;

    case 'CLEAR_TAB_NOTIFICATION':
      clearTabNotification(msg.tabId);
      sendResponse({ ok: true });
      break;

    case 'CYCLE_READY_TABS':
      cycleReadyTabs();
      sendResponse({ ok: true });
      break;

    default:
      sendResponse({ ok: false, error: 'Unknown message type' });
  }

  return true; // async
});

// ─── Handlers ───────────────────────────────────────────────────────────────

function handleTabRegistered(tabId, msg) {
  if (!tabId) return;
  monitoredTabs[tabId] = {
    platform: msg.platform,
    state: 'idle',
    url: msg.url,
    timestamp: Date.now(),
  };
  persistState();
  updateGlobalBadge();
}

function handleGenerating(tabId, msg) {
  if (!tabId || !settings.enabled) return;
  if (!isPlatformEnabled(msg.platform)) return;

  if (monitoredTabs[tabId]) {
    monitoredTabs[tabId].state = 'generating';
    monitoredTabs[tabId].timestamp = Date.now();
  } else {
    monitoredTabs[tabId] = {
      platform: msg.platform,
      state: 'generating',
      url: '',
      timestamp: Date.now(),
    };
  }

  // Set orange "generating" badge on the specific tab
  setTabBadge(tabId, '...', '#FF9800');
  persistState();
  updateGlobalBadge();
}

async function handleResponseReady(tabId, msg) {
  if (!tabId || !settings.enabled) return;
  if (!isPlatformEnabled(msg.platform)) return;

  // Update tab state
  if (monitoredTabs[tabId]) {
    monitoredTabs[tabId].state = 'ready';
    monitoredTabs[tabId].url = msg.url;
    monitoredTabs[tabId].timestamp = msg.timestamp;
  } else {
    monitoredTabs[tabId] = {
      platform: msg.platform,
      state: 'ready',
      url: msg.url,
      timestamp: msg.timestamp,
    };
  }

  // Add to notification queue
  notificationQueue.push({
    platform: msg.platform,
    url: msg.url,
    title: msg.title || msg.platform,
    timestamp: msg.timestamp,
    tabId: tabId,
  });

  // Set green "ready" badge
  setTabBadge(tabId, '✓', '#4CAF50');

  // Tab highlighting
  if (settings.tabHighlightEnabled) {
    highlightTab(tabId);
  }

  // Sound notification
  if (settings.soundEnabled) {
    await playNotificationSound();
  }

  // OS notification
  if (settings.notificationsEnabled) {
    showOSNotification(tabId, msg.platform, msg.title);
  }

  persistState();
  updateGlobalBadge();

  // Auto-dismiss after timeout
  if (settings.autoDismissSeconds > 0 && settings.autoDismissSeconds !== Infinity) {
    setTimeout(() => {
      clearTabNotification(tabId);
    }, settings.autoDismissSeconds * 1000);
  }
}

function handleTabFocused(tabId, msg) {
  if (!tabId) return;
  clearTabNotification(tabId);
}

// ─── Badge Management ───────────────────────────────────────────────────────

function setTabBadge(tabId, text, color) {
  try {
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  } catch (e) { /* tab may have closed */ }
}

function updateGlobalBadge() {
  const readyCount = Object.values(monitoredTabs).filter(t => t.state === 'ready').length;
  const generatingCount = Object.values(monitoredTabs).filter(t => t.state === 'generating').length;

  if (readyCount > 0) {
    chrome.action.setBadgeText({ text: String(readyCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else if (generatingCount > 0) {
    chrome.action.setBadgeText({ text: String(generatingCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

function clearTabNotification(tabId) {
  if (monitoredTabs[tabId]) {
    monitoredTabs[tabId].state = 'idle';
  }
  setTabBadge(tabId, '', '#4CAF50');

  // Tell content script to clear title flash
  try {
    chrome.tabs.sendMessage(tabId, { type: 'CLEAR_NOTIFICATION' }).catch(() => {});
  } catch (e) { /* tab may have closed */ }

  persistState();
  updateGlobalBadge();
}

// ─── Tab Management ─────────────────────────────────────────────────────────

async function highlightTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab) {
      // We can't truly "flash" a tab, but we can update its properties
      // The title flash in content.js handles the visual attention
      chrome.tabs.update(tabId, { highlighted: true });
    }
  } catch (e) { /* tab may have closed */ }
}

async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab) {
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      clearTabNotification(tabId);
    }
  } catch (e) { /* tab may have closed */ }
}

async function cycleReadyTabs() {
  const readyTabIds = Object.entries(monitoredTabs)
    .filter(([_, info]) => info.state === 'ready')
    .map(([id, _]) => parseInt(id));

  if (readyTabIds.length === 0) return;

  // Get currently active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = activeTab?.id;

  // Find next ready tab after current
  let nextIdx = 0;
  if (activeTabId && readyTabIds.includes(activeTabId)) {
    const currentIdx = readyTabIds.indexOf(activeTabId);
    nextIdx = (currentIdx + 1) % readyTabIds.length;
  }

  focusTab(readyTabIds[nextIdx]);
}

// ─── Sound Playback (via Offscreen Document) ────────────────────────────────

let offscreenCreating = false;

async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) return;

  if (offscreenCreating) {
    // Wait for ongoing creation
    await new Promise(resolve => setTimeout(resolve, 500));
    return;
  }

  offscreenCreating = true;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing notification sound when AI response is ready',
    });
  } catch (e) {
    // Document might already exist
  } finally {
    offscreenCreating = false;
  }
}

async function playNotificationSound() {
  try {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({
      type: 'PLAY_SOUND',
      target: 'offscreen',
      sound: settings.selectedSound,
      volume: settings.soundVolume,
    });
  } catch (e) {
    console.error('[AI Tab Notifier] Failed to play sound:', e);
  }
}

// ─── OS Notifications ───────────────────────────────────────────────────────

function showOSNotification(tabId, platform, title) {
  const notifId = `ai-notifier-${tabId}-${Date.now()}`;

  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `✨ ${platform} — Response Ready!`,
    message: title || `Your ${platform} response has finished generating.`,
    priority: 2,
  });

  // Click handler: focus the tab
  const clickHandler = (clickedNotifId) => {
    if (clickedNotifId === notifId) {
      focusTab(tabId);
      chrome.notifications.clear(notifId);
      chrome.notifications.onClicked.removeListener(clickHandler);
    }
  };
  chrome.notifications.onClicked.addListener(clickHandler);

  // Auto-clear after timeout
  if (settings.autoDismissSeconds > 0) {
    setTimeout(() => {
      chrome.notifications.clear(notifId);
    }, settings.autoDismissSeconds * 1000);
  }
}

// ─── Keyboard Shortcut ──────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'cycle-ready-tabs') {
    cycleReadyTabs();
  }
});

// ─── Tab Cleanup ────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  if (monitoredTabs[tabId]) {
    delete monitoredTabs[tabId];
    persistState();
    updateGlobalBadge();
  }
});

// Clean up tabs periodically (in case of stale entries)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && monitoredTabs[tabId]) {
    // Page is reloading — reset state
    monitoredTabs[tabId].state = 'idle';
    setTabBadge(tabId, '', '#4CAF50');
    persistState();
    updateGlobalBadge();
  }
});

// ─── Utility ────────────────────────────────────────────────────────────────

function isPlatformEnabled(platformName) {
  return settings.platformToggles?.[platformName] !== false;
}

console.log('[AI Tab Notifier] Service worker started');
