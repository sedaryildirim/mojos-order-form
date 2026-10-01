import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { estimateNote, findEstimatedIngredientIds } from "@/lib/estimates";
import { SupplierIngredients } from "@/components/SupplierIngredients";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: params.id }, select: { name: true } });
  return { title: supplier?.name ?? "Supplier" };
}

export default async function SupplierPage({ params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      ingredients: { where: { archived: false }, orderBy: [{ category: "asc" }, { name: "asc" }] },
    },
  });
  if (!supplier) notFound();

  const estimatedIds = await findEstimatedIngredientIds();
  const estimated = supplier.name.startsWith("Placeholder");
  return (
    <main>
      <Link href="/suppliers">
        ← All suppliers
      </Link>

      <section>
        <div>
          {supplier.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={supplier.logoUrl} alt={`${supplier.name} logo`} />
          ) : (
            <span
              aria-hidden="true"
            >
              {supplier.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <div>
            <h1>{supplier.name}</h1>
            {estimated && (
              <span>Estimated</span>
            )}
            {supplier.archived && (
              <span>archived</span>
            )}
          </div>
          {supplier.contactInfo && (
            <p>{supplier.contactInfo}</p>
          )}
          <p>
            <span>{supplier.ingredients.length}</span> ingredients
          </p>
        </div>
        <Link href={`/suppliers/${supplier.id}/edit`}>
          Edit supplier
        </Link>
      </section>

      <div>
        <h2>Ingredients from {supplier.name}</h2>
        <div>
          <a
            href={`/api/ingredients/export?supplierId=${supplier.id}`}
          >
            Download template
          </a>
          <Link href="/ingredients/new">
            New ingredient
          </Link>
        </div>
      </div>

      {supplier.ingredients.length === 0 ? (
        <p>No ingredients from this supplier yet.</p>
      ) : (
        <SupplierIngredients
          supplierIsPlaceholder={estimated}
          rows={supplier.ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            purchaseUnit: i.purchaseUnit,
            packQuantity: Number(i.packQuantity),
            packPrice: Number(i.packPrice),
            yieldPct: Number(i.yieldPct),
            estimateNote: estimateNote(i, estimatedIds),
          }))}
        />
      )}
    </main>
  );
}
