import { SigssAdapter, SIGSS_SELECTORS } from '../../utils/sigssAdapter';
import { ConfigManager, EsfMapping } from '../../core/config';

interface UnifiedPatient {
  id: string;
  riscoText: string;
  riscoClass: string;
  hora: string;
  pacienteNome: string;
  prioridade: string;
  idade: string;
  preparado: string;
  isPreparado: boolean;
  profissional: string;
}

export class UnifiedQueueModule {
  private sidebarEl: HTMLDivElement | null = null;
  private toggleBtnEl: HTMLButtonElement | null = null;
  private isCollapsed = true;
  private activeTab = 'fila';
  private activeOfflineSubTab = 'atendimento';
  private patients: UnifiedPatient[] = [];
  private lastUpdate: number | null = null;
  private autoRefreshTimer: number | null = null;
  private isScraping = false;
  private currentPage: 'QUEUE' | 'LAUNCH' | 'UNKNOWN' = 'UNKNOWN';

  public async start() {
    this.currentPage = SigssAdapter.detectCurrentPage();
    
    // Na tela de lançamentos, a aba padrão é de mapeamentos
    if (this.currentPage === 'LAUNCH') {
      this.activeTab = 'mapeamentos';
    }

    this.injectSidebar();
    this.setupEventListeners();
    await this.loadSettingsIntoUI();
    await this.renderMappingsList();

    if (this.currentPage === 'QUEUE') {
      // Primeiro scrape automático 2 segundos após a carga da página
      setTimeout(() => {
        this.triggerScraping();
      }, 2000);

      // Agendar scrape automático a cada 60 segundos
      this.autoRefreshTimer = window.setInterval(() => {
        this.triggerScraping();
      }, 60000);
    }
  }

  public stop() {
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

    document.removeEventListener('sigss_plus_unified_queue_done', this.handleScrapeDoneEvent);
  }

  /**
   * Injeta o painel lateral (sidebar) e os estilos correspondentes no DOM
   */
  private injectSidebar() {
    if (document.getElementById('sigss-plus-unified-sidebar')) return;

    // 1. Injetar a folha de estilos do painel
    const styleEl = document.createElement('style');
    styleEl.id = 'sigss-plus-unified-styles';
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
        padding: 12px 15px;
        display: flex;
        flex-direction: column;
      }
      .uq-header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .uq-title-group h3 {
        margin: 0;
        font-size: 15px;
        font-weight: bold;
      }
      .uq-title-group span {
        font-size: 11px;
        color: #ebf8ff;
        display: block;
        margin-top: 2px;
      }
      .uq-btn-refresh {
        background-color: rgba(255, 255, 255, 0.15);
        border: none;
        color: #ffffff;
        padding: 5px 8px;
        font-size: 10px;
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
      
      /* Abas internas */
      .uq-tabs-row {
        display: flex;
        gap: 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 0px;
      }
      .uq-tab-btn {
        background: none;
        border: none;
        color: #ebf8ff;
        font-size: 11px;
        font-weight: bold;
        padding: 6px 12px;
        cursor: pointer;
        opacity: 0.7;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .uq-tab-btn:hover {
        opacity: 1;
        color: #ffffff;
      }
      .uq-tab-btn.active {
        opacity: 1;
        color: #ffffff;
        border-bottom-color: #ffffff;
      }

      /* Painéis de Conteúdo */
      .uq-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }
      .uq-panel.hidden {
        display: none !important;
      }
      
      .uq-search-box {
        padding: 10px 12px;
        background-color: #f7fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .uq-input {
        width: 100%;
        padding: 6px 10px;
        font-size: 11px;
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
      
      /* Tabela de pacientes */
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
        padding: 35px;
        text-align: center;
        color: #718096;
        font-size: 12px;
      }

      /* Formulários de Configuração */
      .uq-settings-panel {
        padding: 15px;
        font-size: 11px;
      }
      .uq-form-group {
        margin-bottom: 12px;
      }
      .uq-form-label {
        display: block;
        font-weight: bold;
        color: #4a5568;
        margin-bottom: 4px;
      }
      .uq-select {
        width: 100%;
        padding: 6px;
        font-size: 11px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        background-color: #ffffff;
      }
      .uq-checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #4a5568;
        margin-bottom: 8px;
        cursor: pointer;
      }
      .uq-action-divider {
        border-top: 1px solid #e2e8f0;
        margin: 15px 0;
      }
      .uq-btn-primary {
        background-color: #1a365d;
        color: #ffffff;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 11px;
        cursor: pointer;
        width: 100%;
        text-align: center;
        transition: background-color 0.2s;
      }
      .uq-btn-primary:hover {
        background-color: #2b6cb0;
      }

