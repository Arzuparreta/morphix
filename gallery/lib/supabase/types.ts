// lib/supabase/types.ts — database row types matching our schema

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  github_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UrlPattern {
  type: "exact" | "domain" | "regex" | "library";
  value: string;
}

export interface Style {
  id: string;
  author_id: string;
  name: string;
  slug: string;
  description: string | null;
  url_pattern: UrlPattern;
  morphix_file: Record<string, unknown>;
  tags: string[];
  screenshot_urls: string[];
  installs_count: number;
  likes_count: number;
  comments_count: number;
  avg_rating: number;
  ratings_count: number;
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface StyleWithAuthor extends Style {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  user_rating?: number | null;
  user_liked?: boolean;
}

export interface Rating {
  id: string;
  style_id: string;
  user_id: string;
  score: number;
  created_at: string;
}

export interface Comment {
  id: string;
  style_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  replies?: CommentWithAuthor[];
}

export type StyleSort = "trending" | "newest" | "top_rated" | "most_installed";
