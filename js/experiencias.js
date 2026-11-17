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

    const items = [
      { label: "Meu Portal", href: "/portal/", className: "global-nav-link global-nav-link--portal" },
      { label: "Experiências", href: "/experiencias/", className: "global-nav-link global-nav-link--experiences", current: "page" },
      { label: "Educação", href: "/educacao/", className: "global-nav-link global-nav-link--education" },
      { label: "Voltar para Loja", href: "/", className: "global-nav-link global-nav-link--store" }
    ];
    const links = items.map(item => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      if (item.className) link.className = item.className;
      if (item.current) link.setAttribute("aria-current", item.current);
      return link;
    });
    nav.replaceChildren(...links);
    nav.setAttribute("aria-label", "Navegação principal da Luxuriosa");

    const footer = document.querySelector(".footer");
    if (footer) {
      [
        { href: "/", label: "Loja" },
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
    description:"Responda a quinze perguntas rápidas. No final, você recebe um retrato leve do jeito que gosta de descobrir coisas novas.",
    duration:"15 perguntas · cerca de 5 minutos",mode:"quiz",
    questions:[
      {question:"O que mais desperta sua curiosidade?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Informações, ideias e curiosidades.",value:"curiosity"},{label:"Conversas e trocas com outras pessoas.",value:"connection"},{label:"Perceber o que faz sentido para mim.",value:"reflection"},{label:"Novidades e experiências criativas.",value:"exploration"}]},
      {question:"Em um momento livre, o que parece mais convidativo?",prompt:"Não existe resposta certa.",options:[{label:"Ler, pesquisar ou aprender algo.",value:"curiosity"},{label:"Compartilhar um momento com alguém.",value:"connection"},{label:"Ter um tempo só meu.",value:"reflection"},{label:"Experimentar algo diferente.",value:"exploration"}]},
      {question:"Quando surge uma novidade, você prefere…",prompt:"Pense no que costuma acontecer naturalmente.",options:[{label:"Entender primeiro como funciona.",value:"curiosity"},{label:"Conversar e trocar impressões.",value:"connection"},{label:"Sentir se aquilo combina comigo.",value:"reflection"},{label:"Testar e descobrir na prática.",value:"exploration"}]},
      {question:"Qual palavra mais combina com seu momento?",prompt:"Escolha a que mais chama sua atenção.",options:[{label:"Curiosidade.",value:"curiosity"},{label:"Conexão.",value:"connection"},{label:"Autenticidade.",value:"reflection"},{label:"Descoberta.",value:"exploration"}]},
      {question:"O que você gostaria de levar desta experiência?",prompt:"Escolha a expectativa mais próxima da sua.",options:[{label:"Uma informação interessante.",value:"curiosity"},{label:"Uma boa conversa.",value:"connection"},{label:"Uma percepção sobre mim.",value:"reflection"},{label:"Uma ideia para experimentar.",value:"exploration"}]},
      {question:"Quando você precisa decidir sobre algo novo, o que ajuda?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Pesquisar diferentes possibilidades.",value:"curiosity"},{label:"Ouvir alguém em quem confio.",value:"connection"},{label:"Perceber meus próprios limites.",value:"reflection"},{label:"Experimentar aos poucos.",value:"exploration"}]},
      {question:"Qual ambiente favorece suas descobertas?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Um lugar com informação e tranquilidade.",value:"curiosity"},{label:"Um espaço de troca e conversa.",value:"connection"},{label:"Um momento reservado e confortável.",value:"reflection"},{label:"Um lugar que permita testar ideias.",value:"exploration"}]},
      {question:"O que faz uma experiência valer a pena?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Aprender algo que não sabia.",value:"curiosity"},{label:"Sentir que houve uma troca verdadeira.",value:"connection"},{label:"Respeitar meu tempo e minhas escolhas.",value:"reflection"},{label:"Encontrar uma possibilidade inesperada.",value:"exploration"}]},
      {question:"Quando uma ideia não combina com você, costuma…",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Investigar melhor antes de concluir.",value:"curiosity"},{label:"Conversar e entender outros pontos de vista.",value:"connection"},{label:"Reconhecer que não é para mim.",value:"reflection"},{label:"Buscar uma alternativa diferente.",value:"exploration"}]},
      {question:"Qual convite parece mais interessante hoje?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Conhecer um assunto novo.",value:"curiosity"},{label:"Ter uma conversa sem pressa.",value:"connection"},{label:"Fazer uma pausa para me escutar.",value:"reflection"},{label:"Tentar algo criativo e simples.",value:"exploration"}]},
      {question:"Ao aprender algo, você prefere…",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Passo a passo e explicações.",value:"curiosity"},{label:"Exemplos compartilhados e diálogo.",value:"connection"},{label:"Tempo para refletir sozinho(a).",value:"reflection"},{label:"Atividades práticas.",value:"exploration"}]},
      {question:"O que mais ajuda a construir confiança?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Informação clara e transparência.",value:"curiosity"},{label:"Escuta e reciprocidade.",value:"connection"},{label:"Respeito aos meus limites.",value:"reflection"},{label:"Liberdade para descobrir sem pressão.",value:"exploration"}]},
      {question:"Diante de uma mudança, você tende a…",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Entender o que está mudando.",value:"curiosity"},{label:"Conversar com quem participa.",value:"connection"},{label:"Avaliar como me sinto.",value:"reflection"},{label:"Testar caminhos possíveis.",value:"exploration"}]},
      {question:"Que tipo de conteúdo você costuma guardar?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Explicações e referências úteis.",value:"curiosity"},{label:"Ideias para conversar com alguém.",value:"connection"},{label:"Reflexões que fazem pensar.",value:"reflection"},{label:"Sugestões para experimentar.",value:"exploration"}]},
      {question:"Qual frase combina mais com seu momento?",prompt:"Escolha a alternativa que mais combina com você.",options:[{label:"Quero compreender melhor.",value:"curiosity"},{label:"Quero fortalecer minhas conexões.",value:"connection"},{label:"Quero respeitar meu próprio ritmo.",value:"reflection"},{label:"Quero abrir espaço para novidades.",value:"exploration"}]},
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
    description:"Dezoito cartas de conversa para criar espaço para escuta, carinho, limites e novas descobertas. Vocês podem passar qualquer pergunta.",
    duration:"18 cartas · no tempo de vocês",mode:"prompts",
    questions:[
      {question:"Um momento que fica.",prompt:"Qual pequeno momento recente fez você sorrir — e por quê?"},
      {question:"Mais do que rotina.",prompt:"O que você gostaria que vocês fizessem mais vezes juntos?"},
      {question:"Carinho no cotidiano.",prompt:"Que gesto simples faz você se sentir acolhido(a) e lembrado(a)?"},
      {question:"Uma novidade em dupla.",prompt:"Que novidade vocês gostariam de descobrir juntos, sem pressa?"},
      {question:"Jeitos de demonstrar afeto.",prompt:"Como você gosta de demonstrar carinho — e como prefere recebê-lo?"},
      {question:"Espaço para conversar.",prompt:"Existe algum desejo, limite ou assunto que seria bom conversar com calma e respeito?"},
      {question:"Uma conversa que faltou",prompt:"Existe algum assunto simples que vocês gostariam de conversar com mais calma?"},
      {question:"O que significa cuidado",prompt:"Que atitude demonstra cuidado para você, mesmo nos dias comuns?"},
      {question:"Um plano possível",prompt:"Que programa simples vocês poderiam combinar para esta semana?"},
      {question:"Aprender juntos",prompt:"Que assunto, habilidade ou atividade seria interessante aprender em dupla?"},
      {question:"Como pedir espaço",prompt:"Como cada pessoa prefere comunicar que precisa de um tempo ou de silêncio?"},
      {question:"Acolher uma diferença",prompt:"Em que tema vocês pensam diferente e conseguem conversar com respeito?"},
      {question:"Um gesto que aproxima",prompt:"Que pequeno gesto fortalece a sensação de parceria?"},
      {question:"Rotina e novidade",prompt:"Que hábito bom merece continuar e que novidade leve poderia entrar na rotina?"},
      {question:"Escuta de verdade",prompt:"O que ajuda você a sentir que está sendo ouvido sem julgamento?"},
      {question:"Limites confortáveis",prompt:"Como vocês podem deixar claro que qualquer pessoa pode dizer não ou pedir pausa?"},
      {question:"Memórias e histórias",prompt:"Que lembrança compartilhada merece ser revisitada?"},
      {question:"Planos individuais",prompt:"Como apoiar projetos pessoais sem deixar de cuidar do vínculo?"},
    ],
    result:{title:"Uma boa conversa é uma descoberta.",description:"Vocês passaram por dezoito convites à conversa. Não é preciso chegar a conclusões: ouvir com atenção e respeitar o tempo de cada pessoa já é um ótimo começo.",advice:"Guardem uma pergunta para retomar em outro momento. Conexão também se constrói aos poucos."}
  },
  curiosity:{
    id:"curiosity",title:"Mitos ou verdades?",eyebrow:"QUIZ · RESPEITO E CONSENTIMENTO",
    description:"Quinze afirmações para revisar ideias sobre consentimento, prevenção, saúde sexual, privacidade e cuidados com acessórios.",
    duration:"15 perguntas · com explicações",mode:"truth",
    questions:[
      {question:"Se alguém consentiu em uma ocasião, isso significa que consentiu automaticamente em outra.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. O consentimento em uma ocasião não autoriza automaticamente outra ocasião. A vontade precisa ser respeitada em cada situação."},
      {question:"Uma pessoa pode mudar de ideia e retirar o consentimento a qualquer momento.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. A pessoa pode voltar atrás. Quando alguém não quer continuar, a decisão deve ser respeitada sem pressão."},
      {question:"Silêncio ou ausência de resistência, por si só, significam consentimento.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. Silêncio e falta de resistência não devem ser tratados como autorização. Em caso de dúvida, pare e converse."},
      {question:"Aceitar uma prática significa aceitar automaticamente qualquer outra.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. O consentimento é específico: concordar com uma coisa não significa concordar com outras."},
      {question:"O consentimento precisa ser livre, sem coação, ameaça ou pressão.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. A vontade precisa ser livre. Pressão, ameaça ou manipulação não representam uma escolha livre."},
      {question:"O uso de dois preservativos ao mesmo tempo aumenta a proteção.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. Usar preservativo externo e interno juntos pode aumentar o atrito e favorecer deslocamento ou rompimento."},
      {question:"A vacina contra HPV trata uma infecção que já existe.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. A vacina é preventiva; não trata infecção ou lesão já existente."},
      {question:"O sexo oral pode transmitir algumas IST.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. Algumas infecções podem ser transmitidas por contato oral-genital; risco e prevenção dependem da infecção e da prática."},
      {question:"A PrEP e a PEP são a mesma estratégia.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. PrEP é prevenção antes de possíveis exposições ao HIV; PEP é uma medida de urgência depois de uma possível exposição."},
      {question:"Um teste negativo realizado logo após uma exposição sempre descarta uma IST.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. A janela diagnóstica varia conforme a infecção e o tipo de teste. Um serviço pode orientar quando testar e repetir."},
      {question:"Uma imagem íntima recebida pode ser encaminhada sem pedir autorização.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. Receber uma imagem não autoriza seu compartilhamento. A privacidade de quem aparece deve ser respeitada."},
      {question:"A base de um acessório anal ajuda a impedir que ele entre completamente.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:true,explanation:"Verdadeiro. A base larga ou um limitador externo é um recurso importante para reduzir o risco de retenção."},
      {question:"Todo acessório pode ser fervido para higienizar.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. A limpeza depende do material, desenho e componentes. Siga o fabricante e não improvise com calor, álcool ou produtos químicos."},
      {question:"Um ciclo menstrual precisa durar exatamente 28 dias para ser saudável.",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. A duração varia entre pessoas e ao longo da vida; 28 dias não é regra universal."},
      {question:"Uma pessoa que está dormindo ou inconsciente pode consentir?",prompt:"Esta afirmação é verdadeira ou falsa?",answer:false,explanation:"Falso. Uma pessoa que está dormindo ou inconsciente não pode dar consentimento. Aguarde que esteja plenamente consciente e capaz de decidir livremente."},
    ],
    result:{title:"Informação também é cuidado.",description:"Você respondeu às quinze perguntas. Use as explicações como ponto de partida para conversar, aprender e respeitar a autonomia de cada pessoa.",advice:"O objetivo não é tirar nota: é reforçar que consentimento, comunicação e respeito caminham juntos."}
  },
  challenge:{
    id:"challenge",title:"Pequenas descobertas.",eyebrow:"DESAFIO · PAUSA E AUTOCONHECIMENTO",
    description:"Quinze passos simples para prestar atenção às próprias preferências, reconhecer limites, cuidar da privacidade e fazer escolhas sem pressa.",
    duration:"15 passos · no seu tempo",mode:"prompts",
    questions:[
      {question:"Faça uma pausa.",prompt:"Reserve um instante para perceber o que faz você se sentir confortável e em paz."},
      {question:"Reconheça um limite.",prompt:"Pense em um limite pessoal que seja importante para você respeitar ou comunicar."},
      {question:"Dê espaço à curiosidade.",prompt:"Escolha uma pergunta que gostaria de fazer ou pesquisar, sem obrigação de encontrar a resposta agora."},
      {question:"Escolha um cuidado possível.",prompt:"Pense em um gesto simples de cuidado ou descanso que faça sentido para o seu momento."},
      {question:"Valorize uma descoberta.",prompt:"Identifique algo que percebeu sobre suas preferências e escolha um próximo passo gentil consigo."},
      {question:"Perceba sua energia",prompt:"Observe como está sua disposição hoje, sem tentar classificá-la como boa ou ruim."},
      {question:"Dê nome a uma necessidade",prompt:"Pense em algo de que você precisa neste momento: descanso, informação, companhia ou silêncio."},
      {question:"Escolha uma conversa segura",prompt:"Identifique alguém com quem você consegue conversar sem medo de julgamento."},
      {question:"Repare em uma expectativa",prompt:"Perceba uma expectativa que colocou sobre si e avalie se ela realmente faz sentido."},
      {question:"Pratique um não possível",prompt:"Pense em uma situação pequena na qual dizer não ou pedir tempo protegeria seu bem-estar."},
      {question:"Reconheça um sim genuíno",prompt:"Lembre de uma escolha recente que fez porque realmente queria, e não por pressão."},
      {question:"Encontre uma fonte confiável",prompt:"Escolha uma dúvida e pense em qual fonte oficial ou profissional poderia ajudar a respondê-la."},
      {question:"Faça uma pausa digital",prompt:"Reserve alguns minutos sem notificações e perceba como se sente."},
      {question:"Cuide de uma informação privada",prompt:"Revise uma permissão, senha ou compartilhamento digital que mereça mais atenção."},
      {question:"Planeje um próximo passo leve",prompt:"Escolha uma ação pequena e possível para continuar aprendendo ou cuidando de si."},
    ],
    result:{title:"Pequenos passos também são descobertas.",description:"Você concluiu os quinze passos do desafio. Não existe uma meta a cumprir nem uma resposta ideal: o importante é respeitar suas escolhas.",advice:"Volte a esta atividade quando quiser fazer uma nova pausa. Cada momento pode trazer percepções diferentes."}
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
  byId("experienceJourney").hidden=true;
  const savePanel=byId("experienceSavePanel");
  if(savePanel)savePanel.hidden=true;
  const saveStatus=byId("experienceSaveStatus");
  if(saveStatus){saveStatus.hidden=true;saveStatus.textContent="";}
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
  byId("experienceTitle").focus({ preventScroll: true });
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
  byId("experienceQuestion").focus({ preventScroll: false });
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

function normalizeJourneyPath(path){
  const clean=(path||"/").split("?")[0].split("#")[0];
  return clean.endsWith("/index.html")?clean.slice(0,-"index.html".length):clean;
}
function readJourneyHistory(){
  try{
    const value=JSON.parse(window.sessionStorage.getItem("lux_journey_session_v1")||"[]");
    return Array.isArray(value)?value.filter(item=>typeof item==="string").map(normalizeJourneyPath):[];
  }catch(_){return[];}
}
function recordJourneyPath(path){
  const clean=normalizeJourneyPath(path);
  if(!clean)return;
  const recent=readJourneyHistory();
  const updated=[clean,...recent.filter(item=>item!==clean)].slice(0,12);
  try{window.sessionStorage.setItem("lux_journey_session_v1",JSON.stringify(updated));}catch(_){}
}
function renderExperienceJourney(){
  const suggestions={
    discovery:{
      title:"Sua descoberta pode seguir por outro caminho.",
      description:"Escolha uma leitura, uma atividade ou uma nova perspectiva. Os convites variam conforme as páginas visitadas nesta sessão.",
      links:[
        {href:"/educacao/temas/saude-sexual-e-bem-estar.html",label:"Ler sobre saúde sexual e bem-estar"},
        {href:"/educacao/interatividade/",label:"Explorar atividades educativas"},
        {href:"/experiencias/signos.html",label:"Conhecer os signos"},
        {href:"/educacao/temas/consentimento-e-limites.html",label:"Entender consentimento e limites"}
      ]
    },
    connection:{
      title:"A conversa pode continuar com informação e cuidado.",
      description:"Você pode aprofundar comunicação, conhecer seus limites ou explorar um guia prático.",
      links:[
        {href:"/educacao/temas/relacoes-saudaveis-e-comunicacao.html",label:"Ler sobre relações e comunicação"},
        {href:"/educacao/temas/consentimento-e-limites.html",label:"Aprofundar consentimento"},
        {href:"/educacao/guias/",label:"Consultar os guias educativos"},
        {href:"/educacao/temas/seguranca-digital-e-privacidade.html",label:"Cuidar da privacidade"}
      ]
    },
    curiosity:{
      title:"Conhecimento bom é conhecimento que continua.",
      description:"Aprofunde os assuntos do quiz em fontes educativas e leituras relacionadas.",
      links:[
        {href:"/educacao/temas/prevencao-combinada.html",label:"Estudar prevenção combinada"},
        {href:"/educacao/temas/contracepcao.html",label:"Conhecer métodos contraceptivos"},
        {href:"/educacao/curiosidades/mitos-e-fatos-sobre-saude-sexual.html",label:"Revisar mitos e fatos"},
        {href:"/educacao/interatividade/",label:"Rever atividades educativas"}
      ]
    },
    challenge:{
      title:"Um pequeno passo já é uma continuação.",
      description:"Siga para uma leitura prática ou aprofunde um assunto que ajude no cuidado cotidiano.",
      links:[
        {href:"/educacao/guias/primeiro-acessorio.html",label:"Ler o guia do primeiro acessório"},
        {href:"/educacao/guias/limpeza-e-conservacao.html",label:"Aprender sobre limpeza e conservação"},
        {href:"/educacao/temas/saude-sexual-e-bem-estar.html",label:"Explorar saúde e bem-estar"},
        {href:"/educacao/temas/seguranca-digital-e-privacidade.html",label:"Revisar privacidade digital"}
      ]
    }
  };
  const suggestion=suggestions[current.id]||{
    title:"Continue explorando no seu ritmo.",
    description:"Há outras experiências e leituras gratuitas para descobrir.",
    links:[
      {href:"/educacao/",label:"Explorar Educação"},
      {href:"/experiencias/signos.html",label:"Conhecer os signos"},
      {href:"/portal/",label:"Voltar ao Portal"}
    ]
  };
  const recent=readJourneyHistory();
  const currentPath=normalizeJourneyPath(window.location.pathname);
  const ranked=suggestion.links.filter(item=>{
    const candidate=normalizeJourneyPath(item.href);
    return candidate!==currentPath&&!recent.includes(candidate);
  });
  const fallback=suggestion.links.filter(item=>normalizeJourneyPath(item.href)!==currentPath);
  const selected=(ranked.length>=2?ranked:fallback).slice(0,2);
  byId("experienceJourneyTitle").textContent=suggestion.title;
  byId("experienceJourneyDescription").textContent=suggestion.description;
  const links=[byId("experienceJourneyLinkOne"),byId("experienceJourneyLinkTwo")];
  links.forEach((link,index)=>{
    const item=selected[index]||{href:"/educacao/",label:"Explorar Educação"};
    link.href=item.href;
    link.textContent=item.label+" →";
    link.onclick=()=>recordJourneyPath(item.href);
  });
  byId("experienceJourney").hidden=false;
}
function finishExperience(){
  byId("experienceRunner").hidden=true;
  byId("experienceResult").hidden=false;
  byId("experienceCounter").textContent="CONCLUÍDA";
  byId("experienceProgressBar").style.width="100%";
  byId("experienceSources").hidden=current.id!=="curiosity";
  let score=null;
  let scoreMax=null;

  if(current.id==="discovery"){
    const counts={curiosity:0,connection:0,reflection:0,exploration:0};
    answers.forEach(value=>{if(Object.prototype.hasOwnProperty.call(counts,value))counts[value]++;});
    const winner=Object.keys(counts).reduce((best,key)=>counts[key]>counts[best]?key:best,"curiosity");
    const result=current.results[winner];
    byId("experienceResultTitle").textContent=result.title;
    byId("experienceResultDescription").textContent=result.description;
    byId("experienceResultAdvice").textContent=result.advice;
  }else if(current.id==="curiosity"){
    score=current.questions.reduce((total,item,index)=>total+(answers[index]===item.answer?1:0),0);
    scoreMax=current.questions.length;
    byId("experienceResultTitle").textContent=current.result.title;
    byId("experienceResultDescription").textContent="Você acertou "+score+" de "+current.questions.length+" perguntas. "+current.result.description;
    byId("experienceResultAdvice").textContent=current.result.advice;
  }else{
    byId("experienceResultTitle").textContent=current.result.title;
    byId("experienceResultDescription").textContent=current.result.description;
    byId("experienceResultAdvice").textContent=current.result.advice;
  }

  renderExperienceJourney();

  // O evento contém somente o resumo exibido ao visitante, nunca as respostas individuais.
  window.dispatchEvent(new CustomEvent("lux:experience-finished",{detail:{
    attempt_id:crypto.randomUUID(),
    activity_id:current.id,
    result_title:byId("experienceResultTitle").textContent.slice(0,120),
    result_summary:(byId("experienceResultDescription").textContent+" "+byId("experienceResultAdvice").textContent).trim().slice(0,800),
    score,
    score_max:scoreMax
  }}));

  byId("experienceResultTitle").focus({ preventScroll: false });
}
function restartExperience(){
  byId("experienceSavePanel").hidden=true;
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
recordJourneyPath(window.location.pathname);
setFilter(initialFilter,false);
renderFavorites();
filterCards();
setupAge();
})();