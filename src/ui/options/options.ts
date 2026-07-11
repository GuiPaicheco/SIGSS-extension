import { ConfigManager, ConfigSchema } from '../../core/config';

/**
 * SIGSS+ - Controlador da Página de Opções
 * 
 * Gerencia a barra lateral, as tabelas de mapeamento, o auto-save de opções
 * e os processos de importação/exportação de backups de configurações.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Inicialização de Navegação da Barra Lateral
  setupNavigation();

  // Carregar e sincronizar campos de opções
  await setupOptionsForm();

  // Renderizar tabela de mapeamentos ESF
  await renderMappingsTable();

  // Configurar Ações de Backup
  setupBackupActions();

  // Configurar botão de abertura de cache offline
  const btnViewCache = document.getElementById('opt-btn-view-cache');
  if (btnViewCache) {
    btnViewCache.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('offline_viewer.html') });
    });
  }
});

/**
 * Gerencia a troca de abas/seções na barra lateral
 */
function setupNavigation() {
  const buttons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.content-section');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      // Atualizar classe active nos botões
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Exibir seção correspondente
      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.remove('hidden');
        } else {
          sec.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Sincroniza os controles da tela com as configurações salvas no Chrome Storage
 */
async function setupOptionsForm() {
  const selectInterval = document.getElementById('opt-interval') as HTMLSelectElement | null;
  const chkActiveOnly = document.getElementById('opt-active-only') as HTMLInputElement | null;
  const chkPreventForm = document.getElementById('opt-prevent-form') as HTMLInputElement | null;
  const chkSortDate = document.getElementById('opt-sort-date') as HTMLInputElement | null;

  if (!selectInterval || !chkActiveOnly || !chkPreventForm || !chkSortDate) {
    return;
  }

  // Carregar configurações locais
  const config = await ConfigManager.getAll();

  selectInterval.value = config.refreshInterval;
  chkActiveOnly.checked = config.refreshOnlyActive;
  chkPreventForm.checked = config.preventRefreshOnForm;
  chkSortDate.checked = config.sortDataSolicitacao;

  // Ouvintes de modificação (Salva na hora - auto-save)
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
 * Preenche a tabela com os mapeamentos ESF cadastrados pela extensão
 */
async function renderMappingsTable() {
  const tbody = document.getElementById('mappings-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const config = await ConfigManager.getAll();
  const mappings = config.esfMappings;
  const esfCodes = Object.keys(mappings);

  if (esfCodes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-mappings">
          Nenhum mapeamento de lançamento capturado pelo Modo Aprendizado ainda.<br>
          Os mapeamentos aparecem aqui automaticamente após você realizar um lançamento e clicar em "Capturar Configuração" dentro do SIGSS.
        </td>
      </tr>
    `;
    return;
  }

  // Ordenar de forma crescente para organização
  esfCodes.sort().forEach(esfCode => {
    const mapping = mappings[esfCode];
    const profDisplay = mapping.profissionalNome || `ID: ${mapping.profissionalId}`;
    const equipeDisplay = mapping.equipeNome || `ID: ${mapping.equipeId}`;
    const cboDisplay = mapping.cboNome || `ID: ${mapping.cboId}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esfCode}</strong></td>
      <td>${profDisplay}</td>
      <td>${equipeDisplay}</td>
      <td>${cboDisplay}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-delete-mapping" data-esf="${esfCode}">Excluir</button>
      </td>
    `;

    // Vincular exclusão
    const delBtn = tr.querySelector('.btn-delete-mapping');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        const targetEsf = (e.target as HTMLElement).getAttribute('data-esf');
        if (targetEsf) {
          if (confirm(`Tem certeza que deseja excluir o mapeamento da Equipe ESF ${targetEsf}?`)) {
            await ConfigManager.deleteEsfMapping(targetEsf);
            await renderMappingsTable();
          }
        }
      });
    }

    tbody.appendChild(tr);
  });
}

/**
 * Gerencia a lógica de backup (exportação e importação de JSON)
 */
function setupBackupActions() {
  const btnExport = document.getElementById('btn-export');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const inputImportFile = document.getElementById('input-import-file') as HTMLInputElement | null;
  const importStatus = document.getElementById('import-status');

  // Exportar Configurações
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const config = await ConfigManager.getAll();
      
      // Remover dados do cache do arquivo de exportação para otimizar tamanho e privacidade
      const exportData: Partial<ConfigSchema> = {
        refreshInterval: config.refreshInterval,
        refreshOnlyActive: config.refreshOnlyActive,
        preventRefreshOnForm: config.preventRefreshOnForm,
        sortDataSolicitacao: config.sortDataSolicitacao,
        esfMappings: config.esfMappings
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `sigss-plus-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Desencadear clique de seleção de arquivo
  if (btnTriggerImport && inputImportFile) {
    btnTriggerImport.addEventListener('click', () => {
      inputImportFile.value = ''; // Resetar valor para disparar change mesmo se for o mesmo arquivo
      inputImportFile.click();
    });
  }

  // Importar Configurações após arquivo ser selecionado
  if (inputImportFile && importStatus) {
    inputImportFile.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);

          // Validação básica do arquivo de backup
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Formato de arquivo inválido.');
          }

          // Montar dados para atualização
          const updateData: Partial<ConfigSchema> = {};
          
          if (parsed.refreshInterval !== undefined) updateData.refreshInterval = String(parsed.refreshInterval);
          if (parsed.refreshOnlyActive !== undefined) updateData.refreshOnlyActive = Boolean(parsed.refreshOnlyActive);
          if (parsed.preventRefreshOnForm !== undefined) updateData.preventRefreshOnForm = Boolean(parsed.preventRefreshOnForm);
          if (parsed.sortDataSolicitacao !== undefined) updateData.sortDataSolicitacao = Boolean(parsed.sortDataSolicitacao);
          if (parsed.esfMappings !== undefined && typeof parsed.esfMappings === 'object') {
            updateData.esfMappings = parsed.esfMappings;
          }

          if (Object.keys(updateData).length === 0) {
            throw new Error('Nenhuma configuração válida encontrada no arquivo.');
          }

          // Persistir no storage local
          await ConfigManager.set(updateData);

          // Feedback visual de sucesso
          importStatus.textContent = '✓ Configurações importadas com sucesso!';
          importStatus.className = 'status-msg status-success';

          // Atualizar views
          await setupOptionsForm();
          await renderMappingsTable();

          setTimeout(() => {
            importStatus.textContent = '';
          }, 4000);

        } catch (err: any) {
          importStatus.textContent = `❌ Falha ao importar: ${err.message || 'Erro de leitura de JSON.'}`;
          importStatus.className = 'status-msg status-error';
        }
      };

      reader.readAsText(file);
    });
  }
}
