/************************************************************
 * Goal Planner – pure calculation module
 *
 * Every function here is side-effect free and takes plain
 * numbers, so the same maths drives the admin view, the
 * client view and the PDF report.
 *
 * Conventions used throughout:
 *   - Rates are passed as percentages (12 means 12% p.a.),
 *     never as fractions.
 *   - An annual rate is converted to a monthly rate
 *     geometrically: (1+r)^(1/12) - 1. A stated 12% therefore
 *     compounds to exactly 12% over a year.
 *   - SIP instalments are treated as annuity-due (invested at
 *     the START of each month), because that is when a SIP
 *     mandate is actually debited.
 ************************************************************/

/** Monthly effective rate from an annual percentage. */
export function monthlyRate(annualReturnPct) {
  return Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
}

/** Grow an amount at an annual percentage for `years`. */
export function compound(amount, annualPct, years) {
  return amount * Math.pow(1 + annualPct / 100, years);
}

/**
 * Cost of the goal on the goal date.
 * The advisor enters the amount in today's money, so it is
 * inflated over the horizon.
 */
export function futureCost(amountToday, inflationPct, years) {
  return compound(amountToday, inflationPct, years);
}

/**
 * Level monthly SIP needed to reach `futureValue`.
 * Annuity-due: FV = P * [((1+rm)^N - 1) / rm] * (1+rm)
 */
export function sipRequired(futureValue, annualReturnPct, years) {
  if (!(futureValue > 0) || !(years > 0)) return null;

  const months = Math.round(years * 12);
  const rm = monthlyRate(annualReturnPct);

  // Zero return: no growth, so simply split the target.
  if (rm === 0) return futureValue / months;

  return (
    (futureValue * rm) / ((Math.pow(1 + rm, months) - 1) * (1 + rm))
  );
}

/** One-time amount investable today instead of a SIP. */
export function lumpsumRequired(futureValue, annualReturnPct, years) {
  if (!(futureValue > 0)) return null;
  if (!(years > 0)) return futureValue;

  return futureValue / Math.pow(1 + annualReturnPct / 100, years);
}

/**
 * Starting monthly SIP that rises by `stepUpPct` every year
 * and still reaches `futureValue`.
 *
 * Closed form (no iteration). With a = 1+g, R = 1+r and
 * S12 = the annuity-due value of one year of instalments:
 *
 *   FV = P * S12 * SUM(y=0..n-1) a^y * R^(n-1-y)
 *      = P * S12 * (R^n - a^n) / (R - a)          [R != a]
 *      = P * S12 * n * R^(n-1)                    [R == a]
 *
 * Requires a whole number of years, since a step-up is applied
 * on yearly anniversaries.
 */
export function stepUpSipRequired(
  futureValue,
  annualReturnPct,
  years,
  stepUpPct
) {
  if (!(futureValue > 0) || !(years > 0)) return null;
  if (!Number.isInteger(years)) return null;

  const rm = monthlyRate(annualReturnPct);
  const R = 1 + annualReturnPct / 100;
  const a = 1 + stepUpPct / 100;

  // Annuity-due value at the end of a year of 12 instalments.
  const s12 =
    rm === 0 ? 12 : ((Math.pow(1 + rm, 12) - 1) / rm) * (1 + rm);

  const ladder =
    Math.abs(R - a) < 1e-12
      ? years * Math.pow(R, years - 1)
      : (Math.pow(R, years) - Math.pow(a, years)) / (R - a);

  const denominator = s12 * ladder;
  if (!(denominator > 0)) return null;

  return futureValue / denominator;
}

/**
 * Plan a single goal.
 *
 * Accepts a row shaped like the client_goals table and returns
 * the row plus every derived figure. Nothing is mutated.
 *
 * Any amount already earmarked for the goal is grown at the
 * same assumed return and deducted from the target, so the SIP
 * solves only for the remaining gap.
 */
export function planGoal(goal) {
  const amountToday = Number(goal.target_amount_today) || 0;
  const years = Number(goal.years) || 0;
  const returnPct = Number(goal.assumed_return_pct) || 0;
  const inflationPct = Number(goal.inflation_pct) || 0;
  const stepUpPct = Number(goal.step_up_pct) || 0;
  const existingCorpus = Number(goal.existing_corpus) || 0;

  const targetAmount = futureCost(amountToday, inflationPct, years);
  const corpusAtGoalDate = compound(existingCorpus, returnPct, years);
  const shortfall = Math.max(targetAmount - corpusAtGoalDate, 0);
  const fullyFunded = shortfall === 0 && targetAmount > 0;

  return {
    ...goal,
    amountToday,
    years,
    returnPct,
    inflationPct,
    stepUpPct,
    existingCorpus,

    targetAmount,
    corpusAtGoalDate,
    shortfall,
    fullyFunded,

    monthlySip: fullyFunded ? 0 : sipRequired(shortfall, returnPct, years),
    lumpsumToday: fullyFunded
      ? 0
      : lumpsumRequired(shortfall, returnPct, years),
    stepUpSip: fullyFunded
      ? 0
      : stepUpSipRequired(shortfall, returnPct, years, stepUpPct)
  };
}

