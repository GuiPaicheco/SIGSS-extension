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
  clockContainer: '#relogio, .relogio, #clock, .hora-sistema, #cabecalho_hora',
  
  // Fila de Espera / Busca
  searchButton: 'input[value="Buscar"], button:has-text("Buscar"), #btnBuscar, .btn-buscar, input[name="btnBuscar"]',
  queueTable: '.gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table',
  queueTableHeaders: '.gridFila th, #tabelaFila th, table.grid th',
  
  // Indicadores de Formulário
  textInputs: 'input[type="text"], input[type="search"], textarea',
  selects: 'select',
  
  // Detalhes do Lançamento
  patientEsfText: '.esf-paciente, td:contains("ESF"), td:contains("Equipe"), label:contains("ESF")',
  
  // Campos de seleção de Profissional / Equipe / CBO
  profissionalSelect: 'select[name*="profissional"], select[name*="Profissional"], select[id*="profissional"], #cd_profissional',
  equipeSelect: 'select[name*="equipe"], select[name*="Equipe"], select[id*="equipe"], #cd_equipe',
  cboSelect: 'select[name*="cbo"], select[name*="CBO"], select[name*="ocupacao"], #cd_cbo, #cd_ocupacao',
  
  // Container de Ações onde o botão de captura será injetado
  actionsContainer: '.botoes-acao, .barra-botoes, td.botoes, #divBotoes, .form-actions'
};

export class SigssAdapter {
  
  /**
   * Detecta qual página do SIGSS está aberta atualmente
   */
  static detectCurrentPage(): 'QUEUE' | 'LAUNCH' | 'UNKNOWN' {
    const url = window.location.href;
    
    // Verificações baseadas em URL
    if (url.includes('fila') || url.includes('pesquisa') || url.includes('consultar') || url.includes('mock_sigss.html')) {
      // Confirmar se existe uma tabela ou botão de buscar na página
      if (this.getSearchButton() || document.querySelector(SIGSS_SELECTORS.queueTable)) {
        return 'QUEUE';
      }
    }
    
    if (url.includes('lancamento') || url.includes('atendimento') || url.includes('gravar') || url.includes('mock_sigss_launch.html')) {
      // Confirmar se possui os selects de profissional/equipe
      const fields = this.getLaunchFields();
      if (fields.profissionalSelect || fields.equipeSelect) {
        return 'LAUNCH';
      }
    }

    // Fallback estrutural se as URLs não forem claras
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
    // 1. Tentar o seletor padrão
    let el = document.querySelector(SIGSS_SELECTORS.clockContainer) as HTMLElement;
    if (el) return el;

    // 2. Fallback: procurar por textos no formato HH:MM:SS no cabeçalho/topo do documento
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent || '';
          // Limitar busca ao topo ou elementos de cabeçalho comuns
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
    // Tentar seletores conhecidos
    const selectors = [
      'input[value="Buscar"]',
      'input[value="Pesquisar"]',
      'button#btnBuscar',
      '#btnBuscar',
      'input[name="btnBuscar"]',
      '.btn-buscar',
      'input[type="button"][value*="Buscar"]',
      'button[type="submit"]'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn as HTMLButtonElement | HTMLInputElement;
    }

    // Busca heurística por texto nos botões
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
    
    // Se o elemento ativo for um campo de entrada de texto
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

    // Heurística de formulário geral: verificar se há qualquer campo de texto com conteúdo preenchido pelo usuário
    const textInputs = document.querySelectorAll(SIGSS_SELECTORS.textInputs);
    for (let i = 0; i < textInputs.length; i++) {
      const input = textInputs[i] as HTMLInputElement | HTMLTextAreaElement;
      // Se o input foi modificado e não está vazio
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
        // Verificar se já está ordenado (geralmente há alguma classe como 'sort-asc', 'sort-desc', ou seta ▲/▼ no HTML)
        const hasSortIndicator = header.querySelector('.sort-indicator, .fa-sort, .seta') || 
                                 header.className.includes('sort') || 
                                 header.textContent.includes('▲') || 
                                 header.textContent.includes('▼');
        
        // Se já parece estar ordenado, evitamos cliques em loop. Caso contrário, ou para garantir, clicamos.
        // Como o requisito é "manter automaticamente a ordenação por Data Solicitação quando existir",
        // idealmente clicamos se detectarmos que a ordenação não está ativa ou se o usuário explicitou.
        // Vamos expor o header para que o módulo gerencie a ordenação.
        
        // Retornamos true se o header foi encontrado. O módulo decidirá o clique baseado no estado.
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
      // Retorna uma cópia limpa do HTML da tabela
      return table.outerHTML;
    }
    
    // Heurística: procurar a tabela maior na página que tenha mais de 3 linhas
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
   * Geralmente exibido como um texto descritivo. Ex: "Equipe ESF: 086" ou "Equipe de Saúde da Família: 086"
   */
  static getPatientEsf(): string | null {
    // 1. Procurar em elementos específicos
    const esfElements = document.querySelectorAll(SIGSS_SELECTORS.patientEsfText);
    const regexEsf = /(?:ESF|Equipe(?:\s+ESF)?|Sa\u00fade\s+da\s+Fam\u00edlia)[:\-\s#\b]+(\d+)/i;

    for (let i = 0; i < esfElements.length; i++) {
      const text = esfElements[i].textContent || '';
      const match = text.match(regexEsf);
      if (match && match[1]) {
        // Retorna o código limpo (ex: "086")
        return match[1].trim();
      }
    }

    // 2. Varredura completa do corpo do documento por textos que combinam com o padrão
    const bodyText = document.body.innerText;
    const bodyMatch = bodyText.match(regexEsf);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }

    // 3. Fallback: procurar por tabelas de informações do paciente
    // (Por exemplo, uma célula contendo a palavra ESF e a célula ao lado contendo o número)
    const tdList = document.querySelectorAll('td, th, span, div');
    for (let i = 0; i < tdList.length; i++) {
      const text = tdList[i].textContent || '';
      if (text.includes('ESF') || text.includes('Equipe ESF')) {
        // Verificar o elemento irmão ou pai
        const match = text.match(/\b\d{2,4}\b/);
        if (match) return match[0];
      }
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
   * Injeta o botão "Capturar Configuração" no formulário do SIGSS
   */
  static injectCaptureButton(onCapture: () => void): boolean {
    // Impedir injeção duplicada
    if (document.getElementById('sigss-plus-capture-btn')) {
      return true;
    }

    const container = document.querySelector(SIGSS_SELECTORS.actionsContainer);
    if (!container) {
      // Tentar encontrar qualquer lugar próximo a botões de "Gravar" ou "Salvar"
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

      // Se falhar tudo, injetar no final do body como um botão flutuante discreto
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
    
    // Aplicar estilos para se misturar ao SIGSS de forma nativa e profissional
    // Sem cores vibrantes, mantendo a sobriedade do sistema (cinza/azul discreto)
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

    // Hover discreto
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
