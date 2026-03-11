import { NextResponse } from "next/server";
import { getAvailableSystems } from "@/lib/openclaw-paths";

export async function GET() {
  try {
    const systems = getAvailableSystems();
    
    // 如果同时有两个系统，返回都要加载
    // 如果只有一个，则只加载那个
    const loadSystems = systems.length > 0 ? systems : ["openclaw"]; // 默认尝试加载 openclaw

    const results: Record<string, any> = {};

    // 并行加载两个系统的配置
    const promises = loadSystems.map(async (system) => {
      try {
        if (system === "openclaw") {
          const res = await fetch("http://localhost:3000/api/config", {
            cache: "no-store",
          });
          if (res.ok) {
            results.openclaw = await res.json();
          }
        } else if (system === "nanobot") {
          const res = await fetch("http://localhost:3000/api/config-nanobot", {
            cache: "no-store",
          });
          if (res.ok) {
            results.nanobot = await res.json();
          }
        }
      } catch (err) {
        console.error(`Failed to load ${system} config:`, err);
      }
    });

    await Promise.all(promises);

    return NextResponse.json({
      systems: loadSystems,
      configs: results,
    });
  } catch (err) {
    console.error("Failed to load unified config:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
