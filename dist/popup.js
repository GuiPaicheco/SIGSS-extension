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

  // src/ui/popup/popup.ts
  document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    await setupSettings();
    await renderMappingsList();
    const btnViewCache = document.getElementById("btn-view-cache");
    if (btnViewCache) {
      btnViewCache.addEventListener("click", () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL("offline_viewer.html")
        });
      });
    }
  });
  function setupTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".tab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.getAttribute("data-tab");
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        panels.forEach((panel) => {
          if (panel.id === targetTab) {
            panel.classList.remove("hidden");
          } else {
            panel.classList.add("hidden");
          }
        });
      });
    });
  }
  async function setupSettings() {
    const selectInterval = document.getElementById("select-interval");
    const chkActiveOnly = document.getElementById("chk-active-only");
    const chkPreventForm = document.getElementById("chk-prevent-form");
    const chkSortDate = document.getElementById("chk-sort-date");
    if (!selectInterval || !chkActiveOnly || !chkPreventForm || !chkSortDate) {
      return;
    }
    const config = await ConfigManager.getAll();
    selectInterval.value = config.refreshInterval;
    chkActiveOnly.checked = config.refreshOnlyActive;
    chkPreventForm.checked = config.preventRefreshOnForm;
    chkSortDate.checked = config.sortDataSolicitacao;
    selectInterval.addEventListener("change", async () => {
      await ConfigManager.set({ refreshInterval: selectInterval.value });
    });
    chkActiveOnly.addEventListener("change", async () => {
      await ConfigManager.set({ refreshOnlyActive: chkActiveOnly.checked });
    });
    chkPreventForm.addEventListener("change", async () => {
      await ConfigManager.set({ preventRefreshOnForm: chkPreventForm.checked });
    });
    chkSortDate.addEventListener("change", async () => {
      await ConfigManager.set({ sortDataSolicitacao: chkSortDate.checked });
    });
  }
  async function renderMappingsList() {
    const container = document.getElementById("mappings-list-container");
    if (!container) return;
    container.innerHTML = "";
    const config = await ConfigManager.getAll();
    const mappings = config.esfMappings;
    const esfCodes = Object.keys(mappings);
    if (esfCodes.length === 0) {
      container.innerHTML = `
      <div class="no-mappings">
        Nenhum mapeamento de lan\xE7amento capturado.<br><br>
        Preencha um lan\xE7amento manual no SIGSS e clique em <strong>"Capturar Configura\xE7\xE3o"</strong> para salvar um novo padr\xE3o de equipe.
      </div>
    `;
      return;
    }
    esfCodes.sort().forEach((esfCode) => {
      const mapping = mappings[esfCode];
      const profNome = mapping.profissionalNome || `Profissional ${mapping.profissionalId}`;
      const equipeNome = mapping.equipeNome || `Equipe ${mapping.equipeId}`;
      const cboNome = mapping.cboNome || `CBO ${mapping.cboId}`;
      const item = document.createElement("div");
      item.className = "mapping-item";
      item.innerHTML = `
      <div class="mapping-item-details">
        <span class="mapping-item-title">Equipe ESF: ${esfCode}</span>
        <span class="mapping-item-sub" title="Profissional: ${profNome}
Equipe: ${equipeNome}
CBO: ${cboNome}">
          ${profNome.split(" - ")[0]} / ${equipeNome.split(" - ")[0]} / ${cboNome.split(" - ")[0]}
        </span>
      </div>
      <button class="mapping-item-delete" data-esf="${esfCode}" title="Excluir mapeamento">&times;</button>
    `;
      const deleteBtn = item.querySelector(".mapping-item-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          const targetEsf = e.target.getAttribute("data-esf");
          if (targetEsf) {
            if (confirm(`Excluir o preenchimento autom\xE1tico para a Equipe ESF ${targetEsf}?`)) {
              await ConfigManager.deleteEsfMapping(targetEsf);
              await renderMappingsList();
            }
          }
        });
      }
      container.appendChild(item);
    });
  }
})();
//# sourceMappingURL=popup.js.map
