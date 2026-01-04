const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

if (!clientId) {
  alert("Invalid client link");
  throw new Error("Client ID missing");
}

// JSON file hosted on GitHub
const DATA_URL = "./clients.json";

function formatCurrency(value) {
  if (!value || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

fetch(DATA_URL)
  .then(res => res.json())
  .then(clients => {
    const data = clients.find(
      c => String(c["Mobile Number"]) === clientId
    );

    if (!data) {
      alert("Client not found");
      return;
    }

    // BASIC
    document.getElementById("name").innerText = data["Full Name"];
    document.getElementById("basic").innerText =
      `${data["Marital Status"]} | Dependents: ${data["Number of Dependents"]}`;

    // GOALS
    document.getElementById("shortGoal").innerText =
      formatCurrency(data["Short Term Goal Amount"]);
    document.getElementById("mediumGoal").innerText =
      formatCurrency(data["Medium Term Goal Amount"]);
    document.getElementById("longGoal").innerText =
      formatCurrency(data["Long Term Goal Amount"]);

    // INSURANCE
    document.getElementById("health").innerText =
      data["Health Insurance"] === "Yes" ? "Yes" : "No";
    document.getElementById("term").innerText =
      data["Term Insurance"] === "Yes" ? "Yes" : "No";

    // RETIREMENT
    const inflation = 0.06;
    const retirementAge = 60;

    const dob = new Date(data["Date of Birth"]);
    const age = new Date().getFullYear() - dob.getFullYear();
    const yearsToRetirement = Math.max(retirementAge - age, 0);

    const currentExpense = Number(data["Monthly Expenses"] || 0);
    const futureMonthlyExpense =
      currentExpense * Math.pow(1 + inflation, yearsToRetirement);

    const retirementCorpus = futureMonthlyExpense * 12 * 25;

    document.getElementById("currExpense").innerText =
      formatCurrency(currentExpense);
    document.getElementById("retExpense").innerText =
      formatCurrency(futureMonthlyExpense);
    document.getElementById("retCorpus").innerText =
      formatCurrency(retirementCorpus);
  });
