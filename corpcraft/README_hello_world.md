# Professional Hello World Program

一个专业的 Hello World 程序实现，展示了现代 Python 编程的最佳实践。

## 功能特性

- 🌍 **多语言支持**: 支持 10 种语言的问候语
- 📝 **多种输出格式**: 控制台、JSON、HTML 格式输出
- 🔧 **命令行参数处理**: 灵活的参数配置
- 📊 **日志记录**: 详细的执行日志
- 🎨 **优雅的错误处理**: 完善的异常处理机制
- 🏗️ **模块化设计**: 清晰的代码结构和职责分离

## 快速开始

### 基本用法

```bash
# 默认用法：Hello, World!
python hello_world.py

# 指定名字
python hello_world.py --name Alice

# 重复问候
python hello_world.py --name Bob --times 3

# 使用不同语言
python hello_world.py --language zh
python hello_world.py --language es --name Carlos
```

### 输出格式

```bash
# JSON 格式输出
python hello_world.py --format json

# HTML 格式输出
python hello_world.py --format html

# 完整示例：中文问候，JSON 格式，详细日志
python hello_world.py --name 张三 --language zh --format json --verbose
```

## 支持的语言

| 语言代码 | 语言名称 | 问候语 |
|---------|---------|--------|
| en      | 英语    | Hello  |
| zh      | 中文    | 你好   |
| es      | 西班牙语| Hola   |
| fr      | 法语    | Bonjour|
| de      | 德语    | Hallo  |
| ja      | 日语    | こんにちは |
| ko      | 韩语    | 안녕하세요 |
| ru      | 俄语    | Привет |
| ar      | 阿拉伯语| مرحبا   |
| it      | 意大利语| Ciao   |

## 命令行选项

```
usage: hello_world.py [-h] [--name NAME] [--times TIMES] [--language LANGUAGE]
                     [--format {console,json,html}] [--verbose]

Professional Hello World Program

optional arguments:
  -h, --help            show this help message and exit
  --name NAME           Name to greet (default: World)
  --times TIMES         Number of times to print the greeting (default: 1)
  --language LANGUAGE   Language for the greeting (default: en)
  --format {console,json,html}
                        Output format (default: console)
  --verbose             Enable verbose logging
```

## 代码结构

```
hello_world.py
├── HelloConfig          # 配置数据类
├── OutputFormat         # 输出格式枚举
├── Greeter              # 问候语生成器
├── HelloOutputFormatter # 输出格式化器
├── setup_logging()      # 日志设置
├── parse_arguments()    # 参数解析
└── main()              # 主函数
```

## 实现亮点

### 1. 类型提示
使用 Python 的类型提示系统，提高代码可读性和 IDE 支持。

### 2. 数据类
使用 `@dataclass` 装饰器简化配置类的定义。

### 3. 枚举类型
使用 `Enum` 确保输出格式的类型安全。

### 4. 模块化设计
将不同功能分离到不同的类和方法中，遵循单一职责原则。

### 5. 错误处理
完善的异常处理机制，包括用户中断处理和一般错误处理。

### 6. 日志系统
支持详细日志记录，便于调试和监控。

### 7. 用户友好性
提供详细的使用说明和示例。

### 8. 扩展性
代码结构易于扩展，可以轻松添加新功能。

## 运行环境要求

- Python 3.6+
- 标准库（无需额外安装依赖）

## 使用场景

这个程序可以作为：

1. **编程入门示例**: 展示现代 Python 编程规范
2. **命令行工具模板**: 实际项目的基础框架
3. **教学材料**: 用于教学 Python 的最佳实践
4. **面试准备**: 展示全面的编程能力

## 扩展建议

1. 添加配置文件支持（YAML/JSON）
2. 实现服务器模式（HTTP API）
3. 添加国际化支持（i18n）
4. 实现插件系统
5. 添加单元测试
6. 添加 CI/CD 配置

## 许可证

MIT License