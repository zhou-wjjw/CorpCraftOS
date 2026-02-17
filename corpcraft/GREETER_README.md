# Modern Multi-Language Greeter - 快速开始指南

一个简洁优雅的多语言问候系统，展示现代 JavaScript/TypeScript 最佳实践。

## 快速开始

### 1. 基本使用 (JavaScript)

```bash
# 默认问候
node greeter.js
# 输出: Hello, World!

# 个性化问候
node greeter.js --name Alice
# 输出: Hello, Alice!

# 中文问候
node greeter.js --language zh
# 输出: 你好, World!

# 重复问候
node greeter.js --name Bob --times 3
# 输出:
# Hello, Bob! (1/3)
# Hello, Bob! (2/3)
# Hello, Bob! (3/3)
```

### 2. TypeScript 版本

```bash
# 使用 ts-node 运行 TypeScript 版本
ts-node greeter.ts --name "Alice" --language zh
# 输出: 你好, Alice!
```

### 3. 运行所有示例

```bash
# 运行示例脚本
./run-greeter-examples.sh
```

## 输出格式

### JSON 格式

```bash
node greeter.js --name "Carlos" --language es --format json
```

输出:
```json
{
  "greeting": "Hola",
  "target": "Carlos",
  "times": 1,
  "language": "es",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "supportedLanguages": ["en", "zh", "es", "fr", "de", "ja", "ko", ...]
}
```

### HTML 格式

```bash
# 生成 HTML 文件
node greeter.js --name "CorpCraft" --language zh --format html > hello.html

# 在浏览器中打开
open hello.html  # macOS
```

HTML 输出特点：
- 现代渐变背景
- 响应式设计
- 淡入动画效果
- 玻璃态拟态设计
- 移动端友好

## 支持的语言

| 代码 | 语言 | 问候语 |
|------|------|--------|
| en | English | Hello |
| zh | 中文 | 你好 |
| zh-TW | 中文(繁體) | 你好 |
| es | Español | Hola |
| fr | Français | Bonjour |
| de | Deutsch | Hallo |
| ja | 日本語 | こんにちは |
| ko | 한국어 | 안녕하세요 |
| ru | Русский | Привет |
| ar | العربية | مرحبا |
| it | Italiano | Ciao |
| pt | Português | Olá |
| hi | हिन्दी | नमस्ते |

## 代码示例

### 作为模块使用

```javascript
const { getGreeting, formatOutput, validateConfig } = require('./greeter');

// 获取问候语
const greeting = getGreeting('zh');
console.log(greeting); // "你好"

// 格式化输出
const config = {
  name: "World",
  times: 1,
  language: "zh",
  format: "console"
};

const output = formatOutput(config);
console.log(output); // "你好, World!"
```

### TypeScript 模块导入

```typescript
import {
  UniversalGreeter,
  OutputFormatter,
  ConfigManager
} from './greeter';

// 获取问候语
const greeting = UniversalGreeter.getGreeting('zh');
console.log(greeting); // "你好"

// 格式化输出
const config = ConfigManager.validate({
  name: "World",
  language: "zh",
  times: 1,
  format: OutputFormat.Console,
  verbose: false
});

const output = OutputFormatter.format(config);
console.log(output); // "你好, World!"
```

## 命令行选项

| 选项 | 长选项 | 描述 | 示例 |
|------|--------|------|------|
| `-n` | `--name` | 问候的对象名称 | `-n Alice` |
| `-t` | `--times` | 重复次数 (1-100) | `-t 3` |
| `-l` | `--language` | 语言代码 | `-l zh` |
| `-f` | `--format` | 输出格式 | `-f json` |
| `-v` | `--verbose` | 详细日志模式 | `-v` |
| `-h` | `--help` | 显示帮助 | `-h` |

## 代码特点

### 1. 清晰的架构

- **单一职责**: 每个函数只做一件事
- **模块化设计**: 易于测试和维护
- **类型安全**: TypeScript 版本提供完整类型定义

### 2. 最佳实践

