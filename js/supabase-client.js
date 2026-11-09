/* Luxuriosa — cliente público do Supabase.
   A chave publishable é própria para uso no navegador.
   Nunca adicionar service_role ou secret keys a este arquivo. */
(function () {
  "use strict";
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Luxuriosa: biblioteca Supabase não carregada.");
    return;
  }
  var url = "https://byiykxfugvxuowueuxca.supabase.co";
  var publishableKey = "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y";
  window.LuxuriosaSupabase = window.supabase.createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "implicit"
    }
  });
})();