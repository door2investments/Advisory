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

  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    mobile_number: document.getElementById("mobile_number").value.trim(),
    email: document.getElementById("email").value.trim(),
    marital_status: document.getElementById("marital_status").value,
    dependents: Number(document.getElementById("dependents").value || 0),
    monthly_expenses: Number(document.getElementById("monthly_expenses").value || 0),
    health_insurance: document.getElementById("health_insurance").value === "true",
    term_insurance: document.getElementById("term_insurance").value === "true"
  };

  const { data, error } = await supabaseClient
    .from("form_responses")
    .insert(payload)
    .select("access_token")
    .single();

  if (error) {
    messageEl.innerHTML = `<div class="error">${error.message}</div>`;
    return;
  }

  messageEl.innerHTML = `
    <div class="success">
      Client profile created successfully.<br /><br />
      <strong>Client Access Link:</strong><br />
      ${location.origin}/client.html?token=${data.access_token}
    </div>
  `;

  form.reset();
});