/**
 * Plan a list of goals and total them.
 *
 * `monthlySavings` is optional; when supplied, the affordability
 * figures report how the required SIP compares with what the
 * client currently saves each month.
 */
export function planGoals(goals, monthlySavings = null) {
  const rows = (goals || []).map(planGoal);

  const sum = key =>
    rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);

  const totals = {
    count: rows.length,
    targetAmount: sum("targetAmount"),
    shortfall: sum("shortfall"),
    existingCorpus: sum("existingCorpus"),
    monthlySip: sum("monthlySip"),
    lumpsumToday: sum("lumpsumToday"),
    stepUpSip: sum("stepUpSip")
  };

  const savings = Number(monthlySavings);
  if (Number.isFinite(savings) && savings > 0) {
    totals.monthlySavings = savings;
    totals.surplus = savings - totals.monthlySip;
    totals.affordable = totals.surplus >= 0;
    totals.savingsUtilisationPct = (totals.monthlySip / savings) * 100;
  }

  return { rows, totals };
}

/** ₹ formatting used by the on-screen views. */
export function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return "₹ " + Math.round(Number(value)).toLocaleString("en-IN");
}

/** Plain-text money for the PDF, which uses a Latin-1 font. */
export function formatCurrencyPlain(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "-";
  }
  return "Rs. " + Math.round(Number(value)).toLocaleString("en-IN");
}

/************************************************************
 * UPFRONT / SIP SPLITS
 *
 * A client who can invest something now but not the whole
 * lumpsum wants to see the middle ground. Each split funds a
 * percentage of the target with money invested today, and
 * solves the SIP that covers the rest.
 ************************************************************/

/** The upfront percentages shown in the split table. */
export const SPLIT_PERCENTAGES = [10, 25, 50, 75, 90];

/**
 * One upfront/SIP combination for a goal.
 *
 * `upfrontPct` of the target is funded by a lumpsum invested
 * today; the remainder is funded by a level SIP. Both legs grow
 * at the same assumed return, so the two add back to the target.
 */
export function splitPlan(targetAmount, annualReturnPct, years, upfrontPct) {
  if (!(targetAmount > 0) || !(years > 0)) return null;

  const share = upfrontPct / 100;
  const fundedUpfront = targetAmount * share;
  const fundedBySip = targetAmount * (1 - share);

  return {
    upfrontPct,
    lumpsumNow: lumpsumRequired(fundedUpfront, annualReturnPct, years) || 0,
    monthlySip: sipRequired(fundedBySip, annualReturnPct, years) || 0,
    targetFromUpfront: fundedUpfront,
    targetFromSip: fundedBySip
  };
}

/** The whole split ladder for a goal plan. */
export function splitPlans(plan, percentages = SPLIT_PERCENTAGES) {
  const amount = plan.shortfall > 0 ? plan.shortfall : plan.targetAmount;
  return percentages
    .map(pct => splitPlan(amount, plan.returnPct, plan.years, pct))
    .filter(Boolean);
}

/************************************************************
 * MONTH-BY-MONTH SCHEDULES
 *
 * Contributions are made at the START of each month and the
 * balance grows for that whole month, matching the annuity-due
 * convention used by sipRequired().
 ************************************************************/

/**
 * Build a monthly schedule.
 *
 * `monthlySip` is the first year's instalment; it rises by
 * `stepUpPct` on each yearly anniversary. `initialLumpsum` is
 * invested at the start of month 1.
 *
 * Returns one row per month with opening balance, contribution,
 * growth and closing balance.
 */
