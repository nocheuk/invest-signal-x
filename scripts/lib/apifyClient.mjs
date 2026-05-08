const APIFY_API_BASE_URL = "https://api.apify.com/v2";

export function getApifyConfig() {
  const token = process.env.APIFY_TOKEN?.trim();
  const actorId = process.env.RIGHTMOVE_COMMERCIAL_ACTOR_ID || "dhrumil/rightmove-commercial-scraper";
  if (!token) {
    throw new Error("APIFY_TOKEN is required.");
  }
  return { token, actorId };
}

export async function runRightmoveCommercialActor({ token, actorId, url }) {
  const normalizedActorId = actorId.replace("/", "~");
  const input = {
    startUrls: [{ url }],
    urls: [url],
    url,
    searchUrl: url,
  };

  const runResponse = await fetch(`${APIFY_API_BASE_URL}/acts/${encodeURIComponent(normalizedActorId)}/runs?waitForFinish=180`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!runResponse.ok) {
    throw new Error(`Apify actor run failed to start: ${runResponse.status} ${await runResponse.text()}`);
  }

  const runPayload = await runResponse.json();
  const run = runPayload.data;
  if (!run?.defaultDatasetId) {
    throw new Error("Apify actor did not return a default dataset id.");
  }
  if (run.status && !["SUCCEEDED", "READY"].includes(run.status)) {
    throw new Error(`Apify actor finished with status ${run.status}.`);
  }

  return run;
}

export async function fetchDatasetItems({ token, datasetId }) {
  const response = await fetch(`${APIFY_API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed: ${response.status} ${await response.text()}`);
  }
  const items = await response.json();
  return Array.isArray(items) ? items : [];
}
