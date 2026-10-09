export interface MangaChapter {
  chapter: string;
  url: string;
  imageCount: number;
  imageUrls: string[];
}

export interface MangaApiResponse {
  title: string;
  source: string;
  chapterCount: number;
  latestChapter: number;
  fetchedAt: string;
  chapters: MangaChapter[];
}

export interface BookSheet {
  sheetIndex: number;
  frontType: 'cover' | 'page' | 'end-inner';
  backType: 'cover-inner' | 'page' | 'back-cover';
  frontPageNumber?: number;
  backPageNumber?: number;
  frontImageUrl?: string;
  backImageUrl?: string;
}

export type CoverFinish = 'crimson-gold' | 'midnight-star' | 'idol-amethyst' | 'ivory-collector';

export type LightingPreset = 'studio' | 'warm-lamp' | 'stage-neon';
