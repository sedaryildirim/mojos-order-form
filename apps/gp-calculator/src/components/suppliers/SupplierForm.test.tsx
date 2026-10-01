import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SupplierForm } from "./SupplierForm";

// the form remembers the name it was last saved with; start each test as a first-time user
beforeEach(() => window.localStorage.clear());

test("shows a validation error and blocks submit when name is empty", async () => {
  const onSubmit = vi.fn();
  render(<SupplierForm onSubmit={onSubmit} />);

  fireEvent.click(screen.getByText("Save supplier"));

  expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("calls onSubmit with form values when valid", async () => {
  const onSubmit = vi.fn();
  render(<SupplierForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Supplier name"), { target: { value: "Fresh Farms Co" } });
  fireEvent.click(screen.getByText("Save supplier"));

  expect(onSubmit).toHaveBeenCalledWith({
    name: "Fresh Farms Co",
    contactInfo: "",
    createdBy: "Kaif",
  });
});

test("records changes under the fixed name and never asks for one", async () => {
  const onSubmit = vi.fn();
  render(<SupplierForm onSubmit={onSubmit} />);

  expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Supplier name"), { target: { value: "Fresh Farms Co" } });
  fireEvent.click(screen.getByText("Save supplier"));
  expect(onSubmit).toHaveBeenCalledWith({ name: "Fresh Farms Co", contactInfo: "", createdBy: "Kaif" });
});
