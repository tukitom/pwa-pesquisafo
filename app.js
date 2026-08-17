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

const FIBRA_COLORS = {
  1:"#FFFFFF",2:"#FF0000",3:"#00FF00",4:"#0000FF",
  5:"#000000",6:"#FFFF00",7:"#FFA500",8:"#808080",
  9:"#8B4513",10:"#800080",11:"#FFC0CB",12:"#40E0D0"
};

const HISTORY_KEY = "fo_pesquisa_historico";
const HISTORY_MAX = 20;
const CSV_STORAGE_KEY = "fo_csv_raw";
const CSV_FILENAME_KEY = "fo_csv_filename";

// Evita que texto vindo do CSV (ou do histórico) seja interpretado como
// HTML/código ao ser inserido no ecrã — protege contra um valor "estranho"
// num ficheiro (ex: um campo com "<" ou ">") partir o resultado ou, no
// limite, correr código dentro da app.
function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Interpreta uma linha CSV respeitando campos entre aspas (ex: "Rua A; Nº 2"
// não deve ser cortado no ";" que está dentro das aspas).
function parseCsvLine(linha, separador) {
  const valores = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroAspas = !dentroAspas;
    } else if (c === separador && !dentroAspas) {
      valores.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  valores.push(atual);
  return valores;
}

let csvData = [];
const requiredCols = Object.keys(DISPLAY_NAMES);

// ---- Índices construídos ao carregar o CSV (pesquisa rápida mesmo com ficheiros grandes) ----
let idx = {
  bySro: new Map(),
  byJso: new Map(),
  byPdo: new Map(),
  byPdoPorto: new Map()
};

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
const resultActions = document.getElementById("resultActions");
const btnCopiar = document.getElementById("btnCopiar");
const btnPartilhar = document.getElementById("btnPartilhar");
const historyList = document.getElementById("historyList");
const btnClearHistory = document.getElementById("btnClearHistory");
const btnForgetCsv = document.getElementById("btnForgetCsv");

let ultimoResultadoTexto = "";

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

spinnerSro.addEventListener("change", handleSroChange);
spinnerJso.addEventListener("change", handleJsoChange);
spinnerPdo.addEventListener("change", updatePortos);

// ================= CSV =================
btnLoadCsv.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  textFileName.textContent = `📄 A carregar ${file.name}...`;
  textFileName.classList.remove("loaded");
  const reader = new FileReader();
  reader.onload = e => carregarCsv(e.target.result, file.name, true);
  reader.onerror = () => {
    textFileName.textContent = "❌ Erro a ler o ficheiro.";
  };
  reader.readAsText(file, "UTF-8");
});

if (btnForgetCsv) {
  btnForgetCsv.addEventListener("click", () => {
    if (!confirm("Esquecer o ficheiro guardado neste dispositivo?")) return;
    try {
      localStorage.removeItem(CSV_STORAGE_KEY);
      localStorage.removeItem(CSV_FILENAME_KEY);
    } catch (e) {}
    csvData = [];
    construirIndices();
    resetSpinners(false);
    textFileName.textContent = "Nenhum ficheiro carregado";
    textFileName.classList.remove("loaded");
    btnForgetCsv.style.display = "none";
  });
}

function detectarSeparador(linha) {
  if (linha.includes(";")) return ";";
  if (linha.includes("\t")) return "\t";
  return ",";
}

function carregarCsv(texto, nomeFicheiro, guardarLocal) {
  const lines = texto.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) { alert("Ficheiro CSV vazio!"); return; }

  const separador = detectarSeparador(lines[0]);
  const headers = parseCsvLine(lines[0], separador).map(h => h.trim());

  csvData = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], separador);
    if (values.length === headers.length) {
      const row = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j];
      csvData.push(row);
    }
  }

  construirIndices();
  resetSpinners(false);

  // SRO
  const sros = [...idx.bySro.keys()].sort();
  spinnerSro.innerHTML = `<option value="">-- Selecionar --</option>` +
    sros.map(s => `<option>${s}</option>`).join("");

  // JSO
  const jsos = [...idx.byJso.keys()]
    .filter(j => j.toUpperCase().startsWith("JSO"))
    .sort();

  spinnerJso.innerHTML = `<option value="">-- Selecionar --</option>` +
    jsos.map(j => `<option>${j}</option>`).join("");

  popularPdoCompleto();

  textFileName.textContent = `✅ ${nomeFicheiro} — ${csvData.length} linhas carregadas`;
  textFileName.classList.add("loaded");

  if (guardarLocal) {
    try {
      localStorage.setItem(CSV_STORAGE_KEY, texto);
      localStorage.setItem(CSV_FILENAME_KEY, nomeFicheiro);
      if (btnForgetCsv) btnForgetCsv.style.display = "inline-block";
    } catch (e) {
      // Ficheiro demasiado grande para guardar localmente — continua a funcionar só nesta sessão
      console.warn("Não foi possível guardar o CSV localmente:", e);
    }
  }
}

