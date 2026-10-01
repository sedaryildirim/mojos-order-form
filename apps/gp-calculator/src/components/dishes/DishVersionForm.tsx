"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IngredientPicker, PickableIngredient } from "@/components/ingredients/IngredientPicker";
import { dishVersionCost, gpFromSellingPrice, lineCost, suggestedPriceFromTargetGp, RecipeLine } from "@/lib/costing/costing";
import { Unit, unitFamily } from "@/lib/costing/units";
import { formatTHB } from "@/lib/costing/currency";
import { LIMITS } from "@/lib/db/validation";
import { ACTOR } from "@/lib/client/actor";

const ALL_UNITS: Unit[] = ["G", "KG", "ML", "L", "EACH"];

export interface Line {
  ingredientId: string;
  name: string;
  quantity: number;
  // exactly what was typed, so "0." and "0.5" can be entered without the box fighting back
  qtyText?: string;
  unit: Unit;
  pricing: { purchaseUnit: Unit; packQuantity: number; packPrice: number; yieldPct: number };
}

export interface DishVersionPayload {
  notes?: string;
  sellingPrice?: number;
  targetGpPct?: number;
  createdBy: string;
  lines: { ingredientId: string; quantity: number; unit: Unit }[];
}

export function DishVersionForm({
  suppliers,
  categories,
  initialLines,
  initialNotes,
  initialSellingPrice,
  initialTargetGpPct,
  onSubmit,
  submitting,
}: {
  suppliers: { id: string; name: string }[];
  categories: string[];
  initialLines?: Line[];
  initialNotes?: string;
  initialSellingPrice?: number;
  initialTargetGpPct?: number;
  onSubmit: (payload: DishVersionPayload) => void;
  submitting?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(initialLines ?? []);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [sellingPrice, setSellingPrice] = useState<number | undefined>(initialSellingPrice);
  const [targetGpPct, setTargetGpPct] = useState<number | undefined>(initialTargetGpPct);
  const createdBy = ACTOR;
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusIndex = useRef<number | null>(null);

  // after adding an ingredient, move to its quantity box so typing can continue
  useEffect(() => {
    if (focusIndex.current !== null) {
      document.getElementById(`qty-${focusIndex.current}`)?.focus();
      focusIndex.current = null;
    }
  }, [lines]);

  function addIngredient(ingredient: PickableIngredient) {
    setFormError(null);
    const existing = lines.findIndex((l) => l.ingredientId === ingredient.id);
    if (existing >= 0) {
      setNotice(`${ingredient.name} is already in this recipe. Change its quantity instead.`);
      document.getElementById(`qty-${existing}`)?.focus();
      return;
    }
    setNotice(null);
    focusIndex.current = lines.length;
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantity: 0,
        unit: ingredient.purchaseUnit,
        pricing: {
          purchaseUnit: ingredient.purchaseUnit,
          packQuantity: Number(ingredient.packQuantity),
          packPrice: Number(ingredient.packPrice),
          yieldPct: Number(ingredient.yieldPct),
        },
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Guarded against a unit/purchaseUnit family mismatch: in the amend flow,
  // an ingredient's purchaseUnit may have been edited since the referenced
  // version was created, so a line carried over from that version can throw
  // "Cannot convert incompatible units" inside dishVersionCost(). Without
  // this guard that throw would crash the whole page render.
  const { cost, costError } = useMemo(() => {
    const recipeLines: RecipeLine[] = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ pricing: l.pricing, quantity: l.quantity, unit: l.unit }));
    try {
      return { cost: dishVersionCost(recipeLines), costError: null as string | null };
    } catch {
      return { cost: 0, costError: "One or more recipe lines use a unit that doesn't match their ingredient. Fix the highlighted line's unit before saving." };
    }
  }, [lines]);

  const gp = costError ? null : gpFromSellingPrice(cost, sellingPrice);

  // Addition 1: live suggested price when a target GP% is set but no selling
  // price has been entered yet. Guarded against targetGpPct >= 100 (or < 0),
  // which suggestedPriceFromTargetGp() throws on — that can happen transiently
  // while the user is still typing (e.g. "100" on the way to "99" or just an
  // in-progress edit), so we must not let it crash the live preview.
  let suggestedPrice: number | null = null;
  if (!costError && targetGpPct !== undefined && !sellingPrice && targetGpPct < 100 && targetGpPct >= 0) {
    try {
      suggestedPrice = suggestedPriceFromTargetGp(cost, targetGpPct);
    } catch {
      suggestedPrice = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setFormError("Add at least one ingredient before saving.");
      return;
    }
    const missing = lines.find((l) => !(l.quantity > 0));
    if (missing) {
      setFormError(`Enter a quantity for ${missing.name}, or remove it.`);
      return;
    }
    setFormError(null);
    onSubmit({
      notes: notes || undefined,
      sellingPrice,
      targetGpPct,
      createdBy,
      lines: lines.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, unit: l.unit })),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <IngredientPicker suppliers={suppliers} categories={categories} onSelect={addIngredient} />

      <div aria-live="polite">
        {notice && <p>{notice}</p>}
        {formError && (
          <p role="alert">
            {formError}
          </p>
        )}
      </div>

      <ul>
        {lines.map((line, index) => {
          const unitOptions = ALL_UNITS.filter((u) => unitFamily(u) === unitFamily(line.pricing.purchaseUnit));
          const mismatch = unitFamily(line.unit) !== unitFamily(line.pricing.purchaseUnit);
          let thisLineCost: number | null = null;
          try {
            if (line.quantity > 0 && !mismatch) thisLineCost = lineCost(line.pricing, line.quantity, line.unit);
          } catch {
            thisLineCost = null;
          }
          return (
            <li
              key={`${line.ingredientId}-${index}`}
            >
              <span>
                {line.name}
                {mismatch && <span>Unit does not match this ingredient</span>}
              </span>
              <label htmlFor={`qty-${index}`}>Quantity</label>
              <input
                id={`qty-${index}`}
                aria-label="Quantity"
                type="number"
                min="0"
                step="any"
                value={line.qtyText ?? (line.quantity || "")}
                onChange={(e) => updateLine(index, { qtyText: e.target.value, quantity: Number(e.target.value) || 0 })}
              />
              <label htmlFor={`unit-${index}`}>Unit</label>
              <select
                id={`unit-${index}`}
                aria-label="Unit"
                value={line.unit}
                onChange={(e) => updateLine(index, { unit: e.target.value as Unit })}
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <span>{thisLineCost !== null ? formatTHB(thisLineCost) : ""}</span>
              <button type="button" onClick={() => removeLine(index)}>Remove</button>
            </li>
          );
        })}
      </ul>

      <div>
        {costError ? (
          <p role="alert">{costError}</p>
        ) : (
          <>
            <p>Cost: {formatTHB(cost)}</p>
            {gp && <p>GP: {formatTHB(gp.gpThb)} ({(gp.gpPct * 100).toFixed(1)}%)</p>}
            {!gp && suggestedPrice !== null && (
              <p>Suggested price for {targetGpPct}% target GP: {formatTHB(suggestedPrice)}</p>
            )}
            {!gp && suggestedPrice === null && <p>GP: not set (enter a selling price)</p>}
          </>
        )}
      </div>

      <div data-row>
        <div>
          <label htmlFor="sellingPrice">Selling price (฿)</label>
          <input id="sellingPrice" type="number" min="0" step="any"
            value={sellingPrice ?? ""} onChange={(e) => setSellingPrice(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label htmlFor="targetGpPct">Or target GP%</label>
          <input id="targetGpPct" type="number" min="0" max="99" step="any"
            value={targetGpPct ?? ""} onChange={(e) => setTargetGpPct(e.target.value ? Number(e.target.value) : undefined)} />
          <p>Only used to suggest a price when no selling price is entered.</p>
        </div>
        <div>
          <label htmlFor="notes">Amendment notes</label>
          <textarea id="notes" maxLength={LIMITS.notes}
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save version"}
        </button>
        <button type="button" onClick={() => window.history.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
