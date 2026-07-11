import { SigssAdapter, SIGSS_SELECTORS } from '../../utils/sigssAdapter';

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
  private patients: UnifiedPatient[] = [];
  private lastUpdate: number | null = null;
  private autoRefreshTimer: number | null = null;
  private isScraping = false;

  public async start() {
    this.injectSidebar();
    this.setupEventListeners();

    // Primeiro scrape automático 2 segundos após a carga da página
    setTimeout(() => {
      this.triggerScraping();
    }, 2000);

    // Agendar scrape automático a cada 60 segundos
    this.autoRefreshTimer = window.setInterval(() => {
      this.triggerScraping();
    }, 60000);
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

    // 2. Criar a estrutura HTML do painel
    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'sigss-plus-unified-sidebar';
    this.sidebarEl.className = 'collapsed';

    this.sidebarEl.innerHTML = `
      <button class="uq-toggle-tab" id="uq-btn-toggle">
        <span class="uq-toggle-tab-icon">◀</span>
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
        SIGSS+ • Fila consolidada de todos os profissionais
      </div>
    `;

    document.body.appendChild(this.sidebarEl);
    this.toggleBtnEl = this.sidebarEl.querySelector('#uq-btn-toggle') as HTMLButtonElement;
  }

  /**
   * Configura listeners de eventos da UI e eventos customizados do browser
   */
  private setupEventListeners() {
    if (!this.sidebarEl) return;

    // Toggle de Recolhimento do painel
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

    // Botão de Refresh manual
    const refreshBtn = this.sidebarEl.querySelector('#uq-btn-refresh-action');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.triggerScraping();
      });
    }

    // Campo de busca com filtragem em tempo real
    const searchInput = this.sidebarEl.querySelector('#uq-txt-search') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.renderQueueTable(searchInput.value);
      });
    }

    // Escutar término do scrape de background disparado pelo script injetado
    document.addEventListener('sigss_plus_unified_queue_done', this.handleScrapeDoneEvent);

    // Escutar cliques no botão de Buscar do próprio SIGSS para re-sincronizar automaticamente
    const mainSearchBtn = SigssAdapter.getSearchButton();
    if (mainSearchBtn) {
      mainSearchBtn.addEventListener('click', () => {
        setTimeout(() => this.triggerScraping(), 1500); // Aguardar o AJAX original concluir
      });
    }
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

    // Adicionar efeito de loading visual no botão
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
              name: opt.text.split(' ? ') [1] || opt.text.split(' - ') [1] || opt.text.split(' – ') [1] || opt.text
            });
          }
        }

        // Se não houver profissionais listados, capturar fila do profissional logado padrão
        if (professionals.length === 0) {
          professionals.push({ id: postData['profissional.prsaPK'] || '', name: 'Padrão' });
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
                  if (r.includes('AZU') || r.includes('NÃO UR')) return { text: 'AZU', css: 'risco-azu' };
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
    const bodyEl = document.getElementById('uq-panel-body');
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
      // Limpar idades muito longas
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
}
