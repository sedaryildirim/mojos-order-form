import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { ingredients: { where: { archived: false } } } } },
  });

  return (
    <main>
      <div>
        <div>
          <h1>Suppliers</h1>
          <p>{suppliers.length} suppliers</p>
        </div>
        <Link href="/suppliers/new">
          New supplier
        </Link>
      </div>

      <div>
        {suppliers.map((s) => {
          const estimated = s.name.startsWith("Placeholder");
          return (
            <Link
              key={s.id}
              href={`/suppliers/${s.id}`}
            >
              <div>
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt={`${s.name} logo`} />
                ) : (
                  <span
                    aria-hidden="true"
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div>
                  <h2>{s.name}</h2>
                  {estimated && (
                    <span>
                      Estimated
                    </span>
                  )}
                </div>
                {s.contactInfo && <p>{s.contactInfo}</p>}
                <p>
                  <span>{s._count.ingredients}</span>{" "}
                  <span>ingredients</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
