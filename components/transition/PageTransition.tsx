"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import { MOTION } from "@/lib/animation";
import { consumeTransitionOrigin } from "@/lib/transition";

export const PageTransition = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const origin = useMemo(() => consumeTransitionOrigin(pathname), [pathname]);

  if (shouldReduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={pathname}
        className="min-h-screen"
        style={{ transformOrigin: origin }}
        initial={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.99, filter: "blur(6px)" }}
        transition={{ duration: MOTION.pageTransition, ease: MOTION.ease }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
};
