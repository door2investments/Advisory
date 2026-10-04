/************************************************************
 * Goal Plan Summary — one page, all goals, read-only
 *
 * Serves both audiences from one page:
 *   ?token=<form_responses.access_token>   an onboarded client
 *   ?prospect=<prospects.share_token>      a prospect
 *
 * Nothing here writes to the database.
 ************************************************************/

import {
  planPortfolio,
  splitPlans,
  buildGoalCsv,
  buildPortfolioCsv,
  timelineGeometry,
  compactINR,
  downloadCsv,
  formatCurrency as fmt,
  SPLIT_PERCENTAGES
} from "./goal-planner.js";

/* ============================================================
 * SECTION SWITCHES — plug and play
 *
 * Turn any part of the page off by flipping it to false. The
 * section is then never rendered and its markup is removed, so
 * nothing is left behind: no empty card, no dead button.
 *
 * Nothing else needs editing to drop a section.
 * ========================================================== */
export const SECTIONS = {
  header:        true,   // who the plan is for
  headline:      true,   // the KPI row of combined figures
  affordability: true,   // required SIP vs the client's monthly savings
  timeline:      true,   // the bar chart of goals by cost and year
  goals:         true,   // per-goal detail cards
  splits:        true,   // the upfront + SIP ladder inside each goal
  schedule:      true,   // the CSV download button
  print:         true,   // the print / save-as-PDF button
  disclosures:   true    // risk and ARN disclosures
};

/**
 * How many goal cards start expanded. 1 keeps the page short
 * while still showing the reader what a card contains; set to
 * Infinity to open everything (useful before printing).
 */
const OPEN_GOAL_CARDS = 1;

const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

let supabaseClient = null;
try {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("library did not load");
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error("Supabase unavailable:", err);
}

const el = id => document.getElementById(id);

let portfolio = null;
let personName = "";

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showError(message) {
  el("loadingNote").hidden = true;
  el("summaryBody").hidden = true;
  el("errorNote").hidden = false;
  el("errorText").textContent = message;
}

/** Remove every section and part switched off in SECTIONS. */
function applySectionSwitches() {
  document.querySelectorAll("[data-section]").forEach(node => {
    if (SECTIONS[node.dataset.section] === false) node.remove();
  });
  document.querySelectorAll("[data-part]").forEach(node => {
    if (SECTIONS[node.dataset.part] === false) node.remove();
  });
  // An actions card whose buttons were all switched off is just
  // an empty box.
  const actions = document.querySelector('[data-section="actions"]');
  if (actions && actions.querySelectorAll("button").length === 0) actions.remove();
}

/* ---------------- loading ---------------- */

async function load() {
  if (!supabaseClient) {
    showError(
      "This page could not reach the plan service. Check your connection or " +
      "any content blocker, then reload."
    );
    return;
  }

  const params = new URLSearchParams(location.search);
  const clientToken = params.get("token");
  const prospectToken = params.get("prospect");

  if (clientToken) return loadForClient(clientToken);
  if (prospectToken) return loadForProspect(prospectToken);

  showError(
    "This link is missing its reference. Please ask your advisor to resend it."
  );
}

async function loadForClient(token) {
  const { data: client, error } = await supabaseClient
    .from("form_responses")
    .select("*")
    .eq("access_token", token)
    .single();

  if (error || !client) {
    console.error(error);
    showError("This link is not valid or has been removed. Please ask your advisor to resend it.");
    return;
  }

  const { data: goals } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("client_mobile_number", client.mobile_number)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  personName = client.full_name || "";
  render({
    name: personName,
    meta: [client.mobile_number, client.email].filter(Boolean).join(" · "),
    goals: goals || [],
    monthlySavings: client.monthly_savings
  });
}

async function loadForProspect(token) {
  const { data: prospect, error } = await supabaseClient
    .from("prospects")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !prospect) {
    console.error(error);
    showError("This link is not valid or has been removed. Please ask your advisor to resend it.");
    return;
  }

  const { data: goals } = await supabaseClient
    .from("client_goals")
    .select("*")
    .eq("prospect_id", prospect.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  personName = prospect.full_name || "";
  render({
    name: personName,
    meta: prospect.mobile || "",
    goals: goals || [],
    monthlySavings: null
  });
}

/* ---------------- rendering ---------------- */

function render({ name, meta, goals, monthlySavings }) {
  el("loadingNote").hidden = true;
  el("errorNote").hidden = true;
  el("summaryBody").hidden = false;

  applySectionSwitches();

  if (goals.length === 0) {
    showError(
      "There are no goals recorded on this plan yet. Your advisor will add them shortly."
    );
    return;
  }

  portfolio = planPortfolio(goals, monthlySavings);

  document.title = name
    ? `${name} — Goal Plan | Wealth & Investment Advisory`
    : "Goal Plan | Wealth & Investment Advisory";

  if (SECTIONS.header) renderHeader(name, meta, portfolio);
  if (SECTIONS.headline) renderHeadline(portfolio);
  if (SECTIONS.timeline) renderTimeline(portfolio);
  if (SECTIONS.goals) renderGoals(portfolio);
}

