#!/usr/bin/env node
/**
 * MatchMind AI - command line interface
 *
 * Commands:
 *   demo                         full showcase: live feed, analysis, recap
 *   live      [--lang] [--delay] stream match commentary minute by minute
 *   analyze                      explainable stats, key moments, patterns (JSON)
 *   recap     [--lang] [--style broadcast|social|fan] [--fan TEAM] [--ai]
 *   highlights                   highlight reel with clip timestamps
 *   dataset   [--matches N] [--format csv|jsonl]   synthetic data for Fabric/analytics
 *   teams                        list fictional teams
 *
 * Common options: --seed N  --home ID  --away ID
 */

const mm = require('./index');

function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) opts[key] = true;
      else { opts[key] = next; i++; }
    }
  }
  return { cmd, opts };
}

const HELP = `MatchMind AI - explainable football match intelligence

Usage: matchmind <command> [options]

Commands:
  demo         Full showcase (live feed + analysis + recap)
  live         Live commentary feed           --lang en|es|fr|pt|de  --delay ms
  analyze      Explainable analysis as JSON
  recap        Match recap                     --lang  --style broadcast|social|fan  --fan TEAM  --ai
  highlights   Highlight reel with clip timestamps
  dataset      Synthetic event dataset         --matches N  --format csv|jsonl
  teams        List the fictional teams

Options: --seed N  --home TEAM  --away TEAM`;

async function main(argv = process.argv.slice(2), out = console.log) {
  const { cmd, opts } = parseArgs(argv);
  const matchOpts = { seed: opts.seed ? Number(opts.seed) : 42, home: opts.home, away: opts.away };
  const lang = opts.lang || 'en';

  switch (cmd) {
    case 'teams':
      for (const tm of Object.values(mm.TEAMS)) out(`${tm.id}  ${tm.name} (rating ${tm.rating})`);
      return;
    case 'live': {
      const match = mm.generateMatch(matchOpts);
      for await (const c of mm.liveStream(match, { lang, delayMs: Number(opts.delay ?? 250) })) out(`${c.display.padStart(4)}'  ${c.text}`);
      return;
    }
    case 'analyze':
      out(JSON.stringify(mm.analyzeMatch(mm.generateMatch(matchOpts)), null, 2));
      return;
    case 'recap': {
      const match = mm.generateMatch(matchOpts);
      const ropts = { lang, style: opts.style || (opts.fan ? 'fan' : 'broadcast'), favouriteTeam: opts.fan || null };
      if (opts.ai) {
        const r = await mm.polishRecap(match, ropts);
        if (r.error) out(`(AI unavailable: ${r.error} - showing template recap)\n`);
        else if (r.source === 'template') out('(Azure OpenAI not configured - showing template recap)\n');
        out(r.text);
      } else out(mm.recap(match, ropts));
      return;
    }
    case 'highlights': {
      const match = mm.generateMatch(matchOpts);
      for (const h of mm.highlights(match)) {
        const who = h.player ? ` ${h.player} (${match[h.side].short})` : '';
        out(`${mm.formatMinute(h.minute).padStart(4)}'  [${'*'.repeat(h.priority)}] ${h.type}${who}  clip ${h.clip.startSec}s-${h.clip.endSec}s`);
      }
      return;
    }
    case 'dataset': {
      const rows = mm.generateDataset({ matches: Number(opts.matches || 10), startSeed: matchOpts.seed });
      out(opts.format === 'jsonl' ? rows.map((r) => JSON.stringify(r)).join('\n') : mm.toCsv(rows));
      return;
    }
    case 'demo': {
      const match = mm.generateMatch(matchOpts);
      out(`=== MatchMind AI | ${match.home.name} vs ${match.away.name} (seed ${match.seed}) ===\n`);
      out('--- Live feed ---');
      for await (const c of mm.liveStream(match, { lang, delayMs: Number(opts.delay ?? 0) })) out(`${c.display.padStart(4)}'  ${c.text}`);
      out('\n--- Win probability (home/draw/away) ---');
      const tl = mm.winProbabilityTimeline(match);
      for (const m of [0, 30, 45, 60, 75, 90]) {
        const p = tl[m];
        out(`${String(m).padStart(2)}'  ${Math.round(p.home * 100)}% / ${Math.round(p.draw * 100)}% / ${Math.round(p.away * 100)}%`);
      }
      out('\n--- Recap ---');
      out(mm.recap(match, { lang }));
      return;
    }
    default:
      out(HELP);
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(`Error: ${err.message}`); process.exit(1); });
}

module.exports = { main, parseArgs };
