import type { Metadata } from "next";
import { Calistoga, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FlashMessage } from "@/components/layout/FlashMessage";
import { NavLinks } from "@/components/layout/NavLinks";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LockButton } from "@/components/layout/LockButton";
import { TableAlign } from "@/components/layout/TableAlign";
import { GP_HOME_URL, HOME_URL } from "@/lib/client/site";

const calistoga = Calistoga({ weight: "400", subsets: ["latin"], variable: "--font-calistoga", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// Runs before paint so the saved theme (dark by default) never flashes.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mojos_theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export const metadata: Metadata = {
  title: { default: "GP Calculator", template: "%s · GP Calculator" },
  description: "Suppliers, ingredients, and dish costing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${calistoga.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
      >
        <a href="#main">
          Skip to content
        </a>
        <nav aria-label="Main">
          <div>
            <Link href={GP_HOME_URL}>
              GP Calculator
            </Link>
            <NavLinks />
            <div>
              <a href={HOME_URL} data-home>
                ← All tools
              </a>
              <ThemeToggle />
              <LockButton />
            </div>
          </div>
        </nav>
        <FlashMessage />
        <TableAlign />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
