"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Props {
  styleId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ styleId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPending(false); return; }

    const prev = liked;
    setLiked(!prev);
    setCount((c) => (prev ? c - 1 : c + 1));

    const { error } = prev
      ? await supabase.from("likes").delete().eq("style_id", styleId).eq("user_id", user.id)
      : await supabase.from("likes").insert({ style_id: styleId, user_id: user.id });

    if (error) { setLiked(prev); setCount(initialCount); }
    setPending(false);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending} className="gap-1.5">
      <Heart className={`h-4 w-4 transition-colors ${liked ? "fill-red-500 text-red-500" : ""}`} />
      <span>{count}</span>
    </Button>
  );
}
