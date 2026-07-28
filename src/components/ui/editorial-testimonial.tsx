"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const testimonials = [
  {
    id: 1,
    quote: "Many online streaming websites are bogged down by slow load times, broken video players, and intrusive pop-ups. We built FilmoraMovies with high-speed dedicated servers to ensure ultra-fast video playback and zero buffering — even during peak traffic hours.",
    author: "0ms Buffering",
    role: "The Ultimate Free Streaming Destination",
    company: "FilmoraMovies",
    image: "https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fG1vdmllfGVufDB8fDB8fHww",
  },
  {
    id: 2,
    quote: "Thousands of titles organized for effortless browsing. Explosive action blockbusters, gripping indie dramas, feel-good comedies, and spine-chilling sci-fi horror. A diverse library across every genre.",
    author: "Endless Content",
    role: "A Diverse Library Across Every Genre",
    company: "FilmoraMovies",
    image: "https://images.unsplash.com/photo-1574267432553-4b462808152a?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHBvcGNvcm58ZW58MHx8MHx8fDA%3D",
  },
  {
    id: 3,
    quote: "Entire seasons ready to stream on demand. From popular premium cable series to global web series hits — watch with seamless autoplay, just like your favorite premium streaming service. Never miss a premiere or shocking finale again.",
    author: "Binge-Watch",
    role: "Trending TV Shows",
    company: "FilmoraMovies",
    image: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bmV0ZmxpeHxlbnwwfHwwfHx8MA%3D%3D",
  },
  {
    id: 4,
    quote: "HD & 4K Playback. Cross-Device support for Desktop, laptop, iOS, Android & Smart TVs. Built-in Multi-Language Subtitles. Fast, free, and in stunning quality — discover, binge, and watch across every device.",
    author: "Why Choose Us?",
    role: "Everything You Need to Stream",
    company: "FilmoraMovies",
    image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHR2fGVufDB8fDB8fHww",
  },
]

export default function TestimonialsEditorial() {
  const [active, setActive] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleChange = (index: number) => {
    if (index === active || isTransitioning) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActive(index)
      setTimeout(() => setIsTransitioning(false), 50)
    }, 300)
  }

  const handlePrev = () => {
    const newIndex = active === 0 ? testimonials.length - 1 : active - 1
    handleChange(newIndex)
  }

  const handleNext = () => {
    const newIndex = active === testimonials.length - 1 ? 0 : active + 1
    handleChange(newIndex)
  }

  const current = testimonials[active]

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-16 text-white">
      {/* Large index number */}
      <div className="flex items-start gap-8">
        <span
          className="text-[80px] md:text-[120px] font-light leading-none text-white/20 select-none transition-all duration-500"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {String(active + 1).padStart(2, "0")}
        </span>

        <div className="flex-1 pt-6">
          {/* Quote */}
          <blockquote
            className={`text-xl md:text-3xl font-light leading-relaxed tracking-tight transition-all duration-300 ${
              isTransitioning ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
            }`}
          >
            "{current.quote}"
          </blockquote>

          {/* Author info with hover reveal */}
          <div
            className={`mt-10 group cursor-default transition-all duration-300 delay-100 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-white/30 transition-all duration-300 flex-shrink-0">
                <img
                  src={current.image || "/placeholder.svg"}
                  alt={current.author}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <div>
                <p className="font-medium text-lg md:text-xl">{current.author}</p>
                <p className="text-sm text-white/60">
                  {current.role}
                  <span className="mx-2 text-white/20">/</span>
                  <span className="group-hover:text-white transition-colors duration-300">{current.company}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation - vertical line selector */}
      <div className="mt-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {testimonials.map((_, index) => (
              <button key={index} onClick={() => handleChange(index)} className="group relative py-4">
                <span
                  className={`block h-[2px] rounded-full transition-all duration-500 ease-out ${
                    index === active
                      ? "w-10 md:w-12 bg-white"
                      : "w-4 md:w-6 bg-white/20 group-hover:w-6 md:group-hover:w-8 group-hover:bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="text-xs text-white/60 tracking-widest uppercase">
            {String(active + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-2 md:p-3 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all duration-300"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 md:p-3 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all duration-300"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
