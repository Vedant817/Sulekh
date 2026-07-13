# Real-World Test Data Sources and Coverage Audit

> Research snapshot: 14 July 2026
> Purpose: identify authoritative real-world inputs for testing and improving Sulekh's intake, extraction, retrieval, gap detection, generation, review, and export flows.

This file is a sourcing and validation guide. A URL appearing here does **not** automatically make it an approved corpus source. Regulatory documents must be reviewed, checksummed, versioned, and added to `sources.json` before ingestion. CAPTCHA-, OTP-, login-, or payment-protected systems must be handled through an assisted verification or authorised import flow, not brittle scraping.

## 1. Source tiers

### Tier A — official and suitable for automated ingestion

These sources are the best candidates for scheduled downloads or typed data adapters.

| Required data | Official source | Data available | Recommended use |
| --- | --- | --- | --- |
| Current ICDR rules | [SEBI ICDR Regulations, last amended 21 March 2026](https://www.sebi.gov.in/legal/regulations/mar-2026/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018-last-amended-on-march-21-2026-_100581.html) | Current consolidated regulations and schedules | Required regulatory corpus source; store effective date, checksum, retrieval date, and paragraph/page evidence. |
| Current ICDR circulars | [SEBI Master Circular for ICDR, 9 February 2026](https://www.sebi.gov.in/legal/master-circulars/feb-2026/master-circular-for-issue-of-capital-and-disclosure-requirements_99611.html) | Consolidated operational circulars | Required corpus source. Also monitor later circulars because they may post-date the master circular. |
| Post-master-circular changes | [SEBI circular on lock-in of pledged shares, 8 April 2026](https://www.sebi.gov.in/sebi_data/attachdocs/apr-2026/1775650797133.pdf) | Operational disclosure and Articles-of-Association requirements following the March 2026 amendment | Example of why a dated master circular alone is not sufficient; ingest applicable later circulars separately. |
| BSE SME offer documents | [BSE SME DRHP/RHP/Prospectus archive](https://www.bsesme.com/PublicIssues/SMEIPODRHP.aspx) | Filed DRHPs, RHPs, prospectuses and issue-related documents | Reference/evaluation dataset only. Keep separate from binding regulatory sources. |
| NSE Emerge offer documents | [NSE SME offer-document filings](https://www.nseindia.com/companies-listing/corporate-filings-offer-documents#sme_offer) | SME issuer offer documents and issue metadata | Add exchange and sector diversity; use for structure, extraction evaluation, and stage-to-stage comparisons. |
| Company master data | [MCA Company Master Data on data.gov.in](https://data.gov.in/catalog/company-master-data) | CIN, company name/status/class/category, registration date, registered state/office, RoC, authorised capital, paid-up capital and principal activity | First-choice implementation for `CompanyMasterProvider`; match by CIN, not company name alone. |
| Insolvency proceedings | [IBBI public announcements](https://ibbi.gov.in/public-announcement) | CIRP, liquidation and other public announcements searchable by corporate debtor | Periodic issuer-risk check; preserve the matching evidence and require human confirmation. |
| Registered intermediaries | [SEBI recognised intermediaries directory](https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognised=yes) | Current registered merchant bankers, RTAs, rating agencies and other intermediaries | Validate intermediary identity and registration status at assignment/review time. |
| Industry and macro benchmarks | [RBI Database on Indian Economy](https://dbieold.rbi.org.in/DBIE/) | Official economic, banking, corporate-sector and industry time series | Industry-overview and benchmarking context only; never treat as issuer-specific fact. |

### Tier B — official but requires assisted verification

These sources are useful, but CAPTCHA, OTP, authentication, payment, ambiguous name matching, or fragmented state-level coverage makes unattended scraping unreliable.

| Required data | Official source | Access limitation | Safe product flow |
| --- | --- | --- | --- |
| MCA filings, annual returns and financial statements | [MCA public-document service guidance](https://www.mca.gov.in/MCA21/dca/WebHelp/Help_MCA21_English.pdf) | Login and fees may apply | Let the issuer/intermediary retrieve and upload the relevant filing, then parse it and retain its MCA document metadata. |
| GST registration/profile | [GST Search Taxpayer manual](https://tutorial.gst.gov.in/userguide/taxpayersdashboard/Search_Taxpayer_manual.htm) | Some details require login; public search uses anti-automation controls | Guided lookup by GSTIN, evidence capture, and explicit promoter/intermediary confirmation. |
| MSME/Udyam registration | [Udyam Registration portal](https://www.udyamregistration.gov.in/) | Verification may require CAPTCHA or OTP | Guided verification for enterprise activity, units/plants, NIC codes and registration details. |
| District and subordinate court matters | [eCourts case-status search](https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus%2Findex) | CAPTCHA, court selection and false-positive name matches | Search legal name plus historical names and parties; require a human to accept/reject each result. |
| NCLT matters and orders | [National Company Law Tribunal](https://nclt.gov.in/) | Free-text results can be incomplete or ambiguous | Assisted CIN/name/alias search with bench, case number and order evidence. |
| Food licences | [FSSAI FoSCoS FBO search](https://foscos.fssai.gov.in/advance-fbo-search) | CAPTCHA and premise-specific licences | Sector-specific guided verification by licence number/company/premise. |
| Pollution-control consents | [OCMMS industry consent search](https://ocmms.nic.in/OCMMS_NEW/searchStatus.jsp) | State/district selection and uneven state-system coverage | Verify consent-to-establish/operate per plant and store approval/rejection date and document. |
| Environmental clearances | [PARIVESH](https://parivesh.nic.in/) | Proposal-specific searches; applicability tools are indicative rather than final legal opinions | Verify EC/FC/WL/CRZ proposals and approvals. Human review determines applicability. |
| Importer Exporter Code | [DGFT View Any IEC](https://www.dgft.gov.in/CP/?opt=uom-details) | Requires IEC and at least part of the firm name | Guided validation of IEC and status; store the result with retrieval time. |
| Trademarks and IP | [IP India trademark search](https://www.ipindia.gov.in/trade-marks-before-you-apply-search-existing-trademarks) | CAPTCHA/OTP or interactive search may apply | Assisted search by applicant, mark and class; confirm ownership and status manually. |

### Tier C — issuer/intermediary evidence, not dependable public data

The following inputs should remain private uploads or authorised integrations. The system must emit a gap when they are unavailable; it must not infer or fabricate them.

- Restated financial statements, audit reports, notes and auditor certificates.
- Bank statements, sanction letters, loan agreements, repayment history and working-capital records.
- Tax returns, assessments, notices and non-public GST details.
- Detailed cap table, allotment register, share-transfer history and beneficial-owner evidence.
- PAN/Aadhaar/KYC and personal data for promoters, directors and KMP.
- Board/shareholder resolutions, minutes and internal approvals.
- Customer and supplier contracts, order book and concentration schedules.
- Related-party ledgers and transaction schedules.
- Property deeds, leases, insurance policies and valuation reports.
- Employee data, labour registrations and material employment agreements.
- Credit-bureau or commercial-credit reports available only through licensed/consented access.
- Legal opinions, management representations and materiality determinations.

## 2. Current project drawbacks

### 2.1 Regulatory-source drift

`sources.json` currently treats a third-party 2023 ICDR master-circular copy and a third-party 2024 SME-framework copy as required sources. They should be replaced by authoritative SEBI-hosted documents after a requirement-by-requirement migration review. Later amendments and circulars also need a monitored incremental feed.

### 2.2 Narrow reference-document sample

The reference corpus has three BSE SME DRHPs, all from 2025. It does not cover:

- NSE Emerge;
- 2026 filings;
- a balanced selection of manufacturing, services, trading, food, healthcare, technology, chemicals, textiles and financial-services issuers;
- DRHP-to-RHP-to-prospectus changes;
- fresh-only, OFS-only, and mixed offers;
- withdrawn, delayed or materially revised cases.

Filed offer documents are examples, not regulatory truth. They must live in a distinct `reference_drhp`/evaluation namespace so their drafting choices cannot override SEBI requirements.

### 2.3 Missing external-data implementations

The implementation plan specifies typed `CompanyMasterProvider` and `GstProvider` adapters, but `src/server/adapters/` currently has no implementation. The MCA OGD dataset is the strongest first adapter because it is official, structured and keyed by CIN.

### 2.4 Intake-to-disclosure coverage gap

The current questionnaire captures a small high-level profile while generation targets 27 sections and the checklist contains 43 requirements. Additional structured inputs are required for:

- full registered/corporate office and contact information;
- directors, DINs, KMP history, compensation and corporate governance;
- promoters, promoter group, relatives, interests and disqualification/default confirmations;
- subsidiaries, group companies and related-party transactions;
- authorised/issued/subscribed/paid-up capital, allotment history and pre/post-issue shareholding;
- object-wise fund requirement, deployment schedule, funding already deployed and means of finance;
- restated multi-period statements, ratios, accounting policies, qualifications and contingent liabilities;
- borrowings, charges, defaults, outstanding dues and indebtedness;
- properties, insurance, material contracts, intellectual property and employees;
- customers, suppliers, order book, capacity utilisation and concentration;
- company/promoter/director/subsidiary/group-company litigation and regulatory actions;
- sector-specific licences and statutory approvals.

Every checklist requirement should map to one or more of: an intake field, extracted entity, verified public-source field, uploaded evidence item, or explicit gap.

### 2.5 Extraction-schema limitations

The current structured extraction supports five entity types: financial line items, cap-table rows, litigation items, KMP and promoters. MoA/AoA and board resolutions currently yield no structured entities.

Financial extraction also needs richer normalization:

- exact period start/end dates;
- currency and scale normalization;
- standalone versus consolidated scope;
- audited versus restated status;
- current/prior-year column identity;
- sign and debit/credit treatment;
- source page, table, row and note reference;
- subtotals and reconciliation relationships.

New extraction schemas are required for corporate objects/articles, allotments, directors, group entities, related parties, borrowings/charges, approvals, properties, material contracts, auditor observations and object-wise use of proceeds.

### 2.6 Entity-resolution risk

Company-name searches can produce false positives. Public-source adapters and assisted searches should use a canonical issuer identity containing:

- CIN as the primary company identifier;
- legal name and former names;
- GSTINs and registered places of business;
- Udyam and IEC identifiers where applicable;
- director DINs;
- aliases and normalized addresses.

A public result must not automatically become a confirmed issuer fact merely because its name resembles the issuer's name.

### 2.7 No independent truth benchmark

Uploading a completed public DRHP is valuable for exercising the full pipeline, but it is not proof that raw issuer documents can be transformed into an accurate draft. The source DRHP already contains assembled and legally reviewed disclosures. A production evaluation also needs independently labelled raw documents from a consenting issuer or authorised data room.

### 2.8 Freshness, provenance and legal-use controls

Every fetched or uploaded fact should retain:

- source system and source type;
- canonical source URL or uploaded-document ID;
- issuer identifiers used for matching;
- source effective/as-of date;
- retrieval timestamp;
- document checksum and version;
- exact page/table/snippet evidence;
- extraction confidence;
- promoter/intermediary confirmation status and actor;
- expiry/reverification date where applicable.

Public pages must be used consistently with their terms and technical access controls. CAPTCHA, OTP and paywalls are product-boundary signals, not obstacles to bypass.

## 3. Real-world validation dataset

### 3.1 Regulatory truth set

Maintain a corpus consisting only of official SEBI-hosted regulations, master circulars, subsequent applicable circulars, SME-framework decisions, standard templates/checklists, and official exchange rules. For each document, retain its effective period and supersession relationship.

Expected tests:

- every checklist citation resolves to the authoritative document and page/paragraph;
- requirements effective on a chosen historical date can be reproduced;
- a new or changed circular triggers a review instead of silently changing prior generations;
- regulatory and reference-document chunks cannot be confused in retrieval.

### 3.2 Offer-document reference set

Target at least 30 official SME offer-document cases:

- both BSE SME and NSE Emerge;
- filings from 2024, 2025 and 2026;
- at least five materially different sectors;
- fresh-only, OFS-only and fresh-plus-OFS structures where available;
- DRHP/RHP/prospectus stage pairs for change analysis;
- a mix of issuer sizes and document lengths.

For each case, store only public metadata needed for reproducibility: issuer legal name, CIN, exchange, sector, offer type, filing stage, filing date, official URL, checksum and retrieval date.

### 3.3 Public issuer-profile set

Match the offer-document cases to MCA Company Master Data using CIN. Label expected company name, status, incorporation date, registered office/state, authorised capital, paid-up capital and activity. Test:

- exact CIN matching;
- name/address disagreement flags;
- former-name handling;
- stale or missing public records;
- no cross-issuer contamination.

### 3.4 Consented raw-document set

Obtain one or more authorised SME data rooms containing, where applicable:

- incorporation certificate, MoA and AoA;
- three-year audited/restated financial statements and notes;
- cap table and allotment history;
- promoter/director/KMP records;
- litigation register and notices;
- borrowings/charges schedule;
- related-party schedule;
- material licences and approvals;
- board/shareholder resolutions;
- object-of-issue budgets and quotations;
- material contracts and property/insurance evidence.

The expected structured values must be labelled by a qualified human reviewer with page/table/snippet evidence. Sensitive files must not be committed to Git.

### 3.5 Negative and edge cases

Include real or consented examples of:

- expired or rejected licences;
- pending litigation with similar party names;
- contradictory share counts;
- financial statements using rupees, thousands, lakhs and crores;
- negative values shown in parentheses;
- scanned or partially illegible pages;
- changed company/promoter names;
- standalone and consolidated statements in one document;
- missing periods or auditor qualifications;
- a document uploaded under the wrong category;
- a fact present in a public source but absent from issuer evidence, and vice versa.

## 4. Evaluation measures

The end-to-end evaluation should report more than HTTP success or generation completion.

| Area | Required measurement |
| --- | --- |
| Identity resolution | CIN exact-match rate, false-positive entity matches, alias handling |
| Document classification | Correct document-type rate and wrong-category detection |
| Extraction | Field precision/recall, numeric accuracy, period/unit/scope accuracy, evidence-pointer accuracy |
| Reconciliation | Share-capital, object-of-issue, financial subtotal and date inconsistency detection |
| Retrieval | Requirement relevance, authoritative-source rate, citation resolution, regulatory/reference isolation |
| Gap detection | Mandatory-gap recall, false-positive gaps, unresolved `[[GAP: ...]]` behavior |
| Generation | Unsupported-fact rate, citation correctness, cross-issuer leakage, numerical consistency |
| Review/export | Approval-gate enforcement, watermark enforcement, audit-trail completeness, DOCX/PDF validity |
| Freshness | Stale-source detection and effective-date correctness |

No suite should be reported as verified when it skipped because a database, credential, corpus document, storage service, or real test input was unavailable.

## 5. Recommended implementation sequence

### P0 — regulatory and identity correctness

1. Replace required third-party regulatory files with current official SEBI documents.
2. Add effective-date, supersession and change-detection metadata to the corpus workflow.
3. Separate binding regulatory sources from non-binding reference DRHPs in retrieval.
4. Implement the MCA Company Master adapter keyed by CIN.
5. Add field-level provenance and verification status.

### P1 — disclosure completeness

1. Create a 43-requirement input/evidence coverage matrix.
2. Expand the guided intake based on that matrix while preserving conditional branching.
3. Add extraction schemas for MoA/AoA, board resolutions, annual returns, restated statements, allotments, RPTs, borrowings/charges, approvals and contracts.
4. Add deterministic reconciliation before and after drafting.
5. Build and label the multi-issuer offer-document evaluation set.

### P2 — assisted external verification

1. Add explicit guided flows for GST, Udyam, eCourts, NCLT and IBBI.
2. Add sector adapters/verification modules for FSSAI, OCMMS/PARIVESH, DGFT and IP India.
3. Support authorised MCA filing imports and licensed credit-data providers behind typed adapters.
4. Add source freshness reminders and intermediary re-verification controls.

## 6. Source-admission checklist

Before adding any new file or endpoint to a production path, confirm:

- [ ] The publisher is authoritative for the claimed fact.
- [ ] The URL is an official canonical URL where one exists.
- [ ] Automated access is permitted and technically supported.
- [ ] The effective date and superseded documents are known.
- [ ] The file/response can be checksummed and reproduced.
- [ ] Entity matching uses CIN or another strong identifier.
- [ ] Exact evidence can be retained without exposing unnecessary PII.
- [ ] Failures and stale results surface clearly as gaps or verification requests.
- [ ] Reference examples cannot override regulatory requirements.
- [ ] A qualified human reviews legally material ambiguity.

## 7. Current repository location

This guide lives in `corpus/` because the existing real DRHP E2E fixture and regulatory source documents are maintained there. The ingestion manifest remains `corpus/sources.json`; sources from this guide must not be added to that manifest until they pass the source-admission checklist above.
