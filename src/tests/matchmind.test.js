/**
 * MatchMind AI - unit tests (Node's built-in test runner: `npm test`)
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mm = require('../index');
const { main, parseArgs } = require('../cli');

const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

describe('generator', () => {
  test('same seed produces identical match (deterministic)', () => {
    assert.deepEqual(mm.generateMatch({ seed: 99 }), mm.generateMatch({ seed: 99 }));
  });

  test('different seeds produce different matches', () => {
    assert.notDeepEqual(mm.generateMatch({ seed: 1 }).events, mm.generateMatch({ seed: 2 }).events);
  });

  test('respects chosen teams and never plays a team against itself', () => {
    const m = mm.generateMatch({ seed: 3, home: 'NFC', away: 'HLU' });
    assert.equal(m.home.id, 'NFC');
    assert.equal(m.away.id, 'HLU');
    for (const s of SEEDS) {
      const r = mm.generateMatch({ seed: s });
      assert.notEqual(r.home.id, r.away.id);
    }
  });

  test('unknown team throws', () => {
    assert.throws(() => mm.generateMatch({ home: 'XXX', away: 'NFC' }), /Unknown team/);
  });

  test('starts with kickoff, has half-time, ends with full-time', () => {
    const { events } = mm.generateMatch({ seed: 5 });
    assert.equal(events[0].type, 'kickoff');
    assert.equal(events.at(-1).type, 'full_time');
    assert.equal(events.filter((e) => e.type === 'half_time').length, 1);
  });

  test('final score equals number of goal events per side', () => {
    for (const s of SEEDS) {
      const { events } = mm.generateMatch({ seed: s });
      const ft = events.at(-1).score;
      assert.equal(ft.home, events.filter((e) => e.type === 'goal' && e.side === 'home').length);
      assert.equal(ft.away, events.filter((e) => e.type === 'goal' && e.side === 'away').length);
    }
  });

  test('a sent-off player takes no further part', () => {
    for (const s of SEEDS) {
      const { events } = mm.generateMatch({ seed: s });
      for (const red of events.filter((e) => e.type === 'red_card')) {
        const later = events.filter((e) => e.id > red.id && e.side === red.side && (e.player === red.player || e.playerOff === red.player));
        assert.equal(later.length, 0, `seed ${s}: ${red.player} acted after red card`);
      }
    }
  });

  test('substitutes come on by name and replaced players take no further part', () => {
    let subsSeen = 0;
    for (const s of SEEDS) {
      const { events } = mm.generateMatch({ seed: s });
      for (const sub of events.filter((e) => e.type === 'substitution')) {
        subsSeen++;
        assert.equal(typeof sub.playerOn, 'string');
        const later = events.filter((e) => e.id > sub.id && e.side === sub.side && e.player === sub.playerOff);
        assert.equal(later.length, 0, `seed ${s}: ${sub.playerOff} acted after being substituted`);
      }
    }
    assert.ok(subsSeen > 0, 'expected some substitutions across seeds');
  });

  test('at most five substitutions per team', () => {
    for (const s of SEEDS) {
      const { events } = mm.generateMatch({ seed: s });
      for (const side of ['home', 'away']) assert.ok(events.filter((e) => e.type === 'substitution' && e.side === side).length <= 5);
    }
  });

  test('averages look like real football over many matches', () => {
    let goals = 0, shots = 0;
    for (let s = 1; s <= 100; s++) {
      const m = mm.generateMatch({ seed: s });
      const st = mm.teamStats(m);
      goals += st.home.goals + st.away.goals;
      shots += st.home.shots + st.away.shots;
    }
    assert.ok(goals / 100 > 1.8 && goals / 100 < 4.2, `avg goals ${goals / 100}`);
    assert.ok(shots / 100 > 18 && shots / 100 < 34, `avg shots ${shots / 100}`);
  });
});

describe('xG model', () => {
  test('closer shots are worth more', () => assert.ok(mm.shotXg(6, 45) > mm.shotXg(25, 45)));
  test('wider angle is worth more', () => assert.ok(mm.shotXg(12, 70) > mm.shotXg(12, 15)));
  test('headers are worth less than shots from the same spot', () => assert.ok(mm.shotXg(10, 50, true) < mm.shotXg(10, 50)));
  test('always between 0.01 and 0.95', () => {
    for (const d of [0, 5, 40, 100]) for (const a of [0, 90]) {
      const x = mm.shotXg(d, a);
      assert.ok(x >= 0.01 && x <= 0.95);
    }
  });
});

describe('win probability', () => {
  test('probabilities sum to 1', () => {
    const p = mm.winProbability({ homeGoals: 1, awayGoals: 0, minute: 60 });
    assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.005);
  });
  test('at full time the result is certain', () => {
    assert.deepEqual(mm.winProbability({ homeGoals: 2, awayGoals: 1, minute: 90 }), { home: 1, draw: 0, away: 0 });
    assert.deepEqual(mm.winProbability({ homeGoals: 1, awayGoals: 1, minute: 90 }), { home: 0, draw: 1, away: 0 });
  });
  test('leading later is safer than leading earlier', () => {
    const early = mm.winProbability({ homeGoals: 1, awayGoals: 0, minute: 10 }).home;
    const late = mm.winProbability({ homeGoals: 1, awayGoals: 0, minute: 85 }).home;
    assert.ok(late > early);
  });
  test('a red card hurts the penalised team', () => {
    const even = mm.winProbability({ homeGoals: 0, awayGoals: 0, minute: 30 }).home;
    const tenMen = mm.winProbability({ homeGoals: 0, awayGoals: 0, minute: 30, homeReds: 1 }).home;
    assert.ok(tenMen < even);
  });
  test('stronger team is favoured at kickoff', () => {
    const p = mm.winProbability({ homeGoals: 0, awayGoals: 0, minute: 0, homeRating: 85, awayRating: 70 });
    assert.ok(p.home > p.away);
  });
  test('timeline has 91 points ending in the real result', () => {
    const m = mm.generateMatch({ seed: 7 });
    const tl = mm.winProbabilityTimeline(m);
    assert.equal(tl.length, 91);
    const ft = m.events.at(-1).score;
    const winner = ft.home > ft.away ? 'home' : ft.away > ft.home ? 'away' : 'draw';
    assert.equal(tl[90][winner], 1);
  });
});

describe('analyzer', () => {
  const m = mm.generateMatch({ seed: 7 });
  const a = mm.analyzeMatch(m);

  test('possession adds up to ~100%', () => {
    assert.ok(Math.abs(a.stats.home.possession + a.stats.away.possession - 100) <= 1);
  });
  test('shots on target never exceed shots', () => {
    for (const s of SEEDS) {
      const st = mm.teamStats(mm.generateMatch({ seed: s }));
      for (const side of ['home', 'away']) assert.ok(st[side].onTarget <= st[side].shots);
    }
  });
  test('every key moment explains itself', () => {
    for (const s of SEEDS) {
      for (const k of mm.keyMoments(mm.generateMatch({ seed: s }))) {
        assert.ok(k.why.length > 20);
        assert.match(k.why, /win probability/);
        assert.ok(k.swing >= 0 && k.swing <= 1);
      }
    }
  });
  test('key moments are sorted by impact', () => {
    for (let i = 1; i < a.keyMoments.length; i++) assert.ok(a.keyMoments[i - 1].swing >= a.keyMoments[i].swing);
  });
  test('momentum covers six 15-minute windows', () => {
    assert.equal(a.momentum.length, 6);
    for (const w of a.momentum) assert.ok(['home', 'away', 'even'].includes(w.dominant));
  });
  test('every tactical pattern carries evidence', () => {
    for (const s of SEEDS) for (const p of mm.tacticalPatterns(mm.generateMatch({ seed: s }))) {
      assert.ok(p.evidence && Object.keys(p.evidence).length > 0);
      assert.ok(p.text.length > 0);
    }
  });
  test('player of the match is a real participant', () => {
    const names = [...m.home.players, ...m.home.bench, ...m.away.players, ...m.away.bench].map((p) => p.name);
    assert.ok(names.includes(a.playerOfTheMatch.name));
  });
  test('possessive grammar handles names ending in s', () => {
    const anyWhy = SEEDS.flatMap((s) => mm.keyMoments(mm.generateMatch({ seed: s })).map((k) => k.why)).join(' ');
    assert.doesNotMatch(anyWhy, /s's /);
  });
});

describe('narrator', () => {
  const m = mm.generateMatch({ seed: 7 });

  test('commentary includes every goal', () => {
    const goals = m.events.filter((e) => e.type === 'goal').length;
    assert.equal(mm.commentary(m).filter((c) => c.type === 'goal').length, goals);
  });
  test('no unfilled {placeholders} in any language', () => {
    for (const lang of mm.LANGUAGES) for (const s of SEEDS) {
      const all = mm.commentary(mm.generateMatch({ seed: s }), lang).map((c) => c.text).join(' ') + mm.recap(mm.generateMatch({ seed: s }), { lang });
      assert.doesNotMatch(all, /\{\w+\}/, `${lang} seed ${s}`);
    }
  });
  test('commentary is translated', () => {
    assert.notEqual(mm.commentary(m, 'en')[0].text, mm.commentary(m, 'es')[0].text);
    assert.match(mm.commentary(m, 'fr')[0].text, /C'est parti/);
  });
  test('unsupported language throws', () => {
    assert.throws(() => mm.commentary(m, 'xx'), /Unsupported language/);
  });
  test('stoppage time shows as 90+N', () => {
    assert.equal(mm.formatMinute(94), '90+4');
    assert.equal(mm.formatMinute(45), '45');
  });
  test('live stream yields the same lines as commentary', async () => {
    const lines = [];
    for await (const c of mm.liveStream(m)) lines.push(c.text);
    assert.deepEqual(lines, mm.commentary(m).map((c) => c.text));
  });
  test('broadcast recap names the winner and the final score', () => {
    const ft = m.events.at(-1).score;
    const r = mm.recap(m);
    assert.match(r, new RegExp(`${Math.max(ft.home, ft.away)}-${Math.min(ft.home, ft.away)}`));
    assert.match(r, /Player of the match/);
  });
  test('recap headline puts the winner score first in every language', () => {
    for (const lang of mm.LANGUAGES) assert.match(mm.headline(m, lang), /2[-:]1/, lang);
  });
  test('recap section labels are translated', () => {
    assert.match(mm.recap(m, { lang: 'de' }), /Tore:/);
    assert.match(mm.recap(m, { lang: 'es' }), /Goles:/);
  });
  test('social recap is short and tagged', () => {
    const r = mm.recap(m, { style: 'social' });
    assert.ok(r.length < 280, `length ${r.length}`);
    assert.match(r, /#MatchMindAI/);
  });
  test('fan recap is personalised and rejects teams that did not play', () => {
    assert.match(mm.recap(m, { style: 'fan', favouriteTeam: m.away.id }), new RegExp(`For ${m.away.name} fans`));
    const other = Object.keys(mm.TEAMS).find((id) => id !== m.home.id && id !== m.away.id);
    assert.throws(() => mm.recap(m, { style: 'fan', favouriteTeam: other }), /did not play/);
  });
  test('highlights include every goal with a valid clip window', () => {
    const h = mm.highlights(m);
    assert.equal(h.filter((x) => x.type === 'goal').length, m.events.filter((e) => e.type === 'goal').length);
    for (const x of h) assert.ok(x.clip.endSec > x.clip.startSec && x.clip.startSec >= 0);
  });
});

describe('dataset export', () => {
  test('one row per event across all matches', () => {
    const rows = mm.generateDataset({ matches: 3, startSeed: 10 });
    const expected = [10, 11, 12].reduce((n, s) => n + mm.generateMatch({ seed: s }).events.length, 0);
    assert.equal(rows.length, expected);
  });
  test('CSV has a header and quotes values with commas', () => {
    const csv = mm.toCsv([{ a: 'x,y', b: 1 }]);
    assert.equal(csv, 'a,b\n"x,y",1');
    assert.equal(mm.toCsv([]), '');
  });
});

describe('Azure OpenAI layer', () => {
  const m = mm.generateMatch({ seed: 7 });

  test('falls back to template when not configured', async () => {
    const r = await mm.polishRecap(m, {}, {});
    assert.equal(r.source, 'template');
    assert.equal(r.text, mm.recap(m));
  });
  test('calls the deployment and returns model text when configured', async () => {
    let calledUrl;
    const fakeFetch = async (url, init) => {
      calledUrl = url;
      assert.equal(init.headers['api-key'], 'k');
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'polished recap' } }] }) };
    };
    const env = { AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com/', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'dep' };
    const r = await mm.polishRecap(m, {}, env, fakeFetch);
    assert.equal(r.source, 'azure-openai');
    assert.equal(r.text, 'polished recap');
    assert.match(calledUrl, /^https:\/\/x\.openai\.azure\.com\/openai\/deployments\/dep\/chat\/completions\?api-version=/);
  });
  test('falls back gracefully on API error', async () => {
    const env = { AZURE_OPENAI_ENDPOINT: 'https://x', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'd' };
    const r = await mm.polishRecap(m, {}, env, async () => ({ ok: false, status: 429 }));
    assert.equal(r.source, 'template');
    assert.match(r.error, /429/);
  });
  test('prompt is grounded and forbids invention', () => {
    const msgs = mm.buildMessages(m, { lang: 'es' });
    assert.match(msgs[0].content, /Never invent/);
    assert.match(msgs[1].content, /"es"/);
    assert.match(msgs[1].content, /keyMoments/);
  });
});

describe('CLI', () => {
  const run = async (args) => { const out = []; await main(args, (l) => out.push(l)); return out.join('\n'); };

  test('parses flags and values', () => {
    assert.deepEqual(parseArgs(['recap', '--lang', 'fr', '--ai']), { cmd: 'recap', opts: { lang: 'fr', ai: true } });
  });
  test('help is shown for unknown commands', async () => assert.match(await run(['nope']), /Usage: matchmind/));
  test('teams lists all teams', async () => assert.equal((await run(['teams'])).split('\n').length, Object.keys(mm.TEAMS).length));
  test('analyze outputs valid JSON', async () => assert.ok(JSON.parse(await run(['analyze', '--seed', '3'])).stats));
  test('dataset jsonl outputs one JSON object per line', async () => {
    const lines = (await run(['dataset', '--matches', '2', '--format', 'jsonl'])).split('\n');
    for (const l of lines) assert.ok(JSON.parse(l).match_id);
  });
  test('demo runs end to end', async () => {
    const out = await run(['demo', '--seed', '7']);
    assert.match(out, /Live feed/);
    assert.match(out, /Win probability/);
    assert.match(out, /Recap/);
  });
});
