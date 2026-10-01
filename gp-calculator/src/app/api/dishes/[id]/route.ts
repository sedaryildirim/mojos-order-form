import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const dish = await prisma.dish.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { versionNumber: "desc" }, include: { lines: true } } },
  });
  if (!dish) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(dish);
}
