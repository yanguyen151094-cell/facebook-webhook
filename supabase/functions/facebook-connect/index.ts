import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    // =========================
    // FACEBOOK CONFIG
    // =========================

    const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
    const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");

    const REDIRECT_URI =
      "https://defffgyrdexydrfnura.supabase.co/functions/v1/facebook-connect";

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      throw new Error(
        "Thiếu FACEBOOK_APP_ID hoặc FACEBOOK_APP_SECRET trong Supabase Secrets."
      );
    }

    // =========================
    // 1. FACEBOOK CALLBACK
    // =========================

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error,
          error_description: errorDescription,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =========================
    // 2. CHƯA CÓ CODE
    // => CHUYỂN SANG FACEBOOK
    // =========================

    if (!code) {
      const facebookOAuthUrl = new URL(
        "https://www.facebook.com/v22.0/dialog/oauth"
      );

      facebookOAuthUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
      facebookOAuthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      facebookOAuthUrl.searchParams.set("response_type", "code");

      // CHỈ DÙNG QUYỀN CƠ BẢN TRƯỚC
      // để kiểm tra OAuth hoạt động.
      facebookOAuthUrl.searchParams.set(
        "scope",
        "public_profile,email"
      );

      return Response.redirect(facebookOAuthUrl.toString(), 302);
    }

    // =========================
    // 3. ĐỔI CODE LẤY USER ACCESS TOKEN
    // =========================

    const tokenUrl = new URL(
      "https://graph.facebook.com/v22.0/oauth/access_token"
    );

    tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "get_access_token",
          data: tokenData,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const accessToken = tokenData.access_token;

    // =========================
    // 4. LẤY THÔNG TIN USER
    // =========================

    const meUrl = new URL(
      "https://graph.facebook.com/v22.0/me"
    );

    meUrl.searchParams.set("fields", "id,name,email");
    meUrl.searchParams.set("access_token", accessToken);

    const meResponse = await fetch(meUrl.toString());
    const meData = await meResponse.json();

    if (!meResponse.ok || meData.error) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "get_user",
          data: meData,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =========================
    // 5. TRẢ KẾT QUẢ
    // =========================

    return new Response(
      JSON.stringify({
        success: true,
        message: "Facebook OAuth thành công.",
        user: meData,
        access_token: accessToken,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});