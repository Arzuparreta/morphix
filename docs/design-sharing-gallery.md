# Morphix: Sharing & Community Gallery — Design Document

**Date:** 2026-05-11
**Status:** Approved — ready for Phase 1 implementation
**Author:** Arzuparreta + gstack design session

---

## 1. Executive Summary

Morphix currently works as a solo tool: you style sites for yourself. This plan adds a social layer — export/import of style packages and a community gallery web portal. The goal is to make Morphix sticky through community, discoverable through shared styles, and monetizable through premium convenience features without ever paywalling the core sharing experience.

**What ships:**
1. A `.morphix` file format for portable, full-fidelity style sharing
2. One-click Export and Import inside the extension
3. A web gallery at `morphix.styles` (or similar) — browse, discover, vote, install
4. Extension-to-gallery upload flow with automatic screenshots
5. Gallery-to-extension install flow (click "Install" on web → opens extension → imports style)

**What stays free forever:** Export, import, gallery upload, gallery browsing, voting, installing from gallery.

**What can be monetized later:** Cloud style sync across devices, style usage analytics, AI-powered style recommendations, team/collaboration features.

---

## 2. Competitive Landscape

### 2.1 Who's already here

| Product | Strengths | Weaknesses |
|---------|-----------|------------|
| **Userstyles.org** (Stylish) | 500k+ styles, established since 2005, massive library | Sold to analytics company (privacy disaster), UI from 2010, heavy ad/tracking bloat, gaming/anime focused |
| **Stylus** (openstyles) | FOSS, no tracking, 6.6k GitHub stars, UserCSS standard | No central gallery — relies on external sites, no AI generation, extension-only |
| **Userstyles.world** | Modern alternative to USO | Smaller library, anti-bot protection blocks automation |
| **Greasyfork** | Large userscript library, some style overlap | Not style-focused, utilitarian design |

### 2.2 The gap Morphix fills

Nobody in this space has:
- **AI-generated styles** — all competitors are manual CSS
- **Visual-first browsing** — screenshots of the styled page as the primary browsing UX
- **Extension-integrated one-click install** — no copy-pasting CSS
- **Modern design language** — dark mode, card grids, Dribbble-like visual gallery
- **Full version history** — Morphix styles carry conversation logs and version trees

### 2.3 Design inspirations

- **Browsing UX:** Dribbble (card grid, hover previews, collections)
- **Detail pages:** VS Code Marketplace (screenshots carousel, stats, install button)
- **Author profiles:** GitHub profile (contribution graph, style showcase)
- **Dark mode:** Linear.app (deep dark backgrounds with vibrant accent colors)

---

## 3. The `.morphix` File Format

### 3.1 Specification (v1)

```json
{
  "format_version": 1,
  "type": "morphix_style",
  "style": {
    "name": "YouTube Dark Mode",
    "description": "A clean dark theme for YouTube that reduces eye strain",
    "url_pattern": {
      "type": "domain",
      "value": "youtube.com"
    },
    "active_version": {
      "css": "body { background: #0f0f0f; ... }",
      "js": "/* optional */",
      "prompt": "Make YouTube dark mode with amber accents",
      "description": "Applied dark theme with amber accent colors to YouTube"
    },
    "versions": [
      {
        "id": "version_abc123",
        "css": "...",
        "js": "",
        "prompt": "...",
        "description": "...",
        "parent_version_id": null,
        "created_at": "2026-05-11T12:00:00Z"
      }
    ],
    "conversation": [
      {
        "role": "user",
        "content": "Make YouTube dark mode",
        "version_id": "version_abc123",
        "created_at": "2026-05-11T12:00:00Z"
      },
      {
        "role": "assistant",
        "content": "Applied dark theme to YouTube",
        "version_id": "version_abc123",
        "created_at": "2026-05-11T12:00:05Z"
      }
    ]
  },
  "author": {
    "name": "Arzuparreta",
    "gallery_id": "user_xyz789",
    "url": "https://morphix.styles/arzuparreta"
  },
  "gallery": {
    "style_id": "style_123",
    "url": "https://morphix.styles/styles/youtube-dark-mode",
    "tags": ["dark", "youtube", "minimal"],
    "screenshots": ["https://cdn.morphix.styles/screenshots/abc.png"]
  },
  "exported_at": "2026-05-11T14:00:00Z"
}
```

### 3.2 Design decisions

