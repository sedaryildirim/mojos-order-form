import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const MAX_PHOTO_FILE_BYTES = 5 * 1024 * 1024; // 5MB — defense-in-depth against oversized/malicious uploads hitting blob storage

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  if (file.size > MAX_PHOTO_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 5MB." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
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
