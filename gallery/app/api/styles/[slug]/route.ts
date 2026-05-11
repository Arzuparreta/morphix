// app/api/styles/[slug]/route.ts — single style detail
import { NextRequest, NextResponse } from "next/server";
import { getStyleBySlug } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const style = await getStyleBySlug(slug);
    if (!style) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Attach user-specific state if logged in
    let user_rating = null;
    let user_liked = false;
    if (user) {
      const [{ data: rating }, { data: like }] = await Promise.all([
        supabase.from("ratings").select("score").eq("style_id", style.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("likes").select("id").eq("style_id", style.id).eq("user_id", user.id).maybeSingle(),
      ]);
      user_rating = rating?.score ?? null;
      user_liked = !!like;
    }

    return NextResponse.json({ ...style, user_rating, user_liked });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
