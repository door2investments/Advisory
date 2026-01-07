const SUPABASE_URL = "https://lyubfmzrzxntehlghfms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yAgi_Ae5nNTtanEmoWvETQ_b1khJyU8";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const tableBody = document.getElementById("clientsBody");
const baseUrl = `${location.origin}/Advisory/client.html?token=`;

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
