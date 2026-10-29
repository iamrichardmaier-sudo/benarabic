// The people of the souq. One entry per agent.
//
//   id          short lowercase name; also their email alias (you+id@…) and image folder (assets/agents/<id>/)
//   home        which building they live in: "library", "post", "qahwa", or a house "h1" … "h12"
//   spouse      id of the agent they share a house with (set it on both)
//   job         what they do. Keep it specific; it is what they follow.
//   personality how they talk and act
//   look        colors for the drawn character until you add their images
//               head: "keffiyeh" | "hijab" | "kufi" | "turban" | "none"
//   lines       optional things they say in the souq (greet / idle / reply)
//   placeholder true for the sample residents below; replace them with your real agents
window.VILLAGE_AGENTS = [
  {
    id: "muse",
    name: "Muse",
    home: "library",
    job: "Librarian. Reads your school websites and keeps everything on the shelves: assignments, due dates, grades, announcements.",
    personality: "Quiet and exact. Always says where a fact came from. Slightly too proud of the card catalog.",
    look: { robe: "#2f5d62", trim: "#d9b26f", head: "turban", headColor: "#e8dcc0", skin: "#b9835c" },
    lines: {
      greet: ["Peace be with you. I have three new due dates.", "Ah, {other}. The shelves are full today."],
      idle: ["Everything is filed by course, then by date.", "I found it on the announcements page, page two.", "Never trust a syllabus without a date on it."],
      reply: ["Noted, and filed.", "I'll check the source."],
    },
  },
  {
    id: "yusuf", placeholder: true, name: "Yusuf", home: "h1",
    job: "Sample resident. Replace me with a real agent.",
    personality: "Cheerful and talkative. Knows every stall owner by name.",
    look: { robe: "#c8693f", trim: "#f2d39a", head: "kufi", headColor: "#f6f0e2", skin: "#a8724c" },
  },
  {
    id: "layla", placeholder: true, name: "Layla", home: "h5",
    job: "Sample resident. Replace me with a real agent.",
    personality: "Organized and direct. Makes lists of her lists.",
    look: { robe: "#3b4a8a", trim: "#e2a93b", head: "hijab", headColor: "#7a3b56", skin: "#c9946c" },
  },
  {
    id: "omar", placeholder: true, name: "Omar", home: "h8", spouse: "mariam",
    job: "Sample resident. Replace me with a real agent.",
    personality: "Calm, practical, fixes things before anyone notices they broke.",
    look: { robe: "#6b7d3a", trim: "#efe0b8", head: "keffiyeh", headColor: "#efe9dd", skin: "#9c6844" },
  },
  {
    id: "mariam", placeholder: true, name: "Mariam", home: "h8", spouse: "omar",
    job: "Sample resident. Replace me with a real agent.",
    personality: "Warm and curious. Asks the question everyone else forgot.",
    look: { robe: "#b24b5c", trim: "#f3d9a4", head: "hijab", headColor: "#2f7a78", skin: "#b88058" },
  },
];
