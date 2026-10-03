"use client";

import { useEffect, useState } from "react";

export interface PickableIngredient {
  id: string;
  name: string;
  category: string;
  supplier: { name: string };
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: string;
  packPrice: string;
  yieldPct: string;
}

export function IngredientPicker({
  suppliers,
  categories,
  onSelect,
}: {
  suppliers: { id: string; name: string }[];
  categories: string[];
  onSelect: (ingredient: PickableIngredient) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [ingredients, setIngredients] = useState<PickableIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (supplierId) params.set("supplierId", supplierId);
    if (category) params.set("category", category);
    fetch(`/api/ingredients?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d) => setIngredients(d))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [supplierId, category, reloadKey]);

  const filtered = ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div data-picker>
      <div>
        <div>
          <label htmlFor="picker-supplier">
            Supplier
          </label>
          <select id="picker-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="picker-category">
            Category
          </label>
          <select id="picker-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="picker-search">
            Search ingredients
          </label>
          <input
            id="picker-search"
            placeholder="Search ingredients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Enter must not save the recipe form this picker sits in; it picks the top match instead
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[0]) onSelect(filtered[0]);
              }
            }}
          />
        </div>
      </div>
      {failed ? (
        <p role="alert">
          Could not load ingredients.{" "}
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </p>
      ) : loading ? (
        <p>Loading ingredients…</p>
      ) : filtered.length === 0 ? (
        <p>No ingredients match. Clear the search or a filter.</p>
      ) : (
        <ul>
          {filtered.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onSelect(i)}>
                {i.name} <span>· {i.supplier.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
