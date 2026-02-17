#!/usr/bin/env python3
"""
Example scripts demonstrating the Hello World program usage
"""

import subprocess
import json
import os
from pathlib import Path


def run_command(command: str, description: str):
    """Run a command and display its output"""
    print(f"\n{'='*50}")
    print(f"示例: {description}")
    print(f"命令: {command}")
    print(f"{'='*50}")

    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)

        if result.stdout:
            print("\n输出:")
            print(result.stdout)

        if result.stderr:
            print("\n错误:")
            print(result.stderr)

        print(f"\n退出码: {result.returncode}")

    except Exception as e:
        print(f"执行错误: {e}")


def demonstrate_basic_usage():
    """Demonstrate basic usage scenarios"""
    examples = [
        ("python hello_world.py", "基本问候"),
        ("python hello_world.py --name Alice", "个性化问候"),
        ("python hello_world.py --name Bob --times 3", "重复问候"),
        ("python hello_world.py --language zh", "中文问候"),
        ("python hello_world.py --language es --name Carlos", "西班牙语问候"),
    ]

    for command, desc in examples:
        run_command(command, desc)


def demonstrate_output_formats():
    """Demonstrate different output formats"""
    examples = [
        ("python hello_world.py --format json --name John", "JSON 格式输出"),
        ("python hello_world.py --format html --name Jane", "HTML 格式输出"),
        ("python hello_world.py --format json --verbose", "带详细日志的 JSON 输出"),
    ]

    for command, desc in examples:
        run_command(command, desc)


def demonstrate_all_languages():
    """Demonstrate all supported languages"""
    languages = ["en", "zh", "es", "fr", "de", "ja", "ko", "ru", "ar", "it"]

    print(f"\n{'='*70}")
    print("演示所有支持的语言")
    print(f"{'='*70}")

    for lang in languages:
        command = f"python hello_world.py --language {lang}"
        run_command(command, f"{lang} 语言问候")


def save_html_output():
    """Generate and save HTML output to file"""
    print(f"\n{'='*50}")
    print("生成 HTML 文件示例")
    print(f"{'='*50}")

    output_file = "hello_output.html"
    command = f"python hello_world.py --format html --name CorpCraft --times 2"

    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)

        if result.stdout:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(result.stdout)

            print(f"\nHTML 文件已保存到: {os.path.abspath(output_file)}")

            # Check file size
            file_size = os.path.getsize(output_file)
            print(f"文件大小: {file_size} 字节")

    except Exception as e:
        print(f"生成 HTML 文件时出错: {e}")


def show_help():
    """Display help information"""
    print(f"\n{'='*50}")
    print("帮助信息")
    print(f"{'='*50}")

    command = "python hello_world.py --help"
    run_command(command, "显示帮助信息")


def test_error_handling():
    """Test error handling"""
    print(f"\n{'='*50}")
    print("错误处理测试")
    print(f"{'='*50}")

    examples = [
        ("python hello_world.py --times 0", "无效的次数（0）"),
        ("python hello_world.py --language invalid", "无效的语言"),
        ("python hello_world.py --format invalid", "无效的输出格式"),
    ]

    for command, desc in examples:
        run_command(command, desc)


def main():
    """Main function to run all demonstrations"""
    print("Hello World 程序使用示例")
    print("=" * 50)

    # Create output directory if it doesn't exist
    output_dir = Path("./output")
    output_dir.mkdir(exist_ok=True)

    # Run demonstrations
    show_help()
    demonstrate_basic_usage()
    demonstrate_output_formats()
    demonstrate_all_languages()
    save_html_output()
    test_error_handling()

    print(f"\n{'='*50}")
    print("所有示例演示完成！")
    print(f"{'='*50}")
    print("\n提示：您可以根据需要调整参数来测试不同的功能。")
    print("查看 README_hello_world.md 获取更多使用信息。")


if __name__ == "__main__":
    main()