"use client";

import { useEffect, useState } from "react";

interface NanobotConfig {
  framework: "nanobot";
  version: string;
  defaultModel: string;
  workspace: string;
  channels: {
    enabled: string[];
    config: Record<string, any>;
  };
  providers: {
    enabled: string[];
    config: Record<string, any>;
  };
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nanobotData, setNanobotData] = useState<NanobotConfig | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const resp = await fetch("/api/config-nanobot");
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.error || "Failed to load Nanobot config");
        }
        setNanobotData(data);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
        setNanobotData(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading Nanobot configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-100 border border-red-300 rounded p-4 text-red-800 max-w-xl">
          <strong>Error:</strong> {error}
          <div className="mt-2 text-sm text-red-700">
            Check if <span className="font-mono">~/.nanobot/config.json</span> exists or set <span className="font-mono">NANOBOT_HOME</span>.
          </div>
        </div>
      </div>
    );
  }

  if (!nanobotData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Nanobot config not found.</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🤖 Nanobot Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--text-muted)]">Version</div>
          <div className="text-lg font-mono">{nanobotData.version}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--text-muted)]">Default Model</div>
          <div className="text-lg font-mono">{nanobotData.defaultModel}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--text-muted)]">Workspace</div>
          <div className="text-xs font-mono break-all">{nanobotData.workspace}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Enabled Channels</h2>
          <div className="space-y-2">
            {nanobotData.channels?.enabled?.length > 0 ? (
              nanobotData.channels.enabled.map((channel) => (
                <div key={channel} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-green-500">✓</span>
                  <span className="capitalize">{channel}</span>
                </div>
              ))
            ) : (
              <p className="text-[var(--text-muted)] text-sm">No channels enabled</p>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Available Providers</h2>
          <div className="space-y-2">
            {nanobotData.providers?.enabled?.length > 0 ? (
              nanobotData.providers.enabled.map((provider) => (
                <div key={provider} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-blue-500">✓</span>
                  <span className="capitalize">{provider.replace(/_/g, " ")}</span>
                </div>
              ))
            ) : (
              <p className="text-[var(--text-muted)] text-sm">No providers configured</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Configuration</h2>
        <div className="bg-[var(--bg-tertiary)] p-3 rounded font-mono text-sm whitespace-pre-wrap break-all">
          {JSON.stringify(
            {
              channels: nanobotData.channels?.enabled || [],
              providers: nanobotData.providers?.enabled || [],
            },
            null,
            2
          )}
        </div>
      </div>
    </div>
  );
}
