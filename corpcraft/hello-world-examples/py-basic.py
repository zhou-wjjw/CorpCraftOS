#!/usr/bin/env python3
# Python 基础 Hello World

# 基本输出
print("Hello, World!")

# 格式化输出
name = "World"
print(f"Hello, {name}!")
print("Hello, {}!".format(name))
print("Hello, %s!" % name)

# 函数定义
def greet(name):
    return f"Hello, {name}!"

# 使用函数
print(greet("World"))

# 类定义
class Greeter:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hello, {self.name}!"

# 使用类
greeter = Greeter("World")
print(greeter.greet())