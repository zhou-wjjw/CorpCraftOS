// JavaScript 基础 Hello World - Node.js
console.log("Hello, World!");

// 支持多种输出方式
console.log("Hello, " + "World!");
console.log(`Hello, ${"World"}!`);

// 事件循环演示
setTimeout(() => {
    console.log("异步: Hello after 1 second");
}, 1000);

console.log("同步: Hello immediately");