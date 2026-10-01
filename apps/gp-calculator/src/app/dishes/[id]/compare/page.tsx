import { prisma } from "@/lib/db/prisma";
import { diffVersionLines } from "@/lib/reports/diff";
import { VersionCompare } from "@/components/dishes/VersionCompare";
import { notFound } from "next/navigation";

type VersionProps = Parameters<typeof VersionCompare>[0]["oldVersion"];

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { a?: string; b?: string };
}) {
  if (!searchParams.a || !searchParams.b) notFound();

  // Fold the dish-ownership check into the query itself (rather than
  // fetching by id alone and checking dishId after) — this naturally
  // returns null, and therefore a clean notFound(), when a version id from
  // a different dish is passed in the URL, instead of producing a
  // nonsensical cross-dish diff.
  const [oldVersion, newVersion] = await Promise.all([
    prisma.dishVersion.findUnique({ where: { id: searchParams.a, dishId: params.id }, include: { lines: true } }),
    prisma.dishVersion.findUnique({ where: { id: searchParams.b, dishId: params.id }, include: { lines: true } }),
  ]);
  if (!oldVersion || !newVersion) notFound();

  const diffs = diffVersionLines(
    oldVersion.lines as unknown as Parameters<typeof diffVersionLines>[0],
    newVersion.lines as unknown as Parameters<typeof diffVersionLines>[1]
  );

  return (
    <main>
      <h1>Compare versions</h1>
      <div>
        <VersionCompare oldVersion={oldVersion as unknown as VersionProps} newVersion={newVersion as unknown as VersionProps} diffs={diffs} />
      </div>
    </main>
  );
}
