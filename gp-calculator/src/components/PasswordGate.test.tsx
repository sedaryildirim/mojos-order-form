import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PasswordGate } from "./PasswordGate";

describe("PasswordGate", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(cleanup);

  it("asks for the password and keeps the page locked on a wrong one", async () => {
    render(<PasswordGate><p>Secret page</p></PasswordGate>);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("alert")).toHaveTextContent("not correct");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("unlocks with the right password and remembers it for the session", async () => {
    const { unmount } = render(<PasswordGate><p>Secret page</p></PasswordGate>);
    fireEvent.change(await screen.findByLabelText("Password"), { target: { value: "555666" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    render(<PasswordGate><p>Secret page</p></PasswordGate>);
    expect(await screen.findByText("Secret page")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
