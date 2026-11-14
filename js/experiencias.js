(function(){
"use strict";
const AGE_KEY="lux18";
const FAVORITES_KEY="lux_experiencias_favoritos_v1";
const byId=id=>document.getElementById(id);
const cards=[...document.querySelectorAll(".card")];
const filters=[...document.querySelectorAll("[data-filter]")];
const search=byId("experienceSearch");
const empty=byId("emptyState");
const favoriteCount=byId("favoriteCount");
const ageGate=byId("ageGate");
const dialog=byId("experienceDialog");
const allowed=["discovery","connection","curiosity","challenge","astrology"];
const filterValues=["all","quiz","couple","challenge","astrology","favorites"];
let favorites=readFavorites();
let activeFilter="all";
let current=null;
let questionIndex=0;
let answers=[];
let lastOpener=null;

  function setupExperienceNavigation() {
    const nav = document.querySelector(".header nav");
    if (!nav) return;

    const items = [{"label":"Meu Portal","href":"/portal/"},{"label":"Experiências","href":"/experiencias/","current":"page"},{"label":"Educação","href":"/educacao/"}];
    const links = items.map(item => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      if (item.current) link.setAttribute("aria-current", item.current);
      return link;
    });
    nav.replaceChildren(...links);
    nav.setAttribute("aria-label", "Navegação entre Portal, Experiências e Educação");

    const footer = document.querySelector(".footer");
    if (footer) {
      [
        { href: "/portal/", label: "Meu Portal" },
        { href: "/educacao/", label: "Educação" }
      ].forEach(item => {
        if (footer.querySelector('a[href="' + item.href + '"]')) return;
        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.label;
        footer.append(link);
      });
    }
  }

setupExperienceNavigation();
function readFavorites(){
  try{
    const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");
    return Array.isArray(value)?value.filter(id=>allowed.includes(id)):[];
  }catch(_){return[];}
}
function renderFavorites(){
  const names={discovery:"Descubra seu estilo",connection:"Conexão a dois",curiosity:"Mitos ou verdades",challenge:"Pequenas descobertas",astrology:"Astrologia e signos"};
  document.querySelectorAll("[data-favorite]").forEach(button=>{
    const id=button.dataset.favorite;
    const saved=favorites.includes(id);
    button.setAttribute("aria-pressed",String(saved));
    button.textContent=saved?"♥":"♡";
    button.setAttribute("aria-label",(saved?"Remover dos favoritos: ":"Salvar nos favoritos: ")+(names[id]||"experiência"));
  });
  favoriteCount.textContent=String(favorites.length);
}
function filterCards(){
  const term=search.value.trim().toLocaleLowerCase("pt-BR");
  let shown=0;
  cards.forEach(card=>{
    const textMatch=!term||card.dataset.title.toLocaleLowerCase("pt-BR").includes(term);
    const filterMatch=activeFilter==="all"||(activeFilter==="favorites"?favorites.includes(card.dataset.id):card.dataset.category===activeFilter);
    card.hidden=!(textMatch&&filterMatch);
    if(!card.hidden)shown++;
  });
  empty.hidden=shown!==0;
}
function setFilter(value,updateAddress){
  activeFilter=filterValues.includes(value)?value:"all";
  filters.forEach(button=>{
    const selected=button.dataset.filter===activeFilter;
    button.classList.toggle("active",selected);
    button.setAttribute("aria-pressed",String(selected));
  });
  filterCards();
  if(updateAddress){
    const url=new URL(window.location.href);
    if(activeFilter==="all")url.searchParams.delete("tipo");
    else url.searchParams.set("tipo",activeFilter);
    window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  }
}
filters.forEach(button=>button.addEventListener("click",()=>setFilter(button.dataset.filter,true)));
search.addEventListener("input",filterCards);
document.querySelectorAll("[data-favorite]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.favorite;
  favorites=favorites.includes(id)?favorites.filter(item=>item!==id):[...favorites,id];
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));}catch(_){}
  renderFavorites();
  filterCards();
}));

