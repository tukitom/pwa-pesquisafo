if ('serviceWorker' in navigator) {
  // Guarda se já havia um Service Worker a controlar a página quando esta
  // abriu — assim distinguimos "primeira instalação" de "atualização real".
  let controladorInicial = navigator.serviceWorker.controller;
  let avisoJaMostrado = false;

  window.addEventListener('load', () => {
    // updateViaCache: 'none' garante que o navegador nunca usa uma cópia em
    // cache HTTP do próprio service-worker.js — sem isto, pode continuar a
    // achar que estamos na versão antiga mesmo depois de a teres substituído
    // no GitHub, porque está a comparar contra um ficheiro desatualizado.
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).then(reg => {
      // Verifica logo ao abrir a app — o "visibilitychange" só dispara em
      // mudanças de estado (esconder/mostrar), nunca na primeira abertura.
      reg.update().catch(() => {});

      // E também sempre que a app volta a ficar em primeiro plano.
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
