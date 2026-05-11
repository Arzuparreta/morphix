// app/api/styles/[slug]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStyleBySlug } from "@/lib/supabase/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const style = await getStyleBySlug(slug);
    if (!style) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(style.morphix_file, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${style.slug}.morphix"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
