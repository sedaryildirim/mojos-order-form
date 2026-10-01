import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// A dish opens straight onto its current recipe; earlier versions stay stored but aren't listed.
export default async function DishPage({ params }: { params: { id: string } }) {
  const dish = await prisma.dish.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true } } },
  });
  if (!dish) notFound();
  if (dish.versions[0]) redirect(`/dishes/${dish.id}/versions/${dish.versions[0].id}`);

  return (
    <main>
      <Link href="/dishes">
        ← All dishes
      </Link>
      <h1>{dish.name}</h1>
      <p>No recipe yet.</p>
      <Link href={`/dishes/${dish.id}/versions/new`}>
        Build recipe
      </Link>
    </main>
  );
}
