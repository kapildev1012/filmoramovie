"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Play, Mail, Lock } from "lucide-react";

export interface Slide {
  img: string;
  title: string;
  tagline: string;
}

interface Props {
  slides: Slide[];
  error?: string | null;
}

export default function AuthShowcase({ slides, error }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const list = slides.length ? slides : [{ img: "", title: "Filmora", tagline: "" }];

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((c) => (c + 1) % list.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [list.length]);

  return (
    <section
      className="min-h-screen p-3 antialiased [font-synthesis:none]"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[0.94fr_1.06fr]">

        {/* ── LEFT: cinematic showcase (always dark) ── */}
        <div className="relative flex min-h-[600px] justify-center overflow-hidden rounded-2xl bg-black px-7 py-12 text-white sm:px-10 lg:min-h-0 lg:py-16">
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 h-[50vh] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px]"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.25), rgba(168,85,247,0.15) 45%, transparent 70%)" }}
          />

          <div className="relative flex w-full max-w-[500px] flex-col items-center">
            {/* Brand */}
            <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
              <span className="grid size-8 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                <Play className="size-4 fill-white text-white" />
              </span>
              Filmora
            </a>

            {/* Poster grid */}
            <div className="relative mt-10 grid w-full grid-cols-[1.55fr_1fr] gap-2">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-black to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-black to-transparent" />
              <ImageTile src={list[0]?.img} active={activeIndex === 0} className="row-span-2 h-[250px]" />
              <ImageTile src={list[1 % list.length]?.img} active={activeIndex === 1 % list.length} className="h-[121px]" />
              <ImageTile src={list[3 % list.length]?.img} active={activeIndex === 3 % list.length} className="h-[121px]" />
              <ImageTile src={list[2 % list.length]?.img} active={activeIndex === 2 % list.length} className="col-span-2 h-[120px]" />
            </div>

            {/* Caption card */}
            <div className="mt-6 w-full rounded-[10px] border border-dashed border-white/15 px-5 py-4">
              <div className="flex items-end gap-4">
                <p className="line-clamp-3 flex-1 text-xs leading-4 text-white/50">
                  <span className="font-semibold text-white">{list[activeIndex]?.title}</span>
                  {list[activeIndex]?.tagline ? ` — ${list[activeIndex]?.tagline}` : ""}
                </p>
                <a href="/movies" aria-label="Browse movies" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30">
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </div>

            <p className="mt-7 max-w-[300px] text-center text-xl leading-tight text-white">
              Where every movie &amp; series finds you
            </p>

            {/* Dots */}
            <div className="mt-auto flex gap-2 pb-4 pt-8">
              {list.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={activeIndex === index ? "h-1 w-10 rounded-full bg-white" : "h-1 w-4 rounded-full bg-white/35"}
                  aria-label={`Show slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: auth form ── */}
        <div className="flex min-h-[600px] items-center justify-center px-6 py-12 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
          <AuthForm error={error} />
        </div>
      </div>
    </section>
  );
}

function ImageTile({ src, active, className }: { src?: string; active: boolean; className: string }) {
  return (
    <div className={`${className} relative overflow-visible rounded-md ${active ? "z-10" : "z-0"}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className={`h-full w-full rounded-md object-cover transition-opacity duration-700 ${active ? "opacity-100" : "opacity-40"}`}
          loading="eager"
        />
      ) : (
        <div className="h-full w-full rounded-md bg-white/5" />
      )}
      <FocusCorners active={active} />
    </div>
  );
}

function FocusCorners({ active }: { active: boolean }) {
  const base = `pointer-events-none absolute h-4 w-4 border-white/60 transition-all duration-500 ease-out ${active ? "translate-x-0 translate-y-0 opacity-100" : "opacity-0"}`;
  return (
    <>
      <div className={`${base} -left-2 -top-2 border-l border-t ${active ? "" : "-translate-x-2 -translate-y-2"}`} />
      <div className={`${base} -right-2 -top-2 border-r border-t ${active ? "" : "translate-x-2 -translate-y-2"}`} />
      <div className={`${base} -bottom-2 -left-2 border-b border-l ${active ? "" : "-translate-x-2 translate-y-2"}`} />
      <div className={`${base} -bottom-2 -right-2 border-b border-r ${active ? "" : "translate-x-2 translate-y-2"}`} />
    </>
  );
}

