// Rust 基础 Hello World
fn main() {
    // 基本输出
    println!("Hello, World!");

    // 格式化输出
    let name = "World";
    println!("Hello, {}!", name);

    // 使用宏
    println!("Hello, {} from {}!", "World", "Rust");

    // 向量迭代
    let names = vec!["World", "Everyone", "Rust"];
    for name in names {
        println!("Hello, {}!", name);
    }
}

// 函数示例
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// 结构体示例
struct Greeter {
    name: String,
}

impl Greeter {
    fn new(name: &str) -> Self {
        Greeter {
            name: name.to_string(),
        }
    }

    fn greet(&self) -> String {
        format!("Hello, {}!", self.name)
    }
}

// 错误处理示例
use std::io::{self, Read};

fn read_hello() -> Result<String, io::Error> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    Ok(format!("Hello, {}!", input.trim()))
}

// 并发示例
use std::thread;
use std::sync::mpsc;

fn concurrent_greet() {
    let (tx, rx) = mpsc::channel();

    let handle = thread::spawn(move || {
        let message = "Hello from thread!";
        tx.send(message).unwrap();
    });

    let received = rx.recv().unwrap();
    println!("{}", received);
    handle.join().unwrap();
}