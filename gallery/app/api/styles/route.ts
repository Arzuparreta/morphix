// app/api/styles/route.ts — list all styles
import { NextRequest, NextResponse } from "next/server";
import { getStyles } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const styles = await getStyles({
      sort: (searchParams.get("sort") as "trending" | "newest" | "top_rated" | "most_installed") || "trending",
      tags: searchParams.get("tags")?.split(",").filter(Boolean),
      site: searchParams.get("site") || undefined,
      author: searchParams.get("author") || undefined,
      q: searchParams.get("q") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: Math.min(parseInt(searchParams.get("limit") || "20", 10), 50),
    });
    return NextResponse.json({ styles });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
