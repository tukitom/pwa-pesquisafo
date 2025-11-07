const DISPLAY_NAMES = {
  id_servico: "ID do Serviço",
  sro_nome: "SRO",
  sro_splitter: "Splitter No SRO",
  sro_secundario_pt: "OUT SRO",
  pdo_nome: "PDO",
  pdo_ptfo: "Número da Fibra(PDO)",
  pdo_splitter: "Splitter No PDO",
  porto_pdo: "Porto",
  estado_operacional_porto: "Estado Porto",
  beneficiario_porto: "Operadora"
};

let csvData = [];
const requiredCols = Object.keys(DISPLAY_NAMES);

const btnLoadCsv = document.getElementById("btnLoadCsv");
const btnPesquisar = document.getElementById("btnPesquisar");
const spinnerSro = document.getElementById("spinnerSro");
const spinnerSplitter = document.getElementById("spinnerSplitter");
const spinnerPdo = document.getElementById("spinnerPdo");
const spinnerPorto = document.getElementById("spinnerPorto");
const textResult = document.getElementById("textResult");
const textFileName = document.getElementById("textFileName");

// === Inicialização: spinners vazios antes do CSV ===
function resetSpinners(emptyOnly = false) {
  const vazio = emptyOnly ? "" : `<option value="">-- Selecionar --</option>`;
  spinnerSro.innerHTML = vazio;
  spinnerSplitter.innerHTML = vazio;
  spinnerPdo.innerHTML = vazio;
  spinnerPorto.innerHTML = vazio;
}
resetSpinners(true); // sem opções antes de carregar o ficheiro

// === CSV ===
btnLoadCsv.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  textFileName.textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = e => carregarCsv(e.target.result);
  reader.readAsText(file, "UTF-8");
});

function detectarSeparador(linha) {
  if (linha.includes(";")) return ";";
  if (linha.includes("\t")) return "\t";
  return ",";
}

function carregarCsv(texto) {
  const lines = texto.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) { alert("Ficheiro CSV vazio!"); return; }

  const separador = detectarSeparador(lines[0]);
  const headers = lines[0].split(separador);
  csvData = lines.slice(1).map(line => {
    const values = line.split(separador);
    if (values.length === headers.length)
      return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
    return null;
  }).filter(Boolean);

  // Preenche SROs
  const sros = [...new Set(csvData.map(d => d["sro_nome"]).filter(Boolean))].sort();
  if (csvData.some(d=>!d["sro_nome"])) sros.unshift("FastFiber");
  spinnerSro.innerHTML = `<option value="">-- Selecionar --</option>` + sros.map(s => `<option>${s}</option>`).join("");

  // Reset restantes
  spinnerSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;

  spinnerSro.addEventListener("change", handleSroChange);
  spinnerSplitter.addEventListener("change", handleSplitterSelection);
  spinnerPdo.addEventListener("change", updatePortos);

  handleSroChange();
  alert("Ficheiro carregado com sucesso!");
}

function handleSroChange() {
  const selectedSro = spinnerSro.value;

  // Sempre resetar tudo ao trocar o SRO
  spinnerSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerSplitter.disabled = false;
  spinnerPdo.disabled = false;
  spinnerPorto.disabled = false;

  if (!selectedSro) return;

  // Preenche PDOs
  const pdos = selectedSro==="FastFiber"
    ? csvData.filter(d=>!d["sro_nome"]).map(d=>d["pdo_nome"])
    : csvData.filter(d=>d["sro_nome"]===selectedSro).map(d=>d["pdo_nome"]);

  const pdosUnicos = [...new Set(pdos)].sort((a,b)=>{
    const numA = parseInt(a.replace(/\D/g,'')) || 0;
    const numB = parseInt(b.replace(/\D/g,'')) || 0;
    return numA - numB;
  });
  spinnerPdo.innerHTML += pdosUnicos.map(p=>`<option>${p}</option>`).join("");

  updatePortos();

  // Preenche Splitters do SRO
  const splitters = csvData
    .filter(d=>d["sro_nome"]===selectedSro && d["sro_splitter"])
    .map(d=>{
      const match = d["sro_splitter"].match(/(S\d+_\d+)/);
      return match ? match[1] : d["sro_splitter"];
    });

  const ordem = { S4:1, S8:2, S16:3, S32:4 };
  const splittersUnicos = [...new Set(splitters)]
    .sort((a,b)=>{
      const tipoA = a.match(/S\d+/)?.[0] || "";
      const tipoB = b.match(/S\d+/)?.[0] || "";
      if (ordem[tipoA] !== ordem[tipoB]) return ordem[tipoA]-ordem[tipoB];
      const numA = parseInt(a.split("_")[1]||0);
      const numB = parseInt(b.split("_")[1]||0);
      return numA - numB;
    });

  spinnerSplitter.innerHTML += splittersUnicos.map(s=>`<option>${s}</option>`).join("");
}

