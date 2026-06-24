import agencyData from "./mee-outline-agency.json";
import partnershipsData from "./mee-outline-partnerships.json";
import corporationsData from "./mee-outline-corporations.json";
import civilProcedureData from "./mee-outline-civil-procedure.json";
import constitutionalLawData from "./mee-outline-constitutional-law.json";
import contractsData from "./mee-outline-contracts.json";
import criminalLawData from "./mee-outline-criminal-law.json";
import evidenceData from "./mee-outline-evidence.json";
import realPropertyData from "./mee-outline-real-property.json";
import tortsData from "./mee-outline-torts.json";

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
  ruleTitleJa: string | null;
  translation: string | null;
  meeTipTranslation: string | null;
}

export const MEE_AGENCY: MeeCard[]              = agencyData as MeeCard[];
export const MEE_PARTNERSHIPS: MeeCard[]        = partnershipsData as MeeCard[];
export const MEE_CORPORATIONS: MeeCard[]        = corporationsData as MeeCard[];
export const MEE_CIVIL_PROCEDURE: MeeCard[]     = civilProcedureData as MeeCard[];
export const MEE_CONSTITUTIONAL_LAW: MeeCard[]  = constitutionalLawData as MeeCard[];
export const MEE_CONTRACTS: MeeCard[]           = contractsData as MeeCard[];
export const MEE_CRIMINAL_LAW: MeeCard[]        = criminalLawData as MeeCard[];
export const MEE_EVIDENCE: MeeCard[]            = evidenceData as MeeCard[];
export const MEE_REAL_PROPERTY: MeeCard[]       = realPropertyData as MeeCard[];
export const MEE_TORTS: MeeCard[]               = tortsData as MeeCard[];

export const ALL_MEE_CARDS: MeeCard[] = [
  ...MEE_AGENCY,
  ...MEE_PARTNERSHIPS,
  ...MEE_CORPORATIONS,
  ...MEE_CIVIL_PROCEDURE,
  ...MEE_CONSTITUTIONAL_LAW,
  ...MEE_CONTRACTS,
  ...MEE_CRIMINAL_LAW,
  ...MEE_EVIDENCE,
  ...MEE_REAL_PROPERTY,
  ...MEE_TORTS,
];

export const MEE_SUBJECTS = [
  ...new Set(ALL_MEE_CARDS.map((c) => c.subject)),
];
