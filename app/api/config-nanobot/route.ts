import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { NANOBOT_CONFIG_PATH, NANOBOT_HOME } from "@/lib/openclaw-paths";

// 30秒内存缓存
let configCache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function GET() {
  // 命中缓存直接返回
  if (configCache && Date.now() - configCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(configCache.data);
  }

  try {
    if (!fs.existsSync(NANOBOT_CONFIG_PATH)) {
      return NextResponse.json({ error: "Nanobot config not found" }, { status: 404 });
    }

    const raw = fs.readFileSync(NANOBOT_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);

    // 提取 agents 和 channels 信息
    const channels = config.channels || {};
    const providers = config.providers || {};
    const defaultModel = config.agents?.defaults?.model || "unknown";
    const workspace = config.agents?.defaults?.workspace || path.join(NANOBOT_HOME, "workspace");

    // 统计启用的 channel
    const enabledChannels = Object.entries(channels)
      .filter(([_, cfg]: [string, any]) => cfg?.enabled)
      .map(([name]) => name);

    // 统计启用的 provider
    const enabledProviders = Object.entries(providers)
      .filter(([_, cfg]: [string, any]) => cfg?.api_key)
      .map(([name]) => name);

    // Nanobot 返回的是统一配置，而不是单个 agents
    // 返回一个简化的结构，表示 nanobot 本身作为一个"agent"
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

    // 更新缓存
    configCache = { data: result, ts: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to load nanobot config:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
