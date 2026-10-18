/**
 * MatchMind AI - Explainable match analyzer
 *
 * Supported analyses:
 *  - teamStats(match)        shots, on target, xG, possession share, fouls, cards, corners
 *  - winProbability(...)     Poisson-based live win/draw/loss probabilities
 *  - winProbabilityTimeline  probability after every minute of the match
 *  - keyMoments(match)       events ranked by win-probability swing, each with a plain-language "why"
 *  - momentum(match)         15-minute windows of attacking pressure
 *  - tacticalPatterns(match) detected patterns with the evidence behind each one
 *  - playerOfTheMatch(match) transparent points-based rating
 *
 * Every insight carries its evidence so fans, studios and judges can see why
 * MatchMind said what it said - no black-box claims.
 */

const GOALS_PER_90 = 1.35;
const possessive = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/**
 * Win/draw/loss probabilities from current score and minutes remaining.
 * Each side's remaining goals ~ Poisson(rate * minutesLeft/90), rate adjusted by rating
 * and by red cards (a man down scores less and concedes more).
 */
function winProbability({ homeGoals, awayGoals, minute, homeRating = 75, awayRating = 75, homeReds = 0, awayReds = 0 }) {
  const left = Math.max(0, 90 - minute) / 90;
  const ratingEdge = (homeRating - awayRating) / 100;
  const lh = GOALS_PER_90 * left * (1 + ratingEdge + 0.1) * Math.pow(0.75, homeReds) * Math.pow(1.25, awayReds);
  const la = GOALS_PER_90 * left * (1 - ratingEdge) * Math.pow(0.75, awayReds) * Math.pow(1.25, homeReds);
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const p = poisson(h, lh) * poisson(a, la);
      const diff = homeGoals + h - (awayGoals + a);
      if (diff > 0) home += p; else if (diff === 0) draw += p; else away += p;
    }
  }
  const total = home + draw + away;
  const r = (x) => Math.round((x / total) * 1000) / 1000;
  return { home: r(home), draw: r(draw), away: r(away) };
}

function teamStats(match) {
  const blank = () => ({ shots: 0, onTarget: 0, xg: 0, goals: 0, actions: 0, fouls: 0, yellow: 0, red: 0, corners: 0, saves: 0, progressivePasses: 0 });
  const s = { home: blank(), away: blank() };
  for (const e of match.events) {
    if (!e.side || !s[e.side]) continue;
    const t = s[e.side];
    switch (e.type) {
      case 'shot': t.shots++; t.xg += e.xg; if (e.onTarget) t.onTarget++; t.actions++; break;
      case 'goal': t.goals++; break;
      case 'pass': t.actions++; if (e.progressive) t.progressivePasses++; break;
      case 'corner': t.corners++; t.actions++; break;
      case 'foul': t.fouls++; break;
      case 'yellow_card': t.yellow++; break;
      case 'red_card': t.red++; break;
      case 'save': t.saves++; break;
    }
  }
  const totalActions = s.home.actions + s.away.actions || 1;
  for (const side of ['home', 'away']) {
    s[side].xg = Math.round(s[side].xg * 100) / 100;
    s[side].possession = Math.round((s[side].actions / totalActions) * 100);
    delete s[side].actions;
  }
  return s;
}

/** Win probability after each minute, replaying the event stream. */
function winProbabilityTimeline(match) {
  const state = { homeGoals: 0, awayGoals: 0, homeReds: 0, awayReds: 0 };
  const base = { homeRating: match.home.rating, awayRating: match.away.rating };
  const timeline = [{ minute: 0, ...winProbability({ ...state, ...base, minute: 0 }) }];
  let i = 0;
  const evs = match.events.filter((e) => e.type !== 'full_time');
  for (let minute = 1; minute <= 90; minute++) {
    while (i < evs.length && Math.min(evs[i].minute, 90) <= minute) {
      const e = evs[i++];
      if (e.type === 'goal') state[`${e.side}Goals`]++;
      if (e.type === 'red_card') state[`${e.side}Reds`]++;
    }
    timeline.push({ minute, ...winProbability({ ...state, ...base, minute }) });
  }
  return timeline;
}

/**
 * Rank goals and red cards by how much they moved the result probability
 * for the team they helped. Returns top N with a human-readable explanation.
 */
function keyMoments(match, limit = 5) {
  const state = { homeGoals: 0, awayGoals: 0, homeReds: 0, awayReds: 0 };
  const base = { homeRating: match.home.rating, awayRating: match.away.rating };
  const moments = [];
  for (const e of match.events) {
    if (e.type !== 'goal' && e.type !== 'red_card') continue;
    const minute = Math.min(e.minute, 90);
    const before = winProbability({ ...state, ...base, minute });
    if (e.type === 'goal') state[`${e.side}Goals`]++;
    else state[`${e.side}Reds`]++;
    const after = winProbability({ ...state, ...base, minute });

    // "Benefiting" side: the scorer for goals, the opponent for red cards.
    const ben = e.type === 'goal' ? e.side : e.side === 'home' ? 'away' : 'home';
    const winBefore = before[ben], winAfter = after[ben];
    const notLoseBefore = before[ben] + before.draw, notLoseAfter = after[ben] + after.draw;
    const swing = Math.max(Math.abs(winAfter - winBefore), Math.abs(notLoseAfter - notLoseBefore));
    const team = match[ben].name;
    const pct = (x) => `${Math.round(x * 100)}%`;
    let why;
    if (e.type === 'goal') {
      const quality = e.xg < 0.1 ? `a low-percentage chance (xG ${e.xg})` : e.xg > 0.35 ? `a high-quality chance (xG ${e.xg})` : `a moderate chance (xG ${e.xg})`;
      why = `${e.player} converted ${quality}. ${possessive(team)} win probability moved from ${pct(winBefore)} to ${pct(winAfter)}.`;
    } else {
      why = `${e.player} was sent off${e.secondYellow ? ' for a second yellow' : ''}, leaving ${match[e.side].name} with ten men. ${possessive(team)} win probability rose from ${pct(winBefore)} to ${pct(winAfter)}.`;
    }
    moments.push({ minute: e.minute, type: e.type, side: e.side, player: e.player, score: e.score || { home: state.homeGoals, away: state.awayGoals }, swing: Math.round(swing * 1000) / 1000, why });
  }
  return moments.sort((a, b) => b.swing - a.swing).slice(0, limit);
}

