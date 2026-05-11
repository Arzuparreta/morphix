"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  styleId: string;
  initialRating: number | null;
  avgRating: number;
  ratingsCount: number;
}

export function RatingStars({ styleId, initialRating, avgRating, ratingsCount }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [pending, setPending] = useState(false);

  async function submit(score: number) {
    if (pending) return;
    setPending(true);
    const prev = rating;
    setRating(score);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRating(prev); setPending(false); return; }

    const { error } = await supabase
      .from("ratings")
      .upsert({ style_id: styleId, user_id: user.id, score }, { onConflict: "style_id,user_id" });

    if (error) setRating(prev);
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = (hovered || rating || 0) >= star;
          return (
            <button
              key={star}
              type="button"
              disabled={pending}
              className="p-0.5 transition-colors"
              onMouseEnter={() => setHovered(star)}
              onClick={() => submit(star)}
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={`h-5 w-5 ${
                  filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                }`}
              />
            </button>
          );
        })}
      </div>
      {avgRating > 0 && (
        <span className="text-sm text-muted-foreground">
          {avgRating} ({ratingsCount})
        </span>
      )}
    </div>
  );
}
