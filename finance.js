import {
  planGoals,
  sipRequired,
  formatCurrencyPlain
} from "./goal-planner.js";

// const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
// const BOTTOM_MARGIN = 30; // space reserved for disclaimer
// const SECTION_MIN_HEIGHT = 40; // header + few rows
const DISCLAIMER_TEXT =
  "Disclaimer: Calculations are illustrative and based on assumed returns and inflation. "
  + "Mutual fund investments are subject to market risks, read all scheme-related documents carefully. Past performance does not guarantee future returns.";
const FONT_FAMILY = "helvetica";
// const SHOW_STEP_UP_SIP = true;
function addMutualFundDisclosureSection(doc) {
  // doc.addPage();
  let y = doc.lastAutoTable.finalY + 12;
  y = ensureSpace(doc, y, 20);
  doc.setFontSize(13);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Understanding Mutual Fund Investing With an Advisor", 10, y);
  doc.setFont(FONT_FAMILY, "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  y = ensureSpace(doc, y, 10);


  doc.setFontSize(11);
  const sections = [
    {
      title: "How Mutual Fund Investments Are Made",
      content:
        "Mutual funds pool money from investors and invest as per scheme objectives. "
        + "When you invest through a Mutual Fund Distributor, the distributor facilitates "
        + "scheme selection, execution, and service support. Investments are always held "
        + "directly in your name with the fund house."
    },
    {
      title: "Role of a SEBI-Registered Mutual Fund Distributor",
      content:
        "A Mutual Fund Distributor operates under SEBI regulations and assists investors "
        + "in goal identification, suitability assessment, execution, and ongoing support."
    },
    {
      title: "Regular Mutual Funds and Transparency",
      content:
        "Regular plans include a distribution commission paid by the fund house. "
        + "There is no separate charge paid by the investor."
    },
    {
      title: "Why Advisor Support Matters",
      content:
        "Investor behaviour plays a significant role in long-term outcomes. "
        + "Guided investing helps avoid emotional decisions and improves discipline."
    },
    {
      title: "Nature of Engagement",
      content:
        "This engagement is provided in the capacity of a Mutual Fund Distributor (MFD). "
        + "The role of the distributor is limited to facilitating suitable mutual fund investments, "
        + "execution support, and ongoing service assistance. "
        + "Investment decisions are taken by the client based on understanding and consent."
    },
    {
      title: "Direct and Regular Mutual Fund Plans",
      content:
        "Mutual fund schemes are available in both Direct and Regular plans. "
        + "In Regular plans, the fund house pays a distribution commission to the distributor "
        + "for service and ongoing support. "
        + "This commission is included in the scheme expense ratio and disclosed by the fund house. "
        + "The choice of plan is made with full transparency and investor understanding."
    },
    {
      title: "Assumptions Used in Calculations",
      content:
        "The projections and SIP calculations in this report are illustrative in nature and "
        + "based on assumed rates of return, inflation, and investment tenure for planning purposes. "
        + "Actual returns may differ significantly due to market conditions, fund performance, "
        + "and investor behavior."
    },
    {
      title: "Impact of Investor Behaviour",
      content:
        "Investor behavior plays a critical role in long-term investment outcomes. "
        + "Emotional decisions such as panic selling during market volatility or inconsistent investing "
        + "can materially impact results. Advisory support aims to help investors maintain discipline "
        + "aligned with long-term financial goals."
    },
    {
      title: "Important Disclosures",
      content:
        "Mutual fund investments are subject to market risks. "
        + "Past performance does not guarantee future returns. "
        + "Investments are held directly in the investor’s name with respective fund houses. "
        + "The distributor does not handle or control investor funds. "
        + "Final investment decisions rest solely with the investor."
    }
  ];
  y = y + 12;
  sections.forEach(sec => {
    y = ensureSpace(doc, y, 30);

    doc.setFontSize(13);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(sec.title, 10, y);
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.setFont(FONT_FAMILY, "normal");
    doc.text(sec.content, 10, y, { maxWidth: 190 });
    y += 18;
  });
  return y;
}

function addDisclaimerFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  // const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);

  for (let i = 2; i <= pageCount; i++) { // ⛔ skip cover page
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(229, 231, 235);
    doc.line(10, pageHeight - 22, pageWidth - 10, pageHeight - 22);

    //DISCLAIMER
    doc.text(
      DISCLAIMER_TEXT,
      10,
      pageHeight - 14,
      { maxWidth: 170 }
    );

    // Page number (right aligned)
    doc.text(
      `Page ${i - 1} of ${pageCount - 1}`,
      pageWidth - 10,
      pageHeight - 14,
      { align: "right" }
    );
  }
}

