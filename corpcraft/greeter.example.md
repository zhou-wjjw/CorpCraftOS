# Modern Multi-Language Greeter

一个简洁优雅的多语言问候系统，使用 TypeScript 实现，展示现代 JavaScript/TypeScript 最佳实践。

## 特性

- **多语言支持**: 内置 13 种语言的问候语
- **多种输出格式**: 支持控制台、JSON、HTML 三种输出格式
- **类型安全**: 完整的 TypeScript 类型定义
- **可扩展架构**: 易于添加新语言和输出格式
- **错误处理**: 完善的输入验证和错误提示
- **命令行接口**: 友好的 CLI 工具

## 支持的语言

- `en` - English
- `zh` - 中文 (简体)
- `zh-TW` - 中文 (繁體)
- `es` - Español
- `fr` - Français
- `de` - Deutsch
- `ja` - 日本語
- `ko` - 한국어
- `ru` - Русский
- `ar` - العربية
- `it` - Italiano
- `pt` - Português
- `hi` - हिन्दी

## 安装

```bash
# 全局安装 ts-node（如果还未安装）
npm install -g ts-node

# 或者使用 pnpm
pnpm add -g ts-node
```

## 使用方法

### 基本用法

```bash
# 默认问候
ts-node greeter.ts
# 输出: Hello, World!

# 个性化问候
ts-node greeter.ts --name Alice
# 输出: Hello, Alice!

# 重复问候
ts-node greeter.ts --name Bob --times 3
# 输出:
# Hello, Bob! (1/3)
# Hello, Bob! (2/3)
# Hello, Bob! (3/3)

# 中文问候
ts-node greeter.ts --language zh
# 输出: 你好, World!

# 日语问候
ts-node greeter.ts --language ja --name "太郎"
# 输出: こんにちは, 太郎!
```

### 短选项形式

```bash
ts-node greeter.ts -n "Alice" -t 2 -l es
# 输出:
# Hola, Alice! (1/2)
# Hola, Alice! (2/2)
```

### 输出格式

#### JSON 格式

```bash
ts-node greeter.ts --name "Carlos" --language es --format json
```

输出:
```json
{
  "greeting": "Hola",
  "target": "Carlos",
  "times": 1,
  "language": "es",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "supportedLanguages": [
    "en",
    "zh",
    "zh-TW",
    "es",
    "fr",
    "de",
    "ja",
    "ko",
    "ru",
    "ar",
    "it",
    "pt",
    "hi"
  ]
}
```

#### HTML 格式

```bash
# 生成 HTML 文件
ts-node greeter.ts --name "CorpCraft" --language zh --times 2 --format html > hello.html

# 在浏览器中打开
open hello.html  # macOS
# xdg-open hello.html  # Linux
# start hello.html  # Windows
```

### 详细模式

```bash
ts-node greeter.ts --name "Test" --verbose
```

输出:
```
[INFO] 2026-02-15T10:30:00.000Z - Starting Greeter application
[INFO] 2026-02-15T10:30:00.001Z - Configuration: {"name":"Test","times":1,"language":"en","format":"console","verbose":true}
Hello, Test!
[INFO] 2026-02-15T10:30:00.002Z - Greeting generated successfully
```

## 命令行选项

| 选项 | 长选项 | 描述 | 默认值 |
|------|--------|------|--------|
| `-n` | `--name` | 问候的对象名称 | World |
| `-t` | `--times` | 重复次数 (1-100) | 1 |
| `-l` | `--language` | 语言代码 | en |
| `-f` | `--format` | 输出格式 (console\|json\|html) | console |
| `-v` | `--verbose` | 启用详细日志 | false |
| `-h` | `--help` | 显示帮助信息 | - |

## 代码架构

### 核心类

#### 1. UniversalGreeter
负责多语言问候语管理：

