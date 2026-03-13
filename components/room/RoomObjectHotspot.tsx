"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/animation";
import { setTransitionOrigin } from "@/lib/transition";
import { RoomHotspot } from "@/types/room";

type RoomObjectHotspotProps = {
  hotspot: RoomHotspot;
  onHoverChange?: (id: RoomHotspot["id"], isHovered: boolean) => void;
};

export const RoomObjectHotspot = ({ hotspot, onHoverChange }: RoomObjectHotspotProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="absolute"
      style={hotspot.position}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
      transition={{ duration: MOTION.hoverFast, ease: MOTION.ease }}
    >
      <Link
        href={hotspot.href}
        aria-label={`Open ${hotspot.label}`}
        className="group block h-full w-full rounded-2xl focus-visible:outline-offset-4"
        onClick={() => setTransitionOrigin(hotspot.transitionOrigin)}
        onMouseEnter={() => onHoverChange?.(hotspot.id, true)}
        onMouseLeave={() => onHoverChange?.(hotspot.id, false)}
        onFocus={() => onHoverChange?.(hotspot.id, true)}
        onBlur={() => onHoverChange?.(hotspot.id, false)}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent bg-white/0 transition-all duration-200 group-hover:border-white/30 group-hover:bg-white/5"
        />
      </Link>
    </motion.div>
  );
};