      /* Mapeamentos Cards */
      .uq-card {
        background: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 10px;
        margin-bottom: 8px;
        position: relative;
      }
      .uq-card-title {
        font-weight: bold;
        color: #1a365d;
        font-size: 12px;
        margin-bottom: 4px;
      }
      .uq-card-desc {
        font-size: 10px;
        color: #4a5568;
        line-height: 1.4;
      }
      .uq-card-delete {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: #e53e3e;
        cursor: pointer;
        font-weight: bold;
        font-size: 11px;
      }
      .uq-card-delete:hover {
        color: #9b2c2c;
      }
      
      .uq-footer {
        padding: 10px 15px;
        background-color: #edf2f7;
        border-top: 1px solid #e2e8f0;
        font-size: 10px;
        color: #718096;
        text-align: center;
      }
      
      /* Fila Offline */
      .uq-offline-table-wrapper {
        width: 100%;
        overflow-x: auto;
      }
      .uq-offline-table-wrapper table {
        width: 100% !important;
        border-collapse: collapse;
        font-size: 10px;
      }
      .uq-offline-table-wrapper th {
        background-color: #edf2f7;
        color: #4a5568;
        padding: 5px;
        font-weight: bold;
        text-align: left;
        border-bottom: 2px solid #e2e8f0;
      }
      .uq-offline-table-wrapper td {
        padding: 6px 5px;
        border-bottom: 1px solid #edf2f7;
        white-space: nowrap;
      }
      .uq-offline-table-wrapper tr:hover {
        background-color: #f7fafc;
      }
      .uq-sub-tab-btn {
        flex: 1;
        padding: 4px 6px;
        font-size: 10px;
        font-weight: bold;
        border: 1px solid #cbd5e0;
        border-radius: 3px;
        cursor: pointer;
        background-color: #edf2f7;
        color: #4a5568;
        transition: all 0.2s;
        text-align: center;
      }
      .uq-sub-tab-btn:hover {
        background-color: #e2e8f0;
      }
      .uq-sub-tab-btn.active {
        background-color: #1a365d;
        color: #ffffff;
        border-color: #1a365d;
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Criar a estrutura HTML do painel
    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'sigss-plus-unified-sidebar';
    this.sidebarEl.className = 'collapsed';

    this.sidebarEl.innerHTML = `
      <button class="uq-toggle-tab" id="uq-btn-toggle">
        <span class="uq-toggle-tab-icon">◀</span>
        <span class="uq-toggle-tab-text">SIGSS+</span>
      </button>
      
      <div class="uq-header">
        <div class="uq-header-top">
          <div class="uq-title-group">
            <h3>SIGSS+ Painel</h3>
            <span id="uq-lbl-status">Carregando painel...</span>
          </div>
          <div class="uq-header-actions">
            <button class="uq-btn-refresh ${this.currentPage !== 'QUEUE' ? 'hidden' : ''}" id="uq-btn-refresh-action">Atualizar</button>
          </div>
        </div>
        
        <div class="uq-tabs-row">
          <button class="uq-tab-btn ${this.currentPage !== 'QUEUE' ? 'hidden' : 'active'}" data-tab="fila">Fila Unificada</button>
          <button class="uq-tab-btn" data-tab="offline">Fila Offline</button>
          <button class="uq-tab-btn ${this.currentPage !== 'QUEUE' ? 'active' : ''}" data-tab="mapeamentos">Mapeamentos ESF</button>
          <button class="uq-tab-btn" data-tab="config">Configurações</button>
        </div>
      </div>
      
      <!-- Painel 1: Fila Unificada (Somente na Fila) -->
      <div id="uq-panel-fila" class="uq-panel ${this.currentPage !== 'QUEUE' ? 'hidden' : ''}">
        <div class="uq-search-box">
          <input type="text" class="uq-input" id="uq-txt-search" placeholder="Filtrar por paciente, profissional ou risco...">
        </div>
        <div class="uq-body" id="uq-panel-fila-body">
          <div class="uq-empty">Nenhum paciente na fila. Clique em Atualizar.</div>
        </div>
      </div>

      <!-- Painel 4: Fila Offline -->
      <div id="uq-panel-offline" class="uq-panel hidden">
        <div class="uq-search-box" style="display: flex; gap: 5px; padding: 8px 10px; background-color: #f7fafc; border-bottom: 1px solid #e2e8f0;">
          <button class="uq-sub-tab-btn active" data-subtab="atendimento">Atendimento</button>
          <button class="uq-sub-tab-btn" data-subtab="acolhimento">Acolhimento</button>
          <button class="uq-sub-tab-btn" data-subtab="fila">Fila Geral</button>
        </div>
        <div class="uq-body" id="uq-panel-offline-body" style="padding: 10px; overflow-x: auto;">
          <div class="uq-empty">Carregando cache offline...</div>
        </div>
      </div>

      <!-- Painel 2: Mapeamentos ESF -->
      <div id="uq-panel-mapeamentos" class="uq-panel ${this.currentPage !== 'QUEUE' ? '' : 'hidden'}">
        <div class="uq-body" id="uq-panel-mapeamentos-body">
          <div class="uq-empty">Nenhum mapeamento registrado ainda.</div>
        </div>
      </div>

      <!-- Painel 3: Configurações -->
      <div id="uq-panel-config" class="uq-panel hidden">
        <div class="uq-body uq-settings-panel">
          <div class="uq-form-group">
            <label for="uq-select-interval" class="uq-form-label">Intervalo de Atualização Automática:</label>
            <select id="uq-select-interval" class="uq-select">
              <option value="disabled">Desativado</option>
              <option value="5">5 segundos</option>
              <option value="10">10 segundos</option>
              <option value="15">15 segundos</option>
              <option value="20">20 segundos</option>
              <option value="30">30 segundos</option>
              <option value="60">60 segundos</option>
            </select>
          </div>
          
          <div class="uq-form-group">
            <label class="uq-checkbox-label">
              <input type="checkbox" id="uq-chk-active-only">
              Atualizar apenas na aba ativa
            </label>
            <label class="uq-checkbox-label">
              <input type="checkbox" id="uq-chk-prevent-form">
              Não atualizar se preenchendo formulário
            </label>
            <label class="uq-checkbox-label">
              <input type="checkbox" id="uq-chk-sort-date">
              Manter ordenado por "Data Solicitação"
            </label>
          </div>
          
          <div class="uq-action-divider"></div>
          
          <button id="uq-btn-offline-view" class="uq-btn-primary">
            Visualizar Última Fila Salva (Offline)
          </button>
        </div>
      </div>

      <div class="uq-footer">
        SIGSS+ • Extensão de Produtividade UBS Betim
      </div>
    `;

    document.body.appendChild(this.sidebarEl);
    this.toggleBtnEl = this.sidebarEl.querySelector('#uq-btn-toggle') as HTMLButtonElement;
    this.updateStatusLabel();
  }