const experiences={
  discovery:{
    id:"discovery",title:"Descubra seu estilo.",eyebrow:"QUIZ · AUTOCONHECIMENTO",
    description:"Responda a cinco perguntas rápidas. No final, você recebe um retrato leve do jeito que gosta de descobrir coisas novas.",
    duration:"5 perguntas · cerca de 2 minutos",mode:"quiz",
    questions:[
      {question:"O que mais desperta sua curiosidade?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Informações, ideias e curiosidades.",value:"curiosity"},{label:"Conversas e trocas com outras pessoas.",value:"connection"},{label:"Perceber o que faz sentido para mim.",value:"reflection"},{label:"Novidades e experiências criativas.",value:"exploration"}]},
      {question:"Em um momento livre, o que parece mais convidativo?",prompt:"Não existe resposta certa.",options:[{label:"Ler, pesquisar ou aprender algo.",value:"curiosity"},{label:"Compartilhar um momento com alguém.",value:"connection"},{label:"Ter um tempo só meu.",value:"reflection"},{label:"Experimentar algo diferente.",value:"exploration"}]},
      {question:"Quando surge uma novidade, você prefere…",prompt:"Pense no que costuma acontecer naturalmente.",options:[{label:"Entender primeiro como funciona.",value:"curiosity"},{label:"Conversar e trocar impressões.",value:"connection"},{label:"Sentir se aquilo combina comigo.",value:"reflection"},{label:"Testar e descobrir na prática.",value:"exploration"}]},
      {question:"Qual palavra mais combina com seu momento?",prompt:"Escolha a que mais chama sua atenção.",options:[{label:"Curiosidade.",value:"curiosity"},{label:"Conexão.",value:"connection"},{label:"Autenticidade.",value:"reflection"},{label:"Descoberta.",value:"exploration"}]},
      {question:"O que você gostaria de levar desta experiência?",prompt:"Escolha a expectativa mais próxima da sua.",options:[{label:"Uma informação interessante.",value:"curiosity"},{label:"Uma boa conversa.",value:"connection"},{label:"Uma percepção sobre mim.",value:"reflection"},{label:"Uma ideia para experimentar.",value:"exploration"}]}
    ],
    results:{
      curiosity:{title:"Curiosidade em movimento.",description:"Você parece gostar de perguntas, informações e novos pontos de vista. Descobrir começa quando algo desperta sua vontade de entender melhor.",advice:"Continue explorando no seu ritmo. Uma boa pergunta pode abrir caminhos interessantes."},
      connection:{title:"Conexão em primeiro plano.",description:"Conversas, trocas e experiências compartilhadas parecem tornar as descobertas mais especiais para você.",advice:"Valorize os encontros em que existe espaço para ouvir, falar e descobrir em conjunto."},
      reflection:{title:"Autoconhecimento no seu ritmo.",description:"Você tende a observar o que sente e a considerar com cuidado aquilo que realmente faz sentido para você.",advice:"Respeitar seu próprio tempo também é uma forma de descoberta."},
      exploration:{title:"Exploração com criatividade.",description:"Novidades, possibilidades e experiências práticas parecem chamar sua atenção.",advice:"Mantenha a curiosidade viva e escolha sempre o que combina com seus limites e vontades."}
    }
  },
  connection:{
    id:"connection",title:"Conexão a dois.",eyebrow:"EXPERIÊNCIA · A DOIS",
    description:"Uma sequência de perguntas abertas para criar espaço para escuta, carinho e novas conversas. Vocês podem passar qualquer pergunta.",
    duration:"6 cartas · no tempo de vocês",mode:"prompts",
    questions:[
      {question:"Um momento que fica.",prompt:"Qual pequeno momento recente fez você sorrir — e por quê?"},
      {question:"Mais do que rotina.",prompt:"O que você gostaria que vocês fizessem mais vezes juntos?"},
      {question:"Carinho no cotidiano.",prompt:"Que gesto simples faz você se sentir acolhido(a) e lembrado(a)?"},
      {question:"Uma novidade em dupla.",prompt:"Que novidade vocês gostariam de descobrir juntos, sem pressa?"},
      {question:"Jeitos de demonstrar afeto.",prompt:"Como você gosta de demonstrar carinho — e como prefere recebê-lo?"},
      {question:"Espaço para conversar.",prompt:"Existe algum desejo, limite ou assunto que seria bom conversar com calma e respeito?"}
    ],
    result:{title:"Uma boa conversa é uma descoberta.",description:"Vocês passaram por seis convites à conversa. Não é preciso chegar a conclusões: ouvir com atenção e respeitar o tempo de cada pessoa já é um ótimo começo.",advice:"Guardem uma pergunta para retomar em outro momento. Conexão também se constrói aos poucos."}
  },
  curiosity:{
    id:"curiosity",title:"Mitos ou verdades?",eyebrow:"QUIZ · RESPEITO E CONSENTIMENTO",
    description:"Cinco perguntas para revisar informações essenciais sobre consentimento, autonomia e respeito aos limites.",
    duration:"5 perguntas · com explicações",mode:"truth",
    questions:[
      {question:"Se alguém consentiu em uma ocasião, isso significa que consentiu automaticamente em outra.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. O consentimento em uma ocasião não autoriza automaticamente outra ocasião. A vontade precisa ser respeitada em cada situação."},
      {question:"Uma pessoa pode mudar de ideia e retirar o consentimento a qualquer momento.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. A pessoa pode voltar atrás. Quando alguém não quer continuar, a decisão deve ser respeitada sem pressão."},
      {question:"Silêncio ou ausência de resistência, por si só, significam consentimento.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. Silêncio e falta de resistência não devem ser tratados como autorização. Em caso de dúvida, pare e converse."},
      {question:"Aceitar uma prática significa aceitar automaticamente qualquer outra.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. O consentimento é específico: concordar com uma coisa não significa concordar com outras."},
      {question:"O consentimento precisa ser livre, sem coação, ameaça ou pressão.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. A vontade precisa ser livre. Pressão, ameaça ou manipulação não representam uma escolha livre."}
    ],
    result:{title:"Informação também é cuidado.",description:"Você respondeu às cinco perguntas. Use as explicações como ponto de partida para conversar, aprender e respeitar a autonomia de cada pessoa.",advice:"O objetivo não é tirar nota: é reforçar que consentimento, comunicação e respeito caminham juntos."}
  },
  challenge:{
    id:"challenge",title:"Pequenas descobertas.",eyebrow:"DESAFIO · PAUSA E AUTOCONHECIMENTO",
    description:"Cinco passos simples para prestar atenção às próprias preferências, reconhecer limites e fazer escolhas sem pressa.",
    duration:"5 passos · no seu tempo",mode:"prompts",
    questions:[
      {question:"Faça uma pausa.",prompt:"Reserve um instante para perceber o que faz você se sentir confortável e em paz."},
      {question:"Reconheça um limite.",prompt:"Pense em um limite pessoal que seja importante para você respeitar ou comunicar."},
      {question:"Dê espaço à curiosidade.",prompt:"Escolha uma pergunta que gostaria de fazer ou pesquisar, sem obrigação de encontrar a resposta agora."},
      {question:"Escolha um cuidado possível.",prompt:"Pense em um gesto simples de cuidado ou descanso que faça sentido para o seu momento."},
      {question:"Valorize uma descoberta.",prompt:"Identifique algo que percebeu sobre suas preferências e escolha um próximo passo gentil consigo."}
    ],
    result:{title:"Pequenos passos também são descobertas.",description:"Você concluiu os cinco passos do desafio. Não existe uma meta a cumprir nem uma resposta ideal: o importante é respeitar suas escolhas.",advice:"Volte a esta atividade quando quiser fazer uma nova pausa. Cada momento pode trazer percepções diferentes."}
  }
};

