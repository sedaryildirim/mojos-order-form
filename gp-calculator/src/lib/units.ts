export type Unit = "G" | "KG" | "ML" | "L" | "EACH";

const FAMILY: Record<Unit, "weight" | "volume" | "count"> = {
  G: "weight",
  KG: "weight",
  ML: "volume",
  L: "volume",
  EACH: "count",
};

const TO_BASE: Record<Unit, number> = {
  G: 1,
  KG: 1000,
  ML: 1,
  L: 1000,
  EACH: 1,
};

export function unitFamily(unit: Unit): "weight" | "volume" | "count" {
  return FAMILY[unit];
}

export function convert(quantity: number, from: Unit, to: Unit): number {
  if (FAMILY[from] !== FAMILY[to]) {
    throw new Error(`Cannot convert incompatible units: ${from} -> ${to}`);
  }
  const inBase = quantity * TO_BASE[from];
  return inBase / TO_BASE[to];
}
