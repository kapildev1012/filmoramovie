"use client";
import { TestimonialsColumn, type Testimonial } from "./testimonials-columns-1";
import { motion } from "motion/react";

const testimonials: Testimonial[] = [
  {
    text: "Finally a streaming hub that shows the real Top 10 across Netflix, Prime and Disney+ in one place. No more app-hopping to find what's trending.",
    image: "https://randomuser.me/api/portraits/women/1.jpg",
    name: "Briana Patton",
    role: "Binge-watcher",
  },
  {
    text: "The HD playback is buttery smooth and the search actually finds what I want. Discovered three new series in my first week.",
    image: "https://randomuser.me/api/portraits/men/2.jpg",
    name: "Bilal Ahmed",
    role: "Film Enthusiast",
  },
  {
    text: "Clean, fast and zero clutter. The watchlist syncs perfectly and the multi-language subtitles are a lifesaver for foreign cinema.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
    name: "Saman Malik",
    role: "Anime Fan",
  },
  {
    text: "I love how it pulls trending movies and shows from every platform. The interface feels premium without the subscription price.",
    image: "https://randomuser.me/api/portraits/men/4.jpg",
    name: "Omar Raza",
    role: "Series Addict",
  },
  {
    text: "The Top 10 rails update daily and the recommendations are genuinely good. It's become my go-to before movie night.",
    image: "https://randomuser.me/api/portraits/women/5.jpg",
    name: "Zainab Hussain",
    role: "Casual Viewer",
  },
  {
    text: "Works flawlessly on my phone, laptop and TV browser. No app install, no buffering, just instant streaming every time.",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
    name: "Aliza Khan",
    role: "Mobile Streamer",
  },
  {
    text: "The dark mode is gorgeous and the poster grids load instantly. Best-looking movie discovery site I've used.",
    image: "https://randomuser.me/api/portraits/men/7.jpg",
    name: "Farhan Siddiqui",
    role: "Design Lover",
  },
  {
    text: "Bollywood, Hollywood, anime and regional films all in one spot. The platform filters make finding regional content effortless.",
    image: "https://randomuser.me/api/portraits/women/8.jpg",
    name: "Sana Sheikh",
    role: "World Cinema Fan",
  },
  {
    text: "Bookmarked it on day one. The continue-watching row and instant search keep me coming back every single evening.",
    image: "https://randomuser.me/api/portraits/men/9.jpg",
    name: "Hassan Ali",
    role: "Daily User",
  },
];

const firstColumn  = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn  = testimonials.slice(6, 9);

export default function Testimonials() {
  return (
    <section className="t-section">
      <div className="container t-inner">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="t-header"
        >
          <span className="t-badge">Testimonials</span>
          <h2 className="t-title">Loved by movie fans everywhere</h2>
          <p className="t-sub">See what our viewers say about streaming with FilmoraMovie.</p>
        </motion.div>

        {/* Columns */}
        <div className="t-columns">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="t-col-md" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn}  className="t-col-lg"  duration={17} />
        </div>
      </div>

      <style>{`
        .t-section { position: relative; margin: 0 0 2rem; overflow: hidden; }
        .t-inner { margin: 0 auto; }

        .t-header {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; max-width: 540px; margin: 0 auto 2rem; padding: 0 1rem;
        }
        .t-badge {
          display: inline-block; font-size: 0.6875rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-text-2); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 0.25rem 0.875rem; margin-bottom: 1rem;
        }
        .t-title {
          font-size: clamp(1.375rem, 5vw, 2.25rem); font-weight: 800;
          color: var(--color-text); letter-spacing: -0.025em;
          line-height: 1.15; margin: 0 0 0.75rem;
        }
        .t-sub {
          font-size: clamp(0.875rem, 2.5vw, 0.9375rem);
          color: var(--color-text-2); line-height: 1.6; margin: 0;
        }

        /* Columns wrapper */
        .t-columns {
          display: flex; justify-content: center; gap: 1rem;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
        }

        /* Mobile: 1 column, full-width cards aligned to the container edge */
        @media (max-width: 639px) {
          .t-columns { max-height: 430px; }
          .t-col-md, .t-col-lg { display: none !important; }
          .t-columns > *:first-child { width: 100%; max-width: 100%; }
          .t-header { padding: 0; margin-bottom: 1.5rem; }
          .t-card {
            max-width: 100% !important;
            width: 100% !important;
            padding: 1.375rem !important;
            border-radius: 18px !important;
          }
        }
        /* Tablet: 2 columns */
        @media (min-width: 640px) {
          .t-columns { max-height: 600px; }
          .t-col-md { display: block; }
          .t-col-lg { display: none !important; }
        }
        /* Desktop: 3 columns */
        @media (min-width: 1024px) {
          .t-columns { max-height: 700px; }
          .t-col-lg { display: block; }
        }
      `}</style>
    </section>
  );
}
