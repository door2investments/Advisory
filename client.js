/************************************
 * Client Dashboard Script (JSONP)
 ************************************/

const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

if (!clientId) {
  alert("Invalid client link");
  throw new Error("Client ID missing");
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbxBDkUPDUUlPUClpWrxM1JAs9or08IwsfH_ELyIWvvLqsu4AW8zPTyiEYZeCv_vtC4q/exec";

// Utility
function formatCurrency(value) {
  if (!value || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

// JSONP callback
function handleClientData(data) {
  if (data.error) {
    alert(data.error);
    return;
  }

  document.getElementById("name").innerText = data["Full Name"] || "Client";

  document.getElementById("basic").innerText =
    `${data["Marital Status"] || "—"} | Dependents: ${
      data["Number of Dependents"] || 0
    }`;

  document.getElementById("shortGoal").innerText =
    formatCurrency(data["Short Term Goal Amount"]);

  document.getElementById("mediumGoal").innerText =
    formatCurrency(data["Medium Term Goal Amount"]);

  document.getElementById("longGoal").innerText =
    formatCurrency(data["Long Term Goal Amount"]);

  document.getElementById("health").innerText =
    data["Health Insurance"] === "Yes" ? "Yes" : "No";

  document.getElementById("term").innerText =
    data["Term Insurance"] === "Yes" ? "Yes" : "No";

  // Retirement logic
  const inflation = 0.06;
  const retirementAge = 60;

  let age = 0;
  if (data["Date of Birth"]) {
    const dob = new Date(data["Date of Birth"]);
    age = new Date().getFullYear() - dob.getFullYear();
  }

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

  // Advisor notes
  const notes = [];
  if (data["Health Insurance"] !== "Yes")
    notes.push("Health insurance needs immediate attention.");
  if (data["Term Insurance"] !== "Yes")
    notes.push("Adequate term insurance is recommended.");
  if (yearsToRetirement <= 10)
    notes.push("Retirement horizon is short. Conservative planning advised.");
  else
    notes.push("You have time to build retirement corpus with discipline.");

  const ul = document.getElementById("advisorNotes");
  ul.innerHTML = "";
  notes.forEach(n => {
    const li = document.createElement("li");
    li.innerText = n;
    ul.appendChild(li);
  });
}

// Inject JSONP script
const script = document.createElement("script");
script.src = `${API_URL}?id=${clientId}&callback=handleClientData`;
document.body.appendChild(script);
