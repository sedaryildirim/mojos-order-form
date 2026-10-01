import { prisma } from "@/lib/db/prisma";
import { gpFromSellingPrice, suggestedPriceFromTargetGp } from "@/lib/costing/costing";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { id: params.id },
    include: { lines: true, dish: true },
  });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;

  return NextResponse.json({
    ...version,
    derived: {
      gp: gpFromSellingPrice(cost, sellingPrice),
      suggestedPrice: targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null,
    },
  });
}
