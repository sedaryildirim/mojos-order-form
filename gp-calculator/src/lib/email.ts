import { Resend } from "resend";

export async function sendSpecSheetEmail({
  to,
  dishName,
  versionNumber,
  pdfBuffer,
}: {
  to: string;
  dishName: string;
  versionNumber: number;
  pdfBuffer: Buffer;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `${dishName}: spec sheet (v${versionNumber})`,
    text: `Attached is the spec sheet for ${dishName}, version ${versionNumber}.`,
    attachments: [{ filename: `${dishName}-v${versionNumber}.pdf`, content: pdfBuffer }],
  });
  // resend's `emails.send` does NOT throw on an API-level rejection
  // (unverified domain, sandbox recipient limits, rate limits) — it resolves
  // to `{ data: null, error: {...} }`. Only a missing API key throws. Without
  // this check, a rejected send would silently report success.
  if (error) {
    throw new Error(error.message);
  }
}
