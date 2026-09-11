(() => {
  const input=document.getElementById('quick-search'),list=document.getElementById('quick-options');
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f\s-]/g,'').toLocaleLowerCase('pt-PT');
  let selected=-1;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
  list.setAttribute('role','listbox');list.setAttribute('aria-label','Equipamentos encontrados');list.removeAttribute('aria-live');
  const feedback=document.createElement('p');feedback.className='quick-help';feedback.setAttribute('role','status');list.after(feedback);
  function close(){list.replaceChildren();selected=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');feedback.textContent='';}
  function choose(type,name){
    resetSelects();if(type==='PDO'){spinnerPdo.value=name;updatePortos();}else if(type==='SRO'){spinnerSro.value=name;handleSroChange();}else{spinnerJso.value=name;handleJsoChange();}
    input.value=name;close();executarPesquisa(true);input.blur();const result=document.getElementById('textResult');result.focus({preventScroll:true});result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  input.addEventListener('input',()=>{
    close();const term=normalize(input.value.trim());if(!term)return;
    const matches=[];
    for(const [type,map] of [['PDO',idx.byPdo],['SRO',idx.bySro],['JSO',idx.byJso]])for(const name of map.keys())if(normalize(name).includes(term))matches.push({type,name});
    matches.sort((a,b)=>Number(normalize(b.name)===term)-Number(normalize(a.name)===term)||a.name.localeCompare(b.name,'pt-PT',{numeric:true}));
    for(const [i,{type,name}] of matches.slice(0,12).entries()){
      const button=document.createElement('button');button.type='button';button.textContent=`${type} · ${name}`;button.id='quick-option-'+i;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;button.addEventListener('click',()=>choose(type,name));list.append(button);
    }
    input.setAttribute('aria-expanded',String(matches.length>0));
    feedback.textContent=matches.length>12?`12 de ${matches.length} resultados. Escreve mais para reduzir a lista.`:matches.length?`${matches.length} equipamentos encontrados.`:csvData.length?'Nenhum equipamento encontrado.':'Carrega primeiro um ficheiro CSV.';
  });
  input.addEventListener('keydown',e=>{
    const options=[...list.querySelectorAll('button')];
    if(e.key==='Escape'){close();return;}
    if(e.key==='Enter'&&options.length){e.preventDefault();options[Math.max(selected,0)].click();return;}
    if(!options.length||!['ArrowDown','ArrowUp'].includes(e.key))return;
    e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options.forEach((el,i)=>el.setAttribute('aria-selected',String(i===selected)));input.setAttribute('aria-activedescendant',options[selected].id);options[selected].scrollIntoView({block:'nearest'});
  });
  document.addEventListener('click',e=>{if(e.target!==input&&!list.contains(e.target))close();});
  document.getElementById('btnLimparTudo').addEventListener('click',()=>{close();input.focus();});
  document.getElementById('btnLoadCsv').addEventListener('change',close);
})();
