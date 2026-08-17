if ('serviceWorker' in navigator) {
  // Guarda se já havia um Service Worker a controlar a página quando esta
  // abriu — assim distinguimos "primeira instalação" de "atualização real".
  let controladorInicial = navigator.serviceWorker.controller;
  let avisoJaMostrado = false;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      // Sempre que a app volta a ficar em primeiro plano (ex: o utilizador
      // reabre-a), verifica em segundo plano se há uma versão nova no
      // GitHub — sem isto, só verificaria de vez em quando por conta do
      // navegador (normalmente uma vez por dia).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controladorInicial) {
      // Esta foi a primeira instalação da app neste dispositivo, não uma atualização.
      controladorInicial = navigator.serviceWorker.controller;
      return;
    }
    if (avisoJaMostrado) return;
    avisoJaMostrado = true;
    mostrarAvisoNovaVersao();
  });
}

function mostrarAvisoNovaVersao() {
  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.innerHTML = `
    <span>🔄 Há uma nova versão da app disponível</span>
    <button id="pwaUpdateBtn">Atualizar</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
    window.location.reload();
  });
}
