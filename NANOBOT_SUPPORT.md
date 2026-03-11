# OpenClaw-bot-review Nanobot Support

## 🎉 What's New

OpenClaw-bot-review 现在支持 **Nanobot**！现在你可以用同一个仪表板查看和管理 OpenClaw 和 Nanobot 的配置。

### ✨ 新增功能

- **自动系统检测** — 自动检查你有哪些系统（OpenClaw、Nanobot 或两者）
- **灵活的系统切换** — UI 中添加系统选择器，快速在两个系统间切换
- **Nanobot 配置 API** — 新增 `/api/config-nanobot` 端点读取 nanobot 配置
- **独立路径管理** — `OPENCLAW_HOME` 和 `NANOBOT_HOME` 环境变量支持

## 🚀 快速开始

### 基础使用（OpenClaw 保持不变）

```bash
npm run dev
```

访问 http://localhost:3000

### 添加 Nanobot 支持

无需额外配置！如果你的 `~/.nanobot/config.json` 存在，系统会自动检测到。

### 自定义路径

```bash
# 两个系统都用自定义路径
export OPENCLAW_HOME=/path/to/openclaw
export NANOBOT_HOME=/path/to/nanobot
npm run dev
```

## 📁 文件结构

### 新增文件

```
app/
  api/
    config-nanobot/        # Nanobot 配置读取
    config-unified/        # 统一配置加载（可选）
    systems/              # 系统检测
  components/
    system-selector.tsx    # 系统选择器组件
    dual-system-dashboard.tsx # 完整示例仪表板
lib/
  openclaw-paths.ts        # 更新的路径管理（支持两个系统）
NANOBOT_INTEGRATION.md     # 详细集成指南
```

## 🔧 集成指南

### 方案 1：使用系统选择器组件（推荐）

在 `app/page.tsx` 中导入并使用系统选择器：

```typescript
import { SystemSelector } from "@/app/components/system-selector";

export default function Home() {
  const [selectedSystem, setSelectedSystem] = useState<'openclaw' | 'nanobot'>('openclaw');
  
  return (
    <>
      <SystemSelector selectedSystem={selectedSystem} onSystemChange={setSelectedSystem} />
      
      {/* 根据 selectedSystem 加载不同的配置 */}
      {selectedSystem === 'openclaw' 
        ? /* 现有 OpenClaw 代码 */
        : /* Nanobot 代码 */
      }
    </>
  );
}
```

### 方案 2：使用完整示例仪表板

替换你的 `app/page.tsx`：

```typescript
import { DualSystemDashboard } from "@/app/components/dual-system-dashboard";

export default function Home() {
  return <DualSystemDashboard />;
}
```

### 方案 3：手动集成

直接调用新的 API 端点：

```typescript
// 检测可用系统
const systems = await fetch('/api/systems').then(r => r.json());

// 加载 Nanobot 配置
const nanobotConfig = await fetch('/api/config-nanobot').then(r => r.json());

// 同时加载两个系统
const bothConfigs = await fetch('/api/config-unified').then(r => r.json());
```

## 📊 API 端点

### `GET /api/systems`

检测可用的系统

**响应：**
```json
{
  "availableSystems": ["openclaw", "nanobot"],
  "openclaw": {
    "found": true,
    "agentCount": 3
  },
  "nanobot": {
    "found": true,
    "defaultModel": "gpt-4"
  }
}
```

### `GET /api/config-nanobot`

获取 Nanobot 配置

**响应：**
```json
{
  "framework": "nanobot",
  "version": "0.1.4.post4",
  "defaultModel": "gpt-4",
  "workspace": "/home/user/.nanobot/workspace",
  "channels": {
    "enabled": ["telegram", "feishu"],
    "config": { /* channel configs */ }
  },
  "providers": {
    "enabled": ["openai", "deepseek"],
    "config": { /* provider configs */ }
  }
}
```

### `GET /api/config`（原有）

