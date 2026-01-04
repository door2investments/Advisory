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
  });
