/* Protótipo visual do painel. Não autentica, não consulta e não armazena dados. */
(function () {
  "use strict";
  var links = document.querySelectorAll(".admin-sidebar nav a");
  links.forEach(function (link) {
    link.addEventListener("click", function () {
      links.forEach(function (item) { item.classList.remove("active"); });
      link.classList.add("active");
    });
  });
})();