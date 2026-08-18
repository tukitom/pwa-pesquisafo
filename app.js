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

// Nomes das cores para usar em texto (partilhado/copiado) — o código hex de
// FIBRA_COLORS só serve para pintar o "pontinho" no ecrã; em texto simples
// (WhatsApp, SMS, etc.) isso perde-se todo, por isso precisamos do nome.
// Formas femininas para "fibra" (a fibra vermelha) e masculinas para "tubo"
// (o tubo vermelho) — mesma paleta usada na Calculadora.
const CORES_FIBRA_FEM = {
  1:"Branca",2:"Vermelha",3:"Verde",4:"Azul",5:"Preta",6:"Amarela",
  7:"Laranja",8:"Cinzenta",9:"Castanha",10:"Violeta",11:"Rosa",12:"Turquesa"
};
const CORES_TUBO_MASC = {
  1:"Branco",2:"Vermelho",3:"Verde",4:"Azul",5:"Preto",6:"Amarelo",
  7:"Laranja",8:"Cinzento",9:"Castanho",10:"Violeta",11:"Rosa",12:"Turquesa"
};

const HISTORY_KEY = "fo_pesquisa_historico";
const HISTORY_MAX = 20;
const CSV_STORAGE_KEY = "fo_csv_raw";
const CSV_FILENAME_KEY = "fo_csv_filename";
const CSV_LOADED_AT_KEY = "fo_csv_loaded_at";

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
  byPdoPorto: new Map(),
  byPdoLower: new Map()
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
const csvAgeWarning = document.getElementById("csvAgeWarning");
const labelSoLivres = document.getElementById("labelSoLivres");

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
  reader.onload = e => {
    const texto = decodificarTexto(e.target.result);
    carregarCsv(texto, file.name, true);
  };
  reader.onerror = () => {
    textFileName.textContent = "❌ Erro a ler o ficheiro.";
  };
  // Lemos como bytes em bruto (não como texto) para podermos decidir nós
  // próprios a codificação — ver decodificarTexto().
  reader.readAsArrayBuffer(file);
});