function renderHeader(name, meta, { totals }) {
  el("personName").textContent = name ? `${name} — Goal Plan` : "Goal Plan";

  const horizon = totals.nearestYears === totals.furthestYears
    ? `${totals.furthestYears} years`
    : `${totals.nearestYears}–${totals.furthestYears} years`;

  el("personMeta").textContent =
    [meta, `${totals.count} goal${totals.count === 1 ? "" : "s"}`, `over ${horizon}`]
      .filter(Boolean)
      .join(" · ");

  el("planDate").textContent = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric"
  });
}

/**
 * The combined figures. These are stat tiles rather than a chart
 * on purpose: a handful of headline numbers is a KPI row, not a
 * bar chart.
 */
function renderHeadline({ totals }) {
  const tiles = [
    { label: "Combined target", value: fmt(totals.targetAmount),
      note: "what all goals cost by their dates" },
    { label: "Monthly SIP needed", value: fmt(totals.monthlySip),
      note: "across every goal", accent: true },
    { label: "Or step-up SIP from", value: fmt(totals.stepUpSip),
      note: "rising each year" },
    { label: "Or one-time today", value: fmt(totals.lumpsumToday),
      note: "instead of investing monthly" }
  ];

  if (totals.existingCorpus > 0) {
    tiles.splice(1, 0, {
      label: "Already set aside", value: fmt(totals.existingCorpus),
      note: `projected to ${fmt(totals.corpusAtGoalDate)}`
    });
  }

  el("kpiRow").innerHTML = tiles.map(t => `
    <div class="kpi${t.accent ? " accent" : ""}">
      <span class="kpi-label">${t.label}</span>
      <strong class="kpi-value">${t.value}</strong>
      <span class="kpi-note">${t.note}</span>
    </div>
  `).join("");

  const note = el("affordabilityNote");
  if (!SECTIONS.affordability || !note || totals.monthlySavings === undefined) {
    if (note) note.remove();
    return;
  }

  note.hidden = false;
  note.classList.toggle("shortfall", !totals.affordable);
  note.innerHTML = totals.affordable
    ? `The combined SIP of <strong>${fmt(totals.monthlySip)}</strong> uses about
       <strong>${Math.round(totals.savingsUtilisationPct)}%</strong> of current monthly
       savings of ${fmt(totals.monthlySavings)}, leaving ${fmt(totals.surplus)} spare.`
    : `The combined SIP of <strong>${fmt(totals.monthlySip)}</strong> is
       <strong>${fmt(Math.abs(totals.surplus))}</strong> more than current monthly savings
       of ${fmt(totals.monthlySavings)}. Starting with the step-up route at
       ${fmt(totals.stepUpSip)}, extending a horizon, or revising an amount would bring
       the plan within reach.`;
}

/**
 * Horizontal bars, one per goal, soonest first. Built from divs
 * rather than SVG so the text never rescales with the viewport
 * and the chart prints at full fidelity.
 *
 * A single goal is not a chart — one bar carries no comparison,
 * so the section is dropped and the KPI row above says it all.
 */
function renderTimeline({ rows }) {
  const section = el("timelineSection");

  if (rows.length < 2) {
    section.remove();
    return;
  }

  const geo = timelineGeometry(rows, { plotLeft: 0, plotWidth: 100 });

  const gridlines = geo.ticks
    .map(t => `<div class="chart-gridline" style="left:${t.x}%"></div>`)
    .join("");

  const axis = geo.ticks
    .map(t => `<span class="chart-tick" style="left:${t.x}%">${t.label}</span>`)
    .join("");

  const bars = geo.bars.map(bar => {
    const funded = bar.goal.fullyFunded;
    return `
      <div class="chart-row">
        <div class="chart-row-head">
          <span class="chart-row-name">${escapeHtml(bar.label)}</span>
          <span class="chart-row-year">${bar.year}</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar${funded ? " funded" : ""}"
               style="width:${(bar.value / geo.max) * 100}%"
               tabindex="0"
               title="${escapeHtml(bar.label)} — ${fmt(bar.value)} needed by ${bar.year}${
                 funded ? " (already funded)" : ""}"></div>
          <span class="chart-bar-value">${fmt(bar.value)}</span>
        </div>
      </div>
    `;
  }).join("");

  el("timelineChart").innerHTML = `
    <div class="chart-plot">
      ${gridlines}
      ${bars}
    </div>
    <div class="chart-axis">${axis}</div>
  `;
}

