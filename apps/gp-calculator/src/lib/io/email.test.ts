import { afterEach, expect, test, vi } from "vitest";

const send = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => {
  // vitest 5 requires a constructible (non-arrow) implementation for `new Resend(...)`
  // to work — an arrow-function implementation throws "is not a constructor".
  return { Resend: vi.fn().mockImplementation(function () { return { emails: { send } }; }) };
});

import { sendSpecSheetEmail } from "./email";
import { Resend } from "resend";

afterEach(() => {
  send.mockClear();
  send.mockResolvedValue({ data: { id: "email_123" }, error: null });
});

test("sends an email with the PDF attached", async () => {
  await sendSpecSheetEmail({ to: "chef@example.com", dishName: "Onion Soup", versionNumber: 1, pdfBuffer: Buffer.from("%PDF-fake") });

  const instance = (Resend as any).mock.results[0].value;
  expect(instance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
    to: "chef@example.com",
    subject: expect.stringContaining("Onion Soup"),
    attachments: [expect.objectContaining({ filename: "Onion Soup-v1.pdf" })],
  }));
});

test("throws when resend resolves with an API-level error instead of rejecting", async () => {
  // Verified empirically against the installed resend package (6.x):
  // emails.send does NOT throw on an API-level rejection (unverified domain,
  // sandbox recipient limits, rate limits) — it resolves to
  // `{ data: null, error: {...} }`. sendSpecSheetEmail must surface this as
  // a thrown error instead of silently reporting success.
  send.mockResolvedValueOnce({ data: null, error: { message: "Domain not verified" } });

  await expect(
    sendSpecSheetEmail({ to: "chef@example.com", dishName: "Onion Soup", versionNumber: 1, pdfBuffer: Buffer.from("%PDF-fake") })
  ).rejects.toThrow("Domain not verified");
});