// Restaurar automaticamente o último CSV carregado (útil em mobile, onde a app
// é frequentemente recarregada e perderia o ficheiro em memória)
(function restaurarCsvGuardado() {
  try {
    const guardado = localStorage.getItem(CSV_STORAGE_KEY);
    const nome = localStorage.getItem(CSV_FILENAME_KEY) || "ficheiro guardado";
    if (guardado) {
      carregarCsv(guardado, nome, false);
      textFileName.textContent = `✅ ${nome} — ${csvData.length} linhas (restaurado)`;
      if (btnForgetCsv) btnForgetCsv.style.display = "inline-block";
    }
  } catch (e) {
    // localStorage indisponível (ex: modo privado) — sem problema, segue sem restauro
  }
})();


function construirIndices() {
  idx.bySro = new Map();
  idx.byJso = new Map();
  idx.byPdo = new Map();
  idx.byPdoPorto = new Map();

  for (const row of csvData) {
    const sro = row["sro_nome"];
    const jso = row["jso_nome"];
    const pdo = row["pdo_nome"];
    const porto = row["porto_pdo"];

    if (sro) {
      if (!idx.bySro.has(sro)) idx.bySro.set(sro, []);
      idx.bySro.get(sro).push(row);
    }
    if (jso) {
      if (!idx.byJso.has(jso)) idx.byJso.set(jso, []);
      idx.byJso.get(jso).push(row);
    }
    if (pdo) {
      if (!idx.byPdo.has(pdo)) idx.byPdo.set(pdo, []);
      idx.byPdo.get(pdo).push(row);
    }
    if (pdo && porto) {
      const key = pdo + "|||" + porto;
      if (!idx.byPdoPorto.has(key)) idx.byPdoPorto.set(key, []);
      idx.byPdoPorto.get(key).push(row);
    }
  }
}

function ordenarNumerico(lista) {
  return lista.sort((a, b) => {
    const numA = parseInt(String(a).replace(/\D/g, "")) || 0;
    const numB = parseInt(String(b).replace(/\D/g, "")) || 0;
    return numA - numB;
  });
}

// Lista completa de PDOs (usada quando ainda não escolheste um SRO/JSO,
// e restaurada sempre que limpas essa escolha — permite também pesquisar
// diretamente por PDO, e é essencial para o histórico conseguir "reabrir"
// pesquisas feitas em modo PDO/Porto).
function popularPdoCompleto() {
  const pdosTodos = ordenarNumerico([...idx.byPdo.keys()]);
  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>` +
    pdosTodos.map(p => `<option>${p}</option>`).join("");
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
}

// ================= SRO =================
function handleSroChange() {
  const selectedSro = spinnerSro.value;

  if (selectedSro) spinnerJso.disabled = true;
  else spinnerJso.disabled = false;

  spinnerSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;

  if (!selectedSro) {
    popularPdoCompleto();
    return;
  }

  const rows = idx.bySro.get(selectedSro) || [];
  const pdosUnicos = ordenarNumerico([...new Set(rows.map(d => d["pdo_nome"]).filter(Boolean))]);

  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>` +
    pdosUnicos.map(p => `<option>${p}</option>`).join("");
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;

  preencherSplitters(rows, "sro_splitter", spinnerSplitter);
}

