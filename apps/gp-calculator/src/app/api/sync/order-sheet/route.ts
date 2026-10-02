import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { syncOrderSheet } from "@/lib/sync/order-sheet";
import { buildRows, loadOrderSheetText, parseOrderSheet } from "@/lib/sync/order-sheet-rows";

const bodySchema = z.object({ apply: z.boolean() });

// Pulls the Kaif order sheet into the ingredient list. `apply: false` only previews. The sheet comes from the
// configured address (ORDER_SHEET_URL, else the published site); the request can never choose where to download from.
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "apply (true or false) is required" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "apply (true or false) is required" }, { status: 400 });
  try {
    const text = await loadOrderSheetText({ url: process.env.ORDER_SHEET_URL });
    const rows = buildRows(parseOrderSheet(text));
    return NextResponse.json(await syncOrderSheet(rows, { apply: parsed.data.apply, actor: "Order sheet sync" }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
