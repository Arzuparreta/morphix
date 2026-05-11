// app/api/styles/[slug]/rate/route.ts — rate a style (auth required)
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const style = await getStyleBySlug(slug);
    if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { score } = await request.json();
    if (typeof score !== "number" || score < 1 || score > 5) {
      return NextResponse.json({ error: "Score must be 1-5" }, { status: 400 });
    }

    // Upsert: insert or update existing rating
    const { error } = await supabase.from("ratings").upsert(
      { style_id: style.id, user_id: user.id, score },
      { onConflict: "style_id,user_id" },
    );
    if (error) throw error;

    return NextResponse.json({ score });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
