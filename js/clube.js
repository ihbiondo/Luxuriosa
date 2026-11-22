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
  isMember = state?.is_member === true && state?.profile_complete === true;
  $("joinChoice").hidden = isMember;
  $("leaveClub").hidden = !isMember;
  $("joinClub").checked = false;
  $("personalization").checked = state?.personalization === true;
  $("anonymousStatistics").checked = state?.anonymous_statistics === true;
  $("whatsappMarketing").checked = state?.whatsapp_marketing === true;

  const missingLabels = {
    username: "usuário",
    full_name: "nome completo",
    birth_date: "data de nascimento (18+)",
    phone: "WhatsApp",
    email: "e-mail"
  };
  const missing = Array.isArray(state?.profile_missing_fields)
    ? state.profile_missing_fields.map(field => missingLabels[field] || field)
    : [];
  const status = $("clubStatus");
  if (isMember) {
    status.textContent = "Você já faz parte do Clube Luxuriosa. Atualize suas preferências quando quiser.";
  } else if (state?.membership_active === true && state?.profile_complete === false) {
    status.textContent = "Sua adesão está registrada, mas seu cadastro precisa ser completado para liberar os preços promocionais e o frete com valor especial: " +
      (missing.length ? missing.join(", ") : "revise seus dados pessoais") +
      ". Atualize em Minha conta. O endereço permanece opcional.";
  } else if (state?.profile_complete === false) {
    status.textContent = "Para ativar sua participação, complete seu usuário, nome completo, data de nascimento (18+), WhatsApp e e-mail em Minha conta. O endereço é opcional.";
  } else {
    status.textContent = "Entre para o Clube gratuitamente para liberar os preços promocionais e o frete com valor especial.";
  }
  if (!isMember && state?.profile_complete === false) {
    const link = document.createElement("a");
    link.href = "/login.html#account-profile-section";
    link.textContent = "Completar meu cadastro";
    link.style.display = "inline-block";
    link.style.marginTop = "7px";
    link.style.fontWeight = "700";
    status.append(document.createElement("br"), link);
  }
  status.classList.add("show");
  $("saveClub").textContent = isMember ? "SALVAR PREFERÊNCIAS" : "ENTRAR NO CLUBE GRATUITAMENTE";
}

async function loadState() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user) {
    window.location.replace("login.html?next=clube.html&cadastro=1");
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
    ? "Pronto! Sua participação no Clube está ativa. Volte ao catálogo para aproveitar os preços promocionais; o frete com valor especial será calculado no carrinho conforme o destino."
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
