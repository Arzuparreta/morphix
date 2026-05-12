import { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { StyleCardSkeleton } from "@/components/style-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Explore styles",
  description: "Browse AI-crafted custom styles for any website",
};

const TAGS = ["dark", "minimal", "youtube", "github", "reddit", "focus", "colorful"];

export const dynamic = "force-static";

export default function ExplorePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore styles</h1>
        <p className="text-muted-foreground">
          Discover custom styles created by the Morphix community.
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TAGS.map((tag) => (
          <Link key={tag} href={`/explore?tags=${tag}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              {tag}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort:</span>
        {["Trending", "Newest", "Top rated", "Most installed"].map((s) => (
          <span key={s} className="inline-flex items-center rounded-md text-sm font-medium h-9 px-3 text-muted-foreground/50">
            {s}
          </span>
        ))}
      </div>

      {/* Grid — skeleton placeholders (real data when DB is seeded) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StyleCardSkeleton key={i} />
        ))}
      </div>

      {/* Empty state CTA */}
      <div className="text-center py-16">
        <p className="text-lg font-semibold mb-2">No styles yet — be the first!</p>
        <p className="text-muted-foreground mb-4">
          Install the Morphix extension, create a style, and share it here.
        </p>
        <a
          href="https://github.com/Arzuparreta/morphix"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 text-sm font-medium"
        >
          Get the extension
        </a>
      </div>
    </div>
  );
}
