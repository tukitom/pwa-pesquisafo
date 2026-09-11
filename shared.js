// ================= UTILITÁRIOS PARTILHADOS =================
// Usado por app.js (Pesquisa) e comparar.js (Comparar Ficheiros) — mantém a
// leitura/validação do CSV e a formatação da partilha num único sítio, para
// corrigir um bug aqui corrigir nos dois ecrãs ao mesmo tempo.

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

const requiredCols = Object.keys(DISPLAY_NAMES);

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

function detectarSeparador(linha) {
  if (linha.includes(";")) return ";";
  if (linha.includes("\t")) return "\t";
  return ",";
}

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

// Interpreta o texto completo de um CSV e devolve { headers, rows,
// linhasIgnoradas } em caso de sucesso, ou { erro, ... } em caso de falha —
// nunca lança exceção, para o chamador poder sempre mostrar uma mensagem
// clara em vez de a app rebentar.
function parseCsvGenerico(texto, colunasObrigatorias) {
  const lines = texto.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return { erro: "vazio" };

  const separador = detectarSeparador(lines[0]);
  const headers = parseCsvLine(lines[0], separador).map(h => h.trim());

  const colunasEmFalta = (colunasObrigatorias || []).filter(c => !headers.includes(c));
  if (colunasEmFalta.length) return { erro: "colunas", colunasEmFalta };

  const rows = [];
  let linhasIgnoradas = 0;
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], separador);
    if (values.length === headers.length) {
      const row = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j];
      rows.push(row);
    } else {
      // Nº de colunas não bate certo com o cabeçalho (ex: separador dentro
      // de um campo não escapado entre aspas) — a linha é ignorada em vez de
      // partir a app.
      linhasIgnoradas++;
    }
  }

  if (!rows.length) return { erro: "semdados" };

  return { headers, rows, linhasIgnoradas };
}

// ================= FORMATAÇÃO DO TEXTO PARTILHADO =================
// O texto copiado/partilhado (WhatsApp, SMS, etc.) é sempre reconstruído do
// zero aqui — só isto é que aparece fora da app, por isso tem de fazer
// sentido sozinho: título, quando foi feito, e um resumo claro por item.
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

// Liga os botões "Copiar" e "Partilhar" à Web Share API / clipboard —
// usado tanto pela Pesquisa como pelo Comparar, para o comportamento (e as
// mensagens de erro) serem sempre os mesmos nos dois ecrãs.
function configurarBotoesPartilha(btnCopiar, btnPartilhar, obterTexto, tituloPartilha) {
  const labelOriginal = btnCopiar.textContent;

  btnCopiar.addEventListener("click", async () => {
    const texto = obterTexto();
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      btnCopiar.textContent = "✅ Copiado!";
      setTimeout(() => (btnCopiar.textContent = labelOriginal), 1500);
    } catch (e) {
      alert("Não foi possível copiar automaticamente. Seleciona o texto manualmente.");
    }
  });

  btnPartilhar.addEventListener("click", async () => {
    const texto = obterTexto();
    if (!texto) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: tituloPartilha || "Resultado Pesquisa F.O", text: texto });
      } catch (e) { /* utilizador cancelou */ }
    } else {
      try {
        await navigator.clipboard.writeText(texto);
        alert("Partilha direta não suportada neste dispositivo. Texto copiado para a área de transferência.");
      } catch (e) {
        alert("Partilha não suportada neste dispositivo.");
      }
    }
  });
}
