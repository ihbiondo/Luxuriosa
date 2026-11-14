(function(){
"use strict";
const signs=[
{name:"Áries",glyph:"♈",dates:"21 mar — 19 abr",start:321,element:"Fogo",modality:"Cardinal",description:"Iniciativa, movimento e impulso para começar."},
{name:"Touro",glyph:"♉",dates:"20 abr — 20 mai",start:420,element:"Terra",modality:"Fixo",description:"Constância, sensorialidade e apreço pelo conforto."},
{name:"Gêmeos",glyph:"♊",dates:"21 mai — 20 jun",start:521,element:"Ar",modality:"Mutável",description:"Curiosidade, troca de ideias e versatilidade."},
{name:"Câncer",glyph:"♋",dates:"21 jun — 22 jul",start:621,element:"Água",modality:"Cardinal",description:"Acolhimento, memória e sensibilidade."},
{name:"Leão",glyph:"♌",dates:"23 jul — 22 ago",start:723,element:"Fogo",modality:"Fixo",description:"Expressividade, criatividade e presença."},
{name:"Virgem",glyph:"♍",dates:"23 ago — 22 set",start:823,element:"Terra",modality:"Mutável",description:"Observação, organização e atenção aos detalhes."},
{name:"Libra",glyph:"♎",dates:"23 set — 22 out",start:923,element:"Ar",modality:"Cardinal",description:"Equilíbrio, diálogo e senso de harmonia."},
{name:"Escorpião",glyph:"♏",dates:"23 out — 21 nov",start:1023,element:"Água",modality:"Fixo",description:"Profundidade, intensidade e transformação."},
{name:"Sagitário",glyph:"♐",dates:"22 nov — 21 dez",start:1122,element:"Fogo",modality:"Mutável",description:"Expansão, espontaneidade e busca por horizontes."},
{name:"Capricórnio",glyph:"♑",dates:"22 dez — 19 jan",start:1222,element:"Terra",modality:"Cardinal",description:"Planejamento, persistência e construção."},
{name:"Aquário",glyph:"♒",dates:"20 jan — 18 fev",start:120,element:"Ar",modality:"Fixo",description:"Originalidade, independência e visão coletiva."},
{name:"Peixes",glyph:"♓",dates:"19 fev — 20 mar",start:219,element:"Água",modality:"Mutável",description:"Imaginação, empatia e sensibilidade."}
];
const byName=new Map(signs.map(s=>[s.name,s]));
const form=document.getElementById("signForm"),dateInput=document.getElementById("birthDate"),result=document.getElementById("signResult");
function signForDate(value){
const parts=value.split("-").map(Number);if(parts.length!==3||!parts.every(Number.isFinite))return null;
const monthDay=parts[1]*100+parts[2];
const starts=[{name:"Capricórnio",start:0},...signs.map(s=>({name:s.name,start:s.start}))].sort((a,b)=>a.start-b.start);
let found=starts[0];for(const item of starts){if(monthDay>=item.start)found=item;else break;}
return byName.get(found.name)||null;
}
function renderSign(sign){
document.getElementById("resultSymbol").textContent=sign.glyph;
document.getElementById("resultName").textContent=sign.name;
document.getElementById("resultDates").textContent=sign.dates;
document.getElementById("resultElement").textContent="Elemento: "+sign.element;
document.getElementById("resultModality").textContent="Modalidade: "+sign.modality;
document.getElementById("resultDescription").textContent=sign.description;
result.hidden=false;
}
form.addEventListener("submit",event=>{event.preventDefault();const value=dateInput.value;if(!value||!dateInput.validity.valid){dateInput.reportValidity();return;}const sign=signForDate(value);if(sign)renderSign(sign);});
const first=document.getElementById("signOne"),second=document.getElementById("signTwo");
signs.forEach(sign=>{[first,second].forEach(select=>{const option=document.createElement("option");option.value=sign.name;option.textContent=sign.glyph+" "+sign.name;select.append(option);});});
function combination(a,b){
if(a.element===b.element)return "Os dois signos compartilham o elemento "+a.element.toLowerCase()+". Na leitura astrológica, isso sugere uma linguagem simbólica parecida e pontos de identificação — sem determinar como uma relação funciona.";
const fireAir=(a.element==="Ar"&&b.element==="Fogo")||(a.element==="Fogo"&&b.element==="Ar");
if(fireAir)return "Na tradição astrológica, ar e fogo são associados a movimento, ideias e entusiasmo. É uma combinação simbólica que convida à troca e à experimentação.";
const earthWater=(a.element==="Água"&&b.element==="Terra")||(a.element==="Terra"&&b.element==="Água");
if(earthWater)return "Na tradição astrológica, água e terra são associados a sensibilidade, cuidado e construção. É uma combinação simbólica que convida ao acolhimento e à consistência.";
return "Elementos diferentes trazem símbolos e ritmos distintos nesta leitura astrológica. A curiosidade pode estar justamente em conhecer e respeitar essas diferenças.";
}
document.getElementById("compatibilityForm").addEventListener("submit",event=>{
event.preventDefault();const a=byName.get(first.value),b=byName.get(second.value);if(!a||!b){first.reportValidity();second.reportValidity();return;}
document.getElementById("compatibilityHeading").textContent=a.name+" + "+b.name;
document.getElementById("compatibilityText").textContent=combination(a,b);
document.getElementById("compatibilityResult").hidden=false;
});
const grid=document.getElementById("signGrid");
signs.forEach(sign=>{const card=document.createElement("article");card.className="sign-card";const glyph=document.createElement("span");glyph.className="sign-card-symbol";glyph.textContent=sign.glyph;const title=document.createElement("h3");title.textContent=sign.name;const dates=document.createElement("p");dates.textContent=sign.dates;const element=document.createElement("span");element.textContent=sign.element+" · "+sign.modality;card.append(glyph,title,dates,element);grid.append(card);});
const AGE_KEY="lux18";let approved=false;try{approved=localStorage.getItem(AGE_KEY)==="1"}catch(_){}
if(!approved){const gate=document.getElementById("ageGate");gate.showModal();document.getElementById("ageConfirm").addEventListener("click",()=>{try{localStorage.setItem(AGE_KEY,"1")}catch(_){}gate.close();});}
})();