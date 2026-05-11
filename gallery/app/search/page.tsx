// app/search/page.tsx — search page that redirects to explore
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  if (q?.trim()) {
    redirect(`/explore?q=${encodeURIComponent(q.trim())}`);
  }
  redirect("/explore");
}
