/************************************
 * Admin - Client Dashboard – Token Based
 ************************************/

import { generateClientPlanningPDF } from "./finance.js";
let clientData =  null;

// Read token from URL
const params = new URLSearchParams(window.location.search);
const accessToken = params.get("token");

if (!accessToken) {
  alert("Invalid or missing access link.");
  throw new Error("Access token missing");
}

// 2️⃣ Supabase config (PASTE YOUR VALUES)
const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

// Init Supabase client
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Utility
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹ 0";
  return "₹ " + Math.round(value).toLocaleString("en-IN");
}

// Load client data
async function loadClient() {
  const { data, error } = await supabaseClient
    .from("form_responses")
    .select("*")
    .eq("access_token", accessToken)
    .single();

  if (error || !data) {
    console.error(error);
    alert("Invalid or expired link.");
    return;
  }

  // Update last accessed timestamp (non-blocking)
  supabaseClient
    .from("form_responses")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id);

  clientData = data;
  renderClient(data);
  // loadAdvisorObservations(data.mobile_number)
}

function renderClient(data) {
  Object.keys(data).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.innerText =
        data[key] === null || data[key] === ""
          ? "—"
          : Array.isArray(data[key])
            ? data[key].join(", ")
            : data[key];
    }
  });
}
async function loadAdvisorObservations(clientMobile) {
  const container = document.getElementById("observationsContainer");
  container.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("advisor_observations")
    .select("observation_date, observation_text")
    .eq("client_mobile_number", clientMobile)
    .order("observation_date", { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="observation-card open pending">
        <div class="observation-header">
          Advisor Observation Pending
        </div>
        <div class="observation-body">
          Your portfolio details are currently under review.<br/><br/>
          Advisor observations and recommendations will appear here
          after the next review cycle.
        </div>
      </div>
    `;
    return;
  }

  data.forEach((obs, index) => {
    const card = document.createElement("div");
    card.className = "observation-card" + (index === 0 ? " open" : "");

    card.innerHTML = `
      <div class="observation-header">
        ${new Date(obs.observation_date).toDateString()}
        <span class="arrow">▼</span>
      </div>
      <div class="observation-body">
        ${obs.observation_text.replace(/\n/g, "<br/>")}
      </div>
    `;

    card
      .querySelector(".observation-header")
      .addEventListener("click", () => {
        card.classList.toggle("open");
      });

    container.appendChild(card);
  });
}

function generateAdvisorImpactChartImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;

  const ctx = canvas.getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Without Advisor", "With Advisor"],
      datasets: [{
        label: "Average Annual Net Return (%)",
        data: [5, 8], // representative research-based values
        backgroundColor: ["#e74c3c", "#2ecc71"]
      }]
    },
    options: {
      responsive: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: {
            callback: v => v + "%"
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Impact of Advisor Guidance on Long-Term Returns"
        }
      }
    }
  });

  // return image data
  return canvas.toDataURL("image/png");
}



// Init
loadClient();

document
  .getElementById("downloadPdfBtn")
  .addEventListener("click", () => {
    if (!clientData) {
      alert("Client data not loaded");
      return;
    }

    const advisorChartImage = generateAdvisorImpactChartImage();

    generateClientPlanningPDF(clientData, advisorChartImage);
  });

// document
//   .getElementById("downloadPdfBtnStepup")
//   .addEventListener("click", () => {
//     if (!clientData) {
//       alert("Client data not loaded");
//       return;
//     }

//     const advisorChartImage = generateAdvisorImpactChartImage();

//     generateClientPlanningPDF(clientData, advisorChartImage,true);
//   });

// document.getElementById("downloadPdfBtn").addEventListener("click", () => {
//   generateClientPlanningPDF(clientData); // clientData already fetched
// });

