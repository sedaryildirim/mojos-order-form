import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

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
        <table>
          <thead>
            <tr>
              <th scope="col">Supplier</th>
              <th scope="col">Ingredients</th>
              <th scope="col">Contact</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/suppliers/${s.id}`}>{s.name}</Link>
                  {s.name.startsWith("Placeholder") && <span>Guessed prices</span>}
                </td>
                <td>{s._count.ingredients}</td>
                <td>{s.contactInfo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
