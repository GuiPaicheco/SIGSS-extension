"use strict";
(() => {
  // src/ui/offline/offline_viewer.ts
  document.addEventListener("DOMContentLoaded", () => {
    const cacheTimestampEl = document.getElementById("cache-timestamp");
    const tableContainerEl = document.getElementById("table-container");
    const noCacheMessageEl = document.getElementById("no-cache-message");
    const btnClose = document.getElementById("btn-close");
    const tabButtons = document.querySelectorAll(".tab-btn");
    let activeTab = "atendimento";
    let caches = {
      atendimento: null,
      acolhimento: null,
      fila: null,
      unified: null
    };
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        window.close();
      });
    }
    const renderTab = (tabKey) => {
      const cache = caches[tabKey];
      if (!cache || !cache.html && !cache.patients) {
        if (noCacheMessageEl) noCacheMessageEl.classList.remove("hidden");
        if (tableContainerEl) tableContainerEl.classList.add("hidden");
        if (cacheTimestampEl) cacheTimestampEl.textContent = "Sem dados em cache para esta aba.";
        return;
      }
      if (noCacheMessageEl) noCacheMessageEl.classList.add("hidden");
      if (tableContainerEl) tableContainerEl.classList.remove("hidden");
      if (cacheTimestampEl) {
        const date = new Date(cache.timestamp);
        const formattedDate = date.toLocaleDateString("pt-BR");
        const formattedTime = date.toLocaleTimeString("pt-BR");
        cacheTimestampEl.textContent = `${cache.name || "Fila"} salva em ${formattedDate} \xE0s ${formattedTime}`;
      }
      if (tableContainerEl) {
        if (tabKey === "unified") {
          const patientsList = cache.patients || [];
          if (patientsList.length === 0) {
            if (noCacheMessageEl) noCacheMessageEl.classList.remove("hidden");
            tableContainerEl.classList.add("hidden");
            return;
          }
          const sorted = [...patientsList];
          sorted.sort((a, b) => a.hora.localeCompare(b.hora));
          let rowsHtml = "";
          sorted.forEach((p) => {
            rowsHtml += `
            <tr>
              <td style="text-align: center;">
                <span class="uq-badge-risco ${p.riscoClass}">${p.riscoText}</span>
              </td>
              <td style="font-weight: bold; color: #2d3748;">${p.hora}</td>
              <td style="font-weight: bold; color: #1a202c;">${p.pacienteNome}</td>
              <td class="col-prioridade">${p.prioridade || "-"}</td>
              <td>${p.idade}</td>
              <td style="text-align: center;">
                <span class="uq-badge-prep preparado-${p.isPreparado}" title="${p.preparado || "N\xE3o preparado"}"></span>
              </td>
              <td style="font-weight: bold; color: #1a365d;">${p.profissional}</td>
            </tr>
          `;
          });
          tableContainerEl.innerHTML = `
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">Risco</th>
                <th style="width: 60px;">Hora</th>
                <th>Usu\xE1rio(a) do Servi\xE7o</th>
                <th style="width: 150px;">Prioridade</th>
                <th style="width: 180px;">Idade</th>
                <th style="width: 80px; text-align: center;">Preparado(a)</th>
                <th style="width: 160px;">Profissional</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
        } else {
          tableContainerEl.innerHTML = cache.html;
          const elements = tableContainerEl.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
          elements.forEach((el) => {
            el.setAttribute("tabindex", "-1");
            el.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
            });
          });
        }
      }
    };
    const loadCaches = () => {
      chrome.storage.local.get([
        "queueCache_atendimento",
        "queueCache_acolhimento",
        "queueCache_fila",
        "queueCache_unified"
      ], (items) => {
        caches.atendimento = items.queueCache_atendimento || null;
        caches.acolhimento = items.queueCache_acolhimento || null;
        caches.fila = items.queueCache_fila || null;
        caches.unified = items.queueCache_unified || null;
        renderTab(activeTab);
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const tabKey = target.getAttribute("data-tab") || "atendimento";
        tabButtons.forEach((b) => b.classList.remove("active"));
        target.classList.add("active");
        activeTab = tabKey;
        renderTab(activeTab);
      });
    });
    loadCaches();
  });
})();
//# sourceMappingURL=offline_viewer.js.map
