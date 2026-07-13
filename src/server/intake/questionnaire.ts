import { z } from "zod";

/**
 * Dynamic intake questionnaire. A typed question graph whose visibility branches
 * on prior answers (issuer type, offer structure, gating booleans). Shared by
 * client and server: the UI renders visible questions, the server validates and
 * persists them, and generation consumes the confirmed values. Every question
 * declares the DRHP section(s) it informs so intake ties back to the checklist.
 */

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "boolean"
  | "select";

export type QuestionOption = { value: string; label: string };

export type Answers = Record<string, unknown>;

export type Question = {
  id: string;
  group: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: QuestionOption[];
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  /** DRHP section keys this answer informs (ties intake to the checklist). */
  sectionKeys: string[];
  /** Branching: question is shown only when this predicate holds. */
  visibleIf?: (a: Answers) => boolean;
};

export type QuestionGroup = { id: string; title: string; description?: string };

export const ISSUER_TYPES: QuestionOption[] = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Services" },
  { value: "trading", label: "Trading" },
];

export const OFFER_STRUCTURES: QuestionOption[] = [
  { value: "fresh_only", label: "Fresh issue only" },
  { value: "ofs_only", label: "Offer for sale only" },
  { value: "fresh_and_ofs", label: "Fresh issue + offer for sale" },
];

const SECTORS: QuestionOption[] = [
  { value: "manufacturing_industrial", label: "Industrial / Engineering" },
  { value: "chemicals", label: "Chemicals" },
  { value: "food_bev", label: "Food & Beverages" },
  { value: "it_software", label: "IT / Software" },
  { value: "healthcare", label: "Healthcare" },
  { value: "financial_services", label: "Financial Services" },
  { value: "textiles", label: "Textiles" },
  { value: "other", label: "Other" },
];

export const GROUPS: QuestionGroup[] = [
  { id: "company", title: "Company", description: "Identity & incorporation" },
  { id: "business", title: "Business", description: "What the company does" },
  { id: "promoters", title: "Promoters", description: "Promoter details" },
  { id: "capital_offer", title: "Capital & Offer", description: "Capital structure and the proposed offer" },
  { id: "financials", title: "Financials", description: "Summary of restated financials" },
  { id: "legal", title: "Legal", description: "Litigation & contingencies" },
];

const isManufacturing = (a: Answers) => a.issuer_type === "manufacturing";
const isServices = (a: Answers) => a.issuer_type === "services";
const isTrading = (a: Answers) => a.issuer_type === "trading";
const hasFresh = (a: Answers) =>
  a.offer_structure === "fresh_only" || a.offer_structure === "fresh_and_ofs";
const hasOfs = (a: Answers) =>
  a.offer_structure === "ofs_only" || a.offer_structure === "fresh_and_ofs";

