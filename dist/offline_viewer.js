"use strict";
(() => {
  // src/ui/offline/offline_viewer.ts
  document.addEventListener("DOMContentLoaded", () => {
    const cacheTimestampEl = document.getElementById("cache-timestamp");
    const tableContainerEl = document.getElementById("table-container");
    const noCacheMessageEl = document.getElementById("no-cache-message");
    const btnClose = document.getElementById("btn-close");
    const tabButtons = document.querySelectorAll(".tab-btn");
    let activeTab = "atendimento";
    let caches = {
      atendimento: null,
      acolhimento: null,
      fila: null
    };
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        window.close();
      });
    }
    const renderTab = (tabKey) => {
      const cache = caches[tabKey];
      if (!cache || !cache.html) {
        if (noCacheMessageEl) noCacheMessageEl.classList.remove("hidden");
        if (tableContainerEl) tableContainerEl.classList.add("hidden");
        if (cacheTimestampEl) cacheTimestampEl.textContent = "Sem dados em cache para esta aba.";
        return;
      }
      if (noCacheMessageEl) noCacheMessageEl.classList.add("hidden");
      if (tableContainerEl) tableContainerEl.classList.remove("hidden");
      if (cacheTimestampEl) {
        const date = new Date(cache.timestamp);
        const formattedDate = date.toLocaleDateString("pt-BR");
        const formattedTime = date.toLocaleTimeString("pt-BR");
        cacheTimestampEl.textContent = `${cache.name || "Fila"} salva em ${formattedDate} \xE0s ${formattedTime}`;
      }
      if (tableContainerEl) {
        tableContainerEl.innerHTML = cache.html;
        const elements = tableContainerEl.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
        elements.forEach((el) => {
          el.setAttribute("tabindex", "-1");
          el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
        });
      }
    };
    const loadCaches = () => {
      chrome.storage.local.get([
        "queueCache_atendimento",
        "queueCache_acolhimento",
        "queueCache_fila"
      ], (items) => {
        caches.atendimento = items.queueCache_atendimento || null;
        caches.acolhimento = items.queueCache_acolhimento || null;
        caches.fila = items.queueCache_fila || null;
        renderTab(activeTab);
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const tabKey = target.getAttribute("data-tab") || "atendimento";
        tabButtons.forEach((b) => b.classList.remove("active"));
        target.classList.add("active");
        activeTab = tabKey;
        renderTab(activeTab);
      });
    });
    loadCaches();
  });
})();
//# sourceMappingURL=offline_viewer.js.map
