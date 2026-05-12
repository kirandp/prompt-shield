/**
 * PromptShield Popup Script
 * Handles popup UI interactions
 */

// ============================================================================
// DOM Elements
// ============================================================================

const modeButtons = document.querySelectorAll('.mode-btn');
const policySelect = document.getElementById('policySelect');
const statusBadge = document.getElementById('statusBadge');
const dashboardBtn = document.getElementById('dashboardBtn');
const pauseBtn = document.getElementById('pauseBtn');

// ============================================================================
// Initialize
// ============================================================================

chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (response.state) {
        updateUI(response.state);
    }
});

// ============================================================================
// Event Listeners
// ============================================================================

// Mode selection
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        chrome.runtime.sendMessage({ type: 'SET_MODE', mode }, (response) => {
            if (response.success) {
                updateModeButtons(mode);
                chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
                    updateUI(res.state);
                });
            }
        });
    });
});

// Policy selection
policySelect.addEventListener('change', () => {
    const policy = policySelect.value;
    chrome.runtime.sendMessage({ type: 'SET_POLICY', policy }, (response) => {
        if (response.success) {
            chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
                updateUI(res.state);
            });
        }
    });
});

// Dashboard button
dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://prompt-shield-kdp.vercel.app/shield' });
});

// Pause button
pauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' }, (response) => {
        if (response.success) {
            updatePauseButton(response.isPaused);
            updateStatusBadge(response.isPaused);
            chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
                updateUI(res.state);
            });
        }
    });
});

// ============================================================================
// UI Updates
// ============================================================================

function updateUI(state) {
    updateModeButtons(state.mode);
    updatePolicySelect(state.policy);
    updateStatusBadge(state.isPaused);
    updatePauseButton(state.isPaused);
}

function updateModeButtons(activeMode) {
    modeButtons.forEach(btn => {
        if (btn.getAttribute('data-mode') === activeMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updatePolicySelect(policy) {
    policySelect.value = policy;
}

function updateStatusBadge(isPaused) {
    if (isPaused) {
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'status-badge status-paused';
    } else {
        statusBadge.textContent = 'Protected';
        statusBadge.className = 'status-badge status-protected';
    }
}

function updatePauseButton(isPaused) {
    if (isPaused) {
        pauseBtn.textContent = '▶ Resume';
        pauseBtn.style.opacity = '0.6';
    } else {
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.style.opacity = '1';
    }
}

// ============================================================================
// Periodic Updates
// ============================================================================

// Update stats every 5 seconds
setInterval(() => {
    chrome.runtime.sendMessage({ type: 'GET_DETECTION_STATS' }, (stats) => {
        if (stats && stats.today) {
            const cards = document.querySelectorAll('.activity-card');
            const categories = stats.today.categories || {};

            // Update activity cards (this is simplified - in production would be more dynamic)
            if (cards.length >= 4) {
                cards[0].querySelector('.activity-number').textContent = categories.PHI || 0;
                cards[1].querySelector('.activity-number').textContent = categories.PII || 0;
                cards[2].querySelector('.activity-number').textContent = categories.SECRET || 0;
                cards[3].querySelector('.activity-number').textContent = stats.today.masked || 0;
            }
        }
    });
}, 5000);

console.log('PromptShield popup loaded');
