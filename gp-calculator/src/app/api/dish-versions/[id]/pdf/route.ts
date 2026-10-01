import { prisma } from "@/lib/prisma";
import { renderSpecSheetPdf } from "@/lib/pdf";
import { buildAttachmentFilename } from "@/lib/content-disposition";
import { NextRequest, NextResponse } from "next/server";
import type { SpecSheetVersion } from "@/components/SpecSheet";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderSpecSheetPdf(version as unknown as SpecSheetVersion);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildAttachmentFilename(`${version.dish.name}-v${version.versionNumber}`, "pdf"),
    },
  });
}
