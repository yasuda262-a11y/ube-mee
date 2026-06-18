import agencyData from "./mee-outline-agency.json";

export interface MeeCard {
  id: number;
  subject: string;
  subjectNumber: string;
  section: string;
  ruleTitle: string;
  priority: "HIGH" | "MED" | "LOW" | null;
  frequency: string | null;
  body: string;
  meeTips: string[];
  examHistory: string[];
  translation: string | null;
  meeTipTranslation: string | null;
}

export const MEE_AGENCY: MeeCard[] = agencyData as MeeCard[];

// 将来的に全科目をまとめる
export const ALL_MEE_CARDS: MeeCard[] = [...MEE_AGENCY];

export const MEE_SUBJECTS = [
  ...new Set(ALL_MEE_CARDS.map((c) => c.subject)),
];
