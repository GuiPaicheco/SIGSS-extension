"use strict";
(() => {
  // src/core/config.ts
  var DEFAULT_CONFIG = {
    refreshInterval: "disabled",
    refreshOnlyActive: true,
    preventRefreshOnForm: true,
    sortDataSolicitacao: true,
    esfMappings: {},
    lastQueueCache: null
  };
  var ConfigManager = class {
    /**
     * Obtém todas as configurações
     */
    static async getAll() {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          resolve({
            ...DEFAULT_CONFIG,
            ...items
          });
        });
      });
    }
    /**
     * Salva configurações genéricas
     */
    static async set(settings) {
      return new Promise((resolve) => {
        chrome.storage.local.set(settings, () => {
          resolve();
        });
      });
    }
    /**
     * Salva um mapeamento de ESF específico
     */
    static async saveEsfMapping(esfCode, mapping) {
      const config = await this.getAll();
      const esfMappings = { ...config.esfMappings };
      esfMappings[esfCode] = mapping;
      await this.set({ esfMappings });
    }
    /**
     * Remove um mapeamento de ESF específico
     */
    static async deleteEsfMapping(esfCode) {
      const config = await this.getAll();
      const esfMappings = { ...config.esfMappings };
      delete esfMappings[esfCode];
      await this.set({ esfMappings });
    }
    /**
     * Registra um listener para quando as configurações forem alteradas em tempo real
     */
    static onChange(callback) {
      chrome.storage.onChanged.addListener(callback);
    }
  };

  // src/ui/offline/offline_viewer.ts
  document.addEventListener("DOMContentLoaded", async () => {
    const cacheTimestampEl = document.getElementById("cache-timestamp");
    const tableContainerEl = document.getElementById("table-container");
    const noCacheMessageEl = document.getElementById("no-cache-message");
    const btnClose = document.getElementById("btn-close");
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        window.close();
      });
    }
    try {
      const config = await ConfigManager.getAll();
      const cache = config.lastQueueCache;
      if (!cache || !cache.html) {
        if (noCacheMessageEl) noCacheMessageEl.classList.remove("hidden");
        if (tableContainerEl) tableContainerEl.classList.add("hidden");
        if (cacheTimestampEl) cacheTimestampEl.textContent = "Sem dados em cache local.";
        return;
      }
      if (cacheTimestampEl) {
        const date = new Date(cache.timestamp);
        const formattedDate = date.toLocaleDateString("pt-BR");
        const formattedTime = date.toLocaleTimeString("pt-BR");
        cacheTimestampEl.textContent = `Fila salva em ${formattedDate} \xE0s ${formattedTime}`;
      }
      if (tableContainerEl) {
        tableContainerEl.innerHTML = cache.html;
        const links = tableContainerEl.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
        links.forEach((el) => {
          el.setAttribute("tabindex", "-1");
          el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
        });
      }
    } catch (error) {
      console.error("Erro ao carregar cache offline:", error);
      if (cacheTimestampEl) cacheTimestampEl.textContent = "Erro ao carregar cache local.";
    }
  });
})();
//# sourceMappingURL=offline_viewer.js.map
