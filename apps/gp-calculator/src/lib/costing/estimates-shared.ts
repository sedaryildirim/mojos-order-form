export const PLACEHOLDER_SUPPLIER_PREFIX = "Placeholder";

// Safe to import from client components (estimates.ts pulls in the database client).
export function isPlaceholderSupplier(name: string): boolean {
  return name.startsWith(PLACEHOLDER_SUPPLIER_PREFIX);
}