获取 OpenClaw 配置（功能不变）

## ⚠️ 限制和注意事项

### Nanobot 架构差异

Nanobot 和 OpenClaw 的架构不同：

| 特性 | OpenClaw | Nanobot |
|------|----------|---------|
| 架构 | 多 Agent 系统 | 单一配置系统 |
| Agent 数量 | 多个独立 Agent | 统一管理 |
| 会话存储 | 按 Agent 分类 | 全局存储 |
| 配置文件 | 一个主配置 | 一个全局配置 |

### 当前支持功能

✅ 直接支持：
- 读取配置文件
- 检测启用的 Channel
- 检测配置的 Provider
- 显示默认模型

⚠️ 部分支持：
- Channel 和 Provider 状态（基本信息）

❌ 不支持（需要额外开发）：
- 实时 Agent 活动（Nanobot 没有多 Agent 概念）
- 会话统计
- 群聊信息
- Gateway 健康检查

### 为何有这些差异？

OpenClaw 的架构基于多 Agent，有详细的会话追踪。Nanobot 的设计更轻量，没有 Agent 级别的个别追踪。

## 🔍 故障排除

### 问题：Nanobot 配置找不到

**原因：**
- `~/.nanobot/config.json` 不存在
- Nanobot 未安装或未配置

**解决：**
```bash
# 检查文件是否存在
ls ~/.nanobot/config.json

# 指定自定义路径
export NANOBOT_HOME=/path/to/nanobot
npm run dev
```

### 问题：系统选择器没有显示

**原因：**
- 只找到一个系统（显示器只在有2个+系统时出现）
- API 加载失败

**解决：**
```bash
# 检查浏览器控制台（F12）的网络请求
# 确保两个配置文件都存在且有效
cat ~/.openclaw/openclaw.json | json_pp
cat ~/.nanobot/config.json | json_pp
```

### 问题：一个系统的配置显示错误

**原因：**
- 配置文件 JSON 格式错误
- 权限问题
- 环境变量设置错误

**解决：**
```bash
# 验证 JSON 格式
node -e "console.log(JSON.parse(require('fs').readFileSync('~/.nanobot/config.json')))"

# 检查权限
ls -la ~/.nanobot/config.json

# 查看 NextJS 服务器日志中的错误信息
```

## 📚 示例

### 显示两个系统的信息

```typescript
async function loadBothSystems() {
  const [ocRes, nbRes] = await Promise.all([
    fetch('/api/config'),
    fetch('/api/config-nanobot'),
  ]);
  
  const openclaw = await ocRes.json();
  const nanobot = await nbRes.json();
  
  console.log('OpenClaw Agents:', openclaw.agents.length);
  console.log('Nanobot Model:', nanobot.defaultModel);
  console.log('Nanobot Channels:', nanobot.channels.enabled);
}
```

### 让用户选择系统

```typescript
const [system, setSystem] = useState('openclaw');

<select value={system} onChange={(e) => setSystem(e.target.value)}>
  <option value="openclaw">OpenClaw</option>
  <option value="nanobot">Nanobot</option>
</select>

const configUrl = system === 'nanobot' ? '/api/config-nanobot' : '/api/config';
const config = await fetch(configUrl).then(r => r.json());
```

## 🎯 未来计划

- [ ] 完整的 Nanobot 会话查看器
- [ ] Nanobot 日志浏览
- [ ] 统一的统计仪表板
- [ ] 实时系统监控（两个系统）
- [ ] 配置编辑界面（两个系统）
- [ ] 更深入的集成示例

## 📞 需要帮助？

- 查看 `NANOBOT_INTEGRATION.md` 了解详细的集成指南
- 检查 `app/components/dual-system-dashboard.tsx` 的完整实现示例
- 查看新的 API 端点源代码获取实现细节

---

**现在你可以在同一个仪表板中管理 OpenClaw 和 Nanobot！** 🎉
