// Checks apps/web/config/data.js before a push: it must stay plain JSON after `const DATA = `, every item needs an
// id, a name, a unit and a price, and ids must be unique within a supplier (the GP Calculator matches on them).
// Run: npm run check:sheet
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function parseSheet(text) {
  const start = text.indexOf("const DATA =");
  if (start < 0) throw new Error("data.js must contain `const DATA = {...};`");
  return JSON.parse(text.slice(start + "const DATA =".length).trim().replace(/;\s*$/, ""));
}

export function checkSheet(data) {
  const problems = [];
  for (const [supplier, body] of Object.entries(data)) {
    if (!Array.isArray(body?.categories)) {
      problems.push(`${supplier}: no categories list`);
      continue;
    }
    const seen = new Map();
    for (const category of body.categories) {
      for (const item of category.items ?? []) {
        const label = `${supplier} / ${category.name} / ${item.name ?? "(no name)"}`;
        if (item.id === undefined || item.id === null || item.id === "") problems.push(`${label}: missing id`);
        else if (seen.has(String(item.id))) problems.push(`${label}: id ${item.id} is already used by "${seen.get(String(item.id))}"`);
        else seen.set(String(item.id), item.name);
        if (!item.name || !String(item.name).trim()) problems.push(`${label}: missing name`);
        if (!item.unit) problems.push(`${label}: missing unit`);
        if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0) problems.push(`${label}: price must be a number, zero or more (is ${JSON.stringify(item.price)})`);
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? new URL("../apps/web/config/data.js", import.meta.url);
  let problems;
  try {
    problems = checkSheet(parseSheet(readFileSync(file, "utf8")));
  } catch (e) {
    problems = [e.message];
  }
  if (problems.length) {
    console.error(problems.map((p) => `  ${p}`).join("\n"));
    console.error(`\n${problems.length} problem(s) in the order sheet.`);
    process.exit(1);
  }
  console.log("Order sheet OK.");
}
