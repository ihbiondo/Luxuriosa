import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://byiykxfugvxuowueuxca.supabase.co",
  "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y",
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);

const TERMS_VERSION = "luxuriosa-experiencias-v1-2026-11";
const activityNames = {
  discovery: "Descubra seu estilo",
  connection: "Conexão a dois",
  curiosity: "Mitos ou verdades?",
  challenge: "Pequenas descobertas",
  knowledge_quiz: "Conhecimentos essenciais sobre saúde sexual",
  sign_profile: "Descubra seu signo solar",
  sign_compatibility: "Combinação entre signos"
};
const categoryNames = {
  prazer: "Prazer",
  relacionamento: "Relacionamento",
  astrologia: "Astrologia",
  ferramentas: "Ferramentas",
  educacao: "Educação",
  noticias: "Notícias"
};

const loading = document.getElementById("conquistasLoading");
const app = document.getElementById("conquistasApp");
const termsGate = document.getElementById("conquistasTermsGate");
const dashboard = document.getElementById("conquistasMain");
const termsCheckbox = document.getElementById("conquistasTermsCheckbox");
const acceptButton = document.getElementById("conquistasAcceptTerms");
const termsStatus = document.getElementById("conquistasGateStatus");
const statusBox = document.getElementById("conquistasStatus");
const historyList = document.getElementById("conquistasHistory");
const emptyState = document.getElementById("conquistasEmpty");
const deactivateButton = document.getElementById("conquistasDeactivate");
let activeUser = null;

