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

  // src/ui/options/options.ts
  document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    await setupOptionsForm();
    await renderMappingsTable();
    setupBackupActions();
    const btnViewCache = document.getElementById("opt-btn-view-cache");
    if (btnViewCache) {
      btnViewCache.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("offline_viewer.html") });
      });
    }
  });
  function setupNavigation() {
    const buttons = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".content-section");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        sections.forEach((sec) => {
          if (sec.id === targetId) {
            sec.classList.remove("hidden");
          } else {
            sec.classList.add("hidden");
          }
        });
      });
    });
  }
  async function setupOptionsForm() {
    const selectInterval = document.getElementById("opt-interval");
    const chkActiveOnly = document.getElementById("opt-active-only");
    const chkPreventForm = document.getElementById("opt-prevent-form");
    const chkSortDate = document.getElementById("opt-sort-date");
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
  async function renderMappingsTable() {
    const tbody = document.getElementById("mappings-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    const config = await ConfigManager.getAll();
    const mappings = config.esfMappings;
    const esfCodes = Object.keys(mappings);
    if (esfCodes.length === 0) {
      tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-mappings">
          Nenhum mapeamento de lan\xE7amento capturado pelo Modo Aprendizado ainda.<br>
          Os mapeamentos aparecem aqui automaticamente ap\xF3s voc\xEA realizar um lan\xE7amento e clicar em "Capturar Configura\xE7\xE3o" dentro do SIGSS.
        </td>
      </tr>
    `;
      return;
    }
    esfCodes.sort().forEach((esfCode) => {
      const mapping = mappings[esfCode];
      const profDisplay = mapping.profissionalNome || `ID: ${mapping.profissionalId}`;
      const equipeDisplay = mapping.equipeNome || `ID: ${mapping.equipeId}`;
      const cboDisplay = mapping.cboNome || `ID: ${mapping.cboId}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td><strong>${esfCode}</strong></td>
      <td>${profDisplay}</td>
      <td>${equipeDisplay}</td>
      <td>${cboDisplay}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-delete-mapping" data-esf="${esfCode}">Excluir</button>
      </td>
    `;
      const delBtn = tr.querySelector(".btn-delete-mapping");
      if (delBtn) {
        delBtn.addEventListener("click", async (e) => {
          const targetEsf = e.target.getAttribute("data-esf");
          if (targetEsf) {
            if (confirm(`Tem certeza que deseja excluir o mapeamento da Equipe ESF ${targetEsf}?`)) {
              await ConfigManager.deleteEsfMapping(targetEsf);
              await renderMappingsTable();
            }
          }
        });
      }
      tbody.appendChild(tr);
    });
  }
  function setupBackupActions() {
    const btnExport = document.getElementById("btn-export");
    const btnTriggerImport = document.getElementById("btn-trigger-import");
    const inputImportFile = document.getElementById("input-import-file");
    const importStatus = document.getElementById("import-status");
    if (btnExport) {
      btnExport.addEventListener("click", async () => {
        const config = await ConfigManager.getAll();
        const exportData = {
          refreshInterval: config.refreshInterval,
          refreshOnlyActive: config.refreshOnlyActive,
          preventRefreshOnForm: config.preventRefreshOnForm,
          sortDataSolicitacao: config.sortDataSolicitacao,
          esfMappings: config.esfMappings
        };
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sigss-plus-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
    if (btnTriggerImport && inputImportFile) {
      btnTriggerImport.addEventListener("click", () => {
        inputImportFile.value = "";
        inputImportFile.click();
      });
    }
    if (inputImportFile && importStatus) {
      inputImportFile.addEventListener("change", (e) => {
        const target = e.target;
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const content = event.target?.result;
            const parsed = JSON.parse(content);
            if (typeof parsed !== "object" || parsed === null) {
              throw new Error("Formato de arquivo inv\xE1lido.");
            }
            const updateData = {};
            if (parsed.refreshInterval !== void 0) updateData.refreshInterval = String(parsed.refreshInterval);
            if (parsed.refreshOnlyActive !== void 0) updateData.refreshOnlyActive = Boolean(parsed.refreshOnlyActive);
            if (parsed.preventRefreshOnForm !== void 0) updateData.preventRefreshOnForm = Boolean(parsed.preventRefreshOnForm);
            if (parsed.sortDataSolicitacao !== void 0) updateData.sortDataSolicitacao = Boolean(parsed.sortDataSolicitacao);
            if (parsed.esfMappings !== void 0 && typeof parsed.esfMappings === "object") {
              updateData.esfMappings = parsed.esfMappings;
            }
            if (Object.keys(updateData).length === 0) {
              throw new Error("Nenhuma configura\xE7\xE3o v\xE1lida encontrada no arquivo.");
            }
            await ConfigManager.set(updateData);
            importStatus.textContent = "\u2713 Configura\xE7\xF5es importadas com sucesso!";
            importStatus.className = "status-msg status-success";
            await setupOptionsForm();
            await renderMappingsTable();
            setTimeout(() => {
              importStatus.textContent = "";
            }, 4e3);
          } catch (err) {
            importStatus.textContent = `\u274C Falha ao importar: ${err.message || "Erro de leitura de JSON."}`;
            importStatus.className = "status-msg status-error";
          }
        };
        reader.readAsText(file);
      });
    }
  }
})();
//# sourceMappingURL=options.js.map
