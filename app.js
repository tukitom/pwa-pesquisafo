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
  textFileName.textContent = `?? ${file.name}`;
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

  spinnerSro.addEventListener("change", () => {
    updateSplitters();
    updatePdos();
  });
  spinnerPdo.addEventListener("change", updatePortos);

  updateSplitters();
  updatePdos();
  alert("Ficheiro carregado com sucesso!");
}

// === Atualiza Splitters com S4_x, S8_x, S16_x, S32_x ===
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

  // Obter splitters do SRO selecionado
  const splitters = csvData
    .filter(d => d["sro_nome"] === selectedSro)
    .map(d => d["sro_splitter"])
    .filter(Boolean)
    .map(s => s.split("_").slice(0,2).join("_")); // pega S4_x, S8_x, etc.

  const uniqueSplitters = [...new Set(splitters)];

  // Ordenar numericamente pelo número após "_"
  uniqueSplitters.sort((a, b) => {
    const numA = parseInt(a.split("_")[1]) || 0;
    const numB = parseInt(b.split("_")[1]) || 0;
    return numA - numB;
  });

  options = [`<option value="">-- (opcional) --</option>`].concat(
    uniqueSplitters.map(s => `<option value="${s}">${s}</option>`)
  );

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

// === Botão Pesquisar ===
btnPesquisar.addEventListener("click", ()=> {
  if(!csvData.length){ alert("Carrega primeiro um ficheiro CSV."); return; }
  const sro = spinnerSro.value, pdo = spinnerPdo.value, porto = spinnerPorto.value, splitter = spinnerSplitter.value;
  if(!sro){ alert("Selecione o SRO."); return; }

  let results = [];

  if (splitter && splitter !== "N/A") {
    // Busca somente SRO + Splitter
    results = csvData.filter(d => 
      d["sro_nome"] === sro &&
      d["sro_splitter"]?.startsWith(splitter) &&
      d["sro_secundario_pt"]
    );
    results.sort((a,b) => (a["sro_secundario_pt"] || "").localeCompare(b["sro_secundario_pt"]));

    // Montar HTML com OUT SRO + Ocupado/Livre
    const html = results.map(row => {
      const out = row["sro_secundario_pt"];
      const id = row["id_servico"];
      const status = id ? `<span style="color:red">Ocupado</span>` : `<span style="color:green">Livre</span>`;
      return `${out} - ${status}`;
    }).join("<br>");
    textResult.innerHTML = `<b>=== RESULTADO ===</b><br>${html}`;
    return;
  }

  // Caso contrário: SRO + PDO + Porto (comportamento original)
  if(!pdo||!porto){ alert("Seleciona PDO e Porto."); return; }
  results = csvData.filter(d => 
    (d["sro_nome"] === sro || (sro === "FastFiber" && !d["sro_nome"])) &&
    d["pdo_nome"] === pdo &&
    d["porto_pdo"] === porto
  );

  if (!results.length) { textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados."; return; }

  const fibraColors = {1:"#FFFFFF",2:"#FF0000",3:"#00FF00",4:"#0000FF",5:"#000000",6:"#FFFF00",7:"#FFA500",
    8:"#808080",9:"#8B4513",10:"#800080",11:"#FFC0CB",12:"#40E0D0"};
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
          res += `${displayName}: ${valor} <font color='${corFibra}'>?</font> (Tubo ${tubo} <font color='${corTubo}'>?</font>)<br>`;
        } else res += `${displayName}: ${valor}<br>`;
      } else res += `${displayName}: ${valor}<br>`;
    }
    return res;
  }).join("<br>");
  textResult.innerHTML = html;
});
