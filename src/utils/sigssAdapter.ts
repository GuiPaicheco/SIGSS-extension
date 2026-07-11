/**
 * SIGSS+ - Abstração da Interface DOM do SIGSS
 * 
 * Este módulo isola todos os seletores CSS e consultas DOM do SIGSS.
 * Caso o HTML do sistema seja alterado, apenas este arquivo precisará de manutenção.
 */

export interface SigssPageDetails {
  pageType: 'QUEUE' | 'LAUNCH' | 'UNKNOWN';
}

export interface LaunchFields {
  profissionalSelect: HTMLSelectElement | null;
  equipeSelect: HTMLSelectElement | null;
  cboSelect: HTMLSelectElement | null;
}

export const SIGSS_SELECTORS = {
  // Cabeçalho / Relógio
  clockContainer: '#horaAtual, #relogio, .relogio, #clock, .hora-sistema, #cabecalho_hora',
  
  // Fila de Espera / Busca (jqGrid / AJAX)
  searchButton: '#btnBuscar, input[value="Buscar"], button:has-text("Buscar"), .btn-buscar, input[name="btnBuscar"]',
  queueTable: '#grid_transferencia_agenda, .ui-jqgrid-btable, .gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table',
  queueTableHeaders: '.ui-jqgrid-htable th, tr.ui-jqgrid-labels th, .gridFila th, #tabelaFila th, table.grid th',
  
  // Indicadores de Formulário
  textInputs: 'input[type="text"], input[type="search"], textarea',
  selects: 'select',
  
  // Detalhes do Lançamento
  patientEsfText: '.esf-paciente, td:contains("ESF"), td:contains("Equipe"), label:contains("ESF")',
  
  // Campos de seleção de Profissional / Equipe / CBO
  profissionalSelect: 'select[id="agtr.profissional.prsaPK"]',
  equipeSelect: 'select[id="agtr.equipe.equiPK"]',
  cboSelect: 'select[id="agtr.atividadeProfissionalCnes.apcnId"]',
  
  // Container de Ações onde o botão de captura será injetado
  actionsContainer: '#divBotoes, .botoes-acao, .barra-botoes, td.botoes, .form-actions'
};

export class SigssAdapter {
  
  /**
   * Detecta qual página do SIGSS está aberta atualmente
   */
  static detectCurrentPage(): 'QUEUE' | 'LAUNCH' | 'UNKNOWN' {
    const url = window.location.href;
    
    // Verificações baseadas em URL
    if (url.includes('fila') || url.includes('pesquisa') || url.includes('consultar') || url.includes('agendamentoTriagem.jsp') || url.includes('mock_sigss.html')) {
      if (this.getSearchButton() || document.querySelector(SIGSS_SELECTORS.queueTable)) {
        return 'QUEUE';
      }
    }
    
    if (url.includes('lancamento') || url.includes('atendimento') || url.includes('gravar') || url.includes('mock_sigss_launch.html')) {
      const fields = this.getLaunchFields();
      if (fields.profissionalSelect || fields.equipeSelect) {
        return 'LAUNCH';
      }
    }

    // Fallback estrutural
    if (document.querySelector(SIGSS_SELECTORS.queueTable)) {
      return 'QUEUE';
    }
    
    const fieldsFallback = this.getLaunchFields();
    if (fieldsFallback.profissionalSelect && fieldsFallback.equipeSelect) {
      return 'LAUNCH';
    }

    return 'UNKNOWN';
  }

  /**
   * Obtém o elemento HTML do cabeçalho que exibe o relógio
   */
  static getClockElement(): HTMLElement | null {
    let el = document.querySelector(SIGSS_SELECTORS.clockContainer) as HTMLElement;
    if (el) return el;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent || '';
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SPAN' || parent.tagName === 'DIV' || parent.tagName === 'TD')) {
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
  static getSearchButton(): HTMLButtonElement | HTMLInputElement | null {
    const selectors = [
      '#btnBuscar',
      'input[value="Buscar"]',
      'input[value="Pesquisar"]',
      'input[name="btnBuscar"]',
      '.btn-buscar',
      'input[type="button"][value*="Buscar"]',
      'button[type="submit"]'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn as HTMLButtonElement | HTMLInputElement;
    }

    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = (btn instanceof HTMLInputElement ? btn.value : btn.textContent) || '';
      if (text.trim().toLowerCase() === 'buscar' || text.trim().toLowerCase() === 'pesquisar') {
        return btn as HTMLButtonElement | HTMLInputElement;
      }
    }

    return null;
  }

