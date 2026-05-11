-- supabase/migrations/001_schema.sql
-- Morphix Gallery — full database schema
-- Run this in the Supabase SQL Editor after creating your project.

-- ── Extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram for full-text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid fallback

-- ── Profiles (extends auth.users) ─────────────────────
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  display_name text,
  bio         text,
  avatar_url  text,
  website     text,
  github_url  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Styles ────────────────────────────────────────────
CREATE TABLE public.styles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  description     text,
  url_pattern     jsonb NOT NULL,          -- { type, value }
  morphix_file    jsonb NOT NULL,          -- full .morphix JSON payload
  tags            text[] DEFAULT '{}',
  screenshot_urls text[] DEFAULT '{}',
  installs_count  integer DEFAULT 0,
  likes_count     integer DEFAULT 0,
  comments_count  integer DEFAULT 0,
  avg_rating      numeric(2,1) DEFAULT 0,
  ratings_count   integer DEFAULT 0,
  is_published    boolean DEFAULT true,
  is_featured     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Ratings (1-5, one per user per style)
CREATE TABLE public.ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score       integer NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(style_id, user_id)
);

-- Recalculate style avg_rating / ratings_count on insert/update/delete
CREATE OR REPLACE FUNCTION public.update_style_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.styles
  SET avg_rating   = COALESCE((SELECT round(avg(score), 1) FROM public.ratings WHERE style_id = COALESCE(NEW.style_id, OLD.style_id)), 0),
      ratings_count = (SELECT count(*) FROM public.ratings WHERE style_id = COALESCE(NEW.style_id, OLD.style_id)),
      updated_at    = now()
  WHERE id = COALESCE(NEW.style_id, OLD.style_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_rating_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_style_rating();

-- Likes (independent from ratings)
CREATE TABLE public.likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(style_id, user_id)
);

CREATE OR REPLACE FUNCTION public.update_style_likes()
RETURNS trigger AS $$
BEGIN
  UPDATE public.styles
  SET likes_count = (SELECT count(*) FROM public.likes WHERE style_id = COALESCE(NEW.style_id, OLD.style_id)),
      updated_at  = now()
  WHERE id = COALESCE(NEW.style_id, OLD.style_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_like_changed
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_style_likes();

-- Comments (threaded)
CREATE TABLE public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  parent_id   uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_style_comments()
RETURNS trigger AS $$
BEGIN
  UPDATE public.styles
  SET comments_count = (SELECT count(*) FROM public.comments WHERE style_id = COALESCE(NEW.style_id, OLD.style_id)),
      updated_at     = now()
  WHERE id = COALESCE(NEW.style_id, OLD.style_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_comment_changed
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_style_comments();

-- Installs (for analytics)
CREATE TABLE public.installs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid,   -- nullable: anonymous installs
  source      text,   -- 'gallery_web', 'extension_upload', 'file_import'
  created_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_style_installs()
RETURNS trigger AS $$
BEGIN
  UPDATE public.styles
  SET installs_count = (SELECT count(*) FROM public.installs WHERE style_id = NEW.style_id),
      updated_at     = now()
  WHERE id = NEW.style_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_install_inserted
  AFTER INSERT ON public.installs
  FOR EACH ROW EXECUTE FUNCTION public.update_style_installs();

-- Collections (user-curated groups)
CREATE TABLE public.collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_public   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE public.collection_styles (
  collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  style_id      uuid REFERENCES public.styles(id) ON DELETE CASCADE,
  added_at      timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, style_id)
);

-- Tags (normalized for search)
CREATE TABLE public.tags (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text UNIQUE NOT NULL,
  slug  text UNIQUE NOT NULL,
  usage_count integer DEFAULT 0
);

CREATE TABLE public.style_tags (
  style_id uuid REFERENCES public.styles(id) ON DELETE CASCADE,
  tag_id   uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (style_id, tag_id)
);

-- ── Indexes ────────────────────────────────────────────
CREATE INDEX idx_styles_author    ON public.styles(author_id);
CREATE INDEX idx_styles_created   ON public.styles(created_at DESC);
CREATE INDEX idx_styles_installs  ON public.styles(installs_count DESC);
CREATE INDEX idx_styles_rating    ON public.styles(avg_rating DESC);
CREATE INDEX idx_styles_published ON public.styles(is_published) WHERE is_published = true;

-- Trigram indexes for full-text search
CREATE INDEX idx_styles_name_trgm        ON public.styles USING gin (name gin_trgm_ops);
CREATE INDEX idx_styles_description_trgm ON public.styles USING gin (description gin_trgm_ops);

-- Ratings / likes lookups
CREATE INDEX idx_ratings_style ON public.ratings(style_id);
CREATE INDEX idx_ratings_user  ON public.ratings(user_id);
CREATE INDEX idx_likes_style   ON public.likes(style_id);
CREATE INDEX idx_likes_user    ON public.likes(user_id);

-- Comments
CREATE INDEX idx_comments_style  ON public.comments(style_id, created_at);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

-- Tags
CREATE INDEX idx_tags_slug     ON public.tags(slug);
CREATE INDEX idx_style_tags    ON public.style_tags(tag_id);
CREATE INDEX idx_styles_tags    ON public.styles USING gin (tags);

-- Installs
CREATE INDEX idx_installs_style ON public.installs(style_id);

-- Collections
CREATE INDEX idx_coll_user   ON public.collections(user_id);
CREATE INDEX idx_coll_styles ON public.collection_styles(style_id);

-- ── RLS Policies ──────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_styles ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner write
CREATE POLICY profiles_read  ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_write ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Styles: anyone can read published, author can manage
CREATE POLICY styles_read   ON public.styles FOR SELECT USING (is_published = true);
CREATE POLICY styles_manage ON public.styles FOR ALL    USING (auth.uid() = author_id);

-- Ratings: anyone read, authenticated can create own, author can delete own
CREATE POLICY ratings_read   ON public.ratings FOR SELECT USING (true);
CREATE POLICY ratings_insert ON public.ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ratings_delete ON public.ratings FOR DELETE USING (auth.uid() = user_id);

-- Likes: anyone read, authenticated can insert/delete own
CREATE POLICY likes_read   ON public.likes FOR SELECT USING (true);
CREATE POLICY likes_insert ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY likes_delete ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: anyone read, authenticated can create, owner can update/delete
CREATE POLICY comments_read   ON public.comments FOR SELECT USING (true);
CREATE POLICY comments_insert ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY comments_manage ON public.comments FOR ALL USING (auth.uid() = user_id);

-- Installs: anyone can insert, anyone can read
CREATE POLICY installs_read   ON public.installs FOR SELECT USING (true);
CREATE POLICY installs_insert ON public.installs FOR INSERT WITH CHECK (true);

-- Collections: owner can manage, anyone can read public
CREATE POLICY collections_read   ON public.collections FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY collections_manage ON public.collections FOR ALL    USING (auth.uid() = user_id);

-- Collection_styles: cascades from collections RLS
CREATE POLICY cs_read   ON public.collection_styles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND (c.is_public OR c.user_id = auth.uid()))
);
CREATE POLICY cs_manage ON public.collection_styles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);

