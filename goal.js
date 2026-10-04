/************************************************************
 * Goal Planner – Admin
 *
 * Builds one goal in full detail for either an onboarded client
 * or a prospect who has not filled the form, and produces a
 * share link plus a month-by-month CSV.
 *
 * Saved goals land in the same client_goals table the inline
 * panel on admin-client.html uses, so the two stay consistent.
 *
 * URL parameters:
 *   ?token=<access_token>  pre-select that client
 *   ?goal=<id>             load an existing goal for editing
 ************************************************************/

import {
  planGoal,
  splitPlans,
  buildGoalCsv,
  downloadCsv,
  formatCurrency as fmt,
  SPLIT_PERCENTAGES
} from "./goal-planner.js";

const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/** Columns shown in the Client Information card. */
const CLIENT_INFO_FIELDS = [
  "full_name", "mobile_number", "email", "date_of_birth",
  "marital_status", "dependents", "monthly_expenses", "monthly_savings",
  "investment_objective", "investment_horizon"
];

const MONEY_FIELDS = new Set(["monthly_expenses", "monthly_savings"]);

/* ---------------- state ---------------- */

let ownerMode = "client";       // "client" | "prospect"
let selectedClient = null;      // a form_responses row
let editingGoalId = null;       // set when editing an existing goal
let currentPlan = null;         // last computed plan

/* ---------------- elements ---------------- */

const el = id => document.getElementById(id);

const tabClient = el("tabClient");
const tabProspect = el("tabProspect");
const clientPane = el("clientPane");
const prospectPane = el("prospectPane");
const clientSearch = el("clientSearch");
const clientResults = el("clientResults");
const clientSearchHint = el("clientSearchHint");
const selectedOwner = el("selectedOwner");
const clientInfoCard = el("clientInfoCard");
const existingGoalsHint = el("existingGoalsHint");
const saveMessage = el("saveMessage");
const shareBox = el("shareBox");

const GOAL_INPUTS = [
  "goalName", "goalDescription", "amountToday", "years",
  "inflationPct", "returnPct", "stepUpPct", "existingCorpus"
];

/* ---------------- owner selection ---------------- */

function setOwnerMode(mode) {
  ownerMode = mode;
  const isClient = mode === "client";

  tabClient.classList.toggle("active", isClient);
  tabProspect.classList.toggle("active", !isClient);
  clientPane.hidden = !isClient;
  prospectPane.hidden = isClient;

  if (!isClient) {
    selectedClient = null;
    clientInfoCard.hidden = true;
  }
  renderSelectedOwner();
}

tabClient.addEventListener("click", () => setOwnerMode("client"));
tabProspect.addEventListener("click", () => setOwnerMode("prospect"));

function renderSelectedOwner() {
  if (ownerMode === "client" && selectedClient) {
    selectedOwner.hidden = false;
    selectedOwner.innerHTML =
      `Planning for <strong>${escapeHtml(selectedClient.full_name || "this client")}</strong>
       · ${escapeHtml(String(selectedClient.mobile_number))}`;
  } else {
    selectedOwner.hidden = true;
  }
}

/* ---------------- client search ---------------- */

let searchTimer = null;

clientSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runClientSearch, 250);
});

async function runClientSearch() {
  const term = clientSearch.value.trim();

  if (term.length < 2) {
    clientResults.innerHTML = "";
    clientSearchHint.hidden = false;
    return;
  }
  clientSearchHint.hidden = true;

  // mobile_number is a bigint, so it cannot take ilike. Match the
  // name textually and the mobile numerically, then merge.
  const escaped = term.replace(/[%,]/g, "");
  const digits = term.replace(/\D/g, "");

  const queries = [
    supabaseClient
      .from("form_responses")
      .select("mobile_number, full_name, email, access_token")
      .ilike("full_name", `%${escaped}%`)
      .limit(10)
  ];

  if (digits.length >= 2) {
    queries.push(
      supabaseClient
        .from("form_responses")
        .select("mobile_number, full_name, email, access_token")
        .gte("mobile_number", Number(digits.padEnd(10, "0")))
        .lte("mobile_number", Number(digits.padEnd(10, "9")))
        .limit(10)
    );
  }

  const results = await Promise.all(queries);
  const failed = results.find(r => r.error);
  if (failed) {
    console.error(failed.error);
    clientResults.innerHTML =
      `<p class="goal-message error">Search failed: ${escapeHtml(failed.error.message)}</p>`;
    return;
  }

  const byMobile = new Map();
  for (const { data } of results) {
    for (const row of data || []) byMobile.set(String(row.mobile_number), row);
  }
  renderClientResults([...byMobile.values()]);
}

