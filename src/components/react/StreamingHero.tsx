"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import Floating, { FloatingElement } from "./parallax-floating";

interface Props {
  posters: string[];
}

// Positions mirror the reference layout (spread around the centered text)
const LAYOUT = [
  { depth: 0.5, className: "top-[8%] left-[11%]",  size: "w-16 h-24 md:w-24 md:h-36" },
  { depth: 1,   className: "top-[10%] left-[32%]", size: "w-20 h-28 md:w-28 md:h-40" },
  { depth: 2,   className: "top-[2%] left-[55%]",  size: "w-28 h-40 md:w-36 md:h-52" },
  { depth: 1,   className: "top-[0%] left-[83%]",  size: "w-24 h-32 md:w-32 md:h-44" },
  { depth: 1,   className: "top-[40%] left-[2%]",  size: "w-24 h-36 md:w-32 md:h-48" },
  { depth: 2,   className: "top-[70%] left-[77%]", size: "w-28 h-40 md:w-36 md:h-52" },
  { depth: 4,   className: "top-[73%] left-[15%]", size: "w-32 h-44 md:w-44 md:h-64" },
  { depth: 1,   className: "top-[80%] left-[50%]", size: "w-24 h-32 md:w-32 md:h-44" },
];

export default function StreamingHero({ posters }: Props) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    animate("img", { opacity: 1 }, { duration: 0.5, delay: stagger(0.15) });
  }, [animate]);

  const imgs = posters.length ? posters : [];

  return (
    <div
      ref={scope}
      className="relative flex w-full min-h-[560px] md:min-h-[640px] items-center justify-center overflow-hidden"
      style={{ background: "transparent" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.22), rgba(168,85,247,0.14) 45%, transparent 70%)" }}
      />

      {/* Centered content */}
      <motion.div
        className="z-40 flex max-w-2xl flex-col items-center px-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.88, delay: 1.2 }}
      >
        <span
          className="mb-5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "#f5c518", background: "rgba(245,197,24,0.12)", border: "1px solid rgba(245,197,24,0.28)" }}
        >
          ★ Premium Streaming
        </span>

        <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
          Stream Unlimited Movies &amp; TV Series Online in HD
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">
          The ultimate destination for online streaming. Binge the latest trending
          films and series — a massive library of HD titles, no subscription walls,
          no endless ads, straight in your browser.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/movies"
            className="rounded-full px-7 py-3 text-sm font-semibold text-white transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
          >
            Start Watching
          </a>
          <a
            href="/series"
            className="rounded-full px-7 py-3 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.2)" }}
          >
            Browse Series
          </a>
        </div>
      </motion.div>

      {/* Floating posters */}
      <Floating sensitivity={-1} className="overflow-hidden">
        {LAYOUT.map((slot, i) => (
          <FloatingElement key={i} depth={slot.depth} className={slot.className}>
            <motion.img
              initial={{ opacity: 1 }}
              src={imgs[i % (imgs.length || 1)]}
              alt=""
              className={`${slot.size} cursor-pointer rounded-lg object-cover shadow-2xl transition-transform duration-200 hover:scale-105`}
            />
          </FloatingElement>
        ))}
      </Floating>
    </div>
  );
}
