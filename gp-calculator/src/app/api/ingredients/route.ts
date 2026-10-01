import { prisma } from "@/lib/prisma";
import { recordPriceHistory } from "@/lib/price-history";
import { estimateNote, isPlaceholderSupplier, findEstimatedIngredientIds } from "@/lib/estimates";
import { ingredientInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const includeArchived = searchParams.get("includeArchived") === "true";
  const supplierId = searchParams.get("supplierId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const ingredients = await prisma.ingredient.findMany({
    where: {
      ...(includeArchived ? {} : { archived: false }),
      ...(supplierId ? { supplierId } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { name: "asc" },
    include: { supplier: { select: { id: true, name: true, archived: true } } },
  });
  const estimated = await findEstimatedIngredientIds();
  return NextResponse.json(ingredients.map((i) => ({ ...i, estimateNote: estimateNote(i, estimated) })));
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = ingredientInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: parsed.data.supplierId } });
  const ingredient = await prisma.ingredient.create({
    data: {
      ...parsed.data,
      priceEstimated: supplier ? isPlaceholderSupplier(supplier.name) : false,
      updatedBy: parsed.data.createdBy,
    },
  });
  await recordPriceHistory(ingredient.id, parsed.data.createdBy);
  return NextResponse.json(ingredient, { status: 201 });
}
