document.addEventListener('DOMContentLoaded', () => {
  const btnOffline = document.getElementById('btn-offline');
  if (btnOffline) {
    btnOffline.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('offline_viewer.html')
      });
    });
  }
});

