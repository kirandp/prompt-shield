/**
 * PromptShield Content Script
 * Injected into target AI tools
 * Intercepts textarea paste events and runs detection
 */

import { regexScan, applyRules, buildMasked, buildHighlighted, getDetectionStats } from './src/detection/engine.js';
import { logDetectionEvent, logMaskingEvent, logBlockedEvent } from './src/utils/audit.js';

// ============================================================================
// Page Configuration
// ============================================================================

// Selectors for different AI tools
const aiToolSelectors = {
  'chatgpt': {
    textarea: '#prompt-textarea',
    responseContainer: '[data-testid="conversation"] [data-testid^="message-"]',
    name: 'ChatGPT'
  },
  'claude': {
    textarea: '[data-testid="chat-input"], .ProseMirror',
    responseContainer: '[data-testid="assistant-response"]',
    name: 'Claude'
  },
  'gemini': {
    textarea: 'rich-textarea .ql-editor',
    responseContainer: '[data-testid="response"]',
    name: 'Google Gemini'
  },
  'copilot': {
    textarea: '.copilot-chat-input textarea',
    responseContainer: '[data-testid="copilot-response"]',
    name: 'Copilot'
  }
};

// Generic fallback selectors
const genericSelectors = {
  textarea: 'textarea, [contenteditable="true"]',
  responseContainer: '[role="article"], .message, .response'
};

// ============================================================================
// Global State
// ============================================================================

let state = {
  mode: 'warn',
  policy: 'hipaa',
  isPaused: false,
  rules: [],
  currentAiTool: detectAiTool()
};

let observedElements = new WeakSet();

// ============================================================================
// Initialization
// ============================================================================

// Get initial state from background
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (response.state) {
    state = { ...state, ...response.state };
  }
});

// Get rules from background
chrome.runtime.sendMessage({ type: 'GET_RULES' }, (response) => {
  if (response.personalRules) {
    state.rules = response.personalRules;
  }
});

// Listen for state changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STATE_CHANGED') {
    state = { ...state, ...request.newState };
  }
});

// ============================================================================
// Element Observation
// ============================================================================

/**
 * Initialize observation of textareas
 */
function initializeObservation() {
  // Observe existing textareas
  const textareas = document.querySelectorAll(genericSelectors.textarea);
  for (const textarea of textareas) {
    attachPasteListener(textarea);
  }

  // Use MutationObserver to catch dynamically added textareas
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const textareas = node.querySelectorAll ? node.querySelectorAll(genericSelectors.textarea) : [];
            if (node.matches?.(genericSelectors.textarea)) {
              attachPasteListener(node);
            }
            for (const textarea of textareas) {
              attachPasteListener(textarea);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

/**
 * Detect which AI tool we're on
 */
function detectAiTool() {
  const url = window.location.href;

  if (url.includes('chat.openai.com')) return 'chatgpt';
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('gemini.google.com')) return 'gemini';
  if (url.includes('copilot.microsoft.com')) return 'copilot';

  return 'unknown';
}

/**
 * Attach paste event listener to a textarea/contenteditable
 */
function attachPasteListener(element) {
  // Avoid duplicate listeners
  if (observedElements.has(element)) {
    return;
  }
  observedElements.add(element);

  element.addEventListener('paste', async (event) => {
    if (state.isPaused) return;

    // Get clipboard text
    let pastedText = '';

    if (event.clipboardData?.getData) {
      pastedText = event.clipboardData.getData('text/plain');
    } else {
      // Fallback for clipboard API
      try {
        pastedText = await navigator.clipboard.readText();
      } catch (error) {
        console.error('Error reading clipboard:', error);
        return;
      }
    }

    if (!pastedText) return;

    // Run detection
    const detections = regexScan(pastedText);
    const rulesApplied = state.rules || [];
    const detectionsWithRules = applyRules(pastedText, detections, rulesApplied);

    // Log detection event
    await logDetectionEvent(detectionsWithRules, state.mode, {
      aiTool: state.currentAiTool,
      textLength: pastedText.length,
      hasRules: rulesApplied.length > 0,
      rulesApplied: rulesApplied.length
    });

    // Dispatch to appropriate mode handler
    if (detectionsWithRules.length === 0) {
      // No detections, allow paste
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Route to mode handlers
    if (state.mode === 'shadow') {
      await handleShadowMode(element, pastedText, detectionsWithRules);
    } else if (state.mode === 'fix') {
      await handleFixMode(element, pastedText, detectionsWithRules);
    } else if (state.mode === 'warn') {
      await handleWarnMode(element, pastedText, detectionsWithRules);
    }
  });
}

// ============================================================================
// Mode Handlers
// ============================================================================

/**
 * Shadow Mode: Silent logging, no user interruption
 */
async function handleShadowMode(element, text, detections) {
  // Log the detection
  await logDetectionEvent(detections, 'shadow', {
    aiTool: state.currentAiTool,
    textLength: text.length
  });

  // Pass through unmodified (let paste continue)
  // This requires re-triggering the paste with the original text
  setTimeout(() => {
    element.focus();
    // Create synthetic paste event with original text
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true
    });
    pasteEvent.clipboardData?.setData('text/plain', text);
    element.dispatchEvent(pasteEvent);
  }, 100);

  // Show notification
  showNotification(`PromptShield: ${detections.length} sensitive items detected (Shadow mode)`);
}

