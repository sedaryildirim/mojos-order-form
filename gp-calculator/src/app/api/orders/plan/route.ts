import { buildOrderPlan } from "@/lib/ordering";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  items: z
    .array(z.object({ kind: z.enum(["dish", "batch"]), id: z.string().min(1), quantity: z.number().positive() }))
    .max(200),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await buildOrderPlan(parsed.data.items));
}
