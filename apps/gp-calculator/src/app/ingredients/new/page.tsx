"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IngredientForm, IngredientFormValues } from "@/components/ingredients/IngredientForm";
import { setFlash } from "@/lib/client/flash";
import { safeFetch, apiError } from "@/lib/client/api";
import { PageTitle } from "@/components/layout/PageTitle";

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
    const res = await safeFetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setFlash(`Added ${values.name}.`);
      router.push("/ingredients");
    } else {
      setError(await apiError(res, "Could not save this ingredient. Please try again."));
    }
  }

  return (
    <main>
      <PageTitle title="New ingredient" />
      <h1>New ingredient</h1>
      <div>
        {error && <p role="alert">{error}</p>}
        <IngredientForm suppliers={suppliers} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
