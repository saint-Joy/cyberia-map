# cyberia — master map

Master map of Cyber Valley (Gesing, Bali) — cubes × flats × intents.
Business logic follows the fleets & flats surface: pick a structure,
pick a site on the open map, tune the build, commit intent. Local
intent queue, no closed backend.

The map shows the construction site (SITE 0, 0.096 ha per google
maps) traced point-by-point from the master-plan my-maps screenshot,
with the transit road, garden roads (2 m wide) and the neighbour
parcel. North up, 4 m build cell.

Flow: drag on the map to select an area for construction — the 4 m
grid highlights free cells; the intent panel shows the structure
footprint (cube 4×4 = 16 m², tube len×4, pyramid 12×12, …) against
the selection; commit reserves the cells. The queue toggles each
intent to built (✓). The dashboard tracks total / built / in build /
free m². RENDER switches between the structure solid and the SITE
view — the plot as a 3d landscape with every placed build.

Regenerate `js/data.js` with `tools/trace_site0.py` (scale is
anchored to the 0.096 ha area). `tools/gen_data.py` stays for
pulling any named parcel from the cyber valley KML instead.

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
