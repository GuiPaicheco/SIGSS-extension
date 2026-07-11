"use strict";
(() => {
  // src/ui/popup/popup.ts
  document.addEventListener("DOMContentLoaded", () => {
    const btnAccess = document.getElementById("btn-access");
    const chkEnabled = document.getElementById("chk-enabled");
    const lblStatus = document.getElementById("lbl-status");
    const statusBadge = document.querySelector(".status-badge");
    if (btnAccess) {
      btnAccess.addEventListener("click", () => {
        chrome.tabs.create({
          url: "http://sigss.betim.mg.gov.br/sigss/"
        });
      });
    }
    chrome.storage.local.get({ extensionEnabled: true }, (items) => {
      if (chkEnabled) {
        chkEnabled.checked = items.extensionEnabled;
        updateUIState(items.extensionEnabled);
      }
    });
    if (chkEnabled) {
      chkEnabled.addEventListener("change", () => {
        const enabled = chkEnabled.checked;
        chrome.storage.local.set({ extensionEnabled: enabled });
        updateUIState(enabled);
      });
    }
    function updateUIState(enabled) {
      if (lblStatus) {
        lblStatus.textContent = enabled ? "Extens\xE3o Ativa" : "Extens\xE3o Inativa";
      }
      if (statusBadge) {
        if (enabled) {
          statusBadge.textContent = "\u2713 EXTENS\xC3O ATIVA";
          statusBadge.style.backgroundColor = "#c6f6d5";
          statusBadge.style.color = "#22543d";
        } else {
          statusBadge.textContent = "\u2717 EXTENS\xC3O DESATIVADA";
          statusBadge.style.backgroundColor = "#fed7d7";
          statusBadge.style.color = "#742a2a";
        }
      }
    }
  });
})();
//# sourceMappingURL=popup.js.map
