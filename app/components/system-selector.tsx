import { useEffect, useState } from "react";

export interface SystemSelectorProps {
  onSystemChange?: (system: "openclaw" | "nanobot") => void;
  selectedSystem?: "openclaw" | "nanobot";
}

export function SystemSelector({ onSystemChange, selectedSystem = "openclaw" }: SystemSelectorProps) {
  const [availableSystems, setAvailableSystems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/systems")
      .then((r) => r.json())
      .then((data) => {
        setAvailableSystems(data.availableSystems || []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setAvailableSystems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || availableSystems.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2 items-center bg-[var(--bg-secondary)] px-3 py-2 rounded mb-4">
      <span className="text-xs text-[var(--text-muted)] font-medium">System:</span>
      {availableSystems.map((system) => (
        <button
          key={system}
          onClick={() => onSystemChange?.(system as "openclaw" | "nanobot")}
          className={`
            transition-all duration-200 px-3 py-1 rounded text-sm font-medium
            ${
              selectedSystem === system
                ? "bg-[var(--accent-color)] text-white"
                : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-color)]"
            }
          `}
        >
          {system === "openclaw" ? "🐦 OpenClaw" : "🤖 Nanobot"}
        </button>
      ))}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
