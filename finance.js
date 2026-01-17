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

export async function generateClientPlanningPDF(client) {
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
  doc.text("Raviteja Soma | 📞 9390250541", 105, 22, { align: "center" });

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
  doc.setFontSize(13);
  doc.text("Goal Planning (Inflation Adjusted)", 10, currentY);

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

let sipStartY = doc.lastAutoTable.finalY + 8;

doc.setFontSize(12);
doc.text("Monthly SIP Required to Achieve Goals", 10, sipStartY);

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
      ["Retirement Age", 60],
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

let retirementSipY = doc.lastAutoTable.finalY + 8;

doc.setFontSize(12);
doc.text("Monthly SIP Required for Retirement", 10, retirementSipY);

doc.autoTable({
  startY: retirementSipY + 4,
  theme: "grid",
  styles: { fontSize: 10 },
  body: [
    ["Target Retirement Corpus", formatINR(retirementCorpus)],
    ["Years to Retirement", `${years} years`],
    ["Assumed Return", "10% p.a."],
    ["Required Monthly SIP", formatINR(retirementSip)]
  ]
});


  
  /* ================= DISCLAIMER ================= */
  doc.setFontSize(9);
  doc.text(
    "Disclaimer: Calculations are illustrative and based on assumed inflation and planning norms. "
    + "Mutual fund investments are subject to market risks. Past performance does not guarantee future returns.",
    10,
    280,
    { maxWidth: 190 }
  );

  doc.save(`${client.full_name}_Financial_Plan.pdf`);
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
    "📞 9390250541  |  WhatsApp Available",
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
