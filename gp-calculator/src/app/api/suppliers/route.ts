import { prisma } from "@/lib/prisma";
import { supplierInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
  const suppliers = await prisma.supplier.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = supplierInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await prisma.supplier.create({
    data: { ...parsed.data, updatedBy: parsed.data.createdBy },
  });
  return NextResponse.json(supplier, { status: 201 });
}