export function buildSchedule({
  years,
  annualReturnPct,
  monthlySip = 0,
  initialLumpsum = 0,
  stepUpPct = 0,
  startDate = new Date()
}) {
  if (!(years > 0)) return [];

  const months = Math.round(years * 12);
  const rm = monthlyRate(annualReturnPct);
  const rows = [];

  let balance = 0;

  for (let m = 0; m < months; m++) {
    const yearIndex = Math.floor(m / 12);
    const sipThisMonth = monthlySip * Math.pow(1 + stepUpPct / 100, yearIndex);
    const contribution = sipThisMonth + (m === 0 ? initialLumpsum : 0);

    const opening = balance;
    const afterContribution = opening + contribution;
    const growth = afterContribution * rm;
    balance = afterContribution + growth;

    const date = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);

    rows.push({
      month: m + 1,
      year: yearIndex + 1,
      date,
      opening,
      contribution,
      growth,
      closing: balance
    });
  }

  return rows;
}

/************************************************************
 * CSV EXPORT
 ************************************************************/

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

const isoMonth = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const round0 = n => Math.round(Number(n) || 0);

/**
 * One CSV covering every funding route for a goal, so the rows
 * line up month by month and the options can be compared
 * side by side in a spreadsheet.
 *
 * Columns: month index and calendar month, then a contribution
 * and balance pair for the level SIP, the step-up SIP, the pure
 * lumpsum, and each upfront/SIP split.
 */
export function buildGoalCsv(plan, percentages = SPLIT_PERCENTAGES) {
  const target = plan.shortfall > 0 ? plan.shortfall : plan.targetAmount;
  const opts = { years: plan.years, annualReturnPct: plan.returnPct };

  const series = [];

  series.push({
    label: "Level SIP",
    rows: buildSchedule({ ...opts, monthlySip: plan.monthlySip || 0 })
  });

  if (plan.stepUpSip) {
    series.push({
      label: `Step-up SIP (${plan.stepUpPct}%/yr)`,
      rows: buildSchedule({
        ...opts,
        monthlySip: plan.stepUpSip,
        stepUpPct: plan.stepUpPct
      })
    });
  }

  series.push({
    label: "Lumpsum only",
    rows: buildSchedule({ ...opts, initialLumpsum: plan.lumpsumToday || 0 })
  });

  for (const split of splitPlans(plan, percentages)) {
    series.push({
      label: `${split.upfrontPct}% upfront + SIP`,
      rows: buildSchedule({
        ...opts,
        initialLumpsum: split.lumpsumNow,
        monthlySip: split.monthlySip
      })
    });
  }

  const months = series[0] ? series[0].rows.length : 0;
  const lines = [];

  /* ---- Preamble: the assumptions behind the numbers ---- */
  lines.push(csvRow(["Goal", plan.goal_name || ""]));
  if (plan.goal_description) {
    lines.push(csvRow(["Description", plan.goal_description]));
  }
  lines.push(csvRow(["Amount in today's money", round0(plan.amountToday)]));
  lines.push(csvRow(["Inflation assumed (% p.a.)", plan.inflationPct]));
  lines.push(csvRow(["Years to goal", plan.years]));
  lines.push(csvRow(["Target on goal date", round0(plan.targetAmount)]));
  if (plan.existingCorpus > 0) {
    lines.push(csvRow(["Already earmarked", round0(plan.existingCorpus)]));
    lines.push(csvRow(["Projected value of that amount", round0(plan.corpusAtGoalDate)]));
    lines.push(csvRow(["Shortfall to fund", round0(plan.shortfall)]));
  }
  lines.push(csvRow(["Return assumed (% p.a.)", plan.returnPct]));
  lines.push(csvRow(["Amount funded by the schedules below", round0(target)]));
  lines.push("");

  /* ---- Header ---- */
  const header = ["Month", "Calendar month"];
  for (const s of series) {
    header.push(`${s.label} - contribution`, `${s.label} - balance`);
  }
  lines.push(csvRow(header));

  /* ---- Monthly rows ---- */
  for (let i = 0; i < months; i++) {
    const cells = [i + 1, isoMonth(series[0].rows[i].date)];
    for (const s of series) {
      const row = s.rows[i];
      cells.push(round0(row.contribution), round0(row.closing));
    }
    lines.push(csvRow(cells));
  }

  /* ---- Totals ---- */
  const totals = ["Total invested", ""];
  for (const s of series) {
    totals.push(round0(s.rows.reduce((a, r) => a + r.contribution, 0)), "");
  }
  lines.push("");
  lines.push(csvRow(totals));

  const finals = ["Final value", ""];
  for (const s of series) {
    finals.push("", round0(s.rows[s.rows.length - 1].closing));
  }
  lines.push(csvRow(finals));

  return lines.join("\r\n");
}

/** Trigger a CSV download in the browser. */
export function downloadCsv(filename, contents) {
  const blob = new Blob(["﻿" + contents], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
