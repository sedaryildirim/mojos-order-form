import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { VersionCompare } from "./VersionCompare";

// Regression test for the design spec's "old vs new cost/GP฿/GP% with the
// delta shown" requirement: previously only GP% was shown per side, with no
// GP฿ and no delta computation anywhere.
test("shows GP฿ alongside GP% for each version and a delta section", () => {
  const oldVersion = { versionNumber: 1, costSnapshot: "10.00", sellingPrice: "40.00" };
  const newVersion = { versionNumber: 2, costSnapshot: "20.00", sellingPrice: "50.00" };

  render(<VersionCompare oldVersion={oldVersion} newVersion={newVersion} diffs={[]} />);

  // v1: cost 10, sellingPrice 40 -> GP฿ 30, GP% 75.0%
  // v2: cost 20, sellingPrice 50 -> GP฿ 30, GP% 60.0%
  expect(screen.getAllByText(/GP฿: ฿30\.00/).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText(/GP: 75\.0%/)).toBeInTheDocument();
  expect(screen.getByText(/GP: 60\.0%/)).toBeInTheDocument();

  // Delta section: cost delta +10, GP฿ delta 0, GP% delta -15.0%
  expect(screen.getByText(/Cost: \+฿10\.00/)).toBeInTheDocument();
  expect(screen.getByText(/GP%: -15\.0%/)).toBeInTheDocument();
});
