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
  // default option
  let options = [`<option value="">-- (opcional) --</option>`];

  if (!selectedSro) {
    spinnerSplitter.innerHTML = options.join("");
    spinnerSplitter.disabled = false;
    return;
  }

  if (selectedSro === "FastFiber") {
    // FastFiber doesn't have splitters — mostrar N/A e desativar para evitar seleção
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
    // tentar ordenar numericamente se possível
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

  const results = csvData.filter(d=>((d["sro_nome"]===sro)||(sro==="FastFiber"&&!d["sro_nome"])) && 
                                    (splitter ? d["sro_splitter"] === splitter : true) &&
                                    (pdo ? d["pdo_nome"] === pdo : true) &&
                                    (porto ? d["porto_pdo"] === porto : true));

  if(!results.length){ textResult.innerHTML="Nenhuma linha encontrada para os valores indicados."; return; }

  // Mostra os resultados na tela
  textResult.innerHTML = `<pre>${JSON.stringify(results, null, 2)}</pre>`;
});
