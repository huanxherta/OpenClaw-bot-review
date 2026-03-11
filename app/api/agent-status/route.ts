import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { OPENCLAW_HOME, NANOBOT_CONFIG_PATH, getAvailableSystems } from "@/lib/openclaw-paths";

// 状态: working(2分钟内有assistant消息) / online(10分钟内) / idle(24小时内) / offline(超过24小时)
type AgentState = "working" | "online" | "idle" | "offline";

interface AgentStatus {
  agentId: string;
  state: AgentState;
  lastActive: number | null;
}

function getAgentStateOpenClaw(agentId: string): AgentStatus {
  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);
  const now = Date.now();
  let lastActive: number | null = null;
  let lastAssistantTs: number | null = null;

  // 从 sessions.json 获取最近活跃时间
  try {
    const sessionsPath = path.join(sessionsDir, "sessions.json");
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    for (const val of Object.values(sessions)) {
      const ts = (val as any).updatedAt || 0;
      if (ts > (lastActive || 0)) lastActive = ts;
    }
  } catch {}

  // 扫描最近的 jsonl 文件，找最近的 assistant 消息时间
  try {
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5); // 只看最近5个文件

    for (const file of files) {
      // 只看最近3分钟内修改过的文件
      if (now - file.mtime > 3 * 60 * 1000) continue;

      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      // 从后往前扫描，找最近的 assistant 消息
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "message" && entry.message?.role === "assistant" && entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (!lastAssistantTs || ts > lastAssistantTs) lastAssistantTs = ts;
            if (ts > (lastActive || 0)) lastActive = ts;
          }
        } catch {}
      }
    }
  } catch {}

  let state: AgentState = "offline";
  if (lastActive) {
    const diff = now - lastActive;
    if (lastAssistantTs && now - lastAssistantTs < 3 * 60 * 1000) {
      state = "working";
    } else if (diff < 10 * 60 * 1000) {
      state = "online";
    } else if (diff < 24 * 60 * 60 * 1000) {
      state = "idle";
    }
  }

  return { agentId, state, lastActive };
}

function getAgentStateNanobot(agentId: string): AgentStatus {
  const nanobotHome = path.join(os.homedir(), ".nanobot");
  const workspaceDir = path.join(nanobotHome, "workspace");
  const agentDir = path.join(workspaceDir, agentId);
  const sessionsDir = path.join(agentDir, "sessions");
  
  const now = Date.now();
  let lastActive: number | null = null;
  let lastAssistantTs: number | null = null;

  // 扫描会话目录中的 jsonl 文件
  try {
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5); // 只看最近5个文件

    for (const file of files) {
      // 只看最近3分钟内修改过的文件
      if (now - file.mtime > 3 * 60 * 1000) continue;

      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      
      // 从后往前扫描，找最近的 assistant 消息
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "message" && entry.message?.role === "assistant" && entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (!lastAssistantTs || ts > lastAssistantTs) lastAssistantTs = ts;
            if (ts > (lastActive || 0)) lastActive = ts;
          }
        } catch {}
      }
      
      // 获取文件的修改时间作为最后活跃时间
      if (!lastActive || file.mtime > lastActive) {
        lastActive = file.mtime;
      }
    }
  } catch {}

  let state: AgentState = "offline";
  if (lastActive) {
    const diff = now - lastActive;
    if (lastAssistantTs && now - lastAssistantTs < 3 * 60 * 1000) {
      state = "working";
    } else if (diff < 10 * 60 * 1000) {
      state = "online";
    } else if (diff < 24 * 60 * 60 * 1000) {
      state = "idle";
    }
  }

  return { agentId, state, lastActive };
}

export async function GET() {
  try {
    // 检测使用的框架
    const systems = getAvailableSystems();
    const useNanobot = systems.includes("nanobot");
    const useOpenClaw = systems.includes("openclaw");

    let agentIds: string[] = [];
    let getAgentStateFn = useNanobot ? getAgentStateNanobot : getAgentStateOpenClaw;

    if (useNanobot) {
      // 从 nanobot 配置文件中获取代理列表
      try {
        const raw = fs.readFileSync(NANOBOT_CONFIG_PATH, "utf-8");
        const config = JSON.parse(raw);
        agentIds = config.agents?.list?.map((a: any) => a.id) || ["main"];
        if (agentIds.length === 0) agentIds = ["main"];
      } catch {
        agentIds = ["main"];
      }
    } else if (useOpenClaw) {
      // 从 OpenClaw 目录中获取代理列表
      const agentsDir = path.join(OPENCLAW_HOME, "agents");
      try {
        agentIds = fs.readdirSync(agentsDir, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith("."))
          .map(d => d.name);
      } catch {
        agentIds = ["main"];
      }
    } else {
      agentIds = ["main"];
      getAgentStateFn = getAgentStateOpenClaw; // 默认使用 OpenClaw
    }

    // 获取所有代理的状态
    const statuses = agentIds.map(id => getAgentStateFn(id));
    return NextResponse.json({ statuses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
