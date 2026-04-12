export async function handler(event) {
  const ref = (event.queryStringParameters?.ref || "").trim();

  // Basic validation
  if (!/^PRT-[A-Za-z0-9]{4,}$/.test(ref)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid reference ID." }),
    };
  }

  const hubspotToken = process.env.HUBSPOT_TOKEN;
  if (!hubspotToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "HubSpot token missing." }),
    };
  }

  const response = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hubspotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "client_portal_id",
                operator: "EQ",
                value: ref,
              },
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

  if (!response.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "HubSpot request failed." }),
    };
  }

  const data = await response.json();
  const deal = data.results?.[0];

  if (!deal) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "No request found." }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      reference: deal.properties.client_portal_id,
      name: deal.properties.dealname,
      stage: deal.properties.dealstage,
      requestType: deal.properties.request_type,
      actionRequired: deal.properties.client_action_required,
      lastUpdated: deal.properties.hs_lastmodifieddate,
    }),
  };
}
