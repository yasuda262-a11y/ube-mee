import rawData from "./questions.json";

export interface Blank {
  idx: number;
  answer: string;
}

export interface Card {
  id: number;
  page: number;
  subject: string;
  sectionHeader: string | null;
  priority: "H" | "M" | "L" | null;
  context: string;
  blanks: Blank[];
}

export const ALL_CARDS: Card[] = rawData as Card[];

export const SUBJECTS: string[] = [
  ...new Set(ALL_CARDS.map((c) => c.subject)),
].sort();

export function getCards(subject?: string): Card[] {
  if (!subject) return ALL_CARDS;
  return ALL_CARDS.filter((c) => c.subject === subject);
}

export const TOTAL_BLANKS = ALL_CARDS.reduce((s, c) => s + c.blanks.length, 0);
