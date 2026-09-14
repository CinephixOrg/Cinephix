import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaCheck, FaFilm, FaGlobe, FaLock, FaMagic, FaPlus, FaSearch, FaTimes, FaTv } from "react-icons/fa";
import { listService } from "../api/listService";
import { contentService } from "../api/contentService";
import {
  MIN_ITEMS_FOR_SUGGESTIONS,
  addToDraft,
  draftKey,
  interleave,
  isDraftChanged,
  posterUrl,
  removeFromDraft,
  seedsKey,
  suggestionSeeds,
  titleIdentity,
  yearOf,
} from "../utils/listDraft";

// Creating and editing a list on one distraction-free page:
//
//   * the name, description and visibility as borderless text on the canvas;
//   * a search that adds titles in place, without leaving the page;
//   * once the list has three titles, a rail of suggestions drawn from the
//     last ones added (POST /api/lists/suggestions), one click to add;
//   * the added titles as a poster grid that glides when it changes.
//
// Routes: /lists/new (optionally ?add=movie:<id> to start with a title) and
// /lists/:id/edit. Nothing is saved until Save: the whole list, titles
// included, goes in one request.

const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;
const SEARCH_LIMIT = 12;
// Network search: long enough to skip a fast typist's intermediate queries.
const SEARCH_DEBOUNCE_MS = 300;
// Adding three titles in a row should cost one suggestions request, not three.
const SUGGESTIONS_DEBOUNCE_MS = 500;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const EMPTY_DRAFT = { name: "", description: "", isPublic: false, items: [] };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Both searches are cached per query by contentService.
async function searchTitles(query) {
  const [movies, series] = await Promise.all([
    contentService.searchMovies(query).catch(() => []),
    contentService.searchSeries(query).catch(() => []),
  ]);
  const toItem = (type) => (doc) => ({
    id: String(doc._id),
    type,
    title: doc.title || doc.name || "",
    poster: doc.posterUrl || null,
    year: doc.releaseYear || null,
  });
  return interleave((movies || []).map(toItem("movie")), (series || []).map(toItem("series")), SEARCH_LIMIT);
}

// Titles and posters for list items, in two bulk requests at most, in order.
async function hydrate(refs) {
  const movieIds = refs.filter((ref) => ref.type === "movie").map((ref) => ref.id);
  const seriesIds = refs.filter((ref) => ref.type === "series").map((ref) => ref.id);
  const [movies, series] = await Promise.all([
    contentService.getMoviesBulk(movieIds, true),
    contentService.getSeriesBulk(seriesIds, true),
  ]);
  const found = new Map();
  for (const doc of movies || []) found.set(`movie:${doc._id}`, doc);
  for (const doc of series || []) found.set(`series:${doc._id}`, doc);
  return refs.flatMap((ref) => {
    const doc = found.get(draftKey(ref));
    if (!doc) return [];
    return [
      {
        id: ref.id,
        type: ref.type,
        title: (ref.type === "series" ? doc.name || doc.title : doc.title || doc.name) || "",
        poster: posterUrl(doc.poster_path),
        year: yearOf(ref.type === "series" ? doc.first_air_date : doc.release_date),
      },
    ];
  });
}

// The same seeds give the same suggestions for the whole session.
const suggestionsCache = new Map();
const suggestionsInFlight = new Map();

function loadSuggestions(key, seeds, onList) {
  if (suggestionsCache.has(key)) return Promise.resolve(suggestionsCache.get(key));
  if (suggestionsInFlight.has(key)) return suggestionsInFlight.get(key);
  const toRef = (item) => ({ itemId: item.id, itemType: item.type });
  // Oldest to newest, the order the server reads seeds in.
  const request = listService
    .getSuggestions([...seeds].reverse().map(toRef), onList.map(toRef))
    .then((items) => {
      const suggestions = (items || []).map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        poster: posterUrl(item.poster_path),
        year: yearOf(item.releaseDate),
      }));
      suggestionsCache.set(key, suggestions);
      return suggestions;
    })
    .finally(() => suggestionsInFlight.delete(key));
  suggestionsInFlight.set(key, request);
  return request;
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";
const EASE_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const canAnimate = () => typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

