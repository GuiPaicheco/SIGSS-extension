import { SigssAdapter, SIGSS_SELECTORS } from '../../utils/sigssAdapter';
import { ConfigManager } from '../../core/config';

/**
 * MÓDULO 3 - Cache Local
 * 
 * Captura e armazena localmente as últimas filas visualizadas com sucesso de forma segregada.
 * Monitora a disponibilidade do sistema para alertar o usuário e disponibiliza
 * um banner para visualizar o cache em caso de indisponibilidade do portal SIGSS.
 */
export class QueueCacheModule {
  private observedTables = new Map<Element, MutationObserver>();
  private checkIntervalId: number | null = null;
  private saveDebounceTimeoutId: number | null = null;

  public start() {
    this.checkSystemAvailability();
    
    // Varredura imediata para capturar tabelas presentes no carregamento
    this.scanAndSetupObservers();
    
    // Varredura periódica a cada 2 segundos para interceptar tabelas geradas dinamicamente via AJAX tardio
    this.checkIntervalId = window.setInterval(() => {
      this.scanAndSetupObservers();
    }, 2000);
  }

  public stop() {
    if (this.checkIntervalId !== null) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    if (this.saveDebounceTimeoutId !== null) {
      window.clearTimeout(this.saveDebounceTimeoutId);
      this.saveDebounceTimeoutId = null;
    }

    // Desconectar observadores ativos
    this.observedTables.forEach(observer => observer.disconnect());
    this.observedTables.clear();
  }

  /**
   * Verifica se o corpo da página contém erros conhecidos do servidor
   * ou mensagens indicando queda do SIGSS
   */
  private checkSystemAvailability() {
    const text = document.body.innerText.toLowerCase();
    const errorKeywords = [
      'erro interno do servidor',
      'banco de dados indisponivel',
      'banco de dados indisponível',
      'sistema indisponivel',
      'sistema indisponível',
      'erro de conexão',
      'service unavailable',
      'connection timed out',
      '503 service',
      'erro ao processar sua solicitação',
      'erro no servidor'
    ];

    const isSystemDown = errorKeywords.some(keyword => text.includes(keyword));
    if (isSystemDown) {
      this.injectOfflineBanner();
    }
  }

  /**
   * Injeta um banner de aviso na página caso o sistema esteja offline
   */
  private injectOfflineBanner() {
    if (document.getElementById('sigss-plus-offline-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'sigss-plus-offline-banner';
    
    banner.style.backgroundColor = '#fff3cd';
    banner.style.border = '1px solid #ffeeba';
    banner.style.color = '#856404';
    banner.style.padding = '12px 20px';
    banner.style.margin = '15px auto';
    banner.style.maxWidth = '1000px';
    banner.style.borderRadius = '4px';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.fontSize = '13px';
    banner.style.textAlign = 'center';
    banner.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';

    banner.innerHTML = `
      <strong>Aviso do SIGSS+:</strong> O sistema SIGSS parece estar instável ou offline no momento. 
      <a href="#" id="sigss-plus-view-cache-btn" style="color: #533f03; font-weight: bold; text-decoration: underline; margin-left: 10px;">
        Clique aqui para abrir a última fila salva em cache local (Modo Consulta)
      </a>.
    `;

    const firstChild = document.body.firstChild;
    if (firstChild) {
      document.body.insertBefore(banner, firstChild);
    } else {
      document.body.appendChild(banner);
    }

    const link = banner.querySelector('#sigss-plus-view-cache-btn');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'open_offline_viewer' });
      });
    }
  }

  /**
   * Varre o documento em busca de tabelas de filas e inicia sua observação
   */
  private scanAndSetupObservers() {
    // Dividir a string de seletores e remover espaços
    const selectors = SIGSS_SELECTORS.queueTable.split(',').map(s => s.trim());
    
    // Adicionar IDs específicos que possamos querer mapear
    const customSelectors = ['#grid_transferencia_agenda', '#grid_acolhimentos', '#grid_busca'];
    const allSelectors = Array.from(new Set([...selectors, ...customSelectors]));

    allSelectors.forEach(selector => {
      try {
        const tables = document.querySelectorAll(selector);
        tables.forEach(table => {
          if (table instanceof HTMLTableElement && !this.observedTables.has(table)) {
            this.setupTableObserver(table);
          }
        });
      } catch (err) {
        // Ignorar seletores inválidos de CSS como :contains em queries nativas
      }
    });
  }

  /**
   * Configura o MutationObserver para uma tabela específica
   */
  private setupTableObserver(table: HTMLTableElement) {
    const { key, name } = this.getQueueTypeAndName(table);
    console.log(`SIGSS+: Monitorando tabela de fila "${name}" (ID: ${table.id || 'N/A'})`);

    const observer = new MutationObserver(() => {
      if (this.saveDebounceTimeoutId !== null) {
        window.clearTimeout(this.saveDebounceTimeoutId);
      }

      this.saveDebounceTimeoutId = window.setTimeout(() => {
        this.captureAndSaveSpecificQueue(table, key, name);
      }, 1000);
    });

    observer.observe(table, {
      childList: true,
      subtree: true
    });

    this.observedTables.set(table, observer);

    // Salvar o estado inicial imediatamente
    this.captureAndSaveSpecificQueue(table, key, name);
  }

  /**
   * Determina a chave e o nome da fila com base nos dados do elemento
   */
  private getQueueTypeAndName(table: HTMLTableElement): { key: string; name: string } {
    const id = table.id;
    const url = window.location.href;

    if (id === 'grid_transferencia_agenda' || url.includes('atendimentoTriagemAgenda.jsp')) {
      return { key: 'atendimento', name: 'Fila de Atendimento' };
    }

    if (id === 'grid_acolhimentos' || url.includes('acolhimento') || url.includes('agendamentoTriagem.jsp')) {
      return { key: 'acolhimento', name: 'Fila de Acolhimento' };
    }

    return { key: 'fila', name: 'Fila Geral' };
  }

  /**
   * Limpa e salva os dados da tabela no Chrome Storage
   */
  private async captureAndSaveSpecificQueue(table: HTMLTableElement, key: string, name: string) {
    if (table.rows.length <= 1) {
      return;
    }

    // Clonar a tabela para manipular e limpar o HTML
    const clone = table.cloneNode(true) as HTMLTableElement;
    
    // Remover colunas ou elementos interativos desnecessários se necessário
    const cacheKey = `queueCache_${key}`;
    const data = {
      html: clone.outerHTML,
      timestamp: Date.now(),
      name: name
    };

    await chrome.storage.local.set({ [cacheKey]: data });
    console.log(`SIGSS+: Fila "${name}" atualizada no cache local.`);
  }
}

