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
btnLoadCsv.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  textFileName.textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = (e) => carregarCsv(e.target.result);
  reader.readAsText(file, "UTF-8");
});

function detectarSeparador(linha) {
  if (linha.includes(";")) return ";";
  if (linha.includes("\t")) return "\t";
  return ",";
}

function carregarCsv(texto) {
  const lines = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) {
    alert("Ficheiro CSV vazio!");
    return;
  }

  const separador = detectarSeparador(lines[0]);
  const headers = lines[0].split(separador);
  csvData = lines
    .slice(1)
    .map((line) => {
      const values = line.split(separador);
      if (values.length === headers.length)
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      return null;
    })
    .filter(Boolean);

  const sros = [...new Set(csvData.map((d) => d["sro_nome"]).filter(Boolean))].sort();
  if (csvData.some((d) => !d["sro_nome"])) sros.unshift("FastFiber");
  spinnerSro.innerHTML = sros.map((s) => `<option>${s}</option>`).join("");

  spinnerSro.addEventListener("change", updatePdos);
  spinnerSro.addEventListener("change", updateSplitters);
  spinnerPdo.addEventListener("change", updatePortos);
  updatePdos();
  updateSplitters();

  alert("Ficheiro carregado com sucesso!");
}

function updatePdos() {
  const selectedSro = spinnerSro.value;
  const pdos =
    selectedSro === "FastFiber"
      ? csvData.filter((d) => !d["sro_nome"]).map((d) => d["pdo_nome"])
      : csvData.filter((d) => d["sro_nome"] === selectedSro).map((d) => d["pdo_nome"]);

  const pdosUnicos = [...new Set(pdos)].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    return numA - numB;
  });
  spinnerPdo.innerHTML = pdosUnicos.map((p) => `<option>${p}</option>`).join("");
  updatePortos();
}

function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  if (!selectedPdo) return;
  const portos = csvData
    .filter((d) => d["pdo_nome"] === selectedPdo)
    .map((d) => d["porto_pdo"])
    .filter(Boolean)
    .sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
  spinnerPorto.innerHTML = [...new Set(portos)]
    .map((p) => `<option>${p}</option>`)
    .join("");
}

function updateSplitters() {
  const selectedSro = spinnerSro.value;
  const splittersRaw = csvData
    .filter((d) => d["sro_nome"] === selectedSro)
    .map((d) => d["sro_splitter"])
    .filter(Boolean);

  // Agrupar por tipo (S4, S8, S16, S32)
  const grupos = { S4: [], S8: [], S16: [], S32: [] };
  for (const s of splittersRaw) {
    const tipo = s.match(/S(4|8|16|32)/);
    if (!tipo) continue;
    const tipoChave = `S${tipo[1]}`;
    const base = s.split("_").slice(0, 2).join("_"); // Ex: S4_1
    if (!grupos[tipoChave].includes(base)) grupos[tipoChave].push(base);
  }

  for (const k in grupos) grupos[k].sort((a, b) => parseInt(a.split("_")[1]) - parseInt(b.split("_")[1]));

  const ordem = ["S4", "S8", "S16", "S32"];
  const splitters = ordem.flatMap((tipo) => grupos[tipo]);
  spinnerSplitter.innerHTML = splitters.map((s) => `<option>${s}</option>`).join("");
}

function toggleMode() {
  const splitter = spinnerSplitter.value;
  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;
  const sro = spinnerSro.value;

  if (splitter && sro !== "FastFiber") {
    spinnerPdo.disabled = true;
    spinnerPorto.disabled = true;
  } else {
    spinnerPdo.disabled = false;
    spinnerPorto.disabled = false;
  }

  if (pdo || porto || sro === "FastFiber") {
    spinnerSplitter.disabled = true;
  } else {
    spinnerSplitter.disabled = false;
  }
}

spinnerSplitter.addEventListener("change", toggleMode);
spinnerPdo.addEventListener("change", toggleMode);
spinnerPorto.addEventListener("change", toggleMode);
spinnerSro.addEventListener("change", toggleMode);

btnPesquisar.addEventListener("click", () => {
  if (!csvData.length) {
    alert("Carrega primeiro um ficheiro CSV.");
    return;
  }

  const sro = spinnerSro.value;
  const splitter = spinnerSplitter.value;
  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;

  // === MODO 2: SRO + Splitter ===
  if (splitter && sro !== "FastFiber") {
    const filtrado = csvData.filter(
      (d) => d["sro_nome"] === sro && d["sro_splitter"].startsWith(splitter)
    );

    if (!filtrado.length) {
      textResult.innerHTML = "Nenhum OUT encontrado para este Splitter.";
      return;
    }

    const outsMap = {};
    filtrado.forEach((d) => {
      const out = d["sro_secundario_pt"];
      const ocupado = d["id_servico"] ? true : false;
      if (!outsMap[out]) outsMap[out] = ocupado;
    });

    const outs = Object.keys(outsMap).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, "")) || 0;
      const nb = parseInt(b.replace(/\D/g, "")) || 0;
      return na - nb;
    });

    const html = outs
      .map((out) => {
        const estado = outsMap[out]
          ? "<span style='color:red;'>Ocupado</span>"
          : "<span style='color:lime;'>Livre</span>";
        return `<b>OUT SRO:</b> ${out} - ${estado}`;
      })
      .join("<br>");
    textResult.innerHTML = `<b>=== RESULTADO ===</b><br>${html}`;
    return;
  }

  // === MODO 1: SRO + PDO + PORTO (original) ===
  if (!pdo || !porto) {
    alert("Seleciona PDO e Porto.");
    return;
  }

  const results = csvData.filter(
    (d) =>
      ((d["sro_nome"] === sro) || (sro === "FastFiber" && !d["sro_nome"])) &&
      d["pdo_nome"] === pdo &&
      d["porto_pdo"] === porto
  );

  if (!results.length) {
    textResult.innerHTML = "Nenhuma linha encontrada para os valores indicados.";
    return;
  }

  const fibraColors = {
    1: "#FFFFFF", 2: "#FF0000", 3: "#00FF00", 4: "#0000FF", 5: "#000000",
    6: "#FFFF00", 7: "#FFA500", 8: "#808080", 9: "#8B4513",
    10: "#800080", 11: "#FFC0CB", 12: "#40E0D0"
  };
  const tuboColors = { ...fibraColors };

  const html = results.map((row) => {
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
          res += `${displayName}: ${valor} <font color='${corFibra}'>&#9679;</font> (Tubo ${tubo} <font color='${corTubo}'>&#9679;</font>)<br>`;
        } else res += `${displayName}: ${valor}<br>`;
      } else res += `${displayName}: ${valor}<br>`;
    }
    return res;
  }).join("<br>");
  textResult.innerHTML = html;
});
