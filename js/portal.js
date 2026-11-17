import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://byiykxfugvxuowueuxca.supabase.co",
  "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y",
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);

const TERMS_VERSION = "luxuriosa-experiencias-v1-2026-11";
const loading = document.getElementById("portalLoading");
const app = document.getElementById("portalApp");
const exitButton = document.getElementById("portalSignOut");

function showError() {
  loading.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = "Não foi possível abrir seu espaço.";
  const detail = document.createElement("small");
  detail.textContent = "Confira sua conexão e tente novamente.";
  const link = document.createElement("a");
  link.href = "/login.html?next=portal%2F";
  link.className = "primary";
  link.textContent = "Entrar novamente";
  loading.append(title, detail, link);
}

function addNavLink(nav, label) {
  if (!nav || nav.querySelector('a[href="/portal/conquistas/"]')) return;
  const link = document.createElement("a");
  link.href = "/portal/conquistas/";
  link.textContent = label;
  nav.append(link);
}

async function configureAchievements(user) {
  const { data, error } = await supabase
    .from("experience_terms_acceptances")
    .select("terms_version, accepted_at, revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const accepted = Boolean(
    data &&
    data.terms_version === TERMS_VERSION &&
    data.accepted_at &&
    !data.revoked_at
  );

  const achievementsCard = document.getElementById("portalAchievementsCard");
  const activationCard = document.getElementById("portalAchievementsActivationCard");
  if (accepted) {
    if (achievementsCard) achievementsCard.hidden = false;
    addNavLink(document.querySelector(".desktop-nav"), "✧ Minhas conquistas");
    addNavLink(document.querySelector(".mobile-menu-panel"), "✧ Minhas conquistas");
  } else if (activationCard) {
    activationCard.hidden = false;
  }
}

async function boot() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (!user) {
      window.location.replace("/login.html?next=portal%2F");
      return;
    }

    const meta = user.user_metadata || {};
    const firstName = String(meta.display_name || meta.full_name || "").trim().split(/\s+/)[0];
    const greeting = document.getElementById("welcomeTitle");
    const greetingName = document.getElementById("portalGreetingName");
    const sidebarName = document.getElementById("portalSidebarName");

    if (firstName) {
      greetingName.textContent = firstName;
    } else {
      greeting.textContent = "Que bom ter você aqui.";
    }
    sidebarName.textContent = firstName || "Seu espaço";

    try {
      await configureAchievements(user);
    } catch (termsError) {
      // Falha na verificação deve ocultar a área, nunca liberar o acesso por padrão.
      console.error("Não foi possível verificar o aceite de Minhas conquistas:", termsError);
    }

    loading.hidden = true;
    app.hidden = false;
  } catch (error) {
    console.error("Falha ao abrir o Portal Luxuriosa:", error);
    showError();
  }
}

exitButton.addEventListener("click", async () => {
  exitButton.disabled = true;
  exitButton.textContent = "Saindo...";
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.replace("/login.html");
  } catch (error) {
    console.error("Falha ao sair da conta:", error);
    exitButton.disabled = false;
    exitButton.textContent = "Sair da conta";
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) window.location.replace("/login.html");
});

boot();