/** Attacking pressure per 15-minute window: shots weighted x3 + corners x1 + progressive passes x0.5. */
function momentum(match) {
  const windows = [];
  for (let start = 0; start < 90; start += 15) {
    const w = { window: `${start}-${start + 15}`, home: 0, away: 0 };
    for (const e of match.events) {
      const m = Math.min(e.minute, 90);
      if (m <= start || m > start + 15 || !w.hasOwnProperty(e.side)) continue;
      if (e.type === 'shot') w[e.side] += 3;
      else if (e.type === 'corner') w[e.side] += 1;
      else if (e.type === 'pass' && e.progressive) w[e.side] += 0.5;
    }
    w.dominant = w.home > w.away * 1.3 ? 'home' : w.away > w.home * 1.3 ? 'away' : 'even';
    windows.push(w);
  }
  return windows;
}

/** Detect tactical patterns, each with the numbers that triggered it. */
function tacticalPatterns(match) {
  const s = teamStats(match);
  const mo = momentum(match);
  const out = [];
  for (const side of ['home', 'away']) {
    const opp = side === 'home' ? 'away' : 'home';
    const t = s[side], name = match[side].name;
    if (t.goals - t.xg >= 1) out.push({ side, pattern: 'clinical_finishing', text: `${name} were clinical, scoring ${t.goals} from just ${t.xg} xG.`, evidence: { goals: t.goals, xg: t.xg } });
    if (t.xg - t.goals >= 1) out.push({ side, pattern: 'wasteful_finishing', text: `${name} created ${t.xg} xG but scored only ${t.goals} - finishing let them down.`, evidence: { goals: t.goals, xg: t.xg } });
    if (t.possession >= 58) out.push({ side, pattern: 'possession_control', text: `${name} controlled the ball with ${t.possession}% of attacking actions.`, evidence: { possession: t.possession } });
    if (t.possession <= 42 && t.goals > s[opp].goals) out.push({ side, pattern: 'counter_attack_win', text: `${name} won despite only ${t.possession}% of the ball - an efficient, direct approach.`, evidence: { possession: t.possession, goals: t.goals } });
    if (t.saves >= 5) out.push({ side, pattern: 'goalkeeper_heroics', text: `${possessive(name)} goalkeeper made ${t.saves} saves to keep them in it.`, evidence: { saves: t.saves } });
    if (t.yellow + t.red * 2 >= 4) out.push({ side, pattern: 'discipline_issues', text: `${name} picked up ${t.yellow} yellow and ${t.red} red card(s), disrupting their rhythm.`, evidence: { yellow: t.yellow, red: t.red } });
    const late = mo.slice(4).filter((w) => w.dominant === side).length;
    if (late === 2) out.push({ side, pattern: 'late_pressure', text: `${name} dominated the final 30 minutes, pushing hard for the result.`, evidence: { windows: mo.slice(4) } });
  }
  return out;
}

/** Points-based rating so the choice is transparent. */
function playerOfTheMatch(match) {
  const pts = {};
  const add = (side, name, n, why) => {
    if (!name) return;
    const k = `${side}|${name}`;
    pts[k] = pts[k] || { name, side, team: match[side].name, points: 0, contributions: [] };
    pts[k].points += n;
    pts[k].contributions.push(why);
  };
  const ft = match.events.find((e) => e.type === 'full_time').score;
  for (const e of match.events) {
    if (e.type === 'goal') { add(e.side, e.player, 10, `goal ${e.minute}'`); add(e.side, e.assist, 6, `assist ${e.minute}'`); }
    if (e.type === 'shot' && !e.onTarget) continue;
    if (e.type === 'save') add(e.side, e.player, 3 + Math.round(e.xgPrevented * 10), `save ${e.minute}'`);
    if (e.type === 'pass' && e.progressive) add(e.side, e.player, 0.5, 'progressive pass');
    if (e.type === 'yellow_card') add(e.side, e.player, -3, `booked ${e.minute}'`);
    if (e.type === 'red_card') add(e.side, e.player, -10, `sent off ${e.minute}'`);
  }
  const winner = ft.home > ft.away ? 'home' : ft.away > ft.home ? 'away' : null;
  for (const p of Object.values(pts)) if (p.side === winner) p.points += 3;
  const best = Object.values(pts).sort((a, b) => b.points - a.points)[0];
  if (!best) return null;
  const summary = {};
  for (const c of best.contributions) { const k = c.replace(/ \d+'$/, ''); summary[k] = (summary[k] || 0) + 1; }
  return { ...best, points: Math.round(best.points * 10) / 10, summary };
}

function analyzeMatch(match) {
  return {
    matchId: match.id,
    finalScore: match.events.find((e) => e.type === 'full_time').score,
    stats: teamStats(match),
    keyMoments: keyMoments(match),
    momentum: momentum(match),
    patterns: tacticalPatterns(match),
    playerOfTheMatch: playerOfTheMatch(match),
  };
}

module.exports = { analyzeMatch, teamStats, winProbability, winProbabilityTimeline, keyMoments, momentum, tacticalPatterns, playerOfTheMatch, poisson };
