// src/components/ui/stagger-testimonials.tsx — staggered card deck.
//
// The reference implementation of the "stagger deck" interaction: a row of
// clipped cards laid out around a lifted centre card, moved by clicking a
// neighbour or the chevrons. Kept here as the canonical version of the pattern;
// the player's episode deck (react/player/EpisodeDeck.tsx) is the same mechanic
// applied to TMDB episodes.
//
// NOTE ON IMPORTS. This project has no `@/*` path alias (tsconfig extends
// astro/tsconfigs/strict with no `paths`), so shared helpers are imported
// relatively — `../../lib/utils` — which is the convention every other file in
// this folder follows.

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const SQRT_5000 = Math.sqrt(5000);

/** Unsplash portraits, cycled so the deck has real faces without 20 URLs. */
const PORTRAITS = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d',
  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91',
];

const portrait = (index: number) =>
  `${PORTRAITS[index % PORTRAITS.length]}?w=200&h=240&fit=crop&crop=faces&q=70`;

const testimonials = [
  { testimonial: 'My favorite solution in the market. We work 5x faster with COMPANY.', by: 'Alex, CEO at TechCorp' },
  { testimonial: "I'm confident my data is safe with COMPANY. I can't say that about other providers.", by: 'Dan, CTO at SecureNet' },
  { testimonial: "I know it's cliche, but we were lost before we found COMPANY. Can't thank you guys enough!", by: 'Stephanie, COO at InnovateCo' },
  { testimonial: "COMPANY's products make planning for the future seamless. Can't recommend them enough!", by: 'Marie, CFO at FuturePlanning' },
  { testimonial: "If I could give 11 stars, I'd give 12.", by: 'Andre, Head of Design at CreativeSolutions' },
  { testimonial: "SO SO SO HAPPY WE FOUND YOU GUYS!!!! I'd bet you've saved me 100 hours so far.", by: 'Jeremy, Product Manager at TimeWise' },
  { testimonial: "Took some convincing, but now that we're on COMPANY, we're never going back.", by: 'Pam, Marketing Director at BrandBuilders' },
  { testimonial: "I would be lost without COMPANY's in-depth analytics. The ROI is EASILY 100X for us.", by: 'Daniel, Data Scientist at AnalyticsPro' },
  { testimonial: "It's just the best. Period.", by: 'Fernando, UX Designer at UserFirst' },
  { testimonial: 'I switched 5 years ago and never looked back.', by: 'Andy, DevOps Engineer at CloudMasters' },
  { testimonial: "I've been searching for a solution like COMPANY for YEARS. So glad I finally found one!", by: 'Pete, Sales Director at RevenueRockets' },
  { testimonial: "It's so simple and intuitive, we got the team up to speed in 10 minutes.", by: 'Marina, HR Manager at TalentForge' },
  { testimonial: "COMPANY's customer support is unparalleled. They're always there when we need them.", by: 'Olivia, Customer Success Manager at ClientCare' },
  { testimonial: "The efficiency gains we've seen since implementing COMPANY are off the charts!", by: 'Raj, Operations Manager at StreamlineSolutions' },
  { testimonial: "COMPANY has revolutionized how we handle our workflow. It's a game-changer!", by: 'Lila, Workflow Specialist at ProcessPro' },
  { testimonial: "The scalability of COMPANY's solution is impressive. It grows with our business seamlessly.", by: 'Trevor, Scaling Officer at GrowthGurus' },
  { testimonial: "I appreciate how COMPANY continually innovates. They're always one step ahead.", by: 'Naomi, Innovation Lead at FutureTech' },
  { testimonial: "The ROI we've seen with COMPANY is incredible. It's paid for itself many times over.", by: 'Victor, Finance Analyst at ProfitPeak' },
  { testimonial: "COMPANY's platform is so robust, yet easy to use. It's the perfect balance.", by: 'Yuki, Tech Lead at BalancedTech' },
  { testimonial: 'We\u2019ve tried many solutions, but COMPANY stands out in terms of reliability and performance.', by: 'Zoe, Performance Manager at ReliableSystems' },
].map((entry, index) => ({ ...entry, tempId: index, imgSrc: portrait(index) }));

interface TestimonialCardProps {
  position: number;
  testimonial: (typeof testimonials)[0];
  handleMove: (steps: number) => void;
  cardSize: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
  position,
  testimonial,
  handleMove,
  cardSize,
}) => {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        'absolute left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out',
        isCenter
          ? 'z-10 bg-primary text-primary-foreground border-primary'
          : 'z-0 bg-card text-card-foreground border-border hover:border-primary/50'
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath:
          'polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)',
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter ? '0px 8px 0px 4px hsl(var(--border))' : '0px 0px 0px 0px transparent',
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-border"
        style={{ right: -2, top: 48, width: SQRT_5000, height: 2 }}
      />
      <img
        src={testimonial.imgSrc}
        alt={`${testimonial.by.split(',')[0]}`}
        className="mb-4 h-14 w-12 bg-muted object-cover object-top"
        style={{ boxShadow: '3px 3px 0px hsl(var(--background))' }}
      />
      <h3
        className={cn(
          'text-base sm:text-xl font-medium',
          isCenter ? 'text-primary-foreground' : 'text-foreground'
        )}
      >
        "{testimonial.testimonial}"
      </h3>
      <p
        className={cn(
          'absolute bottom-8 left-8 right-8 mt-2 text-sm italic',
          isCenter ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}
      >
        - {testimonial.by}
      </p>
    </div>
  );
};

export const StaggerTestimonials: React.FC = () => {
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(testimonials);

  const handleMove = (steps: number) => {
    const newList = [...testimonialsList];
    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }
    setTestimonialsList(newList);
  };

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia('(min-width: 640px)');
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-muted/30" style={{ height: 600 }}>
      {testimonialsList.map((testimonial, index) => {
        const position =
          testimonialsList.length % 2
            ? index - (testimonialsList.length + 1) / 2
            : index - testimonialsList.length / 2;
        return (
          <TestimonialCard
            key={testimonial.tempId}
            testimonial={testimonial}
            handleMove={handleMove}
            position={position}
            cardSize={cardSize}
          />
        );
      })}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button
          onClick={() => handleMove(-1)}
          className={cn(
            'flex h-14 w-14 items-center justify-center text-2xl transition-colors',
            'bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          aria-label="Previous testimonial"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => handleMove(1)}
          className={cn(
            'flex h-14 w-14 items-center justify-center text-2xl transition-colors',
            'bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          aria-label="Next testimonial"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
};

export default StaggerTestimonials;
