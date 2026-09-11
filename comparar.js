// ================= COMPARAR FICHEIROS =================
// Compara dois exports CSV (um "antigo" e um "novo") e mostra o que mudou:
// portas que ficaram ocupadas, portas que ficaram livres, portas que
// mudaram de estado mantendo o mesmo serviço, e PDOs novos/desaparecidos.
//
// IMPORTANTE sobre "mesmo cliente": o CSV não tem nenhum identificador de
// cliente (nome, NIF, morada) — só id_servico, que cada operadora atribui
// no seu próprio sistema (os intervalos de MEO e NOS nunca se cruzam). Por
// isso só tratamos como "o mesmo serviço" uma linha cujo id_servico seja
// EXATAMENTE igual nos dois ficheiros. Nunca inferimos "mudou de operadora"
// a partir de uma porta que ficou livre e depois ocupada por outro
// id_servico — isso é só "porta com ocupante diferente", não uma
// continuidade de cliente que os dados não permitem confirmar.

let antigo = null; // { rows, nome }
let novo = null;

const btnLoadAntigo = document.getElementById("btnLoadAntigo");
const btnLoadNovo = document.getElementById("btnLoadNovo");
const statusAntigo = document.getElementById("statusAntigo");
const statusNovo = document.getElementById("statusNovo");
const btnComparar = document.getElementById("btnComparar");
const comparResult = document.getElementById("comparResult");
const comparResultActions = document.getElementById("comparResultActions");
const btnCopiarComparar = document.getElementById("btnCopiarComparar");
const btnPartilharComparar = document.getElementById("btnPartilharComparar");

let ultimoResultadoComparar = "";

function ligarInputCsv(inputEl, statusEl, aoCarregar) {
  let version=0;
  inputEl.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const current=++version;aoCarregar(null);
    comparResult.replaceChildren();ultimoResultadoComparar="";comparResultActions.style.display="none";
    statusEl.textContent = `📄 A carregar ${file.name}...`;
    statusEl.classList.remove("loaded");

    const reader = new FileReader();
    reader.onload = (e) => {
      if(current!==version)return;
      const texto = decodificarTexto(e.target.result);
      const resultado = parseCsvGenerico(texto, requiredCols);

      if(resultado.erro){statusEl.textContent=resultado.erro==='colunas'?'Faltam colunas: '+resultado.colunasEmFalta.join(', '):'Não foi possível carregar: ficheiro vazio ou sem registos válidos.';return;}
      const seen=new Set();let duplicates=0,missing=0;
      for(const row of resultado.rows){const key=chavePorto(row);if(!key){missing++;continue;}if(seen.has(key))duplicates++;seen.add(key);}
      if(duplicates||missing){statusEl.textContent='Comparação bloqueada: '+duplicates+' portos duplicados e '+missing+' registos sem PDO/porto. Corrige o ficheiro para evitar uma comparação incompleta.';return;}
      if (resultado.linhasIgnoradas > 0) {
        console.warn(`[CSV] ${resultado.linhasIgnoradas} linha(s) ignorada(s) por não terem o número de colunas esperado.`);
      }

      aoCarregar({ rows: resultado.rows, nome: file.name });

      statusEl.textContent = resultado.linhasIgnoradas > 0
        ? `⚠️ ${file.name} — ${resultado.rows.length} linhas (${resultado.linhasIgnoradas} ignoradas por erro de formato)`
        : `✅ ${file.name} — ${resultado.rows.length} linhas carregadas`;
      statusEl.classList.add("loaded");
    };
    reader.onerror = () => {
      if(current!==version)return;
      statusEl.textContent = "❌ Erro a ler o ficheiro.";
      statusEl.classList.remove("loaded");
    };
    reader.readAsArrayBuffer(file);
  });
}

ligarInputCsv(btnLoadAntigo, statusAntigo, (dados) => { antigo = dados; atualizarComparacao(); });
ligarInputCsv(btnLoadNovo, statusNovo, (dados) => { novo = dados; atualizarComparacao(); });

