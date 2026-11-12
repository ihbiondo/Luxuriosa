import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://byiykxfugvxuowueuxca.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
let isMember = false;

function showMessage(text, error = false) {
  const box = $("clubMessage");
  box.textContent = text;
  box.classList.toggle("error", error);
  box.classList.add("show");
}

function setBusy(busy) {
  $("saveClub").disabled = busy;
  $("leaveClub").disabled = busy;
  $("saveClub").textContent = busy ? "SALVANDO..." : (isMember ? "SALVAR PREFERÊNCIAS" : "SALVAR MINHAS ESCOLHAS");
}

function renderState(state) {
  isMember = state?.is_member === true;
  $("joinChoice").hidden = isMember;
  $("leaveClub").hidden = !isMember;
  $("joinClub").checked = false;
  $("personalization").checked = state?.personalization === true;
  $("anonymousStatistics").checked = state?.anonymous_statistics === true;
  $("whatsappMarketing").checked = state?.whatsapp_marketing === true;
  $("clubStatus").textContent = isMember
    ? "Você já faz parte do Clube Luxuriosa. Atualize suas preferências quando quiser."
    : "Entre para o Clube ou apenas ajuste suas autorizações opcionais.";
  $("clubStatus").classList.add("show");
  $("saveClub").textContent = isMember ? "SALVAR PREFERÊNCIAS" : "SALVAR MINHAS ESCOLHAS";
}

async function loadState() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user) {
    window.location.replace("login.html?next=clube.html");
    return false;
  }

  const { data, error } = await supabase.rpc("get_club_membership_state");
  if (error) throw error;
  renderState(data || {});
  return true;
}

$("clubForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("clubMessage").classList.remove("show", "error");
  setBusy(true);

  const wantsToJoin = $("joinClub").checked;
  const { data, error } = await supabase.rpc("save_club_membership_preferences", {
    p_accept_terms: wantsToJoin,
    p_personalization: $("personalization").checked,
    p_anonymous_statistics: $("anonymousStatistics").checked,
    p_whatsapp_marketing: $("whatsappMarketing").checked
  });

  setBusy(false);
  if (error) {
    showMessage(error.message || "Não foi possível salvar suas escolhas. Tente novamente.", true);
    return;
  }

  await loadState();
  showMessage(data
    ? "Pronto! Sua participação no Clube e suas preferências foram salvas."
    : "Suas preferências foram salvas. Se quiser entrar no Clube, marque a opção de adesão e salve novamente.");
});

$("leaveClub").addEventListener("click", async () => {
  if (!window.confirm("Deseja realmente sair do Clube Luxuriosa? Suas autorizações opcionais continuarão como estão e poderão ser alteradas nesta página.")) return;
  setBusy(true);
  const { error } = await supabase.rpc("leave_luxuriosa_club");
  setBusy(false);
  if (error) {
    showMessage(error.message || "Não foi possível concluir sua saída. Tente novamente.", true);
    return;
  }
  await loadState();
  showMessage("Sua saída do Clube foi registrada. Você pode voltar quando quiser.");
});

try {
  await loadState();
} catch (error) {
  console.error("Falha ao carregar Clube Luxuriosa:", error);
  showMessage("Não foi possível carregar o Clube agora. Atualize a página ou entre novamente.", true);
}