- **`format_version`** for forward compatibility. v2 might add compressed CSS, embedded fonts, etc.
- **Full `versions[]` array** — the entire edit history travels with the file. Imported styles become full projects.
- **`conversation` included** — the AI prompt history is preserved. If the user refines the style later with Morphix, the AI sees the original conversation context.
- **`.morphix` extension** — registered MIME type `application/x-morphix+json` for OS association.
- **`author.gallery_id` optional** — a file shared offline may lack gallery attribution.
- **`gallery` block optional** — only present when exported from the gallery or uploaded.

### 3.3 What's NOT in the file

- **Screenshots** (images embedded as base64) — files stay under 500KB. Screenshots are fetched from the gallery CDN or generated locally on import.
- **Provider credentials** — never exported. The user's AI provider configuration stays private.
- **Browser-specific metadata** — the format is browser-agnostic.

---

## 4. Extension Changes

### 4.1 Export Flow

```
User clicks "Export" on a style in the popup/options page
  → Extension reads full project from storage
  → Strips provider credentials
  → Serializes to .morphix JSON
  → Triggers browser download (chrome.downloads API)
  → File saved as "{style-name}.morphix"
```

**New UI elements:**
- Export button (icon: download arrow) in style card actions
- Export button in style detail view (options page)
- Optional: "Include screenshots" checkbox (adds ~200KB)

### 4.2 Import Flow

```
User clicks "Import" button (new toolbar button or menu item)
  → File picker opens (accept=".morphix,.json")
  → Extension validates format_version
  → If valid: shows preview card (name, description, target site, version count)
  → User clicks "Import Style"
  → Extension creates project in storage.sync (or storage.local for session)
  → Style appears in library, ready to enable
  → User navigates to matching site → style auto-applies
```

**Edge cases handled:**
- Duplicate import (same style ID already exists) → offer "Replace" or "Import as copy"
- Different format version → show "This file was created with a newer version of Morphix"
- Invalid/corrupt file → "This doesn't look like a Morphix style file"
- URL pattern conflicts → allow import, let user manage priority

### 4.3 Gallery Upload Flow

```
User clicks "Share to Gallery" on a style
  → If not authenticated: opens gallery login/signup in a popup
  → Extension captures screenshot of the styled page (chrome.tabs.captureVisibleTab)
  → Extension sends POST to gallery API:
      - .morphix file (JSON body)
      - Screenshot (base64 → Supabase Storage)
      - Tags (user-provided, optional)
  → Gallery returns { style_id, url }
  → Extension shows "Shared! View on gallery" link
  → Style now has gallery metadata stored in extension
```

**Screenshot capture strategy:**
1. If user is on the target site with style active → capture that tab
2. If user is on a different page → offer to navigate to target site, apply style, then capture
3. Screenshot is viewport-only (no browser chrome), 1280x720 PNG

### 4.4 Gallery Install Flow

```
User browses gallery website, clicks "Install" on a style
  → If extension not installed: redirects to Chrome Web Store
  → If extension installed but gallery not connected: opens extension, prompts auth
  → If extension installed + connected: sends message to extension
  → Extension downloads .morphix from gallery API
  → Extension imports style (same as file import)
  → Extension shows toast: "Style installed! Visit {site} to see it."
```

**Protocol handler:** Register `web+restyle://install/{style_id}` as a custom protocol so gallery links can deep-link into the extension.

### 4.5 New Extension UI Components

**In the popup:**
- Export button on active style preview
- "Gallery" tab or link to gallery website
- Notification badge when new styles are available for current site

**In the options (style library):**
- Import button (prominent, header area)
- Export button per style card
- Share to Gallery button per style card
- Gallery status indicator (green dot = published, gray = local only)

**New toolbar button (optional):**
- Quick-access Import (always visible even when not on a styled page)

---

## 5. Gallery Web Application

### 5.1 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **Next.js 14** (App Router) | SSR for SEO, static generation for style pages, API routes for proxy |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast development, beautiful defaults, dark mode built-in |
| Backend | **Supabase** | PostgreSQL, Auth, Storage, Realtime, Edge Functions |
| Hosting | **Vercel** (free tier) | Zero-config Next.js deployment, 100GB bandwidth |
| Domain | **Vercel free subdomain** (project-name.vercel.app) | $0 until revenue justifies a custom domain |
| Analytics | **Plausible** (self-hosted or free tier) | Privacy-friendly, no cookie banners needed |

**Total monthly cost: $0** (until Supabase free tier limits are exceeded: 50k users, 500MB DB, 1GB storage, 2GB bandwidth)

### 5.2 Site Architecture

