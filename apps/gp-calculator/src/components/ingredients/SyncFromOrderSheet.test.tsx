import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SyncButton, SyncPanel, useOrderSheetSync } from "./SyncFromOrderSheet";

function Harness({ onSynced }: { onSynced?: () => void }) {
  const sync = useOrderSheetSync(onSynced);
  return (
    <>
      <SyncButton sync={sync} />
      <SyncPanel sync={sync} />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const report = (over = {}) => ({
  applied: false,
  created: [{ name: "New thing", supplier: "Makro" }],
  priceChanged: [{ name: "Rosemary 100 g", supplier: "Makro", oldPrice: 85, newPrice: 99 }],
  unchanged: 150,
  removed: [],
  archivedBecauseUsed: [{ name: "Old but used", supplier: "Makro" }],
  needsPackSize: [{ name: "Toilet Tissue", supplier: "Makro" }],
  packMismatch: [],
  dishes: [{ dishId: "d1", name: "Salad", oldCost: 10, newCost: 12, sellingPrice: 100, oldGpPct: 0.9, newGpPct: 0.88 }],
  ...over,
});

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("previews first, writes nothing, then applies only when asked", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(respond(report())).mockResolvedValueOnce(respond(report({ applied: true })));
  vi.stubGlobal("fetch", fetchMock);
  const onSynced = vi.fn();
  render(<Harness onSynced={onSynced} />);

  fireEvent.click(screen.getByRole("button", { name: /sync from order sheet/i }));
  expect(await screen.findByText(/nothing has changed yet/i)).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ apply: false });
  expect(screen.getByText(/Rosemary 100 g/)).toBeTruthy();
  expect(screen.getByText(/Salad/)).toBeTruthy();
  expect(onSynced).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /^apply/i }));
  await waitFor(() => expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ apply: true }));
  expect(await screen.findByText(/synced/i)).toBeTruthy();
  expect(onSynced).toHaveBeenCalledTimes(1);
});

test("shows the server's message when the sheet cannot be read, and offers no Apply", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ error: "Could not read the order sheet: the file is not in the expected format. Nothing was changed." }, 400)));
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /sync from order sheet/i }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Could not read the order sheet/);
  expect(screen.queryByRole("button", { name: /^apply/i })).toBeNull();
});
