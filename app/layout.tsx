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
  title: "Hearthwillow",
  description: "A quiet village for focus, music, breathing, and a little time for yourself.",
  icons: {
    icon: [
      { url: withBasePath("/favicon.ico?v=20261010-white"), sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: withBasePath("/hearthwillow-icon-32.png?v=20261010-white"), sizes: "32x32", type: "image/png" },
      { url: withBasePath("/hearthwillow-icon-192.png?v=20261010-white"), sizes: "192x192", type: "image/png" }
    ],
    shortcut: withBasePath("/favicon.ico?v=20261010-white"),
    apple: { url: withBasePath("/hearthwillow-apple-icon.png"), sizes: "180x180", type: "image/png" }
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
