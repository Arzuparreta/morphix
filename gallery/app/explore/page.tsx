import { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { StyleCard, StyleCardSkeleton } from "@/components/style-card";
import { getStyles, getPopularTags } from "@/lib/supabase/queries";
import { Suspense } from "react";
import Link from "next/link";
import type { StyleSort } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Explore styles",
  description: "Browse AI-crafted custom styles for any website",
};

interface Props {
  searchParams: Promise<{
    sort?: string;
    tags?: string;
    site?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: Props) {
  const params = await searchParams;
  const sort = (params.sort as StyleSort) || "trending";
  const tags = params.tags?.split(",").filter(Boolean);
  const site = params.site;
  const q = params.q;
  const page = parseInt(params.page || "1", 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore styles</h1>
        <p className="text-muted-foreground">
          Discover custom styles created by the Morphix community.
        </p>
      </div>

      {/* Tags */}
      <Suspense fallback={<div className="h-8 mb-6" />}>
        <ExploreTags activeTags={tags} />
      </Suspense>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort:</span>
        {(["trending", "newest", "top_rated", "most_installed"] as StyleSort[]).map(
          (s) => {
            const isActive = sort === s;
            const nextParams = new URLSearchParams(params as Record<string, string>);
            nextParams.set("sort", s);
            return (
              <Link
                key={s}
                href={`/explore?${nextParams.toString()}`}
                className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {s === "trending"
                  ? "Trending"
                  : s === "newest"
                    ? "Newest"
                    : s === "top_rated"
                      ? "Top rated"
                      : "Most installed"}
              </Link>
            );
          },
        )}
      </div>

      {/* Style grid */}
      <Suspense fallback={<StyleGridSkeleton count={6} />}>
        <StyleGrid
          sort={sort}
          tags={tags}
          site={site}
          q={q}
          page={page}
        />
      </Suspense>
    </div>
  );
}

// ── Async components ───────────────────────────────────

async function ExploreTags({ activeTags }: { activeTags?: string[] }) {
  const tags = await getPopularTags(20);
  const allTags = tags.length
    ? tags
    : ["dark", "minimal", "youtube", "github", "reddit", "focus", "colorful"].map(
        (n) => ({ slug: n, name: n, usage_count: 0, id: n }),
      );

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {allTags.map((tag) => {
        const isActive = activeTags?.includes(tag.slug);
        const nextActive = isActive
          ? activeTags?.filter((t) => t !== tag.slug)
          : [...(activeTags || []), tag.slug];
        const qs = nextActive?.length ? `?tags=${nextActive.join(",")}` : "";
        return (
          <Link key={tag.slug} href={`/explore${qs}`}>
            <Badge variant={isActive ? "default" : "outline"}>
              {tag.name}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

async function StyleGrid({
  sort,
  tags,
  site,
  q,
  page,
}: {
  sort: StyleSort;
  tags?: string[];
  site?: string;
  q?: string;
  page: number;
}) {
  const styles = await getStyles({ sort, tags, site, q, page, limit: 18 });

  if (!styles.length) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold mb-2">No styles found</p>
        <p className="text-muted-foreground">
          {q
            ? `No results for "${q}". Try different keywords.`
            : "No styles match these filters. Try broadening your search."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {styles.map((s) => (
          <StyleCard key={s.id} style={s} />
        ))}
      </div>

      {/* Pagination — simple prev/next */}
      {styles.length >= 18 && (
        <div className="flex justify-center gap-4 mt-8">
          {page > 1 && (
            <Link
              href={`/explore?${buildQuery({ sort, tags, site, q, page: page - 1 })}`}
              className="text-sm font-medium hover:text-primary"
            >
              ← Previous
            </Link>
          )}
          <Link
            href={`/explore?${buildQuery({ sort, tags, site, q, page: page + 1 })}`}
            className="text-sm font-medium hover:text-primary"
          >
            Next →
          </Link>
        </div>
      )}
    </>
  );
}

function StyleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StyleCardSkeleton key={i} />
      ))}
    </div>
  );
}

function buildQuery(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, String(v));
    }
  }
  return sp.toString();
}
