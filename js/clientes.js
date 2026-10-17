/* =========================================================
   LUXURIOSA — CADASTRO LOCAL E REVISÃO DO PEDIDO
   Sem conta, servidor, API ou sincronização.
   ========================================================= */
(function () {
  "use strict";

  var PROFILE_KEY = "luxuriosa_cliente_v1";
  var overlay, dialog, form, review, statusBox, messagePreview;
  var focusBeforeOpen = null;
  var dadosAtuais = null;
  var mensagemAtual = "";

  function $(id) { return document.getElementById(id); }
  function texto(id) { var el = $(id); return el ? String(el.value || "").trim() : ""; }
  function marcado(id) { var el = $(id); return !!(el && el.checked); }
  function definirValor(id, value) { var el = $(id); if (el) el.value = value == null ? "" : String(value); }

  function formatarPreco(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function avisar(message, kind) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.dataset.kind = kind || "info";
    statusBox.hidden = false;
  }

  function limparAviso() {
    if (!statusBox) return;
    statusBox.textContent = "";
    statusBox.hidden = true;
    delete statusBox.dataset.kind;
  }

  function lerPerfilSalvo() {
    try {
      var raw = window.localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || typeof parsed.name !== "string" || typeof parsed.phone !== "string") return null;
      return parsed;
    } catch (error) {
      console.warn("Luxuriosa: não foi possível ler o cadastro salvo neste dispositivo.");
      return null;
    }
  }


  function dadosDoFormulario() {
    return {
      name: texto("customerName"),
      phone: texto("customerPhone"),
      email: texto("customerEmail"),
      birthday: texto("customerBirthday"),
      address: {
        zip: texto("customerZip"),
        type: texto("customerAddressType") || "residencial",
        street: texto("customerStreet"),
        number: texto("customerNumber"),
        complement: texto("customerComplement"),
        district: texto("customerDistrict"),
        city: texto("customerCity"),
        state: texto("customerState").toUpperCase(),
        reference: texto("customerReference")
      }
    };
  }

  function preencherFormulario(data) {
    data = data || {};
    var address = data.address || {};
    definirValor("customerName", data.name);
    definirValor("customerPhone", data.phone);
    definirValor("customerEmail", data.email);
    definirValor("customerBirthday", data.birthday);
    definirValor("customerZip", address.zip);
    definirValor("customerAddressType", address.type || "residencial");
    definirValor("customerStreet", address.street);
    definirValor("customerNumber", address.number);
    definirValor("customerComplement", address.complement);
    definirValor("customerDistrict", address.district);
    definirValor("customerCity", address.city || "Bauru");
    definirValor("customerState", address.state || "SP");
    definirValor("customerReference", address.reference);
  }

  function validarTelefone(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }

  function validarDados({ exigirEndereco }) {
    var data = dadosDoFormulario();
    var primeiroErro = null;
    var required = ["customerName", "customerPhone"];
    if (exigirEndereco) required = required.concat(["customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"]);

    document.querySelectorAll("#customerForm [aria-invalid='true']").forEach(function (field) { field.removeAttribute("aria-invalid"); });
    if (exigirEndereco) {
      var addressDetails = $("customerAddressDetails");
      if (addressDetails) addressDetails.open = true;
    }
    required.forEach(function (id) {
      var field = $(id);
      if (field && !String(field.value || "").trim()) {
        field.setAttribute("aria-invalid", "true");
        if (!primeiroErro) primeiroErro = field;
      }
    });

    var phone = $("customerPhone");
    if (data.phone && !validarTelefone(data.phone)) {
      phone.setAttribute("aria-invalid", "true");
      if (!primeiroErro) primeiroErro = phone;
      avisar("Confira o telefone/WhatsApp. Informe DDD e número.", "error");
      phone.focus();
      return false;
    }
    var email = $("customerEmail");
    if (data.email && email && !email.checkValidity()) {
      email.setAttribute("aria-invalid", "true");
      avisar("Confira o formato do e-mail ou deixe o campo vazio.", "error");
      email.focus();
      return false;
    }
    if (data.address.state && !/^[A-Z]{2}$/.test(data.address.state)) {
      $("customerState").setAttribute("aria-invalid", "true");
      avisar("Informe a sigla do estado com duas letras, por exemplo SP.", "error");
      $("customerState").focus();
      return false;
    }
    if (primeiroErro) {
      avisar(exigirEndereco ? "Preencha os campos obrigatórios para preparar a entrega." : "Informe nome completo e telefone/WhatsApp.", "error");
      primeiroErro.focus();
      return false;
    }
    limparAviso();
    return true;
  }

  function salvarPerfil(data, mostrarMensagem) {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        name: data.name,
        phone: data.phone,
        email: data.email,
        birthday: data.birthday,
        address: data.address
      }));
      $("customerDeleteButton").hidden = false;
      if (mostrarMensagem) avisar("Cadastro salvo neste dispositivo. Ele não é sincronizado com outros aparelhos.", "success");
      return true;
    } catch (error) {
      console.warn("Luxuriosa: não foi possível salvar o cadastro neste dispositivo.");
      if (mostrarMensagem) avisar("Não foi possível salvar neste navegador. Você ainda pode continuar sem salvar os dados.", "error");
      return false;
    }
  }

  function apagarPerfil() {
    if (!window.confirm("Apagar os dados de cliente salvos neste dispositivo? Esta ação não pode ser desfeita.")) return;
    try {
      window.localStorage.removeItem(PROFILE_KEY);
      preencherFormulario(null);
      $("customerSave").checked = false;
      $("customerMarketing").checked = false;
      $("customerDeleteButton").hidden = true;
      avisar("Os dados salvos neste dispositivo foram apagados.", "success");
    } catch (error) {
      avisar("Não foi possível apagar os dados salvos neste navegador. Tente novamente nas configurações do navegador.", "error");
    }
  }

  function preencherMensagem(data) {
    var api = window.LuxuriosaCarrinho;
    var items = api && typeof api.obterItens === "function" ? api.obterItens() : [];
    var total = api && typeof api.obterTotal === "function" ? api.obterTotal() : 0;
    if (!items.length) return "";
    var lines = ["Olá! Quero preparar um pedido na Luxuriosa:", ""];
    items.forEach(function (item) {
      var quantity = Number(item.quantidade) || 0;
      var price = Number(item.preco) || 0;
      lines.push("• " + item.nome + " — " + quantity + "x — " + formatarPreco(price * quantity));
    });
    lines.push("", "Total calculado pelo carrinho: " + formatarPreco(total), "", "Dados para atendimento:", "Nome: " + data.name, "Telefone/WhatsApp: " + data.phone);
    if (marcado("customerIncludeAddress")) {
      var a = data.address;
      lines.push("", "Endereço de entrega (" + (a.type || "residencial") + "):");
      if (a.zip) lines.push("CEP: " + a.zip);
      lines.push(a.street + ", " + a.number);
      if (a.complement) lines.push("Complemento: " + a.complement);
      lines.push("Bairro: " + a.district, "Cidade/UF: " + a.city + "/" + a.state);
      if (a.reference) lines.push("Referência: " + a.reference);
    } else {
      lines.push("", "Vou informar os dados de entrega diretamente na conversa.");
    }
    if (marcado("customerMarketing")) lines.push("", "Preferência promocional: aceito receber ofertas e novidades da Luxuriosa.");
    lines.push("", "Gostaria de confirmar disponibilidade, entrega e próximos passos. Sei que este envio não confirma o pedido nem processa pagamento.");
    return lines.join("\n");
  }

  function abrir() {
    if (!overlay) return;
    focusBeforeOpen = document.activeElement;
    limparAviso();
    review.hidden = true;
    form.hidden = false;
    var saved = lerPerfilSalvo();
    preencherFormulario(saved || null);
    $("customerSave").checked = false;
    $("customerMarketing").checked = false;
    $("customerDeleteButton").hidden = !saved;
    $("customerIncludeAddress").checked = false;
    var addressDetails = $("customerAddressDetails");
    var moreDetails = $("customerMoreDetails");
    if (addressDetails) addressDetails.open = false;
    if (moreDetails) moreDetails.open = false;
    overlay.hidden = false;
    document.body.classList.add("customer-open");
    dialog.focus();
    $("customerName").focus();
  }

  function fechar() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("customer-open");
    if (focusBeforeOpen && typeof focusBeforeOpen.focus === "function") focusBeforeOpen.focus();
  }

  function salvarCadastroBasico() {
    if (!validarDados({ exigirEndereco: false })) return;
    if (!marcado("customerSave")) {
      avisar("Para salvar no dispositivo, marque primeiro a opção de salvar seus dados. Caso prefira, continue sem salvar.", "error");
      $("customerSave").focus();
      return;
    }
    salvarPerfil(dadosDoFormulario(), true);
  }

  function revisarPedido(event) {
    if (event) event.preventDefault();
    if (!window.LuxuriosaCarrinho || !window.LuxuriosaCarrinho.obterQuantidade()) {
      avisar("Seu carrinho está vazio. Adicione um produto antes de continuar.", "error");
      return;
    }
    if (!validarDados({ exigirEndereco: marcado("customerIncludeAddress") })) return;
    dadosAtuais = dadosDoFormulario();
    if (marcado("customerSave")) salvarPerfil(dadosAtuais, false);
    /* A escolha de marketing vale somente para este fluxo e não é persistida localmente. */
    mensagemAtual = preencherMensagem(dadosAtuais);
    if (!mensagemAtual) {
      avisar("Não foi possível montar o pedido. Confira se ainda há produtos no carrinho.", "error");
      return;
    }
    messagePreview.textContent = mensagemAtual;
    form.hidden = true;
    review.hidden = false;
    limparAviso();
    $("customerEditButton").focus();
  }

  function continuarWhatsApp() {
    if (!mensagemAtual) return;
    var config = window.LuxuriosaCatalogo && typeof window.LuxuriosaCatalogo.obterConfig === "function" ? window.LuxuriosaCatalogo.obterConfig() : null;
    var number = config && config.whatsapp ? String(config.whatsapp).replace(/\D/g, "") : "5514996355924";
    if (!number) number = "5514996355924";
    var url = "https://wa.me/" + number + "?text=" + encodeURIComponent(mensagemAtual);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function iniciarFinalizacao() {
    if (!window.LuxuriosaCarrinho || !window.LuxuriosaCarrinho.obterQuantidade()) return;
    abrir();
  }

  function iniciar() {
    overlay = $("customerOverlay");
    dialog = overlay && overlay.querySelector(".customer-dialog");
    form = $("customerForm");
    review = $("customerReview");
    statusBox = $("customerStatus");
    messagePreview = $("customerMessagePreview");
    if (!overlay || !dialog || !form || !review) return;

    form.addEventListener("submit", revisarPedido);
    $("customerSaveButton").addEventListener("click", salvarCadastroBasico);
    $("customerDeleteButton").addEventListener("click", apagarPerfil);
    $("customerClose").addEventListener("click", fechar);
    $("customerCancel").addEventListener("click", fechar);
    $("customerEditButton").addEventListener("click", function () { review.hidden = true; form.hidden = false; $("customerName").focus(); });
    $("customerWhatsAppButton").addEventListener("click", continuarWhatsApp);
    overlay.addEventListener("click", function (event) { if (event.target === overlay) fechar(); });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); fechar(); }
      if (event.key === "Tab") {
        var focusable = Array.prototype.slice.call(dialog.querySelectorAll("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex='0']")).filter(function (el) { return el.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    $("customerPhone").addEventListener("input", function () { this.removeAttribute("aria-invalid"); });
    $("customerState").addEventListener("input", function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2); });
  }

  window.LuxuriosaClientes = { iniciarFinalizacao: iniciarFinalizacao };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