// FLIP: when the grid's items change, each tile that moved glides from where
// it was to where it is, and each new tile pops in. Measured only when the
// items change, so typing elsewhere on the page never touches the grid.
function useGridMotion(containerRef, items) {
  const rects = useRef(new Map());
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = new Map();
    for (const element of container.children) {
      const key = element.dataset.key;
      if (!key) continue;
      const rect = element.getBoundingClientRect();
      next.set(key, rect);
      if (!mounted.current || !canAnimate()) continue;
      const previous = rects.current.get(key);
      if (!previous) {
        element.animate(
          [
            { opacity: 0, transform: "scale(0.8)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 260, easing: EASE_BACK }
        );
      } else {
        const dx = previous.left - rect.left;
        const dy = previous.top - rect.top;
        if (dx || dy) {
          element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
            duration: 280,
            easing: EASE_OUT,
          });
        }
      }
    }
    rects.current = next;
    mounted.current = true;
  }, [containerRef, items]);
}

// A short spring on an element when `active` turns on: the add registered.
function usePop(ref, active) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active || !ref.current || !canAnimate()) return;
    ref.current.animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], { duration: 320, easing: EASE_BACK });
  }, [active, ref]);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Poster({ src, title, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-base-300 text-base-content/30`}>
        <FaFilm />
      </div>
    );
  }
  return <img src={src} alt={title} loading="lazy" className={`${className} object-cover bg-base-300`} onError={() => setFailed(true)} />;
}

const VisibilityToggle = memo(function VisibilityToggle({ isPublic, onChange }) {
  const { t } = useTranslation();
  const options = [
    { value: false, icon: <FaLock size={12} />, label: t("Private") },
    { value: true, icon: <FaGlobe size={12} />, label: t("Public") },
  ];
  return (
    <div role="radiogroup" className="inline-flex gap-1 rounded-xl border border-base-300 bg-base-200 p-1">
      {options.map((option) => {
        const active = option.value === isPublic;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-primary text-primary-content" : "text-base-content/70 hover:text-base-content"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
});

const SearchResultRow = memo(function SearchResultRow({ item, added, onToggle }) {
  const { t } = useTranslation();
  const actionRef = useRef(null);
  usePop(actionRef, added);
  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      aria-pressed={added}
      className="flex w-full items-center gap-4 rounded-xl px-3 py-2 text-left transition-colors hover:bg-base-200"
    >
      <Poster src={item.poster} title={item.title} className="h-16 w-11 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-base-content/50">
          {item.type === "movie" ? <FaFilm /> : <FaTv />}
          {item.year}
        </p>
      </div>
      <span
        ref={actionRef}
        aria-label={added ? t("Added") : t("Add")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
          added ? "bg-primary text-primary-content" : "border-2 border-base-300 text-base-content/70"
        }`}
      >
        {added ? <FaCheck size={13} /> : <FaPlus size={13} />}
      </span>
    </button>
  );
});

const SearchResults = memo(function SearchResults({ results, searching, addedKeys, onToggle }) {
  const { t } = useTranslation();
  if (results.length === 0) {
    return (
      <div className="flex justify-center py-10 text-sm text-base-content/50">
        {searching ? <span className="loading loading-spinner" /> : t("No results found.")}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-col">
      {results.map((item) => {
        const key = draftKey(item);
        return <SearchResultRow key={key} item={item} added={addedKeys.has(key)} onToggle={onToggle} />;
      })}
    </div>
  );
});

const SuggestionsHint = memo(function SuggestionsHint({ added, needed }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-base-200 px-5 py-4 text-sm text-base-content/60">
      <FaMagic className="shrink-0 text-primary" />
      <span className="flex-1">{t("Add {{count}} more titles to get suggestions", { count: needed - added })}</span>
      <span className="flex gap-1.5">
        {Array.from({ length: needed }, (_, index) => (
          <span key={index} className={`h-2 w-2 rounded-full transition-colors ${index < added ? "bg-primary" : "bg-base-300"}`} />
        ))}
      </span>
    </div>
  );
});

