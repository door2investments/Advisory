// const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
// const BOTTOM_MARGIN = 30; // space reserved for disclaimer
// const SECTION_MIN_HEIGHT = 40; // header + few rows
const DISCLAIMER_TEXT =
  "Disclaimer: Calculations are illustrative and based on assumed returns and inflation. "
  + "Mutual fund investments are subject to market risks, read all scheme-related documents carefully. Past performance does not guarantee future returns.";
const FONT_FAMILY = "helvetica"
function addMutualFundDisclosureSection(doc) {
  // doc.addPage();
  let y = doc.lastAutoTable.finalY + 12;

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

function calculateSipRequired(futureValue, annualReturn, years) {
  const n = years * 12;
  const r = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;

  if (r === 0) return futureValue / n;

  return futureValue * r / (Math.pow(1 + r, n) - 1);
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

export async function generateClientPlanningPDF(client,advisorChartImage) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  // 🔹 ADD COVER PAGE
  addCoverPage(doc, client);

  // 🔹 MOVE TO NEXT PAGE
  doc.addPage();
  const inflationRate = 6;

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
      ["Monthly Expenses", `RS. ${client.monthly_expenses.toLocaleString("en-IN")}`],
      ["Monthly Savings", `RS. ${client.monthly_savings.toLocaleString("en-IN")}`]
    ]
  });
  currentY = doc.lastAutoTable.finalY + 12;
  /* ================= GOALS ================= */
  // doc.addPage();
  currentY = ensureSpace(doc, currentY, 50);
  doc.setFontSize(13);
  doc.text("Goal Planning (Inflation(6%) Adjusted)", 10, currentY);

  const goals = [
    {
      name: "Short Term Goal",
      description: client.short_term_goal,
      amount: client.short_term_amount,
      years: 3
    },
    {
      name: "Medium Term Goal",
      description: client.medium_term_goal,
      amount: client.medium_term_amount,
      years: 7
    },
    {
      name: "Long Term Goal",
      description: client.long_term_goal,
      amount: client.long_term_amount,
      years: 15
    }
  ];

  const goalRows = goals
    .filter(g => g.amount > 0)
    .map(g => {
      const inflated = inflateAmount(g.amount, inflationRate, g.years);
      return [
        g.name,
        g.description || "-",
        `${g.years} years`,
        `RS. ${g.amount.toLocaleString("en-IN")}`,
        `RS. ${Math.round(inflated).toLocaleString("en-IN")}`
      ];
    });

  doc.autoTable({
    startY: currentY + 5,
    theme: "grid",
    styles: { fontSize: 10 },
    head: [
      ["Goal", "Description", "Time Horizon", "Today's Amount", "Required Amount"]
    ],
    body: goalRows
  });

  // Assumptions
const goalReturn = 12; // 12% p.a.
// const inflationRate = 6;
  
/* ================= Monthly SIP Required to Achieve Goals ================= */

  const sipRows = goals
  .filter(g => g.amount > 0)
  .map(g => {
    const inflatedAmount =
      g.amount * Math.pow(1 + inflationRate / 100, g.years);

    const sip = calculateSipRequired(
      inflatedAmount,
      goalReturn,
      g.years
    );

    return [
      g.name,
      `${g.years} years`,
      formatINR(inflatedAmount),
      formatINR(sip)
    ];
  });

let sipStartY = doc.lastAutoTable.finalY + 12;
  sipStartY = ensureSpace(doc, sipStartY, 50);

doc.setFontSize(12);
doc.text("Monthly SIP Required to Achieve Goals (12% Returns Assumed)", 10, sipStartY);

doc.autoTable({
  startY: sipStartY + 4,
  theme: "grid",
  styles: { fontSize: 10 },
  head: [["Goal", "Horizon", "Target Amount", "Required SIP"]],
  body: sipRows
});

  currentY = doc.lastAutoTable.finalY + 12;

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
        `RS. ${Math.round(
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

const retirementSip = calculateSipRequired(
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
  // doc.addPage();
  let y = currentY + 12;


  doc.setFontSize(14);
  doc.text("Research Insight: Value of Advisor Guidance", 10, y);

  doc.addImage(chartImage, "PNG", 15, 30, 180, 100);

  doc.setFontSize(9);
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
