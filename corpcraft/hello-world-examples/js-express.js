// Express.js Hello World - Web 服务器
const express = require('express');
const app = express();
const port = 3000;

// 中间件
app.use(express.json());

// 路由
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.get('/greet/:name', (req, res) => {
    const name = req.params.name;
    res.send(`Hello, ${name}!`);
});

// 启动服务器
app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});