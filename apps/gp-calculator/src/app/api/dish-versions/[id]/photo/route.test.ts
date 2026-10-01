// @vitest-environment node
import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.example.com/photo.jpg" }),
}));

import { put } from "@vercel/blob";
import { POST } from "./route";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]); // a real JPEG header

afterEach(async () => {
  vi.mocked(put).mockClear();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("uploads a photo and sets photoUrl on the version", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const formData = new FormData();
  formData.append("file", new File([JPEG_BYTES], "plate.jpg", { type: "image/jpeg" }));
  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/photo`, { method: "POST", body: formData });

  const res = await POST(req, { params: { id: version.id } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.photoUrl).toBe("https://blob.example.com/photo.jpg");

  const updated = await prisma.dishVersion.findUnique({ where: { id: version.id } });
  expect(updated?.photoUrl).toBe("https://blob.example.com/photo.jpg");
});

test("rejects an oversized file with 400 and never calls put", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
  const formData = new FormData();
  formData.append("file", new File([oversized], "huge.jpg", { type: "image/jpeg" }));
  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/photo`, { method: "POST", body: formData });

  const res = await POST(req, { params: { id: version.id } });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/too large/i);
  expect(put).not.toHaveBeenCalled();
});

test("rejects a non-image file with 400 and never calls put", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const formData = new FormData();
  formData.append("file", new File(["not an image"], "notes.txt", { type: "text/plain" }));
  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/photo`, { method: "POST", body: formData });

  const res = await POST(req, { params: { id: version.id } });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/image/i);
  expect(put).not.toHaveBeenCalled();
});

test("returns 404 for a nonexistent dish version and never calls put", async () => {
  const formData = new FormData();
  formData.append("file", new File([JPEG_BYTES], "plate.jpg", { type: "image/jpeg" }));
  const req = new NextRequest("http://localhost/api/dish-versions/does-not-exist/photo", { method: "POST", body: formData });

  const res = await POST(req, { params: { id: "does-not-exist" } });
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBe("Not found");
  expect(put).not.toHaveBeenCalled();
});

test("rejects a file that claims to be an image but is not", async () => {
  const dish = await prisma.dish.create({ data: { name: "Spoof", category: "Mains", createdBy: "t" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 1, createdBy: "t" } });
  const formData = new FormData();
  formData.append("file", new File(["<script>alert(1)</script>"], "plate.jpg", { type: "image/jpeg" }));
  const res = await POST(new NextRequest("http://localhost/x", { method: "POST", body: formData }), { params: { id: version.id } });
  expect(res.status).toBe(400);
});
