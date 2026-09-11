const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const {chromium}=require('C:/Users/TukitoPT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  let phase='legacy';
  const legacyRegister=fs.readFileSync('C:/Users/TukitoPT/Downloads/ABDM/Compressed/pwa-pesquisafo-main/pwa-pesquisafo-main/sw-register.js','utf8');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'};
    res.setHeader('Content-Type',types[path.extname(pathname)]||'text/html');res.setHeader('Cache-Control','no-store');
    if(pathname==='/service-worker.js')return res.end(phase==='legacy'?"self.addEventListener('install',e=>e.waitUntil(caches.open('pesquisafo-v18').then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));":fs.readFileSync(__dirname+'/service-worker.js','utf8').replace("VERSION='22'",`VERSION='${phase==='next'?'23':'22'}'`));
    if(phase==='legacy'&&pathname==='/sw-register.js')return res.end(legacyRegister);
    if(phase==='legacy'&&(pathname==='/'||pathname==='/app.html'))return res.end('<!doctype html><html><body><h1>Legacy v18</h1><script src="sw-register.js"></script></body></html>');
    const file=path.join(__dirname,pathname==='/'?'index.html':pathname);fs.readFile(file,(e,b)=>{if(e){res.statusCode=404;res.end();}else res.end(b);});
  });await new Promise(r=>server.listen(8766,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return orig.call(this,type,...args);};});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8766/app.html');await page.waitForFunction(()=>navigator.serviceWorker.controller);
    phase='current';await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
    await page.locator('#pwaUpdateBtn').waitFor();await page.locator('#pwaUpdateBtn').click();await page.waitForFunction(()=>document.querySelector('.pwa-status')?.textContent.includes('22 · pronta offline'));
    phase='next';await page.getByRole('button',{name:'Verificar atualização'}).click();await page.locator('#pwaUpdateBtn').waitFor();await page.locator('#pwaUpdateBtn').click();await page.waitForFunction(()=>document.querySelector('.pwa-status')?.textContent.includes('23 · pronta offline'));
    await context.setOffline(true);await page.goto('http://127.0.0.1:8766/mapa.html');await page.waitForFunction(()=>document.getElementById('offlineMapStatus').textContent.includes('guardada'));
    assert(await page.locator('.leaflet-overlay-pane path').count()>100);assert(await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count()>0);
    await page.locator('#searchInput').fill('PDO1');await page.locator('#btnSearch').click();await page.locator('.leaflet-popup').waitFor();await page.locator('.leaflet-popup-close-button').click();await page.locator('#map').screenshot({path:__dirname+'/offline-map-check.png'});
    await page.goto('http://127.0.0.1:8766/calculadora.html');const download=page.waitForEvent('download');await page.locator('#btnPDF').click();await(await download).saveAs(__dirname+'/Tabela_Fibras_Verificacao.pdf');
    assert.deepEqual(errors,[]);console.log('PASS: v18 migration, v22→v23 update, offline map geometry and markers with WebGL disabled, map search/popup, offline vector PDF.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
