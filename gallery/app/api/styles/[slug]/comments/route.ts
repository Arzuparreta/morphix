// app/api/styles/[slug]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStyleBySlug, getComments } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const style = await getStyleBySlug(slug);
    if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const comments = await getComments(style.id);
    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const style = await getStyleBySlug(slug);
    if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { body, parent_id } = await request.json();
    if (!body?.trim()) return NextResponse.json({ error: "Comment body required" }, { status: 400 });

    const { data, error } = await supabase
      .from("comments")
      .insert({ style_id: style.id, user_id: user.id, body: body.trim(), parent_id: parent_id || null })
      .select("*, author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)")
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
