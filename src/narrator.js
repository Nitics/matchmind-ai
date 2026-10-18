/**
 * MatchMind AI - Narratives and recaps
 *
 * Supported outputs:
 *  - commentary(match, lang)        real-time style line for each notable event
 *  - liveStream(match, opts)        async generator that "plays" the match minute by minute
 *  - recap(match, {lang, style, favouriteTeam})
 *      style: 'broadcast' (studio script), 'social' (short post), 'fan' (personalised to a team)
 *  - highlights(match)              ordered highlight reel with clip timestamps
 */

const { t } = require('./i18n');
const { analyzeMatch } = require('./analyzer');

/** 94 -> "90+4"; minutes up to 90 unchanged. */
const formatMinute = (m) => (m > 90 ? `90+${m - 90}` : String(m));

function ctx(match, extra = {}) {
  return { home: match.home.name, away: match.away.name, homeShort: match.home.short, awayShort: match.away.short, ...extra };
}

/** One commentary line for an event, or null if the event isn't notable. */
function commentLine(match, e, lang = 'en') {
  const team = e.side ? match[e.side].name : undefined;
  const sc = e.score || {};
  const base = ctx(match, { team, player: e.player, h: sc.home, a: sc.away });
  switch (e.type) {
    case 'kickoff': return t(lang, 'kickoff', base);
    case 'goal': return t(lang, e.assist ? 'goalAssist' : 'goal', { ...base, assist: e.assist });
    case 'shot': return !e.onTarget && e.xg >= 0.3 ? t(lang, 'bigChance', { ...base, xg: e.xg }) : null;
    case 'save': return e.xgPrevented >= 0.2 ? t(lang, 'save', base) : null;
    case 'yellow_card': return t(lang, 'yellow_card', base);
    case 'red_card': return t(lang, e.secondYellow ? 'secondYellow' : 'red_card', base);
    case 'substitution': return t(lang, 'substitution', { ...base, on: e.playerOn, off: e.playerOff });
    case 'half_time':
    case 'full_time': return t(lang, e.type, base);
    default: return null;
  }
}

function commentary(match, lang = 'en') {
  return match.events
    .map((e) => ({ minute: e.minute, display: formatMinute(e.minute), type: e.type, text: commentLine(match, e, lang) }))
    .filter((c) => c.text);
}

/** Replays the match as a live feed. delayMs=0 for instant (tests); ~300 for demos. */
async function* liveStream(match, { lang = 'en', delayMs = 0 } = {}) {
  for (const c of commentary(match, lang)) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    yield c;
  }
}

function scoreline(match, lang) {
  const ft = match.events.find((e) => e.type === 'full_time').score;
  const sep = lang === 'de' ? ':' : '-';
  return { ft, text: `${ft.home}${sep}${ft.away}` };
}

function headline(match, lang) {
  const { ft, text } = scoreline(match, lang);
  if (ft.home === ft.away) return t(lang, 'recapDraw', ctx(match, { score: text }));
  const winner = ft.home > ft.away ? match.home : match.away;
  const loser = winner === match.home ? match.away : match.home;
  const sep = lang === 'de' ? ':' : '-';
  const winScore = `${Math.max(ft.home, ft.away)}${sep}${Math.min(ft.home, ft.away)}`;
  return t(lang, 'recapWin', { winner: winner.name, loser: loser.name, score: winScore });
}

/**
 * Build a recap. Stats, key moments and patterns come from the analyzer,
 * so every sentence is grounded in the event data.
 */
function recap(match, { lang = 'en', style = 'broadcast', favouriteTeam = null } = {}) {
  const a = analyzeMatch(match);
  const head = headline(match, lang);
  const goals = match.events.filter((e) => e.type === 'goal');
  const scorers = goals.map((g) => `${g.player} ${formatMinute(g.minute)}'`).join(', ') || '-';
  const potm = a.playerOfTheMatch;

  if (style === 'social') {
    const top = a.keyMoments[0];
    const tag = `#${match.home.short}${match.away.short} #MatchMindAI`;
    return [head, top ? `${t(lang, 'keyMoment')}: ${top.player} ${formatMinute(top.minute)}'` : null, potm ? `${t(lang, 'potm')}: ${potm.name}` : null, tag]
      .filter(Boolean).join('\n');
  }

  const sections = [];
  sections.push(`# ${head}`);
  sections.push(`**${t(lang, 'stats')}** - ${match.home.short} vs ${match.away.short}\n` +
    `xG ${a.stats.home.xg} - ${a.stats.away.xg} | ${t(lang, 'shots')} ${a.stats.home.shots} - ${a.stats.away.shots} | ` +
    `${t(lang, 'onTarget')} ${a.stats.home.onTarget} - ${a.stats.away.onTarget} | ${t(lang, 'possession')} ${a.stats.home.possession}% - ${a.stats.away.possession}%`);
  sections.push(`**${t(lang, 'goals')}:** ${scorers}`);

  if (a.keyMoments.length) {
    sections.push(`**${t(lang, 'keyMoment')}**\n` + a.keyMoments.slice(0, 3).map((m) => `- ${formatMinute(m.minute)}' ${m.why}`).join('\n'));
  }
  if (a.patterns.length) {
    sections.push(`**${t(lang, 'tacticalRead')}**\n` + a.patterns.map((p) => `- ${p.text}`).join('\n'));
  }
  if (potm) sections.push(`**${t(lang, 'potm')}:** ${potm.name} (${potm.team}) - ${potm.points} pts`);

  if (style === 'fan' && favouriteTeam) {
    const side = match.home.id === favouriteTeam ? 'home' : match.away.id === favouriteTeam ? 'away' : null;
    if (!side) throw new Error(`Favourite team ${favouriteTeam} did not play in this match`);
    const { ft } = scoreline(match, lang);
    const opp = side === 'home' ? 'away' : 'home';
    const mood = ft[side] > ft[opp] ? 'What a result!' : ft[side] === ft[opp] ? 'A point earned - plenty to build on.' : 'Tough day, but the numbers show reasons for hope.';
    const mine = a.stats[side];
    const yourMoments = a.keyMoments.filter((m) => (m.type === 'goal' ? m.side === side : m.side === opp));
    sections.unshift(`## For ${match[side].name} fans\n${mood} Your side created ${mine.xg} xG from ${mine.shots} shots.` +
      (yourMoments.length ? ` Your biggest moment: ${yourMoments[0].why}` : ''));
  }
  return sections.join('\n\n');
}

/** Highlight reel: goals, red cards, big chances, big saves, with clip windows. */
function highlights(match) {
  const reel = [];
  for (const e of match.events) {
    let priority = 0;
    if (e.type === 'goal') priority = 3;
    else if (e.type === 'red_card') priority = 2;
    else if (e.type === 'save' && e.xgPrevented >= 0.25) priority = 1;
    else if (e.type === 'shot' && !e.onTarget && e.xg >= 0.35) priority = 1;
    if (priority) reel.push({ minute: e.minute, type: e.type, side: e.side, player: e.player, priority, clip: { startSec: Math.max(0, e.minute * 60 - 20), endSec: e.minute * 60 + 15 } });
  }
  return reel;
}

module.exports = { formatMinute, commentary, commentLine, liveStream, recap, highlights, headline };
