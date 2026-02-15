const DISPLAY_NAMES = {
  id_servico: "ID do Serviço",

  sro_nome: "SRO",
  sro_splitter: "Splitter No SRO",
  sro_secundario_pt: "OUT SRO",

  jso_nome: "JSO",
  jso_splitter: "Splitter Na JSO",
  jso_ptfo: "OUT JSO",

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

const spinnerJso = document.getElementById("spinnerJso");
const spinnerJsoSplitter = document.getElementById("spinnerJsoSplitter");

const spinnerPdo = document.getElementById("spinnerPdo");
const spinnerPorto = document.getElementById("spinnerPorto");

const textResult = document.getElementById("textResult");
const textFileName = document.getElementById("textFileName");

// ================= RESET =================
function resetSpinners(emptyOnly = false) {
  const vazio = emptyOnly ? "" : `<option value="">-- Selecionar --</option>`;
  spinnerSro.innerHTML = vazio;
  spinnerSplitter.innerHTML = vazio;
  spinnerJso.innerHTML = vazio;
  spinnerJsoSplitter.innerHTML = vazio;
  spinnerPdo.innerHTML = vazio;
  spinnerPorto.innerHTML = vazio;
}
resetSpinners(true);

// ================= CSV =================
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

  // SRO
  const sros = [...new Set(csvData.map(d => d["sro_nome"]).filter(Boolean))].sort();
  spinnerSro.innerHTML = `<option value="">-- Selecionar --</option>` +
    sros.map(s => `<option>${s}</option>`).join("");

  // JSO (apenas nomes que começam por "JSO")
const jsos = [...new Set(
  csvData
    .map(d => d["jso_nome"])
    .filter(j => j && j.toUpperCase().startsWith("JSO"))
)].sort();

spinnerJso.innerHTML = `<option value="">-- Selecionar --</option>` +
  jsos.map(j => `<option>${j}</option>`).join("");

  spinnerSro.addEventListener("change", handleSroChange);
  spinnerJso.addEventListener("change", handleJsoChange);
  spinnerPdo.addEventListener("change", updatePortos);

  alert("Ficheiro carregado com sucesso!");
}

// ================= SRO =================
function handleSroChange() {
  const selectedSro = spinnerSro.value;

  // bloqueio automático
  if (selectedSro) spinnerJso.disabled = true;
  else spinnerJso.disabled = false;

  spinnerSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;

  if (!selectedSro) return;

  const pdos = csvData
    .filter(d=>d["sro_nome"]===selectedSro)
    .map(d=>d["pdo_nome"]);

  const pdosUnicos = [...new Set(pdos)].sort((a,b)=>{
    const numA = parseInt(a.replace(/\D/g,'')) || 0;
    const numB = parseInt(b.replace(/\D/g,'')) || 0;
    return numA - numB;
  });

  spinnerPdo.innerHTML += pdosUnicos.map(p=>`<option>${p}</option>`).join("");

  preencherSplitters(selectedSro, "sro_nome", "sro_splitter", spinnerSplitter);
}

// ================= JSO =================
function handleJsoChange() {
  const selectedJso = spinnerJso.value;

  // bloqueio automático
  if (selectedJso) spinnerSro.disabled = true;
  else spinnerSro.disabled = false;

  spinnerJsoSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;

  if (!selectedJso) return;

  const pdos = csvData
    .filter(d=>d["jso_nome"]===selectedJso)
    .map(d=>d["pdo_nome"]);

  const pdosUnicos = [...new Set(pdos)].sort((a,b)=>{
    const numA = parseInt(a.replace(/\D/g,'')) || 0;
    const numB = parseInt(b.replace(/\D/g,'')) || 0;
    return numA - numB;
  });

  spinnerPdo.innerHTML += pdosUnicos.map(p=>`<option>${p}</option>`).join("");

  preencherSplitters(selectedJso, "jso_nome", "jso_splitter", spinnerJsoSplitter);
}

