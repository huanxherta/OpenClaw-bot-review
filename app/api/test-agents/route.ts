import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DEFAULT_MODEL_PROBE_TIMEOUT_MS, parseModelRef, probeModel } from "@/lib/model-probe";
import { OPENCLAW_CONFIG_PATH, NANOBOT_CONFIG_PATH, getAvailableSystems } from "@/lib/openclaw-paths";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

const CONFIG_PATH = OPENCLAW_CONFIG_PATH;
const PROBE_TIMEOUT_MS = DEFAULT_MODEL_PROBE_TIMEOUT_MS;

type AgentConfig = {
  id: string;
  model?: string;
};

function loadAgentListOpenClaw(config: any): AgentConfig[] {
  let agentList: AgentConfig[] = config?.agents?.list || [];
  if (agentList.length > 0) return agentList;

  try {
    const agentsDir = path.join(OPENCLAW_HOME, "agents");
    const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
    agentList = dirs
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => ({ id: d.name }));
  } catch {}

  if (agentList.length === 0) return [{ id: "main" }];
  return agentList;
}

function loadAgentListNanobot(config: any): AgentConfig[] {
  let agentList: AgentConfig[] = config?.agents?.list || [];
  if (agentList.length > 0) {
    // 从 nanobot 配置中提取代理信息
    return agentList.map((a: any) => ({
      id: a.id,
      model: a.model || config.agents?.defaults?.model,
    }));
  }
  return [{ id: "main", model: config.agents?.defaults?.model }];
}

export async function POST() {
  try {
    // 检测使用的框架
    const systems = getAvailableSystems();
    const useNanobot = systems.includes("nanobot");

    let raw: string;
    let config: any;
    let agentList: AgentConfig[];
    let defaultModel: string;
    let loadAgentListFn = useNanobot ? loadAgentListNanobot : loadAgentListOpenClaw;

    if (useNanobot) {
      // 使用 nanobot 配置
      raw = fs.readFileSync(NANOBOT_CONFIG_PATH, "utf-8");
      config = JSON.parse(raw);
      defaultModel = config.agents?.defaults?.model || "unknown";
      agentList = loadAgentListFn(config);
    } else {
      // 使用 OpenClaw 配置
      raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      config = JSON.parse(raw);
      const defaults = config?.agents?.defaults || {};
      defaultModel = typeof defaults.model === "string"
        ? defaults.model
        : defaults.model?.primary || "unknown";
      agentList = loadAgentListFn(config);
    }

    const modelProbeTasks = new Map<string, Promise<Awaited<ReturnType<typeof probeModel>>>>();

    for (const agent of agentList) {
      const modelStr = agent.model || defaultModel;
      const { providerId, modelId } = parseModelRef(modelStr);
      const key = `${providerId}/${modelId}`;
      if (!modelProbeTasks.has(key)) {
        modelProbeTasks.set(
          key,
          probeModel({ providerId, modelId, timeoutMs: PROBE_TIMEOUT_MS })
        );
      }
    }

    const modelProbeResults = new Map<string, Awaited<ReturnType<typeof probeModel>>>();
    for (const [key, task] of modelProbeTasks.entries()) {
      modelProbeResults.set(key, await task);
    }

    const results = agentList.map((agent) => {
      const modelStr = agent.model || defaultModel;
      const { providerId, modelId } = parseModelRef(modelStr);
      const key = `${providerId}/${modelId}`;
      const probe = modelProbeResults.get(key);
      if (!probe) {
        return {
          agentId: agent.id,
          model: modelStr,
          ok: false,
          error: `No probe result for model ${key}`,
          elapsed: 0,
          status: "unknown",
          mode: "unknown",
          precision: "provider",
          source: useNanobot ? "nanobot_provider_probe" : "openclaw_provider_probe",
        };
      }
      return {
        agentId: agent.id,
        model: modelStr,
        ok: probe.ok,
        text: probe.text,
        error: probe.error,
        elapsed: probe.elapsed,
        status: probe.status,
        mode: probe.mode,
        precision: probe.precision,
        source: probe.source,
      };
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
