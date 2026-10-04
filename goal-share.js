/************************************************************
 * Goal share page – read-only
 *
 * Renders a single goal by its share_token so it can be sent to
 * a prospect who has not onboarded, or to a client alongside
 * their full summary. Nothing here writes to the database.
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

const el = id => document.getElementById(id);

let currentPlan = null;
let ownerName = "";

function showError(message) {
  el("loadingNote").hidden = true;
  el("shareBody").hidden = true;
  el("errorNote").hidden = false;
  el("errorText").textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function load() {
  const token = new URLSearchParams(location.search).get("share");

  if (!token) {
    showError("This link is missing its goal reference. Please ask your advisor to resend it.");
    return;
  }

  const { data: goal, error } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !goal) {
    console.error(error);
    showError("This goal link is not valid or has been removed. Please ask your advisor to resend it.");
    return;
  }

  // Name the goal's owner. A client's name lives on
  // form_responses; a prospect's is held on the goal itself.
  if (goal.client_mobile_number) {
    const { data: client } = await supabaseClient
      .from("form_responses")
      .select("full_name")
      .eq("mobile_number", goal.client_mobile_number)
      .single();
    ownerName = (client && client.full_name) || "";
  } else {
    ownerName = goal.prospect_name || "";
  }

  render(goal);
}

function render(goal) {
  const plan = planGoal(goal);
  currentPlan = plan;

  el("loadingNote").hidden = true;
  el("errorNote").hidden = true;
  el("shareBody").hidden = false;

  document.title = `${goal.goal_name || "Goal Plan"} | Wealth & Investment Advisory`;

  el("shareGoalName").textContent = goal.goal_name || "Your goal";
  el("shareFor").textContent = ownerName
    ? `Prepared for ${ownerName}`
    : "Prepared by your advisor";

  if (goal.goal_description) {
    el("shareDescription").hidden = false;
    el("shareDescription").textContent = goal.goal_description;
  }

  const yearsLabel = `${plan.years} year${plan.years === 1 ? "" : "s"}`;
  el("shareYearsLabel").textContent = yearsLabel;
  el("shareAmountToday").textContent = fmt(plan.amountToday);
  el("shareTargetAmount").textContent = fmt(plan.targetAmount);

  if (plan.existingCorpus > 0) {
    el("shareTileCorpus").hidden = false;
    el("shareTileShortfall").hidden = false;
    el("shareCorpus").textContent = fmt(plan.corpusAtGoalDate);
    el("shareShortfall").textContent = fmt(plan.shortfall);
  }

  el("shareAssumptions").textContent =
    `Assumes ${plan.inflationPct}% inflation a year on the cost of the goal, ` +
    `and ${plan.returnPct}% a year on the amount invested.`;

  if (plan.fullyFunded) {
    el("shareFundedNote").hidden = false;
    el("shareFundedNote").textContent =
      `Already on track — the ${fmt(plan.existingCorpus)} set aside is projected ` +
      `to cover the ${fmt(plan.targetAmount)} needed.`;
    el("shareRoutesCard").hidden = true;
    return;
  }

  el("shareSip").textContent = fmt(plan.monthlySip);
  el("shareLumpsum").textContent = fmt(plan.lumpsumToday);
  el("shareStepUp").textContent = fmt(plan.stepUpSip);
  el("shareStepUpLabel").textContent = `rising ${plan.stepUpPct}% a year`;

  const body = el("shareSplitRows");
  body.innerHTML = "";
  for (const split of splitPlans(plan, SPLIT_PERCENTAGES)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${split.upfrontPct}%</strong></td>
      <td class="calc">${fmt(split.lumpsumNow)}</td>
      <td class="calc strong">${fmt(split.monthlySip)}</td>
    `;
    body.appendChild(tr);
  }
}

el("shareCsvBtn").addEventListener("click", () => {
  if (!currentPlan) return;

  const name = [ownerName, currentPlan.goal_name || "goal", "investment-schedule"]
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-");

  downloadCsv(`${name}.csv`, buildGoalCsv(currentPlan, SPLIT_PERCENTAGES));
});

load();