function renderClientResults(rows) {
  if (rows.length === 0) {
    clientResults.innerHTML =
      `<p class="field-hint">No client matched. Use <strong>New prospect</strong>
       if they have not filled the form yet.</p>`;
    return;
  }

  clientResults.innerHTML = "";
  for (const row of rows) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "client-result";
    item.innerHTML =
      `<span class="cr-name">${escapeHtml(row.full_name || "(no name)")}</span>
       <span class="cr-meta">${escapeHtml(String(row.mobile_number))}${
         row.email ? " · " + escapeHtml(row.email) : ""
       }</span>`;
    item.addEventListener("click", () => selectClient(row.mobile_number));
    clientResults.appendChild(item);
  }
}

/** Load the full client row and show it. */
async function selectClient(mobileNumber) {
  const { data, error } = await supabaseClient
    .from("form_responses")
    .select("*")
    .eq("mobile_number", mobileNumber)
    .single();

  if (error || !data) {
    console.error(error);
    showSaveMessage("Could not load that client.", "error");
    return;
  }

  selectedClient = data;
  clientResults.innerHTML = "";
  clientSearch.value = "";
  clientSearchHint.hidden = false;

  renderClientInfo(data);
  renderSelectedOwner();
  loadExistingGoalCount(data.mobile_number);
  refreshPlan();
}

function renderClientInfo(client) {
  clientInfoCard.hidden = false;

  for (const field of CLIENT_INFO_FIELDS) {
    const target = el("ci_" + field);
    if (!target) continue;

    const raw = client[field];
    if (raw === null || raw === undefined || raw === "") {
      target.textContent = "—";
    } else if (MONEY_FIELDS.has(field)) {
      target.textContent = fmt(raw);
    } else {
      target.textContent = String(raw);
    }
  }
}

/** Tell the advisor this client already has goals recorded. */
async function loadExistingGoalCount(mobileNumber) {
  const { data, error } = await supabaseClient
    .from("client_goals")
    .select("id, goal_name")
    .eq("client_mobile_number", mobileNumber);

  if (error || !data || data.length === 0) {
    existingGoalsHint.hidden = true;
    return;
  }

  existingGoalsHint.hidden = false;
  existingGoalsHint.innerHTML =
    `This client already has ${data.length} goal(s) recorded: ` +
    data.map(g => `<strong>${escapeHtml(g.goal_name)}</strong>`).join(", ") +
    `. Saving here adds another.`;
}

/* ---------------- the plan ---------------- */

GOAL_INPUTS.forEach(id => {
  el(id).addEventListener("input", refreshPlan);
});

/** Read the goal form into a client_goals-shaped object. */
function readGoalForm() {
  const num = id => (el(id).value === "" ? null : Number(el(id).value));

  return {
    goal_name: el("goalName").value.trim(),
    goal_description: el("goalDescription").value.trim(),
    target_amount_today: num("amountToday"),
    years: num("years"),
    inflation_pct: num("inflationPct"),
    assumed_return_pct: num("returnPct"),
    step_up_pct: num("stepUpPct"),
    existing_corpus: num("existingCorpus") ?? 0
  };
}

