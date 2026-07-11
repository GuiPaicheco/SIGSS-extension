document.addEventListener('DOMContentLoaded', () => {
  const btnAccess = document.getElementById('btn-access');
  const chkEnabled = document.getElementById('chk-enabled') as HTMLInputElement | null;
  const lblStatus = document.getElementById('lbl-status');
  const statusBadge = document.querySelector('.status-badge') as HTMLElement | null;

  // 1. Redirecionamento de Acesso ao SIGSS
  if (btnAccess) {
    btnAccess.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'http://sigss.betim.mg.gov.br/sigss/'
      });
    });
  }

  // 2. Carregar o estado atual (habilitado/desabilitado)
  chrome.storage.local.get({ extensionEnabled: true }, (items) => {
    if (chkEnabled) {
      chkEnabled.checked = items.extensionEnabled;
      updateUIState(items.extensionEnabled);
    }
  });

  // 3. Ouvir alterações no interruptor
  if (chkEnabled) {
    chkEnabled.addEventListener('change', () => {
      const enabled = chkEnabled.checked;
      chrome.storage.local.set({ extensionEnabled: enabled });
      updateUIState(enabled);
    });
  }

  function updateUIState(enabled: boolean) {
    if (lblStatus) {
      lblStatus.textContent = enabled ? 'Extensão Ativa' : 'Extensão Inativa';
    }
    if (statusBadge) {
      if (enabled) {
        statusBadge.textContent = '✓ EXTENSÃO ATIVA';
        statusBadge.style.backgroundColor = '#c6f6d5';
        statusBadge.style.color = '#22543d';
      } else {
        statusBadge.textContent = '✗ EXTENSÃO DESATIVADA';
        statusBadge.style.backgroundColor = '#fed7d7';
        statusBadge.style.color = '#742a2a';
      }
    }
  }
});