// Alguns exports (ex: sistemas legados) vêm em ISO-8859-1/Windows-1252 em vez
// de UTF-8; ler sempre como UTF-8 corrompia acentos (ex: "Serviço" ficava
// "ServiÃ§o"). Aqui tentamos UTF-8 em modo "fatal" — se o ficheiro tiver bytes
// que não são UTF-8 válido, cai automaticamente para Windows-1252, que lê
// corretamente a acentuação latina destes exports.
function decodificarTexto(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (e) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

if (btnForgetCsv) {
  btnForgetCsv.addEventListener("click", () => {
    if (!confirm("Esquecer o ficheiro guardado neste dispositivo?")) return;
    try {
      localStorage.removeItem(CSV_STORAGE_KEY);
      localStorage.removeItem(CSV_FILENAME_KEY);
      localStorage.removeItem(CSV_LOADED_AT_KEY);
    } catch (e) {}
    csvData = [];
    construirIndices();
    resetSpinners(false);
    textFileName.textContent = "Nenhum ficheiro carregado";
    textFileName.classList.remove("loaded");
    if (csvAgeWarning) csvAgeWarning.style.display = "none";
    if (labelSoLivres) labelSoLivres.style.display = "none";
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

  // Se faltarem colunas essenciais (ex: ficheiro errado ou exportado de forma
  // diferente), a pesquisa ficaria sempre vazia sem se perceber porquê —
  // por isso avisamos já aqui, com o nome das colunas em falta.
  const colunasEmFalta = requiredCols.filter(c => !headers.includes(c));
  if (colunasEmFalta.length) {
    alert(
      `⚠️ Este ficheiro não parece ser um export válido: faltam ${colunasEmFalta.length} coluna(s) esperada(s):\n\n` +
      colunasEmFalta.join(", ") +
      `\n\nVerifica se carregaste o ficheiro certo.`
    );
    textFileName.textContent = "❌ Ficheiro com colunas em falta — não foi carregado.";
    textFileName.classList.remove("loaded");
    return;
  }

  const csvDataAnterior = csvData;
  csvData = [];
  let linhasIgnoradas = 0;
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], separador);
    if (values.length === headers.length) {
      const row = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j];
      csvData.push(row);
    } else {
      // Nº de colunas não bate certo com o cabeçalho (ex: separador dentro
      // de um campo não escapado entre aspas) — a linha é ignorada em vez de
      // partir a app, mas o utilizador é avisado de que faltam dados.
      linhasIgnoradas++;
    }
  }

  if (linhasIgnoradas > 0) {
    console.warn(`[CSV] ${linhasIgnoradas} linha(s) ignorada(s) por não terem o número de colunas esperado.`);
  }

  // Ficheiro só com cabeçalho (ou onde todas as linhas de dados foram
  // ignoradas por má formação) — mantém os dados anteriores em vez de
  // apagar uma pesquisa que já estava a funcionar, e avisa claramente
  // em vez de mostrar "0 linhas carregadas" com um ✅ como se estivesse tudo bem.
  if (csvData.length === 0) {
    csvData = csvDataAnterior;
    alert("Este ficheiro não tem nenhuma linha de dados válida (só o cabeçalho, ou todas as linhas estão mal formadas). O ficheiro anterior foi mantido.");
    textFileName.textContent = "❌ Ficheiro sem dados válidos — não foi carregado.";
    textFileName.classList.remove("loaded");
    return;
  }

  construirIndices();
  resetSpinners(false);

  // SRO
  const sros = [...idx.bySro.keys()].sort();
  spinnerSro.innerHTML = `<option value="">-- Selecionar --</option>` +
    sros.map(s => `<option>${escapeHtml(s)}</option>`).join("");

  // JSO
  const jsos = [...idx.byJso.keys()]
    .filter(j => j.toUpperCase().startsWith("JSO"))
    .sort();

  spinnerJso.innerHTML = `<option value="">-- Selecionar --</option>` +
    jsos.map(j => `<option>${escapeHtml(j)}</option>`).join("");

  popularPdoCompleto();

  textFileName.textContent = linhasIgnoradas > 0
    ? `⚠️ ${nomeFicheiro} — ${csvData.length} linhas carregadas (${linhasIgnoradas} ignoradas por erro de formato)`
    : `✅ ${nomeFicheiro} — ${csvData.length} linhas carregadas`;
  textFileName.classList.add("loaded");
  if (labelSoLivres) labelSoLivres.style.display = "flex";

  if (guardarLocal) {
    try {
      localStorage.setItem(CSV_STORAGE_KEY, texto);
      localStorage.setItem(CSV_FILENAME_KEY, nomeFicheiro);
      localStorage.setItem(CSV_LOADED_AT_KEY, String(Date.now()));
      if (btnForgetCsv) btnForgetCsv.style.display = "inline-block";
    } catch (e) {
      // Ficheiro demasiado grande para guardar localmente — continua a funcionar só nesta sessão
      console.warn("Não foi possível guardar o CSV localmente:", e);
    }
  }
  mostrarAvisoIdadeCsv();
}

