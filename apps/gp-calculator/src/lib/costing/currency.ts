export function formatTHB(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return (
    "฿" +
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
