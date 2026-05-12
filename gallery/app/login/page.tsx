"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Username is required"); return; }
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim(), display_name: username.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) { setError(authError.message); setLoading(false); return; }

    setError("");
    alert("Account created! Check your email to confirm, then sign in.");
    setLoading(false);
  }

  async function handleGitHub() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <Tabs defaultValue="signin">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <Card className="p-6 space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to share styles.</p>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>}
            <form onSubmit={handleSignIn} className="space-y-3">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
            </form>
            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <Button variant="outline" className="w-full" onClick={handleGitHub}>Continue with GitHub</Button>
          </Card>
        </TabsContent>

        <TabsContent value="signup">
          <Card className="p-6 space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-bold">Create an account</h1>
              <p className="text-sm text-muted-foreground">Join the Morphix community.</p>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>}
            <form onSubmit={handleSignUp} className="space-y-3">
              <Input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create account"}</Button>
            </form>
            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <Button variant="outline" className="w-full" onClick={handleGitHub}>Continue with GitHub</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