function mostrarAvisoIdadeCsv() {
  if (!csvAgeWarning) return;
  let carregadoEm = null;
  try { carregadoEm = parseInt(localStorage.getItem(CSV_LOADED_AT_KEY)); } catch (e) {}
  if (!carregadoEm) { csvAgeWarning.style.display = "none"; return; }

  const dataCarregado = new Date(carregadoEm);
  const agora = new Date();

  // Diferença em meses de calendário (ex: carregado em junho, estamos em agosto -> 2 meses)
  const diffMeses = (agora.getFullYear() - dataCarregado.getFullYear()) * 12
    + (agora.getMonth() - dataCarregado.getMonth());

  if (diffMeses >= 1) {
    const nomesMeses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const mesCarregado = nomesMeses[dataCarregado.getMonth()];
    const textoMeses = diffMeses === 1 ? "há 1 mês" : `há ${diffMeses} meses`;
    csvAgeWarning.textContent = `⚠️ Este ficheiro é de ${mesCarregado} (${textoMeses}) — considera carregar uma versão mais recente.`;
    csvAgeWarning.style.display = "block";
  } else {
    csvAgeWarning.style.display = "none";
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
      // Só sobrescrevemos a mensagem se o ficheiro guardado passou a validação
      // (csvData preenchido) — caso contrário fica visível o aviso de erro.
      if (csvData.length) {
        textFileName.textContent = `✅ ${nome} — ${csvData.length} linhas (restaurado)`;
      }
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
  // Mapeia "pdo1071" -> "PDO1071" (nome real, tal como está no CSV). Serve
  // para o link vindo do Mapa continuar a funcionar mesmo que o nome do
  // ponto lá esteja escrito com maiúsculas/minúsculas diferentes (ex:
  // "Pdo1071" no mapa vs "PDO1071" no CSV) — sem isto, esse link diz
  // "PDO não encontrado" apesar de o PDO existir.
  idx.byPdoLower = new Map();

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
      if (!idx.byPdoLower.has(pdo.toLowerCase())) idx.byPdoLower.set(pdo.toLowerCase(), pdo);
      // Também sem espaços, para aguentar erros de escrita tipo "PDO 1105"
      // em vez de "PDO1105" nos pontos do mapa.
      const semEspacos = pdo.toLowerCase().replace(/\s+/g, "");
      if (!idx.byPdoLower.has(semEspacos)) idx.byPdoLower.set(semEspacos, pdo);
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
    pdosTodos.map(p => `<option>${escapeHtml(p)}</option>`).join("");
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
    pdosUnicos.map(p => `<option>${escapeHtml(p)}</option>`).join("");
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
    pdosUnicos.map(p => `<option>${escapeHtml(p)}</option>`).join("");
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

  spinner.innerHTML += splittersUnicos.map(s => `<option>${escapeHtml(s)}</option>`).join("");
}

// ================= PORTOS =================
function updatePortos() {
  const selectedPdo = spinnerPdo.value;
  spinnerPorto.innerHTML = `<option value="">-- Selecionar --</option>`;
  if (!selectedPdo) return;

  const rows = idx.byPdo.get(selectedPdo) || [];
  const portos = rows.map(d => d["porto_pdo"]).filter(Boolean)
    .sort((a, b) => parseInt(a) - parseInt(b));

  spinnerPorto.innerHTML += [...new Set(portos)].map(p => `<option>${escapeHtml(p)}</option>`).join("");
}

function corFibraETubo(numeroStr) {
  const numeroFibra = parseInt(numeroStr) || 0;
  const corIndexFibra = ((numeroFibra - 1) % 12) + 1;
  const corFibra = FIBRA_COLORS[corIndexFibra] || "#FFF";
  const corFibraNome = CORES_FIBRA_FEM[corIndexFibra] || "";
  const tubo = Math.floor((numeroFibra - 1) / 12) + 1;
  const corTuboIndex = ((tubo - 1) % 12) + 1;
  const corTubo = FIBRA_COLORS[corTuboIndex] || "#FFF";
  const corTuboNome = CORES_TUBO_MASC[corTuboIndex] || "";
  return { numeroFibra, corFibra, corFibraNome, tubo, corTubo, corTuboNome };
}

// ================= FORMATAÇÃO DO TEXTO PARTILHADO =================
// O texto copiado/partilhado (WhatsApp, SMS, etc.) é sempre reconstruído do
// zero aqui — só isto é que aparece fora da app, por isso tem de fazer
// sentido sozinho: título, quando foi feito, e um resumo claro por item
// (uma linha por campo, em vez de tudo espremido numa única linha com "|").
const SEPARADOR_PARTILHA = "──────────────";

function statusEmoji(ocupado) {
  return ocupado ? "🔴" : "🟢";
}

function agoraFormatado() {
  return new Date().toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function cabecalhoPartilha(tituloLinha, resumoLinha) {
  let cab = `🧵 PESQUISA F.O\n${tituloLinha}\n🕒 ${agoraFormatado()}\n${SEPARADOR_PARTILHA}\n`;
  if (resumoLinha) cab += `${resumoLinha}\n${SEPARADOR_PARTILHA}\n`;
  return cab;
}

function rodapePartilha() {
  return `\n${SEPARADOR_PARTILHA}\nEnviado via app Pesquisa F.O`;
}

// Formata a fibra/tubo de um PDO como texto legível (com nome da cor, não só
// o código hex que só serve para pintar o ecrã).
function fibraTuboTexto(numeroStr, label = "Fibra") {
  const d = corFibraETubo(numeroStr);
  if (d.numeroFibra <= 0) return "";
  return `${label}: ${numeroStr} — ${d.corFibraNome} (Tubo ${d.tubo} — ${d.corTuboNome})`;
}


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

  let texto = `🔌 ${headerLabel}`;
  if (headerDots && headerDots.numeroFibra > 0) {
    texto += ` — ${headerDots.corFibraNome} (Tubo ${headerDots.tubo} — ${headerDots.corTuboNome})`;
  }
  texto += `\n   Estado: ${statusEmoji(item.ocupado)} ${statusLabel}`;
  texto += `\n   PDO: ${item.pdo}`;
  const linhaFibraPdo = fibraTuboTexto(item.pdoPtfo, "Fibra no PDO");
  if (linhaFibraPdo) texto += `\n   ${linhaFibraPdo}`;
  texto += `\n   ${portosLabel}: ${portosArray.join(", ") || "?"}`;

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

    const totalOuts = Object.keys(outMap).length;
    const totalOcupados = Object.values(outMap).filter(o => o.ocupado).length;
    const totalLivres = totalOuts - totalOcupados;
    const resumo = `🟢 ${totalLivres} livres  ·  🔴 ${totalOcupados} ocupados`;
    let texto = cabecalhoPartilha(`JSO ${jso} · Splitter ${jsoSplitter}`, resumo);
    const blocosTexto = [];

    Object.keys(outMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(out => {
        const { corFibra, corFibraNome, tubo, corTubo, corTuboNome, numeroFibra } = corFibraETubo(out);
        const item = outMap[out];
        const statusLabel = item.ocupado ? "Ocupado" : "Livre";
        const statusClass = item.ocupado ? "badge-ocupado" : "badge-livre";
        const { html: itemHtml, texto: itemTexto } = montarLinhaOut(
          `OUT JSO ${out}`, { corFibra, corFibraNome, tubo, corTubo, corTuboNome, numeroFibra }, item, statusLabel, statusClass
        );
        html += itemHtml;
        blocosTexto.push(itemTexto);
      });

    texto += blocosTexto.join("\n\n") + rodapePartilha();

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

    const totalOuts = Object.keys(outMap).length;
    const totalOcupados = Object.values(outMap).filter(o => o.ocupado).length;
    const totalLivres = totalOuts - totalOcupados;
    const resumo = `🟢 ${totalLivres} livres  ·  🔴 ${totalOcupados} ocupados`;
    let texto = cabecalhoPartilha(`SRO ${sro} · Splitter ${splitter}`, resumo);
    const blocosTexto = [];

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
        blocosTexto.push(itemTexto);
      });

    texto += blocosTexto.join("\n\n") + rodapePartilha();

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

    const totalPortos = Object.values(grupos).reduce((acc, g) => acc + Object.keys(g.portos).length, 0);
    const totalOcupados = Object.values(grupos).reduce(
      (acc, g) => acc + Object.values(g.portos).filter(p => p.ocupado).length, 0
    );
    const totalLivres = totalPortos - totalOcupados;
    html += `<div class="result-summary">`
      + `<span class="badge badge-livre">${totalLivres} livres</span>`
      + `<span class="badge badge-ocupado">${totalOcupados} ocupados</span>`
      + `</div>`;

    const resumo = `🟢 ${totalLivres} livres  ·  🔴 ${totalOcupados} ocupados`;
    let texto = cabecalhoPartilha(`Todos os Portos — PDO ${pdo}`, resumo);
    const blocosTexto = [];

    Object.values(grupos)
      .sort((a, b) => a.ordem - b.ordem)
      .forEach(g => {
        const portosOrdenados = Object.keys(g.portos).sort((a, b) => parseInt(a) - parseInt(b));
        const { numeroFibra, corFibra, corFibraNome, tubo, corTubo, corTuboNome } = corFibraETubo(g.pdoPtfo);

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

        let blocoTexto = `📦 ${headerTexto}` + (splitterLabel ? ` — ${splitterLabel}` : "");
        if (numeroFibra > 0) {
          blocoTexto += `\n   Fibra no PDO: ${g.pdoPtfo} — ${corFibraNome} (Tubo ${tubo} — ${corTuboNome})`;
        }

        portosOrdenados.forEach(p => {
          const item = g.portos[p];
          const statusLabel = item.ocupado ? "Ocupado" : "Livre";
          const statusClass = item.ocupado ? "badge-ocupado" : "badge-livre";
          html += `<div class="kv-row"><span class="kv-label">Porto ${escapeHtml(p)}</span>`
            + `<span class="kv-value"><span class="badge ${statusClass}">${statusLabel}</span>`
            + (item.ocupado && item.idServico ? ` <small style="color:var(--text-dim);">ID ${escapeHtml(item.idServico)}</small>` : "")
            + `</span></div>`;
          blocoTexto += `\n   Porto ${p}: ${statusEmoji(item.ocupado)} ${statusLabel}`
            + (item.ocupado && item.idServico ? ` (ID ${item.idServico})` : "");
        });

        html += `</div>`;
        blocosTexto.push(blocoTexto);
      });

    texto += blocosTexto.join("\n\n") + rodapePartilha();

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

  const totalOcupadosPP = rows.filter(r => r["id_servico"] && r["id_servico"].trim() !== "").length;
  const resumoPP = rows.length > 1
    ? `🟢 ${rows.length - totalOcupadosPP} livres  ·  🔴 ${totalOcupadosPP} ocupados`
    : null;
  let texto = cabecalhoPartilha(`PDO ${pdo} · Porto ${porto}`, resumoPP);
  const blocosTexto = [];

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

    const { numeroFibra, corFibra, corFibraNome, tubo, corTubo, corTuboNome } = corFibraETubo(row["pdo_ptfo"]);

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

    let blocoTexto = `${statusEmoji(ocupado)} ${statusLabel}`;
    if (estado) blocoTexto += `  ·  ${estado}`;
    if (operadora) blocoTexto += `  ·  ${operadora}`;
    if (numeroFibra > 0) {
      blocoTexto += `\n${DISPLAY_NAMES["pdo_ptfo"]}: ${row["pdo_ptfo"]} — ${corFibraNome} (Tubo ${tubo} — ${corTuboNome})`;
    }

    otherFields.forEach(col => {
      const valor = row[col] || "—";
      html += `<div class="kv-row"><span class="kv-label">${DISPLAY_NAMES[col]}</span><span class="kv-value">${escapeHtml(valor)}</span></div>`;
      if (valor !== "—") blocoTexto += `\n${DISPLAY_NAMES[col]}: ${valor}`;
    });

    html += `<button class="ver-portos-link" data-action="ver-portos-pdo" data-pdo="${escapeHtml(pdo)}">📦 Ver todos os portos deste PDO</button>`;

    blocosTexto.push(blocoTexto);
    html += `</div>`;
  });

  texto += blocosTexto.join("\n\n") + rodapePartilha();

  mostrarResultado(html, texto);
  if (guardarHistorico) guardarNoHistorico(`PDO ${pdo} · Porto ${porto}`, { pdo, porto });
}