/**
 * Fix Mode: Auto-mask sensitive data
 */
async function handleFixMode(element, text, detections) {
  // Build masked text
  const { masked } = buildMasked(text, detections);

  // Insert masked text into textarea
  if (element.tagName === 'TEXTAREA') {
    element.value = masked;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.contentEditable === 'true') {
    element.textContent = masked;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Log masking event
  await logMaskingEvent(detections, 'fix', {
    aiTool: state.currentAiTool,
    automaticMask: true,
    userConfirmed: false
  });

  // Show toast notification
  showToast(`✓ ${detections.length} items auto-masked. Safe to send.`);
}

/**
 * Warn Mode: Show overlay with options
 */
async function handleWarnMode(element, text, detections) {
  // Inject warning overlay
  const overlay = createWarnOverlay(element, text, detections);
  document.body.appendChild(overlay);

  // Show overlay
  overlay.style.display = 'flex';
}

// ============================================================================
// Overlay UI (Warn Mode)
// ============================================================================

/**
 * Create warning overlay
 */
function createWarnOverlay(element, text, detections) {
  const overlay = document.createElement('div');
  overlay.className = 'promptshield-warn-overlay';
  overlay.id = `overlay_${Date.now()}`;

  const highlighted = buildHighlighted(text, detections);
  const { masked: maskedRaw } = buildMasked(text, detections);
  const masked = typeof maskedRaw === 'string' ? maskedRaw : String(maskedRaw ?? '');

  overlay.innerHTML = `
    <div class="promptshield-warn-modal">
      <div class="warn-header">
        <h2>⚠️ Sensitive Data Detected</h2>
        <p>${detections.length} items found</p>
        <button class="warn-close" aria-label="Close">✕</button>
      </div>

      <div class="warn-content">
        <div class="warn-section">
          <h3>Detections Found:</h3>
          <div class="detection-list">
            ${detections.slice(0, 10).map(d => `
              <div class="detection-item">
                <span class="badge badge-${d.category.toLowerCase()}">${d.category}</span>
                <span class="severity severity-${d.severity}">${d.severity.toUpperCase()}</span>
                <code>${escapeHtml(d.text.substring(0, 30))}${d.text.length > 30 ? '...' : ''}</code>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="warn-section">
          <h3>Highlighted Text:</h3>
          <div class="highlighted-preview">${highlighted}</div>
        </div>

        <div class="warn-section">
          <h3>What AI Would See (Masked):</h3>
          <div class="masked-preview">${escapeHtml(masked)}</div>
        </div>
      </div>

      <div class="warn-actions">
        <button class="btn btn-primary btn-mask">✓ Auto-Mask & Send</button>
        <button class="btn btn-secondary btn-edit">✏️ Edit Manually</button>
        <button class="btn btn-danger btn-block">🚫 Block & Report</button>
      </div>
    </div>
  `;

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const style = document.createElement('style');
  style.textContent = getOverlayStyles();
  document.head.appendChild(style);

  // Event listeners
  const closeBtn = overlay.querySelector('.warn-close');
  const maskBtn = overlay.querySelector('.btn-mask');
  const editBtn = overlay.querySelector('.btn-edit');
  const blockBtn = overlay.querySelector('.btn-block');

  closeBtn?.addEventListener('click', () => {
    overlay.remove();
  });

  maskBtn?.addEventListener('click', async () => {
    const { masked } = buildMasked(text, detections);
    insertText(element, masked);

    await logMaskingEvent(detections, 'warn', {
      aiTool: state.currentAiTool,
      userConfirmed: true,
      automaticMask: false
    });

    showToast('✓ Masked and ready to send');
    overlay.remove();
  });

  editBtn?.addEventListener('click', async () => {
    insertText(element, text);
    overlay.remove();
    showToast('Text restored. Please edit manually');
  });

  blockBtn?.addEventListener('click', async () => {
    await logBlockedEvent(detections, 'user_blocked', {
      mode: 'warn',
      aiTool: state.currentAiTool
    });

    showToast('⛔ Prompt blocked and reported');
    overlay.remove();
  });

  return overlay;
}

/**
 * Get CSS for overlay styles
 */
function getOverlayStyles() {
  return `
    .promptshield-warn-modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .warn-header {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .warn-header h2 {
      margin: 0;
      font-size: 18px;
      color: #1a1a1a;
    }

    .warn-header p {
      margin: 5px 0 0 0;
      font-size: 14px;
      color: #666;
    }

    .warn-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }

    .warn-content {
      padding: 20px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .warn-section {
      margin-bottom: 20px;
    }

    .warn-section h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detection-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detection-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 6px;
      font-size: 13px;
    }

    .badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-phi {
      background: #FCEBEB;
      color: #A32D2D;
    }

    .badge-pii {
      background: #FAEEDA;
      color: #633806;
    }

    .badge-secret {
      background: #EEEDFE;
      color: #3C3489;
    }

    .badge-financial {
      background: #E1F5EE;
      color: #085041;
    }

    .severity {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }

    .severity-critical {
      background: #EA4335;
      color: white;
    }

    .severity-high {
      background: #FBBC04;
      color: #333;
    }

    .severity-medium {
      background: #4285F4;
      color: white;
    }

    .highlighted-preview, .masked-preview {
      padding: 12px;
      background: #f9f9f9;
      border-radius: 6px;
      font-family: "Courier New", monospace;
      font-size: 13px;
      line-height: 1.5;
      max-height: 150px;
      overflow-y: auto;
      word-break: break-all;
    }

    .highlighted-text mark {
      padding: 2px 4px;
      border-radius: 3px;
    }

    .warn-actions {
      display: flex;
      gap: 10px;
      padding: 20px;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .btn {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #0F6E56;
      color: white;
    }

    .btn-primary:hover {
      background: #0a5a45;
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }

    .btn-danger {
      background: #EA4335;
      color: white;
    }

    .btn-danger:hover {
      background: #d33425;
    }
  `;
}

/**
 * Insert text into textarea or contenteditable
 */
function insertText(element, text) {
  if (element.tagName === 'TEXTAREA') {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.contentEditable === 'true') {
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Show notification using Chrome API
 */
function showNotification(message) {
  // Use a simple toast since we can't use chrome.notifications from content script
  showToast(message);
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'promptshield-toast';
  toast.textContent = message;

  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1a1a1a;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    .promptshield-toast.removing {
      animation: slideOut 0.3s ease-out;
    }
  `;

  if (!document.querySelector('style[data-promptshield-toast]')) {
    style.setAttribute('data-promptshield-toast', '');
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') text = text == null ? '' : String(text);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// Start Observation
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeObservation);
} else {
  initializeObservation();
}

console.log('PromptShield content script loaded on', state.currentAiTool);
