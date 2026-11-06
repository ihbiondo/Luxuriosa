/* Clube Luxuriosa — demonstração local de cadastro. Não envia nem persiste dados. */
(function () {
  "use strict";
  var form = document.getElementById("clubMemberForm");
  var result = document.getElementById("clubFormResult");
  if (!form || !result) return;

  function value(name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }
  function checked(name) {
    var el = form.elements[name];
    return !!(el && el.checked);
  }
  function selected(name) {
    return Array.prototype.slice.call(form.querySelectorAll('[name="' + name + '"]:checked')).map(function (el) { return el.value; });
  }
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
  function row(label, val) {
    if (!val) return "";
    return "<div class=\"club-review-row\"><span>" + escapeHTML(label) + "</span><strong>" + escapeHTML(val) + "</strong></div>";
  }
  function resetResult() {
    result.hidden = true;
    result.innerHTML = "";
  }

  form.addEventListener("input", resetResult);
  form.addEventListener("change", resetResult);
  form.addEventListener("reset", function () { window.setTimeout(resetResult, 0); });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var birth = new Date(value("nascimento") + "T00:00:00");
    var today = new Date();
    var age = today.getFullYear() - birth.getFullYear();
    var monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    if (!Number.isFinite(birth.getTime()) || age < 18) {
      form.elements.nascimento.setCustomValidity("O Clube é destinado exclusivamente a maiores de 18 anos.");
      form.elements.nascimento.reportValidity();
      form.elements.nascimento.setCustomValidity("");
      return;
    }

    var sensitiveNames = ["orientacao","genero","momento_afetivo","companhia","preferencias_produtos","curiosidades","evitar"];
    var hasSensitive = sensitiveNames.some(function (name) { return !!value(name); });
    if (hasSensitive && !checked("sensivel")) {
      result.hidden = false;
      result.innerHTML = "<strong>Revise suas autorizações</strong><p>Você preencheu informações de perfil íntimo. Nesta demonstração, marque a autorização específica correspondente ou remova essas informações para continuar a revisão.</p>";
      result.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }

    var address = [value("endereco"),value("numero"),value("complemento"),value("bairro"),value("cidade"),value("estado"),value("cep")].filter(Boolean).join(", ");
    var profile = [
      row("Nome",value("nome")),
      row("Como prefere ser chamado(a)",value("tratamento")),
      row("E-mail",value("email")),
      row("WhatsApp",value("whatsapp")),
      row("Nascimento",value("nascimento")),
      row("Estado civil",value("estado_civil")),
      row("Pronomes",value("pronomes")),
      row("Outro pronome",value("pronome_outro")),
      row("Endereço",address),
      row("Orientação sexual",value("orientacao")),
      row("Identidade de gênero",value("genero")),
      row("Momento afetivo",value("momento_afetivo")),
      row("Experiências",value("companhia")),
      row("Interesses",selected("interesses").join(", ")),
      row("Preferências de produtos",value("preferencias_produtos")),
      row("Curiosidades",value("curiosidades")),
      row("O que deseja evitar",value("evitar")),
      row("Atendimento",value("tipo_atendimento")),
      row("Comunicação",value("comunicacao")),
      row("Curadoria personalizada",value("concierge")),
      row("Frequência de contato",value("frequencia"))
    ].join("");

    result.hidden = false;
    result.innerHTML = "<div class=\"club-review-head\"><span>REVISÃO LOCAL</span><h3>Confira suas informações</h3><p>Esta visualização existe somente nesta página. Nenhum dado foi transmitido ou gravado.</p></div><div class=\"club-review-list\">" +
      (profile || "<p>Nenhuma informação preenchida.</p>") +
      "</div><div class=\"club-review-consents\"><strong>Suas escolhas nesta demonstração</strong>" +
      row("Política de Privacidade",checked("privacidade") ? "Aceita" : "Não aceita") +
      row("Perfil íntimo e dados sensíveis",checked("sensivel") ? "Autorizado" : "Não autorizado") +
      row("Marketing",checked("marketing") ? "Autorizado" : "Não autorizado") +
      row("Informações sobre curadoria",checked("contato_concierge") ? "Tenho interesse" : "Sem autorização") +
      "</div><p class=\"club-review-warning\">Demonstração concluída. Para efetivar o cadastro, será necessário integrar um backend seguro e registrar as autorizações com suas respectivas versões e datas.</p><button type=\"button\" class=\"club-reset\" data-edit-profile>Voltar e editar</button>";
    result.querySelector("[data-edit-profile]").addEventListener("click",function(){form.scrollIntoView({behavior:"smooth",block:"start"});});
    result.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();