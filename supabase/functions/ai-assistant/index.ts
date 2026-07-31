// AI accessibility assistant.
//
// Takes a natural-language question ("find me a wheelchair accessible
// restaurant nearby"), pulls the nearest venues (with their crowd-sourced
// accessibility summaries) out of Postgres, and asks OpenAI to recommend
// from that real data — the model is not allowed to invent venues.
//
// Deploy: supabase functions deploy ai-assistant
// Secrets required: OPENAI_API_KEY (supabase secrets set OPENAI_API_KEY=...)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface RequestBody {
  message: string;
  latitude?: number;
  longitude?: number;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Scoped client that forwards the caller's JWT, so RLS applies as that user.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { message, latitude, longitude }: RequestBody = await req.json();
    if (!message || typeof message !== "string") {
      return json({ error: "`message` is required" }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("accessibility_needs, is_premium")
      .eq("id", user.id)
      .single();

    if (!profile?.is_premium) {
      return json(
        { error: "The AI assistant is a premium feature. Upgrade to unlock it." },
        403,
      );
    }

    // Pull a candidate set of venues. For the MVP we use a simple lat/lng
    // bounding box (~25km) instead of PostGIS to keep the schema lean.
    let venueQuery = supabase
      .from("venues")
      .select("id, name, category, address, latitude, longitude")
      .limit(40);

    if (typeof latitude === "number" && typeof longitude === "number") {
      const delta = 0.25; // roughly 25km at mid latitudes
      venueQuery = venueQuery
        .gte("latitude", latitude - delta)
        .lte("latitude", latitude + delta)
        .gte("longitude", longitude - delta)
        .lte("longitude", longitude + delta);
    }

    const { data: venues, error: venueError } = await venueQuery;
    if (venueError) throw venueError;

    const venueIds = (venues ?? []).map((v) => v.id);

    // The accessibility/verification data lives in views (no FK PostgREST can
    // embed on), so fetch them separately and merge in JS.
    const [{ data: summaries }, { data: verifications }] = await Promise.all([
      supabase
        .from("venue_accessibility_summary")
        .select("*")
        .in("venue_id", venueIds),
      supabase
        .from("venue_verification_summary")
        .select("*")
        .in("venue_id", venueIds),
    ]);

    const summaryByVenue = new Map((summaries ?? []).map((s) => [s.venue_id, s]));
    const verificationByVenue = new Map(
      (verifications ?? []).map((v) => [v.venue_id, v]),
    );

    const venueContext = (venues ?? []).map((v) => {
      const summary = summaryByVenue.get(v.id);
      const verification = verificationByVenue.get(v.id);
      return {
        id: v.id,
        name: v.name,
        category: v.category,
        address: v.address,
        accessibility_score: summary?.accessibility_score ?? null,
        review_count: summary?.review_count ?? 0,
        step_free_entrance: summary?.step_free_entrance ?? null,
        ramp_available: summary?.ramp_available ?? null,
        accessible_toilet: summary?.accessible_toilet ?? null,
        accessible_parking: summary?.accessible_parking ?? null,
        noise_level: summary?.noise_level ?? null,
        lighting_level: summary?.lighting_level ?? null,
        quiet_periods_available: summary?.quiet_periods_available ?? null,
        confirmations_last_90_days: verification?.confirmations_last_90_days ?? 0,
      };
    });

    const systemPrompt = `You are the AccessMap accessibility assistant. You help people with
disabilities decide whether a venue will work for them, using ONLY the venue data
provided below (a JSON array). Never invent venues or accessibility facts that
aren't in the data. If the data doesn't cover something (a field is null), say
it hasn't been reported yet rather than guessing.

The user's stated accessibility needs: ${
      profile.accessibility_needs?.length
        ? profile.accessibility_needs.join(", ")
        : "none specified"
    }.

When recommending a venue, briefly explain WHY it fits the user's needs based on
the data (e.g. step-free entrance, quiet periods, accessible toilet). If nothing
in the data is a good fit, say so honestly and suggest what to double check by
phone. Keep replies concise and practical.

Venue data:
${JSON.stringify(venueContext)}`;

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const completionJson = await completion.json();
    const reply = completionJson.choices?.[0]?.message?.content?.trim() ??
      "Sorry, I couldn't come up with a recommendation just now.";

    await supabase.from("ai_messages").insert([
      { user_id: user.id, role: "user", content: message },
      { user_id: user.id, role: "assistant", content: reply },
    ]);

    return json({ reply, venues: venueContext });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