function ensureSpace(doc, currentY, requiredHeight = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 30;

  if (currentY + requiredHeight > pageHeight - bottomMargin) {
    doc.addPage();
    return 20; // reset Y for new page
  }

  return currentY;
}


// Inflation-adjusted future value
function inflateAmount(amount, inflation, years) {
  return amount * Math.pow(1 + inflation / 100, years);
}

function formatINR(amount) {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}


function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

const RETIREMENT_AGE = 60;

function yearsToRetirement(dob) {
  const age = calculateAge(dob);
  if (age === null) return null;

  return Math.max(RETIREMENT_AGE - age, 0);
}


// Retirement corpus (25x rule – industry standard)
function calculateRetirementCorpus(
  monthlyExpense,
  inflation,
  dob
) {
  const years = yearsToRetirement(dob);
  if (!years) return null;
  
  const futureMonthlyExpense =
    inflateAmount(monthlyExpense, inflation, years);

  const annualExpense = futureMonthlyExpense * 12;
  return annualExpense * 25;
}

/**
 * Goal planning section, driven entirely by the client_goals
 * rows the advisor saved. Prints two tables — what each goal
 * will cost, and what it takes to fund it — plus an
 * affordability line against the client's monthly savings.
 *
 * Returns the Y position to continue from.
 */
