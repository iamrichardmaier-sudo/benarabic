// Souq al-Qamar: one home-screen widget per agent (Scriptable app, iOS).
// 1. Paste this into a new Scriptable script named "Souq Agent".
// 2. Add a Scriptable widget to your home screen, choose this script,
//    and set Parameter to the agent's id (e.g. muse).
// Tapping the widget opens the village straight to that agent's room.

const VILLAGE_URL = "https://YOUR-SITE.netlify.app/"; // where the village is hosted (ends with /)

const id = (args.widgetParameter || "muse").trim().toLowerCase();

async function loadGlobal(path, name) {
  const txt = await new Request(VILLAGE_URL + path + "?t=" + Date.now()).loadString();
  const win = {};
  new Function("window", txt)(win);
  return win[name];
}

const agents = await loadGlobal("data/agents.js", "VILLAGE_AGENTS");
const state = await loadGlobal("data/state.js", "VILLAGE_STATE");
const a = agents.find((x) => x.id === id) || agents[0];
const st = (state.agents || {})[a.id] || {};
const hearts = st.tasksDone || 0;

const w = new ListWidget();
w.backgroundColor = new Color("#fbf1dc");
w.url = VILLAGE_URL + "#agent-" + a.id;
w.setPadding(12, 12, 12, 12);

const top = w.addStack();
top.centerAlignContent();
try {
  const img = await new Request(VILLAGE_URL + "assets/agents/" + a.id + "/portrait.png").loadImage();
  const pic = top.addImage(img);
  pic.imageSize = new Size(40, 40);
  pic.cornerRadius = 20;
  top.addSpacer(8);
} catch (e) {}
const name = top.addText(a.name);
name.font = Font.boldSystemFont(17);
name.textColor = new Color("#4a3226");
if (st.message) {
  top.addSpacer();
  const bang = top.addText("!");
  bang.font = Font.heavySystemFont(20);
  bang.textColor = new Color("#c4566b");
}

w.addSpacer(6);
const status = w.addText(st.status === "working" ? "✎ " + (st.task || "Working") : st.message ? st.messageNote || "Has a message" : "Out in the souq");
status.font = Font.systemFont(13);
status.textColor = new Color("#7a5a45");
status.lineLimit = 2;

w.addSpacer();
const h = w.addText("♥".repeat(hearts % 5) + "♡".repeat(5 - (hearts % 5)) + "  Lv " + (1 + Math.floor(hearts / 5)));
h.font = Font.systemFont(14);
h.textColor = new Color("#c4566b");

w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