const SuggestionTile = memo(function SuggestionTile({ item, onAdd }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      title={item.title}
      aria-label={`${t("Add")}, ${item.title}`}
      className="group relative w-28 shrink-0 snap-start text-left transition-transform active:scale-95"
    >
      <Poster src={item.poster} title={item.title} className="aspect-[2/3] w-28 rounded-xl ring-1 ring-base-300 transition group-hover:ring-primary" />
      <span className="absolute right-2 top-[calc(10.5rem-1.25rem)] flex h-8 w-8 items-center justify-center rounded-full border-2 border-base-100 bg-primary text-primary-content shadow transition group-hover:scale-110">
        <FaPlus size={12} />
      </span>
      <p className="mt-2 truncate text-xs font-medium text-base-content/80">{item.title}</p>
    </button>
  );
});

const SuggestionsRail = memo(function SuggestionsRail({ suggestions, loading, onAdd }) {
  const { t } = useTranslation();
  if (!loading && suggestions.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <FaMagic className="text-primary" />
        {t("Suggested for this list")}
      </h2>
      <p className="text-xs text-base-content/50">{t("Picked from the titles you added last")}</p>
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.length === 0
          ? Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton aspect-[2/3] w-28 shrink-0 rounded-xl" />)
          : suggestions.map((item) => <SuggestionTile key={draftKey(item)} item={item} onAdd={onAdd} />)}
      </div>
    </section>
  );
});

