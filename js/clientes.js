/* =========================================================
   LUXURIOSA — DADOS DO CLIENTE E REVISÃO DO PEDIDO
   Checkout autenticado, consulta de perfil e criação de pedido via Supabase.
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

  function normalizarLocalidade(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }

  function obterTarifasOficiais(address) {
    var cidade = normalizarLocalidade(address && address.city);
    var distrito = normalizarLocalidade(address && address.district);
    if ((cidade === "bauru" && distrito === "tibirica") || cidade === "tibirica") {
      return { nome: "Tibiriçá", comum: 20, clube: 15, pedagio: false };
    }
    var tarifas = {
      "bauru": { nome: "Bauru", comum: 15, clube: 10, pedagio: false },
      "agudos": { nome: "Agudos", comum: 25, clube: 20, pedagio: false },
      "piratininga": { nome: "Piratininga", comum: 25, clube: 20, pedagio: false },
      "pederneiras": { nome: "Pederneiras", comum: 25, clube: 20, pedagio: false },
      "lencois paulista": { nome: "Lençóis Paulista", comum: 50, clube: 40, pedagio: true },
      "borebi": { nome: "Borebi", comum: 50, clube: 40, pedagio: true }
    };
    return tarifas[cidade] || null;
  }

  function resumirCondicaoFrete(address, subtotal) {
    var cidade = String(address && address.city || "").trim();
    var estado = String(address && address.state || "").trim().toUpperCase();
    var tarifa = obterTarifasOficiais(address);
    if (!tarifa || estado !== "SP") {
      return [
        "Destino: " + (cidade || "cidade não informada") + (estado ? "/" + estado : ""),
        "Frete sob consulta pelo atendimento."
      ];
    }
    return [
      "Destino: " + tarifa.nome + (estado ? "/" + estado : ""),
      "Sem Clube: " + formatarPreco(tarifa.comum) + " | Clube gratuito: " + formatarPreco(tarifa.clube),
      tarifa.pedagio ? "Pedágio incluído no valor." : "Valores fixos nas localidades listadas; demais regiões sob consulta pelo atendimento."
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

  function modalidadeRetirada() { return texto("customerFulfillmentMode") === "pickup"; }

  function atualizarCamposPagador() {
    var terceiro = texto("customerPayerType") === "third_party";
    var fields = $("customerThirdPartyPayerFields");
    var name = $("customerPayerName");
    var phone = $("customerPayerPhone");
    if (fields) fields.hidden = !terceiro;
    if (name) name.required = terceiro;
    if (phone) phone.required = terceiro;
    if (!terceiro) {
      if (name) { name.value = ""; name.removeAttribute("aria-invalid"); }
      if (phone) { phone.value = ""; phone.removeAttribute("aria-invalid"); }
    }
  }

  function atualizarModalidade() {
    var pickup = modalidadeRetirada();
    var addressFields = document.querySelector("#customerForm .customer-address-fields");
    var pickupFields = $("customerPickupFields");
    if (addressFields) addressFields.hidden = pickup;
    if (pickupFields) pickupFields.hidden = !pickup;
    var campoCep = $("customerCep");
    if (campoCep) {
      campoCep.required = !pickup;
      campoCep.setAttribute("aria-required", pickup ? "false" : "true");
    }
    atualizarAvisoFrete();
  }

  function dadosDoFormulario() {
    var pickup = modalidadeRetirada();
    var date = texto("customerPickupDate");
    var time = texto("customerPickupTime");
    return {
      fulfillmentType: pickup ? "pickup" : "express",
      pickupRequestedAt: pickup && date && time ? new Date(date + "T" + time + ":00-03:00").toISOString() : null,
      name: texto("customerName"),
      phone: texto("customerPhone"),
      email: texto("customerEmail").toLowerCase(),
      paymentPayerType: texto("customerPayerType") === "third_party" ? "third_party" : "account_holder",
      paymentPayerName: texto("customerPayerName"),
      paymentPayerPhone: texto("customerPayerPhone"),
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
    definirValor("customerPayerType", data.paymentPayerType === "third_party" ? "third_party" : "account_holder");
    definirValor("customerPayerName", data.paymentPayerName || "");
    definirValor("customerPayerPhone", data.paymentPayerPhone || "");
    atualizarCamposPagador();
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
    if (modalidadeRetirada()) {
      aviso.textContent = "Retirada gratuita em Bauru. Sem cobrança de frete.";
      return;
    }

    var cidade = texto("customerCity");
    var estado = texto("customerState").toUpperCase();
    var distrito = texto("customerDistrict");
    var api = window.LuxuriosaCarrinho;
    var itens = api && typeof api.obterItens === "function" ? api.obterItens() : [];
    var subtotal = api && typeof api.obterTotal === "function" ? Number(api.obterTotal()) : 0;

    if (!cidade || !estado) {
      aviso.textContent = "Informe a cidade e o estado para conferir o valor de entrega.";
      return;
    }

    var kitComFreteGratis = pedidoContemKit(itens) &&
      normalizarLocalidade(cidade) === "bauru" &&
      estado === "SP" &&
      normalizarLocalidade(distrito) !== "tibirica";
    if (kitComFreteGratis) {
      aviso.textContent = "Frete gratuito para pedidos com kit em Bauru/SP. Pedido mínimo: R$ 20,00 em produtos.";
      return;
    }

    var tarifa = obterTarifasOficiais({ city: cidade, district: distrito });
    if (!tarifa || estado !== "SP") {
      aviso.textContent = "Entrega para " + cidade + "/" + estado + ": frete sob consulta pelo atendimento.";
      return;
    }

    var textoFrete = "Frete fixo em " + tarifa.nome + ": Sem Clube " + formatarPreco(tarifa.comum) +
      " | Clube gratuito " + formatarPreco(tarifa.clube) + ".";
    if (tarifa.pedagio) textoFrete += " Pedágio já incluído.";
    var pedidoMinimo = normalizarLocalidade(cidade) === "bauru" ? 20 : 50;
    var textoMinimo = " Pedido mínimo: " + formatarPreco(pedidoMinimo) + " em produtos.";
    if (subtotal > 0 && subtotal < pedidoMinimo) {
      textoMinimo += " Faltam " + formatarPreco(pedidoMinimo - subtotal) + " para atingir o mínimo.";
    }
    aviso.textContent = textoFrete + textoMinimo;
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
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return true;
    return (digits.length === 12 || digits.length === 13) && digits.slice(0, 2) === "55";
  }

  function validarDados({ exigirEndereco }) {
    var data = dadosDoFormulario();
    var primeiroErro = null;
    var exigirEnderecoEntrega = exigirEndereco && !modalidadeRetirada();
    var required = exigirEnderecoEntrega
      ? ["customerName", "customerPhone", "customerEmail", "customerCep", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"]
      : ["customerName", "customerPhone", "customerEmail"];
    if (data.paymentPayerType === "third_party") {
      required.push("customerPayerName", "customerPayerPhone");
    }

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
    if (!modalidadeRetirada() && cepDigits.length !== 8) {
      if (campoCep) {
        campoCep.setAttribute("aria-invalid", "true");
        primeiroErro = primeiroErro || campoCep;
      }
      mostrarStatusCep("Informe um CEP válido com 8 números para entrega.", "error");
      if (campoCep) campoCep.focus();
      return false;
    }

    var campoEstado = $("customerState");
    var estado = texto("customerState");
    if (exigirEnderecoEntrega && estado && !/^[A-Za-z]{2}$/.test(estado)) {
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
    if (data.paymentPayerType === "third_party" && data.paymentPayerPhone && !validarTelefone(data.paymentPayerPhone)) {
      var payerPhone = $("customerPayerPhone");
      if (payerPhone) {
        payerPhone.setAttribute("aria-invalid", "true");
        payerPhone.focus();
      }
      avisar("Confira o telefone/WhatsApp de quem fará o pagamento. Informe DDD e número.", "error");
      return false;
    }
    if (primeiroErro) {
      avisar(
        exigirEnderecoEntrega
          ? "Preencha nome, telefone/WhatsApp, CEP, rua, número, bairro, cidade e estado para entrega."
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
      var kitsComDadoVariavel = ["22","23","24","27","28","29"];
      if (kitsComDadoVariavel.indexOf(String(item.id)) !== -1 &&
          ["1","2","3"].indexOf(String(item.kit_variant_id || "")) === -1) {
        return { valido: false, motivo: "Escolha o Dado do Prazer incluído em cada kit variável. Remova o kit do carrinho e adicione-o novamente para selecionar a variante." };
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
    var kitComFreteGratis = data.fulfillmentType !== "pickup" &&
      pedidoContemKit(items) &&
      normalizarLocalidade(data.address && data.address.city) === "bauru" &&
      String(data.address && data.address.state || "").trim().toUpperCase() === "SP" &&
      normalizarLocalidade(data.address && data.address.district) !== "tibirica";
    if (!items.length) return "";

    var totalProdutos = subtotal;

    var lines = [
      "Olá! Quero fazer um pedido na *Luxuriosa*. ❤️",
      "",
      "*MEU PEDIDO*"
    ];

    items.forEach(function (item) {
      var quantity = Number(item.quantidade) || 0;
      var price = Number(item.preco) || 0;
      lines.push("• " + item.nome + " — " + quantity + "x — " + formatarPreco(price * quantity) +
        (item.kit_variant_name ? " (Dado incluído: " + item.kit_variant_name + ")" : ""));
    });

    lines.push("", "*Subtotal: " + formatarPreco(subtotal) + "*");

    lines.push(data.fulfillmentType === "pickup"
      ? "Frete: gratuito · retirada agendada em Bauru"
      : kitComFreteGratis
        ? "Frete: gratuito · pedido com kit em Bauru/SP (inclui produtos avulsos no mesmo pedido)"
        : "Frete: valor fixo conforme a localidade e a modalidade do Clube, de acordo com a tabela oficial");
    lines.push("*Total dos produtos: " + formatarPreco(totalProdutos) + "*");

    lines.push("", "*PAGAMENTO*");
    if (data.paymentPayerType === "third_party") {
      lines.push("• Pagador indicado: " + data.paymentPayerName + " — " + data.paymentPayerPhone);
      lines.push("• Informação declarada no pedido; a confirmação do pagamento será feita separadamente.");
    } else {
      lines.push("• Pagador indicado: você (pessoa responsável pelo pedido).");
    }

    lines.push("", data.fulfillmentType === "pickup" ? "*RETIRADA AGENDADA*" : "*ENTREGA*");
    lines.push("• " + data.name + " — " + data.phone);
    if (data.fulfillmentType === "pickup") {
      lines.push("• Retirada gratuita · Rua Madre Clélia, nº 5-44, Jardim Cruzeiro do Sul, Bauru/SP · CEP 17030-290");
      lines.push("• Preferência: " + texto("customerPickupDate") + " às " + texto("customerPickupTime"));
      lines.push("• Aguardando confirmação da disponibilidade pela equipe.");
    } else {
      var endereco = data.address.street + ", " + data.address.number;
      if (data.address.complement) endereco += " — " + data.address.complement;
      lines.push("• " + endereco);
      lines.push("• " + data.address.district + " — " + data.address.city + "/" + data.address.state);
      if (data.address.zip) lines.push("• CEP: " + data.address.zip);
      if (data.address.reference) lines.push("• Referência: " + data.address.reference);
    }
    lines.push("", data.fulfillmentType === "pickup"
      ? "Gostaria de confirmar a disponibilidade para retirada no dia e horário indicados."
      : "Gostaria de confirmar a disponibilidade dos produtos e combinar a entrega.",
      "_Pedido sujeito à confirmação da disponibilidade e das condições da modalidade escolhida._"
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
    var paymentMinimumInfo = $("customerPaymentMinimumInfo");
    if (paymentMinimumInfo) {
      paymentMinimumInfo.hidden = true;
      paymentMinimumInfo.textContent = "";
    }
    preencherFormulario(null);
    var marketingOptIn = $("customerMarketingWhatsAppOptIn");
    if (marketingOptIn) marketingOptIn.checked = false;
    overlay.hidden = false;
    atualizarAvisoFrete();
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
    var paymentMinimumInfo = $("customerPaymentMinimumInfo");
    if (paymentMinimumInfo) {
      paymentMinimumInfo.hidden = true;
      paymentMinimumInfo.textContent = "";
    }
    if (review) review.hidden = true;
    if (form) form.hidden = false;
    limparAviso();
    mostrarStatusCep("", "info");
    atualizarModalidade();

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
    var formData = dadosDoFormulario();
    if (modalidadeRetirada() && !formData.pickupRequestedAt) {
      avisar("Informe a data e o horário pretendidos para a retirada.", "error");
      $("customerPickupDate").focus();
      return;
    }
    dadosAtuais = formData;
    mensagemAtual = preencherMensagem(dadosAtuais);
    if (!mensagemAtual) {
      avisar("Não foi possível montar o pedido. Confira se ainda há produtos no carrinho.", "error");
      return;
    }
    messagePreview.textContent = mensagemAtual;

    var paymentMinimumInfo = $("customerPaymentMinimumInfo");
    if (paymentMinimumInfo) {
      paymentMinimumInfo.hidden = false;
      if (dadosAtuais.fulfillmentType === "pickup") {
        paymentMinimumInfo.textContent = "Retirada gratuita em Bauru. Não há frete nem pedido mínimo de entrega.";
      } else {
        var reviewCity = String(dadosAtuais.address.city || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        var reviewState = String(dadosAtuais.address.state || "").trim().toUpperCase();
        if (reviewCity === "bauru" && reviewState === "SP") {
          paymentMinimumInfo.textContent = integridade.subtotal < 20
            ? "Atenção: o pedido em Bauru deve ter mínimo de R$ 20,00 em produtos. Seu pedido está em " + formatarPreco(integridade.subtotal) + "; acrescente pelo menos " + formatarPreco(20 - integridade.subtotal) + "."
            : "Pedido mínimo em Bauru: mínimo de R$ 20,00 em produtos.";
        } else {
          paymentMinimumInfo.textContent = integridade.subtotal < 50
            ? "Atenção: para entregas fora de Bauru, o pedido deve ter mínimo de R$ 50,00 em produtos. Seu pedido está em " + formatarPreco(integridade.subtotal) + "; acrescente pelo menos " + formatarPreco(50 - integridade.subtotal) + "."
            : "Pedido mínimo fora de Bauru: mínimo de R$ 50,00 em produtos.";
        }
      }
    }

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
    var formData = dadosDoFormulario();
    if (modalidadeRetirada() && !formData.pickupRequestedAt) {
      avisar("Informe a data e o horário pretendidos para a retirada.", "error");
      $("customerPickupDate").focus();
      return;
    }
    dadosAtuais = formData;

    var cidadePagamento = String(dadosAtuais.address.city || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    var estadoPagamento = String(dadosAtuais.address.state || "").trim().toUpperCase();
    var minimoProdutos = cidadePagamento === "bauru" && estadoPagamento === "SP" ? 20 : 50;
    if (!modalidadeRetirada() && integridade.subtotal < minimoProdutos) {
      avisar("O pedido deve ter no mínimo R$ " + minimoProdutos.toFixed(2).replace(".", ",") + " em produtos para entrega nesse destino. Abaixo desse valor, acrescente produtos ao carrinho.", "error");
      return;
    }

    var button = $("customerPaymentButton");
    if (button) {
      button.disabled = true;
      button.textContent = "PREPARANDO PAGAMENTO...";
    }
    avisar("Estamos validando os produtos, o frete e preparando seu pagamento.", "info");

    var etapaPagamento = "identificação da sessão";
    var controller = null;
    var paymentTimeout = null;
    var paymentResponseStatus = null;

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
      var supabase = await obterClienteSupabase();
      var sessionResult = await supabase.auth.getSession();
      var accessToken = sessionResult && sessionResult.data && sessionResult.data.session
        ? sessionResult.data.session.access_token
        : "";
      if (sessionResult && sessionResult.error) throw sessionResult.error;
      if (!accessToken) {
        throw new Error("Sua sessão expirou. Entre novamente na sua conta antes de continuar.");
      }
      headers.authorization = "Bearer " + accessToken;

      etapaPagamento = "comunicação com o servidor de pagamentos";
      if (typeof AbortController === "function") {
        controller = new AbortController();
        paymentTimeout = window.setTimeout(function () {
          controller.abort();
        }, 30000);
      }

      var response = await fetch("https://byiykxfugvxuowueuxca.supabase.co/functions/v1/create-payment-order", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          session_key: sessionKey,
          items: itensAtuais,
          customer: dadosAtuais,
          fulfillment_type: dadosAtuais.fulfillmentType,
          pickup_requested_at: dadosAtuais.pickupRequestedAt
        }),
        signal: controller ? controller.signal : undefined
      });
      paymentResponseStatus = response.status;

      etapaPagamento = "leitura da resposta do servidor";
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.ok || !result.checkout_url) {
        throw new Error(result.error || "Não foi possível preparar o pagamento. Tente novamente.");
      }

      etapaPagamento = "redirecionamento para a InfinitePay";
      messagePreview.textContent =
        "Pedido Luxuriosa #" + result.order_number + "\n" +
        "Total para pagamento: " + formatarPreco(result.total_amount) + "\n\n" +
        "Você será direcionado à InfinitePay para pagar com Pix ou cartão. " +
        "A expedição só começa depois da confirmação do pagamento.";
      avisar("Pedido criado. Abrindo o checkout seguro da InfinitePay...", "success");

      window.location.assign(result.checkout_url);
    } catch (error) {
      var mensagemErro = error && error.name === "AbortError"
        ? "A preparação do pagamento demorou mais que o esperado. Verifique sua conexão e tente novamente."
        : (error && error.message ? error.message : "Não foi possível iniciar o pagamento. Tente novamente.");
      console.error("Luxuriosa: falha ao preparar pagamento.", {
        etapa: etapaPagamento,
        statusHttp: paymentResponseStatus,
        tipoErro: error && error.name ? error.name : "Error"
      });
      avisar(mensagemErro, "error");
      if (button) {
        button.disabled = false;
        button.textContent = "PAGAR COM PIX OU CARTÃO";
      }
    } finally {
      if (paymentTimeout !== null) window.clearTimeout(paymentTimeout);
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
        avisar("Ainda não encontramos dados pessoais ou endereço na sua conta. Preencha nome, WhatsApp e e-mail; o endereço só é necessário para entrega.", "info");
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
      avisar("Dados carregados. Para entrega, complete o endereço; para retirada agendada, escolha a modalidade sem preencher endereço.", "success");
      $("customerName").focus();
    } catch (error) {
      if (requestId !== accountLoadId) return;
      avisar("Não foi possível carregar seus dados agora. Você pode preencher o pedido manualmente.", "error");
    } finally {
      if (requestId === accountLoadId) {
        button.disabled = false;
        button.textContent = "Atualizar dados da conta";
      }
    }
  }

  async function iniciarFinalizacao() {
    if (!window.LuxuriosaCarrinho || !window.LuxuriosaCarrinho.obterQuantidade()) return;
    try {
      var supabase = await obterClienteSupabase();
      var auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data || !auth.data.user) {
        try { localStorage.setItem("luxuriosa_checkout_after_login", "1"); } catch (_) {}
        window.location.assign("/login.html?cadastro=1");
        return;
      }
      abrir();
      await carregarDadosDaConta();
    } catch (error) {
      console.error("Não foi possível validar a conta antes do checkout:", error);
      avisar("Entre na sua conta Luxuriosa para finalizar o pedido.", "error");
      window.location.assign("/login.html");
    }
  }

  function iniciar() {
    overlay = $("customerOverlay");
    dialog = overlay && overlay.querySelector(".customer-dialog");
    form = $("customerForm");
    review = $("customerReview");
    statusBox = $("customerStatus");
    messagePreview = $("customerMessagePreview");
    if (!overlay || !dialog || !form || !review) return;
    atualizarModalidade();
    atualizarCamposPagador();
    var payerType = $("customerPayerType");
    if (payerType) payerType.addEventListener("change", atualizarCamposPagador);
    var fulfillmentMode = $("customerFulfillmentMode");
    if (fulfillmentMode) fulfillmentMode.addEventListener("change", atualizarModalidade);
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
    var campoTelefonePagador = $("customerPayerPhone");
    if (campoTelefonePagador) campoTelefonePagador.addEventListener("input", function () {
      var digits = this.value.replace(/\D/g, "").slice(0, 13);
      if (digits.length >= 10) this.value = formatarTelefone(digits);
      this.removeAttribute("aria-invalid");
    });
    var campoTelefone = $("customerPhone");
    if (campoTelefone) campoTelefone.addEventListener("input", function () {
      var digits = this.value.replace(/\D/g, "").slice(0, 13);
      if (digits.length >= 10) this.value = formatarTelefone(digits);
      this.removeAttribute("aria-invalid");
    });
    ["customerName", "customerPhone", "customerPayerName", "customerPayerPhone", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"].forEach(function (id) {
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
    if (new URLSearchParams(window.location.search).get("retomar-checkout") === "1") {
      window.history.replaceState({}, document.title, window.location.pathname);
      window.setTimeout(function () { iniciarFinalizacao(); }, 350);
    }
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
