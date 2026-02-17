#!/usr/bin/env node
/**
 * Modern Multi-Language Greeter
 * =============================
 *
 * A clean, extensible greeting system featuring:
 * - Multi-language support with 10+ languages
 * - Multiple output formats (console, JSON, HTML)
 * - Type-safe implementation with TypeScript
 * - Functional programming patterns
 * - Comprehensive error handling
 *
 * @version 2.0.0
 * @author Codex
 * @license MIT
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Supported output formats
 */
enum OutputFormat {
  Console = "console",
  JSON = "json",
  HTML = "html",
}

/**
 * Configuration interface for the greeter
 */
interface GreeterConfig {
  name?: string;
  times?: number;
  language?: string;
  format?: OutputFormat;
  verbose?: boolean;
}

/**
 * Language code to greeting mapping
 */
type Greetings = Record<string, string>;

// ============================================
// Core Greeter Class
// ============================================

/**
 * Multi-language greeting system
 * Provides extensible greeting functionality with support for multiple languages
 */
class UniversalGreeter {
  private static readonly GREETINGS: Greetings = {
    // English
    en: "Hello",
    // Chinese (Simplified)
    zh: "你好",
    // Chinese (Traditional)
    "zh-TW": "你好",
    // Spanish
    es: "Hola",
    // French
    fr: "Bonjour",
    // German
    de: "Hallo",
    // Japanese
    ja: "こんにちは",
    // Korean
    ko: "안녕하세요",
    // Russian
    ru: "Привет",
    // Arabic
    ar: "مرحبا",
    // Italian
    it: "Ciao",
    // Portuguese
    pt: "Olá",
    // Hindi
    hi: "नमस्ते",
  };

  /**
   * Get greeting in specified language with fallback
   * @param language - Language code (default: 'en')
   * @returns The greeting word in the specified language
   */
  static getGreeting(language: string = "en"): string {
    return this.GREETINGS[language] || this.GREETINGS.en;
  }

  /**
   * Get list of all supported languages
   * @returns Array of language codes
   */
  static getSupportedLanguages(): string[] {
    return Object.keys(this.GREETINGS);
  }

  /**
   * Check if a language is supported
   * @param language - Language code to check
   * @returns True if language is supported
   */
  static isLanguageSupported(language: string): boolean {
    return language in this.GREETINGS;
  }
}

// ============================================
// Output Formatters
// ============================================

/**
 * Formatter for different output formats
 * Implements strategy pattern for format handling
 */
class OutputFormatter {
  /**
   * Format greeting for console output
   * @param config - Greeter configuration
   * @returns Formatted console output
   */
  static formatConsole(config: Required<GreeterConfig>): string {
    const greeting = UniversalGreeter.getGreeting(config.language);
    const target = config.name || "World";

    if (config.times === 1) {
      return `${greeting}, ${target}!`;
    }

    // Generate multiple greetings with numbering
    return Array.from({ length: config.times }, (_, i) =>
      `${greeting}, ${target}! (${i + 1}/${config.times})`
    ).join("\n");
  }

  /**
   * Format greeting as JSON
   * @param config - Greeter configuration
   * @returns JSON string representation
   */
  static formatJSON(config: Required<GreeterConfig>): string {
    const greeting = UniversalGreeter.getGreeting(config.language);
    const target = config.name || "World";

    return JSON.stringify(
      {
        greeting,
        target,
        times: config.times,
        language: config.language,
        timestamp: new Date().toISOString(),
        supportedLanguages: UniversalGreeter.getSupportedLanguages(),
      },
      null,
      2
    );
  }

