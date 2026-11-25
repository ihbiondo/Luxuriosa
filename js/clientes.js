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
  var cepConsultaEmAndamento = "";
  var cepValidado = "";
  var bairroViaCep = "";
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
    var distrito = normalizarLocalidade(bairroViaCep);
    var estado = String(address && address.state || "").trim().toUpperCase();
    if (estado !== "SP") return null;
    if (cidade === "bauru") {
      if (!distrito) return null;
      return distrito === "tibirica" ? 50 : 20;
    }
    if (cidade === "tibirica") return 50;
    if (["agudos", "piratininga", "pederneiras", "lencois paulista", "borebi"].indexOf(cidade) !== -1) return 50;
    return null;
  }

  function obterTarifasOficiais(address) {
    var cidade = normalizarLocalidade(address && address.city);
    var distrito = normalizarLocalidade(bairroViaCep);
    if (cidade === "tibirica" || (cidade === "bauru" && distrito === "tibirica")) {
      return { nome: "Tibiriçá", comum: 20, pedagio: false };
    }
    if (cidade === "bauru" && !distrito) return null;
    var tarifas = {
      "bauru": { nome: "Bauru", comum: 15, pedagio: false },
      "agudos": { nome: "Agudos", comum: 25, pedagio: false },
      "piratininga": { nome: "Piratininga", comum: 25, pedagio: false },
      "pederneiras": { nome: "Pederneiras", comum: 25, pedagio: false },
      "lencois paulista": { nome: "Lençóis Paulista", comum: 50, pedagio: true },
      "borebi": { nome: "Borebi", comum: 50, pedagio: true }
    };
    return tarifas[cidade] || null;
  }

  function obterResumoFretePedido(data, subtotal) {
    if (data.fulfillmentType === "pickup") {
      return { fee: 0, total: subtotal, minimum: 0, tollIncluded: false, locality: "Retirada agendada em Bauru" };
    }
    var address = data.address || {};
    var estado = String(address.state || "").trim().toUpperCase();
    var tarifa = obterTarifasOficiais(address);
    var minimum = minimoEntregaPorEndereco(address);
    if (!tarifa || estado !== "SP") {
      return {
        fee: null, total: null, minimum: minimum, tollIncluded: false,
        locality: [address.city, estado].filter(Boolean).join("/")
      };
    }
    return {
      fee: tarifa.comum, total: subtotal + tarifa.comum, minimum: minimum,
      tollIncluded: tarifa.pedagio, locality: tarifa.nome
    };
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
    ["customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"].forEach(function (id) {
      var field = $(id);
      if (!field) return;
      field.required = !pickup;
      field.setAttribute("aria-required", pickup ? "false" : "true");
    });
    ["customerPickupDate", "customerPickupTime"].forEach(function (id) {
      var field = $(id);
      if (!field) return;
      field.required = pickup;
      field.setAttribute("aria-required", pickup ? "true" : "false");
    });

    if (pickup) {
      // Retirada não coleta nem envia endereço, mesmo que o cliente tenha consultado um CEP antes.
      cepConsultaId += 1;
      cepConsultaEmAndamento = "";
      cepValidado = "";
      bairroViaCep = "";
      ultimoEnderecoViaCep = "";
      ["customerCep", "customerStreet", "customerNumber", "customerComplement",
        "customerDistrict", "customerCity", "customerState", "customerReference"].forEach(function (id) {
        definirValor(id, "");
        var field = $(id);
        if (field) field.removeAttribute("aria-invalid");
      });
      if ($("customerCity")) $("customerCity").readOnly = true;
      if ($("customerState")) $("customerState").readOnly = true;
      if ($("customerDistrict")) $("customerDistrict").readOnly = false;
      mostrarStatusCep("", "info");
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
      address: pickup ? {} : {
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
    cepConsultaEmAndamento = "";
    cepValidado = "";
    bairroViaCep = "";
    if ($("customerCity")) $("customerCity").readOnly = true;
    if ($("customerState")) $("customerState").readOnly = true;
    if ($("customerDistrict")) $("customerDistrict").readOnly = false;
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
    if (cepValidado === cep || cepConsultaEmAndamento === cep) return;
    campoCep.removeAttribute("aria-invalid");
    cepConsultaEmAndamento = cep;
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
          cepConsultaEmAndamento = "";
          cepValidado = "";
          bairroViaCep = "";
          $("customerCep").setAttribute("aria-invalid", "true");
          mostrarStatusCep("CEP não encontrado. Confira os números ou fale com a equipe para validar o endereço.", "error");
          return;
        }
        var valoresCep = [
          String(dados.logradouro || "").trim(),
          String(dados.bairro || "").trim(),
          String(dados.localidade || "").trim(),
          String(dados.uf || "").trim().toUpperCase()
        ];
        if (!valoresCep[2] || !/^[A-Z]{2}$/.test(valoresCep[3])) {
          cepConsultaEmAndamento = "";
          cepValidado = "";
          bairroViaCep = "";
          mostrarStatusCep("O CEP foi localizado, mas não retornou cidade e estado. Fale com a equipe para validar o endereço.", "error");
          return;
        }
        var idsEndereco = ["customerStreet", "customerDistrict", "customerCity", "customerState"];
        var valoresAtuais = idsEndereco.map(function (id) { return texto(id); });
        var enderecoAtual = JSON.stringify(valoresAtuais);
        if (valoresAtuais.some(Boolean) && enderecoAtual !== ultimoEnderecoViaCep) {
          var substituir = window.confirm("A consulta vai substituir rua, bairro, cidade e estado pelos dados encontrados. Deseja continuar?");
          if (!substituir) {
            cepConsultaEmAndamento = "";
            cepValidado = "";
            bairroViaCep = "";
            mostrarStatusCep("Consulta concluída. Os campos digitados foram mantidos, mas o CEP precisa ser confirmado para continuar.", "info");
            return;
          }
        }
        $("customerCep").removeAttribute("aria-invalid");
        definirValor("customerStreet", valoresCep[0]);
        definirValor("customerDistrict", valoresCep[1]);
        definirValor("customerCity", valoresCep[2]);
        definirValor("customerState", valoresCep[3]);
        if ($("customerCity")) $("customerCity").readOnly = true;
        if ($("customerState")) $("customerState").readOnly = true;
        if ($("customerDistrict")) $("customerDistrict").readOnly = !!valoresCep[1];
        idsEndereco.forEach(function (id) {
          var campo = $(id);
          if (campo) campo.removeAttribute("aria-invalid");
        });
        bairroViaCep = valoresCep[1];
        cepConsultaEmAndamento = "";
        cepValidado = cep;
        ultimoEnderecoViaCep = JSON.stringify(valoresCep);
        mostrarStatusCep("Endereço identificado pelo CEP. Complete o número e confira os dados antes de continuar.", "success");
        atualizarAvisoFrete();
      })
      .catch(function () {
        if (consultaAtual !== cepConsultaId) return;
        cepConsultaEmAndamento = "";
        cepValidado = "";
        bairroViaCep = "";
        mostrarStatusCep("Não foi possível consultar o CEP agora. Tente novamente em instantes.", "error");
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
    var api = window.LuxuriosaCarrinho;
    var subtotal = api && typeof api.obterTotal === "function" ? Number(api.obterTotal()) : 0;
    if (!cepValidado || !cidade || !estado) {
      aviso.textContent = "Digite os 8 números do CEP. A cidade e o estado serão identificados automaticamente.";
      return;
    }
    var tarifa = obterTarifasOficiais({ city: cidade, state: estado });
    var pedidoMinimo = minimoEntregaPorEndereco({ city: cidade, state: estado });
    if (!tarifa || estado !== "SP") {
      aviso.textContent = normalizarLocalidade(cidade) === "bauru" && !bairroViaCep
        ? "O CEP não retornou o bairro. A equipe confirmará se o endereço pertence a Tibiriçá, o frete e o pedido mínimo."
        : "Entrega para " + cidade + "/" + estado + ": frete e pedido mínimo sob confirmação pelo atendimento.";
      return;
    }
    var textoFrete = "Frete estimado em " + tarifa.nome + ": " + formatarPreco(tarifa.comum) + ".";
    if (tarifa.pedagio) textoFrete += " Pedágio já incluído.";
    if (pedidoMinimo !== null) {
      textoFrete += " Pedido mínimo: " + formatarPreco(pedidoMinimo) + " em produtos.";
      if (subtotal > 0 && subtotal < pedidoMinimo) {
        textoFrete += " Faltam " + formatarPreco(pedidoMinimo - subtotal) + " para atingir o mínimo.";
      }
    }
    aviso.textContent = textoFrete;
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
      mostrarStatusCep("Informe um CEP válido com 8 números.", "error");
      if (campoCep) campoCep.focus();
      return false;
    }

    if (exigirEnderecoEntrega && cepValidado !== cepDigits) {
      if (campoCep) {
        campoCep.setAttribute("aria-invalid", "true");
        campoCep.focus();
      }
      mostrarStatusCep("Busque o CEP para identificar automaticamente a cidade e o estado antes de continuar.", "error");
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
          : "Preencha nome e telefone/WhatsApp.",
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
      "\u{2764}\u{FE0F} *PEDIDO | LUXURIOSA*",
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
        "\u{1F6F5} *ENDEREÇO DE ENTREGA*",
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
    cepConsultaEmAndamento = "";
    cepValidado = "";
    bairroViaCep = "";
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
        if (minimoLocalidade === 20 || minimoLocalidade === 50) {
          paymentMinimumInfo.textContent = integridade.subtotal < minimoLocalidade
            ? "Atenção: o pedido para essa localidade deve ter mínimo de " + formatarPreco(minimoLocalidade) + " em produtos. Seu pedido está em " + formatarPreco(integridade.subtotal) + "; acrescente pelo menos " + formatarPreco(minimoLocalidade - integridade.subtotal) + "."
            : "Pedido mínimo nesta localidade: " + formatarPreco(minimoLocalidade) + " em produtos.";
        } else {
          paymentMinimumInfo.textContent = "O frete e o pedido mínimo serão confirmados pela equipe após validar o CEP e o endereço.";
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
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarPedido === "function") {
      var resumoFrete = obterResumoFretePedido(dadosAtuais, integridade.subtotal);
      window.LuxuriosaInteligencia.registrarPedido(itensAtuais, dadosAtuais, resumoFrete.fee)
        .catch(function (error) {
          console.error("Luxuriosa: não foi possível registrar o pedido no sistema.", error);
          avisar("A mensagem foi aberta, mas não foi possível registrar a prévia do pedido no sistema. Envie a mensagem no WhatsApp para a equipe confirmar os dados.", "error");
        });
    } else {
      console.error("Luxuriosa: módulo de registro de pedidos indisponível.");
      avisar("A mensagem foi aberta, mas o sistema não conseguiu registrar a prévia do pedido. Envie a mensagem no WhatsApp para a equipe confirmar os dados.", "error");
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
        var digits = this.value.replace(/\D/g, "");
        this.removeAttribute("aria-invalid");
        mostrarStatusCep("", "info");
        if (digits !== cepValidado) {
          cepConsultaId += 1;
          cepConsultaEmAndamento = "";
          cepValidado = "";
          bairroViaCep = "";
          ultimoEnderecoViaCep = "";
          ["customerStreet", "customerDistrict", "customerCity", "customerState"].forEach(function (id) {
            definirValor(id, "");
            var field = $(id);
            if (field) field.removeAttribute("aria-invalid");
          });
          if ($("customerCity")) $("customerCity").readOnly = true;
          if ($("customerState")) $("customerState").readOnly = true;
          if ($("customerDistrict")) $("customerDistrict").readOnly = false;
          atualizarAvisoFrete();
          if (digits.length === 8) consultarCep();
        }
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
