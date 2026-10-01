import * as XLSX from "xlsx";
import { gpFromSellingPrice, suggestedPriceFromTargetGp } from "@/lib/costing/costing";
import { SpecSheetVersion } from "@/components/dishes/SpecSheet";

export function buildSpecSheetWorkbook(version: SpecSheetVersion): Buffer {
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);
  const suggestedPrice = targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null;

  const header = [`${version.dish.name} (v${version.versionNumber})`];
  const lineRows = [
    ["Ingredient", "Quantity", "Unit", "Cost (฿)"],
    ...version.lines.map((l) => [l.ingredientNameSnapshot, Number(l.quantity), l.unit, Number(l.lineCostSnapshot)]),
    [],
    ["Cost", cost],
    ...(sellingPrice ? [["Selling price", sellingPrice]] : []),
    ...(gp ? [["GP (฿)", gp.gpThb], ["GP (%)", `${(gp.gpPct * 100).toFixed(1)}%`]] : [["GP", "not set"]]),
    ...(suggestedPrice !== null ? [[`Suggested price for ${targetGpPct}% target GP`, suggestedPrice]] : []),
  ];

  const sheet = XLSX.utils.aoa_to_sheet([header, [], ...lineRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Spec sheet");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
