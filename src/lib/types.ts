export interface Word {
  id: string;
  word: string;
  definition: string;
  translation_zh: string;
  ipa: string;
  pronunciation_url: string | null;
  rank: number | null;
  part_of_speech: string;
  word_family: string | null;
  example_sentences: string[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  image_url: string | null;
  image_prompt: string | null;
  mnemonic: string | null;
  category: string | null;
  /** "word" | "phrase" | "sentence_pattern"; null on legacy rows (derive from text). */
  entry_type?: string | null;
  /** Per-card image toggle; null = use default (off for sentence patterns). */
  show_image?: boolean | null;
  is_custom: boolean;
  created_at: string;
}

export interface LearningProgress {
  id: string;
  word_id: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  difficulty: number;
  stability: number;
  next_review: string;
  last_reviewed: string | null;
  review_count: number;
  created_at: string;
}

export interface Review {
  id: string;
  word_id: string;
  rating: 1 | 2 | 3 | 4;
  reviewed_at: string;
  response_time: number;
}

export interface WordWithProgress extends Word {
  progress?: LearningProgress;
}

export type Rating = 1 | 2 | 3 | 4;
export const RATING_LABELS: Record<Rating, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

export interface DailyStats {
  reviewed_today: number;
  due_today: number;
  new_today: number;
  streak: number;
  retention_rate: number;
  total_learned: number;
}

export interface UserSettings {
  daily_new_words: number;
  categories: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  daily_new_words: 10,
  categories: [],
};

export const CATEGORIES = [
  'academic', 'business', 'science', 'medicine', 'art',
  'technology', 'daily conversation', 'law', 'politics', 'sports',
  'music', 'food', 'travel', 'education', 'nature',
];
