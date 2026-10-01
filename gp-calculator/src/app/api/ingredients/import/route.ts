import { importIngredients, parseImportRows, previewImport } from "@/lib/import";
import { recalculateDishVersionsForIngredients } from "@/lib/recalc";
import { syncBatchesForIngredients } from "@/lib/batch";
import { NextRequest, NextResponse } from "next/server";

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB — defense-in-depth against oversized/malicious uploads hitting the XLSX parser

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const createdBy = formData.get("createdBy") as string | null;

  if (!file || !createdBy) {
    return NextResponse.json({ error: "file and createdBy are required" }, { status: 400 });
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 5MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows;
  try {
    rows = parseImportRows(buffer, file.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not read file: ${message}` }, { status: 400 });
  }

  // dryRun: show what would change (counts, skipped rows, affected dishes) without saving anything
  if (formData.get("dryRun") === "true") {
    try {
      return NextResponse.json(await previewImport(rows));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Preview failed: ${message}` }, { status: 500 });
    }
  }

  try {
    const result = await importIngredients(rows, createdBy);
    const batchOutputs = await syncBatchesForIngredients(result.priceChangedIngredientIds, createdBy);
    const recalculatedDishes = await recalculateDishVersionsForIngredients(
      [...result.priceChangedIngredientIds, ...batchOutputs],
      createdBy
    );
    return NextResponse.json({ ...result, recalculatedDishes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Import failed: ${message}` }, { status: 500 });
  }
}
