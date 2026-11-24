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

  function minimoEntregaPorEndereco(address) {
    var cidade = normalizarLocalidade(address && address.city);
    var estado = String(address && address.state || "").trim().toUpperCase();
    return estado === "SP" && (cidade === "bauru" || cidade === "tibirica") ? 20 : 50;
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

  function obterRegiaoSelecionada() {
    var campo = $("cartDeliveryCity");
    return campo ? String(campo.value || "").trim() : "";
  }

  function obterNomeRegiaoSelecionada() {
    var campo = $("cartDeliveryCity");
    if (!campo || campo.selectedIndex < 0) return "";
    return String(campo.options[campo.selectedIndex].textContent || "").trim();
  }

  function enderecoCorrespondeRegiaoSelecionada(address) {
    var regiao = obterRegiaoSelecionada();
    var cidade = normalizarLocalidade(address && address.city);
    var distrito = normalizarLocalidade(address && address.district);
    var estado = String(address && address.state || "").trim().toUpperCase();
    var localidadesConhecidas = [
      "bauru", "tibirica", "agudos", "piratininga",
      "pederneiras", "lencois paulista", "borebi"
    ];

    if (!regiao) return false;
    if (regiao === "other") {
      return localidadesConhecidas.indexOf(cidade) === -1 &&
        distrito !== "tibirica";
    }
    if (estado !== "SP") return false;

    if (regiao === "bauru") {
      return cidade === "bauru" && distrito !== "tibirica";
    }
    if (regiao === "tibirica") {
      return (cidade === "bauru" && distrito === "tibirica") ||
        cidade === "tibirica";
    }
    var aliases = { lencois: "lencois paulista" };
    return cidade === (aliases[regiao] || regiao);
  }

  function obterResumoFretePedido(data, subtotal) {
    if (data.fulfillmentType === "pickup") {
      return {
        fee: 0,
        total: subtotal,
        minimum: 0,
        member: false,
        tollIncluded: false,
        locality: "Retirada agendada em Bauru"
      };
    }

    var address = data.address || {};
    var tarifa = obterTarifasOficiais(address);
    var estado = String(address.state || "").trim().toUpperCase();
    var memberState = window.LuxuriosaClubePrecos &&
      typeof window.LuxuriosaClubePrecos.obterEstado === "function"
      ? window.LuxuriosaClubePrecos.obterEstado()
      : {};
    var member = memberState.loaded === true &&
      memberState.isMember === true &&
      memberState.profileComplete === true;
    var minimum = minimoEntregaPorEndereco(address);

    if (!tarifa || estado !== "SP") {
      return {
        fee: null,
        total: null,
        minimum: minimum,
        member: false,
        tollIncluded: false,
        locality: [address.city, estado].filter(Boolean).join("/")
      };
    }

    var fee = member ? tarifa.clube : tarifa.comum;
    return {
      fee: fee,
      total: subtotal + fee,
      minimum: minimum,
      member: member,
      tollIncluded: tarifa.pedagio,
      locality: tarifa.nome
    };
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

  function atualizarRegiaoSelecionada() {
    var info = $("customerSelectedRegionInfo");
    if (!info) return;
    if (modalidadeRetirada()) {
      info.hidden = true;
      info.textContent = "";
      return;
    }
    var nome = obterNomeRegiaoSelecionada();
    info.hidden = false;
    info.textContent = nome
      ? "Região escolhida no carrinho: " + nome + ". O CEP e o endereço serão conferidos para garantir o frete correto."
      : "Volte ao carrinho e selecione a cidade ou região da entrega antes de continuar.";
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
    atualizarRegiaoSelecionada();
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
    var subtotal = api && typeof api.obterTotal === "function" ? Number(api.obterTotal()) : 0;

    if (!cidade || !estado) {
      aviso.textContent = "Informe o CEP para preencher a cidade e o bairro e conferir o valor de entrega.";
      return;
    }

    var tarifa = obterTarifasOficiais({ city: cidade, district: distrito });
    if (!tarifa || estado !== "SP") {
      aviso.textContent = "Entrega para " + cidade + "/" + estado + ": frete sob consulta pelo atendimento.";
      return;
    }

    var memberState = window.LuxuriosaClubePrecos &&
      typeof window.LuxuriosaClubePrecos.obterEstado === "function"
      ? window.LuxuriosaClubePrecos.obterEstado()
      : {};
    var member = memberState.loaded === true &&
      memberState.isMember === true &&
      memberState.profileComplete === true;
    var fee = member ? tarifa.clube : tarifa.comum;
    var textoFrete = "Frete estimado em " + tarifa.nome + ": " + formatarPreco(fee) + ".";
    if (!member) {
      textoFrete += " Membros ativos do Clube: " + formatarPreco(tarifa.clube) + " (aplicado automaticamente).";
    } else {
      textoFrete += " Tarifa especial do Clube aplicada automaticamente.";
    }
    if (tarifa.pedagio) textoFrete += " Pedágio já incluído.";
    var pedidoMinimo = minimoEntregaPorEndereco({ city: cidade, state: estado });
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
      ? ["customerName", "customerPhone", "customerCep", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"]
      : ["customerName", "customerPhone"];
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
    if (exigirEnderecoEntrega && !enderecoCorrespondeRegiaoSelecionada(data.address)) {
      avisar(
        !obterRegiaoSelecionada()
          ? "Selecione a cidade ou região da entrega no carrinho antes de continuar."
          : "O endereço informado não corresponde à região escolhida no carrinho. Volte ao carrinho para ajustar a região ou corrija o endereço pelo CEP.",
        "error"
      );
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

  function preencherMensagem(data) {
    var api = window.LuxuriosaCarrinho;
    var items = api && typeof api.obterItens === "function" ? api.obterItens() : [];
    var integridade = validarIntegridadePedido(items);
    if (!integridade.valido) {
      avisar(integridade.motivo, "error");
      return "";
    }
    if (!items.length) return "";

    var subtotal = integridade.subtotal;
    var freight = obterResumoFretePedido(data, subtotal);
    var lines = [
      "\u{1F497} *PEDIDO | LUXURIOSA*",
      "",
      "\u{1F6CD} *ITENS DO PEDIDO*"
    ];

    items.forEach(function (item, index) {
      var quantity = Number(item.quantidade) || 0;
      var price = Number(item.preco) || 0;
      var number = String(index + 1).padStart(2, "0");
      lines.push("   " + number + ". " + item.nome);
      lines.push("       " + quantity + "x — " + formatarPreco(price * quantity));
      if (item.kit_variant_name) {
        lines.push("       Variação: " + item.kit_variant_name);
      }
    });

    lines.push("", "\u{1F4B0} *RESUMO DOS VALORES*");
    lines.push("   Produtos: " + formatarPreco(subtotal));

    if (data.fulfillmentType === "pickup") {
      lines.push(
        "   Recebimento: retirada agendada",
        "   Frete: grátis",
        "   *TOTAL ESTIMADO: " + formatarPreco(subtotal) + "*"
      );
    } else if (freight.fee === null) {
      lines.push(
        "   Região: " + (freight.locality || "A confirmar"),
        "   Frete: a confirmar com a equipe",
        "   *TOTAL ESTIMADO: a confirmar*"
      );
    } else {
      lines.push(
        "   Região: " + freight.locality,
        "   Frete: " + formatarPreco(freight.fee),
        "   *TOTAL ESTIMADO: " + formatarPreco(freight.total) + "*"
      );
    }

    if (freight.member) {
      lines.push("   \u{1F3F7} Benefício de frete do Clube aplicado.");
    }
    if (freight.minimum > 0 && subtotal < freight.minimum) {
      lines.push("   \u{26A0}\u{FE0F} Pedido mínimo: " + formatarPreco(freight.minimum) + " em produtos.");
    }
    if (freight.tollIncluded) {
      lines.push("   Pedágio incluído no valor do frete.");
    }

    lines.push("", "\u{1F464} *DADOS DE CONTATO*");
    lines.push("   Nome: " + data.name);
    lines.push("   WhatsApp: " + data.phone);
    if (data.email) lines.push("   E-mail: " + data.email);

    if (data.fulfillmentType === "pickup") {
      lines.push(
        "",
        "\u{1F4CD} *RETIRADA*",
        "   Retirada agendada em Bauru.",
        "   Local: Rua Madre Clélia, nº 5-44, Jardim Cruzeiro do Sul, Bauru/SP.",
        "   Data pretendida: " + texto("customerPickupDate"),
        "   Horário pretendido: " + texto("customerPickupTime")
      );
    } else {
      var address = data.address || {};
      var street = [address.street, address.number].filter(Boolean).join(", ");
      if (address.complement) street += " — " + address.complement;
      lines.push(
        "",
        "\u{1F4CD} *ENDEREÇO DE ENTREGA*",
        "   " + street,
        "   " + [address.district, address.city].filter(Boolean).join(" — ") + (address.state ? "/" + address.state : "")
      );
      if (address.zip) lines.push("   CEP: " + address.zip);
      if (address.reference) lines.push("   Referência: " + address.reference);
    }

    lines.push(
      "",
      "\u{1F4AC} *PRÓXIMOS PASSOS*",
      "   A equipe confirmará a disponibilidade, o prazo e o valor final.",
      "   As instruções de pagamento serão enviadas após essa confirmação.",
      "",
      "\u{1F512} _O pedido será confirmado após a identificação do pagamento._"
    );

    return lines.join("\n");
  }

  function abrir() {
    if (!overlay) return;
    /* Invalida qualquer consulta de CEP pendente de uma etapa anterior. */
    cepConsultaId += 1;
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
    var modoCarrinho = texto("cartFulfillmentMethod");
    definirValor("customerFulfillmentMode", modoCarrinho === "pickup" ? "pickup" : "delivery");
    atualizarModalidade();
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
        var minimoLocalidade = minimoEntregaPorEndereco(dadosAtuais.address);
        if (minimoLocalidade === 20) {
          paymentMinimumInfo.textContent = integridade.subtotal < 20
            ? "Atenção: o pedido para essa localidade deve ter mínimo de R$ 20,00 em produtos. Seu pedido está em " + formatarPreco(integridade.subtotal) + "; acrescente pelo menos " + formatarPreco(20 - integridade.subtotal) + "."
            : "Pedido mínimo nesta localidade: R$ 20,00 em produtos.";
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
    var url = "https://api.whatsapp.com/send?phone=5514996355924&text=" + encodeURIComponent(mensagemAtual);
    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("checkout_whatsapp", { method: "whatsapp", step: "pedido_encaminhado" });
    }
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
      window.LuxuriosaInteligencia.registrarEtapa("whatsapp_opened", itensAtuais, dadosAtuais).catch(function () {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
    avisar("O WhatsApp foi acionado com a mensagem pronta. Revise o pedido e toque em Enviar para encaminhar sua solicitação.", "success");
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
    atualizarModalidade();
    atualizarCamposPagador();
    var payerType = $("customerPayerType");
    if (payerType) payerType.addEventListener("change", atualizarCamposPagador);
    var fulfillmentMode = $("customerFulfillmentMode");
    if (fulfillmentMode) fulfillmentMode.addEventListener("change", atualizarModalidade);
    window.addEventListener("luxuriosa:club-state-changed", function () {
      if (overlay && !overlay.hidden) atualizarAvisoFrete();
    });
    form.addEventListener("submit", revisarPedido);
    $("customerClose").addEventListener("click", fechar);
    $("customerCancel").addEventListener("click", fechar);
    $("customerEditButton").addEventListener("click", function () { review.hidden = true; form.hidden = false; $("customerName").focus(); });
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

  window.LuxuriosaClientes = {
    iniciarFinalizacao: iniciarFinalizacao
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
