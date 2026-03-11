"""
OpenClaw-bot-review Nanobot Support Integration Guide

This document describes how to enable Nanobot support in OpenClaw-bot-review.

## Features Added

1. **Dual System Detection** — Automatically detects OpenClaw and/or Nanobot installations
2. **Nanobot Config API** — New endpoint to read nanobot config.json
3. **System Selection UI** — Add a toggle/selector to switch between systems
4. **Path Flexibility** — Supports OPENCLAW_HOME and NANOBOT_HOME environment variables

## Files Created/Modified

### New API Endpoints:
- `/api/systems/route.ts` — Detects available bot systems
- `/api/config-nanobot/route.ts` — Reads nanobot configuration
- `/api/config-unified/route.ts` — Loads both systems in parallel

### Modified Files:
- `lib/openclaw-paths.ts` — Added nanobot path support and system detection

## Setup Instructions

### 1. Environment Variables (Optional)

Set custom paths for both systems:

\`\`\`bash
# OpenClaw (default: ~/.openclaw)
export OPENCLAW_HOME=/path/to/openclaw

# Nanobot (default: ~/.nanobot)
export NANOBOT_HOME=/path/to/nanobot

npm run dev
\`\`\`

### 2. Frontend Integration (TODO)

To enable the UI toggle between systems, add to your page.tsx:

\`\`\`typescript
// Add state for system selection
const [selectedSystem, setSelectedSystem] = useState<'openclaw' | 'nanobot'>('openclaw');
const [availableSystems, setAvailableSystems] = useState<string[]>([]);

// Fetch available systems on mount
useEffect(() => {
  fetch('/api/systems')
    .then(r => r.json())
    .then(data => setAvailableSystems(data.availableSystems))
    .catch(console.error);
}, []);

// Load config based on selected system
const configUrl = selectedSystem === 'nanobot' ? '/api/config-nanobot' : '/api/config';

// Add UI selector
{availableSystems.length > 1 && (
  <div className="flex gap-2 mb-4">
    {availableSystems.map(sys => (
      <button
        key={sys}
        onClick={() => setSelectedSystem(sys as any)}
        className={`px-3 py-1 rounded ${
          selectedSystem === sys ? 'bg-blue-500 text-white' : 'bg-gray-200'
        }`}
      >
        {sys.toUpperCase()}
      </button>
    ))}
  </div>
)}
\`\`\`

### 3. Nanobot Config Limitations

OpenClaw-bot-review was designed for OpenClaw's multi-agent architecture. 
Nanobot has a simpler single-config model:

- **OpenClaw**: Multiple agents with individual configurations
- **Nanobot**: Single configuration with global channels/providers

When viewing nanobot config, you'll see:
- Single unified configuration (not per-agent)
- Enabled channels and their status
- Available providers and models
- Default workspace path

### 4. Advanced: Full UI Migration

For complete Nanobot UI support with agent management, consider:

1. Create a separate dashboard component for Nanobot
2. Parse nanobot workspace structure differently
3. Display nanobot's channel configurations
4. Show nanobot's provider status

## API Reference

### GET /api/systems

Detects which bot systems are available
\`\`\`json
{
  "availableSystems": ["openclaw", "nanobot"],
  "openclaw": { "found": true, "agentCount": 3 },
  "nanobot": { "found": true, "defaultModel": "gpt-4" }
}
\`\`\`

### GET /api/config-nanobot

Returns nanobot configuration
\`\`\`json
{
  "framework": "nanobot",
  "version": "0.1.4.post4",
  "defaultModel": "gpt-4",
  "workspace": "~/.nanobot/workspace",
  "channels": { "enabled": ["telegram", "feishu"], "config": {...} },
  "providers": { "enabled": ["openai", "deepseek"], "config": {...} }
}
\`\`\`

### GET /api/config

Original OpenClaw config endpoint (unchanged)

## Troubleshooting

### Nanobot config not found
- Check if ~/.nanobot/config.json exists
- Verify NANOBOT_HOME environment variable if using custom path
- Ensure nanobot is properly installed

### Both systems detected but only one loads
- Check browser console for CORS or network errors
- Verify both config files have valid JSON
- Check NextJS logs for server-side errors

## Future Enhancements

- [ ] Display nanobot agent logs in UI
- [ ] Show nanobot session statistics
- [ ] Add nanobot health check endpoint
- [ ] Unified stats across both systems
- [ ] Combined agent/provider management interface
"""
