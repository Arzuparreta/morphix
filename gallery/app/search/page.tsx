import { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Search styles",
};

export default function SearchPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <form action="/search" className="mb-8 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="q"
            placeholder="Search styles..."
            className="pl-10"
            autoFocus
          />
        </div>
      </form>

      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Enter a search term above to find styles.
        </p>
      </Card>
    </div>
  );
}
