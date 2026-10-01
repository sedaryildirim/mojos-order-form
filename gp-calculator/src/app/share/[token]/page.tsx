import { prisma } from "@/lib/prisma";
import { SpecSheet } from "@/components/SpecSheet";
import { notFound } from "next/navigation";
import type { SpecSheetVersion } from "@/components/SpecSheet";

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
