#!/usr/bin/env python3
"""
Professional Hello World Program
================================

A modern, feature-rich Hello World implementation demonstrating:
- Command-line argument handling
- Configuration management
- User interaction
- Logging
- Error handling
- Multi-language support
- Modular design

Author: Codex
Version: 1.0.0
License: MIT
"""

import argparse
import logging
import sys
from typing import Optional
from dataclasses import dataclass
from enum import Enum


class OutputFormat(Enum):
    """Supported output formats"""
    CONSOLE = "console"
    JSON = "json"
    HTML = "html"


@dataclass
class HelloConfig:
    """Configuration for the Hello World program"""
    name: Optional[str] = None
    times: int = 1
    language: str = "en"
    output_format: OutputFormat = OutputFormat.CONSOLE
    verbose: bool = False


class Greeter:
    """Greeter class for generating greetings in different languages"""

    GREETINGS = {
        "en": "Hello",
        "zh": "你好",
        "es": "Hola",
        "fr": "Bonjour",
        "de": "Hallo",
        "ja": "こんにちは",
        "ko": "안녕하세요",
        "ru": "Привет",
        "ar": "مرحبا",
        "it": "Ciao"
    }

    @classmethod
    def get_greeting(cls, language: str = "en") -> str:
        """Get greeting in specified language"""
        return cls.GREETINGS.get(language, cls.GREETINGS["en"])

    @classmethod
    def get_available_languages(cls) -> list[str]:
        """Get list of available languages"""
        return list(cls.GREETINGS.keys())


class HelloOutputFormatter:
    """Handles different output formats for greetings"""

    @staticmethod
    def format_console(config: HelloConfig) -> str:
        """Format greeting for console output"""
        greeting = Greeter.get_greeting(config.language)
        target = config.name if config.name else "World"

        if config.times == 1:
            return f"{greeting}, {target}!"
        else:
            lines = []
            for i in range(config.times):
                lines.append(f"{greeting}, {target}! ({i + 1}/{config.times})")
            return "\n".join(lines)

    @staticmethod
    def format_json(config: HelloConfig) -> str:
        """Format greeting as JSON"""
        greeting = Greeter.get_greeting(config.language)
        target = config.name if config.name else "World"

        import json
        data = {
            "greeting": greeting,
            "target": target,
            "times": config.times,
            "language": config.language,
            "timestamp": None  # Would use datetime in real implementation
        }
        return json.dumps(data, indent=2)

    @staticmethod
    def format_html(config: HelloConfig) -> str:
        """Format greeting as HTML"""
        greeting = Greeter.get_greeting(config.language)
        target = config.name if config.name else "World"

        if config.times == 1:
            html = f"""
            <!DOCTYPE html>
            <html lang="{config.language}">
            <head>
                <meta charset="UTF-8">
                <title>Hello World</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }}
                    .greeting {{
                        font-size: 3rem;
                        text-align: center;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    }}
                </style>
            </head>
            <body>
                <div class="greeting">{greeting}, {target}!</div>
            </body>
            </html>
            """
        else:
            greetings = []
            for i in range(config.times):
                greetings.append(f'<div>{greeting}, {target}! ({i + 1}/{config.times})</div>')

            html = f"""
            <!DOCTYPE html>
            <html lang="{config.language}">
            <head>
                <meta charset="UTF-8">
                <title>Hello World</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }}
                    .greeting {{
                        font-size: 1.5rem;
                        margin: 0.5rem;
                        padding: 1rem;
                        background: rgba(255,255,255,0.1);
                        border-radius: 8px;
                        text-align: center;
                    }}
                </style>
            </head>
            <body>
                {''.join(greetings)}
            </body>
            </html>
            """

        return html.strip()


def setup_logging(verbose: bool = False) -> None:
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO

    # Create a custom logger to avoid interfering with output
    logger = logging.getLogger(__name__)
    logger.setLevel(level)

    # Clear any existing handlers
    logger.handlers.clear()

    # Add handler only when verbose mode
    if verbose:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)


def parse_arguments() -> HelloConfig:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Professional Hello World Program",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  {sys.argv[0]}                          # Default: Hello, World!
  {sys.argv[0]} --name Alice              # Hello, Alice!
  {sys.argv[0]} --name Bob --times 3      # Print hello 3 times
  {sys.argv[0]} --language zh            # 你好, World!
  {sys.argv[0]} --format json            # Output as JSON
  {sys.argv[0]} --format html            # Output as HTML
  {sys.argv[0]} --language es --name Carlos --format json --verbose
"""
    )

    parser.add_argument(
        "--name",
        type=str,
        help="Name to greet (default: World)"
    )

    parser.add_argument(
        "--times",
        type=int,
        default=1,
        help="Number of times to print the greeting (default: 1)"
    )

    parser.add_argument(
        "--language",
        type=str,
        default="en",
        choices=Greeter.get_available_languages(),
        help="Language for the greeting (default: en)"
    )

    parser.add_argument(
        "--format",
        type=str,
        default="console",
        choices=[f.value for f in OutputFormat],
        help="Output format (default: console)"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    return HelloConfig(
        name=args.name,
        times=args.times,
        language=args.language,
        output_format=OutputFormat(args.format),
        verbose=args.verbose
    )


def main() -> int:
    """Main entry point of the program"""
    try:
        # Parse arguments and setup logging
        config = parse_arguments()
        setup_logging(config.verbose)

        logger = logging.getLogger(__name__)
        logger.info("Starting Hello World program")

        # Validate input
        if config.times < 1:
            logger.error("Times must be at least 1")
            return 1

        # Generate greeting based on format
        formatter = HelloOutputFormatter()

        if config.output_format == OutputFormat.CONSOLE:
            output = formatter.format_console(config)
        elif config.output_format == OutputFormat.JSON:
            output = formatter.format_json(config)
        elif config.output_format == OutputFormat.HTML:
            output = formatter.format_html(config)
        else:
            logger.error(f"Unsupported output format: {config.output_format}")
            return 1

        # Output the result
        print(output)

        logger.info("Hello World program completed successfully")
        return 0

    except KeyboardInterrupt:
        print("\nProgram interrupted by user")
        return 130
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())