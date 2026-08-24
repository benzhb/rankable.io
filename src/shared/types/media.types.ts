export interface MediaCard {
  id: string;
  title: string;
  imageUrl: string;
  storagePath: string;
}

export interface MediaCategory {
  key: string;
  label: string;
  cards: MediaCard[];
}

export interface MediaCatalog {
  categories: MediaCategory[];
  loadedAt: string;
}

export interface MediaCategorySummary {
  key: string;
  label: string;
  cardCount: number;
}
