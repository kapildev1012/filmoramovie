"use client";
import React from "react";
import { motion } from "motion/react";

export interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <div
                  className="t-card p-8 rounded-3xl border border-border max-w-xs w-full"
                  style={{
                    background: "var(--color-surface)",
                    boxShadow: "0 10px 30px rgba(161,66,244,0.08)",
                  }}
                  key={i}
                >
                  <div style={{ color: "var(--color-text)", lineHeight: 1.6, fontSize: "0.9375rem" }}>
                    {text}
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <img
                      width={40}
                      height={40}
                      src={image}
                      alt={name}
                      loading="lazy"
                      className="h-10 w-10 rounded-full"
                      style={{ objectFit: "cover" }}
                    />
                    <div className="flex flex-col">
                      <div
                        className="font-medium tracking-tight leading-5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {name}
                      </div>
                      <div
                        className="leading-5 tracking-tight"
                        style={{ color: "var(--color-text-3)" }}
                      >
                        {role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  );
};