  /**
   * Format greeting as HTML with modern styling
   * @param config - Greeter configuration
   * @returns HTML document string
   */
  static formatHTML(config: Required<GreeterConfig>): string {
    const greeting = UniversalGreeter.getGreeting(config.language);
    const target = config.name || "World";

    const greetingsHTML =
      config.times === 1
        ? `<div class="greeting">${greeting}, ${target}!</div>`
        : Array.from({ length: config.times }, (_, i) =>
            `<div class="greeting">${greeting}, ${target}! (${i + 1}/${config.times})</div>`
          ).join("\n                ");

    return `<!DOCTYPE html>
<html lang="${config.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${greeting} ${target}!</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }
        .container {
            text-align: center;
        }
        .greeting {
            font-size: 3rem;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            margin: 1rem;
            padding: 2rem;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            backdrop-filter: blur(10px);
            animation: fadeIn 0.6s ease-in;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .meta {
            margin-top: 2rem;
            font-size: 0.875rem;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        ${greetingsHTML}
        <div class="meta">
            Language: ${config.language} |
            Generated: ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Main format dispatcher
   * @param config - Greeter configuration
   * @returns Formatted output string
   */
  static format(config: Required<GreeterConfig>): string {
    switch (config.format) {
      case OutputFormat.Console:
        return this.formatConsole(config);
      case OutputFormat.JSON:
        return this.formatJSON(config);
      case OutputFormat.HTML:
        return this.formatHTML(config);
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }
}

// ============================================
// Configuration & Validation
// ============================================

/**
 * Configuration manager with validation
 */
class ConfigManager {
  private static readonly DEFAULT_CONFIG: Required<GreeterConfig> = {
    name: "World",
    times: 1,
    language: "en",
    format: OutputFormat.Console,
    verbose: false,
  };

  /**
   * Parse command-line arguments
   * @returns Parsed configuration object
   */
  static parseArgs(): GreeterConfig {
    const args = process.argv.slice(2);
    const config: GreeterConfig = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--name":
        case "-n":
          config.name = args[++i];
          break;

        case "--times":
        case "-t":
          config.times = parseInt(args[++i], 10);
          break;

        case "--language":
        case "-l":
          config.language = args[++i];
          break;

        case "--format":
        case "-f":
          const formatValue = args[++i].toLowerCase();
          if (Object.values(OutputFormat).includes(formatValue as OutputFormat)) {
            config.format = formatValue as OutputFormat;
          }
          break;

        case "--verbose":
        case "-v":
          config.verbose = true;
          break;

        case "--help":
        case "-h":
          this.showHelp();
          process.exit(0);
          break;
      }
    }

    return config;
  }

  /**
   * Validate and merge configuration with defaults
   * @param config - Partial configuration
   * @returns Validated complete configuration
   * @throws Error if configuration is invalid
   */
  static validate(config: GreeterConfig): Required<GreeterConfig> {
    const merged: Required<GreeterConfig> = {
      ...this.DEFAULT_CONFIG,
      ...config,
    };

    // Validate times
    if (merged.times < 1) {
      throw new Error("Times must be at least 1");
    }

    if (merged.times > 100) {
      throw new Error("Times cannot exceed 100");
    }

    // Validate language
    if (!UniversalGreeter.isLanguageSupported(merged.language)) {
      const supported = UniversalGreeter.getSupportedLanguages().join(", ");
      throw new Error(
        `Unsupported language: '${merged.language}'. Supported: ${supported}`
      );
    }

    return merged;
  }

  /**
   * Display help information
   */
  private static showHelp(): void {
    console.log(`
Modern Multi-Language Greeter v2.0.0
====================================

USAGE:
  ts-node greeter.ts [OPTIONS]

OPTIONS:
  -n, --name <name>        Name to greet (default: World)
  -t, --times <number>     Number of greetings (default: 1, max: 100)
  -l, --language <code>    Language code (default: en)
  -f, --format <format>    Output format: console|json|html (default: console)
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message

SUPPORTED LANGUAGES:
  ${UniversalGreeter.getSupportedLanguages().join(", ")}

EXAMPLES:
  ts-node greeter.ts                           # Hello, World!
  ts-node greeter.ts --name Alice              # Hello, Alice!
  ts-node greeter.ts -n "Bob" -t 3             # Print 3 times
  ts-node greeter.ts -l zh                     # 你好, World!
  ts-node greeter.ts -l es -n Carlos -f json   # JSON in Spanish
  ts-node greeter.ts -f html -n "CorpCraft"    # Generate HTML

OUTPUT FORMATS:
  console  - Plain text output (default)
  json     - JSON format with metadata
  html     - Styled HTML document

For more information, visit: https://github.com/corpcraft/greeter
`);
  }
}

// ============================================
// Logger
// ============================================

/**
 * Simple logger with verbose mode support
 */
class Logger {
  private static isVerbose = false;

  static enableVerbose(): void {
    this.isVerbose = true;
  }

  static info(message: string): void {
    if (this.isVerbose) {
      console.error(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  }

  static error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

// ============================================
// Main Application
// ============================================

/**
 * Main application class
 */
class GreeterApp {
  /**
   * Run the greeting application
   * @returns Exit code (0 for success, 1 for error)
   */
  static run(): number {
    try {
      // Parse and validate configuration
      const rawConfig = ConfigManager.parseArgs();
      const config = ConfigManager.validate(rawConfig);

      // Enable verbose logging if requested
      if (config.verbose) {
        Logger.enableVerbose();
        Logger.info("Starting Greeter application");
        Logger.info(`Configuration: ${JSON.stringify(config)}`);
      }

      // Generate and output greeting
      const output = OutputFormatter.format(config);
      console.log(output);

      Logger.info("Greeting generated successfully");
      return 0;
    } catch (error) {
      if (error instanceof Error) {
        Logger.error(error.message);
      } else {
        Logger.error("Unknown error occurred");
      }
      return 1;
    }
  }
}

// ============================================
// Entry Point
// ============================================

// Run if executed directly (not imported)
if (require.main === module) {
  const exitCode = GreeterApp.run();
  process.exit(exitCode);
}

// Export for use as module
export { UniversalGreeter, OutputFormatter, ConfigManager, GreeterApp };
export type { GreeterConfig, Greetings };
