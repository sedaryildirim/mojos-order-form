import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Not found</h1>
      <p>That page or record does not exist. It may have been removed, or the link is wrong.</p>
      <div>
        <Link href="/dishes">Dishes</Link>
        <Link href="/ingredients">Ingredients</Link>
        <Link href="/suppliers">Suppliers</Link>
      </div>
    </main>
  );
}
