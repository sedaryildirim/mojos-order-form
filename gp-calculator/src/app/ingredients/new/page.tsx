"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IngredientForm, IngredientFormValues } from "@/components/IngredientForm";
import { setFlash } from "@/lib/flash";

export default function NewIngredientPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then(setSuppliers);
  }, []);

  async function handleSubmit(values: IngredientFormValues) {
    const res = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setFlash(`Added ${values.name}.`);
      router.push("/ingredients");
    } else {
      setError("Could not save this ingredient. Please try again.");
    }
  }

  return (
    <main>
      <h1>New ingredient</h1>
      <div>
        {error && <p role="alert">{error}</p>}
        <IngredientForm suppliers={suppliers} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