// ================= JSO =================
function handleJsoChange() {
  const selectedJso = spinnerJso.value;

  if (selectedJso) spinnerSro.disabled = true;
  else spinnerSro.disabled = false;

  spinnerJsoSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;

  if (!selectedJso) {
    popularPdoCompleto();
    return;
  }

  const rows = idx.byJso.get(selectedJso) || [];
  const pdosUnicos = ordenarNumerico([...new Set(rows.map(d => d["pdo_nome"]).filter(Boolean))]);

  spinnerPdo.innerHTML = `<option value="">-- Selecionar --</option>` +
    pdosUnicos.map(p => `<option>${p}</option>`).join("");
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;

  preencherSplitters(rows, "jso_splitter", spinnerJsoSplitter);
}

// ================= SPLITTERS =================
function preencherSplitters(rows, campoSplitter, spinner) {
  const splitters = rows
    .filter(d => d[campoSplitter])
    .map(d => {
      const match = d[campoSplitter].match(/(S\d+_\d+)/);
      return match ? match[1] : d[campoSplitter];
    });

  const ordem = { S4: 1, S8: 2, S16: 3, S32: 4 };

  const splittersUnicos = [...new Set(splitters)]
    .sort((a, b) => {
      const tipoA = a.match(/S\d+/)?.[0] || "";
      const tipoB = b.match(/S\d+/)?.[0] || "";
      if (ordem[tipoA] !== ordem[tipoB]) return (ordem[tipoA] || 99) - (ordem[tipoB] || 99);
      const numA = parseInt(a.split("_")[1] || 0);
      const numB = parseInt(b.split("_")[1] || 0);
      return numA - numB;
    });

  spinner.innerHTML += splittersUnicos.map(s => `<option>${s}</option>`).join("");
}

// ================= PORTOS =================
function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
  if (!selectedPdo) return;

  const rows = idx.byPdo.get(selectedPdo) || [];
  const portos = rows.map(d => d["porto_pdo"]).filter(Boolean)
    .sort((a, b) => parseInt(a) - parseInt(b));

  spinnerPorto.innerHTML += [...new Set(portos)].map(p => `<option>${p}</option>`).join("");
}

function corFibraETubo(numeroStr) {
  const numeroFibra = parseInt(numeroStr) || 0;
  const corIndexFibra = ((numeroFibra - 1) % 12) + 1;
  const corFibra = FIBRA_COLORS[corIndexFibra] || "#FFF";
  const tubo = Math.floor((numeroFibra - 1) / 12) + 1;
  const corTubo = FIBRA_COLORS[((tubo - 1) % 12) + 1] || "#FFF";
  return { numeroFibra, corFibra, tubo, corTubo };
}

// Monta uma linha de resultado para um OUT (SRO ou JSO), incluindo a cor/número
// da fibra e do tubo no PDO, e agrupando todos os portos numa única linha quando
// o PDO tem o seu próprio splitter (vários portos para a mesma fibra recebida).
function montarLinhaOut(headerLabel, headerDots, item, statusLabel, statusClass) {
  let headerHtml = escapeHtml(headerLabel);
  if (headerDots) {
    headerHtml += ` <span class="dot" style="background:${headerDots.corFibra}"></span> `
      + `<small style="color:var(--text-dim);font-weight:400;">Tubo ${headerDots.tubo}</small> `
      + `<span class="dot" style="background:${headerDots.corTubo}"></span>`;
  }

  const portosArray = [...item.portos].sort((a, b) => parseInt(a) - parseInt(b));
  const portosLabel = portosArray.length > 1 ? "Portos" : "Porto";
  const portosValor = portosArray.length ? portosArray.map(escapeHtml).join(", ") : "?";

  const pdoDots = corFibraETubo(item.pdoPtfo);
  const temFibraPdo = pdoDots.numeroFibra > 0;
  const pdoNomeSeguro = escapeHtml(item.pdo);
  const pdoPtfoSeguro = escapeHtml(item.pdoPtfo);

  let html = `<div class="result-item">`;
  html += `<div class="result-header">${headerHtml}</div>`;
  html += `<div class="result-badges"><span class="badge ${statusClass}">${statusLabel}</span></div>`;
  html += `<div class="kv-row"><span class="kv-label">PDO</span><span class="kv-value">${pdoNomeSeguro}</span></div>`;
  if (temFibraPdo) {
    html += `<div class="kv-row"><span class="kv-label">Fibra no PDO</span>`
      + `<span class="kv-value">${pdoPtfoSeguro} <span class="dot" style="background:${pdoDots.corFibra}"></span> `
      + `<small style="color:var(--text-dim);font-weight:400;">Tubo ${pdoDots.tubo}</small> `
      + `<span class="dot" style="background:${pdoDots.corTubo}"></span></span></div>`;
  }
  html += `<div class="kv-row"><span class="kv-label">${portosLabel}</span><span class="kv-value">${portosValor}</span></div>`;
  html += `</div>`;

  let texto = `PDO ${item.pdo}`;
  if (temFibraPdo) texto += ` | Fibra PDO ${item.pdoPtfo} (Tubo ${pdoDots.tubo})`;
  texto += ` | ${portosLabel} ${portosArray.join(", ") || "?"} | ${statusLabel}`;

  return { html, texto };
}

