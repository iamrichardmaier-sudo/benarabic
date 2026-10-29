# Art for the souq (Gemini, by hand)

The village already draws everything itself. Each image you save replaces one drawn piece. You can do them in any order and stop whenever you like.

## How to make each image

1. In Gemini, paste the **style block** first, then the prompt for one image.
2. When you get one you love, keep that chat open and attach it to later prompts: *"Match the style of this image exactly."* That keeps the whole souq consistent.
3. Download it and save it as **PNG** at exactly the path shown, inside `assets/`.
4. Reload the page. If it sits a little off, nudge it in `config.js` → `assetTweaks`, e.g. `"places/library": { "scale": 1.05, "dy": 6 }`.

Images on a **pure magenta background** get the background removed automatically. (This needs the page served over http; see the README.)

## Style block (paste before every prompt)

> Cozy hand-drawn isometric illustration for a game. Warm ink linework with soft watercolor and gouache texture. True 2:1 game isometric angle, seen from the front corner, light from the upper left. Setting: a small Arabic souq. Sand-colored plaster walls, terracotta, teal and indigo accents, brass lanterns, striped canvas awnings, carved wooden mashrabiya screens, arched doors and windows, blue zellij tile bands. One single object, centered, the whole object visible, nothing cut off. No ground beyond the object's own footprint, no text, no people, no border. Background: flat solid pure magenta #FF00FF, no gradient, no shadow on the background.

## Buildings (`assets/places/`)

| Save as | Prompt |
|---|---|
| `places/library.png` | A grand old library on a wide 7×6 tile footprint. Large teal tiled dome on a drum with small windows, a slim reading tower with its own small dome at the back corner, a row of tall arched windows, a big teal double door with brass studs and a plaque above it, two lanterns by the door, crenellated roof edge, blue tile band. |
| `places/post.png` | A small post office on a 5×4 footprint. Blue door, blue-and-white striped awning, arched windows, a wooden pigeon loft with pigeons on the flat roof, a blue mailbox beside the door. |
| `places/qahwa.png` | A coffee house on a 5×4 footprint. The front wall is an open arcade of three arches glowing warm inside, red-white-teal striped awning, hanging brass lanterns, a small rose-pink dome, a chimney. |
| `places/house-1.png` | A one-story house on a 3×3 footprint. Cream plaster, flat roof with a low parapet, clay water jar on the roof, arched teal door, two small arched windows with flower boxes. |
| `places/house-2.png` | A two-story house on a 3×3 footprint. Warm sand plaster, a carved wooden mashrabiya balcony on the upper floor, terracotta door, laundry line on the roof. |
| `places/house-3.png` | A one-story house on a 3×3 footprint. Pale peach plaster, small teal dome on the roof, striped awning over an indigo door, potted plants. |
| `places/house-4.png` | A two-story house on a 3×3 footprint. Light ochre plaster, rose trim band under the roof, small arched windows on both floors, potted palm on the roof. |

A specific house can have its own picture: save it as `places/h3.png` (any id from `h1` to `h12`). It wins over the shared `house-*` picture.

## Souq pieces (`assets/decor/`)

| Save as | Prompt |
|---|---|
| `decor/fountain.png` | A round stone fountain on a 3×3 footprint, zellij tile band around the basin, central pillar with a small bowl, clear blue water. |
| `decor/palm.png` | A single date palm, slightly leaning, with date clusters. Footprint 1 tile. |
| `decor/lantern.png` | A tall iron lamp post with a brass Moroccan lantern hanging from an arm. Footprint 1 tile. |
| `decor/stall-spice.png` | A small wooden market stall, 1 tile, with cones of colorful spices and a striped awning. |
| `decor/stall-pots.png` | The same stall with clay pots and jugs. |
| `decor/stall-cloth.png` | The same stall with folded rolls of patterned cloth. |
| `decor/stall-lamps.png` | The same stall with brass lamps and colored glass lanterns. |
| `decor/jars.png` | Three large clay jars grouped together. |
| `decor/well.png` | A small round stone well with a wooden frame and a bucket. |

## People (`assets/agents/<id>/` and `assets/avatar/`)

Use this character block in place of the style block's object lines:

> Cozy hand-drawn character for an isometric game, ink and watercolor, full body, standing, facing toward the lower right, about 3 heads tall, simple friendly face. Flat solid pure magenta #FF00FF background, nothing else.

For each agent, keep one chat and make three images so they match:

| Save as | Prompt (add the agent's look) |
|---|---|
| `agents/<id>/idle.png` | Standing relaxed. *e.g. "Muse, a quiet librarian in a deep teal robe with gold trim and a cream turban."* |
| `agents/<id>/working.png` | Same character, holding a scroll and a pen, busy. |
| `agents/<id>/portrait.png` | Same character, head and shoulders, smiling, on a warm parchment background (no magenta). Used in rooms and on the home-screen widget. |
| `avatar/idle.png` | You. Describe yourself. |

## Rooms (`assets/rooms/`)

16:9, no magenta needed. These fill the picture at the top of the room panel. The residents are drawn on top of it.

| Save as | Prompt |
|---|---|
| `rooms/library.png` | Inside a cozy library, isometric room corner, tall bookshelves on both walls, a ladder, a wooden desk with stacks of books, an arched window, a hanging brass lamp, a red-and-gold rug. Leave open floor in the middle. |
| `rooms/post.png` | Inside a small post office, wall of wooden pigeonholes, a blue counter, parcels tied with string. |
| `rooms/qahwa.png` | Inside a coffee house, a counter with brass dallah coffee pots, cushions, hanging lanterns. |
| `rooms/house.png` | Inside a cozy home, low majlis cushions along the wall, a small round tea table, shelves, an arched window. Used for every house unless you make `rooms/h3.png` etc. |
