import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { IngredientPicker } from "./IngredientPicker";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { id: "ing1", name: "Onions", category: "Veg", supplier: { name: "Fresh Farms Co" }, purchaseUnit: "G", packQuantity: "5000", packPrice: "200", yieldPct: "100" },
    ],
  }) as any;
});

test("lists matching ingredients and calls onSelect when clicked", async () => {
  const onSelect = vi.fn();
  render(<IngredientPicker suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "ing1", name: "Onions" }));
});

test("Enter in the search box picks the top match and does not submit the surrounding form", async () => {
  const onSelect = vi.fn();
  const onSubmit = vi.fn((e) => e.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <IngredientPicker suppliers={[]} categories={[]} onSelect={onSelect} />
    </form>
  );
  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.keyDown(screen.getByLabelText("Search ingredients"), { key: "Enter" });

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "ing1" }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("shows a message and a retry when the ingredients cannot be loaded", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
  render(<IngredientPicker suppliers={[]} categories={[]} onSelect={vi.fn()} />);
  expect(await screen.findByText(/could not load ingredients/i)).toBeInTheDocument();
  expect(screen.getByText("Try again")).toBeInTheDocument();
});

test("says so when nothing matches the search", async () => {
  render(<IngredientPicker suppliers={[]} categories={[]} onSelect={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Search ingredients"), { target: { value: "zzz" } });
  expect(screen.getByText(/no ingredients match/i)).toBeInTheDocument();
});
