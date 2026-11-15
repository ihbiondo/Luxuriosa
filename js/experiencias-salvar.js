import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://byiykxfugvxuowueuxca.supabase.co",
  "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y",
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);

const TERMS_VERSION = "luxuriosa-experiencias-v1-2026-11";
const panel = document.getElementById("experienceSavePanel");
const button = document.getElementById("experienceSaveButton");
const status = document.getElementById("experienceSaveStatus");
let currentResult = null;
let saved = false;
let activeUser = null;
let accessReady = Promise.resolve(false);

const allowedActivities = {
  discovery: { title: "Descubra seu estilo", category: "ferramentas" },
  connection: { title: "Conexão a dois", category: "relacionamento" },
  curiosity: { title: "Mitos ou verdades?", category: "ferramentas" },
  challenge: { title: "Pequenas descobertas", category: "ferramentas" },
  knowledge_quiz: { title: "Conhecimentos essenciais sobre saúde sexual", category: "educacao" },
  sign_profile: { title: "Descubra seu signo solar", category: "astrologia" },
  sign_compatibility: { title: "Combinação entre signos", category: "astrologia" }
};

function showStatus(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind || "info";
  status.hidden = false;
}

async function hasActiveTerms(userId) {
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

function addAchievementsLink() {
  const nav = document.querySelector(".header nav, .ed-menu nav");
  if (!nav || nav.querySelector('a[href="/portal/conquistas/"]')) return;

  const link = document.createElement("a");
  link.href = "/portal/conquistas/";
  link.textContent = "Minhas conquistas";
  link.setAttribute("aria-label", "Abrir Minhas conquistas");
  nav.append(link);
}

async function checkAccess() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    activeUser = data?.session?.user || null;
    if (!activeUser) return false;

    const accepted = await hasActiveTerms(activeUser.id);
    if (accepted) addAchievementsLink();
    return accepted;
  } catch (error) {
    console.warn("Acesso às conquistas não autorizado ou indisponível:", error);
    return false;
  }
}

function buildResult(detail) {
  if (!detail || !allowedActivities[detail.activity_id]) return null;
  const definition = allowedActivities[detail.activity_id];
  const resultTitle = String(detail.result_title || "").trim().slice(0, 120);
  const resultSummary = String(detail.result_summary || "").trim().slice(0, 800);
  if (resultTitle.length < 2 || resultSummary.length < 2) return null;

  return {
    attempt_id: String(detail.attempt_id || crypto.randomUUID()),
    activity_id: detail.activity_id,
    activity_title: definition.title,
    category: definition.category,
    result_title: resultTitle,
    result_summary: resultSummary,
    score: Number.isInteger(detail.score) ? detail.score : null,
    score_max: Number.isInteger(detail.score_max) ? detail.score_max : null
  };
}

async function insertResult(result, user) {
  const { error } = await supabase.from("experience_results").insert({
    user_id: user.id,
    ...result
  });

  if (!error) return;

  if (error.code === "23505") {
    const { data, error: lookupError } = await supabase
      .from("experience_results")
      .select("id")
      .eq("attempt_id", result.attempt_id)
      .maybeSingle();
    if (!lookupError && data) return;
  }

  throw error;
}

accessReady = checkAccess();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    panel.hidden = true;
    currentResult = null;
    saved = false;
    document.querySelector('.header nav a[href="/portal/conquistas/"], .ed-menu nav a[href="/portal/conquistas/"]')?.remove();
  }
});

window.addEventListener("lux:experience-finished", async (event) => {
  const authorized = await accessReady;
  if (!authorized) {
    panel.hidden = true;
    return;
  }

  currentResult = buildResult(event.detail);
  saved = false;
  if (!currentResult) {
    panel.hidden = true;
    return;
  }

  button.disabled = false;
  button.textContent = "Salvar resultado na minha conta";
  status.hidden = true;
  panel.hidden = false;
});

button.addEventListener("click", async () => {
  if (!currentResult || saved) return;

  button.disabled = true;
  button.textContent = "Verificando seu acesso…";
  status.hidden = true;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (!user || !(await hasActiveTerms(user.id))) {
      panel.hidden = true;
      currentResult = null;
      return;
    }

    await insertResult(currentResult, user);
    saved = true;
    button.textContent = "Resultado salvo ✓";
    showStatus("Pronto! Este resumo foi salvo no seu histórico privado.", "success");

    const link = document.createElement("a");
    link.href = "/portal/conquistas/";
    link.textContent = "Ver Minhas conquistas →";
    link.className = "save-result-link";
    status.append(" ");
    status.append(link);
  } catch (error) {
    console.error("Não foi possível salvar o resultado:", error);
    button.disabled = false;
    button.textContent = "Tentar salvar novamente";
    showStatus("Não conseguimos salvar agora. Suas respostas continuam apenas nesta página. Tente novamente.", "error");
  }
});