/** Per-goal cards, collapsed by default to keep the page short. */
function renderGoals({ rows }) {
  el("goalList").innerHTML = rows.map((row, index) => {
    const horizon = `${row.years} year${row.years === 1 ? "" : "s"}`;
    const year = new Date().getFullYear() + row.years;

    if (row.fullyFunded) {
      return `
        <details class="goal-detail funded"${index < OPEN_GOAL_CARDS ? " open" : ""}>
          <summary>
            <span class="gd-name">${escapeHtml(row.goal_name || "Goal")}</span>
            <span class="gd-head-figures">
              <span class="gd-when">${year}</span>
              <span class="gd-sip funded-tag">On track</span>
            </span>
          </summary>
          <div class="goal-detail-body">
            ${row.goal_description ? `<p class="goal-plan-description">${escapeHtml(row.goal_description)}</p>` : ""}
            <p class="funded-note">
              The ${fmt(row.existingCorpus)} already set aside is projected to reach
              ${fmt(row.corpusAtGoalDate)} by ${year}, covering the
              ${fmt(row.targetAmount)} needed. No further investment is required.
            </p>
          </div>
        </details>
      `;
    }

    return `
      <details class="goal-detail"${index < OPEN_GOAL_CARDS ? " open" : ""}>
        <summary>
          <span class="gd-name">${escapeHtml(row.goal_name || "Goal")}</span>
          <span class="gd-head-figures">
            <span class="gd-when">${year}</span>
            <span class="gd-sip">${fmt(row.monthlySip)}<small>/mo</small></span>
          </span>
        </summary>

        <div class="goal-detail-body">
          ${row.goal_description ? `<p class="goal-plan-description">${escapeHtml(row.goal_description)}</p>` : ""}

          <div class="gd-figures">
            <div><span>Cost today</span><strong>${fmt(row.amountToday)}</strong></div>
            <div><span>Cost in ${horizon}</span><strong>${fmt(row.targetAmount)}</strong></div>
            ${row.existingCorpus > 0 ? `
              <div><span>Already set aside</span><strong>${fmt(row.existingCorpus)}</strong></div>
              <div><span>Still to fund</span><strong>${fmt(row.shortfall)}</strong></div>` : ""}
          </div>

          <div class="gd-routes">
            <div class="gd-route accent">
              <span>Monthly SIP</span><strong>${fmt(row.monthlySip)}</strong>
            </div>
            <div class="gd-route">
              <span>Step-up SIP from</span><strong>${fmt(row.stepUpSip)}</strong>
            </div>
            <div class="gd-route">
              <span>Or one-time today</span><strong>${fmt(row.lumpsumToday)}</strong>
            </div>
          </div>

          ${SECTIONS.splits ? splitTableHtml(row) : ""}

          <p class="goal-plan-assumptions">
            Assumes ${row.inflationPct}% inflation a year on the cost of this goal,
            and ${row.returnPct}% a year on the amount invested.
          </p>
        </div>
      </details>
    `;
  }).join("");
}

function splitTableHtml(row) {
  const splits = splitPlans(row, SPLIT_PERCENTAGES);
  if (splits.length === 0) return "";

  return `
    <details class="gd-splits">
      <summary>Part now, the rest monthly</summary>
      <div class="goal-table-wrap">
        <table class="goal-table split-table">
          <thead>
            <tr>
              <th>Funded upfront</th>
              <th class="calc">Amount now</th>
              <th class="calc">Plus monthly SIP</th>
            </tr>
          </thead>
          <tbody>
            ${splits.map(s => `
              <tr>
                <td><strong>${s.upfrontPct}%</strong></td>
                <td class="calc">${fmt(s.lumpsumNow)}</td>
                <td class="calc strong">${fmt(s.monthlySip)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

/* ---------------- actions ---------------- */

const csvBtn = el("csvBtn");
if (csvBtn) {
  csvBtn.addEventListener("click", () => {
    if (!portfolio) return;

    const base = (personName || "goal-plan")
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/-+/g, "-");

    // One goal: its own full schedule covering every funding
    // route. Several: the combined plan across goals.
    const contents = portfolio.rows.length === 1
      ? buildGoalCsv(portfolio.rows[0], SPLIT_PERCENTAGES)
      : buildPortfolioCsv(portfolio);

    downloadCsv(`${base}-goal-plan.csv`, contents);
  });
}

const printBtn = el("printBtn");
if (printBtn) {
  printBtn.addEventListener("click", () => {
    // Open every collapsed card so the printed copy is complete.
    document.querySelectorAll("details").forEach(d => (d.open = true));
    window.print();
  });
}

load().catch(err => {
  console.error(err);
  showError("Something went wrong loading this plan. Please reload, or ask your advisor to resend the link.");
});
