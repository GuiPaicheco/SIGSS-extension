import { SigssAdapter } from '../../utils/sigssAdapter';
import { ConfigManager } from '../../core/config';

/**
 * MÓDULO 3 - Cache Local
 * 
 * Captura e armazena localmente a última fila visualizada com sucesso.
 * Monitora a disponibilidade do sistema para alertar o usuário e disponibiliza
 * um banner para visualizar o cache em caso de indisponibilidade do portal SIGSS.
 */
export class QueueCacheModule {
  private tableObserver: MutationObserver | null = null;
  private debounceTimeoutId: number | null = null;

  public start() {
    this.checkSystemAvailability();
    
    // Captura inicial caso a página já tenha carregado com dados
    this.captureAndSaveQueue();
    
    // Inicia o monitoramento da tabela de fila para atualizações
    this.setupTableObserver();
  }

  public stop() {
    if (this.tableObserver) {
      this.tableObserver.disconnect();
      this.tableObserver = null;
    }
    if (this.debounceTimeoutId !== null) {
      window.clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }
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
    
    // Estilos do banner sóbrios e integrados
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

    // Inserir no topo da página
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
   * Captura o HTML da tabela atual e salva no Chrome Storage local
   */
  private captureAndSaveQueue() {
    const tableHTML = SigssAdapter.getQueueTableHTML();
    if (!tableHTML) {
      return;
    }

    // Não salvar se a tabela estiver visivelmente vazia de dados relevantes 
    // (ex: apenas o cabeçalho sem nenhuma linha de conteúdo)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHTML;
    const rows = tempDiv.querySelectorAll('tr');
    
    // Geralmente th ocupa 1 linha, se tiver <= 1 linha no total, está vazia
    if (rows.length <= 1) {
      return;
    }

    ConfigManager.set({
      lastQueueCache: {
        html: tableHTML,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Escuta alterações no DOM da tabela da fila para capturar o cache atualizado
   */
  private setupTableObserver() {
    const table = document.querySelector('.gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table');
    if (!table) return;

    if (this.tableObserver) {
      this.tableObserver.disconnect();
    }

    this.tableObserver = new MutationObserver(() => {
      if (this.debounceTimeoutId !== null) {
        window.clearTimeout(this.debounceTimeoutId);
      }

      // Debounce de 1 segundo para aguardar que a renderização da tabela termine 
      // antes de extrair o HTML
      this.debounceTimeoutId = window.setTimeout(() => {
        this.captureAndSaveQueue();
      }, 1000);
    });

    this.tableObserver.observe(table, {
      childList: true,
      subtree: true
    });
  }
}
