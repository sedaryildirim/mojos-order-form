import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SpecSheet } from "./SpecSheet";

const version = {
  dish: { name: "Onion Soup" },
  versionNumber: 1,
  notes: "First version",
  photoUrl: null,
  costSnapshot: "10.00",
  sellingPrice: "40.00",
  targetGpPct: null,
  lines: [{ id: "l1", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G", lineCostSnapshot: "10.00" }],
};

test("shows dish name, ingredients, cost, and GP", () => {
  render(<SpecSheet version={version as any} />);
  expect(screen.getByText("Onion Soup (v1)")).toBeInTheDocument();
  expect(screen.getByText(/Onions/)).toBeInTheDocument();
  expect(screen.getByText(/250 G/)).toBeInTheDocument();
  expect(screen.getByText(/Cost: ฿10.00/)).toBeInTheDocument();
  expect(screen.getByText(/GP: ฿30.00 \(75.0%\)/)).toBeInTheDocument();
});

test("shows a 'not set' state when there is no selling price or target", () => {
  render(<SpecSheet version={{ ...version, sellingPrice: null } as any} />);
  expect(screen.getByText(/GP: not set/i)).toBeInTheDocument();
});
