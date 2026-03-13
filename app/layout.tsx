import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-raleway"
});

export const metadata: Metadata = {
  title: "A Peaceful Room",
  description: "A calm, intimate digital room for gentle focus and rest."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${raleway.variable} antialiased`}>{children}</body>
    </html>
  );
}