function AuthForm({ error }: { error?: string | null }) {
  const [notice, setNotice] = useState<string | null>(null);
  const comingSoon = () =>
    setNotice("That option is coming soon — continue with Google for now.");

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="text-center">
        <h1
          className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          style={{ color: "var(--color-text)" }}
        >
          Welcome back
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--color-text-2)" }}>
          Sign in to sync your watchlist, ratings and profiles.
        </p>
      </div>

      {error && (
        <div
          className="mt-6 flex items-center gap-2 rounded-[10px] px-4 py-3 text-sm"
          role="alert"
          style={{ background: "rgba(238,68,68,0.08)", border: "1px solid rgba(238,68,68,0.25)", color: "var(--color-error)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </div>
      )}

      {notice && (
        <div
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          role="status"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "var(--color-text)" }}
        >
          {notice}
        </div>
      )}

      {/* Social sign-in */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {/* Google — REAL OAuth */}
        <a
          href="/api/auth/google"
          className="flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-sm font-medium leading-none transition-colors"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}
        >
          <GoogleIcon />
          <span className="whitespace-nowrap">Continue with Google</span>
        </a>
        {/* Apple — UI (no backend yet) */}
        <button
          type="button"
          onClick={comingSoon}
          className="flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-sm font-medium leading-none transition-colors"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}
        >
          <AppleIcon />
          <span className="whitespace-nowrap">Continue with Apple</span>
        </button>
      </div>

      {/* Divider */}
      <div className="my-7 flex items-center gap-4 text-sm" style={{ color: "var(--color-text-3)" }}>
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
        or sign in with email
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
      </div>

      {/* Email / password */}
      <form
        className="space-y-4 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          setNotice("Email sign-in is coming soon — please continue with Google for now.");
        }}
      >
        <Field icon={<Mail className="size-4" />} label="Email" type="email" name="email" placeholder="you@example.com" />
        <Field icon={<Lock className="size-4" />} label="Password" type="password" name="password" placeholder="••••••••" />

        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--color-text-3)" }}>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-3.5 rounded-[3px] accent-[#6366f1]" />
            Remember me
          </label>
          <button type="button" onClick={comingSoon} className="font-medium underline underline-offset-2">
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-[10px] text-base font-semibold transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff" }}
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-[13px]" style={{ color: "var(--color-text-3)" }}>
        New to Filmora? Signing in with Google creates your account automatically.
      </p>

      <p className="mt-4 text-center text-xs leading-4" style={{ color: "var(--color-text-3)" }}>
        By continuing you agree to our{" "}
        <a href="/terms" className="font-medium underline underline-offset-2" style={{ color: "var(--color-text-2)" }}>Terms &amp; Conditions</a>{" "}
        and{" "}
        <a href="/privacy" className="font-medium underline underline-offset-2" style={{ color: "var(--color-text-2)" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}

function Field({
  icon, label, type, name, placeholder,
}: { icon: ReactNode; label: string; type: string; name: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--color-text-2)" }}>{label}</span>
      <span
        className="flex h-11 items-center gap-2.5 rounded-[8px] px-3.5"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <span style={{ color: "var(--color-text-3)" }}>{icon}</span>
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text)" }}
        />
      </span>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" fill="#EB4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.03-3.02 2.47-4.47 2.58-4.54-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.64 1.1-4.58 1.1-.95 0-2.42-1.07-3.98-1.04-2.05.03-3.94 1.19-4.99 3.02-2.13 3.69-.54 9.16 1.53 12.15 1.01 1.46 2.22 3.1 3.81 3.04 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.99.96c1.65-.03 2.69-1.49 3.69-2.96 1.16-1.69 1.64-3.33 1.66-3.41-.04-.02-3.2-1.23-3.24-4.87ZM14.03 3.66c.84-1.02 1.41-2.43 1.25-3.84-1.21.05-2.68.81-3.55 1.83-.78.9-1.46 2.34-1.28 3.72 1.35.1 2.73-.69 3.58-1.71Z" />
    </svg>
  );
}
