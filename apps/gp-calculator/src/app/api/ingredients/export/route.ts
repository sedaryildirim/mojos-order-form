import { prisma } from "@/lib/db/prisma";
import { buildIngredientTemplateWorkbook } from "@/lib/io/ingredient-template";
import { buildAttachmentFilename } from "@/lib/io/content-disposition";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supplierId = req.nextUrl.searchParams.get("supplierId");
  const ingredients = await prisma.ingredient.findMany({
    where: { archived: false, ...(supplierId ? { supplierId } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { supplier: { select: { name: true } } },
  });

  const rows = ingredients.map((i) => ({
    name: i.name,
    category: i.category,
    supplier: i.supplier.name,
    purchaseUnit: i.purchaseUnit,
    packQuantity: Number(i.packQuantity),
    packPrice: Number(i.packPrice),
    yieldPct: Number(i.yieldPct),
  }));

  const buffer = buildIngredientTemplateWorkbook(rows);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": buildAttachmentFilename("kaif-ingredients-template", "xlsx"),
    },
  });
}
