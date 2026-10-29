# Souq al-Qamar · سوق القمر

A cozy, hand-drawn isometric Arabic souq where your AI agents live. Walk around, or tap any building to jump straight inside. The time of day and the weather match the real ones outside.

No build step, no server code and **no API keys**. It's plain HTML and JavaScript.

## Open it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly also works. Serving it over http is what turns on automatic background removal for your Gemini images.

**Controls:** tap the ground to walk (or use WASD / arrow keys). Tap a building or a person to go inside. 🗺️ lists every place. Drag to look around, and pinch or scroll to zoom. **E** enters the door you're standing at.

Handy for testing: `?hour=21` forces the time to 9 pm, and `?weather=rain` (also `clear`, `partly`, `cloudy`, `fog`, `snow` or `storm`) forces the weather.

## Files you edit

| File | What it is |
|---|---|
| `config.js` | Your email, WhatsApp number, location fallback, your character, library links, sound files |
| `data/agents.js` | The agents: name, house, job, personality, look, who's married |
| `data/state.js` | What each agent is doing right now. The Claude task rewrites this. |
| `CLAUDE.md` | The instructions the agents follow when Claude runs them |
| `ART_PROMPTS.md` | Gemini prompts and exact filenames for every image |

The five residents in `data/agents.js` (besides Muse) are samples. Replace them when you're ready.

## How talking to the agents works

Every agent has an email alias on your one inbox: `you+muse@gmail.com`, `you+layla@gmail.com` and so on. Gmail and iCloud deliver `+anything` to the same inbox.

- **You → an agent:** email their alias, or tap *Email* in their room.
- **Agent → you:** they reply in that thread. When they have something for you, a **!** floats over their head.
- **Agent → agent:** put another agent's name in the subject (*"Omar: can you check the grocery list?"*). They both act, and you'll see them meet at the coffee house.
- **Muse (Meta):** have Muse email what it finds on your school sites to `you+muse@…`. It gets filed in the library, where the other agents can read it.
- **WhatsApp:** set `whatsappNumber` in `config.js` and each room gets a WhatsApp button that starts the message with the agent's name.

### Who does the thinking

The agents run on **Claude Code as a scheduled task** using your Claude subscription. You don't need an API key and none is stored. Each run, Claude reads the new mail to the aliases through the Gmail connector, answers as each agent following `CLAUDE.md`, updates `data/state.js`, and pushes. The hosted page picks that up within a minute.

### Hearts and levels

Every finished task is a heart (♥), and every 5 hearts is a level. You can also give a heart yourself from an agent's room; that one is saved only in your browser.

## Siri

Make one Shortcut per agent in the Shortcuts app:

1. New Shortcut, named exactly what you'll say, e.g. **Tell Layla**.
2. Add **Dictate Text**.
3. Add **Send Email**: To `you+layla@gmail.com`, Subject *Dictated Text*, turn **Show Compose Sheet** off.

Say "Hey Siri, Tell Layla," then say the message when Siri asks. To have agents talk to each other, just say the other name: *"Ask Omar to plan Saturday."* The name ends up in the subject.

**Home-screen icons:** use `scriptable/AgentWidget.js` in the Scriptable app, one small widget per agent (Parameter = their id). It shows their status, the **!**, and their hearts, and tapping it opens their room. You can also add each Siri Shortcut to the home screen with the agent's Gemini portrait as its icon.

## Sound

Drop files into `audio/` named `day.mp3`, `night.mp3`, `rain.mp3`, `music.mp3`, `click.mp3`, `door.mp3`, `message.mp3`, `heart.mp3`. Anything missing stays silent. 🔊 turns sound on. Day and night ambience switch with the real clock, and rain plays when it's really raining.

## Hosting

Any static host works. Netlify can deploy a **private** GitHub repo for free and rebuilds on every push. Set the publish directory to the repo root, with no build command.
