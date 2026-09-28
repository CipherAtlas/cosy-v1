import type { Metadata } from "next";
import { Village } from "@/features/village/Village";

export const metadata: Metadata = {
  title: "Hearthwillow — a quiet village",
  description: "Visit Hearthwillow for focus, music, breathing, and a little time for yourself.",
};

export default function HomePage() {
  return <Village />;
}
