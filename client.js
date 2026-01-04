/************************************
 * Client Dashboard Script
 * Wealth & Investment Advisory
 ************************************/

// 1️⃣ Read client ID from URL
const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

// 2️⃣ Google Apps Script API URL (PASTE YOUR URL)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxBDkUPDUUlPUClpWrxM1JAs9or08IwsfH_ELyIWvvLqsu4AW8zPTyiEYZeCv_vtC4q/exec";

// 3️⃣ Basic validation
if (!clientId) {
  alert("Invalid or missing client link.");
  throw new Error("Client ID missing");
}

// 4️⃣ Utility: format currency
function formatCurrency(value) {
  if (!value || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

// 5️⃣ Fetch client data
fetch(`${API_URL}?id=${clientId}`)
  .then((res) => res.json())
  .then((data) => {
    if (data.error) {
      alert(data.error);
      return;
    }

    /************************************
     * BASIC CLIENT DETAILS
     ************************************/
    document.getElementById("name").innerText =
      data["Full Name"] || "Client";

    document.getElementById("basic").innerText =
      `${data["Marital Status"] || "—"} | Dependents: ${
        data["Number of Dependents"] || 0
      }`;

    /************************************
     * GOALS SECTION
     ************************************/
    document.getElementById("shortGoal").innerText =
      formatCurrency(data["Short Term Goal Amount"]);

    document.getElementById("mediumGoal").innerText =
      formatCurrency(data["Medium Term Goal Amount"]);

    document.getElementById("longGoal").innerText =
      formatCurrency(data["Long Term Goal Amount"]);

    /************************************
     * INSURANCE STATUS
     ************************************/
    document.getElementById("health").innerText =
      data["Health Insurance"] === "Yes" ? "Yes" : "No";

    document.getElementById("term").innerText =
      data["Term Insurance"] === "Yes" ? "Yes" : "No";

    /************************************
     * RETIREMENT CALCULATION
     ************************************/
    const inflation = 0.06;
    const retirementAge = 60;

    // Age calculation
    let age = 0;
    if (data["Date of Birth"]) {
      const dob = new Date(data["Date of Birth"]);
      age = new Date().getFullYear() - dob.getFullYear();
    }

    const yearsToRetirement = Math.max(retirementAge - age, 0);

    const currentExpense = Number(data["Monthly Expenses"] || 0);

    const futureMonthlyExpense =
      currentExpense * Math.pow(1 + inflation, yearsToRetirement);

    const annualExpense = futureMonthlyExpense * 12;
    const retirementCorpus = annualExpense * 25;

    document.getElementById("currExpense").innerText =
      formatCurrency(currentExpense);

    document.getElementById("retExpense").innerText =
      formatCurrency(futureMonthlyExpense);

    document.getElementById("retCorpus").innerText =
      formatCurrency(retirementCorpus);

    /************************************
     * ADVISOR OBSERVATIONS (INSIGHTS)
     ************************************/
    const notes = [];

    if (data["Health Insurance"] !== "Yes") {
      notes.push(
        "Health insurance coverage needs immediate attention to avoid unexpected financial stress."
      );
    }

    if (data["Term Insurance"] !== "Yes") {
      notes.push(
        "Adequate term life insurance is important to protect your family’s future."
      );
    }

    if (yearsToRetirement <= 10) {
      notes.push(
        "Retirement is approaching. A conservative and disciplined investment strategy is recommended."
      );
    } else {
      notes.push(
        "You have sufficient time to build a strong retirement corpus with a structured investment plan."
      );
    }

    if (currentExpense === 0) {
      notes.push(
        "Monthly expense details are missing. Retirement planning accuracy may be affected."
      );
    }

    const notesList = document.getElementById("advisorNotes");
    notesList.innerHTML = "";
    notes.forEach((note) => {
      const li = document.createElement("li");
      li.innerText = note;
      notesList.appendChild(li);
    });
  })
  .catch((err) => {
    console.error("Error loading client data:", err);
    alert("Unable to load client data. Please try again later.");
  });
