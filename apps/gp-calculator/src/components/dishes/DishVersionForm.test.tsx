import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { DishVersionForm } from "./DishVersionForm";
import { IngredientForm } from "@/components/ingredients/IngredientForm";
import { suggestedPriceFromTargetGp } from "@/lib/costing/costing";
import { formatTHB } from "@/lib/costing/currency";

// the form remembers the name it was last saved with; start each test as a first-time user
beforeEach(() => window.localStorage.clear());

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { id: "ing1", name: "Onions", category: "Veg", supplier: { name: "Fresh Farms Co" }, purchaseUnit: "G", packQuantity: "5000", packPrice: "200", yieldPct: "100" },
    ],
  }) as any;
});

test("adding a line and setting a selling price shows live cost and GP", async () => {
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={vi.fn()} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Selling price (฿)"), { target: { value: "40" } });

  expect(await screen.findByText(/cost: ฿10\.00/i)).toBeInTheDocument();
  expect(await screen.findByText(/gp: ฿30\.00 \(75\.0%\)/i)).toBeInTheDocument();
});

test("submits the recipe payload with your name and notes", async () => {
  const onSubmit = vi.fn();
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={onSubmit} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.click(screen.getByText("Save version"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    createdBy: "Kaif",
    lines: [{ ingredientId: "ing1", quantity: 250, unit: "G" }],
  }));
});

test("setting a target GP% with no selling price shows a live suggested price", async () => {
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={vi.fn()} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Or target GP%"), { target: { value: "70" } });

  // cost = (200 / 5000) * 250 = 10
  const expected = suggestedPriceFromTargetGp(10, 70);
  expect(
    await screen.findByText(`Suggested price for 70% target GP: ${formatTHB(expected)}`)
  ).toBeInTheDocument();
});

test("typing a target GP% of 100 mid-keystroke does not crash the live preview", async () => {
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={vi.fn()} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });

  expect(() => {
    fireEvent.change(screen.getByLabelText("Or target GP%"), { target: { value: "100" } });
  }).not.toThrow();

  // No suggested price line should render for an out-of-range target
  expect(screen.queryByText(/Suggested price for 100% target GP/)).not.toBeInTheDocument();
});

test("unit selector offers only units in the ingredient's unit family, and changing it updates the line", async () => {
  const onSubmit = vi.fn();
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={onSubmit} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));

  const unitSelect = screen.getByLabelText("Unit") as HTMLSelectElement;
  const optionValues = Array.from(unitSelect.options).map((o) => o.value);
  expect(optionValues).toEqual(["G", "KG"]);
  expect(unitSelect.value).toBe("G");

  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.change(unitSelect, { target: { value: "KG" } });
  expect(unitSelect.value).toBe("KG");

  fireEvent.click(screen.getByText("Save version"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    lines: [{ ingredientId: "ing1", quantity: 250, unit: "KG" }],
  }));
});

test("a decimal quantity can be typed and is submitted as a number", async () => {
  const onSubmit = vi.fn();
  render(<DishVersionForm suppliers={[]} categories={[]} onSubmit={onSubmit} />);
  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  const qty = screen.getByLabelText("Quantity") as HTMLInputElement;
  expect(qty.step).toBe("any");
  // typing a leading zero used to blank the box because the number was fed back into it
  fireEvent.change(qty, { target: { value: "0" } });
  expect(qty.value).toBe("0");
  fireEvent.change(qty, { target: { value: "0.75" } });
  fireEvent.click(screen.getByText("Save version"));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ quantity: 0.75 })] }));
});

test("refuses to save a recipe with no lines or a zero quantity", async () => {
  const onSubmit = vi.fn();
  render(<DishVersionForm suppliers={[]} categories={[]} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByText("Save version"));
  expect(await screen.findByText(/add at least one ingredient/i)).toBeInTheDocument();

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.click(screen.getByText("Save version"));
  expect(await screen.findByText(/enter a quantity for onions/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("adding the same ingredient twice does not create a second line", async () => {
  render(<DishVersionForm suppliers={[]} categories={[]} onSubmit={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.click(screen.getByText("Onions", { selector: "button" }));
  expect(screen.getAllByLabelText("Quantity")).toHaveLength(1);
  expect(screen.getByText(/already in this recipe/i)).toBeInTheDocument();
});

test("ingredient form accepts decimal prices", () => {
  // guards the browser's native validation: without step="any" a price of 45.50 is refused
  render(<IngredientForm suppliers={[]} onSubmit={vi.fn()} />);
  for (const label of ["Pack quantity", "Pack price (฿)", "Yield %"]) {
    expect((screen.getByLabelText(label) as HTMLInputElement).step).toBe("any");
  }
});
