/* Luxuriosa — autenticação e cadastro */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function iniciar() {
    var client = window.LuxuriosaSupabase;
    if (!client) {
      mostrar("Não foi possível carregar o serviço de contas. Atualize a página e tente novamente.", "error");
      return;
    }

    var loginPanel = $("loginPanel");
    var signupPanel = $("signupPanel");
    var recoveryPanel = $("recoveryPanel");
    var sessionPanel = $("sessionPanel");
    var tabs = $("authTabs");

    function mostrar(message, kind) {
      var box = $("authStatus");
      if (!box) return;
      box.textContent = message;
      box.dataset.kind = kind || "info";
      box.hidden = !message;
    }

    function setBusy(form, busy, label) {
      var button = form.querySelector('button[type="submit"]');
      if (!button) return;
      if (busy) {
        button.dataset.originalLabel = button.textContent;
        button.textContent = label || "Aguarde...";
        button.disabled = true;
      } else {
        button.textContent = button.dataset.originalLabel || button.textContent;
        button.disabled = false;
      }
    }

    function abrirPainel(mode) {
      loginPanel.hidden = mode !== "login";
      signupPanel.hidden = mode !== "signup";
      recoveryPanel.hidden = mode !== "recovery";
      sessionPanel.hidden = mode !== "session";
      tabs.hidden = mode === "recovery" || mode === "session";
      $("loginTab").setAttribute("aria-selected", mode === "login" ? "true" : "false");
      $("signupTab").setAttribute("aria-selected", mode === "signup" ? "true" : "false");
      $("authTitle").textContent = mode === "signup" ? "Crie sua conta." :
        mode === "recovery" ? "Escolha uma nova senha." :
        mode === "session" ? "Sua conta está ativa." : "Bem-vinda(o) de volta.";
    }

    $("loginTab").addEventListener("click", function () { abrirPainel("login"); mostrar(""); });
    $("signupTab").addEventListener("click", function () { abrirPainel("signup"); mostrar(""); });

    $("loginForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      if (!form.reportValidity()) return;
      var email = $("loginEmail").value.trim();
      var password = $("loginPassword").value;
      setBusy(form, true, "Entrando...");
      mostrar("");
      var result = await client.auth.signInWithPassword({ email: email, password: password });
      setBusy(form, false);
      if (result.error) {
        mostrar("Não foi possível entrar. Confira seu e-mail e senha. Se ainda não confirmou o e-mail, verifique sua caixa de entrada.", "error");
        return;
      }
      mostrar("Acesso realizado. Sua conta está conectada.", "success");
      abrirPainel("session");
    });

    $("signupForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      if (!form.reportValidity()) return;
      var displayName = $("signupName").value.trim();
      var username = $("signupUsername").value.trim().toLowerCase();
      var email = $("signupEmail").value.trim();
      var password = $("signupPassword").value;
      var confirmation = $("signupPasswordConfirm").value;
      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        mostrar("O nome de usuário deve ter de 3 a 30 caracteres, usando apenas letras sem acento, números e underline.", "error");
        $("signupUsername").focus();
        return;
      }
      if (password.length < 8) {
        mostrar("A senha precisa ter pelo menos 8 caracteres.", "error");
        return;
      }
      if (password !== confirmation) {
        mostrar("As senhas não coincidem.", "error");
        $("signupPasswordConfirm").focus();
        return;
      }
      setBusy(form, true, "Criando conta...");
      mostrar("");
      var result = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + "/login.html?confirmado=1",
          data: { username: username, display_name: displayName }
        }
      });
      setBusy(form, false);
      if (result.error) {
        mostrar("Não foi possível concluir o cadastro. Confira os dados e tente novamente. O nome de usuário pode já estar em uso.", "error");
        return;
      }
      if (result.data && result.data.session) {
        mostrar("Cadastro realizado! Sua conta já está ativa.", "success");
        abrirPainel("session");
      } else {
        mostrar("Cadastro iniciado! Enviamos um link de confirmação para seu e-mail. Abra a mensagem para ativar sua conta e depois entre por aqui.", "success");
        abrirPainel("login");
      }
    });

    $("forgotPassword").addEventListener("click", async function () {
      var email = $("loginEmail").value.trim();
      if (!email) {
        mostrar("Informe seu e-mail no campo acima para receber o link de recuperação.", "error");
        $("loginEmail").focus();
        return;
      }
      mostrar("Solicitando recuperação...");
      var result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/login.html?acao=redefinir"
      });
      if (result.error) {
        mostrar("Não foi possível solicitar a recuperação agora. Tente novamente em alguns instantes.", "error");
        return;
      }
      mostrar("Se o endereço estiver cadastrado, você receberá um e-mail com as instruções para redefinir sua senha.", "success");
    });

    $("recoveryForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var password = $("newPassword").value;
      var confirmation = $("newPasswordConfirm").value;
      if (password.length < 8) {
        mostrar("A nova senha precisa ter pelo menos 8 caracteres.", "error");
        return;
      }
      if (password !== confirmation) {
        mostrar("As senhas não coincidem.", "error");
        return;
      }
      var form = event.currentTarget;
      setBusy(form, true, "Salvando...");
      var result = await client.auth.updateUser({ password: password });
      setBusy(form, false);
      if (result.error) {
        mostrar("Não foi possível alterar a senha. Solicite um novo link de recuperação.", "error");
        return;
      }
      mostrar("Senha alterada com sucesso. Você já pode acessar sua conta.", "success");
      abrirPainel("login");
    });

    $("signOutButton").addEventListener("click", async function () {
      var result = await client.auth.signOut();
      if (result.error) {
        mostrar("Não foi possível encerrar a sessão. Tente novamente.", "error");
        return;
      }
      mostrar("Você saiu da sua conta.", "success");
      abrirPainel("login");
    });

    client.auth.onAuthStateChange(function (event, session) {
      if (event === "PASSWORD_RECOVERY") {
        abrirPainel("recovery");
        mostrar("Defina uma nova senha para sua conta.", "success");
      } else if (session && event === "SIGNED_IN") {
        abrirPainel("session");
      }
    });

    var params = new URLSearchParams(window.location.search);
    if (params.get("acao") === "redefinir") {
      abrirPainel("recovery");
      mostrar("Defina uma nova senha para sua conta.");
    } else if (params.get("modo") === "cadastro") {
      abrirPainel("signup");
    } else {
      abrirPainel("login");
    }

    client.auth.getSession().then(function (result) {
      if (result.data && result.data.session && params.get("acao") !== "redefinir") {
        abrirPainel("session");
      }
      if (params.get("confirmado") === "1") {
        mostrar("E-mail confirmado! Agora você já pode entrar na sua conta.", "success");
        abrirPainel("login");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();