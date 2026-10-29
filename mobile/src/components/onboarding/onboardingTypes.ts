import type { ContentType } from "../../types";

export type TastePreference = "movies" | "series" | "both";

export interface PickedTitle {
  id: string;
  type: ContentType;
  title: string;
  posterPath?: string | null;
}
