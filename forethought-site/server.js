import express from "express";
import fetch from "node-fetch";

const app = express();
const HS_TOKEN = process.env.HUBSPOT_TOKEN;

app.get("/api/request-status", async (req, res) => {
  const ref = String(req.query.ref || "").trim();

  // Basic input validation
  if (!/^PRT-[A-Za-z0-9]{4,}$/.test(ref)) {
    return res.status(400).json({ error: "Invalid reference ID." });
  }
  if (!HS_TOKEN) {
    return res.status(500).json({ error: "Server missing HubSpot token." });
  }

  const hsRes = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "client_portal_id", operator: "EQ", value: ref },
            ],
          },
        ],
        properties: [
          "dealname",
          "dealstage",
          "client_portal_id",
          "request_type",
          "client_action_required",
          "hs_lastmodifieddate",
        ],
        limit: 1,
      }),
    },
  );

  if (!hsRes.ok) {
    const detail = await hsRes.text();
    return res.status(502).json({ error: "HubSpot lookup failed.", detail });
  }

  const data = await hsRes.json();
  const deal = data.results?.[0];
  if (!deal) return res.status(404).json({ error: "No request found." });

  // Return minimized fields only
  res.json({
    reference: deal.properties.client_portal_id,
    name: deal.properties.dealname,
    stage: deal.properties.dealstage,
    requestType: deal.properties.request_type,
    actionRequired: deal.properties.client_action_required,
    lastUpdated: deal.properties.hs_lastmodifieddate,
  });
});

app.use(express.static(".")); // serves your static site files
app.listen(3000, () => console.log("Running on http://localhost:3000"));