```
morphix.styles/
├── /                          Homepage — hero, trending styles, categories
├── /explore                   Browse all styles (infinite scroll, filters)
├── /styles/[slug]             Style detail page (screenshots, install, comments)
├── /styles/[slug]/versions    Version history tree view
├── /[username]                Author profile (bio, styles, stats)
├── /[username]/collections    Author's curated collections
├── /search?q=dark+youtube     Full-text search
├── /tags/[tag]                Styles by tag (e.g. /tags/dark)
├── /login                     Auth page
├── /upload                    Upload page (for manual web uploads)
├── /settings                  User settings (profile, connected extensions)
└── /api/...                   API routes (proxy to Supabase, extension callbacks)
```

### 5.3 Key Pages — UX Sketch

#### Homepage
```
┌─────────────────────────────────────────────────┐
│  [Logo] Morphix Styles    Explore  Upload  [Login] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │       ✨ Style the web together          │    │
│  │  Discover AI-crafted styles, share yours │    │
│  │  [Browse Styles] [Get the Extension]     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Trending this week                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │  🖼  │ │  🖼  │ │  🖼  │ │  🖼  │          │
│  │YouTube│ │Reddit│ │Gmail │ │GitHub│          │
│  │Dark   │ │Clean │ │Minim │ │Mono  │          │
│  │  ⭐4.8│ │  ⭐4.6│ │  ⭐4.9│ │  ⭐4.5│          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                 │
│  Popular sites                                  │
│  [YouTube] [Reddit] [GitHub] [Twitter] ...      │
│                                                 │
│  New & noteworthy                               │
│  (card grid, 3 columns)                         │
│                                                 │
│  Top creators                                   │
│  (avatar row with style counts)                 │
└─────────────────────────────────────────────────┘
```

#### Style Detail Page
```
┌─────────────────────────────────────────────────┐
│  ← Back    YouTube Dark Mode    ⭐ 4.8 (234)     │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────┐          │
│  │                                   │          │
│  │     Screenshot carousel           │          │
│  │     ← 1/3 →                      │          │
│  │                                   │          │
│  └───────────────────────────────────┘          │
│                                                 │
│  [Install with Morphix]  [Download .morphix]     │
│  ❤ 1.2k  💬 45  🔗 Share                       │
│                                                 │
│  By Arzuparreta · Updated May 11, 2026          │
│  Works on: youtube.com                          │
│  Tags: dark, minimal, youtube, amber            │
│                                                 │
│  Description:                                   │
│  A clean dark theme for YouTube that reduces    │
│  eye strain during late-night watching. Amber   │
│  accents replace the harsh red.                 │
│                                                 │
│  Version history (3 versions)                   │
│  ├─ v3: Added amber accents (current)           │
│  ├─ v2: Fixed sidebar width                     │
│  └─ v1: Initial dark theme                      │
│                                                 │
│  AI Prompt used:                                │
│  "Make YouTube dark mode with amber accents"    │
│                                                 │
│  Comments (45)                                  │
│  ┌─────────────────────────────────┐            │
│  │ User123: Amazing on OLED screens│            │
│  │ Author: Thanks! Try v3 for new..│            │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

#### Explore Page (Grid)
```
┌─────────────────────────────────────────────────┐
│  Explore Styles    [🔍 Search...]  [Filters ▼]   │
├─────────────────────────────────────────────────┤
│  Tags: [All] [Dark] [Minimal] [Colorful] ...     │
│  Site: [All] [YouTube] [Reddit] [GitHub] ...     │
│  Sort: [Trending ▼] [Newest] [Top Rated]         │
│                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │  🖼  │ │  🖼  │ │  🖼  │ │  🖼  │          │
│  │Style │ │Style │ │Style │ │Style │          │
│  │Name  │ │Name  │ │Name  │ │Name  │          │
│  │⭐4.8 │ │⭐4.6 │ │⭐4.9 │ │⭐4.5 │          │
│  │👤User│ │👤User│ │👤User│ │👤User│          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│  (infinite scroll, 3-4 columns responsive)      │
└─────────────────────────────────────────────────┘
```

### 5.4 Color Scheme & Design Tokens

**Dark mode (default):**
```
Background (deep):    #09090b (zinc-950)
Background (card):    #18181b (zinc-900)
Background (hover):   #27272a (zinc-800)
Text (primary):       #fafafa (zinc-50)
Text (secondary):     #a1a1aa (zinc-400)
Accent (primary):     #a855f7 (purple-500)
Accent (hover):       #c084fc (purple-400)
Border:               #27272a (zinc-800)
Success:              #22c55e (green-500)
Danger:               #ef4444 (red-500)
Star rating:          #facc15 (yellow-400)
```

**Light mode (matches extension popup colors):**
```
Background:           #ffffff
Background (card):    #f4f4f5 (zinc-100)
Background (hover):   #e4e4e7 (zinc-200)
Text (primary):       #18181b (zinc-900)
Text (secondary):     #71717a (zinc-500)
Accent (primary):     #7c3aed (violet-600)
Accent (hover):       #6d28d9 (violet-700)
Border:               #e4e4e7 (zinc-200)
```

> **Note:** Extension popup will be updated later with matching dark mode (default) and light mode. The gallery ships dark-first to establish the visual direction.

### 5.5 Typography

```
Heading:    Inter (variable) — weights 600, 700, 800
Body:       Inter (variable) — weights 400, 500
Code:       JetBrains Mono — for CSS/JS previews
```

Inter is the standard for modern SaaS. JetBrains Mono for code blocks. Both free on Google Fonts.

### 5.6 Component Library

Using **shadcn/ui** components customized to the Morphix brand:
- Card (style cards with hover lift effect)
- Carousel (screenshot viewer on detail pages)
- Dialog (quick-view style previews)
- Tabs (version history, comments, about)
- Badge (tags, categories)
- Avatar (user profiles)
- Button (primary = purple, ghost for secondary)
- Input/Search (with keyboard shortcut ⌘K)
- Dropdown menu (sort, filter)
- Toast (notifications)
- Skeleton (loading states for cards)

---

## 6. Database Schema (Supabase PostgreSQL)

### 6.1 Tables

```sql
-- Users (extends Supabase auth.users)
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