function addGoalPlanningSection(doc, startY, goals, client) {
  let y = ensureSpace(doc, startY, 60);

  doc.setFontSize(13);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Goal Planning", 10, y);
  doc.setFont(FONT_FAMILY, "normal");

  if (!goals || goals.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text(
      "No goals have been recorded for this client yet.",
      10,
      y + 8,
      { maxWidth: 190 }
    );
    return y + 18;
  }

  const { rows, totals } = planGoals(goals, client.monthly_savings);

  /* ---------- What each goal will cost ---------- */
  doc.autoTable({
    startY: y + 5,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 42, 68] },
    head: [[
      "Goal",
      "Horizon",
      "Amount (today)",
      "Inflation",
      "Target on goal date",
      "Already saved",
      "Shortfall"
    ]],
    body: rows.map(row => [
      row.goal_name || "-",
      `${row.years} years`,
      formatCurrencyPlain(row.amountToday),
      `${row.inflationPct}% p.a.`,
      formatCurrencyPlain(row.targetAmount),
      formatCurrencyPlain(row.existingCorpus),
      row.fullyFunded ? "Fully funded" : formatCurrencyPlain(row.shortfall)
    ]),
    foot: [[
      "Total",
      "",
      "",
      "",
      formatCurrencyPlain(totals.targetAmount),
      formatCurrencyPlain(totals.existingCorpus),
      formatCurrencyPlain(totals.shortfall)
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold" }
  });

  /* ---------- What it takes to fund them ---------- */
  y = ensureSpace(doc, doc.lastAutoTable.finalY + 12, 60);

  doc.setFontSize(12);
  doc.setFont(FONT_FAMILY, "bold");
  doc.text("Investment Required to Achieve Goals", 10, y);
  doc.setFont(FONT_FAMILY, "normal");

  doc.autoTable({
    startY: y + 5,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 42, 68] },
    head: [[
      "Goal",
      "Horizon",
      "Return assumed",
      "Monthly SIP",
      "Step-up SIP (start)",
      "Step-up rate",
      "Lumpsum today"
    ]],
    body: rows.map(row => [
      row.goal_name || "-",
      `${row.years} years`,
      `${row.returnPct}% p.a.`,
      formatCurrencyPlain(row.monthlySip),
      formatCurrencyPlain(row.stepUpSip),
      row.stepUpPct > 0 ? `${row.stepUpPct}% p.a.` : "-",
      formatCurrencyPlain(row.lumpsumToday)
    ]),
    foot: [[
      "Total",
      "",
      "",
      formatCurrencyPlain(totals.monthlySip),
      formatCurrencyPlain(totals.stepUpSip),
      "",
      formatCurrencyPlain(totals.lumpsumToday)
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold" }
  });

  y = doc.lastAutoTable.finalY + 10;

  /* ---------- Affordability ---------- */
  if (totals.monthlySavings !== undefined) {
    y = ensureSpace(doc, y, 24);
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    const line = totals.affordable
      ? `The total monthly SIP of ${formatCurrencyPlain(totals.monthlySip)} uses about `
        + `${Math.round(totals.savingsUtilisationPct)}% of current monthly savings of `
        + `${formatCurrencyPlain(totals.monthlySavings)}, leaving `
        + `${formatCurrencyPlain(totals.surplus)} unallocated.`
      : `The total monthly SIP of ${formatCurrencyPlain(totals.monthlySip)} exceeds current `
        + `monthly savings of ${formatCurrencyPlain(totals.monthlySavings)} by `
        + `${formatCurrencyPlain(Math.abs(totals.surplus))}. Starting with the step-up route at `
        + `${formatCurrencyPlain(totals.stepUpSip)} per month, extending the horizon, or `
        + `revising goal amounts would bring the plan within reach.`;

    doc.text(line, 10, y, { maxWidth: 190 });
    y += 14;
  }

  /* ---------- Basis of calculation ---------- */
  y = ensureSpace(doc, y, 24);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "Basis: goal amounts are stated in today's money and inflated to the goal date at the "
    + "inflation rate shown for each goal. SIP instalments are assumed to be invested at the "
    + "start of each month and to grow at the return shown for that goal. Any amount already "
    + "earmarked for a goal is grown at the same return and deducted, so the SIP funds only the "
    + "remaining shortfall. Step-up SIP starts at the amount shown and increases every year at "
    + "the step-up rate. Rates are planning assumptions, not guarantees.",
    10,
    y,
    { maxWidth: 190 }
  );
  doc.setTextColor(0, 0, 0);

  return y + 22;
}

