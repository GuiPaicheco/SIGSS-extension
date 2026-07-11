import { ConfigManager } from '../../core/config';

/**
 * SIGSS+ - Controlador da Popup
 * 
 * Vincula os controles HTML com a API de armazenamento e gerencia
 * a interface do usuário (abas, exclusão de mapeamentos e abertura do cache).
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Inicialização de Abas
  setupTabs();

  // Carregar e salvar configurações de atualização automática
  await setupSettings();

  // Carregar e renderizar os mapeamentos aprendidos
  await renderMappingsList();

  // Configurar botão de abertura do cache offline
  const btnViewCache = document.getElementById('btn-view-cache');
  if (btnViewCache) {
    btnViewCache.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('offline_viewer.html')
      });
    });
  }
});

/**
 * Controla a navegação por abas na Popup
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Alternar classe active nos botões
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Alternar visibilidade dos painéis
      panels.forEach(panel => {
        if (panel.id === targetTab) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Carrega as opções do storage e configura os listeners de alteração automática
 */
async function setupSettings() {
  const selectInterval = document.getElementById('select-interval') as HTMLSelectElement | null;
  const chkActiveOnly = document.getElementById('chk-active-only') as HTMLInputElement | null;
  const chkPreventForm = document.getElementById('chk-prevent-form') as HTMLInputElement | null;
  const chkSortDate = document.getElementById('chk-sort-date') as HTMLInputElement | null;

  if (!selectInterval || !chkActiveOnly || !chkPreventForm || !chkSortDate) {
    return;
  }

  // Carregar dados salvos
  const config = await ConfigManager.getAll();

  selectInterval.value = config.refreshInterval;
  chkActiveOnly.checked = config.refreshOnlyActive;
  chkPreventForm.checked = config.preventRefreshOnForm;
  chkSortDate.checked = config.sortDataSolicitacao;

  // Registrar listeners para salvar imediatamente em caso de alteração (auto-save)
  selectInterval.addEventListener('change', async () => {
    await ConfigManager.set({ refreshInterval: selectInterval.value });
  });

  chkActiveOnly.addEventListener('change', async () => {
    await ConfigManager.set({ refreshOnlyActive: chkActiveOnly.checked });
  });

  chkPreventForm.addEventListener('change', async () => {
    await ConfigManager.set({ preventRefreshOnForm: chkPreventForm.checked });
  });

  chkSortDate.addEventListener('change', async () => {
    await ConfigManager.set({ sortDataSolicitacao: chkSortDate.checked });
  });
}

/**
 * Carrega a lista de mapeamentos e renderiza na segunda aba
 */
async function renderMappingsList() {
  const container = document.getElementById('mappings-list-container');
  if (!container) return;

  container.innerHTML = '';

  const config = await ConfigManager.getAll();
  const mappings = config.esfMappings;
  const esfCodes = Object.keys(mappings);

  if (esfCodes.length === 0) {
    container.innerHTML = `
      <div class="no-mappings">
        Nenhum mapeamento de lançamento capturado.<br><br>
        Preencha um lançamento manual no SIGSS e clique em <strong>"Capturar Configuração"</strong> para salvar um novo padrão de equipe.
      </div>
    `;
    return;
  }

  // Ordenar equipes ESF numericamente para facilitar visualização
  esfCodes.sort().forEach(esfCode => {
    const mapping = mappings[esfCode];
    
    // Obter nomes limpos para exibição (removendo códigos extras ou id se o nome já contiver)
    const profNome = mapping.profissionalNome || `Profissional ${mapping.profissionalId}`;
    const equipeNome = mapping.equipeNome || `Equipe ${mapping.equipeId}`;
    const cboNome = mapping.cboNome || `CBO ${mapping.cboId}`;

    const item = document.createElement('div');
    item.className = 'mapping-item';
    item.innerHTML = `
      <div class="mapping-item-details">
        <span class="mapping-item-title">Equipe ESF: ${esfCode}</span>
        <span class="mapping-item-sub" title="Profissional: ${profNome}\nEquipe: ${equipeNome}\nCBO: ${cboNome}">
          ${profNome.split(' - ')[0]} / ${equipeNome.split(' - ')[0]} / ${cboNome.split(' - ')[0]}
        </span>
      </div>
      <button class="mapping-item-delete" data-esf="${esfCode}" title="Excluir mapeamento">&times;</button>
    `;

    // Vincular clique do botão de exclusão
    const deleteBtn = item.querySelector('.mapping-item-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        const targetEsf = (e.target as HTMLElement).getAttribute('data-esf');
        if (targetEsf) {
          if (confirm(`Excluir o preenchimento automático para a Equipe ESF ${targetEsf}?`)) {
            await ConfigManager.deleteEsfMapping(targetEsf);
            await renderMappingsList();
          }
        }
      });
    }

    container.appendChild(item);
  });
}
