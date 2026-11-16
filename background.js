// Toolbar icon (or Alt+Shift+S) shows/hides the spinner panel on the current page.
// Pages where extensions can't run (chrome://, the Web Store, new tab) get the spinner
// in its own tab instead.
const PAGE = chrome.runtime.getURL('spinner.html');

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return openTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'dsu-toggle' });
    return;
  } catch {
    // No overlay script on this page yet.
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'dsu-toggle' });
  } catch {
    openTab();
  }
});

async function openTab() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [PAGE] });
    const existing = contexts.find((c) => c.tabId >= 0);
    if (existing) {
      const t = await chrome.tabs.update(existing.tabId, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
      return;
    }
  } catch { /* fall through */ }
  chrome.tabs.create({ url: PAGE });
}
