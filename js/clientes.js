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
  var cepConsultaId = 0;
  var ultimoEnderecoViaCep = "";

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

      /* Migra cadastros antigos e remove campos que deixaram de ser necessários. */
      var tinhaDadosLegados = Object.prototype.hasOwnProperty.call(parsed, "email") ||
        Object.prototype.hasOwnProperty.call(parsed, "birthday");
      if (tinhaDadosLegados) {
        delete parsed.email;
        delete parsed.birthday;
        try {
          window.localStorage.setItem(PROFILE_KEY, JSON.stringify(parsed));
        } catch (migrationError) {
          console.warn("Luxuriosa: não foi possível atualizar o cadastro antigo neste dispositivo.");
        }
      }
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
      address: {
        zip: texto("customerCep"),
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
    if (typeof address !== "object" || !address) {
      /* Preserva o endereço antigo para que o cliente possa reorganizá-lo nos novos campos. */
      address = { street: String(address || "") };
    }
    definirValor("customerName", data.name);
    definirValor("customerPhone", data.phone);
    definirValor("customerCep", address.zip || "");
    definirValor("customerStreet", address.street || "");
    definirValor("customerNumber", address.number || "");
    definirValor("customerComplement", address.complement || "");
    definirValor("customerDistrict", address.district || "");
    definirValor("customerCity", address.city || "");
    definirValor("customerState", address.state || "");
    definirValor("customerReference", address.reference || "");
    ultimoEnderecoViaCep = "";
    mostrarStatusCep("", "info");
  }

  function mostrarStatusCep(message, kind) {
    var status = $("customerCepStatus");
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
    status.dataset.kind = kind || "info";
  }

  function formatarCep(value) {
    var digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    return digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits;
  }

  function consultarCep() {
    var campoCep = $("customerCep");
    if (!campoCep) return;

    var cep = campoCep.value.replace(/\D/g, "");
    if (cep.length !== 8) {
      campoCep.setAttribute("aria-invalid", "true");
      mostrarStatusCep("Informe um CEP válido com 8 números.", "error");
      campoCep.focus();
      return;
    }

    campoCep.removeAttribute("aria-invalid");
    var consultaAtual = ++cepConsultaId;
    mostrarStatusCep("Consultando CEP…", "info");

    fetch("https://viacep.com.br/ws/" + cep + "/json/")
      .then(function (response) {
        if (!response.ok) throw new Error("Falha na consulta de CEP.");
        return response.json();
      })
      .then(function (dados) {
        if (consultaAtual !== cepConsultaId || $("customerCep").value.replace(/\D/g, "") !== cep) return;
        if (!dados || dados.erro) {
          mostrarStatusCep("CEP não encontrado. Confira os números ou preencha o endereço manualmente.", "error");
          return;
        }

        var valoresCep = [
          String(dados.logradouro || "").trim(),
          String(dados.bairro || "").trim(),
          String(dados.localidade || "").trim(),
          String(dados.uf || "").trim().toUpperCase()
        ];
        if (!valoresCep.some(Boolean)) {
          mostrarStatusCep("O CEP foi localizado, mas não retornou endereço completo. Preencha os dados manualmente.", "error");
          return;
        }

        var idsEndereco = ["customerStreet", "customerDistrict", "customerCity", "customerState"];
        var valoresAtuais = idsEndereco.map(function (id) { return texto(id); });
        var enderecoAtual = JSON.stringify(valoresAtuais);
        if (valoresAtuais.some(Boolean) && enderecoAtual !== ultimoEnderecoViaCep) {
          var substituir = window.confirm("A consulta vai substituir rua, bairro, cidade e estado pelos dados encontrados. Deseja continuar?");
          if (!substituir) {
            mostrarStatusCep("Consulta concluída. Os campos digitados foram mantidos.", "info");
            return;
          }
        }

        definirValor("customerStreet", valoresCep[0]);
        definirValor("customerDistrict", valoresCep[1]);
        definirValor("customerCity", valoresCep[2]);
        definirValor("customerState", valoresCep[3]);
        idsEndereco.forEach(function (id) {
          var campo = $(id);
          if (campo) campo.removeAttribute("aria-invalid");
        });
        ultimoEnderecoViaCep = JSON.stringify(valoresCep);
        mostrarStatusCep("Endereço localizado. Confira os campos e complete o número antes de continuar.", "success");\n        atualizarAvisoFrete();
      })
      .catch(function () {
        if (consultaAtual !== cepConsultaId) return;
        mostrarStatusCep("Não foi possível consultar o CEP agora. Verifique sua conexão ou preencha o endereço manualmente.", "error");
      });
  }

  function atualizarAvisoFrete() {
    var aviso = $("customerFreightInfo");
    if (!aviso) return;

    var cidade = texto("customerCity");
    var estado = texto("customerState").toUpperCase();
    var api = window.LuxuriosaCarrinho;
    var subtotal = api && typeof api.obterTotal === "function" ? Number(api.obterTotal()) : 0;

    if (!cidade || !estado) {
      aviso.textContent = "Informe a cidade e o estado para consultar as condições de entrega. O frete será confirmado no atendimento.";
      return;
    }

    var cidadeNormalizada = cidade.normalize ? cidade.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase() : cidade.toLowerCase();
    if (cidadeNormalizada === "bauru" && estado === "SP") {
      if (subtotal > 100) {
        aviso.textContent = "Entrega em Bauru-SP: seu subtotal está acima de R$ 100,00. Você pode solicitar frete grátis com o cupom FRETE; a condição será confirmada no atendimento.";
      } else {
        aviso.textContent = "Entrega em Bauru-SP: o cupom FRETE dá direito a solicitar frete grátis em compras acima de R$ 100,00. O frete será confirmado no atendimento.";
      }
      return;
    }

    aviso.textContent = "Entrega para " + cidade + "/" + estado + ": disponibilidade e valor do frete serão confirmados no atendimento.";
  }

  function validarTelefone(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }

  function validarDados({ exigirEndereco }) {
    var data = dadosDoFormulario();
    var primeiroErro = null;
    var required = exigirEndereco
      ? ["customerName", "customerPhone", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"]
      : ["customerName", "customerPhone"];

    document.querySelectorAll("#customerForm [aria-invalid='true']").forEach(function (field) { field.removeAttribute("aria-invalid"); });
    required.forEach(function (id) {
      var field = $(id);
      if (field && !String(field.value || "").trim()) {
        field.setAttribute("aria-invalid", "true");
        if (!primeiroErro) primeiroErro = field;
      }
    });

    var campoCep = $("customerCep");
    var cepDigits = texto("customerCep").replace(/\D/g, "");
    if (cepDigits && cepDigits.length !== 8) {
      if (campoCep) {
        campoCep.setAttribute("aria-invalid", "true");
        primeiroErro = primeiroErro || campoCep;
      }
      mostrarStatusCep("Se informar o CEP, digite os 8 números completos.", "error");
      if (campoCep) campoCep.focus();
      return false;
    }

    var campoEstado = $("customerState");
    var estado = texto("customerState");
    if (exigirEndereco && estado && !/^[A-Za-z]{2}$/.test(estado)) {
      if (campoEstado) {
        campoEstado.setAttribute("aria-invalid", "true");
        campoEstado.focus();
      }
      avisar("Informe o estado usando a sigla de duas letras, por exemplo: SP.", "error");
      return false;
    }
    if (campoEstado && estado) campoEstado.value = estado.toUpperCase();

    var phone = $("customerPhone");
    if (data.phone && !validarTelefone(data.phone)) {
      phone.setAttribute("aria-invalid", "true");
      if (!primeiroErro) primeiroErro = phone;
      avisar("Confira o telefone/WhatsApp. Informe DDD e número.", "error");
      phone.focus();
      return false;
    }
    if (primeiroErro) {
      avisar(
        exigirEndereco
          ? "Preencha nome ou apelido, telefone/WhatsApp, rua, número, bairro, cidade e estado."
          : "Preencha nome ou apelido e telefone/WhatsApp.",
        "error"
      );
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

  function validarIntegridadePedido(items) {
    var api = window.LuxuriosaCarrinho;
    if (!api || typeof api.obterTotal !== "function" || !Array.isArray(items) || !items.length) {
      return { valido: false, motivo: "Não foi possível confirmar os itens do carrinho. Feche esta janela, atualize a página e tente novamente." };
    }

    var subtotalCalculado = 0;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var preco = Number(item && item.preco);
      var quantidade = Number(item && item.quantidade);
      if (!item || item.indisponivel) {
        return { valido: false, motivo: "Há produtos indisponíveis no carrinho. Volte ao carrinho e remova esses itens antes de continuar." };
      }
      if (item.preco === null || item.preco === undefined || item.preco === "" ||
          !Number.isFinite(preco) || preco <= 0 ||
          !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
        return { valido: false, motivo: "O preço ou a quantidade de um produto não pôde ser confirmado. Feche esta janela, atualize a página e revise o carrinho." };
      }
      subtotalCalculado += preco * quantidade;
    }

    var subtotalCarrinho = Number(api.obterTotal());
    if (!Number.isFinite(subtotalCarrinho) || subtotalCarrinho <= 0 ||
        Math.abs(subtotalCalculado - subtotalCarrinho) > 0.009) {
      return { valido: false, motivo: "O subtotal do pedido não confere com os itens. Feche esta janela, atualize a página e revise o carrinho." };
    }

    return { valido: true, subtotal: subtotalCalculado };
  }

  function preencherMensagem(data) {
    var api = window.LuxuriosaCarrinho;
    var items = api && typeof api.obterItens === "function" ? api.obterItens() : [];
    var integridade = validarIntegridadePedido(items);
    if (!integridade.valido) {
      avisar(integridade.motivo, "error");
      return "";
    }
    var total = integridade.subtotal;
    if (!items.length) return "";
    var lines = [
      "Olá! Quero preparar um pedido na *Luxuriosa*.",
      "",
      "*RESUMO DO PEDIDO*"
    ];
    items.forEach(function (item) {
      var quantity = Number(item.quantidade) || 0;
      var price = Number(item.preco) || 0;
      lines.push("• " + item.nome + " — " + quantity + "x — " + formatarPreco(price * quantity));
    });
    lines.push(
      "",
      "*Subtotal dos produtos:* " + formatarPreco(total),
      "_Frete e descontos não incluídos._",
      "",
      "*CONDIÇÕES COMERCIAIS*",
      "• Cupom FRETE: frete grátis em Bauru para compras acima de R$ 100,00.",
      "• Cupom PRIMEIRA10: primeira compra acima de R$ 150,00, com Pix ou dinheiro.",
      "• Cupons não cumulativos; frete e descontos serão confirmados no atendimento.",
      "",
      "*DADOS PARA ENTREGA*",
      "Nome ou apelido: " + data.name,
      "Telefone/WhatsApp: " + data.phone,
      "CEP: " + (data.address.zip || "não informado"),
      "Rua/Avenida: " + data.address.street,
      "Número: " + data.address.number,
      "Complemento: " + (data.address.complement || "não informado"),
      "Bairro: " + data.address.district,
      "Cidade: " + data.address.city,
      "Estado: " + data.address.state,
      "Ponto de referência: " + (data.address.reference || "não informado")
    );
    if (marcado("customerMarketing")) {
      lines.push("", "*PREFERÊNCIA PROMOCIONAL*", "Aceito receber ofertas e novidades da Luxuriosa.");
    }
    lines.push(
      "",
      "*PRÓXIMO PASSO*",
      "Gostaria de confirmar a disponibilidade, a entrega e os próximos passos.",
      "_O envio desta mensagem não confirma o pedido nem processa pagamento._"
    );
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
    var moreDetails = $("customerMoreDetails");
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
    var itensCarrinho = window.LuxuriosaCarrinho.obterItens();
    var integridade = validarIntegridadePedido(itensCarrinho);
    if (!integridade.valido) {
      avisar(integridade.motivo, "error");
      return;
    }
    if (!validarDados({ exigirEndereco: true })) return;
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

  function copiarMensagem() {
    if (!mensagemAtual) {
      avisar("Revise o pedido antes de copiar a mensagem.", "error");
      return;
    }

    function copiarComSelecao() {
      var campo = document.createElement("textarea");
      campo.value = mensagemAtual;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      campo.setSelectionRange(0, campo.value.length);
      var copiado = false;
      try {
        copiado = document.execCommand("copy");
      } catch (error) {
        copiado = false;
      }
      document.body.removeChild(campo);
      if (copiado) {
        avisar("Mensagem copiada. Se o WhatsApp não abrir, cole o texto na conversa da Luxuriosa.", "success");
      } else {
        avisar("Não foi possível copiar automaticamente. Selecione e copie o texto exibido nesta revisão.", "error");
        messagePreview.focus();
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(mensagemAtual).then(function () {
        avisar("Mensagem copiada. Se o WhatsApp não abrir, cole o texto na conversa da Luxuriosa.", "success");
      }).catch(copiarComSelecao);
      return;
    }
    copiarComSelecao();
  }

  function continuarWhatsApp() {
    if (!mensagemAtual || !dadosAtuais) return;
    var apiCarrinho = window.LuxuriosaCarrinho;
    var itensAtuais = apiCarrinho && typeof apiCarrinho.obterItens === "function" ? apiCarrinho.obterItens() : [];
    if (!itensAtuais.length) {
      avisar("Seu carrinho está vazio. Adicione um produto antes de continuar.", "error");
      return;
    }
    var integridade = validarIntegridadePedido(itensAtuais);
    if (!integridade.valido) {
      avisar(integridade.motivo, "error");
      return;
    }
    mensagemAtual = preencherMensagem(dadosAtuais);
    if (!mensagemAtual) {
      avisar("Não foi possível atualizar o resumo do pedido. Revise o carrinho e tente novamente.", "error");
      return;
    }
    messagePreview.textContent = mensagemAtual;
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
    if (!overlay || !dialog || !form || !review) return;\n    atualizarAvisoFrete();

    form.addEventListener("submit", revisarPedido);
    $("customerSaveButton").addEventListener("click", salvarCadastroBasico);
    $("customerDeleteButton").addEventListener("click", apagarPerfil);
    $("customerClose").addEventListener("click", fechar);
    $("customerCancel").addEventListener("click", fechar);
    $("customerEditButton").addEventListener("click", function () { review.hidden = true; form.hidden = false; $("customerName").focus(); });
    $("customerWhatsAppButton").addEventListener("click", continuarWhatsApp);
    $("customerCopyButton").addEventListener("click", copiarMensagem);
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
    $("customerPhone").addEventListener("input", function () { this.removeAttribute("aria-invalid"); });\n    ["customerCity", "customerState"].forEach(function (id) {\n      var field = $(id);\n      if (field) field.addEventListener("input", atualizarAvisoFrete);\n    });
    var campoEstado = $("customerState");
    if (campoEstado) {
      campoEstado.addEventListener("input", function () {
        this.value = this.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
        this.removeAttribute("aria-invalid");
      });
    }
    var campoCep = $("customerCep");
    var botaoCep = $("customerCepSearch");
    if (campoCep && botaoCep) {
      campoCep.addEventListener("input", function () {
        this.value = formatarCep(this.value);
        this.removeAttribute("aria-invalid");
        mostrarStatusCep("", "info");
      });
      campoCep.addEventListener("blur", function () {
        if (this.value.replace(/\D/g, "").length === 8) consultarCep();
      });
      campoCep.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          consultarCep();
        }
      });
      botaoCep.addEventListener("click", consultarCep);
    }
  }

  window.LuxuriosaClientes = { iniciarFinalizacao: iniciarFinalizacao };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
