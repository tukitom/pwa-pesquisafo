(() => {
  const path = location.pathname.split('/').pop() || 'index.html';
  const icon = paths => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const pages = [['app.html','Pesquisa',icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')],['mapa.html','Mapa',icon('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>')],['calculadora.html','Cores',icon('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>')],['comparar.html','Comparar',icon('<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>')]];
  const header = document.querySelector('header');
  if (header) header.innerHTML = `<a class="brand" href="app.html"><span class="brand-mark">FO</span><span>FO Açores<small>Consulta de rede</small></span></a><div class="header-tools"><span id="network-status"></span><button id="theme-toggle" aria-label="Alternar tema">Tema claro</button></div><nav aria-label="Navegação principal">${pages.map(([url,label,icon])=>`<a href="${url}" ${path===url?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('')}</nav>`;
  const theme = document.getElementById('theme-toggle');
  function applyTheme(value) { document.documentElement.dataset.theme=value; document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='light'?'#edf3f7':'#101820'); if(theme) { theme.textContent=value==='light'?'Tema escuro':'Tema claro';theme.setAttribute('aria-label',`Ativar ${theme.textContent.toLowerCase()}`); } }
  try { applyTheme(localStorage.getItem('fo_theme') || 'dark'); } catch {}
  theme?.addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='light'?'dark':'light';applyTheme(value);try{localStorage.setItem('fo_theme',value);}catch{}});
  function network(){const el=document.getElementById('network-status');if(el)el.textContent=navigator.onLine?'Com ligação':'Sem ligação';}
  window.addEventListener('online',network);window.addEventListener('offline',network);network();
  document.addEventListener('DOMContentLoaded',()=>{const main=document.querySelector('main')||document.getElementById('app');if(main){main.id=main.id||'main-content';const link=document.createElement('a');link.className='skip-link';link.href='#'+main.id;link.textContent='Saltar para o conteúdo';document.body.prepend(link);}});
})();