// ================= PESQUISA =================
btnPesquisar.addEventListener("click", () => executarPesquisa(true));

function executarPesquisa(guardarHistorico) {
  if (!csvData.length) {
    alert("Carrega primeiro um ficheiro CSV.");
    return;
  }

  const sro = spinnerSro.value;
  const splitter = spinnerSplitter.value;

  const jso = spinnerJso.value;
  const jsoSplitter = spinnerJsoSplitter.value;

  const pdo = spinnerPdo.value;
  const porto = spinnerPorto.value;

  // --- JSO + SPLITTER ---
  if (jsoSplitter) {
    const rows = (idx.byJso.get(jso) || []).filter(d =>
      d["jso_splitter"]?.startsWith(jsoSplitter + "_")
    );

    if (!rows.length) {
      mostrarResultado("Nenhuma linha encontrada para a JSO e Splitter selecionados.", "");
      return;
    }

    const outMap = {};
    rows.forEach(d => {
      const out = d["jso_ptfo"];
      const ocupado = d["id_servico"] && d["id_servico"].trim() !== "";
      if (!outMap[out]) {
        outMap[out] = {
          ocupado, pdo: d["pdo_nome"],
          portos: new Set(),
          pdoPtfo: d["pdo_ptfo"],
          pdoSplitter: d["pdo_splitter"]
        };
      } else {
        outMap[out].ocupado = outMap[out].ocupado || ocupado;
      }
      if (d["porto_pdo"]) outMap[out].portos.add(d["porto_pdo"]);
    });

    let html = `<div class="result-title">🔌 JSO ${escapeHtml(jso)} · Splitter ${escapeHtml(jsoSplitter)}</div>`;
    let texto = `RESULTADO JSO ${jso} — Splitter ${jsoSplitter}\n`;

    Object.keys(outMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(out => {
        const { corFibra, tubo, corTubo } = corFibraETubo(out);
        const item = outMap[out];
        const statusLabel = item.ocupado ? "Ocupado" : "Livre";
        const statusClass = item.ocupado ? "badge-ocupado" : "badge-livre";
        const { html: itemHtml, texto: itemTexto } = montarLinhaOut(
          `OUT JSO ${out}`, { corFibra, tubo, corTubo }, item, statusLabel, statusClass
        );
        html += itemHtml;
        texto += `OUT JSO ${out} | ${itemTexto}\n`;
      });

    mostrarResultado(html, texto);
    if (guardarHistorico) guardarNoHistorico(`JSO ${jso} · Splitter ${jsoSplitter}`, { jso, jsoSplitter });
    return;
  }

  // --- SRO + SPLITTER ---
  if (splitter) {
    const rows = (idx.bySro.get(sro) || []).filter(d =>
      d["sro_splitter"]?.startsWith(splitter + "_")
    );

    if (!rows.length) {
      mostrarResultado("Nenhuma linha encontrada para o SRO e Splitter selecionados.", "");
      return;
    }

    const outMap = {};
    rows.forEach(d => {
      const out = d["sro_secundario_pt"];
      const ocupado = d["id_servico"] && d["id_servico"].trim() !== "";
      if (!outMap[out]) {
        outMap[out] = {
          ocupado, pdo: d["pdo_nome"],
          portos: new Set(),
          pdoPtfo: d["pdo_ptfo"],
          pdoSplitter: d["pdo_splitter"]
        };
      } else {
        outMap[out].ocupado = outMap[out].ocupado || ocupado;
      }
      if (d["porto_pdo"]) outMap[out].portos.add(d["porto_pdo"]);
    });

    let html = `<div class="result-title">🔌 SRO ${escapeHtml(sro)} · Splitter ${escapeHtml(splitter)}</div>`;
    let texto = `RESULTADO SRO ${sro} — Splitter ${splitter}\n`;

    Object.keys(outMap)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach(out => {
        const item = outMap[out];
        const statusLabel = item.ocupado ? "Ocupado" : "Livre";
        const statusClass = item.ocupado ? "badge-ocupado" : "badge-livre";
        const { html: itemHtml, texto: itemTexto } = montarLinhaOut(
          `OUT SRO ${out}`, null, item, statusLabel, statusClass
        );
        html += itemHtml;
        texto += `OUT SRO ${out} | ${itemTexto}\n`;
      });

    mostrarResultado(html, texto);
    if (guardarHistorico) guardarNoHistorico(`SRO ${sro} · Splitter ${splitter}`, { sro, splitter });
    return;
  }

  // --- TODOS OS PORTOS DE UM PDO (PDO escolhido, sem Porto específico) ---
  if (pdo && !porto) {
    const rowsPdo = idx.byPdo.get(pdo) || [];
    if (!rowsPdo.length) {
      mostrarResultado("Nenhuma linha encontrada para este PDO.", "");
      return;
    }

    // Agrupar por splitter no PDO: quando existe um splitter, todos os portos
    // alimentados pela mesma fibra ficam juntos num só campo (em vez de repetir
    // a fibra/tubo em cada porto separadamente).
    const grupos = {};
    rowsPdo.forEach(d => {
      const p = d["porto_pdo"];
      if (!p) return;
      const ocupado = d["id_servico"] && d["id_servico"].trim() !== "";
      const splitter = d["pdo_splitter"] || "";
      const chave = splitter || ("individual-" + p);

      if (!grupos[chave]) {
        grupos[chave] = { splitter, pdoPtfo: d["pdo_ptfo"] || "", portos: {}, ordem: parseInt(p) || 0 };
      }
      const g = grupos[chave];
      g.ordem = Math.min(g.ordem, parseInt(p) || g.ordem);
      if (!g.portos[p] || (ocupado && !g.portos[p].ocupado)) {
        g.portos[p] = { ocupado, idServico: d["id_servico"] || "" };
      }
    });

    let html = `<div class="result-title">📦 Todos os Portos — PDO ${escapeHtml(pdo)}</div>`;
    let texto = `TODOS OS PORTOS — PDO ${pdo}\n`;

    Object.values(grupos)
      .sort((a, b) => a.ordem - b.ordem)
      .forEach(g => {
        const portosOrdenados = Object.keys(g.portos).sort((a, b) => parseInt(a) - parseInt(b));
        const { numeroFibra, corFibra, tubo, corTubo } = corFibraETubo(g.pdoPtfo);

        const matchSplitter = g.splitter.match(/S(\d+)_(\d+)/);
        const splitterLabel = matchSplitter
          ? `${matchSplitter[2]}º Splitter de ${matchSplitter[1]} portas`
          : "";

        const headerTexto = portosOrdenados.length > 1
          ? `Portos ${portosOrdenados.join(", ")}`
          : `Porto ${portosOrdenados[0]}`;

        html += `<div class="result-item">`;
        html += `<div class="result-header">${escapeHtml(headerTexto)}</div>`;
        if (splitterLabel) {
          html += `<div class="result-badges"><span class="badge badge-op">${escapeHtml(splitterLabel)}</span></div>`;
        }
        if (numeroFibra > 0) {
          html += `<div class="kv-row"><span class="kv-label">Fibra no PDO</span>`
            + `<span class="kv-value">${escapeHtml(g.pdoPtfo)} <span class="dot" style="background:${corFibra}"></span> `
            + `<small style="color:var(--text-dim);font-weight:400;">Tubo ${tubo}</small> `
            + `<span class="dot" style="background:${corTubo}"></span></span></div>`;
        }

        texto += headerTexto + (splitterLabel ? ` (${splitterLabel})` : "")
          + (numeroFibra > 0 ? ` | Fibra PDO ${g.pdoPtfo} (Tubo ${tubo})` : "") + "\n";

        portosOrdenados.forEach(p => {
          const item = g.portos[p];
          const statusLabel = item.ocupado ? "Ocupado" : "Livre";
          const statusClass = item.ocupado ? "badge-ocupado" : "badge-livre";
          html += `<div class="kv-row"><span class="kv-label">Porto ${escapeHtml(p)}</span>`
            + `<span class="kv-value"><span class="badge ${statusClass}">${statusLabel}</span>`
            + (item.ocupado && item.idServico ? ` <small style="color:var(--text-dim);">ID ${escapeHtml(item.idServico)}</small>` : "")
            + `</span></div>`;
          texto += `  Porto ${p} | ${statusLabel}` + (item.ocupado && item.idServico ? ` | ID ${item.idServico}` : "") + "\n";
        });

        html += `</div>`;
      });

    mostrarResultado(html, texto);
    if (guardarHistorico) guardarNoHistorico(`Todos os portos · PDO ${pdo}`, { pdo });
    return;
  }

  // --- MODO PDO ---
  if (!pdo || !porto) {
    alert("Seleciona PDO e Porto, ou escolhe um splitter.");
    return;
  }

  const rows = idx.byPdoPorto.get(pdo + "|||" + porto) || [];

  if (!rows.length) {
    mostrarResultado("Nenhuma linha encontrada.", "");
    return;
  }

  let html = `<div class="result-title">📦 PDO ${escapeHtml(pdo)} · Porto ${escapeHtml(porto)}</div>`;
  let texto = "RESULTADO\n";

  const otherFieldsSro = ["id_servico", "sro_nome", "sro_splitter", "sro_secundario_pt", "pdo_splitter"];
  const otherFieldsJso = ["id_servico", "jso_nome", "jso_splitter", "jso_ptfo", "pdo_splitter"];

  rows.forEach(row => {
    const ocupado = row["id_servico"] && row["id_servico"].trim() !== "";
    const statusLabel = ocupado ? "Ocupado" : "Livre";
    const statusClass = ocupado ? "badge-ocupado" : "badge-livre";

    const estado = row["estado_operacional_porto"] || "";
    const estadoClass = estado === "Manutenção" ? "badge-warning"
      : estado === "Construção" ? "badge-info"
      : "badge-op";

    const operadora = row["beneficiario_porto"] || "";

    const viaJso = row["jso_nome"] && row["jso_nome"].toUpperCase().startsWith("JSO");
    const otherFields = viaJso ? otherFieldsJso : otherFieldsSro;

    const { numeroFibra, corFibra, tubo, corTubo } = corFibraETubo(row["pdo_ptfo"]);

    html += `<div class="result-item">`;
    html += `<div class="result-badges">`
      + `<span class="badge ${statusClass}">${statusLabel}</span>`
      + (estado ? `<span class="badge ${estadoClass}">${escapeHtml(estado)}</span>` : "")
      + (operadora ? `<span class="badge badge-op">${escapeHtml(operadora)}</span>` : "")
      + `</div>`;

    if (numeroFibra > 0) {
      html += `<div class="kv-row"><span class="kv-label">${DISPLAY_NAMES["pdo_ptfo"]}</span>`
        + `<span class="kv-value">${escapeHtml(row["pdo_ptfo"])} <span class="dot" style="background:${corFibra}"></span> `
        + `<small style="color:var(--text-dim);font-weight:400;">Tubo ${tubo}</small> <span class="dot" style="background:${corTubo}"></span></span></div>`;
    }

    otherFields.forEach(col => {
      const valor = row[col] || "—";
      html += `<div class="kv-row"><span class="kv-label">${DISPLAY_NAMES[col]}</span><span class="kv-value">${escapeHtml(valor)}</span></div>`;
      texto += `${DISPLAY_NAMES[col]}: ${valor}\n`;
    });

    texto += `${DISPLAY_NAMES["pdo_ptfo"]}: ${row["pdo_ptfo"] || ""}\n`;
    texto += `Estado Porto: ${estado}\n`;
    texto += `Operadora: ${operadora}\n`;
    texto += `Status: ${statusLabel}\n\n`;

    html += `</div>`;
  });

  mostrarResultado(html, texto);
  if (guardarHistorico) guardarNoHistorico(`PDO ${pdo} · Porto ${porto}`, { pdo, porto });
}

function mostrarResultado(html, textoPlano) {
  textResult.innerHTML = html;
  ultimoResultadoTexto = textoPlano;
  resultActions.style.display = textoPlano ? "flex" : "none";
}

// ================= COPIAR / PARTILHAR =================
btnCopiar.addEventListener("click", async () => {
  if (!ultimoResultadoTexto) return;
  try {
    await navigator.clipboard.writeText(ultimoResultadoTexto);
    btnCopiar.textContent = "✅ Copiado!";
    setTimeout(() => (btnCopiar.textContent = "📋 Copiar"), 1500);
  } catch (e) {
    alert("Não foi possível copiar automaticamente. Seleciona o texto manualmente.");
  }
});

btnPartilhar.addEventListener("click", async () => {
  if (!ultimoResultadoTexto) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Resultado Pesquisa F.O", text: ultimoResultadoTexto });
    } catch (e) { /* utilizador cancelou */ }
  } else {
    try {
      await navigator.clipboard.writeText(ultimoResultadoTexto);
      alert("Partilha direta não suportada neste dispositivo. Texto copiado para a área de transferência.");
    } catch (e) {
      alert("Partilha não suportada neste dispositivo.");
    }
  }
});

