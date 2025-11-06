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
const spinnerSplitter = document.getElementById("spinnerSplitter"); // existe no HTML
const spinnerPdo = document.getElementById("spinnerPdo");
const spinnerPorto = document.getElementById("spinnerPorto");
const textResult = document.getElementById("textResult");
const textFileName = document.getElementById("textFileName");

// Helper: detecta separador
function detectarSeparador(linha) {
  if (linha.includes(";")) return ";";
  if (linha.includes("\t")) return "\t";
  return ",";
}

// Helper: ordenação natural/numérica de strings que contêm números
function sortNatural(a, b) {
  const na = parseInt((a||"").replace(/\D/g,'')) || 0;
  const nb = parseInt((b||"").replace(/\D/g,'')) || 0;
  if (na !== nb) return na - nb;
  return (a||"").localeCompare(b||"");
}

// === CSV ===
btnLoadCsv.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  textFileName.textContent = `?? ${file.name}`;
  const reader = new FileReader();
  reader.onload = e => carregarCsv(e.target.result);
  reader.readAsText(file);
});

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

  // Preencher SROs (igual ao original)
  const sros = [...new Set(csvData.map(d => d["sro_nome"]).filter(Boolean))].sort();
  if (csvData.some(d=>!d["sro_nome"])) sros.unshift("FastFiber");
  spinnerSro.innerHTML = sros.map(s => `<option>${s}</option>`).join("");

  // listeners (mantendo a estrutura do original)
  spinnerSro.addEventListener("change", () => {
    updateSplitters();
    updatePdos();
  });
  spinnerPdo.addEventListener("change", updatePortos);

  // Inicializar selects dependentes
  updatePdos();
  updateSplitters();

  alert("Ficheiro carregado com sucesso!");
}

// === updateSplitters: agrupa sub-outs em Sx_y e ordena por S4->S8->S16->S32 e por número ===
function updateSplitters() {
  const selectedSro = spinnerSro.value;
  let options = [`<option value="">-- (opcional) --</option>`];

  if (!selectedSro) {
    spinnerSplitter.innerHTML = options.join("");
    spinnerSplitter.disabled = false;
    return;
  }

  if (selectedSro === "FastFiber") {
    // FastFiber não tem splitters: mostrar N/A e desativar
    spinnerSplitter.innerHTML = `<option value="N/A">N/A</option>`;
    spinnerSplitter.disabled = true;
    return;
  }

  // Extrair sro_splitter dos registos desse SRO, mapear para Sx_n (primeiras 2 partes)
  let splitters = csvData
    .filter(d => d["sro_nome"] === selectedSro && d["sro_splitter"])
    .map(d => {
      const parts = (d["sro_splitter"]||"").split("_").filter(Boolean);
      // se tiver menos de 2 partes, mantém original
      if (parts.length >= 2) return `${parts[0]}_${parts[1]}`;
      return d["sro_splitter"];
    })
    .filter(Boolean);

  // Unificar e ordenar por grupos S4 -> S8 -> S16 -> S32 e depois por número
  splitters = [...new Set(splitters)];

  const knownOrder = ["S4","S8","S16","S32"];
  splitters.sort((a,b) => {
    const pa = (a||"").split("_")[0], pb = (b||"").split("_")[0];
    if (pa !== pb) {
      const ia = knownOrder.indexOf(pa), ib = knownOrder.indexOf(pb);
      // itens desconhecidos ficam no fim
      if (ia === -1 && ib === -1) return (a||"").localeCompare(b||"");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    // mesma família: ordenar pelo número após '_'
    return sortNatural(a.split("_")[1], b.split("_")[1]);
  });

  options = options.concat(splitters.map(s => `<option value="${s}">${s}</option>`));
  spinnerSplitter.innerHTML = options.join("");
  spinnerSplitter.disabled = false;
}

// === updatePdos / updatePortos mantidos exatamente como original ===
function updatePdos() {
  const selectedSro = spinnerSro.value;
  const pdos = selectedSro==="FastFiber" ? csvData.filter(d=>!d["sro_nome"]).map(d=>d["pdo_nome"])
                                        : csvData.filter(d=>d["sro_nome"]===selectedSro).map(d=>d["pdo_nome"]);
  const pdosUnicos = [...new Set(pdos)].sort((a,b) => {
    const numA = parseInt(a.replace(/\D/g,'')) || 0;
    const numB = parseInt(b.replace(/\D/g,'')) || 0;
    return numA - numB;
  });
  spinnerPdo.innerHTML = pdosUnicos.map(p=>`<option>${p}</option>`).join("");
  updatePortos();
}

function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  if(!selectedPdo) return;
  const portos = csvData.filter(d=>d["pdo_nome"]===selectedPdo)
    .map(d=>d["porto_pdo"]).filter(Boolean)
    .sort((a,b)=>parseInt(a.replace(/\D/g,''))-parseInt(b.replace(/\D/g,'')));
  spinnerPorto.innerHTML = [...new Set(portos)].map(p=>`<option>${p}</option>`).join("");
}