-- ── Functions ─────────────────────────────────────────
-- Generate a unique slug from a name
CREATE OR REPLACE FUNCTION public.generate_slug(name text)
RETURNS text AS $$
DECLARE
  base text;
  slug text;
  counter integer := 0;
BEGIN
  base := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  slug := base;
  LOOP
    BEGIN
      RETURN slug;
    EXCEPTION WHEN unique_violation THEN
      counter := counter + 1;
      slug := base || '-' || counter::text;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Full-text search across styles
CREATE OR REPLACE FUNCTION public.search_styles(
  query_text text,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, author_id uuid, name text, slug text, description text,
  url_pattern jsonb, tags text[], screenshot_urls text[],
  installs_count integer, likes_count integer, comments_count integer,
  avg_rating numeric, ratings_count integer,
  is_published boolean, is_featured boolean,
  created_at timestamptz, updated_at timestamptz,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.author_id, s.name, s.slug, s.description,
    s.url_pattern, s.tags, s.screenshot_urls,
    s.installs_count, s.likes_count, s.comments_count,
    s.avg_rating, s.ratings_count,
    s.is_published, s.is_featured,
    s.created_at, s.updated_at,
    similarity(s.name, query_text) + similarity(COALESCE(s.description, ''), query_text) AS rank
  FROM public.styles s
  WHERE s.is_published = true
    AND (
      s.name % query_text
      OR COALESCE(s.description, '') % query_text
      OR EXISTS (SELECT 1 FROM unnest(s.tags) t WHERE t % query_text)
    )
  ORDER BY rank DESC, s.installs_count DESC
  LIMIT result_limit OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Storage buckets ───────────────────────────────────
-- Note: buckets must be created via the Supabase dashboard or API.
-- After running this SQL, go to Storage in the Supabase dashboard and create:
--   1. bucket "screenshots" (public read)
--   2. bucket "avatars"      (public read)