export const QUESTIONS: Question[] = [
  // Company
  { id: "legal_name", group: "company", label: "Legal name of the company", type: "text", required: true, maxLength: 200, sectionKeys: ["cover-page", "history-corporate-structure"] },
  { id: "cin", group: "company", label: "Corporate Identification Number (CIN)", type: "text", required: true, maxLength: 21, sectionKeys: ["general-information"] },
  { id: "incorporation_date", group: "company", label: "Date of incorporation", type: "date", required: true, sectionKeys: ["history-corporate-structure"] },
  { id: "registered_office_state", group: "company", label: "Registered office — State", type: "text", required: true, maxLength: 80, sectionKeys: ["general-information"] },
  { id: "issuer_type", group: "company", label: "Nature of business", type: "select", options: ISSUER_TYPES, required: true, sectionKeys: ["business-overview"] },
  { id: "sector", group: "company", label: "Sector", type: "select", options: SECTORS, required: true, sectionKeys: ["industry-overview"] },

  // Business (branches on issuer_type)
  { id: "business_description", group: "business", label: "Describe your business", type: "textarea", required: true, maxLength: 4000, sectionKeys: ["business-overview", "introduction"] },
  { id: "installed_capacity", group: "business", label: "Installed manufacturing capacity", help: "e.g. 12,000 MT per annum", type: "text", required: true, maxLength: 200, sectionKeys: ["business-overview"], visibleIf: isManufacturing },
  { id: "plant_locations", group: "business", label: "Manufacturing plant location(s)", type: "textarea", required: true, maxLength: 1000, sectionKeys: ["business-overview"], visibleIf: isManufacturing },
  { id: "service_lines", group: "business", label: "Principal service lines", type: "textarea", required: true, maxLength: 1000, sectionKeys: ["business-overview"], visibleIf: isServices },
  { id: "key_products_traded", group: "business", label: "Key products traded & major suppliers", type: "textarea", required: true, maxLength: 1000, sectionKeys: ["business-overview"], visibleIf: isTrading },

  // Promoters
  { id: "promoter_names", group: "promoters", label: "Promoter name(s)", help: "Comma-separated", type: "textarea", required: true, maxLength: 1000, sectionKeys: ["promoters"] },
  { id: "promoter_count", group: "promoters", label: "Number of promoters", type: "number", required: true, min: 1, max: 50, sectionKeys: ["promoters", "capital-structure"] },

  // Capital & Offer (branches on offer_structure)
  { id: "face_value", group: "capital_offer", label: "Face value per equity share (₹)", type: "currency", required: true, min: 1, sectionKeys: ["capital-structure"] },
  { id: "pre_issue_shares", group: "capital_offer", label: "Pre-issue number of equity shares", type: "number", required: true, min: 1, sectionKeys: ["capital-structure"] },
  { id: "offer_structure", group: "capital_offer", label: "Offer structure", type: "select", options: OFFER_STRUCTURES, required: true, sectionKeys: ["offer-information", "capital-structure"] },
  { id: "fresh_issue_shares", group: "capital_offer", label: "Fresh issue size (number of equity shares)", type: "number", required: true, min: 1, sectionKeys: ["offer-information", "capital-structure"], visibleIf: hasFresh },
  { id: "fresh_issue_amount", group: "capital_offer", label: "Fresh issue amount (₹ in lakhs)", help: "Optional until the issue price or price band is available — do not estimate it.", type: "currency", min: 0, sectionKeys: ["objects-of-issue"], visibleIf: hasFresh },
  { id: "objects_of_issue", group: "capital_offer", label: "Objects of the fresh issue", help: "How proceeds will be used", type: "textarea", required: true, maxLength: 3000, sectionKeys: ["objects-of-issue"], visibleIf: hasFresh },
  { id: "ofs_selling_shareholders", group: "capital_offer", label: "Selling shareholder(s) in the OFS", type: "textarea", required: true, maxLength: 1000, sectionKeys: ["offer-information", "capital-structure"], visibleIf: hasOfs },
  { id: "ofs_shares", group: "capital_offer", label: "Offer-for-sale size (number of equity shares)", type: "number", required: true, min: 1, sectionKeys: ["offer-information", "capital-structure"], visibleIf: hasOfs },
  { id: "ofs_amount", group: "capital_offer", label: "Offer-for-sale amount (₹ in lakhs)", help: "Optional until the issue price or price band is available — do not estimate it.", type: "currency", min: 0, sectionKeys: ["offer-information"], visibleIf: hasOfs },

  // Financials
  { id: "latest_revenue", group: "financials", label: "Latest FY revenue from operations (₹ in lakhs)", type: "currency", required: true, min: 0, sectionKeys: ["financial-information", "mda"] },
  { id: "latest_pat", group: "financials", label: "Latest FY profit after tax (₹ in lakhs)", type: "currency", required: true, sectionKeys: ["financial-information", "mda"] },
  { id: "net_worth", group: "financials", label: "Latest net worth (₹ in lakhs)", type: "currency", required: true, sectionKeys: ["financial-information", "basis-for-issue-price"] },
  { id: "has_contingent_liabilities", group: "financials", label: "Any contingent liabilities?", type: "boolean", required: true, sectionKeys: ["financial-information"] },
  { id: "contingent_details", group: "financials", label: "Contingent liabilities — details", type: "textarea", required: true, maxLength: 2000, sectionKeys: ["financial-information"], visibleIf: (a) => a.has_contingent_liabilities === true },

  // Legal
  { id: "has_litigation", group: "legal", label: "Any outstanding litigation?", type: "boolean", required: true, sectionKeys: ["legal-proceedings"] },
  { id: "litigation_summary", group: "legal", label: "Litigation summary", help: "Nature, parties, amounts", type: "textarea", required: true, maxLength: 3000, sectionKeys: ["legal-proceedings"], visibleIf: (a) => a.has_litigation === true },
];

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/** Questions currently visible given the answers so far (branching applied). */
export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.visibleIf || q.visibleIf(answers));
}

export type IntakeProgress = {
  visible: number;
  requiredVisible: number;
  requiredAnswered: number;
  complete: boolean;
  missingRequired: string[];
};

function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/** Completion status over the currently-visible required questions. */
export function intakeProgress(answers: Answers): IntakeProgress {
  const visible = visibleQuestions(answers);
  const required = visible.filter((q) => q.required);
  const missingRequired = required.filter((q) => !isAnswered(answers[q.id])).map((q) => q.id);
  return {
    visible: visible.length,
    requiredVisible: required.length,
    requiredAnswered: required.length - missingRequired.length,
    complete: missingRequired.length === 0 && required.length > 0,
    missingRequired,
  };
}

/** Build a zod validator for a single question (type + range + required). */
export function answerSchemaFor(q: Question): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (q.type) {
    case "number":
    case "currency": {
      let n = z.coerce.number({ invalid_type_error: `${q.label} must be a number` });
      if (q.min !== undefined) n = n.min(q.min, `${q.label} must be ≥ ${q.min}`);
      if (q.max !== undefined) n = n.max(q.max, `${q.label} must be ≤ ${q.max}`);
      base = n;
      break;
    }
    case "boolean":
      base = z.coerce.boolean();
      break;
    case "date":
      base = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, `${q.label} must be a valid date (YYYY-MM-DD)`);
      break;
    case "select":
      base = z.enum([...(q.options ?? []).map((o) => o.value)] as [string, ...string[]]);
      break;
    default: {
      let s = z.string().trim();
      if (q.maxLength) s = s.max(q.maxLength, `${q.label} must be ≤ ${q.maxLength} characters`);
      if (q.required) s = s.min(1, `${q.label} is required`);
      base = s;
    }
  }
  return q.required ? base : base.optional();
}

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/** Validate a single answer value against its question's rules. */
export function validateAnswer(q: Question, value: unknown): ValidationResult {
  if (
    (q.type === "number" || q.type === "currency") &&
    (value === null || value === undefined || (typeof value === "string" && value.trim() === ""))
  ) {
    return q.required
      ? { ok: false, error: `${q.label} is required` }
      : { ok: true, value: null };
  }
  const parsed = answerSchemaFor(q).safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? `Invalid ${q.label}` };
}