- **错误处理**: 完善的输入验证
- **文档注释**: 清晰的 JSDoc/TSDoc 注释
- **函数式编程**: 使用纯函数和不可变数据
- **代码复用**: DRY 原则

### 3. 设计模式

- **策略模式**: OutputFormatter 根据格式选择不同策略
- **工厂模式**: ConfigManager 负责创建配置对象
- **单例模式**: 静态方法，无状态设计

## 扩展功能

### 添加新语言

编辑 `GREETINGS` 对象：

```javascript
const GREETINGS = {
  // ... 现有语言
  nl: "Hallo",      // 荷兰语
  sv: "Hej",        // 瑞典语
  fi: "Hei",        // 芬兰语
};
```

### 添加新输出格式

```javascript
function formatMarkdown(config) {
  const greeting = getGreeting(config.language);
  const target = config.name || "World";
  return `# ${greeting}, ${target}!\n\n*Generated at ${new Date().toISOString()}*`;
}
```

### 作为库使用

```javascript
// 在你的项目中使用
const { getGreeting, formatOutput } = require('./greeter');

function welcomeUser(userName, userLanguage) {
  const config = {
    name: userName,
    times: 1,
    language: userLanguage,
    format: "console"
  };
  return formatOutput(config);
}

console.log(welcomeUser("Alice", "zh")); // "你好, Alice!"
```

## 测试

```bash
# 如果配置了 Jest
npm test

# 手动测试各种场景
node greeter.js --name Test --times 1
node greeter.js --language zh --name "测试"
node greeter.js --format json --verbose
```

## 错误处理示例

```bash
# 无效的语言
$ node greeter.js --language invalid
[ERROR] Unsupported language: 'invalid'. Supported: en, zh, zh-TW, es, fr, de, ja, ko, ru, ar, it, pt, hi

# 无效的次数
$ node greeter.js --times 0
[ERROR] Times must be at least 1

$ node greeter.js --times 150
[ERROR] Times cannot exceed 100
```

## 实际应用场景

### 1. Web 应用欢迎消息

```javascript
app.get('/welcome/:name', (req, res) => {
  const { getGreeting } = require('./greeter');
  const userLang = req.headers['accept-language']?.split(',')[0] || 'en';
  const greeting = getGreeting(userLang);

  res.json({ message: `${greeting}, ${req.params.name}!` });
});
```

### 2. CLI 工具友好的输出

```javascript
const { formatOutput } = require('./greeter');

function displayWelcome(userName) {
  const config = {
    name: userName,
    times: 1,
    language: getUserLanguage(),
    format: "console"
  };
  console.log(formatOutput(config));
}
```

### 3. 多语言支持系统

```javascript
const { getGreeting, getSupportedLanguages } = require('./greeter');

function getAvailableLanguages() {
  return getSupportedLanguages().map(code => ({
    code,
    greeting: getGreeting(code)
  }));
}
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `greeter.js` | JavaScript 版本（可直接运行） |
| `greeter.ts` | TypeScript 版本（完整类型） |
| `greeter.test.ts` | Jest 测试套件 |
| `greeter.example.md` | 详细使用文档 |
| `run-greeter-examples.sh` | 示例运行脚本 |
| `GREETER_README.md` | 本文件（快速指南） |

## 性能特点

- **零依赖**: 纯 JavaScript/TypeScript 实现
- **轻量级**: 核心代码 < 300 行
- **快速执行**: 无外部依赖，启动迅速
- **内存高效**: 无状态设计，内存占用小

## 贡献指南

欢迎贡献！可以通过以下方式改进：

1. 添加更多语言支持
2. 实现新的输出格式（Markdown, XML 等）
3. 添加更多测试用例
4. 优化性能和错误处理
5. 改进文档和示例

## 许可证

MIT License - 自由使用和修改

## 作者

Codex - 全栈代码专家

---

**版本**: 2.0.0
**更新日期**: 2026-02-15
**Node.js**: 需要 Node.js 14+ (JavaScript) 或 ts-node (TypeScript)
