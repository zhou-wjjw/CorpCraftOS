#!/usr/bin/env node
/**
 * Modern Multi-Language Greeter (JavaScript)
 * ==========================================
 *
 * A clean, elegant greeting system with multi-language support
 * Pure JavaScript implementation for maximum compatibility
 *
 * @version 2.0.0
 * @author Codex
 * @license MIT
 */

// ============================================
// Core Configuration
// ============================================

const GREETINGS = {
  en: "Hello",
  zh: "你好",
  "zh-TW": "你好",
  es: "Hola",
  fr: "Bonjour",
  de: "Hallo",
  ja: "こんにちは",
  ko: "안녕하세요",
  ru: "Привет",
  ar: "مرحبا",
  it: "Ciao",
  pt: "Olá",
  hi: "नमस्ते",
};

const DEFAULT_CONFIG = {
  name: "World",
  times: 1,
  language: "en",
  format: "console",
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get greeting in specified language
 * @param {string} language - Language code
 * @returns {string} Greeting word
 */
function getGreeting(language = "en") {
  return GREETINGS[language] || GREETINGS.en;
}

/**
 * Check if language is supported
 * @param {string} language - Language code
 * @returns {boolean} True if supported
 */
function isLanguageSupported(language) {
  return language in GREETINGS;
}

/**
 * Get all supported languages
 * @returns {string[]} Array of language codes
 */
function getSupportedLanguages() {
  return Object.keys(GREETINGS);
}

/**
 * Format greeting for console output
 * @param {Object} config - Configuration object
 * @returns {string} Formatted output
 */
function formatConsole(config) {
  const greeting = getGreeting(config.language);
  const target = config.name || "World";

  if (config.times === 1) {
    return `${greeting}, ${target}!`;
  }

  return Array.from({ length: config.times }, (_, i) =>
    `${greeting}, ${target}! (${i + 1}/${config.times})`
  ).join("\n");
}

/**
 * Format greeting as JSON
 * @param {Object} config - Configuration object
 * @returns {string} JSON string
 */
function formatJSON(config) {
  const greeting = getGreeting(config.language);
  const target = config.name || "World";

  return JSON.stringify(
    {
      greeting,
      target,
      times: config.times,
      language: config.language,
      timestamp: new Date().toISOString(),
      supportedLanguages: getSupportedLanguages(),
    },
    null,
    2
  );
}

/**
 * Format greeting as HTML
 * @param {Object} config - Configuration object
 * @returns {string} HTML document
 */
function formatHTML(config) {
  const greeting = getGreeting(config.language);
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
 * Format output based on format type
 * @param {Object} config - Configuration object
 * @returns {string} Formatted output
 */
function formatOutput(config) {
  switch (config.format) {
    case "console":
      return formatConsole(config);
    case "json":
      return formatJSON(config);
    case "html":
      return formatHTML(config);
    default:
      throw new Error(`Unsupported format: ${config.format}`);
  }
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated configuration
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config) {
  const validated = { ...DEFAULT_CONFIG, ...config };

  if (validated.times < 1) {
    throw new Error("Times must be at least 1");
  }

  if (validated.times > 100) {
    throw new Error("Times cannot exceed 100");
  }

  if (!isLanguageSupported(validated.language)) {
    const supported = getSupportedLanguages().join(", ");
    throw new Error(
      `Unsupported language: '${validated.language}'. Supported: ${supported}`
    );
  }

  return validated;
}

/**
 * Parse command-line arguments
 * @returns {Object} Parsed configuration
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

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
        config.format = args[++i].toLowerCase();
        break;

      case "--verbose":
      case "-v":
        config.verbose = true;
        break;

      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Modern Multi-Language Greeter v2.0.0
====================================

USAGE:
  node greeter.js [OPTIONS]

OPTIONS:
  -n, --name <name>        Name to greet (default: World)
  -t, --times <number>     Number of greetings (default: 1, max: 100)
  -l, --language <code>    Language code (default: en)
  -f, --format <format>    Output format: console|json|html (default: console)
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message

SUPPORTED LANGUAGES:
  ${getSupportedLanguages().join(", ")}

EXAMPLES:
  node greeter.js                           # Hello, World!
  node greeter.js --name Alice              # Hello, Alice!
  node greeter.js -n "Bob" -t 3             # Print 3 times
  node greeter.js -l zh                     # 你好, World!
  node greeter.js -l es -n Carlos -f json   # JSON in Spanish
  node greeter.js -f html -n "CorpCraft"    # Generate HTML

For more information, visit: https://github.com/corpcraft/greeter
`);
}

/**
 * Log message if verbose mode is enabled
 * @param {string} message - Message to log
 * @param {boolean} verbose - Whether verbose mode is enabled
 */
function logVerbose(message, verbose) {
  if (verbose) {
    console.error(`[INFO] ${new Date().toISOString()} - ${message}`);
  }
}

/**
 * Main application entry point
 * @returns {number} Exit code (0 for success, 1 for error)
 */
function main() {
  try {
    const rawConfig = parseArgs();
    const config = validateConfig(rawConfig);

    if (config.verbose) {
      logVerbose("Starting Greeter application", true);
      logVerbose(`Configuration: ${JSON.stringify(config)}`, true);
    }

    const output = formatOutput(config);
    console.log(output);

    if (config.verbose) {
      logVerbose("Greeting generated successfully", true);
    }

    return 0;
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return 1;
  }
}

// ============================================
// Entry Point
// ============================================

if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

// Export for use as module
module.exports = {
  getGreeting,
  isLanguageSupported,
  getSupportedLanguages,
  formatConsole,
  formatJSON,
  formatHTML,
  formatOutput,
  validateConfig,
  parseArgs,
};
