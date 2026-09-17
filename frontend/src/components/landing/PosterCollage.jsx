import { HERO_POSTERS, POSTER_BASE } from "../../data/heroPosters";

// Two independent rows, drifting slowly in opposite directions (a subtle
// parallax-y "wall of posters" feel, not a carousel to interact with) —
// each row is the same poster list duplicated so the CSS loop has no visible
// seam. Pure decoration: pointer-events disabled, nothing here is tappable.
function PosterRow({ reverse, className = "" }) {
  const items = [...HERO_POSTERS, ...HERO_POSTERS];
  return (
    <div className={`flex w-max gap-4 ${reverse ? "animate-poster-scroll-reverse" : "animate-poster-scroll"} ${className}`}>
      {items.map((item, i) => (
        <div key={`${item.poster_path}-${i}`} className="h-40 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-800 shadow-lg sm:h-56 sm:w-40">
          <img
            src={`${POSTER_BASE}${item.poster_path}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export default function PosterCollage() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
      <div className="flex flex-col gap-4 [transform:rotate(-6deg)_scale(1.15)]">
        <PosterRow />
        <PosterRow reverse />
        <PosterRow />
      </div>
      {/* Fades the collage into the hero's own dark background at every
          edge, so it reads as an atmosphere behind the headline rather than
          a hard-edged strip of posters. */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/70 to-zinc-950" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-transparent to-zinc-950" />
    </div>
  );
}