// ================= HISTÓRICO =================
function lerHistorico() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function guardarNoHistorico(label, criteria) {
  const historico = lerHistorico();

  // Evita duplicados: se já existe uma entrada igual, remove-a antes de a
  // voltar a colocar no topo (assim fica "atualizada" em vez de repetida).
  const chaveNova = JSON.stringify(criteria);
  const semDuplicado = historico.filter(h => JSON.stringify(h.criteria) !== chaveNova);

  semDuplicado.unshift({ label, criteria, ts: Date.now() });
  const cortado = semDuplicado.slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(cortado));
  } catch (e) {
    console.warn("Não foi possível guardar o histórico:", e);
  }
  renderizarHistorico();
}

function formatarData(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderizarHistorico() {
  const historico = lerHistorico();
  if (!historico.length) {
    historyList.innerHTML = `<div class="history-empty">Ainda sem pesquisas guardadas.</div>`;
    return;
  }
  historyList.innerHTML = historico.map((h, i) => `
    <div class="history-item" data-index="${i}">
      <div>${escapeHtml(h.label)}<small>${formatarData(h.ts)}</small></div>
      <span>↺</span>
    </div>
  `).join("");

  historyList.querySelectorAll(".history-item").forEach(el => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.index);
      repetirPesquisa(historico[i]);
    });
  });
}

