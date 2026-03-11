import { NextResponse } from "next/server";
import path from "path";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import { readJsonFileSync } from "@/lib/json";
import { OPENCLAW_CONFIG_PATH, NANOBOT_CONFIG_PATH, getAvailableSystems } from "@/lib/openclaw-paths";

const CONFIG_PATH = OPENCLAW_CONFIG_PATH;
const DEGRADED_LATENCY_MS = 1500;
const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
let cachedOpenclawVersion: { value: string | null; expiresAt: number } | null = null;

function quoteShellArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

async function execOpenclaw(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, FORCE_COLOR: "0" };

  if (process.platform !== "win32") {
    return execFileAsync("openclaw", args, {
      maxBuffer: 10 * 1024 * 1024,
      env,
    });
  }

  const command = `openclaw ${args.map(quoteShellArg).join(" ")}`;
  return execAsync(command, {
    maxBuffer: 10 * 1024 * 1024,
    env,
    shell: "cmd.exe",
  });
}

function parseJsonFromMixedOutput(output: string): any {
  for (let i = 0; i < output.length; i++) {
    if (output[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < output.length; j++) {
      const ch = output[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = output.slice(i, j + 1).trim();
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new Error("Failed to parse JSON from openclaw gateway status output");
}

async function probeGatewayViaCli(token: string, timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
  try {
    const args = ["gateway", "status", "--json", "--timeout", String(timeoutMs)];
    if (token) args.push("--token", token);
    const { stdout, stderr } = await execOpenclaw(args);
    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr || ""}`);
    const ok = parsed?.rpc?.ok === true;
    const error =
      typeof parsed?.rpc?.error === "string" && parsed.rpc.error.trim()
        ? parsed.rpc.error.trim()
        : undefined;
    return { ok, error };
  } catch (err: any) {
    const message = err?.message || "Failed to run openclaw gateway status";
    return { ok: false, error: message };
  }
}

async function probeGatewayViaWeb(port: number, token: string, timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `http://localhost:${port}/chat${token ? `?token=${encodeURIComponent(token)}` : ""}`,
      { signal: controller.signal, cache: "no-store", redirect: "manual" },
    );
    return resp.status >= 200 && resp.status < 400
      ? { ok: true }
      : { ok: false, error: `HTTP ${resp.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to probe gateway web UI" };
  } finally {
    clearTimeout(timeout);
  }
}

async function getOpenclawVersion(): Promise<string | undefined> {
  const now = Date.now();
  if (cachedOpenclawVersion && cachedOpenclawVersion.expiresAt > now) {
    return cachedOpenclawVersion.value || undefined;
  }
  try {
    const { stdout } = await execOpenclaw(["--version"]);
    const version = stdout.trim().split(/\s+/)[0] || null;
    cachedOpenclawVersion = { value: version, expiresAt: now + 60 * 60 * 1000 };
    return version || undefined;
  } catch (err: any) {
    // If command not found, cache the error for 60 seconds
    if (err.code === "ENOENT") {
      cachedOpenclawVersion = { value: null, expiresAt: now + 60 * 1000 };
      return undefined;
    }
    // For other errors, also cache but with shorter expiry
    cachedOpenclawVersion = { value: null, expiresAt: now + 10 * 1000 };
    return undefined;
  }
}

export async function GET() {
  const startedAt = Date.now();
  try {
    // 检测使用的框架
    const systems = getAvailableSystems();
    const useNanobot = systems.includes("nanobot");

    if (useNanobot) {
      // Nanobot gateway 检查
      try {
        const config = readJsonFileSync<any>(NANOBOT_CONFIG_PATH);
        const port = config.gateway?.port || 18790;
        const token = config.gateway?.token || "";
        const webUrl = `http://localhost:${port}/chat${token ? '?token=' + encodeURIComponent(token) : ''}`;

        const url = `http://localhost:${port}/api/health`;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const resp = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
          clearTimeout(timeout);
          
          const checkedAt = Date.now();
          const responseMs = checkedAt - startedAt;
          
          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            return NextResponse.json({
              ok: true,
              data,
              framework: "nanobot",
              status: responseMs > DEGRADED_LATENCY_MS ? "degraded" : "healthy",
              checkedAt,
              responseMs,
              webUrl,
            });
          } else {
            return NextResponse.json({
              ok: false,
              framework: "nanobot",
              error: `HTTP ${resp.status}`,
              status: "down",
              checkedAt,
              responseMs,
            });
          }
        } catch (err: any) {
          clearTimeout(timeout);
          const checkedAt = Date.now();
          const responseMs = checkedAt - startedAt;
          
          // 提供更详细的错误信息
          let errorMsg = "Gateway connection failed";
          if (err?.name === "AbortError") {
            errorMsg = `Gateway timeout (${responseMs}ms) - check if nanobot gateway is running on port ${port}`;
          } else if (err?.cause?.code === "ECONNREFUSED") {
            errorMsg = `Connection refused on port ${port} - nanobot gateway may not be running`;
          } else if (err?.message) {
            errorMsg = err.message;
          }
          
          return NextResponse.json({
            ok: false,
            framework: "nanobot",
            error: errorMsg,
            status: "down",
            gateway_port: port,
            checkedAt,
            responseMs,
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          ok: false,
          framework: "nanobot",
          error: `Failed to load nanobot config: ${err.message}`,
          status: "down",
          checkedAt: Date.now(),
          responseMs: Date.now() - startedAt,
        });
      }
    }

    // OpenClaw gateway 检查（原有逻辑）
    const openclawVersion = await getOpenclawVersion();
    const config = readJsonFileSync<any>(OPENCLAW_CONFIG_PATH);
    const port = config.gateway?.port || 18789;
    const token = config.gateway?.auth?.token || "";
    const webUrl = `http://localhost:${port}/chat${token ? '?token=' + encodeURIComponent(token) : ''}`;

    const url = `http://localhost:${port}/api/health`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    if (resp.ok) {
      const checkedAt = Date.now();
      const responseMs = checkedAt - startedAt;
      const data = await resp.json().catch(() => null);
      return NextResponse.json({
        ok: true,
        data,
        openclawVersion,
        status: responseMs > DEGRADED_LATENCY_MS ? "degraded" : "healthy",
        checkedAt,
        responseMs,
        webUrl,
      });
    }

    const web = await probeGatewayViaWeb(port, token, 5000);
    if (web.ok) {
      const checkedAt = Date.now();
      const responseMs = checkedAt - startedAt;
      return NextResponse.json({
        ok: true,
        data: null,
        openclawVersion,
        status: resp.status === 404 ? "healthy" : "degraded",
        checkedAt,
        responseMs,
        webUrl,
      });
    }

    // OpenClaw 2026.3.x no longer serves /api/health; fallback to CLI probe.
    const cli = await probeGatewayViaCli(token, 5000);
    const checkedAt = Date.now();
    const responseMs = checkedAt - startedAt;
    if (cli.ok) {
      return NextResponse.json({
        ok: true,
        data: null,
        openclawVersion,
        status: "healthy",
        checkedAt,
        responseMs,
        webUrl,
      });
    }

    return NextResponse.json({
      ok: false,
      openclawVersion,
      error: cli.error || `HTTP ${resp.status}`,
      status: "down",
      checkedAt,
      responseMs,
    });
  } catch (err: any) {
    const openclawVersion = await getOpenclawVersion();
    // If HTTP probe fails due transport/runtime issues, attempt CLI probe before declaring down.
    const raw = err.cause?.code === "ECONNREFUSED"
      ? "Gateway 未运行"
      : err.name === "AbortError"
        ? "请求超时"
        : err.message;
    const token = (() => {
      try {
        const cfg = readJsonFileSync<any>(CONFIG_PATH);
        return cfg.gateway?.auth?.token || "";
      } catch {
        return "";
      }
    })();
    const port = (() => {
      try {
        const cfg = readJsonFileSync<any>(CONFIG_PATH);
        return cfg.gateway?.port || 18789;
      } catch {
        return 18789;
      }
    })();
    const web = await probeGatewayViaWeb(port, token, 5000);
    if (web.ok) {
      const checkedAt = Date.now();
      const responseMs = checkedAt - startedAt;
      return NextResponse.json({
        ok: true,
        data: null,
        openclawVersion,
        status: "degraded",
        checkedAt,
        responseMs,
        webUrl: `http://localhost:${port}/chat${token ? '?token=' + encodeURIComponent(token) : ''}`,
      });
    }
    const cli = await probeGatewayViaCli(token, 5000);
    const checkedAt = Date.now();
    const responseMs = checkedAt - startedAt;
    if (cli.ok) {
      return NextResponse.json({
        ok: true,
        data: null,
        openclawVersion,
        status: "healthy",
        checkedAt,
        responseMs,
        webUrl: `http://localhost:${port}/chat${token ? '?token=' + encodeURIComponent(token) : ''}`,
      });
    }
    return NextResponse.json({
      ok: false,
      openclawVersion,
      error: cli.error || raw,
      status: "down",
      checkedAt,
      responseMs,
    });
  }
}