// === Botão Pesquisar: duas formas de pesquisa ===
btnPesquisar.addEventListener("click", ()=> {
  if(!csvData.length){ alert("Carrega primeiro um ficheiro CSV."); return; }
  const sro = spinnerSro.value;
  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;
  const splitter = spinnerSplitter.value;

  if(!sro){ alert("Selecione o SRO."); return; }

  // PRIORIDADE: se PDO e Porto ambos preenchidos -> comportamento ORIGINAL (SRO + PDO + Porto)
  if (pdo && porto) {
    // quando SRO+PDO+Porto está ativo, bloqueamos (desabilitamos) o splitter visualmente para deixar claro que não tem efeito
    // mas NÃO alteramos lógica original: fazemos exactamente o que fazia antes
    if (spinnerSplitter) spinnerSplitter.disabled = true;

    const results = csvData.filter(d=>((d["sro_nome"]===sro)||(sro==="FastFiber"&&!d["sro_nome"]))&&d["pdo_nome"]===pdo&&d["porto_pdo"]===porto);
    if(!results.length){ textResult.innerHTML="Nenhuma linha encontrada para os valores indicados."; return; }

    const fibraColors={1:"#FFFFFF",2:"#FF0000",3:"#00FF00",4:"#0000FF",5:"#000000",6:"#FFFF00",7:"#FFA500",8:"#808080",9:"#8B4513",10:"#800080",11:"#FFC0CB",12:"#40E0D0"};
    const tuboColors={...fibraColors};
    const html = results.map(row=>{
      let res="<b>=== RESULTADO ===</b><br>";
      for(const col of requiredCols){
        const valor=row[col]||"", displayName=DISPLAY_NAMES[col];
        if(col==="pdo_ptfo"){
          const numeroFibra=parseInt(valor)||0;
          if(numeroFibra>0){
            const corIndexFibra=((numeroFibra-1)%12)+1;
            const corFibra=fibraColors[corIndexFibra]||"#FFF";
            const tubo=Math.floor((numeroFibra-1)/12)+1;
            const corTubo=tuboColors[((tubo-1)%12)+1]||"#FFF";
            res+=`${displayName}: ${valor} <font color='${corFibra}'>?</font> (Tubo ${tubo} <font color='${corTubo}'>?</font>)<br>`;
          } else res+=`${displayName}: ${valor}<br>`;
        } else res+=`${displayName}: ${valor}<br>`;
      }
      return res;
    }).join("<br>");
    textResult.innerHTML=html;
    return;
  }

  // Caso contrário, se Splitter foi selecionado -> SRO + Splitter modo
  // Ao entrar neste modo, o PDO/Porto podem permanecer selecionáveis, mas NÃO influenciarão a pesquisa.
  if (splitter && splitter !== "" && splitter !== "N/A") {
    // Liberar visualmente o splitter (garantir que enabled)
    if (spinnerSplitter) spinnerSplitter.disabled = false;

    // Se SRO for FastFiber, tratamos caso especial: usar linhas sem sro_nome
    let rowsForSro;
    if (sro === "FastFiber") {
      rowsForSro = csvData.filter(d => !d["sro_nome"]);
    } else {
      rowsForSro = csvData.filter(d => d["sro_nome"] === sro);
    }

    // Filtrar rows cujo sro_splitter começa com o padrão selecionado (S4_x ...), 
    // lembrando que no CSV podem existir valores detalhados como S4_1_1_1 etc.
    const matched = rowsForSro.filter(d => {
      const val = d["sro_splitter"] || "";
      return val.startsWith(splitter);
    });

    if (!matched.length) {
      textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados.";
      return;
    }

    // Mapear OUTs -> status: se existir qualquer id_servico preenchido para esse OUT -> Ocupado
    const outStatus = {}; // out -> "Ocupado"|"Livre"|"N/A"
    matched.forEach(r => {
      const out = r["sro_secundario_pt"];
      if (!out) return;
      // Se SRO for FastFiber, o estado será N/A
      if (sro === "FastFiber") {
        outStatus[out] = "N/A";
        return;
      }
      const hasService = r["id_servico"] && r["id_servico"].trim() !== "";
      if (!outStatus[out]) {
        outStatus[out] = hasService ? "Ocupado" : "Livre";
      } else {
        // se já existe e estiver Livre, e agora há um serviço -> marcar Ocupado (ocupado prevalece)
        if (outStatus[out] === "Livre" && hasService) outStatus[out] = "Ocupado";
      }
    });

    // Ordenar OUTs naturalmente (números) e garantir que não apareça mais OUTs do que a capacidade do tipo de splitter
    // Determinar a capacidade pelo prefixo: S4 -> 4, S8->8, S16->16, S32->32
    const prefix = (splitter || "").split("_")[0] || "";
    const capMap = { "S4":4, "S8":8, "S16":16, "S32":32 };
    const capacity = capMap[prefix] || Infinity;

    const outs = Object.keys(outStatus).sort((a,b)=>{
      // sort numeric if possible
      const na = parseInt((a||"").replace(/\D/g,'')) || 0;
      const nb = parseInt((b||"").replace(/\D/g,'')) || 0;
      if (na !== nb) return na - nb;
      return (a||"").localeCompare(b||"");
    }).slice(0, capacity); // cortar à capacidade

    // Construir HTML. Cada linha deve mostrar "OUT SRO: <valor> - <status>" e status colorido
    const htmlParts = outs.map(out => {
      const st = outStatus[out];
      if (st === "N/A") return `OUT SRO: ${out} - <span style="color:gray">N/A</span>`;
      if (st === "Ocupado") return `OUT SRO: ${out} - <span style="color:red">Ocupado</span>`;
      return `OUT SRO: ${out} - <span style="color:green">Livre</span>`;
    });

    textResult.innerHTML = `<b>=== RESULTADO ===</b><br>` + htmlParts.join("<br>");
    return;
  }

  // Se nem (PDO+Porto) nem (Splitter) estiverem em modo válido:
  // Manter comportamento original: pedir PDO e Porto
  alert("Seleciona PDO e Porto, ou escolhe um Splitter para pesquisa por SRO+Splitter.");
});
