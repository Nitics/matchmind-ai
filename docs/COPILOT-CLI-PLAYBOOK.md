# MatchMind AI — Copilot CLI Playbook

This follows the same four steps as the GitHub Skills exercise *Create applications with the Copilot CLI*, applied to the hackathon project. Each step has the exact prompts to paste into Copilot CLI.

The code in this repo is already a working result of these steps. Use the playbook to (a) rebuild it yourself in your own repo so the Copilot CLI history is yours, or (b) extend it in Step 5.

---

## Step 0 — Set up

In a Codespace or local terminal (Node 22+, npm 10+):

```bash
npm install -g @github/copilot
copilot --version
```

Create a new GitHub repo called `matchmind-ai`, clone it, and copy this project's files in (or start empty and let Copilot build it). Then:

```bash
copilot --allow-all --enable-all-github-mcp-tools
```

Inside the session, run `/login` if needed.

---

## Step 1 — Create the core feature issue

```
Create a GitHub issue for MatchMind AI, a Node.js CLI football match-intelligence app,
using the .github/ISSUE_TEMPLATE/feature_request.md template in markdown format.
Title must contain "MatchMind".
I want to request the core engine:
- a seeded synthetic match generator with fictional teams (src/generator.js)
- an expected-goals (xG) model based on shot distance and angle
- explainable analysis: team stats, win probability, key moments with a "why" (src/analyzer.js)
- live commentary and an automated match recap (src/narrator.js)
Create the issue directly in the current owner and repository on github.com using gh CLI.
List the issue link when complete.
```

---

## Step 2 — Build the core on a branch

```
Create and push a new branch called 'create-matchmind-core'
```

```
Build the MatchMind AI core described in the latest issue in this owner/repository.
Put the code in the 'src' directory. Comment each file with the operations it supports.
All teams and players must be fictional. The same seed must always produce the same match.
```

Run it:

```
Run node src/cli.js demo --seed 7 and explain the key moments it found.
```

Tests:

```
Create comprehensive unit tests in src/tests/matchmind.test.js using Node's built-in node:test:
- generator is deterministic and the final score matches the goal events
- xG is higher for closer and more central shots
- win probabilities sum to 1 and are certain at full time
- every key moment has an explanation
- edge cases: unknown team, a team playing itself, sent-off players acting again
Make sure all tests run and pass.
```

Commit:

```
Add all source and test files to git.
Commit with message "Implement MatchMind core: generator, xG, analyzer, commentary, recap"
Push the changes
```

---

## Step 3 — Expand: languages, fans, highlights, AI

```
Create a GitHub issue using the feature_request.md template for MatchMind AI expansion:
- commentary and recaps in English, Spanish, French, Portuguese and German
- personalised fan recaps for a chosen team
- social-media recap and highlight reel with clip timestamps
- dataset export (CSV/JSONL) for Microsoft Fabric
- optional Azure OpenAI recap that only uses computed facts
Create it with gh CLI and list the link.
```

```
Implement the latest issue. Put templates in src/i18n.js, recap styles and highlights in
src/narrator.js, dataset export in src/index.js, and the Azure OpenAI call in src/llm.js.
Read Azure settings only from environment variables and fall back to the template recap
when they are missing or the call fails.
```

```
Add tests for the new features to src/tests/matchmind.test.js:
- no unfilled {placeholders} in any language
- fan recap rejects a team that did not play
- social recap is under 280 characters
- Azure layer: fallback when unconfigured, correct URL when configured (use a fake fetch), fallback on HTTP 429
Make sure all tests run and pass.
```

```
Add all files to git. Commit with message "Add multilingual commentary, fan recaps, highlights, dataset export and Azure OpenAI layer". Push the changes.
```

Tip: use the custom agent in `.github/agents/match-analyst.md` with `/agent match-analyst` for analysis work.

---

## Step 4 — Pull request, Copilot review, merge

```
Create a pull request from the current branch titled "MatchMind AI: core engine and expansion"
describing the main changes. Add @copilot as a reviewer and request a review.
List the PR link when it is created.
```

```
Link the pull request to both MatchMind issues so they close automatically when merged.
```

After reviewing Copilot's comments:

```
Address any valid Copilot review comments, push the fixes, then squash-merge the pull request
and confirm both issues are closed.
```

Save the session for your submission write-up: `/share gist`.

---

## Step 5 — Hackathon extensions (pick what fits your time)

**HTTP API on Azure**
```
Add a zero-dependency HTTP server in src/server.js exposing GET /match/:seed/analysis,
/match/:seed/recap?lang=&style=&fan=, /match/:seed/highlights and a Server-Sent Events
endpoint /match/:seed/live. Add a Dockerfile and instructions to deploy to Azure Container Apps.
Add tests that start the server on a random port.
```

**Microsoft Fabric**
```
Write docs/FABRIC.md explaining how to load the CSV from `node src/cli.js dataset --matches 500`
into a Fabric lakehouse, and include three example SQL queries: xG vs goals by team,
goals by 15-minute window, and cards per match.
```

**Audio commentary**
```
Add src/speech.js that sends commentary lines to Azure AI Speech text-to-speech
(settings from environment variables) and saves an MP3 per goal. Fall back gracefully when unconfigured.
```

**Fan dashboard**
```
Build a single-page web dashboard in web/index.html that calls the HTTP API and shows the
live feed, a win-probability line chart, key moments with explanations, and a language picker.
```

---

## Submission checklist (deadline: Oct 27, 2026, 11:59 PM PT)

- [ ] Public GitHub repo with README, tests passing in CI
- [ ] Short demo video: `demo`, `live --lang es`, `recap --fan`, `recap --ai`
- [ ] Explain the explainability story: every insight shows its evidence
- [ ] List the Microsoft services used (GitHub Copilot CLI, Azure OpenAI/Foundry, and any of Fabric, Container Apps, AI Speech)
- [ ] Check the official rules at https://aka.ms/insidethegame/rules for required submission fields
