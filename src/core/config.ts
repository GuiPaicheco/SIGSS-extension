/**
 * SIGSS+ - Gerenciador de Configurações
 * 
 * Gerencia a leitura e escrita local utilizando a Storage API do Chrome.
 */

export interface EsfMapping {
  profissionalId: string;
  equipeId: string;
  cboId: string;
  // Para fins de exibição visual na listagem da popup
  profissionalNome?: string;
  equipeNome?: string;
  cboNome?: string;
}

export interface ConfigSchema {
  refreshInterval: string; // 'disabled' | '5' | '10' | '15' | '20' | '30' | '60'
  refreshOnlyActive: boolean;
  preventRefreshOnForm: boolean;
  sortDataSolicitacao: boolean;
  esfMappings: Record<string, EsfMapping>; // Chave: Código ESF (ex: "086")
  lastQueueCache: {
    html: string;
    timestamp: number;
  } | null;
}

const DEFAULT_CONFIG: ConfigSchema = {
  refreshInterval: 'disabled',
  refreshOnlyActive: true,
  preventRefreshOnForm: true,
  sortDataSolicitacao: true,
  esfMappings: {},
  lastQueueCache: null
};

export class ConfigManager {
  
  /**
   * Obtém todas as configurações
   */
  static async getAll(): Promise<ConfigSchema> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        resolve({
          ...DEFAULT_CONFIG,
          ...items
        } as ConfigSchema);
      });
    });
  }

  /**
   * Salva configurações genéricas
   */
  static async set(settings: Partial<ConfigSchema>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    });
  }

  /**
   * Salva um mapeamento de ESF específico
   */
  static async saveEsfMapping(esfCode: string, mapping: EsfMapping): Promise<void> {
    const config = await this.getAll();
    const esfMappings = { ...config.esfMappings };
    esfMappings[esfCode] = mapping;
    await this.set({ esfMappings });
  }

  /**
   * Remove um mapeamento de ESF específico
   */
  static async deleteEsfMapping(esfCode: string): Promise<void> {
    const config = await this.getAll();
    const esfMappings = { ...config.esfMappings };
    delete esfMappings[esfCode];
    await this.set({ esfMappings });
  }

  /**
   * Registra um listener para quando as configurações forem alteradas em tempo real
   */
  static onChange(callback: (changes: chrome.storage.StorageChange, areaName: string) => void) {
    chrome.storage.onChanged.addListener(callback);
  }
}
