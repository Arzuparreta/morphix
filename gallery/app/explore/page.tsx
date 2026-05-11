import { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Explore styles",
  description: "Browse AI-crafted custom styles for any website",
};

const SAMPLE_TAGS = ["dark", "minimal", "youtube", "colorful", "github", "reddit", "focus"];

export default function ExplorePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore styles</h1>
        <p className="text-muted-foreground">
          Discover custom styles created by the Morphix community.
        </p>
      </div>

      {/* Search bar */}
      <form action="/search" className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input name="q" placeholder="Search by name, description, or tag..." className="pl-10" />
        </div>
      </form>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SAMPLE_TAGS.map((tag) => (
          <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-accent">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {["Trending", "Newest", "Top rated", "Most installed"].map((s) => (
          <Button key={s} variant="ghost" size="sm">
            {s}
          </Button>
        ))}
      </div>

      {/* Grid — empty state */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StyleCardPlaceholder key={i} />
        ))}
      </div>

      {/* Empty state message */}
      <Card className="mt-8 p-12 text-center">
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
      </Card>
    </div>
  );
}

function StyleCardPlaceholder() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[16/10] bg-muted flex items-center justify-center" />
      <div className="p-3 space-y-1">
        <p className="font-semibold text-sm">Style name</p>
        <p className="text-xs text-muted-foreground">example.com</p>
      </div>
    </Card>
  );
}
