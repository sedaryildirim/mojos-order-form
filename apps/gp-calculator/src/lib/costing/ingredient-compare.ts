// Groups "Parsley", "Parsley 100 g" and "Parsley (bunch)" together so the same item from
// different suppliers can be compared. Drops sizes, pack multipliers and bracketed notes.
export function comparableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(kg|g|ml|l|pcs|pc)\b/g, " ")
    .replace(/\bx\s*\d+\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
