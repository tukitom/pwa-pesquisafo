// Draw the document from data, independent of browser layout, theme and screen size.
function criarPdfFibras() {
  const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const palette=[['Branco','#FFFFFF','BR'],['Vermelho','#FF0000','VM'],['Verde','#00FF00','VD'],['Azul','#0000FF','AZ'],['Preto','#000000','PR'],['Amarelo','#FFFF00','AM'],['Laranja','#FFA500','LR'],['Cinzento','#808080','CZ'],['Castanho','#8B4513','CT'],['Violeta','#800080','VT'],['Rosa','#FFC0CB','RS'],['Turquesa','#40E0D0','TQ']];
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const ink=hex=>{const [r,g,b]=rgb(hex);return .299*r+.587*g+.114*b>145?0:255;};
  for(let page=0;page<2;page++){
    if(page)pdf.addPage();
    pdf.setTextColor(20,40,60);pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.text('FO AÇORES | Identificação de fibras',32,38);
    pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.text(`Tubos ${page*12+1} a ${page*12+12} | Fibras ${page*144+1} a ${page*144+144}`,32,59);
    const x0=32,y0=83,label=105,cw=56,rh=32;
    function cell(x,y,w,text,fill){pdf.setFillColor(...rgb(fill));pdf.setDrawColor(140,155,165);pdf.setLineWidth(.4);pdf.rect(x,y,w,rh,'FD');pdf.setTextColor(ink(fill));pdf.setFontSize(10);pdf.text(String(text),x+w/2,y+20,{align:'center'});}
    cell(x0,y0,label,'Cor da fibra','#E8EFF5');
    for(let t=0;t<12;t++)cell(x0+label+t*cw,y0,cw,'Tubo '+(page*12+t+1),palette[t][1]);
    for(let f=0;f<12;f++){
      const y=y0+(f+1)*rh;cell(x0,y,label,palette[f][0]+' ('+palette[f][2]+')',palette[f][1]);
      for(let t=0;t<12;t++)cell(x0+label+t*cw,y,cw,page*144+t*12+f+1,palette[f][1]);
    }
    pdf.setTextColor(55,70,80);pdf.setFontSize(10);pdf.text('A cor do cabeçalho identifica o tubo; a cor da linha identifica a fibra.',32,526);
    pdf.text('Sequência de cores configurada na aplicação.',32,544);pdf.text(`${page+1} / 2`,805,562,{align:'right'});
  }
  return pdf;
}
document.getElementById('btnPDF').addEventListener('click',()=>{
  const error=document.getElementById('colorError');error.textContent='';
  try{
    const blob=criarPdfFibras().output('blob');const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='Tabela_Fibras_Opticas.pdf';link.textContent='Abrir ou guardar PDF';link.target='_blank';link.rel='noopener';link.className='pdf-download';
    const result=document.getElementById('pdfDownload');result.replaceChildren(link);link.click();
    // Keep an explicit second-tap link for Safari's PDF viewer / share sheet.
    setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
  }catch(e){error.textContent='Não foi possível gerar o PDF. Confirma se a preparação offline terminou e tenta novamente.';console.error(e);}
});
