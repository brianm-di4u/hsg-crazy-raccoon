// Painted art (Codex paintings over Blender pose block-outs, packed by tools/build-art.mjs): loads only files
// listed in assets/manifest.json with new Image().decode() (works from file://; shared/LESSONS.md "Painted art")
// and hands the renderer lookups that replace the vector drawings in draw.js. ?art=0 keeps the vector art; any
// missing file falls back to vector for that object only.
export async function loadArt(man, app) {
  if (!man || !Object.keys(man).length || /[?&]art=0/.test(location.search)) return null;
  const imgs = {};
  await Promise.all(Object.entries(man).map(([name, m]) => new Promise((res) => {
    const img = new Image();
    img.src = 'assets/' + m.file;
    img.decode().then(() => { imgs[name] = img; }).catch(() => {}).finally(res);
  })));
  const get = (n) => imgs[n] || null;
  const tiles = {};
  for (const [k, n] of Object.entries({ water: 'tile-water', grass: 'tile-grass', sand: 'tile-sand', path: 'tile-path', board: 'tile-boardwalk', straw: 'tile-straw' })) if (imgs[n]) tiles[k] = imgs[n];
  return {
    tiles,
    get,
    // gator sprite: closed or open painting by jaw state (sleepers keep shut eyes while asleep)
    gator(g) {
      const open = g.k === 'hatchling' ? false : g.jaw === 'open' || (g.jaw === 'closing' && g.ja > 0.5);
      // every other paddler is the darker, scarred swimmer variant so a lane is not a row of clones
      const k = g.k === 'paddler' && g.id % 2 && imgs['gator-swimmer-closed'] ? 'swimmer' : g.k;
      return get(g.k === 'hatchling' ? 'gator-hatchling' : `gator-${k}-${open ? 'open' : 'closed'}`) || get(`gator-paddler-${open ? 'open' : 'closed'}`);
    },
    raccoon(facing, hopping) {
      const f = facing === 'right' ? 'left' : facing;
      // heading up-screen: the three-quarter rear view that shows his mask, when painted
      return (f === 'up' && get(`raccoon-up3-${hopping ? 'hop' : 'stand'}`)) || get(`raccoon-${f}-${hopping ? 'hop' : 'stand'}`);
    },
    item: (k) => get('item-' + k),
    prop: (k) => get('prop-' + k),
    backdrop: (theme) => get('backdrop-' + (theme === 'night' ? 'night' : theme === 'barn' ? 'barn' : 'day')),
    title: get('title-keyart'),
  };
}
