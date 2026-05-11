"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { CommentWithAuthor } from "@/lib/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  styleId: string;
  initialComments: CommentWithAuthor[];
}

export function CommentSection({ styleId, initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;
    setPending(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in to comment."); setPending(false); return; }

    const { data, error: err } = await supabase
      .from("comments")
      .insert({ style_id: styleId, user_id: user.id, body: body.trim() })
      .select("*, author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)")
      .single();

    if (err) { setError(err.message); setPending(false); return; }

    setComments((prev) => [...prev, data as unknown as CommentWithAuthor]);
    setBody("");
    setPending(false);
  }

  return (
    <div className="space-y-4">
      {/* Comment form */}
      <form onSubmit={submit} className="space-y-2">
        <textarea
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Share your thoughts..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Posting..." : "Post comment"}
        </Button>
      </form>

      {/* Comment list */}
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
            <AvatarImage src={c.author?.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {(c.author?.display_name || c.author?.username || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{c.author?.display_name || c.author?.username}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
