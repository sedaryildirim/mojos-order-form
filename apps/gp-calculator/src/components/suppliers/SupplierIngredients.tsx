"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { requireActor } from "@/lib/client/actor";
import { TARGET_GP_PCT } from "@/lib/costing/costing";
import { formatTHB } from "@/lib/costing/currency";
import { packLabel, unitWord } from "@/lib/costing/unit-price";
import { safeFetch, apiError } from "@/lib/client/api";

export interface SupplierIngredientRow {
  id: string;
  name: string;
  category: string;
  purchaseUnit: string;
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
  estimateNote: string | null;
  updatedAt?: string; // ISO time of the last change, sent back so a stale edit is refused
}

interface PreviewDish {
  dishId: string;
  name: string;
  oldCost: number;
  newCost: number;
  oldGpPct: number | null;
  newGpPct: number | null;
}

const COLUMNS = 5;

export function SupplierIngredients({ rows: initialRows, supplierIsPlaceholder = false }: { rows: SupplierIngredientRow[]; supplierIsPlaceholder?: boolean }) {
  const pathname = usePathname();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ packQuantity: string; packPrice: string }>({ packQuantity: "", packPrice: "" });
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  // the "saved" message sits in the row you just edited, so it is visible however far down the list you are
  const [saved, setSaved] = useState<{ id: string; text: string; dishes: PreviewDish[] } | null>(null);
  const [confirmReal, setConfirmReal] = useState(false);
  const [preview, setPreview] = useState<PreviewDish[] | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, SupplierIngredientRow[]>();
    for (const r of rows) {
      if (category && r.category !== category) continue;
      if (q && !r.name.toLowerCase().includes(q)) continue;
      map.set(r.category, [...(map.get(r.category) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, search, category]);

  const shown = groups.reduce((n, [, items]) => n + items.length, 0);
  const visibleOrder = groups.flatMap(([, items]) => items.map((i) => i.id));

  // While a price is being edited, show what it would do to dish costs and GP (nothing is saved yet).
  useEffect(() => {
    setPreview(null);
    if (!editingId) return;
    const packQuantity = Number(draft.packQuantity);
    const packPrice = Number(draft.packPrice);
    if (!(packQuantity > 0) || !(packPrice > 0)) return;
    const timer = setTimeout(() => {
      fetch(`/api/ingredients/${editingId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packQuantity, packPrice }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setPreview(d))
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [editingId, draft.packQuantity, draft.packPrice]);

  function startEdit(r: SupplierIngredientRow) {
    const previous = editingId ? rows.find((x) => x.id === editingId) : null;
    setStatus(previous ? { kind: "info", text: `Unsaved changes to ${previous.name} were discarded.` } : null);
    setSaved(null);
    setConfirmReal(false);
    setEditingId(r.id);
    setDraft({ packQuantity: String(r.packQuantity), packPrice: String(r.packPrice) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = rows.find((x) => x.id === editingId);
    if (!r) return;
    const packQuantity = Number(draft.packQuantity);
    const packPrice = Number(draft.packPrice);
    if (!(packQuantity > 0) || !(packPrice > 0)) {
      setStatus({ kind: "error", text: "Pack size and price must both be greater than 0." });
      return;
    }
    const updatedBy = requireActor();
    if (!updatedBy) return;
    // pressing Enter before the live preview arrived: get it now so the "recosted" list is complete
    let affected = preview;
    if (!affected) {
      try {
        const pr = await safeFetch(`/api/ingredients/${r.id}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packQuantity, packPrice }),
        });
        affected = pr.ok ? await pr.json() : [];
      } catch {
        affected = [];
      }
    }
    const confirming = confirmReal && Boolean(r.estimateNote);
    const res = await safeFetch(`/api/ingredients/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packQuantity, packPrice, updatedBy, ...(confirming ? { priceEstimated: false } : {}), ...(r.updatedAt ? { expectedUpdatedAt: r.updatedAt } : {}) }),
    });
    if (!res.ok) {
      setStatus({ kind: "error", text: await apiError(res, `Could not save ${r.name}. Please try again.`) });
      return;
    }
    const savedRow = await res.json().catch(() => null);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, packQuantity, packPrice, estimateNote: confirming ? null : x.estimateNote, updatedAt: typeof savedRow?.updatedAt === "string" ? savedRow.updatedAt : x.updatedAt } : x)));
    setEditingId(null);
    setConfirmReal(false);
    setStatus(null);
    setSaved({
      id: r.id,
      text: `Saved: ${formatTHB(r.packPrice)} to ${formatTHB(packPrice)}${confirming ? ", confirmed as the real price" : ""}.`,
      dishes: affected ?? [],
    });
    // keep going down the list: focus the next row's Edit price button
    const next = visibleOrder[visibleOrder.indexOf(r.id) + 1];
    setTimeout(() => (next ? editButtons.current.get(next) : editButtons.current.get(r.id))?.focus(), 0);
  }

  const editing = editingId ? rows.find((r) => r.id === editingId) : null;

  return (
    <div>
      <p>
        Click <span>Edit price</span> on a row to change it. Enter saves and moves to the next row. To
        change many at once, use{" "}
        <Link href="/ingredients/import">
          Import prices
        </Link>
        .
      </p>
      <div data-filters>
        <div>
          <label htmlFor="supplier-search">
            Search
          </label>
          <input
            id="supplier-search"
            placeholder="Ingredient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 1 && (
          <div>
            <label htmlFor="supplier-category">
              Category
            </label>
            <select id="supplier-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <span>
          {shown} of {rows.length} ingredients
        </span>
      </div>

      {/* One form for whichever row is being edited; its inputs and buttons attach to it by id. */}
      <form id="price-edit" onSubmit={save} />

      <div aria-live="polite">
        {status && (
          <div
            role={status.kind === "error" ? "alert" : undefined}
          >
            <p>{status.text}</p>
          </div>
        )}
      </div>
      {/* Screen readers hear the preview as it changes; the visible panel sits under the row being edited. */}
      <div aria-live="polite">
        {editing && preview
          ? preview.length === 0
            ? "No dish cost changes with this price."
            : `If you save, ${preview.length} dishes change.`
          : ""}
      </div>

      {shown === 0 && (
        <p>No ingredients match your filters. Clear the search or category to see more.</p>
      )}

      {groups.map(([cat, items]) => (
        <section key={cat}>
          <h3>{cat}</h3>
          <div>
            <table data-aligned>
              <thead>
                <tr>
                  <th scope="col">
                    Ingredient
                  </th>
                  <th scope="col">
                    Pack size
                  </th>
                  <th scope="col">
                    Price
                  </th>
                  <th scope="col">
                    Yield
                  </th>
                  <th scope="col">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const isEditing = editingId === i.id;
                  return [
                    <tr key={i.id}>
                      <td>
                        <Link href={`/ingredients/${i.id}?from=${encodeURIComponent(pathname)}`}>
                          {i.name}
                        </Link>
                        {i.estimateNote && (
                          <span>{i.estimateNote}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <span>
                            <input
                              form="price-edit"
                              aria-label={`Pack size for ${i.name}`}
                              type="number"
                              min="0"
                              step="any"
                              autoFocus
                              value={draft.packQuantity}
                              onChange={(e) => setDraft({ ...draft, packQuantity: e.target.value })}
                            />
                            {unitWord(i.purchaseUnit)}
                          </span>
                        ) : (
                          packLabel(i.packQuantity, i.purchaseUnit)
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            form="price-edit"
                            aria-label={`Price for ${i.name}`}
                            type="number"
                            min="0"
                            step="any"
                            value={draft.packPrice}
                            onChange={(e) => setDraft({ ...draft, packPrice: e.target.value })}
                          />
                        ) : (
                          formatTHB(i.packPrice)
                        )}
                      </td>
                      <td>{i.yieldPct < 100 ? `${i.yieldPct}%` : ""}</td>
                      <td>
                        {isEditing ? (
                          <span>
                            {i.estimateNote && !supplierIsPlaceholder && (
                              <label>
                                <input type="checkbox" checked={confirmReal} onChange={(e) => setConfirmReal(e.target.checked)} />
                                This is the real price
                              </label>
                            )}
                            <button type="submit" form="price-edit">
                              Save
                            </button>
                            <button type="button" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) editButtons.current.set(i.id, el);
                              else editButtons.current.delete(i.id);
                            }}
                            onClick={() => startEdit(i)}
                          >
                            Edit price
                          </button>
                        )}
                      </td>
                    </tr>,
                    saved && saved.id === i.id && !isEditing ? (
                      <tr key={`${i.id}-saved`}>
                        <td colSpan={COLUMNS}>
                          <p>{saved.text}</p>
                          {saved.dishes.length > 0 && (
                            <p>
                              Dishes recosted:{" "}
                              {saved.dishes.slice(0, 6).map((d, n) => (
                                <span key={d.dishId}>
                                  {n > 0 && ", "}
                                  <Link href={`/dishes/${d.dishId}`}>
                                    {d.name}
                                  </Link>
                                  {d.newGpPct !== null && d.newGpPct * 100 < TARGET_GP_PCT ? " (below target)" : ""}
                                </span>
                              ))}
                              {saved.dishes.length > 6 ? ` and ${saved.dishes.length - 6} more` : ""}.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : null,
                    isEditing && preview ? (
                      <tr key={`${i.id}-preview`}>
                        <td colSpan={COLUMNS}>
                          {preview.length === 0 ? (
                            <p>No dish cost changes with this price.</p>
                          ) : (
                            <>
                              <p>
                                If you save, {preview.length} dish{preview.length === 1 ? "" : "es"} change:
                              </p>
                              <ul>
                                {preview.slice(0, 8).map((d) => {
                                  const nowBelow = d.newGpPct !== null && d.newGpPct * 100 < TARGET_GP_PCT;
                                  const wasBelow = d.oldGpPct !== null && d.oldGpPct * 100 < TARGET_GP_PCT;
                                  return (
                                    <li key={d.dishId}>
                                      <span>{d.name}</span>
                                      <span>
                                        cost {formatTHB(d.oldCost)} to {formatTHB(d.newCost)}
                                        {d.oldGpPct !== null && d.newGpPct !== null && (
                                          <>
                                            , GP {(d.oldGpPct * 100).toFixed(0)}% to{" "}
                                            <span>
                                              {(d.newGpPct * 100).toFixed(0)}%
                                              {nowBelow && !wasBelow ? " (drops below target)" : nowBelow ? " (below target)" : ""}
                                            </span>
                                          </>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                              {preview.length > 8 && <p>and {preview.length - 8} more.</p>}
                            </>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
