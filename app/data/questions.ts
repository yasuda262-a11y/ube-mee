import rawData from "./questions.json";

export interface Question {
  id: number;
  page: number;
  subject: string;
  answer: string;
  context: string;
}

export const ALL_QUESTIONS: Question[] = rawData as Question[];

export const SUBJECTS: string[] = [
  ...new Set(ALL_QUESTIONS.map((q) => q.subject)),
].sort();

export function getQuestions(subject?: string): Question[] {
  if (!subject) return ALL_QUESTIONS;
  return ALL_QUESTIONS.filter((q) => q.subject === subject);
}
