// app/api/styles/[slug]/like/route.ts — toggle like (auth required)
import { NextRequest, NextResponse } from "next/server";
import { getStyleBySlug } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const style = await getStyleBySlug(slug);
    if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Toggle: if already liked, unlike; else like
    const { data: existing } = await supabase
      .from("likes")
      .select("id")
      .eq("style_id", style.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("likes").delete().eq("id", existing.id);
      return NextResponse.json({ liked: false });
    } else {
      await supabase.from("likes").insert({ style_id: style.id, user_id: user.id });
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
