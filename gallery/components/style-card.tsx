"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Download } from "lucide-react";
import type { StyleWithAuthor } from "@/lib/supabase/types";

interface Props {
  style: StyleWithAuthor;
  showAuthor?: boolean;
  showSite?: boolean;
}

export function StyleCard({ style, showAuthor = true, showSite = true }: Props) {
  const author = style.author;
  const initials = (author?.display_name || author?.username || "U").slice(0, 2).toUpperCase();
  const siteLabel = style.url_pattern?.type === "domain"
    ? style.url_pattern.value
    : style.url_pattern?.type === "exact"
      ? new URL(style.url_pattern.value).hostname
      : "Global";

  return (
    <Link href={`/styles/${style.slug}`}>
      <Card className="overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col">
        {/* Screenshot */}
        <div className="aspect-[16/10] bg-muted relative overflow-hidden">
          {style.screenshot_urls?.[0] ? (
            <img
              src={style.screenshot_urls[0]}
              alt={style.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              No preview
            </div>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col gap-1.5">
          <p className="font-semibold text-sm truncate">{style.name}</p>

          {showSite && (
            <p className="text-xs text-muted-foreground truncate">{siteLabel}</p>
          )}

          <div className="flex items-center justify-between mt-auto pt-1">
            {showAuthor && author ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={author.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {author.display_name || author.username}
                </span>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              {style.avg_rating > 0 ? (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {style.avg_rating}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">New</span>
              )}
              <span className="flex items-center gap-0.5">
                <Download className="h-3 w-3" />
                {style.installs_count}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* Skeleton placeholder shown during loading */
export function StyleCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full">
      <div className="aspect-[16/10] bg-muted animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          <div className="h-3 w-12 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </Card>
  );
}