-- Styles (the gallery listing)
CREATE TABLE public.styles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  description     text,
  url_pattern     jsonb NOT NULL,          -- { type, value }
  morphix_file    jsonb NOT NULL,           -- the full .morphix JSON
  tags            text[] DEFAULT '{}',
  screenshot_urls text[] DEFAULT '{}',     -- Supabase Storage paths
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

-- Ratings
CREATE TABLE public.ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score       integer NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(style_id, user_id)
);

-- Likes (separate from ratings — you can like without rating)
CREATE TABLE public.likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(style_id, user_id)
);

-- Comments
CREATE TABLE public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  parent_id   uuid REFERENCES public.comments(id) ON DELETE CASCADE,  -- nested replies
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Installs (for analytics — count per style)
CREATE TABLE public.installs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id    uuid NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  user_id     uuid,   -- nullable: anonymous installs from the gallery
  source      text,   -- 'gallery_web', 'extension_upload', 'file_import'
  created_at  timestamptz DEFAULT now()
);

-- Collections (user-curated groups of styles)
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

-- Tags (normalized for search performance)
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
```

### 6.2 Indexes

```sql
-- Full-text search on style names and descriptions
CREATE INDEX idx_styles_name_trgm ON public.styles USING gin (name gin_trgm_ops);
CREATE INDEX idx_styles_description_trgm ON public.styles USING gin (description gin_trgm_ops);

-- Common query patterns
CREATE INDEX idx_styles_author ON public.styles(author_id);
CREATE INDEX idx_styles_created ON public.styles(created_at DESC);
CREATE INDEX idx_styles_installs ON public.styles(installs_count DESC);
CREATE INDEX idx_styles_rating ON public.styles(avg_rating DESC);
CREATE INDEX idx_styles_tags ON public.styles USING gin (tags);

-- Ratings/likes lookups
CREATE INDEX idx_ratings_style ON public.ratings(style_id);
CREATE INDEX idx_likes_style ON public.likes(style_id);

-- Comments threading
CREATE INDEX idx_comments_style ON public.comments(style_id, created_at);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

-- Tag search
CREATE INDEX idx_tags_slug ON public.tags(slug);
```

### 6.3 Supabase Storage Buckets

```
screenshots/     — style preview images (public read)
  /{style_id}/
    01.png
    02.png
    thumbnail.png     (400x300, auto-generated on upload)

avatars/         — user avatars (public read)
  /{user_id}.png
```

### 6.4 Row Level Security (RLS) Policies

```sql
-- Profiles: anyone can read, owner can update
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Styles: anyone can read published, author can manage
CREATE POLICY "styles_read" ON public.styles FOR SELECT
  USING (is_published = true);
CREATE POLICY "styles_manage" ON public.styles FOR ALL
  USING (auth.uid() = author_id);

-- Ratings/Likes: anyone can read, authenticated can create/delete own
CREATE POLICY "ratings_read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_create" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_delete" ON public.ratings FOR DELETE
  USING (auth.uid() = user_id);

-- Comments: anyone can read, authenticated can create, owner can update/delete
CREATE POLICY "comments_read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_create" ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_manage" ON public.comments FOR UPDATE DELETE
  USING (auth.uid() = user_id);
