import { NextResponse } from "next/server";
import fs from "fs";
import { OPENCLAW_CONFIG_PATH, NANOBOT_CONFIG_PATH, getAvailableSystems } from "@/lib/openclaw-paths";

export async function GET() {
  try {
    const systems = getAvailableSystems();
    const result: any = {
      availableSystems: systems,
      openclaw: null,
      nanobot: null,
    };

    // Load OpenClaw config if available
    if (systems.includes("openclaw")) {
      try {
        const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
        const config = JSON.parse(raw);
        result.openclaw = {
          found: true,
          hasAgents: !!(config.agents?.list && config.agents.list.length > 0),
          agentCount: config.agents?.list?.length || 0,
        };
      } catch (err) {
        result.openclaw = { found: true, error: (err as Error).message };
      }
    }

    // Load Nanobot config if available
    if (systems.includes("nanobot")) {
      try {
        const raw = fs.readFileSync(NANOBOT_CONFIG_PATH, "utf-8");
        const config = JSON.parse(raw);
        result.nanobot = {
          found: true,
          defaultModel: config.agents?.defaults?.model || "unknown",
          hasProviders: !!(config.providers && Object.keys(config.providers).length > 0),
        };
      } catch (err) {
        result.nanobot = { found: true, error: (err as Error).message };
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to detect systems:", err);
    return NextResponse.json({
      availableSystems: [],
      error: (err as Error).message,
    });
  }
}