  /**
   * Configura listeners de eventos do painel
   */
  private setupEventListeners() {
    if (!this.sidebarEl) return;

    // Toggle do painel lateral (Slide in/out)
    const toggleTab = this.sidebarEl.querySelector('#uq-btn-toggle');
    if (toggleTab) {
      toggleTab.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        this.sidebarEl?.classList.toggle('collapsed', this.isCollapsed);
        const icon = toggleTab.querySelector('.uq-toggle-tab-icon');
        if (icon) {
          icon.textContent = this.isCollapsed ? '◀' : '▶';
        }
      });
    }

    // Navegação entre abas
    const tabBtns = this.sidebarEl.querySelectorAll('.uq-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const tab = target.getAttribute('data-tab') || 'fila';

        tabBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        // Ocultar todos os painéis
        this.sidebarEl?.querySelector('#uq-panel-fila')?.classList.add('hidden');
        this.sidebarEl?.querySelector('#uq-panel-offline')?.classList.add('hidden');
        this.sidebarEl?.querySelector('#uq-panel-mapeamentos')?.classList.add('hidden');
        this.sidebarEl?.querySelector('#uq-panel-config')?.classList.add('hidden');

        // Mostrar painel selecionado
        this.sidebarEl?.querySelector(`#uq-panel-${tab}`)?.classList.remove('hidden');
        this.activeTab = tab;

        if (tab === 'offline') {
          this.renderOfflineCache();
        }
      });
    });

    // Cliques nas sub-abas da fila offline
    const subTabBtns = this.sidebarEl.querySelectorAll('.uq-sub-tab-btn');
    subTabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const subtab = target.getAttribute('data-subtab') || 'atendimento';

        subTabBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        this.activeOfflineSubTab = subtab;
        this.renderOfflineCache();
      });
    });

    // Filtro de pesquisa na fila unificada
    const searchInput = this.sidebarEl.querySelector('#uq-txt-search') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.renderQueueTable(searchInput.value);
      });
    }

    // Ações de Configuração - Salvar automático ao alterar os inputs
    const intervalSelect = this.sidebarEl.querySelector('#uq-select-interval') as HTMLSelectElement | null;
    if (intervalSelect) {
      intervalSelect.addEventListener('change', async () => {
        await ConfigManager.set({ refreshInterval: intervalSelect.value });
      });
    }

    const chkActiveOnly = this.sidebarEl.querySelector('#uq-chk-active-only') as HTMLInputElement | null;
    if (chkActiveOnly) {
      chkActiveOnly.addEventListener('change', async () => {
        await ConfigManager.set({ refreshOnlyActive: chkActiveOnly.checked });
      });
    }

    const chkPreventForm = this.sidebarEl.querySelector('#uq-chk-prevent-form') as HTMLInputElement | null;
    if (chkPreventForm) {
      chkPreventForm.addEventListener('change', async () => {
        await ConfigManager.set({ preventRefreshOnForm: chkPreventForm.checked });
      });
    }

    const chkSortDate = this.sidebarEl.querySelector('#uq-chk-sort-date') as HTMLInputElement | null;
    if (chkSortDate) {
      chkSortDate.addEventListener('change', async () => {
        await ConfigManager.set({ sortDataSolicitacao: chkSortDate.checked });
      });
    }

    // Botão Fila Offline
    const offlineBtn = this.sidebarEl.querySelector('#uq-btn-offline-view');
    if (offlineBtn) {
      offlineBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'open_offline_viewer' });
      });
    }

    // Botão de Refresh manual
    const refreshBtn = this.sidebarEl.querySelector('#uq-btn-refresh-action');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.triggerScraping();
      });
    }

    // Ouvir alteração de mapeamentos salvos para recarregar em tempo real
    ConfigManager.onChange(async () => {
      await this.renderMappingsList();
    });

    // Ouvir conclusão do scraping
    document.addEventListener('sigss_plus_unified_queue_done', this.handleScrapeDoneEvent);

    // Ouvir clique de busca nativo
    const mainSearchBtn = SigssAdapter.getSearchButton();
    if (mainSearchBtn) {
      mainSearchBtn.addEventListener('click', () => {
        if (this.currentPage === 'QUEUE') {
          setTimeout(() => this.triggerScraping(), 1500);
        }
      });
    }
  }

  /**
   * Carrega as configurações locais para os elementos HTML do painel de Configurações
   */
  private async loadSettingsIntoUI() {
    const config = await ConfigManager.getAll();

    const intervalSelect = document.getElementById('uq-select-interval') as HTMLSelectElement | null;
    if (intervalSelect) intervalSelect.value = config.refreshInterval;

    const chkActiveOnly = document.getElementById('uq-chk-active-only') as HTMLInputElement | null;
    if (chkActiveOnly) chkActiveOnly.checked = config.refreshOnlyActive;

    const chkPreventForm = document.getElementById('uq-chk-prevent-form') as HTMLInputElement | null;
    if (chkPreventForm) chkPreventForm.checked = config.preventRefreshOnForm;

    const chkSortDate = document.getElementById('uq-chk-sort-date') as HTMLInputElement | null;
    if (chkSortDate) chkSortDate.checked = config.sortDataSolicitacao;
  }

  /**
   * Renderiza a lista de mapeamentos ESF cadastrados na aba Mapeamentos
   */
  private async renderMappingsList() {
    const bodyEl = document.getElementById('uq-panel-mapeamentos-body');
    if (!bodyEl) return;

    const config = await ConfigManager.getAll();
    const codes = Object.keys(config.esfMappings);

    if (codes.length === 0) {
      bodyEl.innerHTML = '<div class="uq-empty">Nenhum mapeamento de ESF capturado ainda.<br><br>Para criar um mapeamento, abra uma tela de lançamento, selecione um paciente com ESF, preencha as seleções de Profissional/Equipe/CBO e clique em "Capturar Configuração".</div>';
      return;
    }

    let cardsHtml = '';
    codes.forEach(code => {
      const map = config.esfMappings[code];
      const pNome = map.profissionalNome?.split(' – ')[1] || map.profissionalNome?.split(' - ')[1] || map.profissionalNome || map.profissionalId;
      const eNome = map.equipeNome?.split(' - ')[1] || map.equipeNome || map.equipeId;
      const cNome = map.cboNome?.split(' - ')[1] || map.cboNome || map.cboId;

      cardsHtml += `
        <div class="uq-card" data-esf="${code}">
          <button class="uq-card-delete" data-action="delete" data-esf="${code}" title="Excluir Mapeamento">Excluir</button>
          <div class="uq-card-title">Equipe ESF ${code}</div>
          <div class="uq-card-desc">
            <strong>Profissional:</strong> ${pNome}<br>
            <strong>Equipe:</strong> ${eNome}<br>
            <strong>CBO/Ocupação:</strong> ${cNome}
          </div>
        </div>
      `;
    });

    bodyEl.innerHTML = cardsHtml;

    // Configurar ações de exclusão direta na lista
    const deleteBtns = bodyEl.querySelectorAll('button[data-action="delete"]');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const esfCode = target.getAttribute('data-esf');
        if (esfCode && confirm(`Deseja realmente remover a configuração automática da Equipe ESF ${esfCode}?`)) {
          await ConfigManager.deleteEsfMapping(esfCode);
          await this.renderMappingsList();
        }
      });
    });
  }

  /**
   * Tratador nomeado de evento para permitir o stop() desconectar corretamente
   */
  private handleScrapeDoneEvent = (e: Event) => {
    const customEvent = e as CustomEvent;
    const { patients, timestamp } = customEvent.detail;
    
    this.patients = patients;
    this.lastUpdate = timestamp;
    this.isScraping = false;

    // Salvar no storage local
    chrome.storage.local.set({
      queueCache_unified: {
        patients: patients,
        timestamp: timestamp,
        name: 'Fila Unificada (Todos)'
      }
    });

    this.updateStatusLabel();
    const searchInput = this.sidebarEl?.querySelector('#uq-txt-search') as HTMLInputElement | null;
    this.renderQueueTable(searchInput?.value || '');

    // Desativar spinner do botão de atualizar
    const refreshActionBtn = this.sidebarEl?.querySelector('#uq-btn-refresh-action');
    if (refreshActionBtn) {
      refreshActionBtn.classList.remove('scraping');
      refreshActionBtn.textContent = 'Atualizar';
    }
  };

  /**
   * Dispara a injeção do script de scraping no Main World
   */
  private triggerScraping() {
    if (this.isScraping) return;
    this.isScraping = true;

    const refreshActionBtn = this.sidebarEl?.querySelector('#uq-btn-refresh-action');
    if (refreshActionBtn) {
      refreshActionBtn.classList.add('scraping');
      refreshActionBtn.textContent = '🌀';
    }

    const statusLbl = document.getElementById('uq-lbl-status');
    if (statusLbl) {
      statusLbl.textContent = 'Consultando profissionais...';
    }

    // Script injetado para rodar no contexto da página (Main World)
    const scriptContent = `
      (function() {
        const grid = window.jQuery ? window.jQuery('.ui-jqgrid-btable:visible').first() : null;
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

        // Achar todos os profissionais no dropdown de filtros
        const profSelect = document.getElementById('profissional.prsaPK') || document.getElementById('agtr.profissional.prsaPK');
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
              name: opt.text.split(' ? ')[1] || opt.text.split(' - ')[1] || opt.text.split(' – ')[1] || opt.text
            });
          }
        }

        // Se não houver profissionais listados no dropdown, pega o atual logado
        if (professionals.length === 0) {
          professionals.push({ 
            id: postData['profissional.prsaPK'] || postData['agtr.profissional.prsaPK'] || '', 
            name: 'Padrão' 
          });
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
          
          // Clonar e avaliar as propriedades do postData (incluindo funções)
          const requestData = {};
          for (const key in postData) {
            let val = postData[key];
            if (typeof val === 'function') {
              val = val(); // Avaliar a função para extrair o valor atualizado
            }
            
            // Se o valor contiver o filtro do profissional, atualiza para o atual do loop
            if (typeof val === 'string' && val.indexOf('prsaPK:') !== -1) {
              // Tratar se for formato de filtro array "prsaPK:ID" ou "filtro=prsaPK:ID"
              const parts = val.split(':');
              if (parts.length === 2 && parts[0] === 'prsaPK') {
                requestData[key] = 'prsaPK:' + prof.id;
              } else {
                requestData[key] = val.replace(/prsaPK:[^,;&]*/, 'prsaPK:' + prof.id);
              }
            } else {
              requestData[key] = val;
            }
          }
          
          // Ajustar campos diretos de profissional
          if (requestData['profissional.prsaPK'] !== undefined) {
            requestData['profissional.prsaPK'] = prof.id;
          }
          if (requestData['agtr.profissional.prsaPK'] !== undefined) {
            requestData['agtr.profissional.prsaPK'] = prof.id;
          }
          if (requestData['prsaPK'] !== undefined) {
            requestData['prsaPK'] = prof.id;
          }

          window.jQuery.ajax({
            url: url,
            type: 'POST',
            data: requestData,
            dataType: 'text', // Forçar retorno de texto para evitar problemas de content-type no XML
            success: function(text) {
              try {
                // Auxiliar para mapear risco
                const parseRisco = (riscoText) => {
                  const r = (riscoText || '').toUpperCase();
                  if (r.includes('VER') || r.includes('EMERG')) return { text: 'VER', css: 'risco-ver' };
                  if (r.includes('LAR') || r.includes('MUITO')) return { text: 'LAR', css: 'risco-lar' };
                  if (r.includes('AMA') || r.includes('URGEN')) return { text: 'AMA', css: 'risco-ama' };
                  if (r.includes('VERD') || r.includes('POUCO')) return { text: 'VERD', css: 'risco-verd' };
                  if (r.includes('AZU') || r.includes('NÃO UR')) return { text: 'AZU', css: 'risco-azu' };
                  return { text: 'NOR', css: 'risco-nor' };
                };

                const trimmed = (text || '').trim();
                
                if (trimmed.startsWith('<')) {
                  // Tratar retorno XML
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(trimmed, "text/xml");
                  const rows = xmlDoc.querySelectorAll('row');
                  
                  rows.forEach(row => {
                    const cells = row.querySelectorAll('cell');
                    const rowData = {};
                    colNames.forEach((name, colIdx) => {
                      rowData[name] = cells[colIdx]?.textContent || '';
                    });

                    const risco = parseRisco(rowData['riscoAb'] || rowData['riscoAb_class'] || '');
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
                } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  // Tratar retorno JSON
                  const data = JSON.parse(trimmed);
                  const rows = data.rows || [];
                  
                  rows.forEach(row => {
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

                    const risco = parseRisco(rowData['riscoAb'] || rowData['riscoAb_class'] || '');
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

    const scriptEl = document.createElement('script');
    scriptEl.textContent = scriptContent;
    (document.head || document.documentElement).appendChild(scriptEl);
    scriptEl.remove();
  }

  /**
   * Atualiza a legenda com o horário da última atualização
   */
  private updateStatusLabel() {
    const statusLbl = document.getElementById('uq-lbl-status');
    if (!statusLbl) return;

    if (this.currentPage !== 'QUEUE') {
      statusLbl.textContent = 'SIGSS+ Ativo';
      return;
    }

    if (this.lastUpdate) {
      const time = new Date(this.lastUpdate).toLocaleTimeString('pt-BR');
      statusLbl.textContent = `Atualizado às ${time} (${this.patients.length} pacientes)`;
    } else {
      statusLbl.textContent = 'Sem dados atualizados.';
    }
  }

  /**
   * Renderiza a tabela de pacientes filtrada no painel
   */
  private renderQueueTable(filterText = '') {
    const bodyEl = document.getElementById('uq-panel-fila-body');
    if (!bodyEl) return;

    const term = filterText.toLowerCase().trim();
    
    // Filtrar pacientes
    const filtered = this.patients.filter(p => {
      if (term === '') return true;
      return (
        p.pacienteNome.toLowerCase().includes(term) ||
        p.profissional.toLowerCase().includes(term) ||
        p.riscoText.toLowerCase().includes(term) ||
        p.prioridade.toLowerCase().includes(term)
      );
    });

    // Ordenar a fila unificada por hora da consulta
    filtered.sort((a, b) => a.hora.localeCompare(b.hora));

    if (filtered.length === 0) {
      bodyEl.innerHTML = `<div class="uq-empty">${filterText === '' ? 'Fila vazia.' : 'Nenhum paciente atende ao filtro.'}</div>`;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(p => {
      const idadeCurta = p.idade.split(',')[0] || '';

      rowsHtml += `
        <tr>
          <td style="text-align: center;">
            <span class="uq-badge-risco ${p.riscoClass}">${p.riscoText}</span>
          </td>
          <td style="font-weight: bold; color: #2d3748;">${p.hora}</td>
          <td>
            <div style="font-weight: bold; font-size: 11px;">${p.pacienteNome}</div>
            <div style="color: #718096; font-size: 9px; margin-top: 1px;">
              ${idadeCurta} ${p.prioridade ? '• ' + p.prioridade : ''}
            </div>
          </td>
          <td style="text-align: center;">
            <span class="uq-badge-prep preparado-${p.isPreparado}" title="${p.preparado || 'Não preparado'}"></span>
          </td>
          <td style="color: #4a5568;">
            <div style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.profissional}">
              ${p.profissional.split(' ')[0] || p.profissional}
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
            <th>Usuário(a) do Serviço</th>
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

  /**
   * Carrega e renderiza o cache offline estático para Atendimento, Acolhimento ou Fila Geral
   */
  private async renderOfflineCache() {
    const bodyEl = document.getElementById('uq-panel-offline-body');
    if (!bodyEl) return;

    const cacheKey = `queueCache_${this.activeOfflineSubTab}`;
    chrome.storage.local.get([cacheKey], (items) => {
      const cache = items[cacheKey];

      if (!cache || !cache.html) {
        bodyEl.innerHTML = `<div class="uq-empty">Nenhum cache offline disponível para "${this.activeOfflineSubTab.toUpperCase()}".</div>`;
        return;
      }

      // Exibir quando o cache foi salvo
      const date = new Date(cache.timestamp);
      const timeStr = date.toLocaleTimeString('pt-BR');
      const dateStr = date.toLocaleDateString('pt-BR');
      
      bodyEl.innerHTML = `
        <div style="font-size: 9px; color: #718096; margin-bottom: 8px; text-align: center; font-weight: bold; background-color: #edf2f7; padding: 4px; border-radius: 3px;">
          Fila salva em ${dateStr} às ${timeStr}
        </div>
        <div class="uq-offline-table-wrapper">
          ${cache.html}
        </div>
      `;

      // Neutralizar links e cliques na tabela injetada
      const elList = bodyEl.querySelectorAll('a, button, input');
      elList.forEach(el => {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
    });
  }
}
