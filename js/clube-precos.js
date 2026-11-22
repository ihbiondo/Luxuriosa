/* =========================================================
   LUXURIOSA — STATUS DO CLUBE E PREÇOS PROMOCIONAIS
   O navegador consulta o status autenticado; o backend sempre
   recalcula o preço e não confia neste estado local.
   ========================================================= */
(function () {
  "use strict";

  var SUPABASE_URL = "https://byiykxfugvxuowueuxca.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y";
  var clientPromise = null;
  var initialPromise = null;
  var refreshPromise = null;
  var authSubscription = null;
  var state = {
    loaded: false,
    authenticated: false,
    isMember: false,
    profileComplete: false,
    missingFields: [],
    error: false
  };

  function temPromocaoClube(produto) {
    if (!produto) return false;
    var regular = Number(produto.precoAntigo);
    var club = Number(produto.preco);
    return Number.isFinite(regular) && Number.isFinite(club) &&
      regular > 0 && club >= 0 && regular > club;
  }

  function obterCliente() {
    if (!clientPromise) {
      clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(function (mod) {
        var client = mod.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
        );
        if (!authSubscription) {
          var subscriptionResult = client.auth.onAuthStateChange(function (event) {
            if (event === "SIGNED_IN" || event === "SIGNED_OUT" ||
                event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
              window.setTimeout(function () { atualizar(); }, 0);
            }
          });
          authSubscription = subscriptionResult && subscriptionResult.data
            ? subscriptionResult.data.subscription : null;
        }
        return client;
      }).catch(function (error) {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  function publicarEstado() {
    try {
      window.dispatchEvent(new CustomEvent("luxuriosa:club-state-changed", {
        detail: obterEstado()
      }));
    } catch (_) {}
  }

  function obterEstado() {
    return {
      loaded: state.loaded,
      authenticated: state.authenticated,
      isMember: state.isMember,
      profileComplete: state.profileComplete,
      missingFields: state.missingFields.slice(),
      error: state.error
    };
  }

  async function atualizar() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async function () {
      try {
        var client = await obterCliente();
        var sessionResult = await client.auth.getSession();
        if (sessionResult.error) throw sessionResult.error;
        var session = sessionResult.data && sessionResult.data.session;
        if (!session || !session.user) {
          state = {
            loaded: true, authenticated: false, isMember: false,
            profileComplete: false, missingFields: [], error: false
          };
          publicarEstado();
          return obterEstado();
        }

        var membershipResult = await client.rpc("get_club_membership_state");
        if (membershipResult.error) throw membershipResult.error;
        var membership = membershipResult.data || {};
        state = {
          loaded: true,
          authenticated: true,
          isMember: membership.is_member === true,
          profileComplete: true,
          missingFields: [],
          error: false
        };
      } catch (error) {
        console.warn("Luxuriosa: não foi possível confirmar a participação no Clube.", error);
        state = {
          loaded: true, authenticated: false, isMember: false,
          profileComplete: false, missingFields: [], error: true
        };
      }
      publicarEstado();
      return obterEstado();
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function precoParaCliente(produto) {
    var club = Number(produto && produto.preco);
    var regular = Number(produto && produto.precoAntigo);
    if (temPromocaoClube(produto)) {
      return state.isMember ? club : regular;
    }
    return club;
  }

  window.LuxuriosaClubePrecos = {
    pronto: function () {
      if (!initialPromise) initialPromise = atualizar();
      return initialPromise;
    },
    atualizar: atualizar,
    obterEstado: obterEstado,
    temPromocaoClube: temPromocaoClube,
    precoParaCliente: precoParaCliente
  };

  initialPromise = atualizar();
})();