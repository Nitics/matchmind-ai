#!/usr/bin/env node
/**
 * Builds web/dashboard.html: runs the MatchMind engine for a set of seeds and
 * embeds the results (stats, win probability, key moments, patterns, highlights,
 * commentary and recaps in every language) into the dashboard template.
 *
 * Usage: node scripts/build-dashboard.js [seed seed ...]   (default: 7 1 2 3 4 5 8 9)
 */
const fs = require('fs');
const path = require('path');
const mm = require('../src');

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
const SEEDS = seeds.length ? seeds : [7, 1, 2, 3, 4, 5, 8, 9];

/**
 * Approximate pitch location (metres, 105 x 68) of a shot from its distance and angle.
 * Home attacks the right-hand goal, away the left. Higher angle = more central.
 */
function shotLocation(e) {
  const theta = ((90 - e.angle) * Math.PI) / 180;
  const sign = e.id % 2 ? 1 : -1;
  const dx = e.distance * Math.cos(theta);
  const dy = Math.min(e.distance * Math.sin(theta), 33) * sign;
  const x = e.side === 'home' ? 105 - dx : dx;
  return { x: Math.round(x * 10) / 10, y: Math.round((34 + dy) * 10) / 10 };
}

const round = (x) => Math.round(x * 1000) / 1000;

function buildMatch(seed) {
  const match = mm.generateMatch({ seed });
  const analysis = mm.analyzeMatch(match);
  const goals = new Set(match.events.filter((e) => e.type === 'goal').map((e) => `${e.minute}|${e.player}`));
  const shots = match.events.filter((e) => e.type === 'shot').map((e) => ({
    id: e.id, minute: e.minute, side: e.side, player: e.player, xg: e.xg, onTarget: e.onTarget, header: e.header,
    distance: e.distance, goal: goals.has(`${e.minute}|${e.player}`), ...shotLocation(e),
  }));
  const markers = match.events
    .filter((e) => ['goal', 'red_card', 'yellow_card', 'substitution'].includes(e.type) || (e.type === 'save' && e.xgPrevented >= 0.25))
    .map((e) => ({ id: e.id, minute: e.minute, type: e.type, side: e.side, player: e.player || e.playerOn, assist: e.assist || null, playerOff: e.playerOff || null, xg: e.xg ?? e.xgPrevented ?? null, score: e.score || null }));

  const commentary = {}, recap = {}, social = {}, fan = {};
  for (const lang of mm.LANGUAGES) {
    commentary[lang] = mm.commentary(match, lang).map(({ minute, display, type, text }) => ({ minute, display, type, text }));
    recap[lang] = mm.recap(match, { lang });
    social[lang] = mm.recap(match, { lang, style: 'social' });
    fan[lang] = { home: mm.recap(match, { lang, style: 'fan', favouriteTeam: match.home.id }), away: mm.recap(match, { lang, style: 'fan', favouriteTeam: match.away.id }) };
  }
  const strip = ({ id, name, short, rating }) => ({ id, name, short, rating });
  return {
    id: match.id, seed, home: strip(match.home), away: strip(match.away),
    score: analysis.finalScore, stats: analysis.stats,
    winProb: mm.winProbabilityTimeline(match).map((p) => [round(p.home), round(p.draw), round(p.away)]),
    keyMoments: analysis.keyMoments, momentum: analysis.momentum, patterns: analysis.patterns,
    potm: analysis.playerOfTheMatch, highlights: mm.highlights(match), shots, markers,
    commentary, recap, social, fan,
  };
}

const data = { generated: new Date().toISOString().slice(0, 10), languages: mm.LANGUAGES, matches: SEEDS.map(buildMatch) };
const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'web', 'template.html'), 'utf8');
const marker = '/*__MATCHMIND_DATA__*/null';
if (!template.includes(marker)) throw new Error('Data marker missing from web/template.html');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const outFile = path.join(root, 'web', 'dashboard.html');
const page = template.replace(marker, json);
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body style="margin:0">
${page}
</body>
</html>
`;
fs.writeFileSync(outFile, doc);
console.log(`Wrote ${path.relative(root, outFile)} with ${data.matches.length} matches (${Math.round(fs.statSync(outFile).size / 1024)} KB)`);
