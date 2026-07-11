interface CacheData {
  html: string;
  timestamp: number;
  name: string;
}

/**
 * SIGSS+ - Controlador do Visualizador Offline
 * 
 * Recupera as tabelas salvas em caches segregados e renderiza em formato de abas.
 */
document.addEventListener('DOMContentLoaded', () => {
  const cacheTimestampEl = document.getElementById('cache-timestamp');
  const tableContainerEl = document.getElementById('table-container');
  const noCacheMessageEl = document.getElementById('no-cache-message');
  const btnClose = document.getElementById('btn-close');
  const tabButtons = document.querySelectorAll('.tab-btn');

  let activeTab = 'atendimento';
  let caches: Record<string, CacheData | null> = {
    atendimento: null,
    acolhimento: null,
    fila: null
  };

  // Ação de fechar aba
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      window.close();
    });
  }

  // Carrega e renderiza o cache da aba selecionada
  const renderTab = (tabKey: string) => {
    const cache = caches[tabKey];

    if (!cache || !cache.html) {
      if (noCacheMessageEl) noCacheMessageEl.classList.remove('hidden');
      if (tableContainerEl) tableContainerEl.classList.add('hidden');
      if (cacheTimestampEl) cacheTimestampEl.textContent = 'Sem dados em cache para esta aba.';
      return;
    }

    if (noCacheMessageEl) noCacheMessageEl.classList.add('hidden');
    if (tableContainerEl) tableContainerEl.classList.remove('hidden');

    // Exibir carimbo de data/hora formatado
    if (cacheTimestampEl) {
      const date = new Date(cache.timestamp);
      const formattedDate = date.toLocaleDateString('pt-BR');
      const formattedTime = date.toLocaleTimeString('pt-BR');
      cacheTimestampEl.textContent = `${cache.name || 'Fila'} salva em ${formattedDate} às ${formattedTime}`;
    }

    // Injetar HTML da tabela no container
    if (tableContainerEl) {
      tableContainerEl.innerHTML = cache.html;

      // Garantir que todos os links <a> ou botões sejam neutralizados
      const elements = tableContainerEl.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      elements.forEach(el => {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
    }
  };

  // Carregar caches do storage local
  const loadCaches = () => {
    chrome.storage.local.get([
      'queueCache_atendimento',
      'queueCache_acolhimento',
      'queueCache_fila'
    ], (items) => {
      caches.atendimento = items.queueCache_atendimento || null;
      caches.acolhimento = items.queueCache_acolhimento || null;
      caches.fila = items.queueCache_fila || null;

      // Renderizar aba ativa inicial
      renderTab(activeTab);
    });
  };

  // Eventos de clique nas abas
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const tabKey = target.getAttribute('data-tab') || 'atendimento';

      // Atualizar classe ativa nas abas
      tabButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');

      activeTab = tabKey;
      renderTab(activeTab);
    });
  });

  // Inicializar carregamento
  loadCaches();
});