```

---

## 7. API Design

### 7.1 Public API (Next.js API Routes → Supabase)

```
GET    /api/styles              List styles (paginated, filterable)
GET    /api/styles/:slug         Single style with author, ratings, comments
GET    /api/styles/:slug/download  Download .morphix file
POST   /api/styles              Create style (authenticated)
PUT    /api/styles/:slug         Update style (author only)
DELETE /api/styles/:slug         Delete style (author only)

GET    /api/styles/:slug/comments   List comments (paginated, threaded)
POST   /api/styles/:slug/comments   Add comment (authenticated)

POST   /api/styles/:slug/like       Toggle like (authenticated)
POST   /api/styles/:slug/rate       Rate style 1-5 (authenticated)

POST   /api/styles/:slug/install    Record install event

GET    /api/users/:username         Profile with styles
GET    /api/users/:username/styles  User's published styles

GET    /api/tags                    List popular tags
GET    /api/search?q=dark+youtube   Full-text search

POST   /api/upload/screenshot       Upload screenshot (multipart)
POST   /api/upload/morphix          Upload .morphix file (JSON body)
```

### 7.2 Extension API (called from browser extension)

```
POST   /api/extension/upload
       Headers: Authorization: Bearer <supabase_token>
       Body: { morphix_json: {...}, screenshots: ["base64..."] }
       Response: { style_id, slug, url }

GET    /api/extension/styles/:style_id/download
       Headers: Authorization: Bearer <supabase_token>
       Response: .morphix JSON

GET    /api/extension/me/styles
       Headers: Authorization: Bearer <supabase_token>
       Response: User's uploaded styles (for sync status)
```

### 7.3 Sort & Filter Parameters

```
GET /api/styles?sort=trending|newest|top_rated|most_installed
               &tags=dark,minimal
               &site=youtube.com
               &author=username
               &q=search+terms
               &page=1
               &limit=20
```

---

## 8. User Flows (Full Walkthrough)

### 8.1 Export & Share via File

```
1. Alice styles YouTube with a dark theme
2. She opens Morphix popup → clicks "Export"
3. Browser downloads "YouTube-Dark-Mode.morphix"
4. Alice sends the file to Bob via Discord
5. Bob opens Morphix → clicks "Import" → selects the file
6. Preview card shows: "YouTube Dark Mode by Alice - Works on youtube.com"
7. Bob clicks "Import Style"
8. Style appears in Bob's library with full version history
9. Bob visits YouTube → the dark theme is applied
```

### 8.2 Upload to Gallery

```
1. Alice styles YouTube, wants to share publicly
2. She clicks "Share to Gallery" in the popup
3. Extension prompts: "Add tags?" (Alice types: dark, minimal, amber)
4. Extension navigates to YouTube, applies style, captures screenshot
5. Extension sends .morphix + screenshot to gallery API
6. Extension shows: "Published! View at morphix.styles/styles/youtube-dark"
7. Style is now discoverable on the gallery
```

### 8.3 Browse & Install from Gallery

```
1. Carlos searches "dark mode youtube" on Google
2. Google shows morphix.styles/styles/youtube-dark-mode
3. Carlos browses the style page — sees screenshots, rating 4.8
4. Carlos clicks "Install with Morphix"
5. Gallery checks if extension is installed (via chrome.runtime.sendMessage)
   a. If installed: opens extension → auto-imports → shows toast
   b. If not installed: redirects to Chrome Web Store listing
6. Carlos visits YouTube → dark theme is applied immediately
```

### 8.4 Discovery Within Extension

```
1. Diana is browsing Reddit, opens Morphix popup
2. Popup shows: "3 community styles available for Reddit" (badge)
3. She clicks the badge → inline preview carousel appears
4. She clicks "Install" on "Reddit Clean UI" → imports instantly
5. Style is applied, she can switch between her own styles and community ones
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Extension Export/Import)

**Duration:** ~1 week

**Tasks:**
1. Define `.morphix` format v1 spec
2. Add `exportStyle(projectId)` to `styles.js`
3. Add `importStyle(file)` to `styles.js` with validation
4. Add Export button to popup UI (active style)
5. Add Export button to options UI (style library cards)
6. Add Import button to options UI (header area)
7. Handle edge cases (duplicates, conflicts, invalid files)
8. Add file extension registration in manifest.json
9. Test roundtrip: export → import → verify exact match

**Deliverable:** Users can share styles as files. Imported styles preserve version history and conversation context.

### Phase 2: Supabase Setup & Auth

**Duration:** ~3 days

**Tasks:**
1. Create Supabase project
2. Run database migrations (all tables, indexes, RLS)
3. Set up Storage buckets (screenshots, avatars)
4. Configure Auth providers (email + GitHub OAuth)
5. Create `profiles` trigger (auto-create on auth.users insert)
6. Set up local dev environment (Supabase CLI)
7. Test auth flow end-to-end

