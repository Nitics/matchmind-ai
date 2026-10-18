/**
 * MatchMind AI - Synthetic match generator
 *
 * Produces football-realistic, fully synthetic match event streams.
 * Deterministic: the same seed always yields the same match, so tests,
 * demos and judges see identical output.
 *
 * Event types: kickoff, pass, shot, goal, save, foul, yellow_card,
 * red_card, corner, substitution, half_time, full_time
 */

const { TEAMS } = require('./data/teams');

/** Mulberry32 seeded PRNG - small, fast, deterministic. */
function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/**
 * Expected-goals value for a shot, based on distance (m) and angle (deg).
 * Simple logistic model: closer and more central shots score more often.
 */
function shotXg(distance, angle, isHeader = false) {
  const z = -1.2 - 0.12 * distance + 0.02 * angle - (isHeader ? 0.5 : 0);
  const xg = 1 / (1 + Math.exp(-z));
  return Math.round(Math.min(Math.max(xg, 0.01), 0.95) * 100) / 100;
}

/**
 * Generate a complete synthetic match.
 * @param {object} opts
 * @param {number} [opts.seed=42]
 * @param {string} [opts.home] team id
 * @param {string} [opts.away] team id
 * @returns {{id:string, home:object, away:object, events:object[]}}
 */
function generateMatch({ seed = 42, home, away } = {}) {
  const rng = createRng(seed);
  const ids = Object.keys(TEAMS);
  const homeId = home || pick(rng, ids);
  let awayId = away || pick(rng, ids);
  while (awayId === homeId) awayId = pick(rng, ids);
  const teams = { home: TEAMS[homeId], away: TEAMS[awayId] };
  if (!teams.home || !teams.away) throw new Error(`Unknown team: ${!teams.home ? homeId : awayId}`);

  const events = [];
  let seq = 0;
  const push = (e) => events.push({ id: ++seq, ...e });
  const score = { home: 0, away: 0 };
  const cards = { home: {}, away: {} };
  const sentOff = { home: new Set(), away: new Set() };
  // Live lineups: substitutions swap players in, red cards remove them.
  const onPitch = { home: teams.home.players.map((p) => ({ ...p })), away: teams.away.players.map((p) => ({ ...p })) };
  const subsUsed = { home: 0, away: 0 };

  push({ minute: 0, type: 'kickoff', side: 'home' });

  // Minutes 91-94 represent stoppage time (shown as 90+1 ... 90+4).
  for (let minute = 1; minute <= 94; minute++) {
    if (minute === 46) push({ minute: 45, type: 'half_time', score: { ...score } });

    // Possession bias: stronger team (higher rating) attacks more.
    const homeBias = 0.5 + (teams.home.rating - teams.away.rating) / 200 + 0.04; // home advantage
    const side = rng() < homeBias ? 'home' : 'away';
    const opp = side === 'home' ? 'away' : 'home';
    const team = teams[side];
    const active = onPitch[side];
    const attackers = active.filter((p) => p.pos !== 'GK');
    const player = pick(rng, attackers.length ? attackers : active);

    const roll = rng();
    if (roll < 0.28) {
      const distance = Math.round(6 + rng() * 24);
      const angle = Math.round(10 + rng() * 70);
      const header = rng() < 0.18;
      const xg = shotXg(distance, angle, header);
      const scored = rng() < xg;
      push({ minute, type: 'shot', side, player: player.name, distance, angle, header, xg, onTarget: scored || rng() < 0.4 });
      if (scored) {
        score[side]++;
        const assister = rng() < 0.75 ? pick(rng, attackers.filter((p) => p.name !== player.name)) || null : null;
        push({ minute, type: 'goal', side, player: player.name, assist: assister ? assister.name : null, xg, score: { ...score } });
      } else if (events[events.length - 1].onTarget) {
        const gk = onPitch[opp].find((p) => p.pos === 'GK');
        push({ minute, type: 'save', side: opp, player: gk.name, xgPrevented: xg });
      }
    } else if (roll < 0.36) {
      push({ minute, type: 'corner', side });
    } else if (roll < 0.56) {
      const foulerSide = opp;
      const foulers = onPitch[foulerSide].filter((p) => p.pos !== 'GK');
      const fouler = pick(rng, foulers);
      push({ minute, type: 'foul', side: foulerSide, player: fouler.name });
      if (rng() < 0.2) {
        const prior = cards[foulerSide][fouler.name] || 0;
        cards[foulerSide][fouler.name] = prior + 1;
        if (prior === 1 || rng() < 0.01) {
          sentOff[foulerSide].add(fouler.name);
          onPitch[foulerSide] = onPitch[foulerSide].filter((p) => p.name !== fouler.name);
          push({ minute, type: 'red_card', side: foulerSide, player: fouler.name, secondYellow: prior === 1 });
        } else {
          push({ minute, type: 'yellow_card', side: foulerSide, player: fouler.name });
        }
      }
    } else if (minute >= 55 && rng() < 0.05 && subsUsed[side] < 5) {
      const off = pick(rng, attackers);
      const on = team.bench[subsUsed[side]];
      if (off && on) {
        subsUsed[side]++;
        onPitch[side] = onPitch[side].map((p) => (p.name === off.name ? { name: on, pos: off.pos } : p));
        push({ minute, type: 'substitution', side, playerOff: off.name, playerOn: on });
      }
    } else {
      push({ minute, type: 'pass', side, player: player.name, progressive: rng() < 0.25 });
    }
  }

  push({ minute: 94, type: 'full_time', score: { ...score } });
  return { id: `MM-${seed}-${homeId}-${awayId}`, seed, home: teams.home, away: teams.away, events };
}

module.exports = { generateMatch, createRng, shotXg };
