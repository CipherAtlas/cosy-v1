import { ReactNode } from "react";
import { PageTransition } from "@/components/transition/PageTransition";

export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