**Deliverable:** Backend ready. Users can sign up, log in, have profiles.

### Phase 3: Gallery Web App — Core

**Duration:** ~2 weeks

**Tasks:**
1. Scaffold Next.js 14 project with App Router
2. Install shadcn/ui + Tailwind + configure dark/light themes
3. Build homepage (hero, trending, categories)
4. Build explore page (infinite scroll grid, filters, search)
5. Build style detail page (carousel, info, install button)
6. Build author profile page (bio, style grid, stats)
7. Implement full-text search (PostgreSQL trigram)
8. Implement sort (trending, newest, top rated)
9. Seed with Morphix creator's own styles (bootstrap content)
10. Deploy to Vercel

**Deliverable:** Working gallery website with browsing, search, empty states.

### Phase 4: Gallery Web App — Social Features

**Duration:** ~1 week

**Tasks:**
1. Implement rating system (1-5 stars)
2. Implement likes (heart toggle)
3. Implement comments (threaded, with replies)
4. Implement install counting
5. Implement collections (create, add styles, share)
6. Add moderation tools (report style, report comment)
7. Add user settings page (profile editing)

**Deliverable:** Full community functionality. Users can rate, comment, collect.

### Phase 5: Extension ↔ Gallery Integration

**Duration:** ~1 week

**Tasks:**
1. Add "Share to Gallery" button + flow in extension
2. Implement screenshot capture on upload
3. Add gallery authentication in extension (Supabase client)
4. Implement gallery install flow (web → extension deep link)
5. Add "Your published styles" section in extension options
6. Add inline "Community styles for this site" in popup
7. Handle auth token refresh and expiration
8. Register custom protocol handler

**Deliverable:** Extension and gallery are connected. Seamless upload and install.

### Phase 6: Polish & Launch

**Duration:** ~1 week

**Tasks:**
1. Performance optimization (image lazy loading, ISR for style pages)
2. SEO (meta tags, Open Graph, sitemap, RSS for new styles)
3. Accessibility audit (keyboard nav, screen reader, contrast)
4. Error states and loading skeletons (every component)
5. Empty states (no results, no styles yet, no comments)
6. Mobile responsive audit (gallery is mobile-first too)
7. Security audit (RLS policies, input sanitization, rate limiting)
8. Analytics integration (Plausible)
9. Landing page improvements (social proof, testimonials area)
10. Write docs: how to share, gallery guidelines

**Deliverable:** Production-ready, polished, launchable.

---

## 10. Monetization Strategy

### Principle: Core sharing is free forever. Premium adds convenience and power. The free tier is genuinely generous — never crippleware.

| Feature | Free | Premium ($5/mo or $40/yr) |
|---------|------|---------------------------|
| Export styles as files | ✅ | ✅ |
| Import styles from files | ✅ | ✅ |
| Upload to gallery | ✅ | ✅ |
| Browse & install from gallery | ✅ | ✅ |
| Vote, comment, collect | ✅ | ✅ |
| **Cloud style sync** (across devices) | ❌ | ✅ |
| **Style analytics** (installs, ratings, sites using it) | ❌ | ✅ |
| **AI style recommendations** (based on browsing) | ❌ | ✅ |
| **Priority listing** (boosted in search) | ❌ | ✅ |
| **Verified creator badge** | ❌ | ✅ |
| **Custom profile page** (custom CSS on your profile) | ❌ | ✅ |
| **Team collections** (shared private collections) | ❌ | ✅ |
| **Unlimited uploads** | 50 styles | Unlimited |
| **Higher-res screenshots** | 720p | 4K |

### Pricing psychology:
- $5/mo is "coffee money" — within impulse-buy range for power users
- Annual discount ($40 = $3.33/mo) locks in retention
- Free tier is genuinely generous — no "crippleware" feel
- Premium features are "nice to have" not "need to have" — no resentment
- Extension stays free and open source — goodwill drives conversion

---

## 11. Risks & Open Questions

### 11.1 Technical Risks

| Risk | Mitigation |
|------|-----------|
| Supabase free tier limits hit | Monitor usage; upgrade path is ~$25/mo for Pro (generous limits) |
| Chrome Web Store rejects extension for "remote code" (JS injection) | JS injection is already approved in current Morphix; style sharing doesn't change this |
| Screenshot capture fails on some sites (CSP, iframes) | Fallback: user manually uploads screenshot, or gallery shows placeholder |
| Malicious CSS/JS in shared styles | Implement basic static analysis before import (no `eval()`, no external requests); show security warning on JS-containing styles |
| `.morphix` file association on OS | Nice-to-have, not required. Fall back to `.json` double-click import |

