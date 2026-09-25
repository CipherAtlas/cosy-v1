import type { Metadata } from "next";
import { Outfit, Raleway } from "next/font/google";
import { withBasePath } from "@/lib/basePath";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-raleway"
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "Cosy — a quiet village",
  description: "A quiet village for focus, music, breathing, and a little time for yourself.",
  icons: {
    icon: withBasePath("/icon.svg"),
    shortcut: withBasePath("/icon.svg"),
    apple: withBasePath("/icon.svg")
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var raw=localStorage.getItem("peaceful-room-theme");var t=raw==="dark"?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${raleway.variable} ${outfit.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
