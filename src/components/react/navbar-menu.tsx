"use client";
import React from "react";
import { motion } from "framer-motion";

const transition = {
  type: "spring" as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export const MenuItem = ({
  setActive,
  active,
  item,
  href,
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  href?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div onMouseEnter={() => setActive(item)} className="relative">
      <motion.a
        href={href}
        transition={{ duration: 0.3 }}
        className="nav-menu-trigger cursor-pointer"
        style={{ color: "var(--color-text)" }}
      >
        {item}
      </motion.a>
      {active !== null && children && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-5">
              <motion.div
                transition={transition}
                layoutId="active"
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                }}
              >
                <motion.div layout className="w-max h-full p-4">
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const HoveredLink = ({ children, ...rest }: any) => {
  return (
    <a {...rest} className="nav-menu-link" style={{ color: "var(--color-text-2)", display: "block" }}>
      {children}
    </a>
  );
};

export const ProductItem = ({
  title,
  description,
  href,
  src,
}: {
  title: string;
  description: string;
  href: string;
  src: string;
}) => {
  return (
    <a href={href} className="flex items-center gap-3">
      <img
        src={src}
        alt={title}
        loading="lazy"
        className="flex-shrink-0 rounded-md shadow-2xl"
        style={{ width: 120, height: 70, objectFit: "cover" }}
      />
      <div>
        <h4 className="text-sm font-bold mb-0.5" style={{ color: "var(--color-text)" }}>
          {title}
        </h4>
        <p className="text-xs max-w-[10rem]" style={{ color: "var(--color-text-3)" }}>
          {description}
        </p>
      </div>
    </a>
  );
};
