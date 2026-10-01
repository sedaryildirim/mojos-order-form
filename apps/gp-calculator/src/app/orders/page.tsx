"use client";

import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/layout/PageTitle";
import { formatTHB } from "@/lib/costing/currency";

interface Option {
  kind: "dish" | "batch";
  id: string;
  name: string;
}

interface Chosen extends Option {
  quantity: number;
}

interface OrderLine {
  ingredientId: string;
  name: string;
  purchaseUnit: "G" | "ML" | "EACH";
  needed: number;
  packQuantity: number;
  packPrice: number;
  packsToBuy: number;
  orderCost: number;
  estimated: boolean;
}

interface Plan {
  suppliers: { supplier: string; lines: OrderLine[]; orderCost: number }[];
  totalOrderCost: number;
  totalUseCost: number;
  warnings: string[];
}

const UNIT: Record<string, string> = { G: "g", ML: "ml", EACH: "" };

function amount(n: number, unit: string): string {
  if (unit === "G" && n >= 1000) return `${Math.round((n / 1000) * 100) / 100} kg`;
  if (unit === "ML" && n >= 1000) return `${Math.round((n / 1000) * 100) / 100} l`;
  return `${Math.round(n * 10) / 10}${UNIT[unit] ? " " + UNIT[unit] : ""}`;
}

export default function OrdersPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [pick, setPick] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failed, setFailed] = useState(false);
  const [planError, setPlanError] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [restored, setRestored] = useState(false);

  // The list is kept in this browser so a reload does not empty it.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("gp-order-items");
      if (saved) setChosen(JSON.parse(saved));
    } catch {
      // nothing saved or storage blocked
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem("gp-order-items", JSON.stringify(chosen));
    } catch {
      // not remembered, still works
    }
  }, [chosen, restored]);

  useEffect(() => {
    Promise.all([fetch("/api/dishes").then((r) => r.json()), fetch("/api/batch-recipes").then((r) => r.json())])
      .then(([dishes, batches]: [{ id: string; name: string }[], { id: string; name: string; isDraft: boolean }[]]) =>
        setOptions([
          ...dishes.map((d) => ({ kind: "dish" as const, id: d.id, name: d.name })),
          ...batches.filter((b) => !b.isDraft).map((b) => ({ kind: "batch" as const, id: b.id, name: b.name })),
        ])
      )
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const items = chosen.filter((c) => c.quantity > 0);
    if (items.length === 0) {
      setPlan(null);
      setPlanError(false);
      return;
    }
    setPlanning(true);
    let stale = false; // ignore an answer that arrives after the list has changed again
    const timer = setTimeout(() => {
      fetch("/api/orders/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(({ kind, id, quantity }) => ({ kind, id, quantity })) }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("bad response");
          return r.json();
        })
        .then((p) => {
          if (stale) return;
          setPlan(p);
          setPlanError(false);
        })
        .catch(() => {
          if (!stale) setPlanError(true);
        })
        .finally(() => {
          if (!stale) setPlanning(false);
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [chosen]);

  const available = useMemo(() => options.filter((o) => !chosen.some((c) => c.kind === o.kind && c.id === o.id)), [options, chosen]);

  function add() {
    const opt = available.find((o) => `${o.kind}:${o.id}` === pick);
    if (!opt) return;
    setChosen((prev) => [...prev, { ...opt, quantity: 0 }]);
    setPick("");
  }

  function asText(p: Plan): string {
    return p.suppliers
      .map((s) => `${s.supplier}\n` + s.lines.map((l) => `  ${l.name}: ${l.packsToBuy} x ${amount(l.packQuantity, l.purchaseUnit)} (need ${amount(l.needed, l.purchaseUnit)})`).join("\n"))
      .join("\n\n");
  }

  return (
    <main>
      <PageTitle title="What to buy" />
      <h1>What to buy</h1>
      <p>
        Choose what you plan to make and how many. You get what to buy from each supplier, in whole packs. Batch recipes
        are opened up, so you order their ingredients.
      </p>

      <div>
        <div>
          <label htmlFor="pick">Add a dish or batch recipe</label>
          <select id="pick" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose…</option>
            <optgroup label="Dishes">
              {available.filter((o) => o.kind === "dish").map((o) => (
                <option key={o.id} value={`dish:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Batch recipes">
              {available.filter((o) => o.kind === "batch").map((o) => (
                <option key={o.id} value={`batch:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <button type="button" onClick={add} disabled={!pick}>
          Add
        </button>
        {chosen.length > 0 && (
          <button type="button" onClick={() => setChosen([])}>
            Clear list
          </button>
        )}
      </div>
      {failed && (
        <p role="alert">
          Could not load dishes. Reload the page to try again.
        </p>
      )}

      {chosen.length === 0 ? (
        <p>Nothing chosen yet. Add the dishes you expect to sell, then enter how many portions of each.</p>
      ) : (
        <ul>
          {chosen.map((c, i) => (
            <li key={`${c.kind}-${c.id}`}>
              <span>{c.name}</span>
              <label htmlFor={`qty-${i}`}>
                {c.kind === "dish" ? "Portions" : "Batches"} of {c.name}
              </label>
              <input
                id={`qty-${i}`}
                type="number"
                min="0"
                step="any"
                value={c.quantity || ""}
                onChange={(e) => setChosen((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}
              />
              <span>{c.kind === "dish" ? "portions" : "batches"}</span>
              <button type="button" onClick={() => setChosen((prev) => prev.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {copyFailed && (
          <p role="alert">
            Could not copy to the clipboard. Use Print instead, or select the list and copy it by hand.
          </p>
        )}
        {chosen.length > 0 && chosen.every((c) => !(c.quantity > 0)) && (
          <p>Enter a number for at least one item to see what to buy.</p>
        )}
        {planning && <p>Working out the list…</p>}
        {planError && (
          <p role="alert">
            Could not work out the list. Check your connection, then change a quantity to try again.
          </p>
        )}
      </div>

      {plan && (
        <section>
          <div>
            <h2>What to buy</h2>
            <div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(asText(plan));
                    setCopyFailed(false);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopyFailed(true);
                  }
                }}
              >
                {copied ? "Copied" : "Copy as text"}
              </button>
              <button type="button" onClick={() => window.print()}>
                Print
              </button>
            </div>
          </div>
          <dl>
            <div>
              <dt>You pay for the packs</dt>
              <dd>{formatTHB(plan.totalOrderCost)}</dd>
            </div>
            <div>
              <dt>What you will actually use</dt>
              <dd>{formatTHB(plan.totalUseCost)}</dd>
            </div>
          </dl>
          {plan.warnings.map((w) => (
            <p key={w}>
              {w}
            </p>
          ))}
          {plan.suppliers.map((s) => (
            <div key={s.supplier}>
              <h3>
                <span>{s.supplier}</span>
                <span>{formatTHB(s.orderCost)}</span>
              </h3>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Ingredient</th>
                      <th scope="col">Need</th>
                      <th scope="col">Buy</th>
                      <th scope="col">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.lines.map((l) => (
                      <tr key={l.ingredientId}>
                        <td>
                          {l.name}
                          {l.estimated && (
                            <span>Price is a guess</span>
                          )}
                        </td>
                        <td>{amount(l.needed, l.purchaseUnit)}</td>
                        <td>
                          {l.packsToBuy} {l.packsToBuy === 1 ? "pack" : "packs"} of {amount(l.packQuantity, l.purchaseUnit)}
                        </td>
                        <td>{formatTHB(l.orderCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
