import { SigssAdapter } from '../utils/sigssAdapter';
import { ClockModule } from '../modules/clock/clock';
import { AutoRefreshModule } from '../modules/autoRefresh/autoRefresh';
import { QueueCacheModule } from '../modules/queueCache/queueCache';
import { AutoAssignmentModule } from '../modules/autoAssignment/autoAssignment';
import { UnifiedQueueModule } from '../modules/unifiedQueue/unifiedQueue';
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
  private unifiedQueueModule = new UnifiedQueueModule();

  private currentPage: 'QUEUE' | 'LAUNCH' | 'UNKNOWN' = 'UNKNOWN';
  private isRunning = false;

  constructor() {
    // Ouvir alterações globais de ativação em tempo real
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.extensionEnabled) {
        const enabled = changes.extensionEnabled.newValue;
        console.log(`SIGSS+: Estado ativo alterado para: ${enabled}`);
        if (enabled) {
          await this.init();
        } else {
          this.stop();
        }
      }
    });
  }

  public async init() {
    const items = await chrome.storage.local.get({ extensionEnabled: true });
    if (!items.extensionEnabled) {
      this.stop();
      return;
    }

    if (this.isRunning) return;
    this.isRunning = true;

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
        this.unifiedQueueModule.start();
        console.log('SIGSS+: Módulos de Fila (Atualização Automática e Fila Unificada) iniciados.');
        break;
      case 'LAUNCH':
        await this.autoAssignmentModule.start();
        this.unifiedQueueModule.start();
        console.log('SIGSS+: Módulo de Lançamento Automático e Painel Lateral iniciados.');
        break;
      default:
        console.log('SIGSS+: Nenhuma página de automação específica detectada.');
        break;
    }

    // Registrar observador de mudanças nas configurações para refletir imediatamente
    this.setupConfigListener();
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    console.log('SIGSS+: Desativando todos os módulos ativos do SIGSS+...');
    this.clockModule.stop();
    this.autoRefreshModule.stop();
    this.queueCacheModule.stop();
    this.autoAssignmentModule.stop();
    this.unifiedQueueModule.stop();
  }

  /**
   * Monitora alterações de configuração enviadas via popup ou opções.
   * Reinicia módulos relacionados em tempo real sem precisar recarregar a página.
   */
  private setupConfigListener() {
    ConfigManager.onChange(async (changes) => {
      if (!this.isRunning) return;

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