  /**
   * Verifica se o usuário está preenchendo algum formulário ativamente na página
   */
  static isFormBeingFilled(): boolean {
    const activeEl = document.activeElement;
    if (!activeEl) return false;

    const tagName = activeEl.tagName.toLowerCase();
    
    if (tagName === 'textarea') {
      const txt = activeEl as HTMLTextAreaElement;
      return txt.value.trim().length > 0;
    }

    if (tagName === 'input') {
      const input = activeEl as HTMLInputElement;
      const type = (input.type || 'text').toLowerCase();
      if (['text', 'search', 'number', 'tel', 'email', 'date', 'datetime-local'].includes(type)) {
        return input.value.trim().length > 0;
      }
    }

    const textInputs = document.querySelectorAll(SIGSS_SELECTORS.textInputs);
    for (let i = 0; i < textInputs.length; i++) {
      const input = textInputs[i] as HTMLInputElement | HTMLTextAreaElement;
      if (input === document.activeElement && input.value.trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Busca e clica no cabeçalho da coluna para ordenar por "Data Solicitação"
   */
  static ensureSorting(columnName = 'Data Solicitação'): boolean {
    const headers = document.querySelectorAll(SIGSS_SELECTORS.queueTableHeaders);
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] as HTMLElement;
      if (header.textContent?.trim().toLowerCase().includes(columnName.toLowerCase())) {
        const hasSortIndicator = header.querySelector('.sort-indicator, .fa-sort, .seta') || 
                                 header.className.includes('sort') || 
                                 header.textContent.includes('▲') || 
                                 header.textContent.includes('▼');
        return true;
      }
    }
    return false;
  }

  /**
   * Tenta encontrar a tabela da fila e obter seu HTML limpo para armazenamento em cache
   */
  static getQueueTableHTML(): string | null {
    const table = document.querySelector(SIGSS_SELECTORS.queueTable);
    if (table) {
      return table.outerHTML;
    }
    
    const tables = document.querySelectorAll('table');
    let bestTable: HTMLTableElement | null = null;
    let maxRows = 0;
    
    tables.forEach(t => {
      const rowCount = t.rows.length;
      if (rowCount > maxRows && rowCount > 3) {
        maxRows = rowCount;
        bestTable = t;
      }
    });

    if (bestTable) {
      return (bestTable as HTMLTableElement).outerHTML;
    }

    return null;
  }

  /**
   * Tenta identificar o código ESF do paciente na página de lançamento.
   * Realiza buscas no dropdown Chosen do paciente, nas opções selecionadas e no texto da página.
   */
  static getPatientEsf(): string | null {
    const regexEsf = /(?:ESF|Equipe(?:\s+ESF)?|Sa\u00fade\s+da\s+Fam\u00edlia|INE)[:\-\s#\b]+(\d+)/i;

    // 1. Tentar ler do texto da opção selecionada do dropdown do paciente
    const patientSelect = document.querySelector('[id="agtr.usuarioServico.isenPK"]') as HTMLSelectElement | null;
    if (patientSelect && patientSelect.selectedIndex >= 0) {
      const selectedText = patientSelect.options[patientSelect.selectedIndex]?.text || '';
      const match = selectedText.match(regexEsf);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 2. Tentar ler do container Chosen ativo que exibe o nome do paciente selecionado
    const chosenSpan = document.querySelector('#agtr_usuarioServico_isenPK_chzn .chzn-single span');
    if (chosenSpan) {
      const chosenText = chosenSpan.textContent || '';
      const match = chosenText.match(regexEsf);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 3. Procurar em elementos específicos de texto ou labels de ESF
    const esfElements = document.querySelectorAll(SIGSS_SELECTORS.patientEsfText);
    for (let i = 0; i < esfElements.length; i++) {
      const text = esfElements[i].textContent || '';
      const match = text.match(regexEsf);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 4. Varredura completa do corpo do documento
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
  static getLaunchFields(): LaunchFields {
    return {
      profissionalSelect: document.querySelector(SIGSS_SELECTORS.profissionalSelect) as HTMLSelectElement | null,
      equipeSelect: document.querySelector(SIGSS_SELECTORS.equipeSelect) as HTMLSelectElement | null,
      cboSelect: document.querySelector(SIGSS_SELECTORS.cboSelect) as HTMLSelectElement | null
    };
  }

  /**
   * Define o valor de um select e força a atualização do plugin jQuery Chosen
   * injetando um script temporário no contexto da página.
   */
  static setSelectValueAndTrigger(selector: string, value: string) {
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
    const script = document.createElement('script');
    script.textContent = scriptContent;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  /**
   * Injeta o botão "Capturar Configuração" no formulário do SIGSS
   */
  static injectCaptureButton(onCapture: () => void): boolean {
    if (document.getElementById('sigss-plus-capture-btn')) {
      return true;
    }

    const container = document.querySelector(SIGSS_SELECTORS.actionsContainer);
    if (!container) {
      const buttons = document.querySelectorAll('input[type="submit"], input[value*="Gravar"], button');
      let targetButton: Element | null = null;
      for (let i = 0; i < buttons.length; i++) {
        const text = (buttons[i] instanceof HTMLInputElement ? (buttons[i] as HTMLInputElement).value : buttons[i].textContent) || '';
        if (text.toLowerCase().includes('gravar') || text.toLowerCase().includes('salvar')) {
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
  private static createAndInjectButton(parent: Element, onClick: () => void, isFloating = false) {
    const btn = document.createElement('button');
    btn.id = 'sigss-plus-capture-btn';
    btn.type = 'button';
    btn.textContent = 'Capturar Configuração';
    
    if (isFloating) {
      btn.style.position = 'fixed';
      btn.style.bottom = '20px';
      btn.style.right = '20px';
      btn.style.zIndex = '99999';
      btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    }

    btn.style.backgroundColor = '#f0f0f0';
    btn.style.border = '1px solid #b5b5b5';
    btn.style.borderRadius = '3px';
    btn.style.color = '#333';
    btn.style.fontFamily = 'Arial, sans-serif';
    btn.style.fontSize = '12px';
    btn.style.fontWeight = 'bold';
    btn.style.padding = '4px 10px';
    btn.style.margin = '0 5px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#e0e0e0';
      btn.style.borderColor = '#999';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#f0f0f0';
      btn.style.borderColor = '#b5b5b5';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });

    parent.appendChild(btn);
  }
}

