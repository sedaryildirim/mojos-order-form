import { prisma } from "@/lib/db/prisma";
import { loadBatchGpHistory } from "@/lib/costing/gp-history";
import { NextRequest, NextResponse } from "next/server";

// The last few cost changes of a batch recipe, as points for the GP history chart.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const exists = await prisma.batchRecipe.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await loadBatchGpHistory(params.id));
}