function mostrarResultado(html, textoPlano) {
  textResult.innerHTML = html;
  ultimoResultadoTexto = textoPlano;
  resultActions.style.display = textoPlano ? "flex" : "none";
  aplicarFiltroLivres();
}

// Botão "Ver todos os portos deste PDO" dentro dos resultados — delegação de
// eventos porque o HTML é inserido dinamicamente via innerHTML.
textResult.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="ver-portos-pdo"]');
  if (!btn) return;
  const pdoAlvo = btn.dataset.pdo;
  pesquisarTodosPortosDoPdo(pdoAlvo);
});

function pesquisarTodosPortosDoPdo(nomePdo) {
  if (!csvData.length || !idx.byPdo.has(nomePdo)) return;
  resetSelects();
  popularPdoCompleto();
  spinnerPdo.value = nomePdo;
  executarPesquisa(true);
  window.scrollTo({ top: textResult.offsetTop - 20, behavior: "smooth" });
}

// ================= FILTRO "SÓ LIVRES" =================
const checkboxSoLivres = document.getElementById("checkboxSoLivres");
function aplicarFiltroLivres() {
  if (!checkboxSoLivres) return;
  textResult.classList.toggle("filtro-livres", checkboxSoLivres.checked);
}
if (checkboxSoLivres) {
  checkboxSoLivres.addEventListener("change", aplicarFiltroLivres);
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
    <div class="history-item" data-index="${i}" tabindex="0" role="button">
      <div>${escapeHtml(h.label)}<small>${formatarData(h.ts)}</small></div>
      <span>↺</span>
    </div>
  `).join("");

  historyList.querySelectorAll(".history-item").forEach(el => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.index);
      repetirPesquisa(historico[i]);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const i = parseInt(el.dataset.index);
        repetirPesquisa(historico[i]);
      }
    });
  });
}

function repetirPesquisa(item) {
  if (!csvData.length) {
    alert("Carrega o ficheiro CSV antes de repetir esta pesquisa.");
    return;
  }
  const c = item.criteria;

  // O ficheiro CSV pode ter sido substituído por um mais recente (ou de
  // outra área) desde que esta pesquisa foi guardada — sem esta verificação,
  // o utilizador via um erro confuso ("Seleciona PDO e Porto...") em vez de
  // perceber que o item do histórico é que já não existe.
  const existeAinda =
    (c.sro && idx.bySro.has(c.sro)) ||
    (c.jso && idx.byJso.has(c.jso)) ||
    (c.pdo && idx.byPdo.has(c.pdo));
  if (!existeAinda) {
    alert("Este item do histórico já não existe no ficheiro CSV atual (pode ter sido substituído por um mais recente).");
    return;
  }

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

// Se a app foi aberta a partir de um link do Mapa (ex: app.html?pdo=PDO1006),
// já vai direto à pesquisa "todos os portos" desse PDO.
(function aplicarPdoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const pdoParam = params.get("pdo");
  if (!pdoParam) return;

  if (!csvData.length) {
    alert(`Carrega primeiro um ficheiro CSV para veres o PDO "${pdoParam}".`);
    return;
  }
  // O nome do ponto no Mapa pode estar escrito com maiúsculas/minúsculas
  // diferentes do CSV (ex: "Pdo1071" vs "PDO1071") — tenta a correspondência
  // exata primeiro e só depois, sem distinguir maiúsculas, para não mostrar
  // "não encontrado" nesses casos.
  const chaveNormalizada = pdoParam.toLowerCase().trim();
  const pdoReal = idx.byPdo.has(pdoParam)
    ? pdoParam
    : (idx.byPdoLower.get(chaveNormalizada) || idx.byPdoLower.get(chaveNormalizada.replace(/\s+/g, "")));
  if (!pdoReal) {
    alert(`O PDO "${pdoParam}" não foi encontrado no ficheiro CSV carregado.`);
    return;
  }
  pesquisarTodosPortosDoPdo(pdoReal);
})();
