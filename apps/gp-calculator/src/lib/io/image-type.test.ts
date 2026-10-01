import { expect, test } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...n: number[]) => new Uint8Array(n);

test("recognises common image formats by signature", () => {
  expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
  expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
  expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
  expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
});

test("rejects other content, even when it claims to be an image", () => {
  expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  expect(detectImageType(bytes())).toBeNull();
});
