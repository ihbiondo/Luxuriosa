/* Educação Luxuriosa — ferramentas locais de aprendizagem.
 * Nenhuma resposta é enviada, armazenada ou associada a uma pessoa.
 */
(function () {
  "use strict";

  function setupQuiz() {
    const quiz = document.getElementById("knowledgeQuiz");
    const result = document.getElementById("quizResult");
    const checkButton = document.getElementById("quizCheck");
    const resetButton = document.getElementById("quizReset");
    if (!quiz || !result || !checkButton || !resetButton) return;

    const questions = Array.from(quiz.querySelectorAll(".ed-question"));

    checkButton.addEventListener("click", function () {
      let score = 0;
      let answered = 0;

      questions.forEach(function (question) {
        const selected = question.querySelector('input[type="radio"]:checked');
        const feedback = question.querySelector(".ed-feedback");
        if (!feedback) return;

        feedback.hidden = false;
        if (!selected) {
          feedback.textContent = "Questão não respondida. Leia a explicação para conhecer o ponto principal.";
          return;
        }

        answered += 1;
        const correct = selected.value === question.dataset.answer;
        if (correct) score += 1;
        feedback.textContent = (correct ? "Correto. " : "Para revisar. ") + question.dataset.explain;
      });

      if (answered === questions.length) {
        result.textContent = "Resultado: " + score + " de " + questions.length +
          " respostas corretas. " +
          (score === questions.length
            ? "Ótimo trabalho."
            : "Revise as explicações para consolidar o conteúdo.");
      } else {
        result.textContent = "Você respondeu " + answered + " de " + questions.length +
          " questões. Complete as respostas para conferir sua pontuação.";
      }
    });

    resetButton.addEventListener("click", function () {
      quiz.querySelectorAll('input[type="radio"]').forEach(function (input) {
        input.checked = false;
      });
      quiz.querySelectorAll(".ed-feedback").forEach(function (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
      });
      result.textContent = "";
    });
  }

  function setupChecklist() {
    const checks = Array.from(document.querySelectorAll("[data-check]"));
    const bar = document.getElementById("checkProgress");
    const progress = document.getElementById("checkProgressBar");
    const count = document.getElementById("checkCount");
    if (!checks.length) return;

    function update() {
      const completed = checks.filter(function (item) { return item.checked; }).length;
      const percent = Math.round((completed / checks.length) * 100);
      if (bar) bar.style.width = percent + "%";
      if (progress) {
        progress.setAttribute("aria-valuenow", String(completed));
        progress.setAttribute("aria-valuetext", completed + " de " + checks.length + " itens conferidos");
      }
      if (count) count.textContent = completed + " de " + checks.length + " itens conferidos";
    }

    checks.forEach(function (item) { item.addEventListener("change", update); });
    update();
  }

  function setupTopicFinder() {
    const finder = document.getElementById("topicFinder");
    const button = document.getElementById("topicGo");
    const output = document.getElementById("topicOutput");
    if (!finder || !button || !output) return;

    const topics = {
      health: ["Saúde sexual e bem-estar", "/educacao/temas/saude-sexual-e-bem-estar.html"],
      body: ["Anatomia e ciclo menstrual", "/educacao/temas/corpo-humano-e-ciclo-menstrual.html"],
      consent: ["Consentimento e limites", "/educacao/temas/consentimento-e-limites.html"],
      sti: ["Prevenção de IST", "/educacao/temas/prevencao-de-ist.html"],
      combined: ["Prevenção combinada", "/educacao/temas/prevencao-combinada.html"],
      contraception: ["Métodos contraceptivos", "/educacao/temas/contracepcao.html"],
      products: ["Enciclopédia e materiais", "/educacao/enciclopedia/"],
      guides: ["Guias de cuidados", "/educacao/guias/"]
    };

    button.addEventListener("click", function () {
      const item = topics[finder.value];
      output.replaceChildren();
      if (!item) {
        output.textContent = "Escolha um assunto para localizar a leitura.";
        return;
      }
      const intro = document.createTextNode("Leitura indicada: ");
      const link = document.createElement("a");
      link.href = item[1];
      link.textContent = item[0] + " →";
      output.append(intro, link);
    });
  }

  function initialize() {
    setupQuiz();
    setupChecklist();
    setupTopicFinder();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
