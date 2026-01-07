const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const tableBody = document.getElementById("clientsBody");
const baseUrl = `${location.origin}/client.html?token=`;

async function loadClients() {
  const { data, error } = await supabaseClient
    .from("clients")
    .select("full_name, mobile_number, access_token")
    .order("timestamp", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="3">Error loading clients</td></tr>`;
    return;
  }

  data.forEach(client => {
    const url = baseUrl + client.access_token;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Client Name">${client.full_name || "-"}</td>
      <td data-label="Mobile">${client.mobile_number || "-"}</td>
      <td data-label="Client URL">
        <a href="${url}" target="_blank">Open Summary</a>
        <br/>
        <span class="copy" onclick="navigator.clipboard.writeText('${url}')">
          Copy Link
        </span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

loadClients();
