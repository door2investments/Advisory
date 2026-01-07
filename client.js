/************************************
 * Client Dashboard - Supabase
 * Wealth & Investment Advisory
 ************************************/

// 1️⃣ Read client ID from URL
const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

if (!clientId) {
  alert("Invalid client link");
  throw new Error("Client ID missing");
}

// 2️⃣ Supabase config (PASTE YOUR VALUES)
const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

// 3️⃣ Init Supabase

const supabase = supabaseJs.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 4️⃣ Utility
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

// 5️⃣ Fetch client data
async function loadClient() {
  const { data, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("mobile_number", clientId)
    .single();

  if (error || !data) {
    console.error(error);
    alert("Client data not found.");
    return;
  }

  renderClient(data);
}

// 6️⃣ Render client dashboard
function renderClient(data) {
  /******** BASIC DETAILS ********/
  document.getElementById("name").innerText =
    data.full_name || "Client";

  document.getElementById("basic").innerText =
    `${data.marital_status || "—"} | Dependents: ${
      data.dependents ?? 0
    }`;

  /******** GOALS ********/
  document.getElementById("shortGoal").innerText =
    formatCurrency(data.short_term_goal);

  document.getElementById("mediumGoal").innerText =
    formatCurrency(data.medium_term_goal);

  document.getElementById("longGoal").innerText =
    formatCurrency(data.long_term_goal);

  /******** INSURANCE ********/
  document.getElementById("health").innerText =
    data.health_insurance ? "Yes" : "No";

  document.getElementById("term").innerText =
    data.term_insurance ? "Yes" : "No";

  /******** RETIREMENT ********/
  const inflation = 0.06;
  const retirementAge = 60;

  let age = 0;
  if (data.date_of_birth) {
    const dob = new Date(data.date_of_birth);
    age = new Date().getFullYear() - dob.getFullYear();
  }

  const yearsToRetirement = Math.max(retirementAge - age, 0);

  const currentExpense = Number(data.monthly_expenses || 0);

  const futureMonthlyExpense =
    currentExpense * Math.pow(1 + inflation, yearsToRetirement);

  const retirementCorpus = futureMonthlyExpense * 12 * 25;

  document.getElementById("currExpense").innerText =
    formatCurrency(currentExpense);

  document.getElementById("retExpense").innerText =
    formatCurrency(futureMonthlyExpense);

  document.getElementById("retCorpus").innerText =
    formatCurrency(retirementCorpus);

  /******** ADVISOR OBSERVATIONS ********/
  const notes = [];

  if (!data.health_insurance) {
    notes.push(
      "Health insurance coverage needs immediate attention to avoid unexpected medical expenses."
    );
  }

  if (!data.term_insurance) {
    notes.push(
      "Adequate term life insurance is important to secure your family’s financial future."
    );
  }

  if (yearsToRetirement <= 10) {
    notes.push(
      "Retirement is approaching. A conservative and disciplined investment approach is recommended."
    );
  } else {
    notes.push(
      "You have sufficient time to build a strong retirement corpus with disciplined investing."
    );
  }

  if (currentExpense === 0) {
    notes.push(
      "Monthly expense details are missing, which may affect retirement planning accuracy."
    );
  }

  const ul = document.getElementById("advisorNotes");
  ul.innerHTML = "";
  notes.forEach((note) => {
    const li = document.createElement("li");
    li.innerText = note;
    ul.appendChild(li);
  });
}

// 7️⃣ Load on page open
loadClient();
