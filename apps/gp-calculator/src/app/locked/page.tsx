import { LockedScreen } from "@/components/layout/LockedScreen";

export const metadata = { title: "Enter password", robots: { index: false, follow: false } };

// Shown in place of any page while signed out. The shapes behind the dialog only stand in for a page:
// no data is loaded here.
export default function LockedPage() {
  return (
    <>
      <main aria-hidden="true" data-locked-backdrop>
      <div data-ghost="title" />
      <div data-ghost="bar" />
      <div data-ghost="grid">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div data-ghost="rows">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      </main>
      <LockedScreen />
    </>
  );
}
