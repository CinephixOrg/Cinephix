import { FiEyeOff, FiHeart, FiStar } from "react-icons/fi";
import { ago, posterUrl } from "./profileHelpers.js";

// The pieces the moderator's profile view is built from — the mobile public
// profile's header, poster grids, list cards, posts and CineGraph, as a
// desktop page. Shapes come straight from the app's own endpoints (read
// through /admin), so what a moderator sees is what the app shows.

export function Poster({ path, title, rating, subtitle, badge }) {
  const url = posterUrl(path);
  return (
    <div className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-zinc-800">
        {url ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-zinc-500">{title || "No poster"}</div>
        )}
        {rating != null && (
          <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">
            <FiStar className="h-3 w-3" /> {rating}
          </span>
        )}
        {badge}
      </div>
      {title && <div className="mt-1 truncate text-[12px] text-zinc-300">{title}</div>}
      {subtitle && <div className="truncate text-[11px] text-zinc-500">{subtitle}</div>}
    </div>
  );
}

export function PosterGrid({ items, empty }) {
  if (!items || items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item) => (
        <Poster key={item.key} path={item.poster_path} title={item.title} rating={item.rating} subtitle={item.subtitle} />
      ))}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">{children}</div>;
}

export function SectionCount({ shown, total, noun }) {
  if (!total) return null;
  return (
    <p className="mb-3 text-xs text-zinc-500">
      {shown < total ? `Showing the ${shown} most recent of ${total} ${noun}` : `${total} ${noun}`}
    </p>
  );
}

// One of their lists: posters from the list, its name, description and
// whether it's private (a moderator sees private ones too).
export function ListCard({ list }) {
  const previews = (list.previewItems ?? []).filter((item) => item.poster_path).slice(0, 5);
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 gap-1">
          {previews.length > 0 ? (
            previews.map((item, i) => (
              <img
                key={`${item.itemId ?? i}`}
                src={posterUrl(item.poster_path)}
                alt=""
                loading="lazy"
                className="h-24 w-16 rounded object-cover ring-1 ring-zinc-800"
              />
            ))
          ) : (
            <div className="flex h-24 w-16 items-center justify-center rounded bg-zinc-800 text-[11px] text-zinc-500">Empty</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{list.name}</h3>
            {!list.isPublic && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
                <FiEyeOff className="h-3 w-3" /> Private
              </span>
            )}
          </div>
          {list.description ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-400">{list.description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-zinc-600">No description</p>
          )}
          <div className="mt-2 text-xs text-zinc-500">
            {list.items?.length ?? list.itemCount ?? 0} titles · {list.likes?.length ?? 0} likes · created {ago(list.createdAt)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-zinc-600">List id: {list._id}</div>
        </div>
      </div>
    </article>
  );
}

// A review they wrote, whether or not they also posted it to the feed.
export function ReviewItem({ review }) {
  return (
    <article className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {review.poster_path ? (
        <img src={posterUrl(review.poster_path)} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded object-cover ring-1 ring-zinc-800" />
      ) : (
        <div className="h-24 w-16 shrink-0 rounded bg-zinc-800" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-semibold">{review.title ?? "Unknown title"}</h3>
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">{review.contentType}</span>
          <span className="ml-auto text-xs text-zinc-500">{ago(review.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{review.text}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <FiHeart className="h-3 w-3" /> {review.likeCount}
          </span>
          <span className="font-mono text-[11px] text-zinc-600">Review id: {review._id}</span>
        </div>
      </div>
    </article>
  );
}

const SHARE_LABEL = {
  review: "Review",
  recommendation: "Recommendation",
  list: "List",
  analysis: "CineGraph analysis",
  badge: "Badge",
  poll: "Poll",
  official: "Official post",
  sync: "Sync",
};

// One of their posts, in the same terms the Media feed shows it.
export function ShareItem({ share }) {
  const content = share.contentData;
  const poster = content?.posterUrl ?? content?.poster_path;
  const text = share.reviewText || share.note || share.officialText || share.pollData?.question || share.listData?.description;
  const title = content?.title ?? share.listData?.name ?? (share.badgeData ? `${share.badgeData.key} badge (${share.badgeData.tier})` : null);

  return (
    <article className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {poster ? (
        <img src={posterUrl(poster)} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded object-cover ring-1 ring-zinc-800" />
      ) : (
        <div className="hidden h-24 w-16 shrink-0 rounded bg-zinc-800 sm:block" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
            {SHARE_LABEL[share.type] ?? share.type}
          </span>
          {share.reviewRating != null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-300">
              <FiStar className="h-3 w-3" /> {share.reviewRating}/10
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-500">{ago(share.createdAt)}</span>
        </div>
        {title && <h3 className="mt-1.5 truncate font-semibold">{title}</h3>}
        {text ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{text}</p>
        ) : (
          <p className="mt-1 text-sm italic text-zinc-600">No text</p>
        )}
        {share.pollData?.options?.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {share.pollData.options.map((option, i) => (
              <li key={i}>• {option.text ?? option.label ?? JSON.stringify(option)}</li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>{share.likeCount ?? 0} likes</span>
          <span>{share.viewCount ?? 0} views</span>
          <span className="font-mono text-[11px] text-zinc-600">Post id: {share._id}</span>
        </div>
      </div>
    </article>
  );
}

// The CineGraph tab: how many rated titles fall in each genre, and their
// average rating there — movies and series side by side, as in the app.
export function CineGraphPanel({ cineGraph }) {
  if (!cineGraph) return <Empty>No CineGraph data.</Empty>;
  const sides = [
    { key: "movie", label: "Movies", stats: cineGraph.movieStats, ratings: cineGraph.movieGenreRatings },
    { key: "series", label: "Series", stats: cineGraph.seriesStats, ratings: cineGraph.seriesGenreRatings },
  ];
  const anything = sides.some((side) => Object.values(side.stats ?? {}).some((n) => n > 0));
  if (!anything) return <Empty>They haven't rated anything yet.</Empty>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {sides.map((side) => {
        const rows = Object.entries(side.stats ?? {})
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1]);
        const max = rows[0]?.[1] ?? 1;
        return (
          <div key={side.key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              {side.label} <span className="text-zinc-500">· {rows.reduce((sum, [, n]) => sum + n, 0)} rated</span>
            </h3>
            {rows.length === 0 ? (
              <p className="text-sm italic text-zinc-600">Nothing rated</p>
            ) : (
              <ul className="space-y-2">
                {rows.map(([genre, count]) => {
                  const average = side.ratings?.[genre];
                  return (
                    <li key={genre} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate text-zinc-300">{genre}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <span className="block h-full rounded-full bg-violet-500/70" style={{ width: `${(count / max) * 100}%` }} />
                      </span>
                      <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400">{count}</span>
                      <span className="w-12 shrink-0 text-right tabular-nums text-amber-300/80">
                        {typeof average === "number" && average > 0 ? average.toFixed(1) : "–"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
