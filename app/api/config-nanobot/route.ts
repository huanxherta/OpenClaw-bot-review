import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { NANOBOT_CONFIG_PATH, NANOBOT_HOME, OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

// 30秒内存缓存
let configCache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function GET() {
  // 命中缓存直接返回
  if (configCache && Date.now() - configCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(configCache.data);
  }

  try {
    // 优先尝试 Nanobot 配置
    let configPath = NANOBOT_CONFIG_PATH;
    let configHome = NANOBOT_HOME;
    let framework = "nanobot";

    console.log("[Nanobot Config] Nanobot path:", NANOBOT_CONFIG_PATH, "exists:", fs.existsSync(NANOBOT_CONFIG_PATH));
    console.log("[Nanobot Config] OpenClaw path:", OPENCLAW_CONFIG_PATH, "exists:", fs.existsSync(OPENCLAW_CONFIG_PATH));

    if (!fs.existsSync(NANOBOT_CONFIG_PATH)) {
      // 如果 Nanobot 不存在，尝试 OpenClaw
      if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
        configPath = OPENCLAW_CONFIG_PATH;
        configHome = OPENCLAW_HOME;
        framework = "openclaw";
        console.log("[Nanobot Config] Nanobot not found, using OpenClaw fallback");
      } else {
        console.error("[Nanobot Config] Neither Nanobot nor OpenClaw config found!");
        return NextResponse.json(
          { 
            error: "Neither Nanobot nor OpenClaw configuration found",
            nanobot_path: NANOBOT_CONFIG_PATH,
            openclaw_path: OPENCLAW_CONFIG_PATH
          },
          { status: 404 }
        );
      }
    } else {
      console.log("[Nanobot Config] Using Nanobot config");
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);

    if (framework === "openclaw") {
      // 返回 OpenClaw 配置（兼容格式）
      const defaults = config.agents?.defaults || {};
      const defaultModel = typeof defaults.model === "string"
        ? defaults.model
        : defaults.model?.primary || "unknown";

      const result = {
        framework: "openclaw",
        version: config.version || "unknown",
        defaultModel,
        workspace: path.join(configHome, "workspace"),
        agents: (config.agents?.list || []).length,
        channels: {
          enabled: Object.entries(config.channels || {})
            .filter(([_, cfg]: [string, any]) => cfg?.enabled)
            .map(([name]) => name),
          config: config.channels || {},
        },
      };

      configCache = { data: result, ts: Date.now() };
      return NextResponse.json(result);
    } else {
      // 返回 Nanobot 配置
      const channels = config.channels || {};
      const providers = config.providers || {};
      const defaultModel = config.agents?.defaults?.model || "unknown";
      const workspace = config.agents?.defaults?.workspace || path.join(configHome, "workspace");

      // 统计启用的 channel
      const enabledChannels = Object.entries(channels)
        .filter(([_, cfg]: [string, any]) => cfg?.enabled)
        .map(([name]) => name);

      // 统计启用的 provider
      const enabledProviders = Object.entries(providers)
        .filter(([_, cfg]: [string, any]) => cfg?.api_key)
        .map(([name]) => name);

      const result = {
        framework: "nanobot",
        version: config.version || "unknown",
        defaultModel,
        workspace,
        channels: {
          enabled: enabledChannels,
          config: channels,
        },
        providers: {
          enabled: enabledProviders,
          config: providers,
        },
      };

      configCache = { data: result, ts: Date.now() };
      return NextResponse.json(result);
    }
  } catch (err: any) {
    console.error("[Nanobot Config] Error loading config:", err.message);
    console.error("[Nanobot Config] Error code:", err.code);
    console.error("[Nanobot Config] Nanobot path:", NANOBOT_CONFIG_PATH);
    console.error("[Nanobot Config] OpenClaw path:", OPENCLAW_CONFIG_PATH);
    return NextResponse.json(
      { 
        error: (err as Error).message,
        code: err.code,
        nanobot_path: NANOBOT_CONFIG_PATH,
        openclaw_path: OPENCLAW_CONFIG_PATH
      },
      { status: 500 }
    );
  }
}
