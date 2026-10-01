import { prisma } from "@/lib/db/prisma";
import { SpecSheet } from "@/components/dishes/SpecSheet";
import { notFound } from "next/navigation";
import type { SpecSheetVersion } from "@/components/dishes/SpecSheet";

export default async function SharePage({ params }: { params: { token: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { shareToken: params.token },
    include: { lines: true, dish: true },
  });
  if (!version) notFound();

  return (
    <main>
      <SpecSheet version={version as unknown as SpecSheetVersion} />
    </main>
  );
}
