export function normalizeAlert(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    name: row.name ?? "Saved alert",
    locationQuery: row.location_query ?? row.locationQuery ?? "",
    minYield: Number(row.min_yield ?? row.minYield ?? 0) || 0,
    maxPrice: Number(row.max_price ?? row.maxPrice ?? 0) || 0,
    assetType: row.asset_type ?? row.assetType ?? "All",
    minScore: Number(row.min_score ?? row.minScore ?? 0) || 0,
    enabled: row.enabled !== false,
    userEmail: row.profiles?.email ?? row.email,
  };
}

export function normalizeDeal(row = {}) {
  return {
    id: row.id,
    title: row.title ?? "Untitled deal",
    location: row.location ?? "",
    region: row.region ?? "",
    assetType: row.asset_type ?? row.assetType ?? "Retail",
    guidePrice: Number(row.guide_price ?? row.guidePrice ?? 0) || 0,
    netInitialYield: Number(row.net_initial_yield ?? row.netInitialYield ?? row.gross_yield ?? row.grossYield ?? 0) || 0,
    score: Number(row.score ?? 0) || 0,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

export function alertMatchesDeal(alert, deal) {
  if (!alert.enabled) return { matches: false, reasons: ["Alert disabled"] };
  const reasons = [];
  if (alert.locationQuery.trim()) {
    const query = normalize(alert.locationQuery);
    const haystack = normalize([deal.location, deal.region, deal.title].filter(Boolean).join(" "));
    if (!haystack.includes(query)) return { matches: false, reasons: [`Location does not match ${alert.locationQuery}`] };
    reasons.push(`Location matches ${alert.locationQuery}`);
  }
  if (alert.assetType && alert.assetType !== "All" && deal.assetType !== alert.assetType) {
    return { matches: false, reasons: [`Asset type is ${deal.assetType}, not ${alert.assetType}`] };
  }
  if (alert.assetType && alert.assetType !== "All") reasons.push(`Asset type matches ${alert.assetType}`);
  if (alert.minYield > 0) {
    if (deal.netInitialYield < alert.minYield) return { matches: false, reasons: [`Yield below ${formatPct(alert.minYield, 1)}`] };
    reasons.push(`Yield ${formatPct(deal.netInitialYield, 2)} meets minimum ${formatPct(alert.minYield, 1)}`);
  }
  if (alert.maxPrice > 0) {
    if (deal.guidePrice <= 0 || deal.guidePrice > alert.maxPrice) return { matches: false, reasons: [`Guide price above ${formatGBP(alert.maxPrice)} or unavailable`] };
    reasons.push(`Guide price ${formatGBP(deal.guidePrice)} within ${formatGBP(alert.maxPrice)}`);
  }
  if (alert.minScore > 0) {
    if (deal.score < alert.minScore) return { matches: false, reasons: [`Score below ${alert.minScore}`] };
    reasons.push(`Score ${deal.score} meets minimum ${alert.minScore}`);
  }
  return { matches: true, reasons: reasons.length ? reasons : ["Deal matches alert criteria"] };
}

export function buildAlertEmailPayload({ alert, deals, appUrl, limit = 5 }) {
  const topDeals = [...deals]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((deal) => ({
      id: deal.id,
      title: deal.title,
      location: deal.location,
      assetType: deal.assetType,
      guidePrice: deal.guidePrice,
      netInitialYield: deal.netInitialYield,
      score: deal.score,
      url: `${appUrl.replace(/\/$/, "")}/deal/${deal.id}`,
    }));
  const subject = `DealSignal alert: ${topDeals.length} matching ${topDeals.length === 1 ? "deal" : "deals"} for ${alert.name}`;
  const textDeals = topDeals.map((deal) => (
    `- ${deal.title} (${deal.location}) | Score ${deal.score} | ${deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Price not available"} | ${deal.netInitialYield > 0 ? formatPct(deal.netInitialYield, 2) : "Yield not available"} | ${deal.url}`
  )).join("\n");
  const htmlDeals = topDeals.map((deal) => (
    `<li><strong>${escapeHtml(deal.title)}</strong><br>${escapeHtml(deal.location)} · Score ${deal.score} · ${deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Price not available"} · ${deal.netInitialYield > 0 ? formatPct(deal.netInitialYield, 2) : "Yield not available"}<br><a href="${deal.url}">Open deal</a></li>`
  )).join("");
  return {
    alertName: alert.name,
    matchingDealCount: deals.length,
    topDeals,
    appUrl,
    subject,
    text: `DealSignal found ${deals.length} matching ${deals.length === 1 ? "deal" : "deals"} for "${alert.name}".\n\n${textDeals}\n\nOpen DealSignal: ${appUrl}`,
    html: `<p>DealSignal found ${deals.length} matching ${deals.length === 1 ? "deal" : "deals"} for <strong>${escapeHtml(alert.name)}</strong>.</p><ul>${htmlDeals}</ul><p><a href="${appUrl}">Open DealSignal</a></p>`,
  };
}

export async function runSavedAlertsForRecentDeals({
  supabase,
  since,
  appUrl = process.env.APP_BASE_URL ?? process.env.VITE_APP_URL ?? "https://dealsignal.app",
  now = new Date(),
  sendEmail = sendAlertEmail,
} = {}) {
  if (!supabase) throw new Error("Supabase service client is required for alert runs.");
  const run = await createAlertRun({ supabase, now });
  const stats = { dealsMatched: 0, emailsSent: 0, alertsEvaluated: 0, duplicateMatches: 0 };

  try {
    const alerts = await loadActiveAlerts({ supabase });
    const deals = await loadRecentImportedDeals({ supabase, since });
    stats.alertsEvaluated = alerts.length;
    const matchesByAlert = new Map();

    for (const alert of alerts) {
      for (const deal of deals) {
        const result = alertMatchesDeal(alert, deal);
        if (!result.matches) continue;
        const key = `${alert.id}:${deal.id}`;
        matchesByAlert.set(alert.id, [...(matchesByAlert.get(alert.id) ?? []), { alert, deal, reasons: result.reasons, key }]);
      }
    }

    for (const [alertId, matches] of matchesByAlert.entries()) {
      const alert = matches[0].alert;
      const freshMatches = await suppressExistingMatches({ supabase, alertId, matches });
      stats.duplicateMatches += matches.length - freshMatches.length;
      if (freshMatches.length === 0) continue;

      const payload = buildAlertEmailPayload({ alert, deals: freshMatches.map((match) => match.deal), appUrl });
      const emailResult = await sendEmail({ alert, payload });
      if (emailResult.sent) stats.emailsSent += 1;

      for (const match of freshMatches) {
        await insertAlertMatch({
          supabase,
          runId: run.id,
          alert,
          deal: match.deal,
          reasons: match.reasons,
          payload,
          emailResult,
        });
        stats.dealsMatched += 1;
      }
    }

    await finishAlertRun({ supabase, runId: run.id, status: "completed", stats });
    return { runId: run.id, status: "completed", ...stats };
  } catch (error) {
    await finishAlertRun({ supabase, runId: run.id, status: "failed", stats, errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function loadActiveAlerts({ supabase }) {
  const { data, error } = await supabase
    .from("saved_alerts")
    .select("*")
    .eq("enabled", true);
  if (error) throw error;
  const alerts = (data ?? []).map(normalizeAlert);
  if (!supabase.auth?.admin?.getUserById) return alerts;
  return Promise.all(alerts.map(async (alert) => {
    const { data: userData } = await supabase.auth.admin.getUserById(alert.userId);
    return { ...alert, userEmail: userData?.user?.email ?? alert.userEmail };
  }));
}

async function loadRecentImportedDeals({ supabase, since }) {
  const select = supabase
    .from("deals")
    .select("id,title,location,region,asset_type,guide_price,net_initial_yield,gross_yield,score,updated_at");
  const query = since ? select.gte("updated_at", new Date(since).toISOString()) : select;
  const { data, error } = await query;
  if (error) throw error;
  const deals = (data ?? []).map(normalizeDeal);
  if (deals.length === 0) return deals;

  const { data: links, error: linksError } = await supabase
    .from("deal_source_links")
    .select("deal_id")
    .in("deal_id", deals.map((deal) => deal.id));
  if (linksError) throw linksError;
  const importedDealIds = new Set((links ?? []).map((link) => link.deal_id));
  return deals.filter((deal) => deal.id.startsWith("imp-") || importedDealIds.has(deal.id));
}

async function suppressExistingMatches({ supabase, alertId, matches }) {
  const dealIds = matches.map((match) => match.deal.id);
  const { data, error } = await supabase
    .from("alert_matches")
    .select("deal_id")
    .eq("alert_id", alertId)
    .in("deal_id", dealIds);
  if (error) throw error;
  const alreadySent = new Set((data ?? []).map((match) => match.deal_id));
  return matches.filter((match) => !alreadySent.has(match.deal.id));
}

async function createAlertRun({ supabase, now }) {
  const { data, error } = await supabase
    .from("alert_runs")
    .insert({ status: "pending", started_at: now.toISOString(), metadata: { trigger: "national_scan" } })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function finishAlertRun({ supabase, runId, status, stats, errorMessage = null }) {
  const { error } = await supabase
    .from("alert_runs")
    .update({
      status,
      deals_matched: stats.dealsMatched,
      emails_sent: stats.emailsSent,
      metadata: stats,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}

async function insertAlertMatch({ supabase, runId, alert, deal, reasons, payload, emailResult }) {
  const { error } = await supabase
    .from("alert_matches")
    .insert({
      alert_run_id: runId,
      alert_id: alert.id,
      user_id: alert.userId,
      deal_id: deal.id,
      email_sent: emailResult.sent,
      email_sent_at: emailResult.sent ? new Date().toISOString() : null,
      email_status: emailResult.status,
      match_reasons: reasons,
      payload,
    });
  if (error && error.code !== "23505") throw error;
}

export async function sendAlertEmail({ alert, payload, env = process.env } = {}) {
  if (!env.RESEND_API_KEY) return { sent: false, status: "provider_not_configured" };
  if (!alert.userEmail) return { sent: false, status: "missing_recipient" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.ALERT_EMAIL_FROM ?? "DealSignal <alerts@dealsignal.app>",
      to: alert.userEmail,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });
  if (!response.ok) return { sent: false, status: `send_failed_${response.status}` };
  return { sent: true, status: "sent" };
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatGBP(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n}`;
}

function formatPct(value, dp = 2) {
  return `${(Number(value) || 0).toFixed(dp)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
