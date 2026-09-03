// Rating.value is 1-10 backend-side; every other rating display in this app
// (StarRating.jsx's web equivalent, README §8) shows it as 5 stars with
// half-star steps — this is the same mapping, just as a plain number here.
export function formatFiveScale(value?: number): string {
  if (value == null) return "-";
  const scaled = value / 2;
  return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1);
}
