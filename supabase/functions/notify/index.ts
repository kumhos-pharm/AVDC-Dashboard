/**
 * Supabase Edge Function: notify
 * ส่งแจ้งเตือนเข้า LINE และ Telegram
 *
 * Environment Variables ที่ต้องตั้งใน Supabase Dashboard:
 *   LINE_CHANNEL_ACCESS_TOKEN  - Token จาก LINE Developers Console
 *   LINE_GROUP_ID              - Group ID ของกลุ่ม LINE
 *   TELEGRAM_BOT_TOKEN         - Token จาก @BotFather
 *   TELEGRAM_CHAT_ID           - Chat ID ของกลุ่ม Telegram
 *
 * วิธีตั้งค่า:
 *   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxx
 *   supabase secrets set LINE_GROUP_ID=xxx
 *   supabase secrets set TELEGRAM_BOT_TOKEN=xxx
 *   supabase secrets set TELEGRAM_CHAT_ID=xxx
 *
 * วิธี deploy:
 *   supabase functions deploy notify
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // รองรับ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const message: string = body.message;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.allSettled([
      sendLine(message),
      sendTelegram(message),
    ]);

    const lineResult     = results[0];
    const telegramResult = results[1];

    return new Response(
      JSON.stringify({
        success: true,
        line:     lineResult.status     === "fulfilled" ? lineResult.value     : { error: (lineResult as PromiseRejectedResult).reason },
        telegram: telegramResult.status === "fulfilled" ? telegramResult.value : { error: (telegramResult as PromiseRejectedResult).reason },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// -------------------------------------------------------
// ส่งแจ้งเตือน LINE
// -------------------------------------------------------
async function sendLine(message: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const token   = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  const groupId = Deno.env.get("LINE_GROUP_ID") || "";

  if (!token || !groupId) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID ยังไม่ได้ตั้งค่า" };
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (res.ok) {
    return { success: true, status: res.status };
  }

  const errorBody = await res.text();
  return { success: false, status: res.status, error: errorBody };
}

// -------------------------------------------------------
// ส่งแจ้งเตือน Telegram
// -------------------------------------------------------
async function sendTelegram(message: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const token  = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") || "";

  if (!token || !chatId) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID ยังไม่ได้ตั้งค่า" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  if (res.ok) {
    return { success: true, status: res.status };
  }

  const errorBody = await res.text();
  return { success: false, status: res.status, error: errorBody };
}
