import { prisma } from "@/lib/prisma";
import { buildSpecSheetWorkbook } from "@/lib/xlsx-export";
import { buildAttachmentFilename } from "@/lib/content-disposition";
import { NextRequest, NextResponse } from "next/server";
import type { SpecSheetVersion } from "@/components/SpecSheet";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = buildSpecSheetWorkbook(version as unknown as SpecSheetVersion);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": buildAttachmentFilename(`${version.dish.name}-v${version.versionNumber}`, "xlsx"),
    },
  });
}
