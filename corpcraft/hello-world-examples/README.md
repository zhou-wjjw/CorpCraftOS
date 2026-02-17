# Hello World 示例代码集合

这个目录包含了不同编程语言和框架的 Hello World 实现，展示了从基础到进阶的演进路径。

## 文件结构

### JavaScript/Node.js
- `js-basic.js` - 基础 JavaScript Hello World
- `js-express.js` - Express.js Web 服务器
- `js-react.jsx` - React 组件实现

### Python
- `py-basic.py` - 基础 Python Hello World
- `py-flask.py` - Flask Web 服务器
- `py-fastapi.py` - FastAPI 现代Web框架

### Java
- `java-basic.java` - 基础 Java 实现
- `java-springboot.java` - Spring Boot 框架实现

### Rust
- `rust-basic.rs` - 基础 Rust 实现
- `rust-axum.rs` - Axum Web 框架实现

## 运行说明

### JavaScript
```bash
# 基础脚本
node js-basic.js

# 需要先安装 Express
npm install express
node js-express.js

# React 组件需要 React 环境
npm install react react-dom
```

### Python
```bash
# 基础脚本
python3 py-basic.py

# 需要先安装 Flask
pip install flask
python3 py-flask.py

# 需要先安装 FastAPI 和 uvicorn
pip install fastapi uvicorn
python3 py-fastapi.py
```

### Java
```bash
# 基础程序
javac java-basic.java
java HelloWorld

# Spring Boot 需要构建工具（Maven/Gradle）
# 编译和运行需要完整的 Spring Boot 项目结构
```

### Rust
```bash
# 基础程序
cargo run --bin rust-basic

# 需要在 Cargo.toml 中添加 Axum 依赖
cargo add axum tokio serde
cargo run --bin rust-axum
```

## 技术特点对比

| 语言/框架 | 类型系统 | 执行方式 | 主要特点 | 适用场景 |
|-----------|----------|----------|----------|----------|
| JavaScript | 动态类型 | 解释执行 | 事件驱动、异步 | Web 前端、Node.js 后端 |
| Python | 动态类型 | 解释执行 | 简洁、易读 | 数据科学、Web 开发 |
| Java | 静态类型 | 编译执行 | 类型安全、面向对象 | 企业应用、Android |
| Rust | 静态类型 | 编译执行 | 内存安全、高性能 | 系统编程、游戏开发 |

## 学习建议

1. **从简单开始**：先理解基础语法和概念
2. **动手实践**：运行示例代码，修改和扩展
3. **理解范式**：了解不同编程范式的特点
4. **深入框架**：学习实际项目中的最佳实践
5. **持续学习**：关注新技术和趋势