export async function generateClientPlanningPDF(client, advisorChartImage, goals = []) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  // 🔹 ADD COVER PAGE
  addCoverPage(doc, client);

  // 🔹 MOVE TO NEXT PAGE
  doc.addPage();

  /* ================= HEADER ================= */
  doc.setFontSize(16);
  doc.text("Wealth & Investment Advisory Services", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.text("Raviteja Soma | Phone: 9390250541 | ARN-348767", 105, 22, { align: "center" });

  doc.line(10, 26, 200, 26);

  let currentY = 35;
  /* ================= CLIENT SUMMARY ================= */
  doc.setFontSize(13);
  doc.text("Client Summary", 10, currentY);

  doc.autoTable({
    startY: currentY + 5,
    theme: "grid",
    styles: { fontSize: 10 },
    head: [["Field", "Value"]],
    body: [
      ["Name", client.full_name],
      ["Age", calculateAge(client.date_of_birth)],
      ["Marital Status", client.marital_status],
      ["Dependents", client.dependents],
      ["Monthly Expenses", `Rs. ${client.monthly_expenses.toLocaleString("en-IN")}`],
      ["Monthly Savings", `Rs. ${client.monthly_savings.toLocaleString("en-IN")}`]
    ]
  });
  currentY = doc.lastAutoTable.finalY + 12;
  /* ================= GOAL PLANNING ================= */
  currentY = addGoalPlanningSection(doc, currentY, goals, client);

  /* ================= RETIREMENT ================= */
  // doc.addPage();
  currentY = ensureSpace(doc, currentY, 50);
  doc.setFontSize(13);
  doc.text("Retirement Planning", 10, currentY);

  // const retirementCorpus = calculateRetirementCorpus(
  //   client.monthly_expenses,
  //   inflationRate,
  //   client.retirement_years
  // );

  doc.autoTable({
    startY: currentY + 5,
    theme: "grid",
    styles: { fontSize: 10 },
    head: [["Parameter", "Value"]],
    body: [
      ["Current Age", calculateAge(client.date_of_birth)],
      ["Retirement Age", "60 (Assumed)"],
      ["Years to Retirement", yearsToRetirement(client.date_of_birth)],
      ["Required Retirement Corpus",
        `Rs. ${Math.round(
          calculateRetirementCorpus(
            client.monthly_expenses,
            6,
            client.date_of_birth
          )
        ).toLocaleString("en-IN")}`
      ]
    ]
  });

const retirementReturn = 10; // conservative
const retirementInflation = 6;

const years = yearsToRetirement(client.date_of_birth);

const retirementCorpus =
  calculateRetirementCorpus(
    client.monthly_expenses,
    retirementInflation,
    client.date_of_birth
  );

const retirementSip = sipRequired(
  retirementCorpus,
  retirementReturn,
  years
);

let retirementSipY = doc.lastAutoTable.finalY + 12;
retirementSipY = ensureSpace(doc, retirementSipY, 50);

doc.setFontSize(12);
doc.text("Monthly SIP Required for Retirement", 10, retirementSipY);

doc.autoTable({
  startY: retirementSipY + 4,
  theme: "grid",
  head: [["Parameter", "Value"]],
  styles: { fontSize: 10 },
  body: [
    ["Target Retirement Corpus", formatINR(retirementCorpus)],
    ["Years to Retirement", `${years} years`],
    ["Assumed Return", "10% p.a."],
    ["Required Monthly SIP", formatINR(retirementSip)]
  ]
});

// if (SHOW_STEP_UP_SIP) {
//   // Retirement
//   currentY = addRetirementStepUpSipTable(doc, currentY, client);
// }

  
  /* ================= DISCLAIMER ================= */
  // currentY = doc.lastAutoTable.finalY + 12;
  // currentY = ensureSpace(doc, currentY, 30);
  // doc.setFontSize(9);
  // doc.text(
  //   "Disclaimer: Calculations are illustrative and based on assumed inflation and planning norms. "
  //   + "Mutual fund investments are subject to market risks. Past performance does not guarantee future returns.",
  //   10,
  //   280,
  //   { maxWidth: 190 }
  // );
  currentY = addMutualFundDisclosureSection(doc);
  // ✅ Add advisor impact chart if available
  if (advisorChartImage) {
    addAdvisorImpactChart(doc, currentY, advisorChartImage);
  }
  addDisclaimerFooter(doc);
  doc.save(`${client.full_name}_Financial_Plan.pdf`);
}
function addAdvisorImpactChart(doc, currentY, chartImage) {
  doc.addPage();
  // let y = currentY + 6;


  doc.setFontSize(12);
  doc.setFont(FONT_FAMILY, "bold");
  doc.text("Research Insight: Value of Advisor Guidance", 10, 20);
  // y = y + 3;
  doc.addImage(chartImage, "PNG", 15, 30, 180, 100);

  doc.setFontSize(9);
  doc.setFont(FONT_FAMILY, "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(
    "Source: Industry research (e.g., Vanguard Advisor Alpha). "
    + "Illustrative comparison showing impact of disciplined, advisor-led investing. "
    + "Returns are not guaranteed and may vary.",
    10,
    140,
    { maxWidth: 190 }
  );
}

