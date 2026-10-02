// Reads the Kaif Food Bible (a plain text file of recipes) into plain data. No database access here.

export interface BibleRecipe {
  name: string;
  section: string;
  batch: boolean;
  // Lines after the title of a batch such as "Yield: 9 portions x 200g".
  meta: string[];
  lines: string[];
}

export type LineUnit = "G" | "KG" | "ML" | "L" | "EACH";
export interface LineItem {
  phrase: string;
  quantity: number;
  unit: LineUnit;
}
export interface ParsedLine {
  // Alternatives (OR / "choice of"). Each alternative is one or more items used together.
  options: LineItem[][];
  optional: boolean;
  raw: string;
}

const DIVIDER = /^-{5,}$/;

export function parseFoodBible(text: string): BibleRecipe[] {
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));
  const recipes: BibleRecipe[] = [];
  let current: BibleRecipe | null = null;
  let section = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // A section heading sits between two divider lines.
    if (DIVIDER.test(l) && i + 2 < lines.length && DIVIDER.test(lines[i + 2])) {
      section = lines[i + 1].trim();
      i += 2;
      continue;
    }
    if (l.startsWith("- ")) {
      current?.lines.push(l.slice(2).trim());
    } else if (l && !l.startsWith("=") && !l.startsWith("KAIF FOOD BIBLE") && l === l.toUpperCase() && /[A-Z]/.test(l) && !DIVIDER.test(l)) {
      current = { name: l.replace("[BATCH]", "").trim(), section, batch: l.includes("[BATCH]"), meta: [], lines: [] };
      recipes.push(current);
    } else if (current && l && current.batch && current.lines.length === 0) {
      current.meta.push(l);
    }
  }
  return recipes;
}

// Words after a comma that describe how an item is prepared, not another ingredient.
const PREPARATION = new Set(["scrambled", "fried", "poached", "boiled", "shaved", "skin off", "grilled", "roasted"]);

const AMOUNT = /^(\d+(?:\.\d+)?)\s*(kg|g|ml|l)?\s*(.+)$/i;

function readOption(text: string, raw: string): LineItem[] {
  const m = AMOUNT.exec(text.trim());
  if (!m) throw new Error(`Cannot read ingredient line: "${raw}"`);
  const quantity = Number(m[1]);
  const unitText = m[2]?.toLowerCase();
  let rest = m[3];

  // "120g eggs (5)": the bracket says how many eggs that weight is.
  const countInBrackets = /^eggs?\s*\((\d+)\)\s*$/i.exec(rest);
  if (countInBrackets) return [{ phrase: "eggs", quantity: Number(countInBrackets[1]), unit: "EACH" }];

  rest = rest.replace(/\s*\([^)]*\)/g, ""); // (finely grated), (fries), (Benedict)
  const unit: LineUnit = unitText === "kg" ? "KG" : unitText === "g" ? "G" : unitText === "ml" ? "ML" : unitText === "l" ? "L" : "EACH";
  const items: LineItem[] = [];
  for (const part of rest.split(",")) {
    const phrase = part.trim().toLowerCase();
    if (!phrase || PREPARATION.has(phrase)) continue;
    items.push({ phrase, quantity, unit });
  }
  if (items.length === 0) throw new Error(`Cannot read ingredient line: "${raw}"`);
  return items;
}

export function parseLine(line: string): ParsedLine {
  const raw = line;
  let text = line.trim();
  const optional = /\(optional\)\s*$/i.test(text);
  text = text.replace(/\s*\(optional\)\s*$/i, "");
  const choice = /^[^:\d]*choice of:\s*(.+)$/i.exec(text);
  if (choice) text = choice[1];
  const options = text.split(/\s+OR\s+/).map((part) => readOption(part, raw));
  return { options, optional, raw };
}
