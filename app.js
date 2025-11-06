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
      return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim()]));
    return null;
  }).filter(Boolean);

  // === Popular SRO ===
  const sros = [...new Set(csvData.map(d => d["sro_nome"]).filter(Boolean))].sort();
  if (csvData.some(d => !d["sro_nome"])) sros.unshift("FastFiber");
  spinnerSro.innerHTML = sros.map(s => `<option value="${s}">${s}</option>`).join("");

  spinnerSro.addEventListener("change", () => {
    updatePdos();
    updateSplitters();
  });

  spinnerPdo.addEventListener("change", updatePortos);
  updatePdos();
  updateSplitters();

  alert("Ficheiro carregado com sucesso!");
}

function updatePdos() {
  const selectedSro = spinnerSro.value;
  if (!selectedSro) return;
  const pdos = selectedSro === "FastFiber"
    ? csvData.filter(d => !d["sro_nome"]).map(d => d["pdo_nome"])
    : csvData.filter(d => d["sro_nome"] === selectedSro).map(d => d["pdo_nome"]);
  const pdosUnicos = [...new Set(pdos)].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    return numA - numB;
  });
  spinnerPdo.innerHTML = pdosUnicos.map(p => `<option value="${p}">${p}</option>`).join("");
  updatePortos();
}

function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  if (!selectedPdo) return;
  const portos = csvData
    .filter(d => d["pdo_nome"] === selectedPdo)
    .map(d => d["porto_pdo"])
    .filter(Boolean)
    .sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
  spinnerPorto.innerHTML = [...new Set(portos)].map(p => `<option value="${p}">${p}</option>`).join("");
}

function updateSplitters() {
  const selectedSro = spinnerSro.value;
  if (!selectedSro) return;

  const splitters = csvData
    .filter(d => d["sro_nome"] === selectedSro && d["sro_splitter"])
    .map(d => d["sro_splitter"]);

  // Agrupar por tipo (S4, S8, S16, S32) e remover repetições
  const normalizados = [...new Set(
    splitters.map(s => {
      const match = s.match(/(S4|S8|S16|S32)_\d+/i);
      return match ? match[0] : null;
    }).filter(Boolean)
  )];

  // Ordenar: S4 ? S8 ? S16 ? S32 e dentro de cada tipo numericamente
  const ordemTipo = { S4: 1, S8: 2, S16: 3, S32: 4 };
  normalizados.sort((a, b) => {
    const [tipoA, numA] = a.split("_");
    const [tipoB, numB] = b.split("_");
    if (tipoA !== tipoB) return ordemTipo[tipoA] - ordemTipo[tipoB];
    return (parseInt(numA) || 0) - (parseInt(numB) || 0);
  });

  spinnerSplitter.innerHTML = `<option value="">(Nenhum)</option>` +
    normalizados.map(s => `<option value="${s}">${s}</option>`).join("");
}

// === PESQUISA ===
btnPesquisar.addEventListener("click", () => {
  if (!csvData.length) { alert("Carrega primeiro um ficheiro CSV."); return; }

  const sro = spinnerSro.value;
  const splitter = spinnerSplitter.value;
  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;

  if (!sro) { alert("Seleciona um SRO."); return; }

  // === Caso 1: Pesquisa por SRO + SPLITTER ===
  if (splitter) {
    const filtrados = csvData.filter(d =>
      d["sro_nome"] === sro &&
      d["sro_splitter"] &&
      d["sro_splitter"].startsWith(splitter)
    );

    if (!filtrados.length) {
      textResult.innerHTML = "Nenhum resultado encontrado para este Splitter.";
      return;
    }

    const outsMap = new Map();
    filtrados.forEach(d => {
      const out = d["sro_secundario_pt"];
      const idServico = d["id_servico"];
      if (!out) return;
      // Se já houver OUT, não sobrescrever "Ocupado" por "Livre"
      if (!outsMap.has(out)) {
        outsMap.set(out, idServico ? "Ocupado" : "Livre");
      } else if (outsMap.get(out) === "Livre" && idServico) {
        outsMap.set(out, "Ocupado");
      }
    });

    // Ordenar de forma crescente
    const outsOrdenados = [...outsMap.keys()].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, "")) || 0;
      const nb = parseInt(b.replace(/\D/g, "")) || 0;
      return na - nb;
    });

    const html = outsOrdenados.map(out => {
      const status = outsMap.get(out);
      const cor =
        sro === "FastFiber" ? "gray"
        : status === "Ocupado" ? "red"
        : "green";
      const texto =
        sro === "FastFiber" ? "N/A"
        : status === "Ocupado" ? "Ocupado"
        : "Livre";
      return `<b>OUT SRO:</b> ${out} - <span style="color:${cor};font-weight:bold">${texto}</span>`;
    }).join("<br>");

    textResult.innerHTML = `<b>=== RESULTADO ===</b><br>${html}`;
    return;
  }

  // === Caso 2: Pesquisa por SRO + PDO + PORTO (original) ===
  if (!pdo || !porto) { alert("Seleciona PDO e Porto."); return; }

  const results = csvData.filter(
    d =>
      ((d["sro_nome"] === sro) || (sro === "FastFiber" && !d["sro_nome"])) &&
      d["pdo_nome"] === pdo &&
      d["porto_pdo"] === porto
  );

  if (!results.length) {
    textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados.";
    return;
  }

  const fibraColors = {
    1: "#FFFFFF", 2: "#FF0000", 3: "#00FF00", 4: "#0000FF",
    5: "#000000", 6: "#FFFF00", 7: "#FFA500", 8: "#808080",
    9: "#8B4513", 10: "#800080", 11: "#FFC0CB", 12: "#40E0D0"
  };
  const tuboColors = { ...fibraColors };

  const html = results.map(row => {
    let res = "<b>=== RESULTADO ===</b><br>";
    for (const col of requiredCols) {
      const valor = row[col] || "";
      const displayName = DISPLAY_NAMES[col];
      if (col === "pdo_ptfo") {
        const numeroFibra = parseInt(valor) || 0;
        if (numeroFibra > 0) {
          const corIndexFibra = ((numeroFibra - 1) % 12) + 1;
          const corFibra = fibraColors[corIndexFibra] || "#FFF";
          const tubo = Math.floor((numeroFibra - 1) / 12) + 1;
          const corTubo = tuboColors[((tubo - 1) % 12) + 1] || "#FFF";
          res += `${displayName}: ${valor} <font color='${corFibra}'>?</font> (Tubo ${tubo} <font color='${corTubo}'>?</font>)<br>`;
        } else {
          res += `${displayName}: ${valor}<br>`;
        }
      } else {
        res += `${displayName}: ${valor}<br>`;
      }
    }
    return res;
  }).join("<br>");

  textResult.innerHTML = html;
});
