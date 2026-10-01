import type { Metadata } from "next";
import { Calistoga, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PasswordGate } from "@/components/PasswordGate";
import { HOME_URL } from "@/lib/site";

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
        <PasswordGate>
        <a href="#main">
          Skip to content
        </a>
        <nav aria-label="Main">
          <div>
            <Link href="/">
              GP Calculator
            </Link>
            <NavLinks />
            <div>
              <a href={HOME_URL} data-home>
                ← Menu
              </a>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <FlashMessage />
        <div id="main">{children}</div>
        </PasswordGate>
      </body>
    </html>
  );
}
