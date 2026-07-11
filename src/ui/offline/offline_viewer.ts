import { ConfigManager } from '../../core/config';

/**
 * SIGSS+ - Controlador do Visualizador Offline
 * 
 * Recupera a tabela salva no storage e renderiza para o usuário em formato de consulta.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const cacheTimestampEl = document.getElementById('cache-timestamp');
  const tableContainerEl = document.getElementById('table-container');
  const noCacheMessageEl = document.getElementById('no-cache-message');
  const btnClose = document.getElementById('btn-close');

  // Configurar ação de fechar aba
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      window.close();
    });
  }

  // Carregar dados salvos em cache
  try {
    const config = await ConfigManager.getAll();
    const cache = config.lastQueueCache;

    if (!cache || !cache.html) {
      // Exibir aviso de falta de cache
      if (noCacheMessageEl) noCacheMessageEl.classList.remove('hidden');
      if (tableContainerEl) tableContainerEl.classList.add('hidden');
      if (cacheTimestampEl) cacheTimestampEl.textContent = 'Sem dados em cache local.';
      return;
    }

    // Exibir carimbo de data/hora formatado
    if (cacheTimestampEl) {
      const date = new Date(cache.timestamp);
      const formattedDate = date.toLocaleDateString('pt-BR');
      const formattedTime = date.toLocaleTimeString('pt-BR');
      cacheTimestampEl.textContent = `Fila salva em ${formattedDate} às ${formattedTime}`;
    }

    // Injetar HTML da tabela no container
    if (tableContainerEl) {
      tableContainerEl.innerHTML = cache.html;

      // Garantir que todos os links <a> ou botões dentro da tabela sejam desativados para cliques reais
      const links = tableContainerEl.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      links.forEach(el => {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
    }

  } catch (error) {
    console.error('Erro ao carregar cache offline:', error);
    if (cacheTimestampEl) cacheTimestampEl.textContent = 'Erro ao carregar cache local.';
  }
});
