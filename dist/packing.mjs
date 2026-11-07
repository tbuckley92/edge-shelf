// All measurements are centimetres. Fit each consecutive piece without shrinking it.
function packShelves(ids, catalog) {
  const rows = [];
  let row = { items: [], width: 0, height: 0 };
  for (const id of ids) {
    const p = catalog.get(id);
    if (!p || !(p.w > 0 && p.h > 0) || p.w > 100) continue;
    const gap = row.items.length ? 3 : 0;
    if (row.width + gap + p.w > 100) {
      rows.push(row);
      row = { items: [], width: 0, height: 0 };
    }
    const space = row.items.length ? 3 : 0;
    row.items.push({ id, x: row.width + space });
    row.width += space + p.w;
    row.height = Math.max(row.height, p.h);
  }
  if (row.items.length) rows.push(row);
  for (const r of rows) {
    const offset = (100 - r.width) / 2;
    r.items.forEach(item => item.x += offset);
    r.clearance = r.height + 10;
  }
  return rows;
}

export {packShelves};
