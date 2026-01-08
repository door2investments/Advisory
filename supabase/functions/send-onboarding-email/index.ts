import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// ✅ CORS HEADERS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or restrict to your domain later
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientName, clientEmail, summaryLink } = await req.json();

    if (!clientEmail || !summaryLink) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial;">
<table width="100%" style="padding:20px 0;">
<tr><td align="center">
<table width="600" style="background:#fff;border-radius:10px;">
<tr>
<td style="background:#e6f4ef;padding:24px;text-align:center;">
<h2 style="margin:0;color:#0f2a44;">Wealth & Investment Advisory</h2>
<p style="margin:6px 0 0;color:#475569;">Independent Financial Advisory Services</p>
</td>
</tr>

<tr>
<td style="padding:26px;font-size:14px;line-height:1.6;">
<p>Dear <strong>${clientName || "Client"}</strong>,</p>

<p>Your onboarding has been completed successfully.</p>

<p style="text-align:center;margin:26px 0;">
<a href="${summaryLink}"
style="background:#0f2a44;color:#fff;padding:12px 22px;
text-decoration:none;border-radius:6px;font-weight:bold;">
View Your Client Summary
</a>
</p>

<p>
Warm regards,<br/>
<strong>Raviteja Soma</strong><br/>
Wealth & Investment Advisory
</p>
</td>
</tr>

<tr>
<td style="font-size:11px;color:#6b7280;padding:12px;text-align:center;">
Mutual fund investments are subject to market risks.
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>
`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST"
