import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LockedScreen } from "./LockedScreen";

describe("LockedScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function submit(password: string) {
    fireEvent.change(screen.getByLabelText("Enter password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  }

  it("sends the password to the server and shows a wrong-password message", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "That password is not correct. Try again." }), { status: 401 })
    );
    render(<LockedScreen />);
    submit("nope");
    expect(await screen.findByRole("alert")).toHaveTextContent("not correct");
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("explains a network failure instead of throwing", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LockedScreen />);
    submit("anything");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server"));
  });

  it("can show and hide the password", () => {
    render(<LockedScreen />);
    const input = screen.getByLabelText("Enter password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
  });
});
