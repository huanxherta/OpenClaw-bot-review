#!/bin/bash
# Quick Test Script for OpenClaw-bot-review Nanobot Support
# 快速测试脚本：验证 OpenClaw-bot-review Nanobot 支持

echo "🔍 Checking system configurations..."
echo ""

# Check OpenClaw
if [ -f ~/.openclaw/openclaw.json ]; then
    echo "✅ OpenClaw config found: ~/.openclaw/openclaw.json"
    echo "   Agent count: $(jq '.agents.list | length' ~/.openclaw/openclaw.json 2>/dev/null || echo 'N/A')"
else
    echo "❌ OpenClaw config not found: ~/.openclaw/openclaw.json"
fi

echo ""

# Check Nanobot
if [ -f ~/.nanobot/config.json ]; then
    echo "✅ Nanobot config found: ~/.nanobot/config.json"
    echo "   Default model: $(jq -r '.agents.defaults.model' ~/.nanobot/config.json 2>/dev/null || echo 'N/A')"
    echo "   Enabled channels: $(jq -r '.channels | to_entries | map(select(.value.enabled==true) | .key) | join(", ")' ~/.nanobot/config.json 2>/dev/null || echo 'N/A')"
else
    echo "❌ Nanobot config not found: ~/.nanobot/config.json"
fi

echo ""
echo "📝 Testing API endpoints (requires server running on http://localhost:3000)..."
echo ""

# Test systems endpoint
echo "Testing /api/systems endpoint..."
curl -s http://localhost:3000/api/systems | jq '.' || echo "❌ Could not reach /api/systems"

echo ""
echo "Testing /api/config-nanobot endpoint..."
curl -s http://localhost:3000/api/config-nanobot | jq '.' || echo "❌ Could not reach /api/config-nanobot"

echo ""
echo "✨ Test complete!"
