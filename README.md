# ⚽ MatchMind AI

**Explainable football match intelligence from synthetic data.**
Built for *Inside the Game: Developer Hackathon* (Microsoft + Premier League), using GitHub Copilot CLI.

MatchMind AI turns a stream of football-realistic, fully synthetic match events into:

| Capability | What it gives you | Hackathon goal |
|---|---|---|
| **Live feed** | Minute-by-minute commentary as the match "plays" | Analyze match events in real time |
| **Win probability** | Home/draw/away chances after every minute | Explain key moments |
| **Key moments** | Goals and red cards ranked by how much they swung the result, each with a plain-language *why* | Explain key moments |
| **Tactical read** | Detected patterns (clinical/wasteful finishing, possession control, counter-attack wins, goalkeeper heroics, discipline, late pressure), each with its evidence | Tactical patterns |
| **Recaps** | Broadcast script, social post, or personalised fan recap | Stories, highlights, recaps; personalised experiences |
| **Highlights** | Ranked reel with clip start/end timestamps | Highlights for studio/streaming |
| **5 languages** | English, Spanish, French, Portuguese, German | Fans around the world |
| **Dataset export** | Thousands of event rows as CSV/JSONL for Microsoft Fabric | Expand datasets for AI and analytics |
| **Azure OpenAI layer** | Optional polished prose, grounded only in computed facts | Microsoft Foundry / Azure AI |

**Explainability is the core idea:** every insight carries the numbers behind it, and the AI layer is only allowed to write from those numbers.

## Quick start

Requires Node.js 22+. No dependencies to install.

```bash
npm test                                  # 52 tests
node src/cli.js demo                      # full showcase
node src/cli.js live --lang es --delay 300
node src/cli.js recap --fan RVR           # personalised for Riverside Rovers fans
node src/cli.js recap --style social --lang pt
node src/cli.js highlights --seed 7
node src/cli.js analyze --seed 7          # JSON for dashboards/APIs
node src/cli.js dataset --matches 100 > data.csv
node src/cli.js teams
npm run dashboard                         # builds web/dashboard.html (open it in a browser)
```

### Dashboard

`web/dashboard.html` is a single self-contained page built from the engine's output: KPI tiles, a shot-map replay synced to events, key team metrics, a win-probability chart, an event timeline with highlight clips, momentum, tactical patterns with evidence, player of the match, recaps (broadcast, fan, social) and a live commentary replay, all in five languages. Rebuild it with your own seeds: `node scripts/build-dashboard.js 7 12 21`.

Shot positions on the pitch are reconstructed from each shot's distance and angle, since the generator does not produce tracking coordinates.

Options for any match command: `--seed N` (same seed = same match), `--home ID`, `--away ID`.

### Turning on Azure OpenAI (optional)

Copy `.env.example`, fill in your Azure OpenAI (Microsoft Foundry) endpoint, key and deployment name, export them, then:

```bash
node src/cli.js recap --ai --lang fr
```

Without these settings, `--ai` falls back to the template recap and says so. Keys are read only from environment variables.

## How it works

```
generator.js  ->  events  ->  analyzer.js  ->  facts + evidence  ->  narrator.js  ->  commentary / recaps / highlights
 (seeded,          (JSON)     (xG, win prob,                         (templates in      \
  synthetic)                   key moments,                           5 languages)       -> llm.js (Azure OpenAI,
                               patterns, POTM)                                              grounded in facts only)
```

- **Synthetic data:** four fictional teams and squads (`src/data/teams.js`). No real clubs or players. A seeded generator makes every match reproducible; over many matches it averages about 3 goals and 26 shots, close to real top-flight football.
- **xG:** logistic model of shot distance, angle and headers.
- **Win probability:** Poisson model of remaining goals, adjusted for team rating, home advantage and red cards.
- **Key moments:** each goal/red card scored by the change in win probability it caused.
- **Player of the match:** transparent points (goals, assists, saves by xG prevented, progressive passes, cards, result).

### Known limits

- In template mode, recap headings and commentary are fully translated, but the detailed key-moment and tactical sentences are English. The `--ai` mode writes the whole recap in the chosen language.
- Possession is approximated from the share of attacking actions, not passing time.

## Project layout

```
src/
  generator.js   synthetic match engine + xG model
  analyzer.js    stats, win probability, key moments, momentum, patterns, POTM
  narrator.js    commentary, live stream, recaps, highlights
  i18n.js        language templates
  llm.js         Azure OpenAI layer (optional)
  cli.js         command line interface
  tests/         node:test suite
scripts/build-dashboard.js        bakes match data into the dashboard
web/template.html, web/dashboard.html
.github/
  ISSUE_TEMPLATE/feature_request.md
  agents/match-analyst.md        custom Copilot CLI agent
  workflows/test.yml             CI
docs/COPILOT-CLI-PLAYBOOK.md     how to build/extend this with Copilot CLI, step by step
samples/                          example outputs and a 20-match dataset
```

## Ideas for the next iterations

See `docs/COPILOT-CLI-PLAYBOOK.md` → Step 5 for ready-to-paste Copilot CLI prompts: an HTTP API on Azure Container Apps, Fabric ingestion, Azure AI Speech audio commentary, and a web dashboard.

## License

MIT. All match data is synthetic.
