// Builds a `Content-Disposition: attachment` header VALUE that is safe to
// pass to NextResponse/Headers even when `name` contains characters outside
// Latin-1 (e.g. Thai dish names, an em dash, curly quotes). The Headers
// constructor only accepts values encodable as Latin-1/ByteString, so a raw
// `filename="${name}"` interpolation throws a TypeError for any non-Latin-1
// character — and since this is a Thai-baht restaurant costing app, Thai
// dish names are the expected, common case.
//
// Uses the RFC 5987 pattern: an ASCII-safe `filename` fallback for clients
// that don't understand `filename*`, plus a UTF-8 percent-encoded
// `filename*` parameter carrying the real name.
export function buildAttachmentFilename(name: string, ext: string): string {
  const fullName = `${name}.${ext}`;
  // Replace anything outside printable ASCII (\x20-\x7e), plus characters
  // that would break the quoted-string syntax ("  and \), with "_".
  const asciiSafe = fullName.replace(/["\\]|[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(fullName);
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encoded}`;
}