function atualizarComparacao(){btnComparar.disabled=!(antigo&&novo);document.getElementById("compareFeedback").textContent=antigo&&novo?"Ficheiros prontos para comparar.":"Carrega os dois ficheiros para continuar.";}
atualizarComparacao();
// ================= LÓGICA DA COMPARAÇÃO =================
function chavePorto(row) {
  const pdo = (row["pdo_nome"]||"").trim();
  const porto = (row["porto_pdo"]||"").trim();
  if (!pdo || !porto) return null;
  return pdo + "|||" + porto;
}

function estaOcupado(row) {
  return !!(row["id_servico"] && row["id_servico"].trim() !== "");
}

function ordenarPorPdoPorto(lista) {
  return lista.sort((a, b) => {
    if (a.pdo !== b.pdo) return a.pdo.localeCompare(b.pdo, undefined, { numeric: true });
    return (parseInt(a.porto) || 0) - (parseInt(b.porto) || 0);
  });
}

function compararCsvs(rowsAntigo, rowsNovo) {
  const mapAntigo = new Map();
  rowsAntigo.forEach(r => { const k = chavePorto(r); if (k && !mapAntigo.has(k)) mapAntigo.set(k, r); });
  const mapNovo = new Map();
  rowsNovo.forEach(r => { const k = chavePorto(r); if (k && !mapNovo.has(k)) mapNovo.set(k, r); });

  const ocupanteAlterado = [], portosAdicionados = [], portosRemovidos = [];
  for (const [k,row] of mapNovo) if (!mapAntigo.has(k)) portosAdicionados.push({pdo:row.pdo_nome,porto:row.porto_pdo});
  for (const [k,row] of mapAntigo) if (!mapNovo.has(k)) portosRemovidos.push({pdo:row.pdo_nome,porto:row.porto_pdo});
  const novasOcupacoes = [];
  const ficaramLivres = [];
  const mudouEstado = [];

  for (const [chave, rowNovo] of mapNovo) {
    const rowAntigo = mapAntigo.get(chave);
    if (!rowAntigo) continue; // porta que não existia no ficheiro antigo — coberta via "PDOs novos"

    const ocupadoAntigo = estaOcupado(rowAntigo);
    const ocupadoNovo = estaOcupado(rowNovo);
    const estadoAntigo=(rowAntigo.estado_operacional_porto||'').trim(),estadoNovo=(rowNovo.estado_operacional_porto||'').trim();
    if(estadoAntigo!==estadoNovo)mudouEstado.push({pdo:rowNovo.pdo_nome,porto:rowNovo.porto_pdo,idServico:rowNovo.id_servico||'',operadora:rowNovo.beneficiario_porto||'',estadoAntigo,estadoNovo});

    if (!ocupadoAntigo && ocupadoNovo) {
      novasOcupacoes.push({
        pdo: rowNovo["pdo_nome"], porto: rowNovo["porto_pdo"],
        operadora: rowNovo["beneficiario_porto"] || "", idServico: rowNovo["id_servico"] || ""
      });
    } else if (ocupadoAntigo && !ocupadoNovo) {
      ficaramLivres.push({
        pdo: rowAntigo["pdo_nome"], porto: rowAntigo["porto_pdo"],
        operadoraAntiga: rowAntigo["beneficiario_porto"] || "", idServicoAntigo: rowAntigo["id_servico"] || ""
      });
    } else if (ocupadoAntigo && ocupadoNovo) {
      // Só comparamos "o mesmo serviço mudou de estado" quando o id_servico é
      // EXATAMENTE igual nos dois ficheiros — ver nota no topo do ficheiro.
      const idAntigo = (rowAntigo["id_servico"] || "").trim();
      const idNovo = (rowNovo["id_servico"] || "").trim();
      if (idAntigo !== idNovo) ocupanteAlterado.push({pdo:rowNovo.pdo_nome,porto:rowNovo.porto_pdo,idAntigo,idNovo});

    }
  }

  ordenarPorPdoPorto(novasOcupacoes);
  ordenarPorPdoPorto(ficaramLivres);
  ordenarPorPdoPorto(mudouEstado);

  // PDOs que apareceram/desapareceram entre os dois ficheiros (por nome de
  // PDO, não por porta individual — um PDO pode ter portas novas sem ser
  // "novo" no ficheiro; isto é só para PDOs que não existiam de todo antes).
  const pdosAntigo = new Set(rowsAntigo.map(r => r["pdo_nome"]).filter(Boolean));
  const pdosNovo = new Set(rowsNovo.map(r => r["pdo_nome"]).filter(Boolean));
  const pdosNovos = [...pdosNovo].filter(p => !pdosAntigo.has(p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const pdosDesaparecidos = [...pdosAntigo].filter(p => !pdosNovo.has(p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Contagem de portas ocupadas por operadora, em cada ficheiro.
  function contarPorOperadora(rows) {
    const contagem = {};
    rows.forEach(r => {
      if (estaOcupado(r)) {
        const op = r["beneficiario_porto"] || "Não definido";
        contagem[op] = (contagem[op] || 0) + 1;
      }
    });
    return contagem;
  }
  const porOperadoraAntigo = contarPorOperadora(rowsAntigo);
  const porOperadoraNovo = contarPorOperadora(rowsNovo);
  const todasOperadoras = [...new Set([...Object.keys(porOperadoraAntigo), ...Object.keys(porOperadoraNovo)])].sort();

  return {
    ocupanteAlterado: ordenarPorPdoPorto(ocupanteAlterado), portosAdicionados: ordenarPorPdoPorto(portosAdicionados), portosRemovidos: ordenarPorPdoPorto(portosRemovidos),
    novasOcupacoes, ficaramLivres, mudouEstado, pdosNovos, pdosDesaparecidos,
    porOperadoraAntigo, porOperadoraNovo, todasOperadoras
  };
}

// ================= RENDERIZAÇÃO =================
function montarResultadoComparacao(r, nomeAntigo, nomeNovo) {
  let html = `<div class="result-title">${escapeHtml(nomeAntigo)} → ${escapeHtml(nomeNovo)}</div><div class="comparison-metrics"><div><strong>${r.novasOcupacoes.length}</strong><span>Novas ocupações</span></div><div><strong>${r.ficaramLivres.length}</strong><span>Sem serviço agora</span></div><div><strong>${r.ocupanteAlterado.length}</strong><span>Trocas de serviço</span></div><div><strong>${r.portosAdicionados.length}</strong><span>Portos adicionados</span></div><div><strong>${r.portosRemovidos.length}</strong><span>Portos removidos</span></div></div>`;

  let texto = cabecalhoPartilha(
    `${nomeAntigo} → ${nomeNovo}`,
    `🔴 ${r.novasOcupacoes.length} novas ocupações  ·  🟢 ${r.ficaramLivres.length} ficaram livres  ·  🔧 ${r.mudouEstado.length} mudaram estado`
  );
  const blocosTexto = [];

  // --- Por operadora ---
  if (r.todasOperadoras.length) {
    html += `<div class="result-item">`;
    html += `<div class="result-header">Por operadora</div>`;
    let blocoOp = `📊 Por operadora`;
    r.todasOperadoras.forEach(op => {
      const nAntigo = r.porOperadoraAntigo[op] || 0;
      const nNovo = r.porOperadoraNovo[op] || 0;
      const delta = nNovo - nAntigo;
      const deltaTexto = delta > 0 ? `+${delta}` : `${delta}`;
      const deltaCor = delta > 0 ? "var(--ok)" : (delta < 0 ? "var(--danger)" : "var(--text-dim)");
      html += `<div class="kv-row"><span class="kv-label">${escapeHtml(op)}</span>`
        + `<span class="kv-value">${nAntigo} → ${nNovo} <small style="color:${deltaCor};font-weight:700;">(${deltaTexto})</small></span></div>`;
      blocoOp += `\n   ${op}: ${nAntigo} → ${nNovo} (${deltaTexto})`;
    });
    html += `</div>`;
    blocosTexto.push(blocoOp);
  }

  // --- Resumo em badges ---
  html += `<div class="result-summary" style="flex-wrap:wrap;">`
    + `<span class="badge badge-ocupado">${r.novasOcupacoes.length} novas ocupações</span>`
    + `<span class="badge badge-livre">${r.ficaramLivres.length} ficaram livres</span>`
    + `<span class="badge badge-warning">${r.mudouEstado.length} mudaram de estado</span>`
    + `<span class="badge badge-info">${r.pdosNovos.length} PDOs novos</span>`
    + (r.pdosDesaparecidos.length ? `<span class="badge badge-op">${r.pdosDesaparecidos.length} PDOs desaparecidos</span>` : "")
    + `</div>`;

  const semNenhumaMudanca = !r.ocupanteAlterado.length && !r.portosAdicionados.length && !r.portosRemovidos.length && !r.novasOcupacoes.length && !r.ficaramLivres.length
    && !r.mudouEstado.length && !r.pdosNovos.length && !r.pdosDesaparecidos.length;

  if (semNenhumaMudanca) {
    html += `<div class="result-item">Sem alterações nas categorias comparadas.</div>`;
    blocosTexto.push("Sem diferenças entre os dois ficheiros.");
  }

  for (const [titulo,items] of [['Ocupante alterado',r.ocupanteAlterado],['Portos adicionados',r.portosAdicionados],['Portos removidos',r.portosRemovidos]]) {
    html += '<details class="card"><summary>'+titulo+' · '+items.length+'</summary>';
    blocosTexto.push(titulo+': '+items.length);
    for(const item of items){const linha='PDO '+item.pdo+' · Porto '+item.porto+(item.idAntigo?' · Serviço '+item.idAntigo+' → '+item.idNovo:'');html+='<div class="kv-row">'+escapeHtml(linha)+'</div>';blocosTexto.push(linha);}
    html+='</details>';
  }
  // --- Novas ocupações ---
  if (r.novasOcupacoes.length) {
    html += `<div class="result-title" style="margin-top:16px;">🔴 Novas ocupações</div>`;
    r.novasOcupacoes.forEach(item => {
      html += `<div class="result-item">`
        + `<div class="result-header">PDO ${escapeHtml(item.pdo)} · Porto ${escapeHtml(item.porto)}</div>`
        + `<div class="result-badges"><span class="badge badge-ocupado">🔴 Novo Ocupado</span></div>`
        + `<div class="kv-row"><span class="kv-label">Operadora</span><span class="kv-value">${escapeHtml(item.operadora || "—")}</span></div>`
        + (item.idServico ? `<div class="kv-row"><span class="kv-label">ID Serviço</span><span class="kv-value">${escapeHtml(item.idServico)}</span></div>` : "")
        + `</div>`;
      blocosTexto.push(
        `🔴 PDO ${item.pdo} · Porto ${item.porto}\n   Livre → Ocupado por ${item.operadora || "—"}`
        + (item.idServico ? ` · ID ${item.idServico}` : "")
      );
    });
  }

  // --- Ficaram livres ---
  if (r.ficaramLivres.length) {
    html += `<div class="result-title" style="margin-top:16px;">🟢 Ficaram livres</div>`;
    r.ficaramLivres.forEach(item => {
      html += `<div class="result-item">`
        + `<div class="result-header">PDO ${escapeHtml(item.pdo)} · Porto ${escapeHtml(item.porto)}</div>`
        + `<div class="result-badges"><span class="badge badge-livre">🟢 Ficou Livre</span></div>`
        + (item.operadoraAntiga ? `<div class="kv-row"><span class="kv-label">Operadora anterior</span><span class="kv-value">${escapeHtml(item.operadoraAntiga)}</span></div>` : "")
        + `</div>`;
      blocosTexto.push(
        `🟢 PDO ${item.pdo} · Porto ${item.porto}\n   Ocupado por ${item.operadoraAntiga || "—"} → Livre`
      );
    });
  }

  // --- Mudaram de estado (mesmo serviço) ---
  if (r.mudouEstado.length) {
    html += `<div class="result-title" style="margin-top:16px;">🔧 Estado operacional alterado</div>`;
    html += `<div style="font-size:12px;color:var(--text-dim);margin:-6px 0 10px;">Alterações do estado do porto, com ou sem serviço associado.</div>`;
    r.mudouEstado.forEach(item => {
      html += `<div class="result-item">`
        + `<div class="result-header">PDO ${escapeHtml(item.pdo)} · Porto ${escapeHtml(item.porto)}</div>`
        + `<div class="result-badges"><span class="badge badge-warning">🔧 Mudou estado</span></div>`
        + `<div class="kv-row"><span class="kv-label">ID Serviço</span><span class="kv-value">${escapeHtml(item.idServico)}</span></div>`
        + `<div class="kv-row"><span class="kv-label">Operadora</span><span class="kv-value">${escapeHtml(item.operadora || "—")}</span></div>`
        + `<div class="kv-row"><span class="kv-label">Estado</span><span class="kv-value">${escapeHtml(item.estadoAntigo)} → ${escapeHtml(item.estadoNovo)}</span></div>`
        + `</div>`;
      blocosTexto.push(
        `🔧 PDO ${item.pdo} · Porto ${item.porto}\n   ID ${item.idServico} (${item.operadora || "—"}) · ${item.estadoAntigo} → ${item.estadoNovo}`
      );
    });
  }

  // --- PDOs novos ---
  if (r.pdosNovos.length) {
    html += `<div class="result-title" style="margin-top:16px;">🆕 PDOs novos no ficheiro</div>`;
    html += `<div class="result-item"><div class="kv-row"><span class="kv-value">${r.pdosNovos.map(escapeHtml).join(", ")}</span></div></div>`;
    blocosTexto.push(`🆕 PDOs novos: ${r.pdosNovos.join(", ")}`);
  }

  // --- PDOs desaparecidos ---
  if (r.pdosDesaparecidos.length) {
    html += `<div class="result-title" style="margin-top:16px;">⚠️ PDOs que desapareceram do ficheiro</div>`;
    html += `<div class="result-item"><div class="kv-row"><span class="kv-value">${r.pdosDesaparecidos.map(escapeHtml).join(", ")}</span></div></div>`;
    blocosTexto.push(`⚠️ PDOs desaparecidos: ${r.pdosDesaparecidos.join(", ")}`);
  }

  texto += blocosTexto.join("\n\n") + rodapePartilha();

  return { html, texto };
}

// ================= AÇÃO PRINCIPAL =================
btnComparar.addEventListener("click", () => {
  if (!antigo || !novo) {
    alert("Carrega os dois ficheiros (antigo e novo) antes de comparar.");
    return;
  }

  const resultado = compararCsvs(antigo.rows, novo.rows);
  const { html, texto } = montarResultadoComparacao(resultado, antigo.nome, novo.nome);

  comparResult.innerHTML = html;
  // Keep large change sets scannable; their complete content remains shareable.
  const headings=[...comparResult.children].filter(el=>el.classList.contains('result-title')).slice(1);
  for(const heading of headings){const group=document.createElement('details');group.className='card';const summary=document.createElement('summary');summary.textContent=heading.textContent;group.append(summary);heading.before(group);let next=heading.nextElementSibling;while(next&&!next.classList.contains('result-title')){const following=next.nextElementSibling;group.append(next);next=following;}heading.remove();}

  ultimoResultadoComparar = texto;
  comparResultActions.style.display = texto ? "flex" : "none";
});

configurarBotoesPartilha(btnCopiarComparar, btnPartilharComparar, () => ultimoResultadoComparar, "Comparação de Ficheiros — Pesquisa F.O");
