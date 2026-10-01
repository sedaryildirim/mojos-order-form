import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { IngredientForm } from "./IngredientForm";

// the form remembers the name it was last saved with; start each test as a first-time user
beforeEach(() => window.localStorage.clear());

const suppliers = [{ id: "sup1", name: "Fresh Farms Co" }];

test("blocks submit when packPrice is zero", async () => {
  const onSubmit = vi.fn();
  render(<IngredientForm suppliers={suppliers} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Ingredient name"), { target: { value: "Onions" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Veg" } });
  fireEvent.change(screen.getByLabelText("Pack quantity"), { target: { value: "5000" } });
  fireEvent.change(screen.getByLabelText("Pack price (฿)"), { target: { value: "0" } });
  fireEvent.click(screen.getByText("Save ingredient"));

  expect(await screen.findByText(/pack price must be greater than 0/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("submits valid values including defaulted yield", async () => {
  const onSubmit = vi.fn();
  render(<IngredientForm suppliers={suppliers} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Ingredient name"), { target: { value: "Onions" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Veg" } });
  fireEvent.change(screen.getByLabelText("Supplier"), { target: { value: "sup1" } });
  fireEvent.change(screen.getByLabelText("Pack quantity"), { target: { value: "5000" } });
  fireEvent.change(screen.getByLabelText("Pack price (฿)"), { target: { value: "200" } });
  fireEvent.click(screen.getByText("Save ingredient"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    name: "Onions", supplierId: "sup1", packQuantity: 5000, packPrice: 200, yieldPct: 100,
  }));
});