function refreshPlan() {
  const goal = readGoalForm();
  const usable = goal.target_amount_today > 0 && goal.years > 0;

  el("planEmpty").hidden = usable;
  el("planBody").hidden = !usable;

  if (!usable) {
    currentPlan = null;
    return;
  }

  const plan = planGoal(goal);
  currentPlan = plan;

  const yearsLabel = `${plan.years} year${plan.years === 1 ? "" : "s"}`;
  el("outYearsLabel").textContent = yearsLabel;
  el("outAmountToday").textContent = fmt(plan.amountToday);
  el("outTargetAmount").textContent = fmt(plan.targetAmount);

  const hasCorpus = plan.existingCorpus > 0;
  el("tileCorpus").hidden = !hasCorpus;
  el("tileShortfall").hidden = !hasCorpus;
  if (hasCorpus) {
    el("outCorpusAtGoalDate").textContent = fmt(plan.corpusAtGoalDate);
    el("outShortfall").textContent = fmt(plan.shortfall);
  }

  const fundedNote = el("fundedNote");
  fundedNote.hidden = !plan.fullyFunded;
  if (plan.fullyFunded) {
    fundedNote.textContent =
      `Already on track — the ${fmt(plan.existingCorpus)} set aside is projected to ` +
      `cover the ${fmt(plan.targetAmount)} needed, so no further investment is required.`;
  }

  el("outMonthlySip").textContent = fmt(plan.monthlySip);
  el("outLumpsum").textContent = fmt(plan.lumpsumToday);
  el("outStepUpSip").textContent = fmt(plan.stepUpSip);
  el("outStepUpLabel").textContent = `${plan.stepUpPct}% a year`;

  renderSplits(plan);
}

function renderSplits(plan) {
  const body = el("splitRows");
  body.innerHTML = "";

  const splits = splitPlans(plan, SPLIT_PERCENTAGES);

  if (splits.length === 0 || plan.fullyFunded) {
    body.innerHTML =
      `<tr><td colspan="5" class="field-hint">Not applicable for this goal.</td></tr>`;
    return;
  }

  for (const split of splits) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${split.upfrontPct}%</strong></td>
      <td class="calc">${fmt(split.lumpsumNow)}</td>
      <td class="calc strong">${fmt(split.monthlySip)}</td>
      <td class="calc">${fmt(split.targetFromUpfront)}</td>
      <td class="calc">${fmt(split.targetFromSip)}</td>
    `;
    body.appendChild(tr);
  }
}

/* ---------------- CSV ---------------- */

el("downloadCsvBtn").addEventListener("click", () => {
  if (!currentPlan) {
    showSaveMessage("Enter an amount and a number of years first.", "error");
    return;
  }

  const who =
    ownerMode === "client" && selectedClient
      ? selectedClient.full_name
      : el("prospectName").value.trim();

  const name = [who, currentPlan.goal_name || "goal", "investment-schedule"]
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-");

  downloadCsv(`${name}.csv`, buildGoalCsv(currentPlan, SPLIT_PERCENTAGES));
});

/* ---------------- save & share ---------------- */

function showSaveMessage(text, kind = "info") {
  saveMessage.textContent = text;
  saveMessage.className = `goal-message ${kind}`;
}

/** Validate before writing. Mirrors the client_goals constraints. */
function validate(goal) {
  if (ownerMode === "client" && !selectedClient) {
    return "Pick a client, or switch to New prospect.";
  }
  if (ownerMode === "prospect" && !el("prospectName").value.trim()) {
    return "Prospect name is required.";
  }
  if (!goal.goal_name) return "Goal name is required.";
  if (!(goal.target_amount_today > 0)) return "Amount must be greater than 0.";
  if (!Number.isInteger(goal.years) || goal.years < 1 || goal.years > 60) {
    return "Number of years must be a whole number between 1 and 60.";
  }
  if (goal.inflation_pct === null || goal.inflation_pct < 0 || goal.inflation_pct > 30) {
    return "Inflation must be between 0 and 30.";
  }
  if (goal.assumed_return_pct === null ||
      goal.assumed_return_pct < 0 || goal.assumed_return_pct > 50) {
    return "Return must be between 0 and 50.";
  }
  if (goal.step_up_pct === null || goal.step_up_pct < 0 || goal.step_up_pct > 100) {
    return "Step-up must be between 0 and 100.";
  }
  if (goal.existing_corpus < 0) return "Already-saved amount cannot be negative.";
  return null;
}

el("saveGoalBtn").addEventListener("click", saveGoal);

async function saveGoal() {
  const goal = readGoalForm();
  const problem = validate(goal);
  if (problem) {
    showSaveMessage(problem, "error");
    return;
  }

  const button = el("saveGoalBtn");
  button.disabled = true;
  button.textContent = "Saving…";

  const payload = { ...goal };
  if (ownerMode === "client") {
    payload.client_mobile_number = selectedClient.mobile_number;
    payload.prospect_name = null;
    payload.prospect_mobile = null;
  } else {
    payload.client_mobile_number = null;
    payload.prospect_name = el("prospectName").value.trim();
    payload.prospect_mobile = el("prospectMobile").value.trim() || null;
  }

  const { data, error } = editingGoalId
    ? await supabaseClient
        .from("client_goals")
        .update(payload)
        .eq("id", editingGoalId)
        .select()
        .single()
    : await supabaseClient
        .from("client_goals")
        .insert(payload)
        .select()
        .single();

  button.disabled = false;
  button.textContent = "Save goal";

  if (error) {
    console.error(error);
    showSaveMessage("Save failed: " + error.message, "error");
    return;
  }

  editingGoalId = data.id;
  showSaveMessage(
    `Saved "${data.goal_name}".`,
    "success"
  );
  renderShare(data);
}

function renderShare(goal) {
  const base = location.href.replace(/[^/]*$/, "");
  const shareUrl = `${base}goal-share.html?share=${encodeURIComponent(goal.share_token)}`;

  shareBox.hidden = false;
  el("shareLink").value = shareUrl;
  el("openShareBtn").href = shareUrl;

  const note = el("clientPageNote");
  if (goal.client_mobile_number && selectedClient && selectedClient.access_token) {
    note.hidden = false;
    note.innerHTML =
      `This goal now also appears on the client's own summary page: ` +
      `<a href="client.html?token=${encodeURIComponent(selectedClient.access_token)}"
          target="_blank" rel="noopener">open client summary</a>.`;
  } else {
    note.hidden = false;
    note.textContent =
      "This is a prospect goal, so it appears on the share link only. " +
      "Once they complete onboarding you can re-save it against their client record.";
  }
}

