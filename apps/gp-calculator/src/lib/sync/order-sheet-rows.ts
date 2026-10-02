import { readFile } from "node:fs/promises";
import packOverrides from "@/data/order-sheet-packs.json";
import { parsePackSize } from "./pack-size";

const DEFAULT_ORDER_SHEET_URL = "https://sedaryildirim.github.io/mojos-order-form/config/data.js";

// Order-sheet supplier id -> the GP supplier name. Only Kaif's suppliers are synced.
export const SYNCED_SUPPLIERS: Record<string, string> = {
  "makro-kaif": "Makro",
  winepro: "Wine Pro",
  phangangreenveg: "Phangan Green Vegetables",
  labottega: "La Bottega",
  fruitshop: "Boy Fruit Shop",
};

type Unit = "G" | "ML" | "EACH";
type Override = { purchaseUnit: Unit; packQuantity: number };

interface SheetItem {
  id: string | number;
  name: string;
  unit: string;
  price: number;
}
type SheetData = Record<string, { categories: { name: string; items: SheetItem[] }[] }>;

export interface SheetRow {
  sourceKey: string;
  name: string;
  category: string;
  supplier: string;
  purchaseUnit: Unit;
  packQuantity: number;
  packPrice: number;
  needsPackSize: boolean;
}

// data.js is `const DATA = {...};`. It is parsed as JSON and never executed.
export function parseOrderSheet(text: string): SheetData {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    if (start < 0 || end < start) throw new Error("no object found");
    const data = JSON.parse(text.slice(start, end + 1)) as SheetData;
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) throw new Error("empty");
    // Valid JSON is not enough (package.json is valid JSON): an order sheet is suppliers that each have categories.
    const looksRight = Object.values(data).some((v) => v && typeof v === "object" && Array.isArray((v as { categories?: unknown }).categories));
    if (!looksRight) throw new Error("not an order sheet");
    return data;
  } catch {
    throw new Error("Could not read the order sheet: the file is not in the expected format. Nothing was changed.");
  }
}

export function buildRows(data: SheetData, overrides: Record<string, Override> = packOverrides as Record<string, Override>): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const [sheetId, supplier] of Object.entries(SYNCED_SUPPLIERS)) {
    for (const cat of data[sheetId]?.categories ?? []) {
      for (const item of cat.items) {
        if (typeof item.price !== "number" || !(item.price > 0)) continue;
        const sourceKey = `${sheetId}:${item.id}`;
        const pack = parsePackSize(item.name, item.unit, overrides[sourceKey]);
        rows.push({ sourceKey, name: item.name, category: cat.name, supplier, packPrice: item.price, ...pack });
      }
    }
  }
  return rows;
}

// A local file (for the command and tests) or the published order sheet. Callers on the server pass only the
// configured URL, never one supplied by a user.
export async function loadOrderSheetText(source: { file?: string; url?: string }): Promise<string> {
  if (source.file) return readFile(source.file, "utf8");
  const res = await fetch(source.url || DEFAULT_ORDER_SHEET_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not download the order sheet (HTTP ${res.status}). Nothing was changed.`);
  return res.text();
}
