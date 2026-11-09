/* =========================================================
   LUXURIOSA — CADASTRO LOCAL E REVISÃO DO PEDIDO
   Sem conta, servidor, API ou sincronização.
   ========================================================= */
(function () {
  "use strict";

  var overlay, dialog, form, review, statusBox, messagePreview;
  var focusBeforeOpen = null;
  var dadosAtuais = null;
  var mensagemAtual = "";
  var cepConsultaId = 0;
  var ultimoEnderecoViaCep = "";

  function $(id) { return document.getElementById(id); }
  function texto(id) { var el = $(id); return el ? String(el.value || "").trim() : ""; }
  function definirValor(id, value) { var el = $(id); if (el) el.value = value == null ? "" : String(value); }

  function formatarPreco(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function resumirCondicaoFrete(address, subtotal) {
    var cidade = String(address && address.city || "").trim();
    var estado = String(address && address.state || "").trim().toUpperCase();
    var cidadeNormalizada = cidade.normalize
      ? cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : cidade.toLowerCase();

    if (cidadeNormalizada === "bauru" && estado === "SP") {
      var condicoes = [
        "Destino: " + cidade + "/" + estado,
        "Frete padrão fixo: R$ 15,00."
      ];
      condicoes.push("Pedidos que incluam pelo menos um kit promocional têm frete grátis exclusivamente em Bauru.");
      return condicoes;
    }

    return [
      "Destino: " + (cidade || "cidade não informada") + (estado ? "/" + estado : ""),
      "Condição: disponibilidade e valor do frete serão confirmados no atendimento."
    ];
  }

  function avisar(message, kind) {
    if (!statusBox) return;
    var tipo = kind || "info";
    statusBox.textContent = message;
    statusBox.dataset.kind = tipo;
    statusBox.setAttribute("role", tipo === "error" ? "alert" : "status");
    statusBox.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");
    statusBox.hidden = false;
  }

  function limparAviso() {
    if (!statusBox) return;
    statusBox.textContent = "";
    statusBox.hidden = true;
    delete statusBox.dataset.kind;
  }

  function dadosDoFormulario() {
    return {
      name: texto("customerName"),
      phone: texto("customerPhone"),
      email: texto("customerEmail").toLowerCase(),
      address: {
        zip: texto("customerCep"),
        street: texto("customerStreet"),
        number: texto("customerNumber"),
        complement: texto("customerComplement"),
        district: texto("customerDistrict"),
        city: texto("customerCity"),
        state: texto("customerState").toUpperCase(),
        reference: texto("customerReference")
      },
      marketingWhatsappOptIn: !!$("customerMarketingWhatsAppOptIn")?.checked
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
    definirValor("customerPhone", formatarTelefone(data.phone));
    definirValor("customerEmail", data.email || "");
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
    var tipo = kind || "info";
    status.textContent = message || "";
    status.hidden = !message;
    status.dataset.kind = tipo;
    status.setAttribute("role", tipo === "error" ? "alert" : "status");
    status.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");
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
          $("customerCep").setAttribute("aria-invalid", "true");
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

        $("customerCep").removeAttribute("aria-invalid");
        definirValor("customerStreet", valoresCep[0]);
        definirValor("customerDistrict", valoresCep[1]);
        definirValor("customerCity", valoresCep[2]);
        definirValor("customerState", valoresCep[3]);
        idsEndereco.forEach(function (id) {
          var campo = $(id);
          if (campo) campo.removeAttribute("aria-invalid");
        });
        ultimoEnderecoViaCep = JSON.stringify(valoresCep);
        mostrarStatusCep("Endereço localizado. Confira os campos e complete o número antes de continuar.", "success");
        atualizarAvisoFrete();
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

    var cidadeNormalizada = cidade.normalize ? cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : cidade.toLowerCase();
    if (cidadeNormalizada === "bauru" && estado === "SP") {
      var api = window.LuxuriosaCarrinho;
      var items = api && typeof api.obterItens === "function" ? api.obterItens() : [];
      var temKit = pedidoContemKit(items);
      aviso.textContent = temKit
        ? "Entrega em Bauru-SP: seu pedido inclui um kit promocional e tem frete grátis. Os demais pedidos têm frete de R$ 15,00."
        : "Entrega em Bauru-SP: frete fixo de R$ 15,00. Pedidos que incluam pelo menos um kit promocional têm frete grátis.";
      return;
    }

    aviso.textContent = "Entrega para " + cidade + "/" + estado + ": disponibilidade e valor do frete serão confirmados no atendimento.";
  }


  function formatarTelefone(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length >= 12 && digits.slice(0, 2) === "55") digits = digits.slice(2);
    if (digits.length !== 10 && digits.length !== 11) return String(value || "");
    return "(" + digits.slice(0, 2) + ") " +
      (digits.length === 11
        ? digits.slice(2, 7) + "-" + digits.slice(7)
        : digits.slice(2, 6) + "-" + digits.slice(6));
  }

  function validarTelefone(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }

  function validarDados({ exigirEndereco }) {
    var data = dadosDoFormulario();
    var primeiroErro = null;
    var required = exigirEndereco
      ? ["customerName", "customerPhone", "customerEmail", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"]
      : ["customerName", "customerPhone", "customerEmail"];

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

    var email = $("customerEmail");
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      email.setAttribute("aria-invalid", "true");
      avisar("Informe um e-mail válido para receber os dados do pagamento.", "error");
      email.focus();
      return false;
    }

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
          : "Preencha nome, telefone/WhatsApp e e-mail.",
        "error"
      );
      primeiroErro.focus();
      return false;
    }
    limparAviso();
    return true;
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

  function pedidoContemKit(items) {
    return Array.isArray(items) && items.some(function (item) {
      return String(item && item.categoria || "").trim().toLowerCase() === "kits";
    });
  }

  function preencherMensagem(data) {
    var api = window.LuxuriosaCarrinho;
    var items = api && typeof api.obterItens === "function" ? api.obterItens() : [];
    var integridade = validarIntegridadePedido(items);
    if (!integridade.valido) {
      avisar(integridade.motivo, "error");
      return "";
    }

    var subtotal = integridade.subtotal;
    if (!items.length) return "";

    var temKit = pedidoContemKit(items);
    var totalProdutos = subtotal;
    var cidade = String(data.address.city || "").trim();
    var estado = String(data.address.state || "").trim().toUpperCase();
    var cidadeNormalizada = cidade.normalize
      ? cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : cidade.toLowerCase();
    var emBauru = cidadeNormalizada === "bauru" && estado === "SP";
    var freteGratis = emBauru && temKit;
    var frete = emBauru && !freteGratis ? 15 : 0;
    var totalEstimado = Math.round((totalProdutos + frete) * 100) / 100;

    var lines = [
      "Olá! Quero fazer um pedido na *Luxuriosa*. ❤️",
      "",
      "*MEU PEDIDO*"
    ];

    items.forEach(function (item) {
      var quantity = Number(item.quantidade) || 0;
      var price = Number(item.preco) || 0;
      lines.push("• " + item.nome + " — " + quantity + "x — " + formatarPreco(price * quantity));
    });

    lines.push("", "*Subtotal: " + formatarPreco(subtotal) + "*");

    if (freteGratis) {
      lines.push("Frete: grátis (benefício automático por incluir kit)");
      lines.push("*Total estimado: " + formatarPreco(totalEstimado) + "*");
    } else if (emBauru) {
      lines.push("Frete: " + formatarPreco(frete));
      lines.push("*Total estimado: " + formatarPreco(totalEstimado) + "*");
    } else {
      lines.push("Frete: a confirmar conforme o destino");
      lines.push("*Total estimado dos produtos: " + formatarPreco(totalProdutos) + "*");
    }

    lines.push("", "*ENTREGA*");
    lines.push("• " + data.name + " — " + data.phone);

    var endereco = data.address.street + ", " + data.address.number;
    if (data.address.complement) endereco += " — " + data.address.complement;
    lines.push("• " + endereco);
    lines.push("• " + data.address.district + " — " + data.address.city + "/" + data.address.state);
    if (data.address.zip) lines.push("• CEP: " + data.address.zip);
    if (data.address.reference) lines.push("• Referência: " + data.address.reference);

    lines.push(
      "",
      "Gostaria de confirmar a disponibilidade dos produtos e combinar a entrega.",
      "_Pedido sujeito à confirmação de disponibilidade, condições comerciais e entrega._"
    );

    return lines.join("\n");
  }

  function abrir() {
    if (!overlay) return;
    /* Invalida qualquer consulta de CEP pendente de uma etapa anterior. */
    cepConsultaId += 1;
    accountLoadId += 1;
    focusBeforeOpen = document.activeElement;
    limparAviso();
    review.hidden = true;
    form.hidden = false;
    preencherFormulario(null);
    var marketingOptIn = $("customerMarketingWhatsAppOptIn");
    if (marketingOptIn) marketingOptIn.checked = false;
    overlay.hidden = false;
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
      window.LuxuriosaInteligencia.registrarEtapa("checkout_started", window.LuxuriosaCarrinho.obterItens()).catch(function () {});
    }
    document.body.classList.add("customer-open");
    dialog.focus();
    $("customerName").focus();
  }

  function fechar() {
    if (!overlay) return;
    /* Uma resposta atrasada do ViaCEP não deve preencher um checkout futuro. */
    cepConsultaId += 1;
    accountLoadId += 1;
    overlay.hidden = true;
    document.body.classList.remove("customer-open");

    /* Limpa dados pessoais temporários ao fechar a etapa do pedido. */
    dadosAtuais = null;
    mensagemAtual = "";
    ultimoEnderecoViaCep = "";
    if (form) form.reset();
    if (messagePreview) messagePreview.textContent = "";
    if (review) review.hidden = true;
    if (form) form.hidden = false;
    limparAviso();
    mostrarStatusCep("", "info");
    atualizarAvisoFrete();

    if (focusBeforeOpen && typeof focusBeforeOpen.focus === "function") focusBeforeOpen.focus();
    focusBeforeOpen = null;
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
    mensagemAtual = preencherMensagem(dadosAtuais);
    if (!mensagemAtual) {
      avisar("Não foi possível montar o pedido. Confira se ainda há produtos no carrinho.", "error");
      return;
    }
    messagePreview.textContent = mensagemAtual;
    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("checkout_review", { step: "dados_validos" });
    }
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
      window.LuxuriosaInteligencia.registrarEtapa("checkout_reviewed", itensCarrinho, dadosAtuais).catch(function () {});
    }
    form.hidden = true;
    review.hidden = false;
    limparAviso();
    $("customerEditButton").focus();
  }

  function copiarMensagem() {
    if (!mensagemAtual || !dadosAtuais) {
      avisar("Revise o pedido antes de copiar a mensagem.", "error");
      return;
    }

    var apiCarrinho = window.LuxuriosaCarrinho;
    var itensAtuais = apiCarrinho && typeof apiCarrinho.obterItens === "function" ? apiCarrinho.obterItens() : [];
    if (!itensAtuais.length) {
      avisar("Seu carrinho está vazio. Adicione um produto antes de copiar a mensagem.", "error");
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

  async function continuarPagamento() {
    if (document.body && document.body.dataset.previewMode === "true") {
      avisar("O pagamento está desativado nesta prévia. Use o atendimento pelo WhatsApp para validar o fluxo.", "info");
      return;
    }
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
    if (!validarDados({ exigirEndereco: true })) return;

    var button = $("customerPaymentButton");
    if (button) {
      button.disabled = true;
      button.textContent = "PREPARANDO PAGAMENTO...";
    }
    avisar("Estamos validando os produtos, o frete e preparando seu pagamento.", "info");

    try {
      var sessionKey = window.LuxuriosaInteligencia &&
        typeof window.LuxuriosaInteligencia.obterSessao === "function"
        ? window.LuxuriosaInteligencia.obterSessao()
        : "";
      if (!sessionKey) throw new Error("Não foi possível identificar seu carrinho. Atualize a página e tente novamente.");

      var headers = {
        "content-type": "application/json",
        "apikey": "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y"
      };
      try {
        var rawSession = localStorage.getItem("sb-byiykxfugvxuowueuxca-auth-token");
        var parsedSession = rawSession ? JSON.parse(rawSession) : null;
        if (parsedSession && parsedSession.access_token) {
          headers.authorization = "Bearer " + parsedSession.access_token;
        }
      } catch (_) {}

      var response = await fetch("https://byiykxfugvxuowueuxca.supabase.co/functions/v1/create-payment-order", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          session_key: sessionKey,
          items: itensAtuais,
          customer: dadosAtuais
        })
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.ok || !result.checkout_url) {
        throw new Error(result.error || "Não foi possível preparar o pagamento. Tente novamente.");
      }

      messagePreview.textContent =
        "Pedido Luxuriosa #" + result.order_number + "\n" +
        "Total para pagamento: " + formatarPreco(result.total_amount) + "\n\n" +
        "Você será direcionado à InfinitePay para pagar com Pix ou cartão. " +
        "A expedição só começa depois da confirmação do pagamento.";
      avisar("Pedido criado. Abrindo o checkout seguro da InfinitePay...", "success");

      window.location.assign(result.checkout_url);
    } catch (error) {
      avisar(error && error.message ? error.message : "Não foi possível iniciar o pagamento. Tente novamente.", "error");
      if (button) {
        button.disabled = false;
        button.textContent = "PAGAR COM PIX OU CARTÃO";
      }
    }
  }


  function continuarWhatsApp() {
    if (!mensagemAtual || !dadosAtuais) {
      avisar("Revise o pedido antes de abrir o WhatsApp.", "error");
      return;
    }
    var apiCarrinho = window.LuxuriosaCarrinho;
    var itensAtuais = apiCarrinho && typeof apiCarrinho.obterItens === "function" ? apiCarrinho.obterItens() : [];
    var integridade = validarIntegridadePedido(itensAtuais);
    if (!integridade.valido || !validarDados({ exigirEndereco: true })) {
      if (!integridade.valido) avisar(integridade.motivo, "error");
      return;
    }
    mensagemAtual = preencherMensagem(dadosAtuais);
    if (!mensagemAtual) return;
    messagePreview.textContent = mensagemAtual;
    var url = "https://wa.me/5514996355924?text=" + encodeURIComponent(mensagemAtual);
    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("checkout_whatsapp", { method: "whatsapp", step: "pedido_encaminhado" });
    }
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
      window.LuxuriosaInteligencia.registrarEtapa("whatsapp_opened", itensAtuais, dadosAtuais).catch(function () {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }


  var accountLoadId = 0;
  var accountSupabasePromise = null;

  function obterClienteSupabase() {
    if (!accountSupabasePromise) {
      accountSupabasePromise = import("https://esm.sh/@supabase/supabase-js@2").then(function (mod) {
        return mod.createClient(
          "https://byiykxfugvxuowueuxca.supabase.co",
          "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y",
          { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
        );
      });
    }
    return accountSupabasePromise;
  }

  async function carregarDadosDaConta() {
    var button = $("customerAccountLoad");
    if (!button) return;
    var requestId = ++accountLoadId;
    button.disabled = true;
    button.textContent = "Carregando seus dados…";
    try {
      var supabase = await obterClienteSupabase();
      var authResult = await supabase.auth.getUser();
      if (requestId !== accountLoadId) return;
      if (authResult.error || !authResult.data || !authResult.data.user) {
        avisar("Entre na sua conta Luxuriosa para carregar seus dados. Você também pode preencher tudo manualmente.", "error");
        return;
      }

      var userId = authResult.data.user.id;
      var results = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
        supabase.from("addresses")
          .select("postal_code, street, number, complement, neighborhood, city, state")
          .eq("user_id", userId)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle()
      ]);
      if (requestId !== accountLoadId) return;
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;

      var profile = results[0].data || {};
      var address = results[1].data || {};
      if (!profile.full_name && !profile.phone && !address.street) {
        avisar("Ainda não encontramos dados cadastrados na sua conta. Você pode preencher este pedido manualmente.", "info");
        return;
      }

      var hasCheckoutData = [
        "customerName", "customerPhone", "customerEmail", "customerCep", "customerStreet",
        "customerNumber", "customerComplement", "customerDistrict",
        "customerCity", "customerState", "customerReference"
      ].some(function (id) { return texto(id); });
      if (hasCheckoutData && !window.confirm("Deseja substituir os dados já preenchidos pelos dados da sua conta? Você poderá editar tudo antes de enviar o pedido.")) {
        avisar("Seus dados atuais foram mantidos.", "info");
        return;
      }

      preencherFormulario({
        name: profile.full_name || "",
        phone: profile.phone || "",
        email: authResult.data.user.email || "",
        address: {
          zip: address.postal_code || "",
          street: address.street || "",
          number: address.number || "",
          complement: address.complement || "",
          district: address.neighborhood || "",
          city: address.city || "",
          state: address.state || ""
        }
      });
      atualizarAvisoFrete();
      avisar("Dados carregados. Confira e complete o endereço; você pode editar qualquer campo antes de revisar o pedido.", "success");
      $("customerName").focus();
    } catch (error) {
      if (requestId !== accountLoadId) return;
      avisar("Não foi possível carregar seus dados agora. Você pode preencher o pedido manualmente.", "error");
    } finally {
      if (requestId === accountLoadId) {
        button.disabled = false;
        button.textContent = "👤 Usar meus dados cadastrados";
      }
    }
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
    atualizarAvisoFrete();

    form.addEventListener("submit", revisarPedido);
    $("customerClose").addEventListener("click", fechar);
    var accountLoadButton = $("customerAccountLoad");
    if (accountLoadButton) accountLoadButton.addEventListener("click", carregarDadosDaConta);
    $("customerCancel").addEventListener("click", fechar);
    $("customerEditButton").addEventListener("click", function () { review.hidden = true; form.hidden = false; $("customerName").focus(); });
    var paymentButton = $("customerPaymentButton");
    if (paymentButton) paymentButton.addEventListener("click", continuarPagamento);
    var whatsappButton = $("customerWhatsAppButton");
    if (whatsappButton) whatsappButton.addEventListener("click", continuarWhatsApp);
    var copyButton = $("customerCopyButton");
    if (copyButton) copyButton.addEventListener("click", copiarMensagem);
    overlay.addEventListener("click", function (event) { if (event.target === overlay) fechar(); });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); fechar(); }
      if (event.key === "Tab") {
        var focusable = Array.prototype.slice.call(dialog.querySelectorAll("a[href]:not([tabindex='-1']), button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex='0']")).filter(function (el) { return el.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    var campoTelefone = $("customerPhone");
    if (campoTelefone) campoTelefone.addEventListener("input", function () {
      var digits = this.value.replace(/\D/g, "").slice(0, 13);
      if (digits.length >= 10) this.value = formatarTelefone(digits);
      this.removeAttribute("aria-invalid");
    });
    ["customerName", "customerPhone", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"].forEach(function (id) {
      var campo = $(id);
      if (!campo) return;
      campo.addEventListener("input", function () {
        this.removeAttribute("aria-invalid");
      });
    });
    ["customerCity", "customerState"].forEach(function (id) {
      var field = $(id);
      if (field) field.addEventListener("input", function () {
        atualizarAvisoFrete();
          });
    });
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
