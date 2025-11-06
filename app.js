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

// === CSV ===
btnLoadCsv.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  textFileName.textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = e => carregarCsv(e.target.result);
  reader.readAsText(file);
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

  const sros = [...new Set(csvData.map(d => d["sro_nome"]).filter(Boolean))].sort();
  if (csvData.some(d=>!d["sro_nome"])) sros.unshift("FastFiber");
  spinnerSro.innerHTML = sros.map(s => `<option value="${s}">${s}</option>`).join("");

  // set default for splitter/pdo/porto
  spinnerSplitter.innerHTML = `<option value="">-- (opcional) --</option>`;
  spinnerPdo.innerHTML = `<option value="">-- (opcional) --</option>`;
  spinnerPorto.innerHTML = `<option value="">-- (opcional) --</option>`;

  spinnerSro.addEventListener("change", () => {
    updateSplitters();
    updatePdos();
  });
  spinnerPdo.addEventListener("change", updatePortos);

  updateSplitters();
  updatePdos();
  alert("Ficheiro carregado com sucesso!");
}

function updateSplitters() {
  const selectedSro = spinnerSro.value;
  let options = [`<option value="">-- (opcional) --</option>`];

  if (!selectedSro) {
    spinnerSplitter.innerHTML = options.join("");
    spinnerSplitter.disabled = false;
    return;
  }

  if (selectedSro === "FastFiber") {
    options = [`<option value="N/A">N/A</option>`];
    spinnerSplitter.innerHTML = options.join("");
    spinnerSplitter.disabled = true;
    return;
  }

  const splitters = csvData
    .filter(d => d["sro_nome"] === selectedSro)
    .map(d => d["sro_splitter"])
    .filter(Boolean);

  const unique = [...new Set(splitters)].sort((a,b) => {
    const na = parseInt(a.replace(/\D/g,'')) || 0;
    const nb = parseInt(b.replace(/\D/g,'')) || 0;
    return na - nb || a.localeCompare(b);
  });

  options = [`<option value="">-- (opcional) --</option>`].concat(unique.map(s => `<option value="${s}">${s}</option>`));
  spinnerSplitter.innerHTML = options.join("");
  spinnerSplitter.disabled = false;
}

function updatePdos() {
  const selectedSro = spinnerSro.value;
  const pdos = selectedSro==="FastFiber"
    ? csvData.filter(d=>!d["sro_nome"]).map(d=>d["pdo_nome"])
    : csvData.filter(d=>d["sro_nome"]===selectedSro).map(d=>d["pdo_nome"]);
  const pdosUnicos = [...new Set(pdos)].sort((a,b) => {
    const numA = parseInt((a||"").replace(/\D/g,'')) || 0;
    const numB = parseInt((b||"").replace(/\D/g,'')) || 0;
    return numA - numB || (a||"").localeCompare(b||"");
  });
  spinnerPdo.innerHTML = `<option value="">-- (opcional) --</option>` + pdosUnicos.map(p=>`<option value="${p}">${p}</option>`).join("");
  updatePortos();
}

function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  if(!selectedPdo){
    spinnerPorto.innerHTML = `<option value="">-- (opcional) --</option>`;
    return;
  }
  const portos = csvData.filter(d=>d["pdo_nome"]===selectedPdo)
    .map(d=>d["porto_pdo"]).filter(Boolean)
    .sort((a,b)=>parseInt((a||"").replace(/\D/g,''))-parseInt((b||"").replace(/\D/g,'')));
  spinnerPorto.innerHTML = `<option value="">-- (opcional) --</option>` + [...new Set(portos)].map(p=>`<option value="${p}">${p}</option>`).join("");
}

btnPesquisar.addEventListener("click", ()=> {
  if(!csvData.length){ alert("Carrega primeiro um ficheiro CSV."); return; }
  const sro=spinnerSro.value, pdo=spinnerPdo.value, porto=spinnerPorto.value, splitter=spinnerSplitter.value;
  if(!sro){ alert("Selecione o SRO."); return; }

  // Lógica de filtragem com condições para SRO, Splitter, PDO e Porto
  let results = [];

  if (splitter) {
    // Buscar resultados para SRO e Splitter (sem PDO e Porto)
    results = csvData.filter(d => d["sro_nome"] === sro && d["sro_splitter"] === splitter);
    results = results.filter(d => d["sro_secundario_pt"]); // Filtrar "OUT SRO" do armário
    results = results.sort((a, b) => (a["sro_secundario_pt"] || "").localeCompare(b["sro_secundario_pt"]));
  } else {
    // Buscar resultados para SRO + PDO + Porto (com base no comportamento original)
    results = csvData.filter(d => 
      (d["sro_nome"] === sro || (sro === "FastFiber" && !d["sro_nome"])) &&
      (pdo ? d["pdo_nome"] === pdo : true) &&
      (porto ? d["porto_pdo"] === porto : true)
    );
  }

  if (!results.length) { textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados."; return; }

  // Exibição dos resultados com as cores para "Livre", "Ocupado" e "N/A"
  const fibraColors = {
    1:"#FFFFFF", 2:"#FF0000", 3:"#00FF00", 4:"#0000FF", 5:"#000000", 6:"#FFFF00", 7:"#FFA500",
    8:"#808080", 9:"#8B4513", 10:"#800080", 11:"#FFC0CB", 12:"#40E0D0"
  };
  const tuboColors = { ...fibraColors };
  
  const html = results.map(row => {
    let res = "<b>=== RESULTADO ===</b><br>";
    for (const col of requiredCols) {
      const valor = row[col] || "", displayName = DISPLAY_NAMES[col];
      if (col === "pdo_ptfo") {
        const numeroFibra = parseInt(valor) || 0;
        if (numeroFibra > 0) {
          const corIndexFibra = ((numeroFibra - 1) % 12) + 1;
          const corFibra = fibraColors[corIndexFibra] || "#FFF";
          const tubo = Math.floor((numeroFibra - 1) / 12) + 1;
          const corTubo = tuboColors[((tubo - 1) % 12)] || "#FFF";
          res += `<span style="color:${corFibra};">${valor}</span> <span style="color:${corTubo};">${tubo}</span><br>`;
        }
      } else {
        res += `${displayName}: ${valor}<br>`;
      }
    }
    return res;
  });

  textResult.innerHTML = html.join("");
});
