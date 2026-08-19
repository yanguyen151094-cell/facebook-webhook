import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v20.0";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirect = url.searchParams.get("redirect") || "/channels";
    // Người bấm nút kết nối (owner). Qua state để vòng OAuth trả về đúng.
    const ownerId = url.searchParams.get("state") || url.searchParams.get("owner") || null;
    const funcUrl = `${url.origin}${url.pathname}`;

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");

    if (!appId || !appSecret) {
      return new Response(
        "Chưa cấu hình FACEBOOK_APP_ID / FACEBOOK_APP_SECRET trong Supabase Secrets.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const callbackUrl = `${funcUrl}?redirect=${encodeURIComponent(redirect)}`;

    if (!code) {
      const scope = "pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement";
      const stateParam = ownerId ? `&state=${encodeURIComponent(ownerId)}` : "";
      const fbUrl = `${GRAPH}/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&response_type=code${stateParam}`;
      return Response.redirect(fbUrl, 302);
    }

    // Exchange code for a short-lived user token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    const userToken = tokenData.access_token;
    if (!userToken) {
      return new Response(
        `Không lấy được token: ${JSON.stringify(tokenData)}`,
        { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // Exchange for long-lived user token
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
    );
    const longData = await longRes.json();
    const longToken = longData.access_token || userToken;

    // Fetch pages
    const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    for (const page of pages) {
      const pageId = page.id as string;
      const pageName = page.name as string;
      const pageToken = page.access_token as string;

      const { data: existing } = await admin
        .from("channels")
        .select("id")
        .eq("platform", "facebook")
        .eq("external_id", pageId)
        .maybeSingle();

      let channelId: string;
      if (existing) {
        channelId = existing.id;
        const upd: Record<string, unknown> = {
          name: pageName,
          status: "connected",
          last_sync: new Date().toISOString(),
        };
        if (ownerId) upd.owner_id = ownerId;
        await admin.from("channels").update(upd).eq("id", channelId);
      } else {
        const ins: Record<string, unknown> = {
          name: pageName,
          platform: "facebook",
          external_id: pageId,
          status: "connected",
          last_sync: new Date().toISOString(),
        };
        if (ownerId) ins.owner_id = ownerId;
        const { data: created, error: cErr } = await admin
          .from("channels")
          .insert(ins)
          .select("id")
          .single();
        if (cErr || !created) continue;
        channelId = created.id;
      }

      await admin.from("channel_credentials").upsert(
        {
          channel_id: channelId,
          platform: "facebook",
          token: pageToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel_id" }
      );

      // Subscribe the app to the page for Messenger events
      await fetch(
        `${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins&access_token=${pageToken}`,
        { method: "POST" }
      );
    }

    return Response.redirect(redirect, 302);
  } catch (e) {
    return new Response(
      e instanceof Error ? e.message : "Lỗi máy chủ.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
});