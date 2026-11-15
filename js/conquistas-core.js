export const ACTIVITY_NAMES = Object.freeze({
  discovery: "Descubra seu estilo",
  connection: "Conexão a dois",
  curiosity: "Mitos ou verdades?",
  challenge: "Pequenas descobertas",
  knowledge_quiz: "Conhecimentos essenciais sobre saúde sexual",
  sign_profile: "Descubra seu signo solar",
  sign_compatibility: "Combinação entre signos"
});

const ACTIVITY_DEFINITIONS = Object.freeze({
  discovery: { title: "Descubra seu estilo", category: "ferramentas" },
  connection: { title: "Conexão a dois", category: "relacionamento" },
  curiosity: { title: "Mitos ou verdades?", category: "ferramentas" },
  challenge: { title: "Pequenas descobertas", category: "ferramentas" },
  knowledge_quiz: { title: "Conhecimentos essenciais sobre saúde sexual", category: "educacao" },
  sign_profile: { title: "Descubra seu signo solar", category: "astrologia" },
  sign_compatibility: { title: "Combinação entre signos", category: "astrologia" }
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildExperienceResult(detail) {
  if (!detail || typeof detail !== "object") return null;

  const definition = ACTIVITY_DEFINITIONS[detail.activity_id];
  if (!definition) return null;

  const resultTitle = String(detail.result_title || "").trim().slice(0, 120);
  const resultSummary = String(detail.result_summary || "").trim().slice(0, 800);
  if (resultTitle.length < 2 || resultSummary.length < 2) return null;

  const hasValidScore = Number.isInteger(detail.score) &&
    Number.isInteger(detail.score_max) &&
    detail.score >= 0 &&
    detail.score_max > 0 &&
    detail.score <= detail.score_max;

  const attemptId = typeof detail.attempt_id === "string" &&
    UUID_PATTERN.test(detail.attempt_id)
      ? detail.attempt_id
      : crypto.randomUUID();

  // Lista de campos explícita: respostas e dados pessoais nunca são copiados do evento.
  return {
    attempt_id: attemptId,
    activity_id: detail.activity_id,
    activity_title: definition.title,
    category: definition.category,
    result_title: resultTitle,
    result_summary: resultSummary,
    score: hasValidScore ? detail.score : null,
    score_max: hasValidScore ? detail.score_max : null
  };
}

export function calculateAchievementStats(results) {
  const rows = Array.isArray(results) ? results : [];
  const knownActivities = new Set(
    rows
      .map(item => item && item.activity_id)
      .filter(id => Object.prototype.hasOwnProperty.call(ACTIVITY_NAMES, id))
  );
  const recognisedRows = rows.filter(item =>
    item && Object.prototype.hasOwnProperty.call(ACTIVITY_NAMES, item.activity_id)
  );
  const distinctCategories = new Set(
    recognisedRows
      .map(item => item.category)
      .filter(category => typeof category === "string" && category.length > 0)
  );

  const activityCount = knownActivities.size;
  const badges = [
    {
      icon: "✦",
      title: "Primeira descoberta",
      description: "Salve seu primeiro resultado.",
      unlocked: activityCount >= 1
    },
    {
      icon: "◇",
      title: "Curiosidade em movimento",
      description: "Explore duas atividades diferentes.",
      unlocked: activityCount >= 2
    },
    {
      icon: "♡",
      title: "Olhar diverso",
      description: "Experimente dois segmentos diferentes.",
      unlocked: distinctCategories.size >= 2
    },
    {
      icon: "✧",
      title: "Explorador(a)",
      description: "Salve três atividades diferentes.",
      unlocked: activityCount >= 3
    },
    {
      icon: "♛",
      title: "Jornada completa",
      description: "Conclua as quatro experiências iniciais.",
      unlocked: ["discovery", "connection", "curiosity", "challenge"]
        .every(id => knownActivities.has(id))
    }
  ];

  return {
    points: activityCount * 10,
    activities: activityCount,
    saved: rows.length,
    badges
  };
}
