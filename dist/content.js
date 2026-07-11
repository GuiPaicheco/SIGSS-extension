"use strict";
(() => {
  // src/utils/sigssAdapter.ts
  var SIGSS_SELECTORS = {
    // Cabeçalho / Relógio
    clockContainer: "#horaAtual, #relogio, .relogio, #clock, .hora-sistema, #cabecalho_hora",
    // Fila de Espera / Busca (jqGrid / AJAX)
    searchButton: '#btnBuscar, input[value="Buscar"], button:has-text("Buscar"), .btn-buscar, input[name="btnBuscar"]',
    queueTable: "#grid_transferencia_agenda, .ui-jqgrid-btable, .gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table",
    queueTableHeaders: ".ui-jqgrid-htable th, tr.ui-jqgrid-labels th, .gridFila th, #tabelaFila th, table.grid th",
    // Indicadores de Formulário
    textInputs: 'input[type="text"], input[type="search"], textarea',
    selects: "select",
    // Detalhes do Lançamento
    patientEsfText: '.esf-paciente, td:contains("ESF"), td:contains("Equipe"), label:contains("ESF")',
    // Campos de seleção de Profissional / Equipe / CBO
    profissionalSelect: 'select[id="agtr.profissional.prsaPK"]',
    equipeSelect: 'select[id="agtr.equipe.equiPK"]',
    cboSelect: 'select[id="agtr.atividadeProfissionalCnes.apcnId"]',
    // Container de Ações onde o botão de captura será injetado
    actionsContainer: "#divBotoes, .botoes-acao, .barra-botoes, td.botoes, .form-actions"
  };
  var SigssAdapter = class {
    /**
     * Detecta qual página do SIGSS está aberta atualmente
     */
    static detectCurrentPage() {
      const url = window.location.href;
      if (url.includes("atendimentoTriagemAgenda.jsp") || url.includes("mock_sigss.html")) {
        return "QUEUE";
      }
      if (url.includes("agendamentoTriagem.jsp") || url.includes("mock_sigss_launch.html")) {
        return "LAUNCH";
      }
      if (url.includes("fila") || url.includes("pesquisa") || url.includes("consultar")) {
        return "QUEUE";
      }
      if (url.includes("lancamento") || url.includes("gravar")) {
        return "LAUNCH";
      }
      const fields = this.getLaunchFields();
      if (fields.profissionalSelect && fields.equipeSelect) {
        return "LAUNCH";
      }
      if (document.querySelector(SIGSS_SELECTORS.queueTable)) {
        return "QUEUE";
      }
      return "UNKNOWN";
    }
    /**
     * Obtém o elemento HTML do cabeçalho que exibe o relógio
     */
    static getClockElement() {
      let el = document.querySelector(SIGSS_SELECTORS.clockContainer);
      if (el) return el;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node2) => {
            const text = node2.textContent || "";
            const parent = node2.parentElement;
            if (parent && (parent.tagName === "SPAN" || parent.tagName === "DIV" || parent.tagName === "TD")) {
              if (/^\d{2}:\d{2}(:\d{2})?$/.test(text.trim())) {
                return NodeFilter.FILTER_ACCEPT;
              }
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      const node = walker.nextNode();
      if (node && node.parentElement) {
        return node.parentElement;
      }
      return null;
    }
    /**
     * Obtém o botão de busca da fila de atendimento
     */
    static getSearchButton() {
      const selectors = [
        "#btnBuscar",
        'input[value="Buscar"]',
        'input[value="Pesquisar"]',
        'input[name="btnBuscar"]',
        ".btn-buscar",
        'input[type="button"][value*="Buscar"]',
        'button[type="submit"]'
      ];
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn) return btn;
      }
      const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = (btn instanceof HTMLInputElement ? btn.value : btn.textContent) || "";
        if (text.trim().toLowerCase() === "buscar" || text.trim().toLowerCase() === "pesquisar") {
          return btn;
        }
      }
      return null;
    }
    /**
     * Verifica se o usuário está preenchendo algum formulário ativamente na página
     */
    static isFormBeingFilled() {
      const activeEl = document.activeElement;
      if (!activeEl) return false;
      const tagName = activeEl.tagName.toLowerCase();
      if (tagName === "textarea") {
        const txt = activeEl;
        return txt.value.trim().length > 0;
      }
      if (tagName === "input") {
        const input = activeEl;
        const type = (input.type || "text").toLowerCase();
        if (["text", "search", "number", "tel", "email", "date", "datetime-local"].includes(type)) {
          return input.value.trim().length > 0;
        }
      }
      const textInputs = document.querySelectorAll(SIGSS_SELECTORS.textInputs);
      for (let i = 0; i < textInputs.length; i++) {
        const input = textInputs[i];
        if (input === document.activeElement && input.value.trim().length > 0) {
          return true;
        }
      }
      return false;
    }
    /**
     * Busca e clica no cabeçalho da coluna para ordenar por "Data Solicitação"
     */
    static ensureSorting(columnName = "Data Solicita\xE7\xE3o") {
      const headers = document.querySelectorAll(SIGSS_SELECTORS.queueTableHeaders);
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header.textContent?.trim().toLowerCase().includes(columnName.toLowerCase())) {
          const hasSortIndicator = header.querySelector(".sort-indicator, .fa-sort, .seta") || header.className.includes("sort") || header.textContent.includes("\u25B2") || header.textContent.includes("\u25BC");
          return true;
        }
      }
      return false;
    }
    /**
     * Tenta encontrar a tabela da fila e obter seu HTML limpo para armazenamento em cache
     */
    static getQueueTableHTML() {
      const table = document.querySelector(SIGSS_SELECTORS.queueTable);
      if (table) {
        return table.outerHTML;
      }
      const tables = document.querySelectorAll("table");
      let bestTable = null;
      let maxRows = 0;
      tables.forEach((t) => {
        const rowCount = t.rows.length;
        if (rowCount > maxRows && rowCount > 3) {
          maxRows = rowCount;
          bestTable = t;
        }
      });
      if (bestTable) {
        return bestTable.outerHTML;
      }
      return null;
    }
    /**
     * Tenta identificar o código ESF do paciente na página de lançamento.
     * Realiza buscas no dropdown Chosen do paciente, nas opções selecionadas e no texto da página.
     */
    static getPatientEsf() {
      const regexEsf = /(?:ESF|Equipe(?:\s+ESF)?|Sa\u00fade\s+da\s+Fam\u00edlia|INE)[:\-\s#\b]+(\d+)/i;
      const patientSelect = document.querySelector('[id="agtr.usuarioServico.isenPK"]');
      if (patientSelect && patientSelect.selectedIndex >= 0) {
        const selectedText = patientSelect.options[patientSelect.selectedIndex]?.text || "";
        const match = selectedText.match(regexEsf);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      const chosenSpan = document.querySelector("#agtr_usuarioServico_isenPK_chzn .chzn-single span");
      if (chosenSpan) {
        const chosenText = chosenSpan.textContent || "";
        const match = chosenText.match(regexEsf);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      const esfElements = document.querySelectorAll(SIGSS_SELECTORS.patientEsfText);
      for (let i = 0; i < esfElements.length; i++) {
        const text = esfElements[i].textContent || "";
        const match = text.match(regexEsf);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      const bodyText = document.body.innerText;
      const bodyMatch = bodyText.match(regexEsf);
      if (bodyMatch && bodyMatch[1]) {
        return bodyMatch[1].trim();
      }
      return null;
    }
    /**
     * Retorna os elementos do formulário de lançamento necessários para automação
     */
    static getLaunchFields() {
      return {
        profissionalSelect: document.querySelector(SIGSS_SELECTORS.profissionalSelect),
        equipeSelect: document.querySelector(SIGSS_SELECTORS.equipeSelect),
        cboSelect: document.querySelector(SIGSS_SELECTORS.cboSelect)
      };
    }
    /**
     * Define o valor de um select e força a atualização do plugin jQuery Chosen
     * injetando um script temporário no contexto da página.
     */
    static setSelectValueAndTrigger(selector, value) {
      const scriptContent = `
      (function() {
        const select = document.querySelector('${selector}');
        if (select) {
          select.value = '${value}';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          if (window.jQuery) {
            window.jQuery(select).trigger('chosen:updated');
          }
        }
      })();
    `;
      const script = document.createElement("script");
      script.textContent = scriptContent;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    }
    /**
     * Injeta o botão "Capturar Configuração" no formulário do SIGSS
     */
    static injectCaptureButton(onCapture) {
      if (document.getElementById("sigss-plus-capture-btn")) {
        return true;
      }
      const container = document.querySelector(SIGSS_SELECTORS.actionsContainer);
      if (!container) {
        const buttons = document.querySelectorAll('input[type="submit"], input[value*="Gravar"], button');
        let targetButton = null;
        for (let i = 0; i < buttons.length; i++) {
          const text = (buttons[i] instanceof HTMLInputElement ? buttons[i].value : buttons[i].textContent) || "";
          if (text.toLowerCase().includes("gravar") || text.toLowerCase().includes("salvar")) {
            targetButton = buttons[i];
            break;
          }
        }
        if (targetButton && targetButton.parentElement) {
          this.createAndInjectButton(targetButton.parentElement, onCapture);
          return true;
        }
        const bodyContainer = document.body;
        if (bodyContainer) {
          this.createAndInjectButton(bodyContainer, onCapture, true);
          return true;
        }
        return false;
      }
      this.createAndInjectButton(container, onCapture);
      return true;
    }
    /**
     * Auxiliar para criar o elemento botão e anexá-lo ao DOM
     */
    static createAndInjectButton(parent, onClick, isFloating = false) {
      const btn = document.createElement("button");
      btn.id = "sigss-plus-capture-btn";
      btn.type = "button";
      btn.textContent = "Capturar Configura\xE7\xE3o";
      if (isFloating) {
        btn.style.position = "fixed";
        btn.style.bottom = "20px";
        btn.style.right = "20px";
        btn.style.zIndex = "99999";
        btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
      }
      btn.style.backgroundColor = "#f0f0f0";
      btn.style.border = "1px solid #b5b5b5";
      btn.style.borderRadius = "3px";
      btn.style.color = "#333";
      btn.style.fontFamily = "Arial, sans-serif";
      btn.style.fontSize = "12px";
      btn.style.fontWeight = "bold";
      btn.style.padding = "4px 10px";
      btn.style.margin = "0 5px";
      btn.style.cursor = "pointer";
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "#e0e0e0";
        btn.style.borderColor = "#999";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "#f0f0f0";
        btn.style.borderColor = "#b5b5b5";
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      parent.appendChild(btn);
    }
  };

  // src/modules/clock/clock.ts
  var ClockModule = class {
    intervalId = null;
    start() {
      this.stop();
      this.tick();
      this.intervalId = window.setInterval(() => {
        this.tick();
      }, 1e3);
    }
    stop() {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    tick() {
      const clockEl = SigssAdapter.getClockElement();
      if (!clockEl) {
        return;
      }
      const now = /* @__PURE__ */ new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      clockEl.textContent = `${hh}:${mm}:${ss}`;
    }
  };

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

  // src/modules/autoRefresh/autoRefresh.ts
  var AutoRefreshModule = class {
    timerId = null;
    tableObserver = null;
    async start() {
      this.stop();
      const config = await ConfigManager.getAll();
      const intervalStr = config.refreshInterval;
      if (intervalStr === "disabled") {
        return;
      }
      const seconds = parseInt(intervalStr, 10);
      if (isNaN(seconds) || seconds <= 0) {
        return;
      }
      this.timerId = window.setInterval(async () => {
        await this.executeRefreshCycle();
      }, seconds * 1e3);
      if (config.sortDataSolicitacao) {
        this.applySorting();
        this.setupSortingObserver();
      }
    }
    stop() {
      if (this.timerId !== null) {
        window.clearInterval(this.timerId);
        this.timerId = null;
      }
      if (this.tableObserver) {
        this.tableObserver.disconnect();
        this.tableObserver = null;
      }
    }
    /**
     * Executa a checagem e clica no botão Buscar se permitido
     */
    async executeRefreshCycle() {
      const config = await ConfigManager.getAll();
      if (config.refreshOnlyActive && document.visibilityState !== "visible") {
        return;
      }
      if (config.preventRefreshOnForm && SigssAdapter.isFormBeingFilled()) {
        return;
      }
      const searchBtn = SigssAdapter.getSearchButton();
      if (searchBtn) {
        searchBtn.click();
      }
    }
    /**
     * Tenta localizar e clicar na coluna 'Data Solicitação' para manter a ordenação
     */
    applySorting() {
      const table = document.querySelector(".gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table");
      if (!table) return;
      const headers = table.querySelectorAll("th");
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const text = header.textContent?.trim().toLowerCase() || "";
        if (text.includes("data solicita\xE7\xE3o") || text.includes("data solic") || text.includes("dta solic")) {
          const alreadySorted = header.classList.contains("sorted") || header.className.includes("sort-") || header.innerHTML.includes("\u25B2") || header.innerHTML.includes("\u25BC") || header.innerHTML.includes("arrow");
          if (!alreadySorted) {
            if (this.tableObserver) this.tableObserver.disconnect();
            header.click();
            this.setupSortingObserver();
          }
          break;
        }
      }
    }
    /**
     * Observa mudanças no DOM da tabela para reordenar dinamicamente caso novos dados
     * sejam inseridos (ex. paginação AJAX ou cliques parciais de atualização)
     */
    setupSortingObserver() {
      const table = document.querySelector(".gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table");
      if (!table) return;
      if (this.tableObserver) {
        this.tableObserver.disconnect();
      }
      this.tableObserver = new MutationObserver(() => {
        setTimeout(() => {
          this.applySorting();
        }, 50);
      });
      this.tableObserver.observe(table, {
        childList: true,
        subtree: true
      });
    }
  };

  // src/modules/queueCache/queueCache.ts
  var QueueCacheModule = class {
    observedTables = /* @__PURE__ */ new Map();
    checkIntervalId = null;
    saveDebounceTimeoutId = null;
    start() {
      this.checkSystemAvailability();
      this.scanAndSetupObservers();
      this.checkIntervalId = window.setInterval(() => {
        this.scanAndSetupObservers();
      }, 2e3);
    }
    stop() {
      if (this.checkIntervalId !== null) {
        window.clearInterval(this.checkIntervalId);
        this.checkIntervalId = null;
      }
      if (this.saveDebounceTimeoutId !== null) {
        window.clearTimeout(this.saveDebounceTimeoutId);
        this.saveDebounceTimeoutId = null;
      }
      this.observedTables.forEach((observer) => observer.disconnect());
      this.observedTables.clear();
    }
    /**
     * Verifica se o corpo da página contém erros conhecidos do servidor
     * ou mensagens indicando queda do SIGSS
     */
    checkSystemAvailability() {
      const text = document.body.innerText.toLowerCase();
      const errorKeywords = [
        "erro interno do servidor",
        "banco de dados indisponivel",
        "banco de dados indispon\xEDvel",
        "sistema indisponivel",
        "sistema indispon\xEDvel",
        "erro de conex\xE3o",
        "service unavailable",
        "connection timed out",
        "503 service",
        "erro ao processar sua solicita\xE7\xE3o",
        "erro no servidor"
      ];
      const isSystemDown = errorKeywords.some((keyword) => text.includes(keyword));
      if (isSystemDown) {
        this.injectOfflineBanner();
      }
    }
    /**
     * Injeta um banner de aviso na página caso o sistema esteja offline
     */
    injectOfflineBanner() {
      if (document.getElementById("sigss-plus-offline-banner")) {
        return;
      }
      const banner = document.createElement("div");
      banner.id = "sigss-plus-offline-banner";
      banner.style.backgroundColor = "#fff3cd";
      banner.style.border = "1px solid #ffeeba";
      banner.style.color = "#856404";
      banner.style.padding = "12px 20px";
      banner.style.margin = "15px auto";
      banner.style.maxWidth = "1000px";
      banner.style.borderRadius = "4px";
      banner.style.fontFamily = "Arial, sans-serif";
      banner.style.fontSize = "13px";
      banner.style.textAlign = "center";
      banner.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
      banner.innerHTML = `
      <strong>Aviso do SIGSS+:</strong> O sistema SIGSS parece estar inst\xE1vel ou offline no momento. 
      <a href="#" id="sigss-plus-view-cache-btn" style="color: #533f03; font-weight: bold; text-decoration: underline; margin-left: 10px;">
        Clique aqui para abrir a \xFAltima fila salva em cache local (Modo Consulta)
      </a>.
    `;
      const firstChild = document.body.firstChild;
      if (firstChild) {
        document.body.insertBefore(banner, firstChild);
      } else {
        document.body.appendChild(banner);
      }
      const link = banner.querySelector("#sigss-plus-view-cache-btn");
      if (link) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage({ action: "open_offline_viewer" });
        });
      }
    }
    /**
     * Varre o documento em busca de tabelas de filas e inicia sua observação
     */
    scanAndSetupObservers() {
      const selectors = SIGSS_SELECTORS.queueTable.split(",").map((s) => s.trim());
      const customSelectors = ["#grid_transferencia_agenda", "#grid_acolhimentos", "#grid_busca"];
      const allSelectors = Array.from(/* @__PURE__ */ new Set([...selectors, ...customSelectors]));
      allSelectors.forEach((selector) => {
        try {
          const tables = document.querySelectorAll(selector);
          tables.forEach((table) => {
            if (table instanceof HTMLTableElement && !this.observedTables.has(table)) {
              this.setupTableObserver(table);
            }
          });
        } catch (err) {
        }
      });
    }
    /**
     * Configura o MutationObserver para uma tabela específica
     */
    setupTableObserver(table) {
      const { key, name } = this.getQueueTypeAndName(table);
      console.log(`SIGSS+: Monitorando tabela de fila "${name}" (ID: ${table.id || "N/A"})`);
      const observer = new MutationObserver(() => {
        if (this.saveDebounceTimeoutId !== null) {
          window.clearTimeout(this.saveDebounceTimeoutId);
        }
        this.saveDebounceTimeoutId = window.setTimeout(() => {
          this.captureAndSaveSpecificQueue(table, key, name);
        }, 1e3);
      });
      observer.observe(table, {
        childList: true,
        subtree: true
      });
      this.observedTables.set(table, observer);
      this.captureAndSaveSpecificQueue(table, key, name);
    }
    /**
     * Determina a chave e o nome da fila com base nos dados do elemento
     */
    getQueueTypeAndName(table) {
      const id = table.id;
      const url = window.location.href;
      if (id === "grid_transferencia_agenda" || url.includes("atendimentoTriagemAgenda.jsp")) {
        return { key: "atendimento", name: "Fila de Atendimento" };
      }
      if (id === "grid_acolhimentos" || url.includes("acolhimento") || url.includes("agendamentoTriagem.jsp")) {
        return { key: "acolhimento", name: "Fila de Acolhimento" };
      }
      return { key: "fila", name: "Fila Geral" };
    }
    /**
     * Limpa e salva os dados da tabela no Chrome Storage
     */
    async captureAndSaveSpecificQueue(table, key, name) {
      if (table.rows.length <= 1) {
        return;
      }
      const clone = table.cloneNode(true);
      const cacheKey = `queueCache_${key}`;
      const data = {
        html: clone.outerHTML,
        timestamp: Date.now(),
        name
      };
      await chrome.storage.local.set({ [cacheKey]: data });
      console.log(`SIGSS+: Fila "${name}" atualizada no cache local.`);
    }
  };

  // src/modules/autoAssignment/autoAssignment.ts
  var AutoAssignmentModule = class {
    equipeObserver = null;
    lastProcessedPatientId = "";
    isProcessingAutofill = false;
    async start() {
      this.injectCaptureButton();
      this.setupEquipeObserver();
    }
    stop() {
      const btn = document.getElementById("sigss-plus-capture-btn");
      if (btn) {
        btn.remove();
      }
      if (this.equipeObserver) {
        this.equipeObserver.disconnect();
        this.equipeObserver = null;
      }
    }
    /**
     * Monitora alterações na lista de opções da Equipe.
     * Quando o SIGSS atualiza as equipes (via AJAX após a seleção do paciente), reagimos imediatamente.
     */
    setupEquipeObserver() {
      const equipeSelect = document.querySelector(SIGSS_SELECTORS.equipeSelect);
      if (!equipeSelect) return;
      this.equipeObserver = new MutationObserver(async () => {
        await this.checkAndTriggerAutofill();
      });
      this.equipeObserver.observe(equipeSelect, {
        childList: true,
        subtree: true
      });
      this.checkAndTriggerAutofill();
    }
    /**
     * Executa a checagem e dispara o preenchimento se detectado um novo paciente
     */
    async checkAndTriggerAutofill() {
      if (this.isProcessingAutofill) return;
      const patientSelect = document.querySelector('[id="agtr.usuarioServico.isenPK"]');
      const patientId = patientSelect?.value || "";
      if (!patientId || patientId === "" || patientId === "0" || patientId === this.lastProcessedPatientId) {
        return;
      }
      const esfCode = this.detectEsfFromEquipeOptions();
      if (!esfCode) return;
      this.lastProcessedPatientId = patientId;
      this.isProcessingAutofill = true;
      try {
        await this.executeAutoFill(esfCode);
      } catch (err) {
        console.error("SIGSS+: Falha no preenchimento autom\xE1tico:", err);
      } finally {
        this.isProcessingAutofill = false;
      }
    }
    /**
     * Varre as opções do select de equipe buscando por termos como "ESF 087" ou similar
     */
    detectEsfFromEquipeOptions() {
      const equipeSelect = document.querySelector(SIGSS_SELECTORS.equipeSelect);
      if (!equipeSelect) return null;
      const regexEsf = /(?:ESF|Equipe(?:\s+ESF)?|Sa\u00fade\s+da\s+Fam\u00edlia|INE)[:\-\s#\b]+(\d+)/i;
      for (let i = 0; i < equipeSelect.options.length; i++) {
        const text = equipeSelect.options[i].text;
        const match = text.match(regexEsf);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return null;
    }
    /**
     * Executa o autopreenchimento com delays controlados
     */
    async executeAutoFill(esfCode) {
      const config = await ConfigManager.getAll();
      const mapping = config.esfMappings[esfCode];
      if (!mapping) {
        console.log(`SIGSS+: Nenhum perfil salvo para a equipe ESF ${esfCode}.`);
        return;
      }
      console.log(`SIGSS+: Perfil localizado para ESF ${esfCode}. Preenchendo...`);
      if (mapping.profissionalId) {
        SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.profissionalSelect, mapping.profissionalId);
      }
      setTimeout(() => {
        if (mapping.equipeId) {
          SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.equipeSelect, mapping.equipeId);
        }
        setTimeout(() => {
          if (mapping.cboId) {
            SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.cboSelect, mapping.cboId);
          }
          console.log("SIGSS+: Preenchimento autom\xE1tico conclu\xEDdo com sucesso!");
        }, 300);
      }, 300);
    }
    injectCaptureButton() {
      SigssAdapter.injectCaptureButton(() => {
        this.handleCaptureConfig();
      });
    }
    async handleCaptureConfig() {
      let esfCode = this.detectEsfFromEquipeOptions();
      if (!esfCode) {
        esfCode = SigssAdapter.getPatientEsf();
      }
      const btn = document.getElementById("sigss-plus-capture-btn");
      if (!esfCode) {
        alert("SIGSS+: N\xE3o foi poss\xEDvel determinar a equipe ESF do paciente.\nVerifique se o paciente possui prontu\xE1rio ativo com ESF vinculada.");
        return;
      }
      const { profissionalSelect, equipeSelect, cboSelect } = SigssAdapter.getLaunchFields();
      if (!profissionalSelect || !equipeSelect || !cboSelect) {
        alert("SIGSS+: Campos do formul\xE1rio n\xE3o encontrados.");
        return;
      }
      const profissionalId = profissionalSelect.value;
      const equipeId = equipeSelect.value;
      const cboId = cboSelect.value;
      if (!profissionalId || profissionalId === "" || profissionalId === "0" || !equipeId || equipeId === "" || equipeId === "0" || !cboId || cboId === "" || cboId === "0") {
        alert("SIGSS+: Selecione op\xE7\xF5es v\xE1lidas para Profissional, Equipe e CBO antes de capturar.");
        return;
      }
      const profissionalNome = profissionalSelect.options[profissionalSelect.selectedIndex]?.text.trim() || profissionalId;
      const equipeNome = equipeSelect.options[equipeSelect.selectedIndex]?.text.trim() || equipeId;
      const cboNome = cboSelect.options[cboSelect.selectedIndex]?.text.trim() || cboId;
      const mapping = {
        profissionalId,
        equipeId,
        cboId,
        profissionalNome,
        equipeNome,
        cboNome
      };
      await ConfigManager.saveEsfMapping(esfCode, mapping);
      if (btn) {
        const originalText = btn.textContent;
        const originalBg = btn.style.backgroundColor;
        btn.textContent = `\u2713 ESF ${esfCode} Capturada!`;
        btn.style.backgroundColor = "#d4edda";
        btn.style.borderColor = "#c3e6cb";
        btn.style.color = "#155724";
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = originalBg;
          btn.style.borderColor = "#b5b5b5";
          btn.style.color = "#333";
        }, 2e3);
      }
    }
  };

  // src/modules/unifiedQueue/unifiedQueue.ts
  var UnifiedQueueModule = class {
    sidebarEl = null;
    toggleBtnEl = null;
    isCollapsed = true;
    patients = [];
    lastUpdate = null;
    autoRefreshTimer = null;
    isScraping = false;
    async start() {
      this.injectSidebar();
      this.setupEventListeners();
      setTimeout(() => {
        this.triggerScraping();
      }, 2e3);
      this.autoRefreshTimer = window.setInterval(() => {
        this.triggerScraping();
      }, 6e4);
    }
    stop() {
      if (this.autoRefreshTimer !== null) {
        window.clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
      if (this.sidebarEl) {
        this.sidebarEl.remove();
        this.sidebarEl = null;
      }
      if (this.toggleBtnEl) {
        this.toggleBtnEl.remove();
        this.toggleBtnEl = null;
      }
      document.removeEventListener("sigss_plus_unified_queue_done", this.handleScrapeDoneEvent);
    }
    /**
     * Injeta o painel lateral (sidebar) e os estilos correspondentes no DOM
     */
    injectSidebar() {
      if (document.getElementById("sigss-plus-unified-sidebar")) return;
      const styleEl = document.createElement("style");
      styleEl.id = "sigss-plus-unified-styles";
      styleEl.textContent = `
      #sigss-plus-unified-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 480px;
        height: 100vh;
        background-color: #ffffff;
        box-shadow: -3px 0 15px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #333333;
      }
      #sigss-plus-unified-sidebar.collapsed {
        transform: translateX(100%);
      }
      .uq-toggle-tab {
        position: absolute;
        left: -40px;
        top: 120px;
        width: 40px;
        height: 100px;
        background-color: #1a365d;
        color: #ffffff;
        border: 1px solid #1a365d;
        border-right: none;
        border-radius: 8px 0 0 8px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.15);
        transition: background-color 0.2s;
      }
      .uq-toggle-tab:hover {
        background-color: #2b6cb0;
      }
      .uq-toggle-tab-icon {
        font-size: 16px;
        margin-bottom: 5px;
      }
      .uq-toggle-tab-text {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        letter-spacing: 1px;
      }
      .uq-header {
        background-color: #1a365d;
        color: #ffffff;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .uq-title-group h3 {
        margin: 0;
        font-size: 16px;
        font-weight: bold;
      }
      .uq-title-group span {
        font-size: 11px;
        color: #ebf8ff;
        display: block;
        margin-top: 3px;
      }
      .uq-header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .uq-btn-refresh {
        background-color: rgba(255, 255, 255, 0.15);
        border: none;
        color: #ffffff;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .uq-btn-refresh:hover {
        background-color: rgba(255, 255, 255, 0.3);
      }
      .uq-btn-refresh.scraping {
        animation: spin 1s linear infinite;
        pointer-events: none;
        opacity: 0.7;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .uq-search-box {
        padding: 12px 15px;
        background-color: #f7fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .uq-input {
        width: 100%;
        padding: 8px 12px;
        font-size: 12px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        box-sizing: border-box;
      }
      .uq-input:focus {
        border-color: #3182ce;
        outline: none;
      }
      .uq-body {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }
      .uq-patient-list-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .uq-patient-list-table th {
        background-color: #edf2f7;
        color: #4a5568;
        padding: 6px 8px;
        font-weight: bold;
        text-align: left;
        border-bottom: 2px solid #e2e8f0;
      }
      .uq-patient-list-table td {
        padding: 8px 6px;
        border-bottom: 1px solid #edf2f7;
        vertical-align: middle;
      }
      .uq-patient-list-table tr:hover {
        background-color: #f7fafc;
      }
      .uq-badge-risco {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: bold;
        font-size: 9px;
        text-align: center;
        width: 32px;
      }
      .uq-badge-risco.risco-ver { background-color: #e53e3e; color: #ffffff; }
      .uq-badge-risco.risco-lar { background-color: #dd6b20; color: #ffffff; }
      .uq-badge-risco.risco-ama { background-color: #ecc94b; color: #1a202c; }
      .uq-badge-risco.risco-verd { background-color: #48bb78; color: #ffffff; }
      .uq-badge-risco.risco-azu { background-color: #3182ce; color: #ffffff; }
      .uq-badge-risco.risco-nor { background-color: #a0aec0; color: #ffffff; }
      
      .uq-badge-prep {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #a0aec0;
      }
      .uq-badge-prep.preparado-true {
        background-color: #48bb78;
        box-shadow: 0 0 4px #48bb78;
      }
      
      .uq-empty {
        padding: 30px;
        text-align: center;
        color: #718096;
        font-size: 13px;
      }
      .uq-footer {
        padding: 10px 15px;
        background-color: #edf2f7;
        border-top: 1px solid #e2e8f0;
        font-size: 10px;
        color: #718096;
        text-align: center;
      }
    `;
      document.head.appendChild(styleEl);
      this.sidebarEl = document.createElement("div");
      this.sidebarEl.id = "sigss-plus-unified-sidebar";
      this.sidebarEl.className = "collapsed";
      this.sidebarEl.innerHTML = `
      <button class="uq-toggle-tab" id="uq-btn-toggle">
        <span class="uq-toggle-tab-icon">\u25C0</span>
        <span class="uq-toggle-tab-text">FILA UNIFICADA</span>
      </button>
      
      <div class="uq-header">
        <div class="uq-title-group">
          <h3>Fila Unificada</h3>
          <span id="uq-lbl-status">Carregando fila...</span>
        </div>
        <div class="uq-header-actions">
          <button class="uq-btn-refresh" id="uq-btn-refresh-action">Atualizar</button>
        </div>
      </div>
      
      <div class="uq-search-box">
        <input type="text" class="uq-input" id="uq-txt-search" placeholder="Filtrar por paciente, profissional ou risco...">
      </div>
      
      <div class="uq-body" id="uq-panel-body">
        <div class="uq-empty">Nenhum paciente na fila. Clique em Atualizar.</div>
      </div>

      <div class="uq-footer">
        SIGSS+ \u2022 Fila consolidada de todos os profissionais
      </div>
    `;
      document.body.appendChild(this.sidebarEl);
      this.toggleBtnEl = this.sidebarEl.querySelector("#uq-btn-toggle");
    }
    /**
     * Configura listeners de eventos da UI e eventos customizados do browser
     */
    setupEventListeners() {
      if (!this.sidebarEl) return;
      const toggleTab = this.sidebarEl.querySelector("#uq-btn-toggle");
      if (toggleTab) {
        toggleTab.addEventListener("click", () => {
          this.isCollapsed = !this.isCollapsed;
          this.sidebarEl?.classList.toggle("collapsed", this.isCollapsed);
          const icon = toggleTab.querySelector(".uq-toggle-tab-icon");
          if (icon) {
            icon.textContent = this.isCollapsed ? "\u25C0" : "\u25B6";
          }
        });
      }
      const refreshBtn = this.sidebarEl.querySelector("#uq-btn-refresh-action");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
          this.triggerScraping();
        });
      }
      const searchInput = this.sidebarEl.querySelector("#uq-txt-search");
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          this.renderQueueTable(searchInput.value);
        });
      }
      document.addEventListener("sigss_plus_unified_queue_done", this.handleScrapeDoneEvent);
      const mainSearchBtn = SigssAdapter.getSearchButton();
      if (mainSearchBtn) {
        mainSearchBtn.addEventListener("click", () => {
          setTimeout(() => this.triggerScraping(), 1500);
        });
      }
    }
    /**
     * Tratador nomeado de evento para permitir o stop() desconectar corretamente
     */
    handleScrapeDoneEvent = (e) => {
      const customEvent = e;
      const { patients, timestamp } = customEvent.detail;
      this.patients = patients;
      this.lastUpdate = timestamp;
      this.isScraping = false;
      chrome.storage.local.set({
        queueCache_unified: {
          patients,
          timestamp,
          name: "Fila Unificada (Todos)"
        }
      });
      this.updateStatusLabel();
      const searchInput = this.sidebarEl?.querySelector("#uq-txt-search");
      this.renderQueueTable(searchInput?.value || "");
      const refreshActionBtn = this.sidebarEl?.querySelector("#uq-btn-refresh-action");
      if (refreshActionBtn) {
        refreshActionBtn.classList.remove("scraping");
        refreshActionBtn.textContent = "Atualizar";
      }
    };
    /**
     * Dispara a injeção do script de scraping no Main World
     */
    triggerScraping() {
      if (this.isScraping) return;
      this.isScraping = true;
      const refreshActionBtn = this.sidebarEl?.querySelector("#uq-btn-refresh-action");
      if (refreshActionBtn) {
        refreshActionBtn.classList.add("scraping");
        refreshActionBtn.textContent = "\u{1F300}";
      }
      const statusLbl = document.getElementById("uq-lbl-status");
      if (statusLbl) {
        statusLbl.textContent = "Consultando profissionais...";
      }
      const scriptContent = `
      (function() {
        const grid = window.jQuery ? window.jQuery('#grid_busca') : null;
        if (!grid || grid.length === 0) {
          document.dispatchEvent(new CustomEvent('sigss_plus_unified_queue_done', {
            detail: { patients: [], timestamp: Date.now() }
          }));
          return;
        }

        const url = grid.jqGrid('getGridParam', 'url');
        const postData = grid.jqGrid('getGridParam', 'postData');
        const colModel = grid.jqGrid('getGridParam', 'colModel');
        if (!colModel || !postData || !url) {
          document.dispatchEvent(new CustomEvent('sigss_plus_unified_queue_done', {
            detail: { patients: [], timestamp: Date.now() }
          }));
          return;
        }
        
        const colNames = colModel.map(c => c.name);

        // Achar todos os profissionais no dropdown
        const profSelect = document.getElementById('profissional.prsaPK');
        if (!profSelect) {
          document.dispatchEvent(new CustomEvent('sigss_plus_unified_queue_done', {
            detail: { patients: [], timestamp: Date.now() }
          }));
          return;
        }

        const professionals = [];
        for (let i = 0; i < profSelect.options.length; i++) {
          const opt = profSelect.options[i];
          if (opt.value && opt.value !== '' && opt.value !== '0') {
            professionals.push({
              id: opt.value,
              name: opt.text.split(' ? ') [1] || opt.text.split(' - ') [1] || opt.text.split(' \u2013 ') [1] || opt.text
            });
          }
        }

        // Se n\xE3o houver profissionais listados, capturar fila do profissional logado padr\xE3o
        if (professionals.length === 0) {
          professionals.push({ id: postData['profissional.prsaPK'] || '', name: 'Padr\xE3o' });
        }

        let index = 0;
        const allPatients = [];

        function fetchNext() {
          if (index >= professionals.length) {
            document.dispatchEvent(new CustomEvent('sigss_plus_unified_queue_done', {
              detail: { patients: allPatients, timestamp: Date.now() }
            }));
            return;
          }

          const prof = professionals[index];
          const requestData = { ...postData };
          requestData['profissional.prsaPK'] = prof.id;

          window.jQuery.ajax({
            url: url,
            type: 'POST',
            data: requestData,
            success: function(data) {
              try {
                // Auxiliar para mapear risco
                const parseRisco = (riscoText) => {
                  const r = (riscoText || '').toUpperCase();
                  if (r.includes('VER') || r.includes('EMERG')) return { text: 'VER', css: 'risco-ver' };
                  if (r.includes('LAR') || r.includes('MUITO')) return { text: 'LAR', css: 'risco-lar' };
                  if (r.includes('AMA') || r.includes('URGEN')) return { text: 'AMA', css: 'risco-ama' };
                  if (r.includes('VERD') || r.includes('POUCO')) return { text: 'VERD', css: 'risco-verd' };
                  if (r.includes('AZU') || r.includes('N\xC3O UR')) return { text: 'AZU', css: 'risco-azu' };
                  return { text: 'NOR', css: 'risco-nor' };
                };

                // Tratar se for documento XML
                if (data instanceof XMLDocument || (data && data.nodeType === 9)) {
                  const rows = data.querySelectorAll('row');
                  rows.forEach(row => {
                    const cells = row.querySelectorAll('cell');
                    const rowData = {};
                    colNames.forEach((name, colIdx) => {
                      rowData[name] = cells[colIdx]?.textContent || '';
                    });

                    const risco = parseRisco(rowData['riscoAb'] || rowData['riscoAb_class']);
                    const prep = rowData['preparado'] || rowData['isPreparado'] || '';
                    const isPrep = prep.toLowerCase().includes('t') || /\\d/.test(prep);

                    allPatients.push({
                      id: row.getAttribute('id') || Math.random().toString(),
                      riscoText: risco.text,
                      riscoClass: risco.css,
                      hora: rowData['agtrHora'] || '',
                      pacienteNome: rowData['entiNome'] || '',
                      prioridade: rowData['prioridade'] || '',
                      idade: rowData['isenDtNasc'] || '',
                      preparado: prep,
                      isPreparado: isPrep,
                      profissional: prof.name
                    });
                  });
                } else if (data && data.rows) {
                  // Tratar se for JSON
                  data.rows.forEach(row => {
                    const rowData = {};
                    if (row.cell) {
                      colNames.forEach((name, colIdx) => {
                        rowData[name] = row.cell[colIdx];
                      });
                    } else {
                      colNames.forEach(name => {
                        rowData[name] = row[name];
                      });
                    }

                    const risco = parseRisco(rowData['riscoAb'] || rowData['riscoAb_class']);
                    const prep = rowData['preparado'] || rowData['isPreparado'] || '';
                    const isPrep = prep.toLowerCase().includes('t') || /\\d/.test(prep);

                    allPatients.push({
                      id: row.id || Math.random().toString(),
                      riscoText: risco.text,
                      riscoClass: risco.css,
                      hora: rowData['agtrHora'] || '',
                      pacienteNome: rowData['entiNome'] || '',
                      prioridade: rowData['prioridade'] || '',
                      idade: rowData['isenDtNasc'] || '',
                      preparado: prep,
                      isPreparado: isPrep,
                      profissional: prof.name
                    });
                  });
                }
              } catch (e) {
                console.error('Erro ao processar fila do profissional ' + prof.name, e);
              }

              index++;
              setTimeout(fetchNext, 120);
            },
            error: function(err) {
              console.error('Erro de rede na fila de ' + prof.name, err);
              index++;
              setTimeout(fetchNext, 120);
            }
          });
        }

        fetchNext();
      })();
    `;
      const scriptEl = document.createElement("script");
      scriptEl.textContent = scriptContent;
      (document.head || document.documentElement).appendChild(scriptEl);
      scriptEl.remove();
    }
    /**
     * Atualiza a legenda com o horário da última atualização
     */
    updateStatusLabel() {
      const statusLbl = document.getElementById("uq-lbl-status");
      if (!statusLbl) return;
      if (this.lastUpdate) {
        const time = new Date(this.lastUpdate).toLocaleTimeString("pt-BR");
        statusLbl.textContent = `Atualizado \xE0s ${time} (${this.patients.length} pacientes)`;
      } else {
        statusLbl.textContent = "Sem dados atualizados.";
      }
    }
    /**
     * Renderiza a tabela de pacientes filtrada no painel
     */
    renderQueueTable(filterText = "") {
      const bodyEl = document.getElementById("uq-panel-body");
      if (!bodyEl) return;
      const term = filterText.toLowerCase().trim();
      const filtered = this.patients.filter((p) => {
        if (term === "") return true;
        return p.pacienteNome.toLowerCase().includes(term) || p.profissional.toLowerCase().includes(term) || p.riscoText.toLowerCase().includes(term) || p.prioridade.toLowerCase().includes(term);
      });
      filtered.sort((a, b) => a.hora.localeCompare(b.hora));
      if (filtered.length === 0) {
        bodyEl.innerHTML = `<div class="uq-empty">${filterText === "" ? "Fila vazia." : "Nenhum paciente atende ao filtro."}</div>`;
        return;
      }
      let rowsHtml = "";
      filtered.forEach((p) => {
        const idadeCurta = p.idade.split(",")[0] || "";
        rowsHtml += `
        <tr>
          <td style="text-align: center;">
            <span class="uq-badge-risco ${p.riscoClass}">${p.riscoText}</span>
          </td>
          <td style="font-weight: bold; color: #2d3748;">${p.hora}</td>
          <td>
            <div style="font-weight: bold; font-size: 11px;">${p.pacienteNome}</div>
            <div style="color: #718096; font-size: 9px; margin-top: 1px;">
              ${idadeCurta} ${p.prioridade ? "\u2022 " + p.prioridade : ""}
            </div>
          </td>
          <td style="text-align: center;">
            <span class="uq-badge-prep preparado-${p.isPreparado}" title="${p.preparado || "N\xE3o preparado"}"></span>
          </td>
          <td style="color: #4a5568;">
            <div style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.profissional}">
              ${p.profissional.split(" ")[0] || p.profissional}
            </div>
          </td>
        </tr>
      `;
      });
      bodyEl.innerHTML = `
      <table class="uq-patient-list-table">
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">Risco</th>
            <th style="width: 40px;">Hora</th>
            <th>Usu\xE1rio(a) do Servi\xE7o</th>
            <th style="width: 30px; text-align: center;">Prep</th>
            <th style="width: 110px;">Profissional</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
    }
  };

  // src/core/core.ts
  var SIGSSPlusCore = class {
    clockModule = new ClockModule();
    autoRefreshModule = new AutoRefreshModule();
    queueCacheModule = new QueueCacheModule();
    autoAssignmentModule = new AutoAssignmentModule();
    unifiedQueueModule = new UnifiedQueueModule();
    currentPage = "UNKNOWN";
    async init() {
      console.log("SIGSS+: Inicializando extens\xE3o...");
      if (SigssAdapter.getClockElement()) {
        this.clockModule.start();
        console.log("SIGSS+: M\xF3dulo de Rel\xF3gio sincronizado.");
      }
      this.queueCacheModule.start();
      this.currentPage = SigssAdapter.detectCurrentPage();
      console.log(`SIGSS+: P\xE1gina atual detectada: ${this.currentPage}`);
      switch (this.currentPage) {
        case "QUEUE":
          await this.autoRefreshModule.start();
          this.unifiedQueueModule.start();
          console.log("SIGSS+: M\xF3dulos de Fila (Atualiza\xE7\xE3o Autom\xE1tica e Fila Unificada) iniciados.");
          break;
        case "LAUNCH":
          await this.autoAssignmentModule.start();
          console.log("SIGSS+: M\xF3dulo de Lan\xE7amento Autom\xE1tico iniciado.");
          break;
        default:
          console.log("SIGSS+: Nenhuma p\xE1gina de automa\xE7\xE3o espec\xEDfica detectada.");
          break;
      }
      this.setupConfigListener();
    }
    /**
     * Monitora alterações de configuração enviadas via popup ou opções.
     * Reinicia módulos relacionados em tempo real sem precisar recarregar a página.
     */
    setupConfigListener() {
      ConfigManager.onChange(async (changes) => {
        const hasRefreshChanges = changes.refreshInterval || changes.refreshOnlyActive || changes.preventRefreshOnForm || changes.sortDataSolicitacao;
        if (hasRefreshChanges && this.currentPage === "QUEUE") {
          console.log("SIGSS+: Configura\xE7\xF5es de atualiza\xE7\xE3o alteradas. Reiniciando m\xF3dulo...");
          await this.autoRefreshModule.start();
        }
      });
    }
  };
  var core = new SIGSSPlusCore();
  core.init().catch((err) => {
    console.error("Erro na inicializa\xE7\xE3o do SIGSS+ Core:", err);
  });
})();
//# sourceMappingURL=content.js.map
