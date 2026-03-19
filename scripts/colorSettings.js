/**
 * Color Settings Module
 * Manages color customization for clip entry types (highlight, note, bookmark).
 * Persists user preferences using chrome.storage.local.
 */
(function () {
  'use strict';

  // ── Default Colors ──
  const DEFAULTS = {
    hlBg: '#fef9e7', hlBorder: '#f1c40f', hlText: '#2c3e50', hlBadgeBg: '#f1c40f', hlBadgeText: '#7d6608',
    ntBg: '#eaf2f8', ntBorder: '#3498db', ntText: '#2471a3', ntBadgeBg: '#3498db', ntBadgeText: '#ffffff',
    bkBg: '#f0faf0', bkBorder: '#27ae60', bkText: '#2c3e50', bkBadgeBg: '#27ae60', bkBadgeText: '#ffffff'
  };

  // ── Theme Presets ──
  const THEMES = {
    default: { ...DEFAULTS },
    dark: {
      hlBg: '#3b3a00', hlBorder: '#f1c40f', hlText: '#f5e6a3', hlBadgeBg: '#f1c40f', hlBadgeText: '#1a1a00',
      ntBg: '#0d253a', ntBorder: '#5dade2', ntText: '#aed6f1', ntBadgeBg: '#5dade2', ntBadgeText: '#0a1929',
      bkBg: '#0d3d1f', bkBorder: '#2ecc71', bkText: '#a9dfbf', bkBadgeBg: '#2ecc71', bkBadgeText: '#0a2e16'
    },
    pastel: {
      hlBg: '#fdf2e9', hlBorder: '#f0b27a', hlText: '#6e4b3a', hlBadgeBg: '#f0b27a', hlBadgeText: '#5b3a1f',
      ntBg: '#ebf5fb', ntBorder: '#85c1e9', ntText: '#2e6da4', ntBadgeBg: '#85c1e9', ntBadgeText: '#1b4f72',
      bkBg: '#eafaf1', bkBorder: '#82e0aa', bkText: '#1e8449', bkBadgeBg: '#82e0aa', bkBadgeText: '#145a32'
    },
    warm: {
      hlBg: '#fdebd0', hlBorder: '#e67e22', hlText: '#784212', hlBadgeBg: '#e67e22', hlBadgeText: '#ffffff',
      ntBg: '#fdedec', ntBorder: '#e74c3c', ntText: '#922b21', ntBadgeBg: '#e74c3c', ntBadgeText: '#ffffff',
      bkBg: '#fef9e7', bkBorder: '#f39c12', bkText: '#7d6608', bkBadgeBg: '#f39c12', bkBadgeText: '#ffffff'
    },
    ocean: {
      hlBg: '#d6eaf8', hlBorder: '#2e86c1', hlText: '#1a5276', hlBadgeBg: '#2e86c1', hlBadgeText: '#ffffff',
      ntBg: '#d1f2eb', ntBorder: '#17a589', ntText: '#0e6655', ntBadgeBg: '#17a589', ntBadgeText: '#ffffff',
      bkBg: '#d4efdf', bkBorder: '#27ae60', bkText: '#1e8449', bkBadgeBg: '#27ae60', bkBadgeText: '#ffffff'
    },
    monochrome: {
      hlBg: '#f2f2f2', hlBorder: '#888888', hlText: '#333333', hlBadgeBg: '#888888', hlBadgeText: '#ffffff',
      ntBg: '#e8e8e8', ntBorder: '#666666', ntText: '#444444', ntBadgeBg: '#666666', ntBadgeText: '#ffffff',
      bkBg: '#f8f8f8', bkBorder: '#aaaaaa', bkText: '#555555', bkBadgeBg: '#aaaaaa', bkBadgeText: '#ffffff'
    }
  };

  // ── Mapping: settings key → CSS variable name ──
  const KEY_TO_VAR = {
    hlBg: '--hl-bg', hlBorder: '--hl-border', hlText: '--hl-text', hlBadgeBg: '--hl-badge-bg', hlBadgeText: '--hl-badge-text',
    ntBg: '--nt-bg', ntBorder: '--nt-border', ntText: '--nt-text', ntBadgeBg: '--nt-badge-bg', ntBadgeText: '--nt-badge-text',
    bkBg: '--bk-bg', bkBorder: '--bk-border', bkText: '--bk-text', bkBadgeBg: '--bk-badge-bg', bkBadgeText: '--bk-badge-text'
  };

  // ── Mapping: settings key → input element ID ──
  const KEY_TO_INPUT = {
    hlBg: 'colorHlBg', hlBorder: 'colorHlBorder', hlText: 'colorHlText', hlBadgeBg: 'colorHlBadgeBg', hlBadgeText: 'colorHlBadgeText',
    ntBg: 'colorNtBg', ntBorder: 'colorNtBorder', ntText: 'colorNtText', ntBadgeBg: 'colorNtBadgeBg', ntBadgeText: 'colorNtBadgeText',
    bkBg: 'colorBkBg', bkBorder: 'colorBkBorder', bkText: 'colorBkText', bkBadgeBg: 'colorBkBadgeBg', bkBadgeText: 'colorBkBadgeText'
  };

  // ── Mapping: settings key → hex display span ID ──
  const KEY_TO_HEX = {
    hlBg: 'hexHlBg', hlBorder: 'hexHlBorder', hlText: 'hexHlText', hlBadgeBg: 'hexHlBadgeBg', hlBadgeText: 'hexHlBadgeText',
    ntBg: 'hexNtBg', ntBorder: 'hexNtBorder', ntText: 'hexNtText', ntBadgeBg: 'hexNtBadgeBg', ntBadgeText: 'hexNtBadgeText',
    bkBg: 'hexBkBg', bkBorder: 'hexBkBorder', bkText: 'hexBkText', bkBadgeBg: 'hexBkBadgeBg', bkBadgeText: 'hexBkBadgeText'
  };

  /** Current color state */
  let currentColors = { ...DEFAULTS };

  // ── Apply colors to CSS custom properties ──
  function applyColors(colors) {
    const root = document.documentElement;
    for (const [key, cssVar] of Object.entries(KEY_TO_VAR)) {
      if (colors[key]) {
        root.style.setProperty(cssVar, colors[key]);
      }
    }
    // Update preview dots
    const previewHL = document.getElementById('previewHL');
    const previewNT = document.getElementById('previewNT');
    const previewBK = document.getElementById('previewBK');
    if (previewHL) previewHL.style.background = colors.hlBorder || DEFAULTS.hlBorder;
    if (previewNT) previewNT.style.background = colors.ntBorder || DEFAULTS.ntBorder;
    if (previewBK) previewBK.style.background = colors.bkBorder || DEFAULTS.bkBorder;
  }

  // ── Sync color pickers and hex displays with current colors ──
  function syncUI(colors) {
    for (const [key, inputId] of Object.entries(KEY_TO_INPUT)) {
      const input = document.getElementById(inputId);
      const hex = document.getElementById(KEY_TO_HEX[key]);
      if (input && colors[key]) {
        input.value = colors[key];
      }
      if (hex && colors[key]) {
        hex.textContent = colors[key];
      }
    }
  }

  // ── Save colors to chrome.storage.local ──
  function saveColors(colors) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ kindleClipColors: colors }).then(() => {
        // saved
      }).catch(() => {
        // fallback: do nothing
      });
    } else {
      // Fallback for non-extension context (e.g., opened as file)
      try {
        localStorage.setItem('kindleClipColors', JSON.stringify(colors));
      } catch (e) { /* ignore */ }
    }
  }

  // ── Load colors from chrome.storage.local ──
  function loadColors(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['kindleClipColors']).then((result) => {
        if (result.kindleClipColors) {
          callback({ ...DEFAULTS, ...result.kindleClipColors });
        } else {
          callback({ ...DEFAULTS });
        }
      }).catch(() => {
        callback({ ...DEFAULTS });
      });
    } else {
      // Fallback for non-extension context
      try {
        const saved = localStorage.getItem('kindleClipColors');
        if (saved) {
          callback({ ...DEFAULTS, ...JSON.parse(saved) });
        } else {
          callback({ ...DEFAULTS });
        }
      } catch (e) {
        callback({ ...DEFAULTS });
      }
    }
  }

  // ── Handle a color input change ──
  function onColorChange(key, value) {
    currentColors[key] = value;
    applyColors(currentColors);
    syncUI(currentColors);
    saveColors(currentColors);
  }

  // ── Initialize ──
  function init() {
    const panel = document.getElementById('colorSettingsPanel');
    const toggleBtn = document.getElementById('btnColorSettings');
    const resetBtn = document.getElementById('btnResetColors');

    if (!panel || !toggleBtn) return;

    // Toggle panel visibility
    toggleBtn.addEventListener('click', () => {
      const isVisible = panel.classList.contains('visible');
      panel.classList.toggle('visible');
      toggleBtn.classList.toggle('active', !isVisible);
    });

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        currentColors = { ...DEFAULTS };
        applyColors(currentColors);
        syncUI(currentColors);
        saveColors(currentColors);
      });
    }

    // Wire up each color input
    for (const [key, inputId] of Object.entries(KEY_TO_INPUT)) {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('input', (e) => {
          onColorChange(key, e.target.value);
        });
      }
    }

    // Wire up theme preset buttons
    document.querySelectorAll('.theme-preset-btn[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeName = btn.getAttribute('data-theme');
        const theme = THEMES[themeName];
        if (theme) {
          currentColors = { ...theme };
          applyColors(currentColors);
          syncUI(currentColors);
          saveColors(currentColors);
        }
      });
    });

    // Load saved colors and apply
    loadColors((colors) => {
      currentColors = colors;
      applyColors(currentColors);
      syncUI(currentColors);
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();