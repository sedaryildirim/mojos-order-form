"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SupplierForm, SupplierFormValues } from "@/components/SupplierForm";
import { requireActor } from "@/lib/actor";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListSkeleton, LoadError } from "@/components/Skeleton";
import { setFlash } from "@/lib/flash";

export default function EditSupplierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<SupplierFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoadError(false);
    fetch(`/api/suppliers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((s) => setInitialValues({ name: s.name, contactInfo: s.contactInfo ?? "", createdBy: "" }))
      .catch(() => setLoadError(true));
  }, [id, reloadKey]);

  async function handleSubmit(values: SupplierFormValues) {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        contactInfo: values.contactInfo,
        updatedBy: values.createdBy, // the "Your name" field on the edit form means "who's making this edit"
      }),
    });
    if (res.ok) {
      setFlash(`Saved ${values.name}.`);
      router.refresh();
      router.push(`/suppliers/${id}`);
    } else {
      setError("Could not save changes. Please try again.");
    }
  }

  async function handleArchive() {
    const updatedBy = requireActor();
    if (!updatedBy) return;
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true, updatedBy }),
    });
    if (res.ok) {
      setFlash("Supplier archived.");
      router.refresh();
      router.push("/suppliers");
    } else {
      setError("Could not archive this supplier. Please try again.");
    }
  }

  if (!initialValues)
    return (
      <main>
        {loadError ? <LoadError what="this supplier" onRetry={() => setReloadKey((k) => k + 1)} /> : <ListSkeleton label="Loading supplier" rows={1} />}
      </main>
    );

  return (
    <main>
      <h1>Edit supplier</h1>
      <div>
        {error && (
          <p role="alert">
            {error}
          </p>
        )}
        <SupplierForm initialValues={initialValues} cancelHref={`/suppliers/${id}`} onSubmit={handleSubmit} />
        <ConfirmButton
          label="Archive this supplier"
          question="Archive this supplier? It disappears from the supplier list; its ingredients stay."
          confirmLabel="Archive"
          onConfirm={handleArchive}
        />
      </div>
    </main>
  );
}
