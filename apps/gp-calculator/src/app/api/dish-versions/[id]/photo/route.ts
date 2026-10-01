import { prisma } from "@/lib/db/prisma";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { detectImageType } from "@/lib/io/image-type";

const MAX_PHOTO_FILE_BYTES = 5 * 1024 * 1024; // 5MB — defense-in-depth against oversized/malicious uploads hitting blob storage

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Upload could not be read. Try again." }, { status: 400 });
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  if (file.size > MAX_PHOTO_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 5MB." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  // The declared type is only a claim: check the file's own first bytes too.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!detectImageType(head)) {
    return NextResponse.json({ error: "That file is not a supported image (JPEG, PNG, WebP or GIF)." }, { status: 400 });
  }

  // Confirm the dish version exists before uploading — avoids wasting a blob
  // storage write on an upload that would just fail the subsequent update.
  const existing = await prisma.dishVersion.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // addRandomSuffix: true avoids "blob already exists" on re-upload of a
  // repeated filename (e.g. iOS's universal "image.jpg" for every photo) —
  // @vercel/blob's default is addRandomSuffix: false, which throws on the
  // second attempt. This also incidentally sidesteps any filename
  // collision/sanitization concern, since the stored key becomes unique
  // regardless of the original filename.
  const blob = await put(`dish-versions/${params.id}/${file.name}`, file, { access: "public", addRandomSuffix: true });

  const version = await prisma.dishVersion.update({
    where: { id: params.id },
    data: { photoUrl: blob.url },
  });
  return NextResponse.json({ photoUrl: version.photoUrl });
}
