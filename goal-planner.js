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
