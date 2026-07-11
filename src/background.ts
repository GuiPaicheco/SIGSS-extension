// SIGSS+ Background Service Worker
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('SIGSS+ instalado com sucesso!');
    
    // Inicializar configurações padrão caso não existam
    chrome.storage.local.get(['refreshInterval', 'refreshOnlyActive', 'preventRefreshOnForm', 'sortDataSolicitacao'], (result) => {
      const defaults: Record<string, any> = {};
      if (result.refreshInterval === undefined) defaults.refreshInterval = 'disabled';
      if (result.refreshOnlyActive === undefined) defaults.refreshOnlyActive = true;
      if (result.preventRefreshOnForm === undefined) defaults.preventRefreshOnForm = true;
      if (result.sortDataSolicitacao === undefined) defaults.sortDataSolicitacao = true;
      
      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    });
  }
});

// Ouvir mensagens enviadas pelos scripts de conteúdo ou popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_offline_viewer') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('offline_viewer.html')
    });
  }
});

