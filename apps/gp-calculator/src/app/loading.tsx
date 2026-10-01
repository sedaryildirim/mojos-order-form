import { ListSkeleton } from "@/components/layout/Skeleton";

// Shown while a server-rendered page waits for its data.
export default function Loading() {
  return (
    <main>
      <ListSkeleton label="Loading" rows={6} />
    </main>
  );
}
