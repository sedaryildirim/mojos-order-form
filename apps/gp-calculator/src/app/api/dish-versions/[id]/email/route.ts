import { prisma } from "@/lib/db/prisma";
import { renderSpecSheetPdf } from "@/lib/io/pdf";
import { sendSpecSheetEmail } from "@/lib/io/email";
import { emailShareSchema } from "@/lib/db/validation";
import { NextRequest, NextResponse } from "next/server";
import type { SpecSheetVersion } from "@/components/dishes/SpecSheet";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = emailShareSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const pdfBuffer = await renderSpecSheetPdf(version as unknown as SpecSheetVersion);
    await sendSpecSheetEmail({ to: parsed.data.to, dishName: version.dish.name, versionNumber: version.versionNumber, pdfBuffer });
  } catch {
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
