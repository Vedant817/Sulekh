import { createSqlClient } from "../client";

/**
 * Seed ONE clearly-labelled synthetic sample issuer for the demo. All values are
 * fictional (the company name carries "(SAMPLE)") and internally consistent so
 * the gap & consistency engine passes clean. Idempotent (fixed UUIDs).
 *
 * Note: this inserts an auth.users row directly for the demo owner. On a cloud
 * Supabase project you would normally create the demo login via sign-up (GoTrue)
 * and then run this to attach the sample data; here it makes the data self-contained.
 */
const OWNER = "5a11f11e-0000-4000-8000-000000000001";
const PROJECT = "5a11f11e-0000-4000-8000-000000000002";
const OWNER_EMAIL = "demo-promoter@sulekh.sample";

const INTAKE: Record<string, unknown> = {
  legal_name: "DemoTech Manufacturing Limited (SAMPLE)",
  cin: "U29309MH2015PLC000000",
  incorporation_date: "2015-06-12",
  registered_office_state: "Maharashtra",
  issuer_type: "manufacturing",
  sector: "manufacturing_industrial",
  business_description:
    "DemoTech Manufacturing Limited (SAMPLE) designs and manufactures precision industrial components for the automotive and general engineering sectors.",
  installed_capacity: "24,000 units per annum",
  plant_locations: "Plot 12, MIDC Industrial Area, Pune, Maharashtra",
  promoter_names: "Anita Rao, Vikram Rao",
  promoter_count: 2,
  face_value: 10,
  pre_issue_shares: 5_000_000,
  offer_structure: "fresh_only",
  fresh_issue_shares: 2_000_000,
  fresh_issue_amount: 1500, // ₹ in lakhs
  objects_of_issue:
    "Funding capital expenditure for a new production line, upgrading existing machinery, and general corporate purposes.",
  latest_revenue: 4200,
  latest_pat: 360,
  net_worth: 1850,
  has_contingent_liabilities: false,
  has_litigation: false,
};

// Cap table consistent with pre_issue_shares (5,000,000) and 100% holding.
const CAP_TABLE = [
  { holder_name: "Anita Rao", category: "Promoter", shares: 2_600_000, percentage: 52 },
  { holder_name: "Vikram Rao", category: "Promoter", shares: 1_900_000, percentage: 38 },
  { holder_name: "Rao Family Trust", category: "Promoter Group", shares: 500_000, percentage: 10 },
];

const FINANCIALS = [
  { statement: "profit_and_loss", period_label: "FY25", line_item: "Revenue from operations", amount: 4200, unit: "INR lakhs" },
  { statement: "profit_and_loss", period_label: "FY25", line_item: "Profit after tax", amount: 360, unit: "INR lakhs" },
  { statement: "balance_sheet", period_label: "FY25", line_item: "Net worth", amount: 1850, unit: "INR lakhs" },
];

async function main() {
  const sql = createSqlClient();
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      // Clean any prior sample (cascade).
      await tx`delete from auth.users where id = ${OWNER}`;

      await tx`insert into auth.users (id, email, raw_user_meta_data)
        values (${OWNER}, ${OWNER_EMAIL}, ${tx.json({ role: "promoter", full_name: "Demo Promoter (SAMPLE)" })})`;

      await tx`insert into public.ipo_projects (id, owner_id, name, status, target_board)
        values (${PROJECT}, ${OWNER}, 'DemoTech Manufacturing Limited — BSE SME IPO (SAMPLE)', 'intake', 'BSE_SME')`;

      await tx`insert into public.issuer_profile (project_id, legal_name, cin, incorporation_date, registered_office, sector)
        values (${PROJECT}, ${INTAKE.legal_name as string}, ${INTAKE.cin as string}, ${INTAKE.incorporation_date as string},
                ${tx.json({ state: INTAKE.registered_office_state as string })}, ${INTAKE.sector as string})`;

      let version = 1;
      for (const [key, value] of Object.entries(INTAKE)) {
        await tx`insert into public.intake_answers (project_id, question_id, answer_key, value, version)
          values (${PROJECT}, ${key}, ${key}, ${tx.json(value as never)}, ${version})`;
        version += 1;
      }

      for (const row of CAP_TABLE) {
        await tx`insert into public.extracted_entities
            (project_id, entity_type, data, source_snippet, confirmed_by_promoter, confirmed_by, confirmed_at)
          values (${PROJECT}, 'cap_table_row', ${tx.json(row)},
                  ${`${row.holder_name} holds ${row.shares.toLocaleString("en-IN")} shares (${row.percentage}%)`},
                  true, ${OWNER}, now())`;
      }
      for (const row of FINANCIALS) {
        await tx`insert into public.extracted_entities
            (project_id, entity_type, data, source_snippet, confirmed_by_promoter, confirmed_by, confirmed_at)
          values (${PROJECT}, 'financial_line_item', ${tx.json(row)},
                  ${`${row.line_item}: ${row.amount} ${row.unit} (${row.period_label})`},
                  true, ${OWNER}, now())`;
      }

      await tx`insert into public.capital_structure
          (project_id, authorized_capital, pre_issue_capital, face_value, shareholding)
        values (${PROJECT}, ${60_000_000}, ${50_000_000}, ${10}, ${tx.json(CAP_TABLE)})`;

      await tx`insert into public.offer_details (project_id, issue_type, fresh_issue_amount, objects)
        values (${PROJECT}, 'fresh', ${1500},
                ${tx.json([
                  { label: "New production line capex", amount: 900 },
                  { label: "Machinery upgrade", amount: 350 },
                  { label: "General corporate purposes", amount: 250 },
                ])})`;
    });

    console.log("✔ Seeded sample issuer: DemoTech Manufacturing Limited (SAMPLE)");
    console.log(`  project_id = ${PROJECT}`);
    console.log(`  owner = ${OWNER_EMAIL}`);
    console.log("  Intake, confirmed cap table + financials, capital structure, and offer are internally consistent.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✖ Sample issuer seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
