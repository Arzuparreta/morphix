// app/api/styles/[slug]/install/route.ts — record install
import { NextRequest, NextResponse } from "next/server";
import { getStyleBySlug } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const style = await getStyleBySlug(slug);
    if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { source } = (await request.json().catch(() => ({}))) || {};

    await supabase.from("installs").insert({
      style_id: style.id,
      user_id: user?.id ?? null,
      source: source || "gallery_web",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
