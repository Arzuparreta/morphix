// lib/supabase/queries.ts — all database queries for the gallery
import { createClient } from "@/lib/supabase/server";
import type {
  StyleWithAuthor,
  StyleSort,
  CommentWithAuthor,
  Profile,
  UrlPattern,
} from "@/lib/supabase/types";

// ── Styles ────────────────────────────────────────────

interface StyleFilters {
  sort?: StyleSort;
  tags?: string[];
  site?: string;
  author?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function getStyles(filters: StyleFilters = {}) {
  const supabase = await createClient();
  const { sort = "trending", tags, site, author, q, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  // If search query, use full-text search function
  if (q && q.trim()) {
    const { data, error } = await supabase.rpc("search_styles", {
      query_text: q.trim(),
      result_limit: limit,
      result_offset: offset,
    });
    if (error) throw error;
    return attachAuthors(supabase, data || []);
  }

  let query = supabase
    .from("styles")
    .select("*, author:profiles!styles_author_id_fkey(id, username, display_name, avatar_url)")
    .eq("is_published", true);

  if (tags?.length) {
    query = query.overlaps("tags", tags);
  }
  if (site) {
    query = query.contains("url_pattern", { value: site } as Partial<UrlPattern>);
  }
  if (author) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", author)
      .single();
    if (profile) query = query.eq("author_id", profile.id);
  }

  switch (sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "top_rated":
      query = query.order("avg_rating", { ascending: false });
      break;
    case "most_installed":
      query = query.order("installs_count", { ascending: false });
      break;
    default: // trending: mix of recent and popular
      query = query.order("installs_count", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as StyleWithAuthor[];
}

export async function getStyleBySlug(slug: string): Promise<StyleWithAuthor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("styles")
    .select("*, author:profiles!styles_author_id_fkey(id, username, display_name, avatar_url)")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as unknown as StyleWithAuthor;
}

export async function getStyleById(id: string): Promise<StyleWithAuthor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("styles")
    .select("*, author:profiles!styles_author_id_fkey(id, username, display_name, avatar_url)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as StyleWithAuthor;
}

// ── Ratings & Likes (server context uses anon key — for reads) ──

export async function getRating(styleId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ratings")
    .select("score")
    .eq("style_id", styleId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.score ?? null;
}

export async function getLike(styleId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("style_id", styleId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

// ── Comments ──────────────────────────────────────────

export async function getComments(styleId: string): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*, author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)")
    .eq("style_id", styleId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Thread replies under their parent
  const roots: CommentWithAuthor[] = [];
  const replies = new Map<string, CommentWithAuthor[]>();
  for (const c of data || []) {
    const comment = c as unknown as CommentWithAuthor;
    if (!comment.parent_id) {
      roots.push(comment);
    } else {
      const arr = replies.get(comment.parent_id) || [];
      arr.push(comment);
      replies.set(comment.parent_id, arr);
    }
  }
  for (const root of roots) {
    root.replies = replies.get(root.id) || [];
  }
  return roots;
}

// ── Profiles ──────────────────────────────────────────

export async function getProfile(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (error) return null;
  return data;
}

export async function getProfileStyles(username: string): Promise<StyleWithAuthor[]> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("styles")
    .select("*, author:profiles!styles_author_id_fkey(id, username, display_name, avatar_url)")
    .eq("author_id", profile.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as StyleWithAuthor[];
}

// ── Tags ──────────────────────────────────────────────

export async function getPopularTags(limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("*")
    .order("usage_count", { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Helpers ───────────────────────────────────────────

async function attachAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  styles: Record<string, unknown>[],
): Promise<StyleWithAuthor[]> {
  if (!styles.length) return [];
  const authorIds = [...new Set(styles.map((s) => s.author_id as string))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  return styles.map((s) => ({
    ...s,
    author: profileMap.get(s.author_id as string) || {
      id: s.author_id,
      username: "unknown",
      display_name: "Unknown",
      avatar_url: null,
    },
  })) as unknown as StyleWithAuthor[];
}
