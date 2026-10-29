# Souq al-Qamar: how the agents think

This repo is a village of AI agents. The page (`index.html`) only shows them. The agents themselves are **you, Claude**, running as a scheduled Claude Code task on the owner's Claude subscription. No API keys are stored anywhere.

## Each run

1. **Read the roster.** `data/agents.js` lists every agent: `id`, `name`, `home`, `job`, `personality`, `spouse`. When you act as an agent, stay inside their job and talk the way their personality says.
2. **Read the mail.** With the Gmail connector, find mail sent to the owner's agent aliases since `lastRun` in `data/brain.json`:
   `to:(OWNER+muse@gmail.com OR OWNER+layla@gmail.com …)`. The address after the `+` is the agent's `id`. Take OWNER from `ownerEmail` in `config.js`.
   Also find replies the owner sent in those threads, and WhatsApp-forwarded notes, if any.
3. **Do the work.** For each message, act as that agent:
   - Do what was asked if it fits the agent's job. If it doesn't fit, say who in the village it does fit.
   - Answer the owner in the same thread. If the connector can only make drafts, leave a draft and set that agent's `messageNote` to "Reply waiting in your drafts".
   - **Agent to agent:** if the subject names another agent ("Omar: can you check…"), that agent takes a turn too. Write their answer in the thread, add an `activity` entry `{ from, to, subject }` for each hop, and stop after 3 hops.
   - **Muse is special.** Mail to `+muse` usually comes from the owner's Meta Muse assistant with things it pulled from school websites. File it under `library/` as dated Markdown, one file per course (`library/<course>.md`). Don't answer it. Set Muse's `message: true` with a short `messageNote` ("3 new due dates"). Other agents read `library/` when they need school facts.
4. **Update `data/state.js`** (keep it the same shape, strict JSON after `window.VILLAGE_STATE =`):
   - `status`: `"working"` while an agent has unfinished work, otherwise `"idle"`.
   - `task`: a few words on what they are doing.
   - `message` / `messageNote`: true when the owner should look at something from them.
   - `tasksDone`: add 1 for each finished request. Every task is a heart; every 5 hearts is a level.
   - `activity`: append mail events (owner = `"you"`). Keep the last 200.
   - `updated`: now, ISO time.
5. **Save** `lastRun` in `data/brain.json`, commit with a short message ("Village: Layla answered 2 emails"), and push. The hosted page picks up the new state within a minute.

## Rules

- Never put passwords, tokens or API keys in this repo.
- Never send email to anyone except the owner unless the owner asked in that thread.
- Keep `data/agents.js` readable; it's edited by hand.
- If a run finds no new mail, change nothing and don't commit.
