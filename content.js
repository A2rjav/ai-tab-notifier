/**
 * AI Tab Notifier — Content Script
 * 
 * Injected into supported AI platform pages.
 * Uses MutationObserver to detect when AI responses finish generating.
 * Communicates state changes to the background service worker.
 */

(() => {
  'use strict';

  // ─── Platform Detection Configs ───────────────────────────────────────────
  // Each platform config defines how to detect generating vs. idle states.
  // We use resilient selectors: buttons, ARIA attributes, data-testid, etc.
  
  const PLATFORM_CONFIGS = {
    chatgpt: {
      name: 'ChatGPT',
      hostPatterns: ['chat.openai.com', 'chatgpt.com'],
      // ChatGPT shows a "Stop generating" button while streaming
      generatingSelectors: [
        'button[aria-label="Stop generating"]',
        'button[data-testid="stop-button"]',
        'button[aria-label="Stop streaming"]',
        'button.stop-button',
        // The stop button often contains a square/stop icon
        'button[class*="stop"]',
        // Fallback: look for the animated dots / thinking indicator
        '[data-testid="thinking-indicator"]',
      ],
      // When done, a "Regenerate" or copy button appears on the last message
      idleSelectors: [
        'button[data-testid="regenerate-button"]',
        'button[aria-label="Regenerate"]',
        // The send/submit button reappears when idle
        'button[data-testid="send-button"]',
        'textarea:not([disabled])',
      ],
      chatContainer: 'main',
    },

    claude: {
      name: 'Claude',
      hostPatterns: ['claude.ai'],
      generatingSelectors: [
        'button[aria-label="Stop Response"]',
        'button[aria-label="Stop generating"]',
        'button:has(> svg[class*="stop"])',
        // Claude shows a pulsing indicator while generating
        '[data-is-streaming="true"]',
        '.animate-pulse',
        // Stop button variants
        'button[class*="stop"]',
      ],
      idleSelectors: [
        'button[aria-label="Send Message"]',
        'button[aria-label="Send"]',
        // Input field becomes active again
        '[contenteditable="true"]',
        'div[contenteditable]',
      ],
      chatContainer: '[role="main"], main, #app',
    },

    gemini: {
      name: 'Gemini',
      hostPatterns: ['gemini.google.com'],
      generatingSelectors: [
        'button[aria-label="Stop"]',
        'button[data-test-id="stop-button"]',
        // Gemini shows a loading/thinking animation
        'mat-spinner',
        '.loading-indicator',
        '[aria-label="Loading"]',
        '.model-response-text .loading',
        // Thinking pill
        '[class*="thinking"]',
        'message-actions-loading',
      ],
      idleSelectors: [
        'button[aria-label="Send message"]',
        '.send-button:not([disabled])',
        'rich-textarea:not([disabled])',
      ],
      chatContainer: 'main, .conversation-container',
    },

    perplexity: {
      name: 'Perplexity',
      hostPatterns: ['perplexity.ai', 'www.perplexity.ai'],
      generatingSelectors: [
        'button[aria-label="Stop"]',
        'button[aria-label="Cancel"]',
        // Perplexity shows "Searching..." or "Writing..." indicators
        '[class*="searching"]',
        '[class*="loading"]',
        '.animate-spin',
        // Progress/loading bars
        '[role="progressbar"]',
      ],
      idleSelectors: [
        'button[aria-label="Submit"]',
        'button[aria-label="Ask"]',
        'textarea:not([disabled])',
      ],
      chatContainer: 'main',
    },

    deepseek: {
      name: 'DeepSeek',
      hostPatterns: ['chat.deepseek.com'],
      generatingSelectors: [
        'button[class*="stop"]',
        '[class*="loading"]',
        '.animate-spin',
        // DeepSeek "thinking" indicator
        '[class*="thinking"]',
        'button[aria-label="Stop"]',
      ],
      idleSelectors: [
        'textarea:not([disabled])',
        'button[aria-label="Send"]',
      ],
      chatContainer: 'main, #app',
    },

    grok: {
      name: 'Grok',
      hostPatterns: ['grok.com', 'x.com'],
      generatingSelectors: [
        'button[aria-label="Stop"]',
        'button[aria-label="Stop generating"]',
        '[class*="stop"]',
        '.animate-pulse',
        '[class*="loading"]',
      ],
      idleSelectors: [
        'textarea:not([disabled])',
        'button[aria-label="Send"]',
        '[contenteditable="true"]',
      ],
      chatContainer: 'main, #app',
    },

    copilot: {
      name: 'Copilot',
      hostPatterns: ['copilot.microsoft.com'],
      generatingSelectors: [
        'button[aria-label="Stop Responding"]',
        'button[aria-label="Stop generating"]',
        'cib-typing-indicator',
        '[class*="loading"]',
        '.animate-spin',
      ],
      idleSelectors: [
        'textarea:not([disabled])',
        'button[aria-label="Submit"]',
      ],
      chatContainer: 'main, #app, cib-serp',
    },
  };

  // ─── State ────────────────────────────────────────────────────────────────

  let currentPlatform = null;
  let currentState = 'idle'; // 'idle' | 'generating' | 'ready'
  let observer = null;
  let debounceTimer = null;
  let checkInterval = null;
  let originalTitle = document.title;
  let titleFlashInterval = null;
  let lastReadyTime = 0;

  const DEBOUNCE_MS = 800;
  const POLL_INTERVAL_MS = 1500;
  const READY_COOLDOWN_MS = 3000; // prevent rapid re-notifications

  // ─── Platform Identification ──────────────────────────────────────────────

  function identifyPlatform() {
    const hostname = window.location.hostname;
    const href = window.location.href;

    for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
      for (const pattern of config.hostPatterns) {
        if (hostname === pattern || hostname.endsWith('.' + pattern)) {
          // Special case: x.com/i/grok
          if (pattern === 'x.com' && !href.includes('/i/grok')) {
            continue;
          }
          return { key, ...config };
        }
      }
    }
    return null;
  }

  // ─── Selector Matching ────────────────────────────────────────────────────

  function matchesAnySelector(selectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          // Make sure the element is actually visible
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return true;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return false;
  }

  // ─── State Detection ──────────────────────────────────────────────────────

  function detectState() {
    if (!currentPlatform) return 'idle';

    const isGenerating = matchesAnySelector(currentPlatform.generatingSelectors);
    const isIdle = matchesAnySelector(currentPlatform.idleSelectors);

    if (isGenerating) {
      return 'generating';
    }

    // If we were generating and now we're idle → response is ready
    if (currentState === 'generating' && !isGenerating) {
      return 'ready';
    }

    return 'idle';
  }

  // ─── State Transition Handler ─────────────────────────────────────────────

  function handleStateChange(newState) {
    if (newState === currentState) return;

    const prevState = currentState;
    currentState = newState;

    console.log(`[AI Tab Notifier] ${currentPlatform.name}: ${prevState} → ${newState}`);

    if (newState === 'generating') {
      // AI started generating
      stopTitleFlash();
      sendMessage({ type: 'AI_GENERATING', platform: currentPlatform.name });
    } else if (newState === 'ready') {
      const now = Date.now();
      if (now - lastReadyTime < READY_COOLDOWN_MS) {
        // Too soon after last notification, skip
        currentState = 'idle';
        return;
      }
      lastReadyTime = now;

      // AI finished generating — notify!
      sendMessage({
        type: 'AI_RESPONSE_READY',
        platform: currentPlatform.name,
        url: window.location.href,
        title: document.title,
        timestamp: now,
      });

      // Start title flash for visibility in tab bar
      startTitleFlash();

      // Auto-reset to idle after a moment
      setTimeout(() => {
        if (currentState === 'ready') {
          currentState = 'idle';
        }
      }, 2000);
    } else if (newState === 'idle') {
      // Clean state
    }
  }

  // ─── Title Flash ──────────────────────────────────────────────────────────

  function startTitleFlash() {
    if (titleFlashInterval) return;
    originalTitle = document.title;
    let flash = false;

    titleFlashInterval = setInterval(() => {
      flash = !flash;
      document.title = flash ? `⚡ Response Ready! — ${currentPlatform.name}` : originalTitle;
    }, 1000);
  }

  function stopTitleFlash() {
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
      document.title = originalTitle;
    }
  }

  // ─── Tab Visibility (auto-clear on focus) ─────────────────────────────────

  function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // User focused this tab — clear notification
        stopTitleFlash();
        sendMessage({ type: 'TAB_FOCUSED', platform: currentPlatform.name });
      }
    });

    // Also handle window focus
    window.addEventListener('focus', () => {
      stopTitleFlash();
      sendMessage({ type: 'TAB_FOCUSED', platform: currentPlatform.name });
    });
  }

  // ─── MutationObserver + Polling ───────────────────────────────────────────

  function startMonitoring() {
    if (!currentPlatform) return;

    // Find the chat container to observe
    let container = null;
    const containerSelectors = currentPlatform.chatContainer.split(',').map(s => s.trim());
    for (const sel of containerSelectors) {
      try {
        container = document.querySelector(sel);
        if (container) break;
      } catch (e) { /* skip */ }
    }

    // Fallback to body if no container found
    if (!container) {
      container = document.body;
    }

    // MutationObserver for reactive detection
    observer = new MutationObserver((mutations) => {
      // Debounce to avoid rapid-fire checks
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newState = detectState();
        handleStateChange(newState);
      }, DEBOUNCE_MS);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'disabled', 'aria-label', 'data-is-streaming', 'aria-busy'],
    });

    // Supplementary polling for reliability (catches edge cases)
    checkInterval = setInterval(() => {
      const newState = detectState();
      handleStateChange(newState);
    }, POLL_INTERVAL_MS);

    console.log(`[AI Tab Notifier] Monitoring ${currentPlatform.name} on ${container.tagName}`);
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  function sendMessage(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {
        // Extension context invalidated (e.g., extension reloaded)
      });
    } catch (e) {
      // Silently fail if extension context is gone
    }
  }

  // ─── Listen for background commands ───────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATUS') {
      sendResponse({
        platform: currentPlatform?.name || 'Unknown',
        state: currentState,
        url: window.location.href,
      });
    } else if (msg.type === 'CLEAR_NOTIFICATION') {
      stopTitleFlash();
      currentState = 'idle';
      sendResponse({ ok: true });
    }
    return true; // async response
  });

  // ─── Initialize ───────────────────────────────────────────────────────────

  function init() {
    currentPlatform = identifyPlatform();
    if (!currentPlatform) {
      console.log('[AI Tab Notifier] Not a recognized AI platform page.');
      return;
    }

    console.log(`[AI Tab Notifier] Detected platform: ${currentPlatform.name}`);

    // Register this tab with the background
    sendMessage({
      type: 'TAB_REGISTERED',
      platform: currentPlatform.name,
      url: window.location.href,
    });

    setupVisibilityHandler();

    // Delay slightly to let the page fully render
    setTimeout(() => {
      startMonitoring();
    }, 1500);
  }

  // Wait for page to be ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
