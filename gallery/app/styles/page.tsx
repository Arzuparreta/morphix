import { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Heart, MessageCircle, Share2, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Style detail",
};

export default function StyleDetailPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Card className="overflow-hidden">
        {/* Screenshot placeholder */}
        <div className="aspect-[2/1] bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Style screenshot preview</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Style Name</h1>
              <p className="text-sm text-muted-foreground">
                By{" "}
                <span className="text-primary font-medium">Author</span>
                {" · "}Updated recently
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">—</span>
              <span className="text-sm text-muted-foreground">(0)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button>
              <Download className="h-4 w-4 mr-1" />
              Install with Morphix
            </Button>
            <Button variant="outline">Download .morphix</Button>
            <Button variant="ghost" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">example.com</Badge>
            <Badge variant="outline">dark</Badge>
            <Badge variant="outline">minimal</Badge>
          </div>

          {/* Description */}
          <p className="text-muted-foreground">
            A beautiful dark theme for this website. Reduces eye strain and makes
            content stand out.
          </p>

          {/* Stats */}
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> 0 likes
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> 0 installs
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> 0 comments
            </span>
          </div>
        </div>
      </Card>

      {/* Comments section */}
      <Card className="mt-6 p-6">
        <h2 className="font-semibold mb-4">Comments</h2>
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to share your thoughts!
        </p>
      </Card>
    </div>
  );
}
