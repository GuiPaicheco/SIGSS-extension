import { SigssAdapter } from '../utils/sigssAdapter';
import { ClockModule } from '../modules/clock/clock';
import { AutoRefreshModule } from '../modules/autoRefresh/autoRefresh';
import { QueueCacheModule } from '../modules/queueCache/queueCache';
import { AutoAssignmentModule } from '../modules/autoAssignment/autoAssignment';
import { ConfigManager } from './config';

/**
 * SIGSS+ - Orquestrador Principal (Content Script)
 * 
 * Ponto de entrada executado em cada página do SIGSS. Detecta a tela atual,
 * carrega as configurações locais, instancia e inicializa os respectivos
 * módulos. Também gerencia a escuta de mudanças de configurações em tempo real.
 */
class SIGSSPlusCore {
  private clockModule = new ClockModule();
  private autoRefreshModule = new AutoRefreshModule();
  private queueCacheModule = new QueueCacheModule();
  private autoAssignmentModule = new AutoAssignmentModule();

  private currentPage: 'QUEUE' | 'LAUNCH' | 'UNKNOWN' = 'UNKNOWN';

  public async init() {
    console.log('SIGSS+: Inicializando extensão...');

    // O relógio é iniciado em qualquer página que possua o elemento de cabeçalho
    if (SigssAdapter.getClockElement()) {
      this.clockModule.start();
      console.log('SIGSS+: Módulo de Relógio sincronizado.');
    }

    // Módulo de cache de filas é iniciado em 100% do tempo em qualquer tela
    this.queueCacheModule.start();

    // Detectar página atual e inicializar módulos específicos
    this.currentPage = SigssAdapter.detectCurrentPage();
    console.log(`SIGSS+: Página atual detectada: ${this.currentPage}`);

    switch (this.currentPage) {
      case 'QUEUE':
        await this.autoRefreshModule.start();
        console.log('SIGSS+: Módulo de Fila (Atualização Automática) iniciado.');
        break;
      case 'LAUNCH':
        await this.autoAssignmentModule.start();
        console.log('SIGSS+: Módulo de Lançamento Automático iniciado.');
        break;
      default:
        console.log('SIGSS+: Nenhuma página de automação específica detectada.');
        break;
    }


    // Registrar observador de mudanças nas configurações para refletir imediatamente
    this.setupConfigListener();
  }

  /**
   * Monitora alterações de configuração enviadas via popup ou opções.
   * Reinicia módulos relacionados em tempo real sem precisar recarregar a página.
   */
  private setupConfigListener() {
    ConfigManager.onChange(async (changes) => {
      // Se alterou alguma opção de atualização
      const hasRefreshChanges = 
        changes.refreshInterval || 
        changes.refreshOnlyActive || 
        changes.preventRefreshOnForm || 
        changes.sortDataSolicitacao;

      if (hasRefreshChanges && this.currentPage === 'QUEUE') {
        console.log('SIGSS+: Configurações de atualização alteradas. Reiniciando módulo...');
        await this.autoRefreshModule.start();
      }
    });
  }
}

// Executar a extensão assim que o script for injetado
const core = new SIGSSPlusCore();
core.init().catch(err => {
  console.error('Erro na inicialização do SIGSS+ Core:', err);
});
