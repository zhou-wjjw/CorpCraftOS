#!/usr/bin/env python3
# FastAPI Hello World - 现代 Web 框架
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI()

# 模型定义
class Greeting(BaseModel):
    id: int
    message: str
    recipient: str

class GreetingRequest(BaseModel):
    recipient: str

# 内存数据库
greetings_db = [
    {"id": 1, "message": "Hello", "recipient": "World"},
    {"id": 2, "message": "Hi", "recipient": "Everyone"}
]

# 路由
@app.get("/")
async def root():
    return {"message": "Hello, World!"}

@app.get("/greet/{name}")
async def greet_name(name: str):
    return {"message": f"Hello, {name}!"}

@app.get("/greetings", response_model=List[Greeting])
async def get_greetings():
    return greetings_db

@app.get("/greetings/{greeting_id}", response_model=Greeting)
async def get_greeting(greeting_id: int):
    greeting = next((g for g in greetings_db if g["id"] == greeting_id), None)
    if not greeting:
        raise HTTPException(status_code=404, detail="Greeting not found")
    return greeting

@app.post("/greetings", response_model=Greeting)
async def create_greeting(greeting: GreetingRequest):
    new_id = max([g["id"] for g in greetings_db]) + 1
    new_greeting = {
        "id": new_id,
        "message": "Hello",
        "recipient": greeting.recipient
    }
    greetings_db.append(new_greeting)
    return new_greeting

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)