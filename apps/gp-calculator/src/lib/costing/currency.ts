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

// Same amount written as "THB 1,250.00". For the PDF, whose built-in font has no baht symbol (it prints "?").
export function formatTHBText(amount: number): string {
  return "THB " + formatTHB(amount).slice(1);
}
