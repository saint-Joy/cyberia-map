# cyberia — master map

Master map of Cyber Valley (Gesing, Bali) — cubes × flats × intents.
Business logic follows the fleets & flats surface: pick a structure,
pick a site on the open map, tune the build, commit intent. Local
intent queue, no closed backend.

## structures

- cube — 4×4×4 multipurpose cell: unit (1/2-pax), room (purpose = free
  prompt), custom wall grid 1×1×1
- tube — living connector, S 2 m / M 4 m: closed pond, glass path top,
  vines, glass + wood, algae bioreactor, herbs, berries, veggies,
  flowers, bees, birds, rabbits, chicks, rainbow python, flying fox
- prysm — isosceles triangle as half-rhomb, centered; h 2 / 4 m;
  wood, glass, metal; modular yes/no
- pyramid — hub: reception, shop, grill, cafe, organics, tools, tech,
  accums, chargers, delivery, post, play zone, outfit, fabrics,
  leather, jewels, robots, sweets
- sphere — half sphere underground (water storage), orangery above

## stack

Zero dependencies. Plain HTML + CSS + JS, hand-rolled wireframe 3d
(canvas 2d, perspective, auto-orbit). Intents persist in localStorage.

## run

Open `index.html`, or serve the directory with any static server.
