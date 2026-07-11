"use strict";
(() => {
  // src/background.ts
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      console.log("SIGSS+ instalado com sucesso!");
      chrome.storage.local.get(["refreshInterval", "refreshOnlyActive", "preventRefreshOnForm", "sortDataSolicitacao"], (result) => {
        const defaults = {};
        if (result.refreshInterval === void 0) defaults.refreshInterval = "disabled";
        if (result.refreshOnlyActive === void 0) defaults.refreshOnlyActive = true;
        if (result.preventRefreshOnForm === void 0) defaults.preventRefreshOnForm = true;
        if (result.sortDataSolicitacao === void 0) defaults.sortDataSolicitacao = true;
        if (Object.keys(defaults).length > 0) {
          chrome.storage.local.set(defaults);
        }
      });
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "open_offline_viewer") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("offline_viewer.html")
      });
    }
  });
})();
//# sourceMappingURL=background.js.map