function addCoverPage(doc, client) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background subtle branding band
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, pageWidth, 60, "F");

  // Brand name
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text(
    "Wealth & Investment Advisory Services",
    pageWidth / 2,
    30,
    { align: "center" }
  );

  // Tagline
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  doc.text(
    "Personalized. Disciplined. Goal-Oriented.",
    pageWidth / 2,
    40,
    { align: "center" }
  );

  // Main title
  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.text(
    "Personal Financial Planning Report",
    pageWidth / 2,
    100,
    { align: "center" }
  );

  // Client name
  doc.setFontSize(16);
  doc.text(
    `Prepared for: ${client.full_name}`,
    pageWidth / 2,
    120,
    { align: "center" }
  );

  // Date
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
    pageWidth / 2,
    132,
    { align: "center" }
  );

  // After "Personal Financial Planning Report"
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  
  doc.text(
    "Prepared by a Mutual Fund Distributor for planning and illustration purposes",
    pageWidth / 2,
    140,
    { align: "center" }
  );
  
  // Reset color for next content
  doc.setTextColor(0, 0, 0);
  
  // Footer band
  doc.setFillColor(249, 250, 251);
  doc.rect(0, pageHeight - 50, pageWidth, 50, "F");

  // Advisor details
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text(
    "Raviteja Soma | Wealth & Investment Advisory",
    pageWidth / 2,
    pageHeight - 32,
    { align: "center" }
  );

  doc.setFontSize(10);
  doc.text(
    "Phone: 9390250541  |  WhatsApp Available | ARN-348767",
    pageWidth / 2,
    pageHeight - 22,
    { align: "center" }
  );

  // Disclaimer
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "This report is for informational purposes only and does not constitute investment advice.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );
}

function calculateStepUpSipRequired(
  futureValue,
  annualReturn,
  years,
  stepUpRate = 10
) {
  const r = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  const g = stepUpRate / 100;
  const months = years * 12;

  let low = 0;
  let high = futureValue;
  let mid;

  for (let i = 0; i < 60; i++) { // binary search iterations
    mid = (low + high) / 2;

    let accumulated = 0;
    for (let y = 0; y < years; y++) {
      const yearlySip = mid * Math.pow(1 + g, y);
      const remainingMonths = (years - y) * 12;

      const fvYear =
        yearlySip *
        ((Math.pow(1 + r, remainingMonths) - 1) / r);

      accumulated += fvYear;
    }

    if (accumulated > futureValue) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return mid;
}

function addRetirementStepUpSipTable(doc, currentY, client) {
  const inflationRate = 6;
  const returnRate = 10;
  const stepUpRate = 10;

  const years = yearsToRetirement(client.date_of_birth);

  const retirementCorpus =
    calculateRetirementCorpus(
      client.monthly_expenses,
      inflationRate,
      client.date_of_birth
    );

  const stepUpSip = calculateStepUpSipRequired(
    retirementCorpus,
    returnRate,
    years,
    stepUpRate
  );

  currentY = ensureSpace(doc, currentY, 60);

  // Heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Step-Up SIP Required for Retirement (10% Annual Increase)", 10, currentY);
  doc.setFont("helvetica", "normal");

  doc.autoTable({
    startY: currentY + 5,
    theme: "grid",
    styles: { fontSize: 10 },
    body: [
      ["Target Retirement Corpus", formatINR(retirementCorpus)],
      ["Years to Retirement", `${years} years`],
      ["Annual Step-Up Assumed", "10%"],
      ["Starting Monthly SIP", formatINR(stepUpSip)]
    ]
  });

  return doc.lastAutoTable.finalY + 12;
}