function repetirPesquisa(item) {
  if (!csvData.length) {
    alert("Carrega o ficheiro CSV antes de repetir esta pesquisa.");
    return;
  }
  const c = item.criteria;

  resetSelects();

  if (c.sro) {
    spinnerSro.value = c.sro;
    handleSroChange();
    if (c.splitter) spinnerSplitter.value = c.splitter;
  } else if (c.jso) {
    spinnerJso.value = c.jso;
    handleJsoChange();
    if (c.jsoSplitter) spinnerJsoSplitter.value = c.jsoSplitter;
  } else if (c.pdo) {
    spinnerPdo.value = c.pdo;
    updatePortos();
    if (c.porto) spinnerPorto.value = c.porto;
  }

  executarPesquisa(false);
  window.scrollTo({ top: textResult.offsetTop - 20, behavior: "smooth" });
}

function resetSelects() {
  spinnerSro.value = "";
  spinnerJso.value = "";
  spinnerSro.disabled = false;
  spinnerJso.disabled = false;
  spinnerSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerSplitter.value = "";
  spinnerJsoSplitter.innerHTML = `<option value="">-- Selecionar --</option>`;
  spinnerJsoSplitter.value = "";
  popularPdoCompleto();
  spinnerPdo.value = "";
  spinnerPorto.value = "";
}

btnClearHistory.addEventListener("click", () => {
  if (!confirm("Limpar todo o histórico de pesquisas?")) return;
  localStorage.removeItem(HISTORY_KEY);
  renderizarHistorico();
});

const btnLimparTudo = document.getElementById("btnLimparTudo");
if (btnLimparTudo) {
  btnLimparTudo.addEventListener("click", () => {
    resetSelects();
    mostrarResultado("", "");
  });
}

renderizarHistorico();