### 11.2 Product Risks

| Risk | Mitigation |
|------|-----------|
| Empty gallery at launch (cold start) | Seed with 20-30 high-quality styles from Morphix creator; feature "Staff Picks" section; invite early users personally |
| Style copyright / licensing confusion | Default CC BY-SA 4.0 on upload; clear license badge on every style page; DMCA takedown form available |
| Low upload rate | Make upload frictionless (one click in extension); gamify with stats ("Your style has 47 installs!") |
| Style quality varies wildly | Rating system surfaces good content; "Featured" curation by Morphix team; AI-generated styles generally high quality |
| Copyright issues (styles of trademarked sites) | Styles are CSS transformations, not content redistribution — same legal standing as Stylish/Stylus; add DMCA takedown process |
| Competitor response | Morphix's AI-generation differentiator is hard to copy quickly; speed to market matters |

### 11.3 Open Questions

1. **Gallery domain name?** `morphix.styles` (~$30/yr) vs free Vercel subdomain. If budget allows, buy the domain for credibility.
2. **Gallery moderation?** Initially manual (just Arzuparreta). Later add community flagging + auto-hide after N reports.
3. **Style licensing?** Resolved: Default is **CC BY-SA 4.0** (Creative Commons Attribution-ShareAlike). This means anyone can use and modify shared styles, but must credit the original author and share modifications under the same license. It prevents someone from taking a free community style, slightly modifying it, and selling it without contributing back. Creators can optionally choose MIT or CC0 on upload if they want to be more permissive. This mirrors Stack Overflow's approach to shared code.
4. **Extension dark mode?** Resolved: Will ship after Phase 6 (gallery launch). Match gallery's dark palette (zinc-950 background, purple-500 accent, Inter font) to extension popup and options pages. Dark mode becomes the default for the extension, matching the gallery's visual direction. Light mode retained as secondary option with colors matching the current extension popup.
5. **Mobile app?** Out of scope for v1. Extension is browser-only; no phone functionality needed yet. If premium features later benefit from phone access, revisit. Gallery website is responsive and works on mobile browsers regardless.

---

## 12. Success Metrics

| Metric | Target (6 months post-launch) |
|--------|-------------------------------|
| Gallery styles published | 500+ |
| Registered gallery users | 1,000+ |
| Extension installs | 5,000+ (Chrome Web Store) |
| Style installs from gallery | 2,000+ |
| Monthly active style creators | 50+ |
| Gallery DAU | 200+ |

---

## 13. Appendix A: `.morphix` File Examples

### Minimal style (just CSS, no AI history)
```json
{"format_version":1,"type":"morphix_style","style":{"name":"Minimal Hacker News","url_pattern":{"type":"domain","value":"news.ycombinator.com"},"active_version":{"css":"body{font-family:Georgia;max-width:680px;margin:0 auto;padding:2rem;background:#fffff8;color:#111}","js":"","prompt":"","description":"Clean reading layout for HN"},"versions":[],"conversation":[]},"exported_at":"2026-05-11T00:00:00Z"}
```

### Full style (with AI context, from gallery)
```json
{
  "format_version": 1,
  "type": "morphix_style",
  "style": {
    "name": "GitHub Monochrome",
    "description": "Strips GitHub to grayscale for distraction-free code review",
    "url_pattern": { "type": "domain", "value": "github.com" },
    "active_version": {
      "css": "*,*::before,*::after{filter:grayscale(1)!important}img,video{filter:grayscale(1)!important}.btn{filter:none!important}",
      "js": "",
      "prompt": "Make GitHub completely monochrome but keep buttons functional",
      "description": "Applied grayscale filter to all GitHub pages"
    },
    "versions": [
      {
        "id": "version_a1b2c3",
        "css": "*,*::before,*::after{filter:grayscale(1)!important}img,video{filter:grayscale(1)!important}.btn{filter:none!important}",
        "js": "",
        "prompt": "Make GitHub completely monochrome but keep buttons functional",
        "description": "Applied grayscale filter to all GitHub pages",
        "parent_version_id": null,
        "created_at": "2026-05-10T18:30:00Z"
      }
    ],
    "conversation": [
      {
        "role": "user",
        "content": "Make GitHub completely monochrome but keep buttons functional",
        "version_id": "version_a1b2c3",
        "created_at": "2026-05-10T18:30:00Z"
      },
      {
        "role": "assistant",
        "content": "Applied grayscale filter to all GitHub pages. Buttons retain their original colors for usability.",
        "version_id": "version_a1b2c3",
        "created_at": "2026-05-10T18:30:05Z"
      }
    ]
  },
  "author": {
    "name": "Arzuparreta",
    "gallery_id": "user_xyz",
    "url": "https://morphix.styles/arzuparreta"
  },
  "gallery": {
    "style_id": "style_abc",
    "url": "https://morphix.styles/styles/github-monochrome",
    "tags": ["monochrome", "github", "focus", "productivity"],
    "screenshots": ["https://supabase.co/storage/v1/object/public/screenshots/style_abc/01.png"]
  },
  "exported_at": "2026-05-11T14:00:00Z"
}
```

