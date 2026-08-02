import type { Concept } from './types'

const concept: Concept = {
  slug: 'geospatial-indexing',
  title: 'Geospatial Indexing',
  number: 47,
  category: 'Other Essentials',
  icon: 'pi pi-map-marker',
  summary: 'Geohash, H3, Redis Geo - answering "what is near this point" without scanning every row.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'usedIn',
      items: ['Uber (H3)', 'Google Maps', 'Yelp', 'Redis GEO commands'],
    },
    {
      type: 'paragraph',
      text:
        'A plain "find all rows within X km of this point" query against raw lat/lng columns has no good index to use. A B-tree index on latitude or longitude alone only helps with a range on that one dimension - it cannot answer a 2D radius question, so the naive approach degenerates into scanning every row and computing distance for each one. Geospatial indexing exists to turn "search a 2D area" into "search a small, indexable set of buckets."',
    },
    {
      type: 'table',
      caption: 'Approaches',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['Geohash', 'Encodes a (lat, lng) pair into a single base-32 string where common prefixes mean spatial proximity, so a normal sorted index / string prefix search finds nearby points.', 'Simple, works with a plain sorted index, and is human-shareable - but has awkward edge cases at grid boundaries where two points can be physically adjacent yet have geohash strings that differ in every character, putting them far apart alphabetically.'],
        ['Quadtree', 'Recursively divides space into four quadrants, subdividing further wherever point density is high.', 'Adapts well to uneven density (dense cities get finer cells, empty ocean does not), but is a tree structure to build and maintain rather than a value you can drop into an existing index.'],
        ["Uber's H3", 'A hexagonal global grid with equal-area cells at multiple resolutions, plus clean neighbor-lookup functions.', 'No pole distortion (unlike lat/lng-based grids), hexagons have uniform adjacency (all neighbors equidistant, unlike a square grid\'s corner-vs-edge neighbors) - the modern default for ride-hailing and delivery ETAs.'],
        ['Redis GEO commands', 'Built-in geohash-based commands (GEOADD, GEORADIUS/GEOSEARCH) that store points in a sorted set and query nearby ones directly.', 'Fastest to ship - no separate geospatial library or service - but inherits geohash\'s boundary quirks and is meant for small-to-medium scale, not Uber-level precision.'],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'The boundary problem',
      text:
        'A genuinely nearby point can sit in an adjacent grid cell rather than the exact cell containing the query point - two houses across a street from each other can hash into completely different cells if that street happens to fall on a grid boundary. A correct radius search must therefore check the query cell AND its immediate neighbor cells, not just the one cell the query point falls into, or it will silently miss real nearby results.',
    },
    {
      type: 'callout',
      kind: 'tip',
      text:
        'Default to H3 for anything ride-hailing or delivery-shaped - its equal-area hexagonal cells and clean neighbor semantics make "find nearby drivers" and "which zone is this" both simple and precise. Reach for Redis GEO commands when you just need a quick "nearby search" feature (store listings, check-ins) that does not need to scale to Uber-level precision - it is far less work to stand up.',
    },
  ],
  relatedConcepts: ['caching', 'sharding'],
}

export default concept
