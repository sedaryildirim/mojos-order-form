import { prisma } from "@/lib/db/prisma";
import { supplierInputSchema } from "@/lib/db/validation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { CONFLICT_MESSAGE } from "@/lib/db/conflict";
import { z } from "zod";

const patchSchema = supplierInputSchema.partial().extend({
  archived: z.boolean().optional(),
  updatedBy: z.string().min(1),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { expectedUpdatedAt, ...changes } = parsed.data;
  try {
    const supplier = await prisma.supplier.update({
      where: expectedUpdatedAt ? { id: params.id, updatedAt: new Date(expectedUpdatedAt) } : { id: params.id },
      data: changes,
    });
    return NextResponse.json(supplier);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      const exists = expectedUpdatedAt ? await prisma.supplier.findUnique({ where: { id: params.id }, select: { id: true } }) : null;
      if (exists) return NextResponse.json({ error: CONFLICT_MESSAGE, code: "CONFLICT" }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(supplier);
}