---

## Appendix B: Extension Dark Mode Design

**Status:** Spec ready. Implementation: Phase 2 (post-gallery launch) or standalone.

### B.1 Design Tokens

The extension dark mode mirrors the gallery's dark palette for visual consistency across Morphix surfaces.

```css
:root {
  /* Dark mode (default) */
  --bg-deep:       #09090b;   /* zinc-950 — page background */
  --bg-card:       #18181b;   /* zinc-900 — cards, inputs */
  --bg-hover:      #27272a;   /* zinc-800 — hover states */
  --bg-elevated:   #1f1f23;   /* zinc-850 — dropdowns, tooltips */
  --border:        #27272a;   /* zinc-800 — dividers, input borders */
  --border-focus:  #a855f7;   /* purple-500 — focused input ring */
  --text-primary:  #fafafa;   /* zinc-50 */
  --text-secondary:#a1a1aa;   /* zinc-400 */
  --text-muted:    #71717a;   /* zinc-500 */
  --accent:        #a855f7;   /* purple-500 — buttons, links, badges */
  --accent-hover:  #c084fc;   /* purple-400 */
  --accent-muted:  #3b0764;   /* purple-950 — subtle accent backgrounds */
  --success:       #22c55e;   /* green-500 — apply, save, enabled */
  --danger:        #ef4444;   /* red-500 — delete, discard, disabled */
  --warning:       #f59e0b;   /* amber-500 — warnings */
  --star:          #facc15;   /* yellow-400 */
  --radius:        8px;
  --radius-sm:     4px;
  --font:          'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:     'JetBrains Mono', 'Fira Code', monospace;
}
```

### B.2 Light Mode (secondary)

Matches the current extension popup colors so existing users see continuity.

```css
[data-theme="light"] {
  --bg-deep:       #ffffff;
  --bg-card:       #f4f4f5;   /* zinc-100 */
  --bg-hover:      #e4e4e7;   /* zinc-200 */
  --border:        #e4e4e7;   /* zinc-200 */
  --border-focus:  #7c3aed;   /* violet-600 */
  --text-primary:  #18181b;   /* zinc-900 */
  --text-secondary:#71717a;   /* zinc-500 */
  --text-muted:    #a1a1aa;   /* zinc-400 */
  --accent:        #7c3aed;   /* violet-600 */
  --accent-hover:  #6d28d9;   /* violet-700 */
  --accent-muted:  #ede9fe;   /* violet-100 */
}
```

### B.3 Files to update

| File | Changes |
|------|---------|
| `extension/popup/popup.css` | Replace hardcoded colors with CSS custom properties |
| `extension/popup/popup.html` | Add `data-theme="dark"` on `<html>`, theme toggle button |
| `extension/popup/popup.js` | Read theme preference from `chrome.storage.local`, toggle handler |
| `extension/options/options.css` | Same CSS variable migration |
| `extension/options/options.html` | Same `data-theme` + toggle |
| `extension/options/options.js` | Same theme logic, synced with popup preference |
| `extension/manifest.json` | No changes needed (CSS only) |

### B.4 Theme Toggle

- **Location:** Top-right corner of popup, top-right of options page
- **Icon:** Sun/moon toggle (lucide-react icons inline as SVG)
- **Persistence:** `chrome.storage.local` key `theme_preference` (`"dark"` | `"light"` | `"system"`)
- **Default:** `"dark"` on fresh install
- **System mode:** Follows `prefers-color-scheme` media query
- **Transition:** `transition: background-color 0.2s, color 0.2s` on `:root`

### B.5 CSS Variable Migration Pattern

Before (current hardcoded):
```css
body {
  background: #ffffff;
  color: #1a1a2e;
}
.button-primary {
  background: #6c63ff;
  color: white;
}
```

After (tokenized):
```css
body {
  background: var(--bg-deep);
  color: var(--text-primary);
}
.button-primary {
  background: var(--accent);
  color: var(--bg-deep);
}
```

---

*End of design document. Next step: Phase 1 implementation.*