const AddedGrid = memo(function AddedGrid({ items, onRemove }) {
  const { t } = useTranslation();
  const gridRef = useRef(null);
  useGridMotion(gridRef, items);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        {t("Added")}
        <span className="badge badge-ghost badge-sm">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-base-300 py-10 text-center text-base-content/50">
          <FaFilm size={22} />
          <p className="font-medium">{t("Nothing added yet.")}</p>
          <p className="text-xs">{t("Search above to add titles to this list.")}</p>
        </div>
      ) : (
        <div ref={gridRef} className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => {
            const key = draftKey(item);
            return (
              <div key={key} data-key={key} className="group relative">
                <Poster src={item.poster} title={item.title} className="aspect-[2/3] w-full rounded-xl" />
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  aria-label={`${t("Remove")}, ${item.title}`}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-error hover:opacity-100 group-hover:opacity-100"
                >
                  <FaTimes size={11} />
                </button>
                <p className="mt-1.5 truncate text-xs text-base-content/70">{item.title}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function ListEditorPage() {
  const { id: listId } = useParams();
  const isEditing = Boolean(listId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [status, setStatus] = useState(isEditing ? "loading" : "ready");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const baseline = useRef(EMPTY_DRAFT);
  const descriptionRef = useRef(null);

  // ---- Loading ------------------------------------------------------------------

  const load = useCallback(async () => {
    if (!listId) return;
    setStatus("loading");
    try {
      const data = await listService.getListById(listId);
      if (!data.isOwner) {
        navigate(`/lists/${listId}`, { replace: true });
        return;
      }
      const loaded = await hydrate(data.list.items.map((item) => ({ id: String(item.itemId), type: item.itemType })));
      baseline.current = {
        name: data.list.name,
        description: data.list.description || "",
        isPublic: data.list.isPublic,
        items: loaded,
      };
      setName(data.list.name);
      setDescription(data.list.description || "");
      setIsPublic(data.list.isPublic);
      setItems(loaded);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [listId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // A new list opened from a title's "add to list" starts with that title.
  const startWith = searchParams.get("add");
  useEffect(() => {
    if (isEditing || !startWith) return;
    const [type, id] = startWith.split(":");
    if ((type !== "movie" && type !== "series") || !OBJECT_ID.test(id || "")) return;
    hydrate([{ id, type }])
      .then(([item]) => {
        if (item) setItems((current) => addToDraft(current, item));
      })
      .catch(() => {});
  }, [isEditing, startWith]);

  // ---- The draft ------------------------------------------------------------------

  const addedKeys = useMemo(() => new Set(items.map(draftKey)), [items]);
  const addItem = useCallback((item) => setItems((current) => addToDraft(current, item)), []);
  const removeItem = useCallback((key) => setItems((current) => removeFromDraft(current, key)), []);
  const toggleItem = useCallback(
    (item) => {
      const key = draftKey(item);
      if (addedKeys.has(key)) removeItem(key);
      else addItem(item);
    },
    [addedKeys, addItem, removeItem]
  );

  // Grows with its text instead of scrolling inside itself.
  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [description, status]);

  // ---- Search ---------------------------------------------------------------------

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const hasQuery = queryInput.trim().length > 0;

  useEffect(() => {
    const trimmed = queryInput.trim();
    if (!trimmed) {
      setQuery("");
      return;
    }
    const timer = setTimeout(() => setQuery(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchTitles(query)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    // A newer query supersedes this one's response.
    return () => {
      cancelled = true;
    };
  }, [query]);

  // ---- Suggestions ------------------------------------------------------------------

  const seeds = useMemo(() => suggestionSeeds(items), [items]);
  const currentSeedsKey = seedsKey(seeds);
  const [suggestionPool, setSuggestionPool] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const latest = useRef({ seeds, items });
  latest.current = { seeds, items };

  useEffect(() => {
    if (!currentSeedsKey) {
      setSuggestionPool([]);
      setSuggesting(false);
      return;
    }
    if (suggestionsCache.has(currentSeedsKey)) {
      setSuggestionPool(suggestionsCache.get(currentSeedsKey));
      setSuggesting(false);
      return;
    }
    let cancelled = false;
    setSuggesting(true);
    const timer = setTimeout(() => {
      loadSuggestions(currentSeedsKey, latest.current.seeds, latest.current.items)
        .then((pool) => {
          if (!cancelled) setSuggestionPool(pool);
        })
        .catch(() => {
          // Suggestions are a bonus: the editor works the same without them.
        })
        .finally(() => {
          if (!cancelled) setSuggesting(false);
        });
    }, SUGGESTIONS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSeedsKey]);

  // The previous pool stays up while a new one loads, minus anything added
  // since, so a clicked suggestion leaves the rail as it lands in the grid.
  // Matched by title as well as record: a suggestion can be a duplicate
  // catalogue record of a title that's already on the list.
  const addedTitles = useMemo(() => new Set(items.map(titleIdentity)), [items]);
  const suggestions = useMemo(
    () => suggestionPool.filter((item) => !addedKeys.has(draftKey(item)) && !addedTitles.has(titleIdentity(item))),
    [suggestionPool, addedKeys, addedTitles]
  );

  // ---- Leaving and saving -------------------------------------------------------------

  const changed = status === "ready" && isDraftChanged(baseline.current, { name, description, isPublic, items });
  const trimmedName = name.trim();
  const canSave = status === "ready" && trimmedName.length > 0 && !saving && (!isEditing || changed);
  const exitPath = isEditing ? `/lists/${listId}` : "/my-lists";

  // Closing or reloading the tab with unsaved changes asks the browser's own question.
  useEffect(() => {
    if (!changed) return;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changed]);

  const requestLeave = useCallback(() => {
    if (changed) setConfirmingLeave(true);
    else navigate(exitPath);
  }, [changed, navigate, exitPath]);

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    const fields = {
      name: trimmedName,
      description: description.trim(),
      isPublic,
      items: items.map((item) => ({ itemId: item.id, itemType: item.type })),
    };
    try {
      if (listId) {
        await listService.updateList(listId, fields);
        toast.success(t("List updated"));
        navigate(`/lists/${listId}`);
      } else {
        const data = await listService.createList(fields);
        toast.success(t("List created!"));
        navigate(`/lists/${data.list._id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t(listId ? "Failed to update list" : "Failed to create list"));
      setSaving(false);
    }
  }, [canSave, trimmedName, description, isPublic, items, listId, navigate, t]);

  // Ctrl/Cmd + Enter saves from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  // ---- Render -------------------------------------------------------------------------

  if (status === "loading") {
    return (
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <p className="text-lg font-semibold">{t("Failed to load list.")}</p>
        <button type="button" className="btn btn-primary" onClick={load}>
          {t("Retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24">
      <header className="sticky top-0 z-20 -mx-6 flex items-center gap-3 bg-base-100/90 px-6 py-4 backdrop-blur">
        <button type="button" onClick={requestLeave} className="btn btn-ghost btn-circle btn-sm" aria-label={t("Back")}>
          <FaArrowLeft />
        </button>
        <span className="flex-1 text-sm font-semibold uppercase tracking-wider text-base-content/50">
          {t(isEditing ? "Edit List" : "New List")}
        </span>
        <button type="button" onClick={save} disabled={!canSave} className="btn btn-primary rounded-full px-6">
          {saving ? <span className="loading loading-spinner loading-sm" /> : t(isEditing ? "Save changes" : "Create List")}
          {!saving && items.length > 0 ? <span className="opacity-70">· {items.length}</span> : null}
        </button>
      </header>

      <section className="mt-6">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              descriptionRef.current?.focus();
            }
          }}
          maxLength={NAME_MAX}
          autoFocus={!isEditing}
          placeholder={t("List name")}
          aria-label={t("List name")}
          className="w-full bg-transparent text-4xl font-extrabold tracking-tight outline-none placeholder:text-base-content/25"
        />
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={1}
          placeholder={t("Add a description")}
          aria-label={t("Add a description")}
          className="mt-3 w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-base-content/80 outline-none placeholder:text-base-content/30"
        />
        <div className="mt-4">
          <VisibilityToggle isPublic={isPublic} onChange={setIsPublic} />
        </div>
      </section>

      <section className="mt-10">
        <label className="flex h-14 items-center gap-3 rounded-2xl border-2 border-base-300 bg-base-200 px-5 transition-colors focus-within:border-primary">
          <FaSearch className="text-base-content/40" />
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder={t("Search movies and series")}
            className="flex-1 bg-transparent outline-none"
          />
          {hasQuery ? (
            <button type="button" onClick={() => setQueryInput("")} aria-label={t("Clear")} className="text-base-content/40 hover:text-base-content">
              <FaTimes />
            </button>
          ) : null}
        </label>

        {hasQuery ? (
          <SearchResults results={results} searching={searching || queryInput.trim() !== query} addedKeys={addedKeys} onToggle={toggleItem} />
        ) : items.length < MIN_ITEMS_FOR_SUGGESTIONS ? (
          <SuggestionsHint added={items.length} needed={MIN_ITEMS_FOR_SUGGESTIONS} />
        ) : (
          <SuggestionsRail suggestions={suggestions} loading={suggesting} onAdd={addItem} />
        )}
      </section>

      <AddedGrid items={items} onRemove={removeItem} />

      {confirmingLeave ? (
        <dialog open className="modal modal-open bg-black/60">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-bold">{t("Discard changes?")}</h3>
            <p className="py-3 text-base-content/70">{t("Your changes to this list won't be saved.")}</p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingLeave(false)}>
                {t("Keep editing")}
              </button>
              <button type="button" className="btn btn-error" onClick={() => navigate(exitPath)}>
                {t("Discard")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmingLeave(false)} />
        </dialog>
      ) : null}
    </div>
  );
}
