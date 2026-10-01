interface ComparableLine {
  ingredientId: string;
  ingredientNameSnapshot: string;
  quantity: string;
  unit: string;
}

export interface DiffLine {
  ingredientName: string;
  status: "added" | "removed" | "changed" | "unchanged";
  oldQuantity?: string;
  newQuantity?: string;
  unit?: string;
}

export function diffVersionLines(oldLines: ComparableLine[], newLines: ComparableLine[]): DiffLine[] {
  // Group lines per ingredient into arrays rather than a single Map entry —
  // a dish can legally have the same ingredient on multiple lines (e.g.
  // "Onions" diced and "Onions" whole), so keying by ingredientId alone
  // would let a later line for the same ingredient silently overwrite an
  // earlier one, dropping it from the diff entirely.
  const byIngredient = new Map<string, { old: ComparableLine[]; new: ComparableLine[] }>();

  function bucket(ingredientId: string) {
    let entry = byIngredient.get(ingredientId);
    if (!entry) {
      entry = { old: [], new: [] };
      byIngredient.set(ingredientId, entry);
    }
    return entry;
  }

  for (const line of oldLines) bucket(line.ingredientId).old.push(line);
  for (const line of newLines) bucket(line.ingredientId).new.push(line);

  const diffs: DiffLine[] = [];
  for (const { old: oldGroup, new: newGroup } of Array.from(byIngredient.values())) {
    // Pair old/new lines for the same ingredient by position within that
    // ingredient's group (not by ingredient id alone), so extra lines on
    // either side are reported as added/removed instead of vanishing.
    const pairCount = Math.max(oldGroup.length, newGroup.length);
    for (let i = 0; i < pairCount; i++) {
      const old = oldGroup[i];
      const next = newGroup[i];
      pushDiff(diffs, old, next);
    }
  }
  return diffs;
}

function pushDiff(diffs: DiffLine[], old: ComparableLine | undefined, next: ComparableLine | undefined) {
  if (old && !next) {
    diffs.push({ ingredientName: old.ingredientNameSnapshot, status: "removed", oldQuantity: String(old.quantity), unit: old.unit });
  } else if (!old && next) {
    diffs.push({ ingredientName: next.ingredientNameSnapshot, status: "added", newQuantity: String(next.quantity), unit: next.unit });
  } else if (old && next) {
    // NOTE: quantity is typed `string` here, but the real caller (the compare
    // page) passes Prisma DishVersion.lines rows straight through, where
    // `quantity` is a `@db.Decimal` field materialized as a live Decimal
    // object instance, not a primitive string. Two distinct Decimal objects
    // representing the same numeric value are never `!==`-equal to each
    // other by reference, so comparing the raw field would always report
    // unchanged lines as "changed". Coercing with String() first makes the
    // comparison (and the stored oldQuantity/newQuantity) correct whether
    // the caller passes a plain string or a Decimal-like object.
    const oldQty = String(old.quantity);
    const nextQty = String(next.quantity);
    const changed = oldQty !== nextQty || old.unit !== next.unit;
    diffs.push({
      ingredientName: next.ingredientNameSnapshot,
      status: changed ? "changed" : "unchanged",
      oldQuantity: oldQty,
      newQuantity: nextQty,
      unit: next.unit,
    });
  }
}
