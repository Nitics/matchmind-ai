/**
 * MatchMind AI - public API
 */
const generator = require('./generator');
const analyzer = require('./analyzer');
const narrator = require('./narrator');
const llm = require('./llm');
const { TEAMS } = require('./data/teams');
const { LANGUAGES } = require('./i18n');

/**
 * Expand the dataset: generate many synthetic matches as flat, analytics-ready
 * rows (one row per event) - ready for Microsoft Fabric / a lakehouse as CSV or JSONL.
 */
function generateDataset({ matches = 10, startSeed = 1 } = {}) {
  const rows = [];
  for (let i = 0; i < matches; i++) {
    const m = generator.generateMatch({ seed: startSeed + i });
    for (const e of m.events) {
      rows.push({
        match_id: m.id, event_id: e.id, minute: e.minute, type: e.type,
        team: e.side ? m[e.side].id : '', player: e.player || e.playerOn || '',
        xg: e.xg ?? '', on_target: e.onTarget ?? '', home_score: e.score?.home ?? '', away_score: e.score?.away ?? '',
      });
    }
  }
  return rows;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

module.exports = { ...generator, ...analyzer, ...narrator, ...llm, TEAMS, LANGUAGES, generateDataset, toCsv };
