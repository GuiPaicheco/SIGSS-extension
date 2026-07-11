import { SigssAdapter } from '../../utils/sigssAdapter';
import { ConfigManager } from '../../core/config';

/**
 * MÓDULO 2 - Atualização Automática
 * 
 * Permite a atualização periódica da fila de trabalho através do clique
 * simulado no botão "Buscar". Inclui verificações de segurança como tab ativa,
 * formulário em preenchimento e manutenção automática de ordenação da tabela.
 */
export class AutoRefreshModule {
  private timerId: number | null = null;
  private tableObserver: MutationObserver | null = null;

  public async start() {
    this.stop();

    const config = await ConfigManager.getAll();
    const intervalStr = config.refreshInterval;

    // Se estiver desativado, não inicia o temporizador
    if (intervalStr === 'disabled') {
      return;
    }

    const seconds = parseInt(intervalStr, 10);
    if (isNaN(seconds) || seconds <= 0) {
      return;
    }

    // Agenda a atualização a cada X segundos
    this.timerId = window.setInterval(async () => {
      await this.executeRefreshCycle();
    }, seconds * 1000);

    // Se ordenação automática por Data de Solicitação estiver configurada, aplica
    if (config.sortDataSolicitacao) {
      this.applySorting();
      this.setupSortingObserver();
    }
  }

  public stop() {
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
  private async executeRefreshCycle() {
    const config = await ConfigManager.getAll();

    // 1. Não atualizar se a aba não estiver visível (e a opção estiver ativa)
    if (config.refreshOnlyActive && document.visibilityState !== 'visible') {
      return;
    }

    // 2. Não atualizar se houver formulário sendo editado
    if (config.preventRefreshOnForm && SigssAdapter.isFormBeingFilled()) {
      return;
    }

    // 3. Executar o clique no botão Buscar
    const searchBtn = SigssAdapter.getSearchButton();
    if (searchBtn) {
      searchBtn.click();
    }
  }

  /**
   * Tenta localizar e clicar na coluna 'Data Solicitação' para manter a ordenação
   */
  private applySorting() {
    const table = document.querySelector('.gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] as HTMLElement;
      const text = header.textContent?.trim().toLowerCase() || '';
      
      if (text.includes('data solicitação') || text.includes('data solic') || text.includes('dta solic')) {
        // Verificar se já está ordenada
        // Evita clicar repetidamente se houver setas como ▲, ▼, ícones de ordenação ou classes específicas
        const alreadySorted = header.classList.contains('sorted') || 
                              header.className.includes('sort-') ||
                              header.innerHTML.includes('▲') || 
                              header.innerHTML.includes('▼') ||
                              header.innerHTML.includes('arrow');

        if (!alreadySorted) {
          // Desconectar o observador temporariamente para evitar loops recursivos no clique
          if (this.tableObserver) this.tableObserver.disconnect();
          
          header.click();
          
          // Reconectar o observador
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
  private setupSortingObserver() {
    const table = document.querySelector('.gridFila, #tabelaFila, #gridSolicitacoes, table.grid, .tabela-dados table');
    if (!table) return;

    if (this.tableObserver) {
      this.tableObserver.disconnect();
    }

    this.tableObserver = new MutationObserver(() => {
      // Pequeno timeout para dar tempo da tabela renderizar seus novos cabeçalhos/conteúdos
      setTimeout(() => {
        this.applySorting();
      }, 50);
    });

    this.tableObserver.observe(table, {
      childList: true,
      subtree: true
    });
  }
}
