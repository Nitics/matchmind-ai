/**
 * MatchMind AI - Optional Azure OpenAI / Microsoft Foundry layer
 *
 * Turns the deterministic, grounded recap into polished prose in any language.
 * The model only receives facts computed by analyzer.js and is told not to add
 * anything else, so the output stays explainable.
 *
 * Configure with environment variables (no keys in code):
 *   AZURE_OPENAI_ENDPOINT     e.g. https://<resource>.openai.azure.com
 *   AZURE_OPENAI_API_KEY
 *   AZURE_OPENAI_DEPLOYMENT   your model deployment name
 *   AZURE_OPENAI_API_VERSION  optional, defaults to 2024-10-21
 *
 * If not configured, polishRecap() returns the template recap unchanged.
 */

const { analyzeMatch } = require('./analyzer');
const { recap } = require('./narrator');

function isConfigured(env = process.env) {
  return Boolean(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_DEPLOYMENT);
}

function buildMessages(match, { lang = 'en', style = 'broadcast', favouriteTeam = null } = {}) {
  const facts = analyzeMatch(match);
  const goals = match.events.filter((e) => e.type === 'goal').map(({ minute, side, player, assist, xg }) => ({ minute, team: match[side].name, player, assist, xg }));
  return [
    {
      role: 'system',
      content:
        'You are MatchMind, a football match analyst. Write only from the JSON facts provided. ' +
        'Never invent players, events, quotes or numbers. When you make a claim, it must be traceable to a fact. ' +
        'All teams and players are fictional and synthetic.',
    },
    {
      role: 'user',
      content:
        `Write a ${style} match recap in language code "${lang}".` +
        (favouriteTeam ? ` Address fans of team id ${favouriteTeam}.` : '') +
        `\n\nTeams: ${match.home.name} (home) vs ${match.away.name} (away)\nGoals: ${JSON.stringify(goals)}\nAnalysis: ${JSON.stringify(facts)}`,
    },
  ];
}

async function polishRecap(match, opts = {}, env = process.env, fetchImpl = globalThis.fetch) {
  const fallback = recap(match, opts);
  if (!isConfigured(env)) return { source: 'template', text: fallback };
  const version = env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  const url = `${env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${version}`;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'api-key': env.AZURE_OPENAI_API_KEY },
      body: JSON.stringify({ messages: buildMessages(match, opts), temperature: 0.4, max_tokens: 700 }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI returned ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty model response');
    return { source: 'azure-openai', text };
  } catch (err) {
    return { source: 'template', text: fallback, error: err.message };
  }
}

module.exports = { polishRecap, buildMessages, isConfigured };
