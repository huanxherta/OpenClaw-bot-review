"use client";

/**
 * INTEGRATION EXAMPLE: DualSystemDashboard
 * 
 * This component demonstrates how to integrate Nanobot support into
 * the existing OpenClaw-bot-review dashboard.
 * 
 * Usage in page.tsx:
 * 1. Import: import { DualSystemDashboard } from "@/app/components/dual-system-dashboard";
 * 2. Replace main dashboard rendering with <DualSystemDashboard />
 */

import { useEffect, useState } from "react";
import { SystemSelector } from "./system-selector";

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

interface OpenClawConfig {
  agents: Array<{
    id: string;
    name: string;
    emoji: string;
    model: string;
    platforms: Array<{ name: string }>;
  }>;
  defaults: { model: string };
  gateway?: { port: number };
}

export function DualSystemDashboard() {
  const [selectedSystem, setSelectedSystem] = useState<"openclaw" | "nanobot">("openclaw");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opencrawData, setOpenClawData] = useState<OpenClawConfig | null>(null);
  const [nanobotData, setNanobotData] = useState<NanobotConfig | null>(null);

  // Load both configs on mount
  useEffect(() => {
    const loadConfigs = async () => {
      setLoading(true);
      try {
        const [ocRes, nbRes] = await Promise.all([
          fetch("/api/config").catch(() => null),
          fetch("/api/config-nanobot").catch(() => null),
        ]);

        if (ocRes?.ok) {
          setOpenClawData(await ocRes.json());
        }
        if (nbRes?.ok) {
          setNanobotData(await nbRes.json());
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadConfigs();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-6xl mx-auto">
      {/* System Selector */}
      <SystemSelector selectedSystem={selectedSystem} onSystemChange={setSelectedSystem} />

      {/* OpenClaw Dashboard */}
      {selectedSystem === "openclaw" && opencrawData ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">🐦 OpenClaw Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <div className="text-sm text-[var(--text-muted)]">Agents</div>
              <div className="text-3xl font-bold">{opencrawData.agents?.length || 0}</div>
            </div>
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <div className="text-sm text-[var(--text-muted)]">Default Model</div>
              <div className="text-lg font-mono">{opencrawData.defaults?.model || "N/A"}</div>
            </div>
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <div className="text-sm text-[var(--text-muted)]">Gateway Port</div>
              <div className="text-3xl font-bold">{opencrawData.gateway?.port || "N/A"}</div>
            </div>
          </div>

          {/* Agents List */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Agents</h2>
            <div className="space-y-2">
              {opencrawData.agents?.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div className="flex-1">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{agent.model}</div>
                  </div>
                  <div className="text-xs">
                    {agent.platforms?.length || 0} platform{agent.platforms?.length !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Nanobot Dashboard */}
      {selectedSystem === "nanobot" && nanobotData ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">🤖 Nanobot Configuration</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <div className="text-sm text-[var(--text-muted)]">Version</div>
              <div className="text-lg font-mono">{nanobotData.version}</div>
            </div>
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
              <div className="text-sm text-[var(--text-muted)]">Default Model</div>
              <div className="text-lg font-mono">{nanobotData.defaultModel}</div>
            </div>
          </div>

          {/* Channels */}
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

            {/* Providers */}
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

          {/* Workspace Info */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Configuration</h2>
            <div className="bg-[var(--bg-tertiary)] p-3 rounded font-mono text-sm whitespace-pre-wrap break-all">
              {nanobotData.workspace}
            </div>
          </div>
        </div>
      ) : null}

      {/* Missing Config */}
      {error && (
        <div className="bg-red-100 border border-red-300 rounded p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {selectedSystem === "openclaw" && !opencrawData && (
        <div className="bg-yellow-100 border border-yellow-300 rounded p-4 text-yellow-800">
          <strong>OpenClaw config not found.</strong> Check if ~/.openclaw/openclaw.json exists or set OPENCLAW_HOME.
        </div>
      )}

      {selectedSystem === "nanobot" && !nanobotData && (
        <div className="bg-yellow-100 border border-yellow-300 rounded p-4 text-yellow-800">
          <strong>Nanobot config not found.</strong> Check if ~/.nanobot/config.json exists or set NANOBOT_HOME.
        </div>
      )}
    </div>
  );
}
