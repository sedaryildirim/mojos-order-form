import { previewPriceChange } from "@/lib/costing/preview";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  packQuantity: z.number().positive().optional(),
  packPrice: z.number().positive().optional(),
  yieldPct: z.number().gt(0).lte(100).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await previewPriceChange(params.id, parsed.data));
}
