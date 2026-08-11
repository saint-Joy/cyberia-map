// cyberia master map — catalog, flats geometry, defaults
// units: meters in 3d, map grid cell = 4 m

const CATALOG = [
  { id: 'atom',     name: 'ATOM-4',   sub: '4×4×4 multipurpose cell', tag: 'CELL',    status: 'P0', glyph: 'A' },
  { id: 'molecule', name: 'MOLECULE', sub: 'atoms × buffer / tube',   tag: 'CLUSTER', status: 'P0', glyph: 'M' },
  { id: 'tube',     name: 'TUBE',     sub: 'living connector S · M',  tag: 'LINK',    status: 'P0', glyph: 'T' },
  { id: 'prysm',    name: 'PRYSM',    sub: 'half-rhomb triangle',     tag: 'MODULE',  status: 'P1', glyph: 'P' },
  { id: 'pyramid',  name: 'PYRAMID',  sub: 'reception · market · grill', tag: 'HUB',  status: 'P1', glyph: 'Y' },
  { id: 'sphere',   name: 'SPHERE',   sub: 'water store + orangery',  tag: 'CORE',    status: 'P1', glyph: 'S' },
];

const ACTIONS = ['SURVEY', 'CLEAR', 'PLANT', 'HAUL', 'WATCH', 'BUILD'];

const TUBE_CONTENT = [
  'closed pond', 'glass path top', 'vines', 'glass + wood', 'algae bioreactor',
  'herbs', 'berries', 'veggies', 'flowers', 'bees', 'birds', 'rabbits',
  'chicks', 'rainbow python', 'flying fox',
];

const PYRAMID_FN = [
  'reception', 'shop', 'grill', 'cafe', 'organics', 'tools', 'tech',
  'accums', 'chargers', 'delivery', 'post', 'play zone', 'outfit',
  'fabrics', 'leather', 'jewels', 'robots', 'sweets',
];

const PRYSM_MAT = ['wood', 'glass', 'metal'];

// map: viewBox 1000 × 760, cell 25 px = 4 m
const MAP_W = 1000, MAP_H = 760, CELL = 25;

const FLATS = [
  {
    id: 'sinwood', name: 'SINWOOD', color: '#52e05a', fill: 'rgba(46,160,67,0.32)',
    note: 'district · 14 vertices · phase 0',
    pts: [
      [550, 100], [585, 122], [605, 200], [645, 255], [665, 335],
      [645, 420], [600, 480], [520, 518], [430, 458], [368, 396],
      [330, 320], [352, 228], [408, 152], [480, 108],
    ],
  },
  {
    id: 'cofe', name: 'COFE', color: '#e08a3c', fill: 'rgba(160,90,30,0.34)',
    note: 'plantation · 10 vertices · phase 0',
    pts: [
      [108, 322], [330, 320], [368, 396], [430, 458], [520, 518],
      [600, 480], [636, 548], [552, 624], [352, 596], [176, 490],
    ],
  },
];

const PLACES = [
  { name: 'laba',    x: 462, y: 214 },
  { name: 'organja', x: 340, y: 342 },
  { name: 'vitalik', x: 282, y: 472 },
  { name: 'satoshi', x: 596, y: 502 },
  { name: 'soft',    x: 402, y: 548 },
  { name: 'elona',   x: 468, y: 560 },
];

const MY_MAPS_ID = '1hxZIoQKB8vDdmox1HadSal-Zz4kUEJl';

function defaultConfig(id) {
  switch (id) {
    case 'atom':     return { mode: 'unit', pax: 1, purpose: '', walls: [] };
    case 'molecule': return { atoms: [[0, 0, 0], [1, 0, 0]], connector: 'tube' };
    case 'tube':     return { size: 'S', len: 8, content: ['closed pond', 'glass path top'] };
    case 'prysm':    return { h: 2, mat: ['wood', 'glass'], modular: true };
    case 'pyramid':  return { fns: ['reception', 'shop', 'cafe'] };
    case 'sphere':   return { water: true, orangery: true };
    default:         return {};
  }
}
