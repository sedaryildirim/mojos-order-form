import { getPriceHistory } from "@/lib/price-history";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(await getPriceHistory(params.id));
}