function clearDialogState(){
  questionIndex=0;
  answers=[];
  byId("experienceIntro").hidden=false;
  byId("experienceRunner").hidden=true;
  byId("experienceResult").hidden=true;
  byId("experienceProgressBar").style.width="0%";
  byId("experienceCounter").textContent="";
  byId("experienceSources").hidden=true;
}
function openExperience(id,opener){
  const experience=experiences[id];
  if(!experience)return;
  current=experience;
  lastOpener=opener||document.activeElement;
  byId("experienceEyebrow").textContent=experience.eyebrow;
  byId("experienceTitle").textContent=experience.title;
  byId("experienceDescription").textContent=experience.description;
  byId("experienceDuration").textContent=experience.duration;
  clearDialogState();
  dialog.showModal();
  byId("experienceClose").focus();
}
document.querySelectorAll("[data-experience]").forEach(button=>button.addEventListener("click",()=>openExperience(button.dataset.experience,button)));
function startExperience(){
  byId("experienceIntro").hidden=true;
  byId("experienceRunner").hidden=false;
  questionIndex=0;
  answers=[];
  renderQuestion();
}
byId("experienceStart").addEventListener("click",startExperience);
function renderQuestion(){
  const item=current.questions[questionIndex];
  const total=current.questions.length;
  byId("experienceCounter").textContent=(questionIndex+1)+" / "+total;
  byId("experienceStepLabel").textContent=(current.mode==="prompts"&&current.id==="challenge"?"PASSO ":"ETAPA ")+(questionIndex+1)+" DE "+total;
  byId("experienceQuestion").textContent=item.question;
  byId("experiencePrompt").textContent=item.prompt;
  byId("experienceProgressBar").style.width=((questionIndex+1)/total*100)+"%";
  byId("experienceFeedback").hidden=true;
  byId("experienceFeedback").textContent="";
  const options=byId("experienceOptions");
  options.replaceChildren();
  const next=byId("experienceNext");
  next.disabled=false;
  next.textContent=current.mode==="prompts"?(current.id==="challenge"?"Marcar passo como concluído →":"Próxima pergunta →"):(questionIndex===total-1?"Ver resultado →":"Continuar →");
  if(current.mode==="prompts"){
    options.hidden=true;
    next.disabled=false;
    return;
  }
  options.hidden=false;
  const choices=current.mode==="truth"?[
    {label:"Verdadeiro",value:true},
    {label:"Falso",value:false}
  ]:item.options;
  choices.forEach(choice=>{
    const button=document.createElement("button");
    button.type="button";
    button.textContent=choice.label;
    button.setAttribute("aria-pressed","false");
    button.addEventListener("click",()=>selectAnswer(choice.value,button));
    options.append(button);
  });
  next.disabled=true;
}
function selectAnswer(value,button){
  answers[questionIndex]=value;
  byId("experienceOptions").querySelectorAll("button").forEach(option=>option.setAttribute("aria-pressed",String(option===button)));
  byId("experienceNext").disabled=false;
  if(current.mode==="truth"){
    const item=current.questions[questionIndex];
    const correct=value===item.answer;
    const feedback=byId("experienceFeedback");
    feedback.textContent=(correct?"Você acertou. ":"Vamos revisar. ")+item.explanation;
    feedback.hidden=false;
    byId("experienceNext").textContent=questionIndex===current.questions.length-1?"Ver resultado →":"Próxima pergunta →";
  }
}
byId("experienceNext").addEventListener("click",()=>{
  if(current.mode!=="prompts"&&typeof answers[questionIndex]==="undefined")return;
  if(questionIndex<current.questions.length-1){questionIndex++;renderQuestion();return;}
  finishExperience();
});
function finishExperience(){
  byId("experienceRunner").hidden=true;
  byId("experienceResult").hidden=false;
  byId("experienceCounter").textContent="CONCLUÍDA";
  byId("experienceProgressBar").style.width="100%";
  byId("experienceSources").hidden=current.id!=="curiosity";
  if(current.id==="discovery"){
    const counts={curiosity:0,connection:0,reflection:0,exploration:0};
    answers.forEach(value=>{if(Object.prototype.hasOwnProperty.call(counts,value))counts[value]++;});
    const winner=Object.keys(counts).reduce((best,key)=>counts[key]>counts[best]?key:best,"curiosity");
    const result=current.results[winner];
    byId("experienceResultTitle").textContent=result.title;
    byId("experienceResultDescription").textContent=result.description;
    byId("experienceResultAdvice").textContent=result.advice;
  }else if(current.id==="curiosity"){
    const score=current.questions.reduce((total,item,index)=>total+(answers[index]===item.answer?1:0),0);
    byId("experienceResultTitle").textContent=current.result.title;
    byId("experienceResultDescription").textContent="Você acertou "+score+" de "+current.questions.length+" perguntas. "+current.result.description;
    byId("experienceResultAdvice").textContent=current.result.advice;
  }else{
    byId("experienceResultTitle").textContent=current.result.title;
    byId("experienceResultDescription").textContent=current.result.description;
    byId("experienceResultAdvice").textContent=current.result.advice;
  }
  byId("experienceRestart").focus();
}
function restartExperience(){
  byId("experienceResult").hidden=true;
  byId("experienceRunner").hidden=false;
  questionIndex=0;
  answers=[];
  renderQuestion();
}
byId("experienceRestart").addEventListener("click",restartExperience);
byId("experienceDone").addEventListener("click",()=>dialog.close());
byId("experienceClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("close",()=>{
  current=null;
  clearDialogState();
  if(lastOpener&&typeof lastOpener.focus==="function")lastOpener.focus();
});
function setupAge(){
  let approved=false;
  try{approved=localStorage.getItem(AGE_KEY)==="1";}catch(_){}
  if(approved)return;
  ageGate.showModal();
  byId("ageConfirm").addEventListener("click",()=>{
    try{localStorage.setItem(AGE_KEY,"1");}catch(_){}
    ageGate.close();
  });
}
const initialFilter=new URLSearchParams(window.location.search).get("tipo")||"all";
setFilter(initialFilter,false);
renderFavorites();
filterCards();
setupAge();
})();