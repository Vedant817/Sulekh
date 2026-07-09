/**
 * Requirement checklist — SME/ICDR disclosure requirements mapped to DRHP
 * sections. Citations reference the SEBI (ICDR) Regulations, 2018 (Schedule VI,
 * Part A is the disclosure schedule for the offer document) and Chapter IX (the
 * SME-specific chapter), plus the SEBI ICDR Master Circular. Every section in
 * the catalogue has at least one requirement; key sections have several.
 *
 * This is the authoritative catalogue the Gap & Consistency engine checks
 * coverage against — it is derived from the framework, not from model output.
 */
export type RequirementItem = {
  code: string;
  sectionKey: string;
  title: string;
  description: string;
  mandatory: boolean;
  sourceCitation: string;
  ordinal: number;
};

export const REQUIREMENT_CHECKLIST: RequirementItem[] = [
  // Cover page
  { code: "CP-01", sectionKey: "cover-page", title: "Issuer identity & incorporation particulars", description: "Name, date and place of incorporation, registered & corporate office, CIN, contact details on the cover.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (I) — Cover Page" , ordinal: 1 },
  { code: "CP-02", sectionKey: "cover-page", title: "Offer details & type on cover", description: "Nature, type, number and price of specified securities; fresh issue / offer for sale split; face value.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (I)", ordinal: 2 },
  { code: "CP-03", sectionKey: "cover-page", title: "Lead manager, registrar & listing board", description: "Book running/lead manager, registrar to the issue, and the SME exchange platform (BSE SME / NSE Emerge).", mandatory: true, sourceCitation: "ICDR 2018, Chapter IX; Schedule VI, Part A (I)", ordinal: 3 },

  // Definitions
  { code: "DEF-01", sectionKey: "definitions", title: "Definitions, conventional & industry terms, abbreviations", description: "Complete definitions and abbreviations used throughout the document.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (II)", ordinal: 4 },

  // Risk factors
  { code: "RF-01", sectionKey: "risk-factors", title: "Risk factors — internal and external", description: "Risks specific to the issuer, its business, the offer, and external factors, materially affecting the investment.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (III)", ordinal: 5 },
  { code: "RF-02", sectionKey: "risk-factors", title: "Risk prioritisation & quantification", description: "Risks disclosed in order of materiality with financial quantification where ascertainable.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (III)", ordinal: 6 },

  // Introduction
  { code: "INT-01", sectionKey: "introduction", title: "Summary of industry, business and offer", description: "Concise summary of the industry, business, the offer, and selected financial information.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (IV)", ordinal: 7 },

  // General information
  { code: "GI-01", sectionKey: "general-information", title: "Issue-related parties & experts", description: "Board, company secretary & compliance officer, bankers, lead manager, registrar, legal counsel, auditors, experts.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (V)", ordinal: 8 },
  { code: "GI-02", sectionKey: "general-information", title: "Credit rating, IPO grading, monitoring & underwriting", description: "Credit rating (if any), IPO grading (if applicable), monitoring agency, and underwriting/market-making arrangements.", mandatory: false, sourceCitation: "ICDR 2018, Chapter IX; Schedule VI, Part A (V)", ordinal: 9 },

  // Capital structure
  { code: "CS-01", sectionKey: "capital-structure", title: "Share capital build-up (pre- & post-issue)", description: "Authorised, issued, subscribed and paid-up capital before and after the issue.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VI)", ordinal: 10 },
  { code: "CS-02", sectionKey: "capital-structure", title: "History of equity share capital & allotments", description: "History of allotments with dates, consideration, and price.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VI)", ordinal: 11 },
  { code: "CS-03", sectionKey: "capital-structure", title: "Promoter contribution & lock-in", description: "Minimum promoters' contribution and lock-in of pre-issue capital as applicable to SME issues.", mandatory: true, sourceCitation: "ICDR 2018, Reg. 236–238 (Chapter IX); Reg. 238 lock-in", ordinal: 12 },
  { code: "CS-04", sectionKey: "capital-structure", title: "Shareholding pattern", description: "Pre- and post-issue shareholding pattern of promoter/promoter group and public.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VI)", ordinal: 13 },

  // Objects of the issue
  { code: "OBJ-01", sectionKey: "objects-of-issue", title: "Objects & means of finance", description: "Objects of the issue, the means of finance, and confirmation of firm arrangements.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VII)", ordinal: 14 },
  { code: "OBJ-02", sectionKey: "objects-of-issue", title: "Deployment schedule & monitoring", description: "Year-wise deployment of proceeds, schedule of implementation, and monitoring mechanism.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VII)", ordinal: 15 },

  // Basis for issue price
  { code: "BIP-01", sectionKey: "basis-for-issue-price", title: "Qualitative & quantitative factors", description: "Basis for the issue price: qualitative factors and quantitative factors (EPS, P/E, RoNW, NAV) with peer comparison.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (VIII)", ordinal: 16 },

  // Tax benefits
  { code: "TAX-01", sectionKey: "tax-benefits", title: "Statement of special tax benefits", description: "Special tax benefits available to the company and its shareholders, certified by the statutory auditor.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (IX)", ordinal: 17 },

  // Industry overview
  { code: "IND-01", sectionKey: "industry-overview", title: "Industry overview with sourced data", description: "Overview of the industry with the source of industry data disclosed.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (X)", ordinal: 18 },

  // Business overview
  { code: "BUS-01", sectionKey: "business-overview", title: "Business, products/services & operations", description: "Description of the business, principal products/services, operations, and business model.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XI)", ordinal: 19 },
  { code: "BUS-02", sectionKey: "business-overview", title: "Properties, capacity, customers, competition, employees", description: "Immovable properties, installed/utilised capacity, key customers/suppliers, competition, and employee strength.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XI)", ordinal: 20 },

  // Key regulations
  { code: "REG-01", sectionKey: "key-regulations", title: "Key industry regulations & policies", description: "Key laws, regulations, and policies governing the issuer's business.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XII)", ordinal: 21 },

  // History & corporate structure
  { code: "HIS-01", sectionKey: "history-corporate-structure", title: "History, main objects & material events", description: "Brief history, changes in registered office/objects, major events and milestones.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XIII)", ordinal: 22 },
  { code: "HIS-02", sectionKey: "history-corporate-structure", title: "Subsidiaries, holding & key agreements", description: "Subsidiaries/holding company, shareholders' agreements, and other material agreements.", mandatory: false, sourceCitation: "ICDR 2018, Schedule VI, Part A (XIII)", ordinal: 23 },

  // Management
  { code: "MGT-01", sectionKey: "management", title: "Board of directors & KMP", description: "Details of directors and key managerial personnel, including experience and other directorships.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XIV)", ordinal: 24 },
  { code: "MGT-02", sectionKey: "management", title: "Corporate governance & remuneration", description: "Corporate governance compliance, board committees, and directors' remuneration.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XIV)", ordinal: 25 },

  // Promoters
  { code: "PRO-01", sectionKey: "promoters", title: "Promoters & promoter group details", description: "Promoters' background, PAN/DIN, shareholding, and details of the promoter group.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XV)", ordinal: 26 },
  { code: "PRO-02", sectionKey: "promoters", title: "Interests of promoters & related confirmations", description: "Interests of promoters in the issuer, and confirmations regarding wilful defaulter/fugitive status.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XV); Reg. 5", ordinal: 27 },

  // Group companies
  { code: "GRP-01", sectionKey: "group-companies", title: "Group companies & common pursuits", description: "Group companies, their financials, related business transactions, and conflicts/common pursuits.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XVI)", ordinal: 28 },

  // Related party transactions
  { code: "RPT-01", sectionKey: "related-party-transactions", title: "Related party transactions", description: "Related party transactions per restated financials and the applicable accounting standard.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XVII); AS-18 / Ind AS 24", ordinal: 29 },

  // Dividend policy
  { code: "DIV-01", sectionKey: "dividend-policy", title: "Dividend policy & history", description: "The dividend policy and dividends declared over the reported periods.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XVIII)", ordinal: 30 },

  // Financial information
  { code: "FIN-01", sectionKey: "financial-information", title: "Restated financial statements", description: "Restated financial statements (P&L, balance sheet, cash flow) for the required periods with the auditor's report.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XIX); Reg. 246", ordinal: 31 },
  { code: "FIN-02", sectionKey: "financial-information", title: "Restated financials reporting period (SME)", description: "Financial information for the periods required for SME issuers under Chapter IX.", mandatory: true, sourceCitation: "ICDR 2018, Chapter IX (Reg. 246)", ordinal: 32 },

  // MD&A
  { code: "MDA-01", sectionKey: "mda", title: "Management discussion & analysis", description: "MD&A of financial condition and results of operations, with period-on-period drivers explained.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XX)", ordinal: 33 },

  // Legal proceedings
  { code: "LEG-01", sectionKey: "legal-proceedings", title: "Outstanding litigation & defaults", description: "Outstanding litigation, criminal/tax/statutory proceedings, defaults and dues, per the materiality policy.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXI)", ordinal: 34 },
  { code: "LEG-02", sectionKey: "legal-proceedings", title: "Material developments since last balance sheet", description: "Material developments after the date of the latest balance sheet included.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXI)", ordinal: 35 },

  // Statutory approvals
  { code: "APP-01", sectionKey: "statutory-approvals", title: "Government & statutory approvals", description: "Material approvals, licences and consents obtained and pending for business and the issue.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXII)", ordinal: 36 },

  // Other regulatory disclosures
  { code: "ORD-01", sectionKey: "other-regulatory-disclosures", title: "Authority for the issue & eligibility", description: "Authority for the issue, eligibility under ICDR/Chapter IX, and SEBI/exchange disclaimers.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXIII); Chapter IX eligibility", ordinal: 37 },
  { code: "ORD-02", sectionKey: "other-regulatory-disclosures", title: "Prohibition & compliance confirmations", description: "Confirmations regarding SEBI prohibition, association with securities market, and compliance.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXIII); Reg. 5", ordinal: 38 },

  // Offer information
  { code: "OFF-01", sectionKey: "offer-information", title: "Terms of the offer & structure", description: "Terms of the offer, offer structure, and ranking of the equity shares.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXIV)", ordinal: 39 },
  { code: "OFF-02", sectionKey: "offer-information", title: "Offer procedure, allotment & market making", description: "Offer procedure, basis of allotment, and mandatory market making for the SME platform.", mandatory: true, sourceCitation: "ICDR 2018, Chapter IX (market making); Schedule VI, Part A (XXIV)", ordinal: 40 },

  // Articles of association
  { code: "AOA-01", sectionKey: "articles-of-association", title: "Main provisions of the Articles of Association", description: "Principal provisions of the issuer's Articles of Association.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXV)", ordinal: 41 },

  // Material contracts
  { code: "MC-01", sectionKey: "material-contracts", title: "Material contracts & documents for inspection", description: "Material contracts and documents available for inspection by prospective investors.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXVI)", ordinal: 42 },

  // Declaration
  { code: "DEC-01", sectionKey: "declaration", title: "Declaration by directors/promoters", description: "Declaration that disclosures comply with the Companies Act, 2013 and SEBI ICDR Regulations, 2018.", mandatory: true, sourceCitation: "ICDR 2018, Schedule VI, Part A (XXVII)", ordinal: 43 },
];
