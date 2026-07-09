/**
 * Canonical DRHP section catalogue — the material disclosure sections of SEBI
 * ICDR Part A applicable to SME issuers (IMPLEMENTATION_PLAN §4.3), in filing
 * order. Seeded into public.drhp_section_catalog; generation and the checklist
 * derive the section list from the DB, not from hardcoded prose elsewhere.
 */
export type SectionCatalogItem = {
  sectionKey: string;
  title: string;
  ordinal: number;
  mandatory: boolean;
  description: string;
};

export const SECTION_CATALOG: SectionCatalogItem[] = [
  { sectionKey: "cover-page", title: "Cover Page & General Information", ordinal: 1, mandatory: true, description: "Front cover: issuer identity, offer summary, lead manager, registrar, listing board, risk statement." },
  { sectionKey: "definitions", title: "Definitions & Abbreviations", ordinal: 2, mandatory: true, description: "Defined terms, conventional/industry terms, and abbreviations used in the document." },
  { sectionKey: "risk-factors", title: "Risk Factors", ordinal: 3, mandatory: true, description: "Internal and external risks material to the issue, prioritised, with quantification where possible." },
  { sectionKey: "introduction", title: "Introduction (Summary of Industry, Business & Offer)", ordinal: 4, mandatory: true, description: "Summary of the industry, business, offer, and selected financial information." },
  { sectionKey: "general-information", title: "General Information", ordinal: 5, mandatory: true, description: "Registered office, board, company secretary/compliance officer, bankers, lead manager, registrar, credit rating, IPO grading, experts." },
  { sectionKey: "capital-structure", title: "Capital Structure", ordinal: 6, mandatory: true, description: "Authorised/issued/subscribed/paid-up capital, pre- and post-issue shareholding, history of allotments, lock-in." },
  { sectionKey: "objects-of-issue", title: "Objects of the Issue", ordinal: 7, mandatory: true, description: "Objects, means of finance, deployment schedule, monitoring, and general corporate purposes." },
  { sectionKey: "basis-for-issue-price", title: "Basis for Issue Price", ordinal: 8, mandatory: true, description: "Qualitative and quantitative factors — EPS, P/E, RoNW, NAV, comparison with peers — justifying the price." },
  { sectionKey: "tax-benefits", title: "Statement of Special Tax Benefits", ordinal: 9, mandatory: true, description: "Special tax benefits available to the company and its shareholders, certified by the auditor." },
  { sectionKey: "industry-overview", title: "Industry Overview", ordinal: 10, mandatory: true, description: "Overview of the industry in which the issuer operates, with sourced data." },
  { sectionKey: "business-overview", title: "Business Overview", ordinal: 11, mandatory: true, description: "Business, products/services, operations, properties, capacity, customers, competition, employees." },
  { sectionKey: "key-regulations", title: "Key Regulations & Policies", ordinal: 12, mandatory: true, description: "Key laws, regulations, and policies applicable to the issuer's business in India." },
  { sectionKey: "history-corporate-structure", title: "History & Certain Corporate Matters", ordinal: 13, mandatory: true, description: "Incorporation, changes in registered office/objects, major events, subsidiaries, key agreements." },
  { sectionKey: "management", title: "Our Management (Board & KMP)", ordinal: 14, mandatory: true, description: "Board of directors, KMP, remuneration, corporate governance, borrowing powers, organisational structure." },
  { sectionKey: "promoters", title: "Our Promoters & Promoter Group", ordinal: 15, mandatory: true, description: "Promoters, their background, shareholding, interests, and the promoter group." },
  { sectionKey: "group-companies", title: "Group Companies", ordinal: 16, mandatory: true, description: "Group companies, their financials, related business, and common pursuits/conflicts." },
  { sectionKey: "related-party-transactions", title: "Related Party Transactions", ordinal: 17, mandatory: true, description: "Related party transactions per the restated financial statements and applicable accounting standards." },
  { sectionKey: "dividend-policy", title: "Dividend Policy", ordinal: 18, mandatory: true, description: "The issuer's dividend policy and dividends declared in recent periods." },
  { sectionKey: "financial-information", title: "Financial Information (Restated)", ordinal: 19, mandatory: true, description: "Restated financial statements (P&L, balance sheet, cash flows) and auditor's report for the required periods." },
  { sectionKey: "mda", title: "Management's Discussion & Analysis", ordinal: 20, mandatory: true, description: "MD&A of financial condition and results of operations, period-on-period, with drivers explained." },
  { sectionKey: "legal-proceedings", title: "Outstanding Litigation & Material Developments", ordinal: 21, mandatory: true, description: "Outstanding litigation, defaults, dues, and material developments since the last balance sheet." },
  { sectionKey: "statutory-approvals", title: "Government & Other Statutory Approvals", ordinal: 22, mandatory: true, description: "Approvals, licences, and consents obtained/pending for the business and the issue." },
  { sectionKey: "other-regulatory-disclosures", title: "Other Regulatory & Statutory Disclosures", ordinal: 23, mandatory: true, description: "Authority for the issue, prohibitions by SEBI, eligibility, compliance with SME provisions, disclaimers." },
  { sectionKey: "offer-information", title: "Offer-Related Information (Terms & Procedure)", ordinal: 24, mandatory: true, description: "Terms of the offer, offer structure, offer procedure, basis of allotment, market making." },
  { sectionKey: "articles-of-association", title: "Main Provisions of the Articles of Association", ordinal: 25, mandatory: true, description: "Principal provisions of the Articles of Association of the issuer." },
  { sectionKey: "material-contracts", title: "Material Contracts & Documents for Inspection", ordinal: 26, mandatory: true, description: "Material contracts and documents available for inspection by investors." },
  { sectionKey: "declaration", title: "Declaration", ordinal: 27, mandatory: true, description: "Declaration by the directors/promoters that the disclosures comply with the Act and SEBI regulations." },
];
