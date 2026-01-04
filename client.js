const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

const API_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

if (!clientId) {
  alert("Invalid client link");
}

fetch(`${API_URL}?id=${clientId}`)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }

    document.getElementById("name").innerText = data["Full Name"];
    document.getElementById("basic").innerText =
      `${data["Marital Status"]} | Dependents: ${data["Number of Dependents"]}`;

    document.getElementById("shortGoal").innerText =
      "₹ " + Number(data["Short Term Goal Amount"]).toLocaleString();

    document.getElementById("mediumGoal").innerText =
      "₹ " + Number(data["Medium Term Goal Amount"]).toLocaleString();

    document.getElementById("longGoal").innerText =
      "₹ " + Number(data["Long Term Goal Amount"]).toLocaleString();

    document.getElementById("health").innerText =
      data["Health Insurance"] ? "Yes" : "No";

    document.getElementById("term").innerText =
      data["Term Insurance"] ? "Yes" : "No";

    // ---- Retirement Calculation ----
const inflation = 0.06;
const retirementAge = 60;
const lifeExpectancy = 85;

const dob = new Date(data["Date of Birth"]);
const age =
  new Date().getFullYear() - dob.getFullYear();

const yearsToRetirement = Math.max(retirementAge - age, 0);

const currentExpense =
  Number(data["Monthly Expenses"] || 0);

const futureMonthlyExpense =
  currentExpense * Math.pow(1 + inflation, yearsToRetirement);

const annualExpense = futureMonthlyExpense * 12;
const retirementCorpus = annualExpense * 25;

// Render
document.getElementById("currExpense").innerText =
  "₹ " + currentExpense.toLocaleString();

document.getElementById("retExpense").innerText =
  "₹ " + Math.round(futureMonthlyExpense).toLocaleString();

document.getElementById("retCorpus").innerText =
  "₹ " + Math.round(retirementCorpus).toLocaleString();

const notes = [];

if (data["Health Insurance"] !== "Yes") {
  notes.push("Health insurance needs immediate attention.");
}

if (data["Term Insurance"] !== "Yes") {
  notes.push("Adequate term life insurance is essential for family protection.");
}

if (yearsToRetirement < 10) {
  notes.push("Retirement planning horizon is short. Conservative strategy needed.");
} else {
  notes.push("You have sufficient time to build retirement corpus with discipline.");
}

const ul = document.getElementById("advisorNotes");
notes.forEach(n => {
  const li = document.createElement("li");
  li.innerText = n;
  ul.appendChild(li);
});


    
  });
