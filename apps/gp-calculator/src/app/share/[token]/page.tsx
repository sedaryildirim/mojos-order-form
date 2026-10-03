import { prisma } from "@/lib/db/prisma";
import { SpecSheet } from "@/components/dishes/SpecSheet";
import { notFound } from "next/navigation";
import type { SpecSheetVersion } from "@/components/dishes/SpecSheet";
import { PageTitle } from "@/components/layout/PageTitle";

export default async function SharePage({ params }: { params: { token: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { shareToken: params.token },
    include: { lines: true, dish: true },
  });
  if (!version) notFound();

  return (
    <main>
      <PageTitle title={version.dish.name} />
      <SpecSheet version={version as unknown as SpecSheetVersion} />
    </main>
  );
}
