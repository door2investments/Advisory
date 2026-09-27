/************************************
 * Admin - Client Dashboard – Token Based
 ************************************/

import { generateClientPlanningPDF } from "./finance.js";
import { planGoal, planGoals, formatCurrency as fmt } from "./goal-planner.js";
let clientData =  null;
let goalsData = [];

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
    .eq("id", data.id);

  clientData = data;
  renderClient(data);
  // loadAdvisorObservations(data.mobile_number)
  loadGoals(data.id);
}

/************************************
 * GOAL PLANNING
 ************************************/

// Defaults for a freshly added row. The advisor can edit every
// one of them before saving.
const NEW_GOAL_DEFAULTS = {
  goal_name: "",
  target_amount_today: "",
  years: "",
  assumed_return_pct: 12,
  inflation_pct: 6,
  step_up_pct: 10,
  existing_corpus: 0
};

const goalRowsEl = document.getElementById("goalRows");
const goalEmptyEl = document.getElementById("goalEmpty");
const goalMessageEl = document.getElementById("goalMessage");
const goalTotalsRow = document.getElementById("goalTotalsRow");
const affordabilityEl = document.getElementById("affordability");

function showGoalMessage(text, kind = "info") {
  goalMessageEl.textContent = text;
  goalMessageEl.className = `goal-message ${kind}`;
  if (text) {
    setTimeout(() => {
      if (goalMessageEl.textContent === text) {
        goalMessageEl.textContent = "";
        goalMessageEl.className = "goal-message";
      }
    }, 4000);
  }
}

async function loadGoals(clientId) {
  const { data, error } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    showGoalMessage("Could not load goals: " + error.message, "error");
    return;
  }

  goalsData = data || [];
  goalRowsEl.innerHTML = "";
  goalsData.forEach(addGoalRow);
  refreshGoalView();
}

