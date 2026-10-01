import { expect, test } from "vitest";
import { buildAttachmentFilename } from "./content-disposition";

test("does not throw and produces a valid header for a Thai dish name", () => {
  const dishName = "ต้มยำกุ้ง-v1";
  let header = "";
  expect(() => {
    header = buildAttachmentFilename(dishName, "pdf");
  }).not.toThrow();

  // Must be a valid Latin-1/ByteString value — this is what the real Headers
  // constructor requires, and what throws a TypeError otherwise.
  expect(() => new Headers({ "Content-Disposition": header })).not.toThrow();

  expect(header).toContain('attachment; filename="');
  expect(header).toContain(`filename*=UTF-8''${encodeURIComponent(`${dishName}.pdf`)}`);
});

test("replaces quotes and backslashes in the ASCII fallback", () => {
  const header = buildAttachmentFilename('weird "name"\\here', "xlsx");
  expect(header).toContain('filename="weird _name__here.xlsx"');
  expect(() => new Headers({ "Content-Disposition": header })).not.toThrow();
});
