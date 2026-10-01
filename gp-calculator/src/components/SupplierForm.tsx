"use client";

import Link from "next/link";
import { useState } from "react";
import { supplierInputSchema } from "@/lib/validation";
import { useRememberedName } from "@/lib/use-remembered-name";
import { FieldError } from "./FieldError";

export interface SupplierFormValues {
  name: string;
  contactInfo: string;
  createdBy: string;
}

export function SupplierForm({
  initialValues,
  cancelHref = "/suppliers",
  onSubmit,
}: {
  initialValues?: SupplierFormValues;
  cancelHref?: string;
  onSubmit: (values: SupplierFormValues) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<SupplierFormValues>(
    initialValues ?? { name: "", contactInfo: "", createdBy: "" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  useRememberedName(values.createdBy, (n) => setValues((v) => ({ ...v, createdBy: n })));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = supplierInputSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Supplier name</label>
        <input
          id="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div>
        <label htmlFor="contactInfo">Contact info</label>
        <textarea
          id="contactInfo"
          rows={3}
          value={values.contactInfo}
          onChange={(e) => setValues({ ...values, contactInfo: e.target.value })}
        />
        <p>Phone, address or anything useful when ordering.</p>
      </div>
      <div>
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save supplier"}
        </button>
        <Link href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