```typescript
// 获取问候语
const greeting = UniversalGreeter.getGreeting("zh");
console.log(greeting); // "你好"

// 获取支持的语言列表
const languages = UniversalGreeter.getSupportedLanguages();

// 检查语言是否支持
const isSupported = UniversalGreeter.isLanguageSupported("fr");
```

#### 2. OutputFormatter
处理不同格式的输出：

```typescript
const config = {
  name: "Alice",
  times: 2,
  language: "en",
  format: OutputFormat.Console,
  verbose: false
};

// 格式化输出
const output = OutputFormatter.format(config);
console.log(output);
```

#### 3. ConfigManager
配置管理和验证：

```typescript
// 解析命令行参数
const rawConfig = ConfigManager.parseArgs();

// 验证配置
const config = ConfigManager.validate(rawConfig);
```

### 设计模式

- **策略模式**: OutputFormatter 根据格式类型选择不同的格式化策略
- **工厂模式**: ConfigManager 负责创建和验证配置对象
- **单例模式**: 各个类使用静态方法，无状态设计

## 作为模块使用

```typescript
import { UniversalGreeter, OutputFormatter, ConfigManager } from './greeter';

// 获取问候语
const greeting = UniversalGreeter.getGreeting("zh");
console.log(greeting); // "你好"

// 格式化输出
const config = {
  name: "World",
  times: 1,
  language: "zh",
  format: OutputFormat.Console,
  verbose: false
};

const output = OutputFormatter.format(config);
console.log(output); // "你好, World!"
```

## 扩展功能

### 添加新语言

编辑 `greeter.ts` 中的 `GREETINGS` 对象：

```typescript
private static readonly GREETINGS: Greetings = {
  // ... 现有语言
  nl: "Hallo",  // 荷兰语
  sv: "Hej",    // 瑞典语
};
```

### 添加新输出格式

在 `OutputFormatter` 类中添加新方法：

```typescript
static formatMarkdown(config: Required<GreeterConfig>): string {
  const greeting = UniversalGreeter.getGreeting(config.language);
  const target = config.name || "World";
  return `# ${greeting}, ${target}!\n\n_Generated at ${new Date().toISOString()}_`;
}
```

## 错误处理

程序会捕获并优雅地处理以下错误：

- 无效的语言代码
- 超出范围的重复次数
- 无效的输出格式

示例：

```bash
$ ts-node greeter.ts --language invalid
[ERROR] Unsupported language: 'invalid'. Supported: en, zh, zh-TW, es, fr, de, ja, ko, ru, ar, it, pt, hi

$ ts-node greeter.ts --times 0
[ERROR] Times must be at least 1

$ ts-node greeter.ts --times 150
[ERROR] Times cannot exceed 100
```

## 最佳实践

1. **使用 TypeScript**: 获得完整的类型安全和 IntelliSense 支持
2. **函数式编程**: 使用纯函数和不可变数据结构
3. **单一职责**: 每个类只负责一个功能领域
4. **错误处理**: 完善的输入验证和错误处理
5. **文档注释**: 清晰的 JSDoc 注释说明 API

## 测试

可以创建测试文件 `greeter.test.ts`：

```typescript
import { UniversalGreeter } from './greeter';

describe('UniversalGreeter', () => {
  test('should return correct greeting for supported languages', () => {
    expect(UniversalGreeter.getGreeting('en')).toBe('Hello');
    expect(UniversalGreeter.getGreeting('zh')).toBe('你好');
    expect(UniversalGreeter.getGreeting('es')).toBe('Hola');
  });

  test('should fallback to English for unsupported languages', () => {
    expect(UniversalGreeter.getGreeting('invalid')).toBe('Hello');
  });

  test('should check language support correctly', () => {
    expect(UniversalGreeter.isLanguageSupported('en')).toBe(true);
    expect(UniversalGreeter.isLanguageSupported('invalid')).toBe(false);
  });
});
```

## 许可证

MIT License - 自由使用和修改

## 作者

Codex - 全栈代码专家

---

**享受编程的乐趣！** 🚀