function showStatus(element, message, kind) {
  element.textContent = message;
  element.dataset.kind = kind || "info";
  element.hidden = false;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

async function getTermsAcceptance(userId) {
  const { data, error } = await supabase
    .from("experience_terms_acceptances")
    .select("terms_version, accepted_at, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(
    data &&
    data.terms_version === TERMS_VERSION &&
    data.accepted_at &&
    !data.revoked_at
  );
}

function showGate(message) {
  termsGate.hidden = false;
  dashboard.hidden = true;
  termsCheckbox.checked = false;
  acceptButton.disabled = true;
  if (message) showStatus(termsStatus, message, "info");
}

async function activateTerms() {
  if (!termsCheckbox.checked || !activeUser) return;

  acceptButton.disabled = true;
  acceptButton.textContent = "Registrando aceite…";
  termsStatus.hidden = true;

  try {
    const { error } = await supabase.rpc("accept_my_experience_terms", {
      p_terms_version: TERMS_VERSION
    });

    if (error) throw error;

    termsGate.hidden = true;
    dashboard.hidden = false;
    showStatus(statusBox, "Termos aceitos. Minhas conquistas está ativada nesta conta.", "success");
    try {
      await loadResults();
    } catch (loadError) {
      console.error("Falha ao carregar o histórico após a ativação:", loadError);
      showStatus(statusBox, "A área foi ativada, mas o histórico não pôde ser carregado agora. Atualize a página ou tente novamente.", "error");
    }
  } catch (error) {
    console.error("Falha ao registrar aceite dos termos:", error);
    showStatus(termsStatus, "Não foi possível registrar seu aceite agora. Confira sua conexão e tente novamente.", "error");
  } finally {
    acceptButton.disabled = !termsCheckbox.checked;
    acceptButton.textContent = "Aceitar e ativar Minhas conquistas";
  }
}

termsCheckbox.addEventListener("change", () => {
  acceptButton.disabled = !termsCheckbox.checked;
});
acceptButton.addEventListener("click", activateTerms);

async function loadResults() {
  historyList.replaceChildren();
  historyList.hidden = true;
  emptyState.hidden = true;

  const { data, error } = await supabase
    .from("experience_results")
    .select("id, attempt_id, activity_id, activity_title, category, result_title, result_summary, score, score_max, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const results = Array.isArray(data) ? data : [];
  const distinctActivities = new Set(
    results.map(item => item.activity_id).filter(id => Object.prototype.hasOwnProperty.call(activityNames, id))
  );
  const distinctCategories = new Set(results.map(item => item.category));
  const points = distinctActivities.size * 10;

  document.getElementById("conquistasPoints").textContent = String(points);
  document.getElementById("conquistasActivities").textContent = String(distinctActivities.size);
  document.getElementById("conquistasSaved").textContent = String(results.length);

  renderBadges(distinctActivities, distinctCategories.size);

  if (!results.length) {
    emptyState.hidden = false;
    return;
  }

  results.forEach(item => historyList.append(createResultCard(item)));
  historyList.hidden = false;
}

function renderBadges(distinctActivities, categoryCount) {
  const activityCount = distinctActivities.size;
  const badges = [
    { icon: "✦", title: "Primeira descoberta", description: "Salve seu primeiro resultado.", unlocked: activityCount >= 1 },
    { icon: "◇", title: "Curiosidade em movimento", description: "Explore duas atividades diferentes.", unlocked: activityCount >= 2 },
    { icon: "♡", title: "Olhar diverso", description: "Experimente dois segmentos diferentes.", unlocked: categoryCount >= 2 },
    { icon: "✧", title: "Explorador(a)", description: "Salve três atividades diferentes.", unlocked: activityCount >= 3 },
    { icon: "♛", title: "Jornada completa", description: "Conclua as quatro experiências iniciais.", unlocked: ["discovery", "connection", "curiosity", "challenge"].every(id => distinctActivities.has(id)) }
  ];

  const grid = document.getElementById("conquistasBadges");
  grid.replaceChildren();

  badges.forEach(item => {
    const card = document.createElement("article");
    card.className = "conquista-badge" + (item.unlocked ? " is-unlocked" : " is-locked");

    const icon = document.createElement("span");
    icon.className = "conquista-badge-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon;

    const title = document.createElement("strong");
    title.textContent = item.title;

    const description = document.createElement("small");
    description.textContent = item.description;

    const state = document.createElement("span");
    state.className = "conquista-badge-state";
    state.textContent = item.unlocked ? "Conquistada" : "Ainda bloqueada";

    card.append(icon, title, description, state);
    grid.append(card);
  });
}

function createResultCard(item) {
  const card = document.createElement("article");
  card.className = "conquista-result";

  const top = document.createElement("div");
  top.className = "conquista-result-top";

  const category = document.createElement("span");
  category.className = "conquista-category";
  category.textContent = categoryNames[item.category] || "Experiência";

  const date = document.createElement("time");
  date.dateTime = item.created_at;
  date.textContent = formatDate(item.created_at);

  const title = document.createElement("h3");
  title.textContent = item.result_title || item.activity_title || "Resultado salvo";

  const summary = document.createElement("p");
  summary.textContent = item.result_summary || "";

  const meta = document.createElement("div");
  meta.className = "conquista-result-meta";

  const activity = document.createElement("span");
  activity.textContent = activityNames[item.activity_id] || item.activity_title || "Atividade";
  meta.append(activity);

  if (Number.isInteger(item.score) && Number.isInteger(item.score_max)) {
    const score = document.createElement("span");
    score.textContent = "Acertos: " + item.score + " de " + item.score_max;
    meta.append(score);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "conquista-delete";
  remove.textContent = "Excluir resultado";
  remove.addEventListener("click", () => deleteResult(item.id, card, remove));

  top.append(category, date);
  card.append(top, title, summary, meta, remove);
  return card;
}

async function deleteResult(id, card, button) {
  if (!window.confirm("Excluir este resultado do seu histórico? Esta ação não pode ser desfeita.")) return;
  button.disabled = true;
  button.textContent = "Excluindo…";

  const { error } = await supabase
    .from("experience_results")
    .delete()
    .eq("id", id)
    .eq("user_id", activeUser.id);

  if (error) {
    button.disabled = false;
    button.textContent = "Tentar excluir novamente";
    showStatus(statusBox, "Não foi possível excluir o registro. Tente novamente.", "error");
    console.error("Falha ao excluir resultado:", error);
    return;
  }

  card.remove();
  showStatus(statusBox, "Resultado excluído do seu histórico.", "success");
  try {
    await loadResults();
  } catch (loadError) {
    console.error("Falha ao atualizar o histórico após a exclusão:", loadError);
    showStatus(statusBox, "O resultado foi excluído, mas o resumo do histórico não pôde ser atualizado. Recarregue a página.", "error");
  }
}

async function deactivateArea() {
  const accepted = window.confirm(
    "Desativar Minhas conquistas? O aceite será revogado e todos os resultados salvos nessa área serão apagados. Essa ação não pode ser desfeita."
  );
  if (!accepted) return;

  deactivateButton.disabled = true;
  deactivateButton.textContent = "Desativando…";

  try {
    const { error } = await supabase.rpc("revoke_my_experience_terms");
    if (error) throw error;

    showGate("Minhas conquistas foi desativada e o histórico salvo foi apagado. Você pode aceitar novamente os termos quando desejar.");
  } catch (error) {
    console.error("Falha ao desativar Minhas conquistas:", error);
    showStatus(statusBox, "Não foi possível desativar a área agora. Tente novamente.", "error");
  } finally {
    deactivateButton.disabled = false;
    deactivateButton.textContent = "Desativar e apagar meu histórico";
  }
}

deactivateButton.addEventListener("click", deactivateArea);

async function boot() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    activeUser = data?.session?.user || null;

    if (!activeUser) {
      window.location.replace("/login.html?next=portal%2Fconquistas%2F");
      return;
    }

    const accepted = await getTermsAcceptance(activeUser.id);
    loading.hidden = true;
    app.hidden = false;

    if (!accepted) {
      showGate();
      return;
    }

    termsGate.hidden = true;
    dashboard.hidden = false;
    try {
      await loadResults();
    } catch (loadError) {
      console.error("Falha ao carregar o histórico:", loadError);
      showStatus(statusBox, "Não foi possível carregar seu histórico agora. Atualize a página ou tente novamente.", "error");
    }
  } catch (error) {
    console.error("Falha ao abrir Minhas conquistas:", error);
    loading.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "Não foi possível verificar seu acesso.";
    const detail = document.createElement("small");
    detail.textContent = "Entre novamente ou tente mais tarde. Seus resultados continuam protegidos.";
    const link = document.createElement("a");
    link.href = "/portal/";
    link.className = "primary";
    link.textContent = "Voltar ao Meu Portal";
    loading.append(title, detail, link);
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    window.location.replace("/login.html?next=portal%2Fconquistas%2F");
  }
});

boot();
