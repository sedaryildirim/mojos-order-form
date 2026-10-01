import { prisma } from "@/lib/db/prisma";
import { dishAttention, findEstimatedIngredientIds } from "@/lib/costing/estimates";
import { dishInputSchema } from "@/lib/db/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    orderBy: { name: "asc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { lines: true },
      },
    },
  });
  const attention = dishAttention(dishes, await findEstimatedIngredientIds());
  return NextResponse.json(dishes.map((d) => ({ ...d, attention: attention.get(d.id) ?? [] })));
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = dishInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const dish = await prisma.dish.create({ data: parsed.data });
  return NextResponse.json(dish, { status: 201 });
}
