"use client";

import { useRouter } from "next/navigation";
import { SupplierForm, SupplierFormValues } from "@/components/SupplierForm";
import { setFlash } from "@/lib/flash";

export default function NewSupplierPage() {
  const router = useRouter();

  async function handleSubmit(values: SupplierFormValues) {
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setFlash(`Added ${values.name}.`);
      router.refresh();
      router.push("/suppliers");
    }
  }

  return (
    <main>
      <h1>New supplier</h1>
      <div>
        <SupplierForm onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
