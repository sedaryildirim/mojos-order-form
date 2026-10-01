import { switchIngredient } from "@/lib/costing/switch";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ toIngredientId: z.string().min(1), updatedBy: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await switchIngredient(params.id, parsed.data.toIngredientId, parsed.data.updatedBy));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not switch" }, { status: 400 });
  }
}
