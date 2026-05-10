/**
 * PromptShield Content Script Loader
 * Workaround for Manifest V3 content script module loading
 */

(async () => {
  try {
    // Get the extension URL for dynamic import
    const extensionUrl = chrome.runtime.getURL('');

    // Import content-script with full URL
    const contentScriptUrl = chrome.runtime.getURL('content-script.js');
    const module = await import(contentScriptUrl);

    console.log('PromptShield content-script loaded successfully');
  } catch (error) {
    console.error('PromptShield content-script failed to load:', error);
    console.error('This may be due to MV3 restrictions. Please check manifest.json web_accessible_resources.');
  }
})();
