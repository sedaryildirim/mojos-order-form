"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRememberedName } from "@/lib/use-remembered-name";

export default function NewDishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  useRememberedName(createdBy, setCreatedBy);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    const res = await fetch("/api/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, createdBy }),
    });
    const dish = await res.json();
    if (!res.ok) {
      setError("Could not create dish. Please fill in all fields and try again.");
      return;
    }
    router.push(`/dishes/${dish.id}/versions/new`);
  }

  return (
    <main>
      <h1>New dish</h1>
      <div>
        <div>
          <label htmlFor="name">Dish name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        {error && <p role="alert">{error}</p>}
        <button onClick={handleCreate}>Continue to recipe</button>
      </div>
    </main>
  );
}
