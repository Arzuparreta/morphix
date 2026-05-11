// app/styles/[slug]/page.tsx — style detail page
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStyleBySlug, getComments } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import {
  Download,
  Star,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import type { CommentWithAuthor } from "@/lib/supabase/types";
import { LikeButton } from "@/components/like-button";
import { RatingStars } from "@/components/rating-stars";
import { CommentSection } from "@/components/comment-section";
import { InstallButton } from "@/components/install-button";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const style = await getStyleBySlug(slug);
  if (!style) return { title: "Not found" };
  return {
    title: style.name,
    description: style.description || `A custom style for ${style.url_pattern?.value}`,
    openGraph: {
      title: style.name,
      description: style.description || "",
      images: style.screenshot_urls?.[0] ? [{ url: style.screenshot_urls[0] }] : [],
    },
  };
}

export default async function StyleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const style = await getStyleBySlug(slug);
  if (!style) notFound();

  // Get user-specific state
  let userRating: number | null = null;
  let userLiked = false;
  if (user && style) {
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from("ratings").select("score").eq("style_id", style.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("likes").select("id").eq("style_id", style.id).eq("user_id", user.id).maybeSingle(),
    ]);
    userRating = r?.score ?? null;
    userLiked = !!l;
  }

  // Comments
  const comments: CommentWithAuthor[] = [];
  try { const c = await getComments(style.id); if (c) comments.push(...c); } catch {}

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Screenshot carousel */}
      <Card className="overflow-hidden mb-6">
        {style.screenshot_urls?.[0] ? (
          <img
            src={style.screenshot_urls[0]}
            alt={style.name}
            className="w-full aspect-[2/1] object-cover"
          />
        ) : (
          <div className="aspect-[2/1] bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No screenshot yet</p>
          </div>
        )}
      </Card>

      <div className="space-y-6">
        {/* Title & creator */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{style.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>by</span>
            <Link href={`/${style.author?.username}`} className="flex items-center gap-1.5 hover:text-primary">
              <Avatar className="h-5 w-5">
                <AvatarImage src={style.author?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(style.author?.display_name || style.author?.username || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{style.author?.display_name || style.author?.username}</span>
            </Link>
            <span>·</span>
            <span>{new Date(style.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Rating summary */}
        <div className="flex items-center gap-1">
          {style.avg_rating > 0 ? (
            <>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-lg">{style.avg_rating}</span>
              <span className="text-sm text-muted-foreground">({style.ratings_count} ratings)</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No ratings yet</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
        <InstallButton styleSlug={style.slug} styleName={style.name} />
          <a
            href={`/api/styles/${style.slug}/download`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 text-sm font-medium"
          >
            <Download className="h-4 w-4 mr-1" />
            Download .morphix
          </a>
        </div>

        {/* Tags & site */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{style.url_pattern?.value}</Badge>
          {style.tags?.map((tag) => (
            <Link key={tag} href={`/explore?tags=${tag}`}>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Description */}
        {style.description && (
          <p className="text-muted-foreground leading-relaxed">{style.description}</p>
        )}

        {/* Rating */}
        <RatingStars
          styleId={style.id}
          initialRating={userRating}
          avgRating={style.avg_rating}
          ratingsCount={style.ratings_count}
        />

        {/* Stats */}
        <div className="flex gap-6 text-sm text-muted-foreground border-t border-b border-border py-4">
          <LikeButton
            styleId={style.id}
            initialLiked={userLiked}
            initialCount={style.likes_count}
          />
          <span className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> {style.installs_count} installs
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> {style.comments_count} comments
          </span>
        </div>

        {/* AI Prompt used */}
        <PromptPreview morphixFile={style.morphix_file} />
      </div>

      {/* Comments */}
      <Card className="mt-8 p-6">
        <h2 className="font-semibold mb-4">Comments ({style.comments_count})</h2>
        <CommentSection styleId={style.id} initialComments={comments} />
      </Card>
    </div>
  );
}



// ── Prompt preview ────────────────────────────────────

interface MorphixStyle {
  active_version?: { prompt?: string };
}

function PromptPreview({ morphixFile }: { morphixFile: Record<string, unknown> }) {
  const style = morphixFile?.style as MorphixStyle | undefined;
  const prompt = style?.active_version?.prompt;
  if (!prompt) return null;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        View AI prompt used
      </summary>
      <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
        {prompt}
      </pre>
    </details>
  );
}
