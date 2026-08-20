import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v22.0";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // =========================
    // ENVIRONMENT VARIABLES
    // =========================
    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");

    const redirectUri =
      Deno.env.get("FACEBOOK_REDIRECT_URI") ||
      `${url.origin}${url.pathname}`;

    const appUrl =
      Deno.env.get("APP_URL") ||
      "https://facebook-webhook-lemon.vercel.app";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!appId || !appSecret) {
      return new Response(
        "THIẾU FACEBOOK_APP_ID HOẶC FACEBOOK_APP_SECRET.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        "THIẾU SUPABASE_URL HOẶC SUPABASE_SERVICE_ROLE_KEY.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    // =========================
    // QUERY PARAMETERS
    // =========================
    const code = url.searchParams.get("code");

    const redirect =
      url.searchParams.get("redirect") ||
      `${appUrl}/channels`;

    const ownerId =
      url.searchParams.get("state") ||
      url.searchParams.get("owner") ||
      "";

    // =========================
    // BƯỚC 1:
    // CHƯA CÓ CODE -> ĐƯA SANG FACEBOOK
    // =========================
    if (!code) {
      const scope = [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_messaging",
      ].join(",");

      const stateData = JSON.stringify({
        ownerId,
        redirect,
      });

      const state = btoa(stateData);

      const facebookUrl =
        `${GRAPH}/oauth/authorize` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${encodeURIComponent(state)}`;

      return Response.redirect(facebookUrl, 302);
    }

    // =========================
    // BƯỚC 2:
    // FACEBOOK TRẢ CODE VỀ
    // =========================
    const stateRaw = url.searchParams.get("state");

    let stateOwnerId = "";
    let stateRedirect = `${appUrl}/channels`;

    if (stateRaw) {
      try {
        const decoded = JSON.parse(atob(stateRaw));

        stateOwnerId = decoded.ownerId || "";
        stateRedirect = decoded.redirect || stateRedirect;
      } catch {
        // Nếu state cũ không phải JSON
        stateOwnerId = stateRaw;
      }
    }

    // =========================
    // BƯỚC 3:
    // ĐỔI CODE -> USER ACCESS TOKEN
    // =========================
    const tokenUrl =
      `${GRAPH}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(
        `FACEBOOK TOKEN ERROR:\n${JSON.stringify(tokenData, null, 2)}`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    const userToken = tokenData.access_token;

    // =========================
    // BƯỚC 4:
    // ĐỔI SANG LONG-LIVED TOKEN
    // =========================
    const longTokenUrl =
      `${GRAPH}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(userToken)}`;

    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json();

    const longToken =
      longTokenData.access_token || userToken;

    // =========================
    // BƯỚC 5:
    // LẤY DANH SÁCH FACEBOOK PAGE
    // =========================
    const pagesUrl =
      `${GRAPH}/me/accounts` +
      `?fields=id,name,access_token` +
      `&access_token=${encodeURIComponent(longToken)}`;

    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (!pagesRes.ok) {
      return new Response(
        `FACEBOOK PAGES ERROR:\n${JSON.stringify(
          pagesData,
          null,
          2
        )}`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    const pages = pagesData.data || [];

    // =========================
    // SUPABASE ADMIN CLIENT
    // =========================
    const admin = createClient(
      supabaseUrl,
      serviceKey
    );

    // =========================
    // BƯỚC 6:
    // LƯU TỪNG PAGE VÀO DATABASE
    // =========================
    for (const page of pages) {
      const pageId = page.id;
      const pageName = page.name || "Facebook Page";
      const pageToken = page.access_token;

      if (!pageId || !pageToken) {
        continue;
      }

      // -------------------------
      // TÌM CHANNEL ĐÃ CÓ
      // -------------------------
      const { data: existing, error: findError } =
        await admin
          .from("channels")
          .select("id")
          .eq("platform", "facebook")
          .eq("external_id", pageId)
          .maybeSingle();

      if (findError) {
        console.error("CHANNEL FIND ERROR:", findError);
        continue;
      }

      let channelId: string;

      // -------------------------
      // CHANNEL ĐÃ TỒN TẠI
      // -------------------------
      if (existing) {
        channelId = existing.id;

        const updateData: Record<string, unknown> = {
          name: pageName,
          status: "connected",
          last_sync: new Date().toISOString(),
        };

        if (stateOwnerId) {
          updateData.owner_id = stateOwnerId;
        }

        const { error: updateError } =
          await admin
            .from("channels")
            .update(updateData)
            .eq("id", channelId);

        if (updateError) {
          console.error(
            "CHANNEL UPDATE ERROR:",
            updateError
          );
        }
      }

      // -------------------------
      // CHANNEL CHƯA TỒN TẠI
      // -------------------------
      else {
        const insertData: Record<string, unknown> = {
          name: pageName,
          platform: "facebook",
          external_id: pageId,
          status: "connected",
          last_sync: new Date().toISOString(),
        };

        if (stateOwnerId) {
          insertData.owner_id = stateOwnerId;
        }

        const { data: created, error: createError } =
          await admin
            .from("channels")
            .insert(insertData)
            .select("id")
            .single();

        if (createError || !created) {
          console.error(
            "CHANNEL CREATE ERROR:",
            createError
          );
          continue;
        }

        channelId = created.id;
      }

      // =========================
      // LƯU PAGE ACCESS TOKEN
      // =========================
      const { error: credentialError } =
        await admin
          .from("channel_credentials")
          .upsert(
            {
              channel_id: channelId,
              platform: "facebook",
              token: pageToken,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "channel_id",
            }
          );

      if (credentialError) {
        console.error(
          "CREDENTIAL ERROR:",
          credentialError
        );
      }

      // =========================
      // SUBSCRIBE PAGE
      // NHẬN SỰ KIỆN MESSENGER
      // =========================
      const subscribeUrl =
        `${GRAPH}/${pageId}/subscribed_apps` +
        `?subscribed_fields=messages,messaging_postbacks,messaging_optins` +
        `&access_token=${encodeURIComponent(pageToken)}`;

      const subscribeRes = await fetch(
        subscribeUrl,
        {
          method: "POST",
        }
      );

      const subscribeData =
        await subscribeRes.json();

      console.log(
        "PAGE SUBSCRIBE:",
        pageId,
        subscribeData
      );
    }

    // =========================
    // BƯỚC 7:
    // QUAY VỀ WEBSITE
    // =========================
    return Response.redirect(
      stateRedirect,
      302
    );

  } catch (error) {
    console.error("FACEBOOK CONNECT ERROR:", error);

    return new Response(
      error instanceof Error
        ? error.message
        : "Lỗi máy chủ.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
});