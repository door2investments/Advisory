/************************************
 * Client Dashboard – Token Based
 ************************************/

import { planGoals, formatCurrency as fmtGoal } from "./goal-planner.js";

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
    .from("form_responses")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("mobile_number", data.mobile_number);

  renderClient(data);
  loadAdvisorObservations(data.mobile_number)
  loadGoalPlan(data);
}

/************************************
 * GOAL PLAN (read-only)
 *
 * Goals are created by the advisor in the admin view; the client
 * only ever sees the resulting plan.
 ************************************/
async function loadGoalPlan(client) {
  const card = document.getElementById("goalPlanCard");
  const list = document.getElementById("goalPlanList");
  const totalEl = document.getElementById("goalPlanTotal");

  const { data, error } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("client_mobile_number", client.mobile_number)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  // Nothing planned yet: leave the card hidden rather than
  // showing the client an empty section.
  if (error || !data || data.length === 0) {
    if (error) console.error(error);
    card.hidden = true;
    return;
  }

  const { rows, totals } = planGoals(data, client.monthly_savings);

  card.hidden = false;
  list.innerHTML = rows.map(goalCardHtml).join("");

  totalEl.innerHTML = `
    <div class="goal-plan-total-row">
      <span>Total monthly investment required</span>
      <strong>${fmtGoal(totals.monthlySip)}</strong>
    </div>
    ${totals.stepUpSip > 0 ? `
      <div class="goal-plan-total-row muted">
        <span>Or starting at, with a yearly step-up</span>
        <strong>${fmtGoal(totals.stepUpSip)}</strong>
      </div>` : ""}
  `;
}

function goalCardHtml(row) {
  const horizon = `${row.years} year${row.years === 1 ? "" : "s"}`;

  if (row.fullyFunded) {
    return `
      <div class="goal-plan-item funded">
        <div class="goal-plan-head">
          <h4>${escapeHtml(row.goal_name)}</h4>
          <span class="goal-plan-horizon">${horizon}</span>
        </div>
        <p class="goal-plan-funded-note">
          Already on track — the ${fmtGoal(row.existingCorpus)} set aside for this
          goal is projected to cover the ${fmtGoal(row.targetAmount)} needed.
        </p>
      </div>
    `;
  }

  return `
    <div class="goal-plan-item">
      <div class="goal-plan-head">
        <h4>${escapeHtml(row.goal_name)}</h4>
        <span class="goal-plan-horizon">${horizon}</span>
      </div>

      <div class="goal-plan-figures">
        <div>
          <span>Cost today</span>
          <strong>${fmtGoal(row.amountToday)}</strong>
        </div>
        <div>
          <span>Expected cost in ${horizon}</span>
          <strong>${fmtGoal(row.targetAmount)}</strong>
        </div>
        ${row.existingCorpus > 0 ? `
          <div>
            <span>Already set aside</span>
            <strong>${fmtGoal(row.existingCorpus)}</strong>
          </div>` : ""}
        <div class="highlight">
          <span>Monthly investment needed</span>
          <strong>${fmtGoal(row.monthlySip)}</strong>
        </div>
        ${row.stepUpSip !== null && row.stepUpPct > 0 ? `
          <div>
            <span>Or start at, rising ${row.stepUpPct}% a year</span>
            <strong>${fmtGoal(row.stepUpSip)}</strong>
          </div>` : ""}
        <div>
          <span>Or invest once, today</span>
          <strong>${fmtGoal(row.lumpsumToday)}</strong>
        </div>
      </div>

      <p class="goal-plan-assumptions">
        Assumes ${row.returnPct}% return and ${row.inflationPct}% inflation a year.
      </p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderClient(data) {
  // Basic
  document.getElementById("name").innerText = data.full_name || "Client";
  document.getElementById("basic").innerText =
    `${data.marital_status || "—"} | Dependents: ${data.dependents ?? 0}`;

  // Goals
  document.getElementById("shortGoal").innerText =
    formatCurrency(data.short_term_amount);
  document.getElementById("mediumGoal").innerText =
    formatCurrency(data.medium_term_amount);
  document.getElementById("longGoal").innerText =
    formatCurrency(data.long_term_amount);

  // Insurance
  const healthEl = document.getElementById("health");
  healthEl.innerText = data.health_insurance ? "Yes" : "No";
  healthEl.classList.add(data.health_insurance ? "tag-yes" : "tag-no");

  const termEl = document.getElementById("term");
  termEl.innerText = data.term_insurance == "Yes" ? "Yes" : "No";
  termEl.classList.add(data.term_insurance == "Yes" ? "tag-yes" : "tag-no");

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

  if(data.retirement_planned){
    if (data.retirement_planned.toLowerCase() == "no"){
      document.getElementById("retPlanned").innerText = "Retirement Snapshot - Not Planned"
    }
    else{
      document.getElementById("retPlanned").innerText = "Retirement Snapshot - Planned"
    }
  }
  
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

  // const ul = document.getElementById("advisorNotes");
  // ul.innerHTML = "";
  // notes.forEach(note => {
  //   const li = document.createElement("li");
  //   li.innerText = note;
  //   ul.appendChild(li);
  // });
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
    container.innerHTML = `
      <div class="observation-card open pending">
        <div class="observation-header">
          Advisor Observation Pending
        </div>
        <div class="observation-body">
          Your portfolio details are currently under review.<br/><br/>
          Advisor observations and recommendations will appear here
          after the next review cycle.
        </div>
      </div>
    `;
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