function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  if(!selectedPdo) {
    spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
    return;
  }

  const portos = csvData.filter(d=>d["pdo_nome"]===selectedPdo)
    .map(d=>d["porto_pdo"]).filter(Boolean)
    .sort((a,b)=>parseInt(a.replace(/\D/g,''))-parseInt(b.replace(/\D/g,'')));
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>` + [...new Set(portos)].map(p=>`<option>${p}</option>`).join("");
}

function handleSplitterSelection() {
  const spl = spinnerSplitter.value;
  if (spl) {
    spinnerPdo.disabled = true;
    spinnerPorto.disabled = true;
  } else {
    spinnerPdo.disabled = false;
    spinnerPorto.disabled = false;
  }
}

// === PESQUISA ===
btnPesquisar.addEventListener("click", ()=> {
  if(!csvData.length){ alert("Carrega primeiro um ficheiro CSV."); return; }

  const sro = spinnerSro.value;
  const splitter = spinnerSplitter.value;
  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;

  if(!sro){ alert("Seleciona um SRO."); return; }

  // --- MODO SRO + SPLITTER ---
  if (splitter) {
    const results = csvData.filter(d =>
      d["sro_nome"] === sro &&
      d["sro_splitter"]?.startsWith(splitter)
    );

    if(!results.length){
      textResult.innerHTML = "Nenhuma linha encontrada para o SRO e Splitter selecionados.";
      return;
    }

    const outMap = {};
    results.forEach(d=>{
      const out = d["sro_secundario_pt"];
      const ocupado = d["id_servico"] && d["id_servico"].trim() !== "";
      if (!outMap[out]) outMap[out] = ocupado;
      else outMap[out] = outMap[out] || ocupado;
    });

    let html = `<b>=== RESULTADO ===</b><br>`;
    Object.keys(outMap).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).forEach(out=>{
      const status = outMap[out] ? "<font color='red'>Ocupado</font>" : "<font color='lime'>Livre</font>";
      html += `OUT SRO: ${out} — ${status}<br>`;
    });

    textResult.innerHTML = html;
    return;
  }

  // --- MODO SRO + PDO + PORTO ---
  if(!pdo || !porto){
    alert("Seleciona PDO e Porto, ou escolhe um Splitter.");
    return;
  }

  const results = csvData.filter(d =>
    ((d["sro_nome"]===sro)||(sro==="FastFiber"&&!d["sro_nome"])) &&
    d["pdo_nome"]===pdo &&
    d["porto_pdo"]===porto
  );

  if(!results.length){
    textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados.";
    return;
  }

  const fibraColors={1:"#FFFFFF",2:"#FF0000",3:"#00FF00",4:"#0000FF",5:"#000000",6:"#FFFF00",7:"#FFA500",8:"#808080",9:"#8B4513",10:"#800080",11:"#FFC0CB",12:"#40E0D0"};
  const tuboColors={...fibraColors};

  const html = results.map(row=>{
    let res = "<b>=== RESULTADO ===</b><br>";
    for(const col of requiredCols){
      const valor = row[col] || "";
      const displayName = DISPLAY_NAMES[col];
      if(col==="pdo_ptfo"){
        const numeroFibra=parseInt(valor)||0;
        if(numeroFibra>0){
          const corIndexFibra=((numeroFibra-1)%12)+1;
          const corFibra=fibraColors[corIndexFibra]||"#FFF";
          const tubo=Math.floor((numeroFibra-1)/12)+1;
          const corTubo=tuboColors[((tubo-1)%12)+1]||"#FFF";
          res+=`${displayName}: ${valor} <font color="${corFibra}">●</font> (Tubo ${tubo} <font color="${corTubo}">●</font>)<br>`;
        } else res+=`${displayName}: ${valor}<br>`;
      } else res+=`${displayName}: ${valor}<br>`;
    }
    return res;
  }).join("<br>");
  textResult.innerHTML = html;
});
