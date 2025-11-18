import { useEffect, useState } from 'react';
import { supabase, Profile } from './lib/supabase';
import AuthForm from './components/AuthForm';
import ProfileCard from './components/ProfileCard';
import { LogOut } from 'lucide-react';

function App() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as { user: { id: string } } | null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session as { user: { id: string } } | null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchProfiles();
    }
  }, [session]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    setProfiles(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-xl font-medium text-slate-700">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <AuthForm onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Social Profiles</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              currentUserId={session.user.id}
            />
          ))}
        </div>

        {profiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg">No profiles found. Create some users to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
// App.tsx
import React, { useEffect, useState, useCallback } from "react";
import { createClient, Session, SupabaseClient } from "npm:@supabase/supabase-js@2.32.0";

const SUPABASE_URL = "<YOUR_SUPABASE_URL>";
const SUPABASE_ANON_KEY = "<YOUR_SUPABASE_ANON_KEY>";

// Create a single shared supabase client for the app
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // optional: set persistSession true (default). SDK persists to localStorage.
    persistSession: true,
    // optional: detectSessionInUrl true for OAuth redirects
    detectSessionInUrl: true,
  },
});

function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Restore session from storage (if any)
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session ?? null);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    // Subscribe to auth changes (including token refreshes). The SDK will update
    // stored session and call this callback whenever session changes.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // event examples: "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"
      setSession(session ?? null);
      // optional: you can log events for debugging
      console.log("[auth] event:", event, session ? "session present" : "no session");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Re-check session when window regains focus (helps trigger refresh if access token expired)
  useEffect(() => {
    const onFocus = async () => {
      // This will cause the SDK to rehydrate but won't force a refresh; however,
      // the SDK will refresh automatically on next request if access token expired.
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      console.log("[auth] focus - session refreshed from storage");
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await supabase.auth.signUp({ email, password });
    return res;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  return { session, initializing, signUp, signIn, signOut, supabase };
}

export default function App() {
  const { session, initializing, signUp, signIn, signOut, supabase } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Signing up...");
    const { data, error } = await signUp(email, password);
    if (error) setStatusMsg("Sign up error: " + error.message);
    else setStatusMsg("Sign up successful. Check your email if confirmation is required.");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Signing in...");
    const { data, error } = await signIn(email, password);
    if (error) setStatusMsg("Sign in error: " + error.message);
    else setStatusMsg("Signed in");
  };

  const handleSignOut = async () => {
    await signOut();
    setStatusMsg("Signed out");
  };

  // Example: call a protected RPC or table to verify session and show behavior
  const fetchProfile = async () => {
    setStatusMsg("Fetching profile...");
    // Example assumes a 'profiles' table with id = auth.uid()
    const { data, error } = await supabase.from("profiles").select("*").limit(1);
    if (error) setStatusMsg("Profile fetch error: " + error.message);
    else setStatusMsg("Profile fetched: " + JSON.stringify(data));
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h2>Persistent Sessions Demo</h2>
      {initializing ? (
        <div>Loading auth state...</div>
      ) : session ? (
        <div>
          <div>
            <strong>Signed in as:</strong> {session.user.email}
          </div>
          <div>
            <strong>Access token expires at:</strong>{" "}
            {new Date(session.expires_at * 1000).toLocaleString()}
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={fetchProfile}>Fetch Profile (protected)</button>{" "}
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSignIn} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">Sign In</button>
            <button
              type="button"
              onClick={async (e) => {
                // reuse same fields for demo sign up
                await handleSignUp(e as unknown as React.FormEvent);
              }}
            >
              Sign Up
            </button>
          </div>
        </form>
      )}
      <div style={{ marginTop: 16 }}>
        <strong>Status:</strong> {statusMsg ?? "idle"}
      </div>
    </div>
  );
}
