// Supabase config
// 2️⃣ Supabase config (PASTE YOUR VALUES)

const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const form = document.getElementById("clientForm");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.innerHTML = "";

  const assets = Array.from(
    document.querySelectorAll("input[type=checkbox]:checked")
  ).map(cb => cb.value);

  const payload = {
    full_name: full_name.value,
    mobile_number: mobile_number.value,
    email: email.value,
    date_of_birth: date_of_birth.value,
    gender: document.querySelector("input[name=gender]:checked")?.value,
    marital_status: marital_status.value,
    profession: document.querySelector("input[name=profession]:checked")?.value,
    dependents: dependents.value,
    family_responsibility: family_responsibility.value,
    monthly_expenses: Number(monthly_expenses.value),
    insurance_emi: Number(insurance_emi.value || 0),
    monthly_savings: Number(monthly_savings.value || 0),
    assets_held: assets,
    health_insurance: document.querySelector("input[name=health_insurance]:checked")?.value === "true",
    term_insurance: document.querySelector("input[name=term_insurance]:checked")?.value === "true",
    invested_before: document.querySelector("input[name=invested_before]:checked")?.value,
    investment_experience: document.querySelector("input[name=experience]:checked")?.value,

// ================================
// INVESTMENT BEHAVIOUR & PROFILE
// ================================

decision_maker: document.querySelector(
  "input[name='decision_maker']:checked"
)?.value || null,

investment_knowledge: document.querySelector(
  "input[name='investment_knowledge']:checked"
)?.value || null,

market_fall_response: document.querySelector(
  "input[name='market_fall_response']:checked"
)?.value || null,

sold_due_to_fear: document.querySelector(
  "input[name='sold_due_to_fear']:checked"
)?.value || null,

tracking_frequency: document.querySelector(
  "input[name='tracking_frequency']:checked"
)?.value || null,

investment_objective: document.querySelector(
  "input[name='investment_objective']:checked"
)?.value || null,

investment_horizon: document.getElementById(
  "investment_horizon"
)?.value || null,

loss_reaction: document.querySelector(
  "input[name='loss_reaction']:checked"
)?.value || null,

// ================================
// GOALS & AMOUNTS
// ================================

short_term_goal: document.getElementById(
  "short_term_goals"
)?.value?.trim() || null,

medium_term_goal: document.getElementById(
  "medium_term_goals"
)?.value?.trim() || null,

long_term_goal: document.getElementById(
  "long_term_goals"
)?.value?.trim() || null,

investment_mode: document.querySelector(
  "input[name='investment_mode']:checked"
)?.value || null,

advisor_expectation: document.querySelector(
  "input[name='advisor_expectation']:checked"
)?.value || null,

short_term_amount: Number(
  document.getElementById("short_term_amount")?.value || 0
),

medium_term_amount: Number(
  document.getElementById("medium_term_amount")?.value || 0
),

long_term_amount: Number(
  document.getElementById("long_term_amount")?.value || 0
),

retirement_planned: document.querySelector(
  "input[name='retirement_planned']:checked"
)?.value || null


    
  };

  const { error } = await supabaseClient.from("form_responses").insert(payload);

  if (error) {
    if (error.message.includes("mobile")) {
      messageEl.innerHTML = `<p class="error">Mobile number already exists.</p>`;
    } else {
      messageEl.innerHTML = `<p class="error">${error.message}</p>`;
    }
    return;
  }

  messageEl.innerHTML = `<p class="success">Profile created successfully.</p>`;
  form.reset();
});

