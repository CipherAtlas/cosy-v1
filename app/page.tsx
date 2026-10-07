import type { Metadata } from "next";
import { Village } from "@/features/village/Village";

export const metadata: Metadata = {
  title: "Hearthwillow",
  description: "Shared village with farming, cooking, picnics and private focus sessions.",
};

export default function HomePage() {
  return <Village />;
}
