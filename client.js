/************************************
 * Client Dashboard – Token Based
 ************************************/

// Read token from URL
const params = new URLSearchParams(window.location.search);
const accessToken = params.get("token");

if (!accessToken) {
  alert("Invalid or missing access link.");
  throw new Error("Access token missing");
}

// 2️⃣ Supabase config (PASTE YOUR VALUES)
const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

// Init Supabase client
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Utility
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

// Load client data
async function loadClient() {
  const { data, error } = await supabaseClient
    .from("form_responses")
    .select("*")
    .eq("access_token", accessToken)
    .single();

  if (error || !data) {
    console.error(error);
    alert("Invalid or expired link.");
    return;
  }

  // Update last accessed timestamp (non-blocking)
  supabaseClient
    .from("clients")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id);

  renderClient(data);
  loadAdvisorObservations(data.mobile_number)
}

function renderClient(data) {
  // Basic
  document.getElementById("name").innerText = data.full_name || "Client";
  document.getElementById("basic").innerText =
    `${data.marital_status || "—"} | Dependents: ${data.dependents ?? 0}`;

  // Goals
  document.getElementById("shortGoal").innerText =
    formatCurrency(data.short_term_goal);
  document.getElementById("mediumGoal").innerText =
    formatCurrency(data.medium_term_goal);
  document.getElementById("longGoal").innerText =
    formatCurrency(data.long_term_goal);

  // Insurance
  const healthEl = document.getElementById("health");
  healthEl.innerText = data.health_insurance ? "Yes" : "No";
  healthEl.classList.add(data.health_insurance ? "tag-yes" : "tag-no");

  const termEl = document.getElementById("term");
  termEl.innerText = data.term_insurance ? "Yes" : "No";
  termEl.classList.add(data.term_insurance ? "tag-yes" : "tag-no");

  // Retirement
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

  // Advisor notes
  const notes = [];

  if (!data.health_insurance)
    notes.push("Health insurance coverage needs immediate attention.");

  if (!data.term_insurance)
    notes.push("Adequate term life insurance is recommended.");

  if (yearsToRetirement <= 10)
    notes.push("Retirement horizon is short. Conservative planning advised.");
  else
    notes.push("You have sufficient time to build retirement corpus with discipline.");

  const ul = document.getElementById("advisorNotes");
  ul.innerHTML = "";
  notes.forEach(note => {
    const li = document.createElement("li");
    li.innerText = note;
    ul.appendChild(li);
  });
}
async function loadAdvisorObservations(clientMobile) {
  const container = document.getElementById("observationsContainer");
  container.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("advisor_observations")
    .select("observation_date, observation_text")
    .eq("client_mobile_number", clientMobile)
    .order("observation_date", { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML =
      "<p style='color:#64748b'>No advisor observations available.</p>";
    return;
  }

  data.forEach((obs, index) => {
    const card = document.createElement("div");
    card.className = "observation-card" + (index === 0 ? " open" : "");

    card.innerHTML = `
      <div class="observation-header">
        ${new Date(obs.observation_date).toDateString()}
        <span class="arrow">▼</span>
      </div>
      <div class="observation-body">
        ${obs.observation_text.replace(/\n/g, "<br/>")}
      </div>
    `;

    card
      .querySelector(".observation-header")
      .addEventListener("click", () => {
        card.classList.toggle("open");
      });

    container.appendChild(card);
  });
}


// Init
loadClient();
