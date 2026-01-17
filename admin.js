const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";
const modal = document.getElementById("observationModal");
const modalName = document.getElementById("modal_client_name");
const modalMobile = document.getElementById("modal_mobile");
const modalDate = document.getElementById("modal_date");
const modalText = document.getElementById("modal_text");
const modalMessage = document.getElementById("modalMessage");
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const tableBody = document.getElementById("clientsBody");
const baseUrl = `${location.origin}/Advisory/client.html?token=`;
const AdminClientUrl = `${location.origin}/Advisory/admin-client.html?token=`;

async function loadClients() {
  const { data, error } = await supabaseClient
    .from("form_responses")
    .select("full_name, mobile_number, access_token")
    .order("created_date", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="3">Error loading clients</td></tr>`;
    return;
  }

  data.forEach(client => {
    const clientUrl = baseUrl + client.access_token;
    const adminUrl = AdminClientUrl + client.access_token;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Client Name">${client.full_name || "-"}</td>
        <td data-label="Mobile">${client.mobile_number || "-"}</td>
        <td data-label="Client URL">
          <a href="${clientUrl}" target="_blank">Open Summary</a><br/>
          <span class="copy" onclick="navigator.clipboard.writeText('${clientUrl}')">
            Copy Link
          </span><br/>
          <a href="${adminUrl}" target="_blank">Open Full Summary</a><br/>
          <span class="copy" onclick="navigator.clipboard.writeText('${adminUrl}')">
            Copy Link
          </span>
        </td>
        
        <td data-label="Add Observation">
          <a href="#" onclick="openModal('${client.full_name}','${client.mobile_number}')">
            Add
          </a>
        </td>
      `;

    tableBody.appendChild(tr);
  });
}
// Default date
modalDate.value = new Date().toISOString().split("T")[0];

function openModal(name, mobile) {
  modalName.value = name;
  modalMobile.value = mobile;
  modalText.value = "";
  modalMessage.innerHTML = "";
  modalDate.value = new Date().toISOString().split("T")[0];
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

async function saveObservation() {
  if (!modalText.value.trim()) {
    modalMessage.innerHTML =
      `<p style="color:#b91c1c">Observation cannot be empty.</p>`;
    return;
  }

  const payload = {
    client_mobile_number: modalMobile.value,
    observation_date: modalDate.value,
    observation_text: modalText.value.trim()
  };

  const { error } = await supabaseClient
    .from("advisor_observations")
    .insert(payload);

  if (error) {
    modalMessage.innerHTML =
      `<p style="color:#b91c1c">Failed to save observation.</p>`;
    return;
  }

  modalMessage.innerHTML =
    `<p style="color:#047857">Observation saved successfully.</p>`;

  setTimeout(closeModal, 900);
}
loadClients();
