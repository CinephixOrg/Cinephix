// One row of the feature showcase — icon-in-a-gradient-blob on one side,
// title+body on the other, alternating sides per `reverse`. Deliberately an
// illustrative icon/blob rather than a real app screenshot: this
// environment has no way to capture one from the running mobile app (no
// simulator/browser control here), and a screenshot can be dropped in here
// later by swapping this visual for an <img> without touching the layout.
export default function FeatureSection({ icon, title, body, reverse = false, accent }) {
  return (
    <div className={`flex flex-col items-center gap-10 py-16 md:flex-row md:gap-16 ${reverse ? "md:flex-row-reverse" : ""}`}>
      <div className="flex w-full justify-center md:w-1/2">
        <div
          className="flex h-56 w-56 items-center justify-center rounded-[2.5rem] sm:h-64 sm:w-64"
          style={{ background: `radial-gradient(circle at 30% 30%, ${accent}33, transparent 70%)` }}
        >
          <div
            className="flex h-32 w-32 items-center justify-center rounded-3xl sm:h-36 sm:w-36"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          >
            <div className="text-5xl text-zinc-950/80 sm:text-6xl">{icon}</div>
          </div>
        </div>
      </div>
      <div className="w-full text-center md:w-1/2 md:text-left">
        <h3 className="text-2xl font-bold text-white sm:text-3xl">{title}</h3>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60 md:mx-0">{body}</p>
      </div>
    </div>
  );
}