/** Build one editable row. `goal` may be a saved row or a draft. */
function addGoalRow(goal) {
  const tr = document.createElement("tr");
  tr.className = "goal-row";
  tr.dataset.id = goal.id ?? "";

  const num = (field, step, extra = "") =>
    `<td><input type="number" class="goal-input" data-field="${field}"
        step="${step}" value="${goal[field] ?? ""}" ${extra} /></td>`;

  tr.innerHTML = `
    <td>
      <input type="text" class="goal-input goal-name" data-field="goal_name"
             value="${escapeAttr(goal.goal_name ?? "")}"
             placeholder="e.g. Daughter's education" />
    </td>
    ${num("target_amount_today", "1000", 'min="1"')}
    ${num("years", "1", 'min="1" max="60"')}
    ${num("assumed_return_pct", "0.5", 'min="0" max="50"')}
    ${num("inflation_pct", "0.5", 'min="0" max="30"')}
    ${num("step_up_pct", "1", 'min="0" max="100"')}
    ${num("existing_corpus", "1000", 'min="0"')}
    <td class="calc" data-out="targetAmount">—</td>
    <td class="calc" data-out="shortfall">—</td>
    <td class="calc strong" data-out="monthlySip">—</td>
    <td class="calc" data-out="stepUpSip">—</td>
    <td class="calc" data-out="lumpsumToday">—</td>
    <td class="goal-row-actions">
      <button type="button" class="row-save" title="Save this goal">Save</button>
      <button type="button" class="row-delete" title="Delete this goal">✕</button>
    </td>
  `;

  tr.querySelectorAll(".goal-input").forEach(input => {
    input.addEventListener("input", () => {
      tr.classList.add("dirty");
      refreshGoalView();
    });
  });

  tr.querySelector(".row-save").addEventListener("click", () => saveGoalRow(tr));
  tr.querySelector(".row-delete").addEventListener("click", () => deleteGoalRow(tr));

  goalRowsEl.appendChild(tr);
  return tr;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Read one row's inputs back into a plain object. */
function readGoalRow(tr) {
  const goal = {};
  tr.querySelectorAll(".goal-input").forEach(input => {
    const field = input.dataset.field;
    goal[field] =
      input.type === "number"
        ? (input.value === "" ? null : Number(input.value))
        : input.value.trim();
  });
  return goal;
}

/** Recompute every row and the totals from the current inputs. */
function refreshGoalView() {
  const rows = Array.from(goalRowsEl.querySelectorAll(".goal-row"));

  goalEmptyEl.classList.toggle("hidden", rows.length > 0);
  goalTotalsRow.classList.toggle("hidden", rows.length === 0);

  const planned = rows.map(tr => {
    const plan = planGoal(readGoalRow(tr));

    for (const [key, el] of Object.entries(outputCells(tr))) {
      el.textContent = plan[key] === null ? "—" : fmt(plan[key]);
    }
    tr.classList.toggle("funded", plan.fullyFunded);

    return plan;
  });

  const { totals } = planGoals(
    planned,
    clientData ? clientData.monthly_savings : null
  );

  document.getElementById("totalTarget").textContent = fmt(totals.targetAmount);
  document.getElementById("totalShortfall").textContent = fmt(totals.shortfall);
  document.getElementById("totalSip").textContent = fmt(totals.monthlySip);
  document.getElementById("totalStepUpSip").textContent = fmt(totals.stepUpSip);
  document.getElementById("totalLumpsum").textContent = fmt(totals.lumpsumToday);

  renderAffordability(totals);
}

function outputCells(tr) {
  const cells = {};
  tr.querySelectorAll("[data-out]").forEach(td => {
    cells[td.dataset.out] = td;
  });
  return cells;
}

/**
 * Compare the required SIP with what the client actually saves
 * each month. Only shown when we have both numbers.
 */
function renderAffordability(totals) {
  if (!totals.count || totals.monthlySavings === undefined) {
    affordabilityEl.classList.add("hidden");
    return;
  }

  affordabilityEl.classList.remove("hidden");
  affordabilityEl.classList.toggle("shortfall", !totals.affordable);

  const required = fmt(totals.monthlySip);
  const savings = fmt(totals.monthlySavings);
  const pct = Math.round(totals.savingsUtilisationPct);

  affordabilityEl.innerHTML = totals.affordable
    ? `Required SIP <strong>${required}</strong> uses <strong>${pct}%</strong> of the
       client's ${savings} monthly savings — leaving ${fmt(totals.surplus)} spare.`
    : `Required SIP <strong>${required}</strong> exceeds the client's ${savings}
       monthly savings by <strong>${fmt(Math.abs(totals.surplus))}</strong>
       (${pct}% of savings). Consider a longer horizon, a lower target,
       or the step-up route at ${fmt(totals.stepUpSip)} to start.`;
}

/** Validate a row before it goes to the database. */
function validateGoal(goal) {
  if (!goal.goal_name) return "Goal name is required.";
  if (!(goal.target_amount_today > 0)) return "Amount must be greater than 0.";
  if (!Number.isInteger(goal.years) || goal.years < 1 || goal.years > 60) {
    return "Years must be a whole number between 1 and 60.";
  }
  if (goal.assumed_return_pct === null ||
      goal.assumed_return_pct < 0 || goal.assumed_return_pct > 50) {
    return "Return must be between 0 and 50.";
  }
  if (goal.inflation_pct === null ||
      goal.inflation_pct < 0 || goal.inflation_pct > 30) {
    return "Inflation must be between 0 and 30.";
  }
  if (goal.step_up_pct === null ||
      goal.step_up_pct < 0 || goal.step_up_pct > 100) {
    return "Step-up must be between 0 and 100.";
  }
  if (goal.existing_corpus === null || goal.existing_corpus < 0) {
    return "Already-saved amount cannot be negative.";
  }
  return null;
}

async function saveGoalRow(tr) {
  if (!clientData) {
    showGoalMessage("Client not loaded yet.", "error");
    return;
  }

  const goal = readGoalRow(tr);
  const problem = validateGoal(goal);
  if (problem) {
    showGoalMessage(problem, "error");
    return;
  }

  const saveBtn = tr.querySelector(".row-save");
  saveBtn.disabled = true;
  saveBtn.textContent = "…";

  const payload = { ...goal, client_id: clientData.id };
  const existingId = tr.dataset.id;

  const query = existingId
    ? supabaseClient
        .from("client_goals")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single()
    : supabaseClient
        .from("client_goals")
        .insert({ ...payload, sort_order: goalRowsEl.children.length })
        .select()
        .single();

  const { data, error } = await query;

  saveBtn.disabled = false;
  saveBtn.textContent = "Save";

  if (error) {
    console.error(error);
    showGoalMessage("Save failed: " + error.message, "error");
    return;
  }

  tr.dataset.id = data.id;
  tr.classList.remove("dirty");
  syncGoalsData(data);
  showGoalMessage(`Saved "${data.goal_name}".`, "success");
}

async function deleteGoalRow(tr) {
  const existingId = tr.dataset.id;

  // An unsaved draft just disappears.
  if (!existingId) {
    tr.remove();
    refreshGoalView();
    return;
  }

  const name = tr.querySelector(".goal-name").value || "this goal";
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const { error } = await supabaseClient
    .from("client_goals")
    .delete()
    .eq("id", existingId);

  if (error) {
    console.error(error);
    showGoalMessage("Delete failed: " + error.message, "error");
    return;
  }

  goalsData = goalsData.filter(g => String(g.id) !== String(existingId));
  tr.remove();
  refreshGoalView();
  showGoalMessage(`Deleted "${name}".`, "success");
}

/** Keep the in-memory list (used by the PDF) in step with saves. */
function syncGoalsData(row) {
  const index = goalsData.findIndex(g => String(g.id) === String(row.id));
  if (index === -1) goalsData.push(row);
  else goalsData[index] = row;
}

document.getElementById("addGoalBtn").addEventListener("click", () => {
  const tr = addGoalRow({ ...NEW_GOAL_DEFAULTS });
  refreshGoalView();
  tr.querySelector(".goal-name").focus();
});

function renderClient(data) {
  Object.keys(data).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.innerText =
        data[key] === null || data[key] === ""
          ? "—"
          : Array.isArray(data[key])
            ? data[key].join(", ")
            : data[key];
    }
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

function generateAdvisorImpactChartImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;

  const ctx = canvas.getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Without Advisor", "With Advisor"],
      datasets: [{
        label: "Average Annual Net Return (%)",
        data: [5, 8], // representative research-based values
        backgroundColor: ["#e74c3c", "#2ecc71"]
      }]
    },
    options: {
      responsive: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: {
            callback: v => v + "%"
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Impact of Advisor Guidance on Long-Term Returns"
        }
      }
    }
  });

  // return image data
  return canvas.toDataURL("image/png");
}



// Init
loadClient();

document
  .getElementById("downloadPdfBtn")
  .addEventListener("click", () => {
    if (!clientData) {
      alert("Client data not loaded");
      return;
    }

    // The PDF is built from SAVED goals, so warn rather than
    // silently printing figures that differ from the screen.
    const unsaved = goalRowsEl.querySelectorAll(".goal-row.dirty").length;
    if (unsaved > 0) {
      const proceed = confirm(
        `${unsaved} goal row(s) have unsaved changes and will not appear in the PDF.\n\n` +
        `Click Cancel to go back and Save them, or OK to download anyway.`
      );
      if (!proceed) return;
    }

    const advisorChartImage = generateAdvisorImpactChartImage();

    generateClientPlanningPDF(clientData, advisorChartImage, goalsData);
  });

// document
//   .getElementById("downloadPdfBtnStepup")
//   .addEventListener("click", () => {
//     if (!clientData) {
//       alert("Client data not loaded");
//       return;
//     }

//     const advisorChartImage = generateAdvisorImpactChartImage();

//     generateClientPlanningPDF(clientData, advisorChartImage,true);
//   });

// document.getElementById("downloadPdfBtn").addEventListener("click", () => {
//   generateClientPlanningPDF(clientData); // clientData already fetched
// });

