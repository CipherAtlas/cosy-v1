import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import { withBasePath } from "@/lib/basePath";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-raleway"
});

export const metadata: Metadata = {
  title: "A Peaceful Room",
  description: "A calm, intimate digital room for gentle focus and rest.",
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
      <body className={`${raleway.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
