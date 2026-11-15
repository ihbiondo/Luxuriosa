import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_NAMES,
  buildExperienceResult,
  calculateAchievementStats
} from "../js/conquistas-core.js";

const attemptId = "7e2d91a6-42df-4ef5-9f5d-2c8f54f7c9a1";

test("o catálogo reconhece as sete atividades atualmente integradas", () => {
  assert.equal(Object.keys(ACTIVITY_NAMES).length, 7);
  assert.equal(ACTIVITY_NAMES.sign_profile, "Descubra seu signo solar");
  assert.equal(ACTIVITY_NAMES.sign_compatibility, "Combinação entre signos");
});

test("salva somente os campos permitidos e descarta respostas e dados pessoais", () => {
  const result = buildExperienceResult({
    attempt_id: attemptId,
    activity_id: "sign_profile",
    result_title: "Seu signo solar: Touro",
    result_summary: "Leitura simbólica de Touro.",
    answers: ["resposta íntima"],
    birthDate: "1990-01-01",
    birthTime: "08:30",
    timezone: "America/Sao_Paulo",
    email: "cliente@example.test"
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "attempt_id", "activity_id", "activity_title", "category",
    "result_title", "result_summary", "score", "score_max"
  ].sort());
  assert.equal(result.activity_id, "sign_profile");
  assert.equal(result.category, "astrologia");
  assert.equal(result.score, null);
  assert.equal(result.score_max, null);
  assert.equal("answers" in result, false);
  assert.equal("birthDate" in result, false);
  assert.equal("birthTime" in result, false);
  assert.equal("email" in result, false);
});

test("recusa atividade não integrada e resultado sem conteúdo mínimo", () => {
  assert.equal(buildExperienceResult({ activity_id: "invented_activity" }), null);
  assert.equal(buildExperienceResult({
    activity_id: "discovery",
    result_title: " ",
    result_summary: "Resumo válido"
  }), null);
  assert.equal(buildExperienceResult({
    activity_id: "discovery",
    result_title: "Resultado válido",
    result_summary: " "
  }), null);
});

test("limita título e resumo ao tamanho aceito pelo banco", () => {
  const result = buildExperienceResult({
    attempt_id: attemptId,
    activity_id: "curiosity",
    result_title: "T".repeat(140),
    result_summary: "S".repeat(900)
  });
  assert.equal(result.result_title.length, 120);
  assert.equal(result.result_summary.length, 800);
});

test("só envia pontuação quando o par score/score_max é válido", () => {
  const valid = buildExperienceResult({
    attempt_id: attemptId,
    activity_id: "knowledge_quiz",
    result_title: "Quiz concluído",
    result_summary: "Você acertou 18 de 21 questões.",
    score: 18,
    score_max: 21
  });
  assert.equal(valid.score, 18);
  assert.equal(valid.score_max, 21);

  for (const [score, scoreMax] of [[22, 21], [-1, 21], [1, 0], [2, null]]) {
    const invalid = buildExperienceResult({
      attempt_id: attemptId,
      activity_id: "knowledge_quiz",
      result_title: "Quiz concluído",
      result_summary: "Resumo de teste.",
      score,
      score_max: scoreMax
    });
    assert.equal(invalid.score, null);
    assert.equal(invalid.score_max, null);
  }
});

test("repetir uma atividade adiciona histórico, mas não pontos", () => {
  const stats = calculateAchievementStats([
    { activity_id: "discovery", category: "ferramentas" },
    { activity_id: "discovery", category: "ferramentas" },
    { activity_id: "connection", category: "relacionamento" },
    { activity_id: "unknown", category: "astrologia" }
  ]);

  assert.equal(stats.points, 20);
  assert.equal(stats.activities, 2);
  assert.equal(stats.saved, 4);
  assert.equal(stats.badges.find(item => item.title === "Curiosidade em movimento").unlocked, true);
  assert.equal(stats.badges.find(item => item.title === "Olhar diverso").unlocked, true);

  const unknownCategory = calculateAchievementStats([
    { activity_id: "discovery", category: "ferramentas" },
    { activity_id: "not_integrated", category: "astrologia" }
  ]);
  assert.equal(
    unknownCategory.badges.find(item => item.title === "Olhar diverso").unlocked,
    false
  );
});

test("a jornada completa exige as quatro experiências principais", () => {
  const stats = calculateAchievementStats([
    { activity_id: "discovery", category: "ferramentas" },
    { activity_id: "connection", category: "relacionamento" },
    { activity_id: "curiosity", category: "ferramentas" },
    { activity_id: "challenge", category: "ferramentas" },
    { activity_id: "sign_profile", category: "astrologia" }
  ]);

  assert.equal(stats.points, 50);
  assert.equal(stats.activities, 5);
  assert.equal(stats.badges.find(item => item.title === "Jornada completa").unlocked, true);
});

test("a entrada vazia ou inválida não concede conquistas", () => {
  const stats = calculateAchievementStats(null);
  assert.equal(stats.points, 0);
  assert.equal(stats.activities, 0);
  assert.equal(stats.saved, 0);
  assert.equal(stats.badges.some(item => item.unlocked), false);
});
