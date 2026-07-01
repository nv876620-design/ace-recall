"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060913] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const apiToken = (session as any)?.apiToken || "No token available";
  const configSettings = (session as any)?.configSettings || "{}";

  const handleCopy = () => {
    navigator.clipboard.writeText(apiToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (confirm("Are you sure? This will invalidate your current API token.")) {
      setIsRegenerating(true);
      try {
        const res = await fetch("/api/token/regenerate", { method: "POST" });
        if (res.ok) {
          // Force session reload
          window.location.reload();
        }
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white overflow-hidden relative p-8">
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/5 rounded-full blur-[120px]" />
      
      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">🚀</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">ACE Dashboard</h1>
              <p className="text-sm text-slate-400">Welcome, {session?.user?.name || session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Token Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-indigo-400">🔑</span> API Authentication
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Your API Token</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={apiToken}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-indigo-500/50"
                />
                <button 
                  onClick={handleCopy}
                  className="px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/20 rounded-xl transition-all"
                >
                  {isCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Use this token to authenticate your requests to the ACE server. Keep it secure and do not share it.
            </p>

            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate Token"}
            </button>
          </div>

          {/* Config Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-emerald-400">⚙️</span> Configuration Settings
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Engine Settings (JSON)</label>
              <textarea 
                rows={8}
                defaultValue={configSettings}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-300 font-mono text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
              ></textarea>
            </div>

            <button 
              className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