el("copyShareBtn").addEventListener("click", async () => {
  const link = el("shareLink").value;
  try {
    await navigator.clipboard.writeText(link);
    showSaveMessage("Share link copied.", "success");
  } catch {
    el("shareLink").select();
    showSaveMessage("Press Ctrl+C to copy the selected link.", "info");
  }
});

el("newGoalBtn").addEventListener("click", () => {
  editingGoalId = null;
  el("goalName").value = "";
  el("goalDescription").value = "";
  el("amountToday").value = "";
  el("years").value = "";
  el("inflationPct").value = "6";
  el("returnPct").value = "12";
  el("stepUpPct").value = "10";
  el("existingCorpus").value = "0";
  shareBox.hidden = true;
  showSaveMessage("", "info");
  refreshPlan();
  el("goalName").focus();
});

/* ---------------- deep links ---------------- */

/** Load an existing goal for editing. */
async function loadGoal(goalId) {
  const { data, error } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("id", goalId)
    .single();

  if (error || !data) {
    console.error(error);
    showSaveMessage("Could not load that goal.", "error");
    return;
  }

  editingGoalId = data.id;

  el("goalName").value = data.goal_name ?? "";
  el("goalDescription").value = data.goal_description ?? "";
  el("amountToday").value = data.target_amount_today ?? "";
  el("years").value = data.years ?? "";
  el("inflationPct").value = data.inflation_pct ?? 6;
  el("returnPct").value = data.assumed_return_pct ?? 12;
  el("stepUpPct").value = data.step_up_pct ?? 10;
  el("existingCorpus").value = data.existing_corpus ?? 0;

  if (data.client_mobile_number) {
    setOwnerMode("client");
    await selectClient(data.client_mobile_number);
  } else {
    setOwnerMode("prospect");
    el("prospectName").value = data.prospect_name ?? "";
    el("prospectMobile").value = data.prospect_mobile ?? "";
  }

  refreshPlan();
  renderShare(data);
}

/** Pre-select a client from ?token=. */
async function selectClientByToken(token) {
  const { data, error } = await supabaseClient
    .from("form_responses")
    .select("*")
    .eq("access_token", token)
    .single();

  if (error || !data) {
    console.error(error);
    showSaveMessage("That client link is not valid.", "error");
    return;
  }

  selectedClient = data;
  setOwnerMode("client");
  renderClientInfo(data);
  renderSelectedOwner();
  loadExistingGoalCount(data.mobile_number);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------- init ---------------- */

(async function init() {
  const params = new URLSearchParams(location.search);
  const goalId = params.get("goal");
  const token = params.get("token");

  if (goalId) await loadGoal(goalId);
  else if (token) await selectClientByToken(token);

  refreshPlan();
})();
