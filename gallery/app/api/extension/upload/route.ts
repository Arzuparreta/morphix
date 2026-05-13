// app/api/extension/upload/route.ts — upload style from browser extension
import { NextRequest, NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRequestClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { morphix_json, tags } = await request.json();
    if (!morphix_json?.style) {
      return NextResponse.json({ error: "Invalid morphix data" }, { status: 400 });
    }

    const style = morphix_json.style;
    const slug = await generateUniqueSlug(supabase, style.name);

    // Upload screenshots to Supabase Storage if provided (base64 → binary)
    const screenshotUrls: string[] = [];
    if (Array.isArray(morphix_json.screenshots)) {
      for (let i = 0; i < morphix_json.screenshots.length; i++) {
        const base64 = morphix_json.screenshots[i];
        if (base64?.startsWith("data:image/")) {
          const [, mimeType, data] = base64.match(/^data:(image\/\w+);base64,(.+)$/) || [];
          if (data) {
            const buffer = Buffer.from(data, "base64");
            const ext = mimeType.split("/")[1] || "png";
            const path = `${user.id}/${slug}/${i}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from("screenshots")
              .upload(path, buffer, { contentType: mimeType, upsert: true });
            if (!uploadErr) {
              const { data: pub } = supabase.storage.from("screenshots").getPublicUrl(path);
              screenshotUrls.push(pub.publicUrl);
            }
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("styles")
      .insert({
        author_id: user.id,
        name: style.name,
        slug,
        description: style.description || "",
        url_pattern: style.url_pattern,
        morphix_file: morphix_json,
        tags: tags || [],
        screenshot_urls: screenshotUrls,
      })
      .select("id, slug")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { style_id: data.id, slug: data.slug, url: `/styles/${data.slug}` },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────

async function createRequestClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return createCookieClient();

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function generateUniqueSlug(supabase: Awaited<ReturnType<typeof createRequestClient>>, name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "style";
  let slug = base;
  let counter = 1;
  while (true) {
    const { data } = await supabase.from("styles").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${counter++}`;
  }
}