// ================= SPLITTERS =================
function preencherSplitters(valor, campoNome, campoSplitter, spinner) {
  const splitters = csvData
    .filter(d=>d[campoNome]===valor && d[campoSplitter])
    .map(d=>{
      const match = d[campoSplitter].match(/(S\d+_\d+)/);
      return match ? match[1] : d[campoSplitter];
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

  spinner.innerHTML += splittersUnicos.map(s=>`<option>${s}</option>`).join("");
}

// ================= PORTOS =================
function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
  if(!selectedPdo) return;

  const portos = csvData.filter(d=>d["pdo_nome"]===selectedPdo)
    .map(d=>d["porto_pdo"]).filter(Boolean)
    .sort((a,b)=>parseInt(a)-parseInt(b));

  spinnerPorto.innerHTML += [...new Set(portos)].map(p=>`<option>${p}</option>`).join("");
}

// ================= PESQUISA =================
btnPesquisar.addEventListener("click", ()=> {

  const sro = spinnerSro.value;
  const splitter = spinnerSplitter.value;

  const jso = spinnerJso.value;
  const jsoSplitter = spinnerJsoSplitter.value;

  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;

  const fibraColors={
    1:"#FFFFFF",2:"#FF0000",3:"#00FF00",4:"#0000FF",
    5:"#000000",6:"#FFFF00",7:"#FFA500",8:"#808080",
    9:"#8B4513",10:"#800080",11:"#FFC0CB",12:"#40E0D0"
  };
  const tuboColors={...fibraColors};

  // --- JSO + SPLITTER ---
  if (jsoSplitter) {
    const results = csvData.filter(d =>
      d["jso_nome"] === jso &&
      d["jso_splitter"]?.startsWith(jsoSplitter + "_")
    );

    if(!results.length){
      textResult.innerHTML = "Nenhuma linha encontrada para a JSO e Splitter selecionados.";
      return;
    }

    const outMap = {};
    results.forEach(d=>{
      const out = d["jso_ptfo"];
      const ocupado = d["id_servico"] && d["id_servico"].trim() !== "";
      if (!outMap[out]) outMap[out] = ocupado;
      else outMap[out] = outMap[out] || ocupado;
    });

    let html = `<b>=== RESULTADO JSO ===</b><br>`;

    Object.keys(outMap)
      .sort((a,b)=>parseInt(a)-parseInt(b))
      .forEach(out=>{
        const numeroFibra=parseInt(out)||0;
        const corIndexFibra=((numeroFibra-1)%12)+1;
        const corFibra=fibraColors[corIndexFibra]||"#FFF";
        const tubo=Math.floor((numeroFibra-1)/12)+1;
        const corTubo=tuboColors[((tubo-1)%12)+1]||"#FFF";

        const status = outMap[out]
          ? "<font color='red'>Ocupado</font>"
          : "<font color='lime'>Livre</font>";

        html += `OUT JSO: ${out} 
        <font color="${corFibra}">●</font> 
        (Tubo ${tubo} <font color="${corTubo}">●</font>) 
        — ${status}<br>`;
      });

    textResult.innerHTML = html;
    return;
  }

  // --- SRO + SPLITTER (ORIGINAL) ---
  if (splitter) {
    const results = csvData.filter(d =>
      d["sro_nome"] === sro &&
      d["sro_splitter"]?.startsWith(splitter + "_")
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
    Object.keys(outMap)
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
      .forEach(out=>{
        const status = outMap[out]
          ? "<font color='red'>Ocupado</font>"
          : "<font color='lime'>Livre</font>";
        html += `OUT SRO: ${out} — ${status}<br>`;
      });

    textResult.innerHTML = html;
    return;
  }

  // --- MODO PDO ---
  if (!pdo || !porto) {
    alert("Seleciona PDO e Porto, ou escolhe um splitter.");
    return;
  }

  const results = csvData.filter(d =>
    d["pdo_nome"]===pdo &&
    d["porto_pdo"]===porto
  );

  if(!results.length){
    textResult.innerHTML = "Nenhuma linha encontrada.";
    return;
  }

  let html = "<b>=== RESULTADO ===</b><br>";

  results.forEach(row=>{
    for(const col of requiredCols){
      const valor = row[col] || "";
      const displayName = DISPLAY_NAMES[col];

      if(col==="pdo_ptfo" || col==="jso_ptfo"){
        const numeroFibra=parseInt(valor)||0;
        if(numeroFibra>0){
          const corIndexFibra=((numeroFibra-1)%12)+1;
          const corFibra=fibraColors[corIndexFibra]||"#FFF";
          const tubo=Math.floor((numeroFibra-1)/12)+1;
          const corTubo=tuboColors[((tubo-1)%12)+1]||"#FFF";

          html+=`${displayName}: ${valor} 
          <font color="${corFibra}">●</font> 
          (Tubo ${tubo} <font color="${corTubo}">●</font>)<br>`;
        } else {
          html+=`${displayName}: ${valor}<br>`;
        }
      } else {
        html+=`${displayName}: ${valor}<br>`;
      }
    }
    html += "<br>";
  });

  textResult.innerHTML = html;
});
