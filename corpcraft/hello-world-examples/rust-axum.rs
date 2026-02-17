// Axum Hello World - 现代 Rust Web 框架
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;

// 模型定义
#[derive(Serialize, Deserialize)]
struct Greeting {
    message: String,
}

#[derive(Deserialize)]
struct GreetQuery {
    name: Option<String>,
}

#[derive(Deserialize)]
struct GreetBody {
    name: String,
}

// 应用状态
#[derive(Clone)]
struct AppState {
    greetings: Vec<String>,
}

#[tokio::main]
async fn main() {
    // 初始化应用状态
    let app_state = AppState {
        greetings: vec![
            "Hello, World!".to_string(),
            "Hello, Rust!".to_string(),
        ],
    };

    // 创建路由
    let app = Router::new()
        // 基础路由
        .route("/", get(root))
        .route("/hello", get(hello))

        // 路径参数
        .route("/greet/:name", get(greet_name))

        // 查询参数
        .route("/greet", get(greet_query))

        // JSON 请求体
        .route("/api/greet", post(api_greet))

        // 获取列表
        .route("/greetings", get(get_greetings))

        // 带状态的路由
        .with_state(app_state);

    // 启动服务器
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// 处理函数
async fn root() -> impl IntoResponse {
    "Hello, World!"
}

async fn hello() -> impl IntoResponse {
    Json(Greeting {
        message: "Hello, World!".to_string(),
    })
}

async fn greet_name(Path(name): Path<String>) -> impl IntoResponse {
    format!("Hello, {}!", name)
}

async fn greet_query(Query(params): Query<GreetQuery>) -> impl IntoResponse {
    let name = params.name.unwrap_or_else(|| "World".to_string());
    format!("Hello, {}!", name)
}

async fn api_greet(
    Json(params): Json<GreetBody>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let greeting = format!("Hello, {}!", params.name);

    // 添加到状态
    let mut greetings = state.greetings.clone();
    greetings.push(greeting.clone());

    (StatusCode::OK, Json(Greeting { message: greeting }))
}

async fn get_greetings(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.greetings)
}

// 中间件示例
use axum::middleware;
use axum::extract::Request;

async fn logging_middleware(req: Request, next: middleware::Next) -> impl IntoResponse {
    println!("Request: {} {}", req.method(), req.uri());

    let response = next.run(req).await;

    println!("Response: {}", response.status());

    response
}

// 添加中间件的示例（注释掉，避免冲突）
/*
let app = Router::new()
    .route("/", get(root))
    .layer(middleware::from_fn(logging_middleware));
*/