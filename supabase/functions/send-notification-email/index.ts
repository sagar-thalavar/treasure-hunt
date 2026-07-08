// Notification emails for the treasure/claim moderation workflow —
// adapted from the send-guestbook-email pattern in
// github.com/sagar-thalavar/guestbook. Same shape: a Supabase Database
// Webhook fires this function on INSERT/UPDATE, which sends the actual
// email through Resend.
//
// MANUAL SETUP REQUIRED (this code is not live until you do this):
//   1. supabase functions deploy send-notification-email
//   2. supabase secrets set RESEND_API_KEY=... ADMIN_EMAIL=you@example.com
//      (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already available
//      automatically inside every Edge Function.)
//   3. In the Supabase Dashboard -> Database -> Webhooks, create two
//      webhooks pointing at this function's URL:
//        - table: treasures, events: INSERT, UPDATE
//        - table: claims,    events: INSERT, UPDATE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function wrap(title: string, bodyHtml: string, ctaHref: string, ctaLabel: string, accent = "#1e293b") {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">${title}</h2>
      ${bodyHtml}
      <a href="${ctaHref}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; border-radius: 99px; background-color: ${accent}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">${ctaLabel}</a>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
    const appUrl = Deno.env.get("APP_URL") ?? "https://your-domain.example";

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase environment variables");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    let emailTo = "";
    let subject = "";
    let html = "";
    let shouldSend = false;

    async function emailFor(userId: string): Promise<string | null> {
      const { data } = await supabase.from("profiles").select("id").eq("id", userId).single();
      if (!data) return null;
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      return authUser?.user?.email ?? null;
    }

    if (table === "treasures") {
      if (type === "INSERT") {
        shouldSend = true;
        emailTo = adminEmail;
        subject = `🔔 New treasure submitted: ${record.title}`;
        html = wrap(
          "New Treasure Pending Review",
          `<p style="color:#334155;font-size:15px;">A new treasure has been submitted and needs your review before it goes live.</p>
           <p style="color:#475569;font-size:14px;"><strong>Title:</strong> ${record.title}<br/><strong>Points staked:</strong> ${record.points_staked}</p>`,
          `${appUrl}/admin`,
          "Review Submission"
        );
      }

      if (type === "UPDATE" && old_record.status !== record.status) {
        const creatorEmail = await emailFor(record.creator_id);
        if (creatorEmail) {
          if (record.status === "approved") {
            shouldSend = true;
            emailTo = creatorEmail;
            subject = `✅ Your treasure "${record.title}" is live!`;
            html = wrap(
              "Your Treasure is Live",
              `<p style="color:#334155;font-size:15px;">Your treasure has been approved and is now visible to other explorers.</p>`,
              `${appUrl}/feed`,
              "View in Feed"
            );
          } else if (record.status === "rejected") {
            shouldSend = true;
            emailTo = creatorEmail;
            subject = `⚠️ Your treasure "${record.title}" needs a fix`;
            html = wrap(
              "Changes Needed",
              `<p style="color:#334155;font-size:15px;">Your submission wasn't approved yet.</p>
               <div style="background:#fef2f2;padding:14px;border-radius:8px;border-left:4px solid #ef4444;margin-top:12px;">
                 <p style="margin:0;color:#991b1b;font-size:14px;"><strong>Reason:</strong> ${record.rejection_reason ?? "See app for details"}</p>
               </div>`,
              `${appUrl}/profile`,
              "Fix & Resubmit",
              "#ef4444"
            );
          }
        }
      }
    }

    if (table === "claims") {
      if (type === "INSERT") {
        const { data: treasure } = await supabase.from("treasures").select("title, creator_id").eq("id", record.treasure_id).single();
        if (treasure) {
          const creatorEmail = await emailFor(treasure.creator_id);
          if (creatorEmail) {
            shouldSend = true;
            emailTo = creatorEmail;
            subject = `🔔 New claim on "${treasure.title}"`;
            html = wrap(
              "New Claim Waiting on You",
              `<p style="color:#334155;font-size:15px;">Someone submitted a photo claiming to have found your treasure "${treasure.title}". Take a look and approve or reject it.</p>`,
              `${appUrl}/claims`,
              "Review Claim"
            );
          }
        }
      }

      if (type === "UPDATE" && old_record.status !== record.status && (record.status === "approved" || record.status === "rejected")) {
        const finderEmail = await emailFor(record.player_id);
        const { data: treasure } = await supabase.from("treasures").select("title").eq("id", record.treasure_id).single();
        if (finderEmail && treasure) {
          if (record.status === "approved") {
            shouldSend = true;
            emailTo = finderEmail;
            subject = `🏆 Your claim on "${treasure.title}" was approved!`;
            html = wrap(
              "Treasure Found!",
              `<p style="color:#334155;font-size:15px;">Your claim on "${treasure.title}" was approved — the points have been added to your balance.</p>`,
              `${appUrl}/profile`,
              "View Profile"
            );
          } else {
            shouldSend = true;
            emailTo = finderEmail;
            subject = `Your claim on "${treasure.title}" wasn't accepted`;
            html = wrap(
              "Claim Not Accepted",
              `<div style="background:#fef2f2;padding:14px;border-radius:8px;border-left:4px solid #ef4444;">
                 <p style="margin:0;color:#991b1b;font-size:14px;"><strong>Reason:</strong> ${record.rejection_reason ?? "See app for details"}</p>
               </div>`,
              `${appUrl}/feed`,
              "Keep Exploring",
              "#ef4444"
            );
          }
        }
      }
    }

    if (shouldSend && resendApiKey && emailTo) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Treasure Hunt <notifications@your-domain.example>", to: [emailTo], subject, html }),
      });
      if (!res.ok) throw new Error(`Resend dispatch failed: ${await res.text()}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
