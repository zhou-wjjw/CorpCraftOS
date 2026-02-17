/**
 * Unit Tests for Modern Multi-Language Greeter
 * =============================================
 *
 * Comprehensive test suite using Jest
 *
 * Run with: npm test
 */

import {
  UniversalGreeter,
  OutputFormatter,
  ConfigManager,
  GreeterApp,
  OutputFormat,
} from "./greeter";

describe("UniversalGreeter", () => {
  describe("getGreeting", () => {
    test("should return correct greeting for supported languages", () => {
      expect(UniversalGreeter.getGreeting("en")).toBe("Hello");
      expect(UniversalGreeter.getGreeting("zh")).toBe("你好");
      expect(UniversalGreeter.getGreeting("zh-TW")).toBe("你好");
      expect(UniversalGreeter.getGreeting("es")).toBe("Hola");
      expect(UniversalGreeter.getGreeting("fr")).toBe("Bonjour");
      expect(UniversalGreeter.getGreeting("de")).toBe("Hallo");
      expect(UniversalGreeter.getGreeting("ja")).toBe("こんにちは");
      expect(UniversalGreeter.getGreeting("ko")).toBe("안녕하세요");
      expect(UniversalGreeter.getGreeting("ru")).toBe("Привет");
      expect(UniversalGreeter.getGreeting("ar")).toBe("مرحبا");
      expect(UniversalGreeter.getGreeting("it")).toBe("Ciao");
      expect(UniversalGreeter.getGreeting("pt")).toBe("Olá");
      expect(UniversalGreeter.getGreeting("hi")).toBe("नमस्ते");
    });

    test("should fallback to English for unsupported languages", () => {
      expect(UniversalGreeter.getGreeting("invalid")).toBe("Hello");
      expect(UniversalGreeter.getGreeting("")).toBe("Hello");
      expect(UniversalGreeter.getGreeting("xx")).toBe("Hello");
    });

    test("should use English as default when no language specified", () => {
      expect(UniversalGreeter.getGreeting()).toBe("Hello");
    });
  });

  describe("getSupportedLanguages", () => {
    test("should return all supported language codes", () => {
      const languages = UniversalGreeter.getSupportedLanguages();
      expect(languages).toContain("en");
      expect(languages).toContain("zh");
      expect(languages).toContain("es");
      expect(languages).toContain("ja");
      expect(languages.length).toBe(13);
    });

    test("should return an array", () => {
      expect(Array.isArray(UniversalGreeter.getSupportedLanguages())).toBe(true);
    });
  });

  describe("isLanguageSupported", () => {
    test("should return true for supported languages", () => {
      expect(UniversalGreeter.isLanguageSupported("en")).toBe(true);
      expect(UniversalGreeter.isLanguageSupported("zh")).toBe(true);
      expect(UniversalGreeter.isLanguageSupported("ja")).toBe(true);
    });

    test("should return false for unsupported languages", () => {
      expect(UniversalGreeter.isLanguageSupported("invalid")).toBe(false);
      expect(UniversalGreeter.isLanguageSupported("xx")).toBe(false);
      expect(UniversalGreeter.isLanguageSupported("")).toBe(false);
    });
  });
});

describe("OutputFormatter", () => {
  const baseConfig = {
    name: "World",
    times: 1,
    language: "en",
    format: OutputFormat.Console,
    verbose: false,
  };

  describe("formatConsole", () => {
    test("should format single greeting correctly", () => {
      const output = OutputFormatter.formatConsole(baseConfig);
      expect(output).toBe("Hello, World!");
    });

    test("should format multiple greetings with numbering", () => {
      const config = { ...baseConfig, times: 3 };
      const output = OutputFormatter.formatConsole(config);
      expect(output).toBe("Hello, World! (1/3)\nHello, World! (2/3)\nHello, World! (3/3)");
    });

    test("should use custom name", () => {
      const config = { ...baseConfig, name: "Alice" };
      const output = OutputFormatter.formatConsole(config);
      expect(output).toBe("Hello, Alice!");
    });

    test("should use default name when name is empty", () => {
      const config = { ...baseConfig, name: "" };
      const output = OutputFormatter.formatConsole(config);
      expect(output).toBe("Hello, World!");
    });

    test("should format greeting in different languages", () => {
      const config = { ...baseConfig, language: "zh", name: "世界" };
      const output = OutputFormatter.formatConsole(config);
      expect(output).toBe("你好, 世界!");
    });
  });

  describe("formatJSON", () => {
    test("should format as valid JSON", () => {
      const output = OutputFormatter.formatJSON(baseConfig);
      const parsed = JSON.parse(output);
      expect(parsed.greeting).toBe("Hello");
      expect(parsed.target).toBe("World");
      expect(parsed.times).toBe(1);
      expect(parsed.language).toBe("en");
      expect(parsed.timestamp).toBeDefined();
    });

    test("should include all metadata", () => {
      const output = OutputFormatter.formatJSON(baseConfig);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("greeting");
      expect(parsed).toHaveProperty("target");
      expect(parsed).toHaveProperty("times");
      expect(parsed).toHaveProperty("language");
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("supportedLanguages");
      expect(Array.isArray(parsed.supportedLanguages)).toBe(true);
    });
  });

  describe("formatHTML", () => {
    test("should generate valid HTML", () => {
      const output = OutputFormatter.formatHTML(baseConfig);
      expect(output).toContain("<!DOCTYPE html>");
      expect(output).toContain("<html");
      expect(output).toContain("<head>");
      expect(output).toContain("<body>");
      expect(output).toContain("Hello, World!");
      expect(output).toContain("</html>");
    });

    test("should include proper language attribute", () => {
      const config = { ...baseConfig, language: "zh" };
      const output = OutputFormatter.formatHTML(config);
      expect(output).toContain('lang="zh"');
    });

    test("should include custom name", () => {
      const config = { ...baseConfig, name: "Alice" };
      const output = OutputFormatter.formatHTML(config);
      expect(output).toContain("Hello, Alice!");
    });

    test("should generate multiple greetings when times > 1", () => {
      const config = { ...baseConfig, times: 2 };
      const output = OutputFormatter.formatHTML(config);
      expect(output).toContain("Hello, World! (1/2)");
      expect(output).toContain("Hello, World! (2/2)");
    });
  });

  describe("format", () => {
    test("should dispatch to correct formatter", () => {
      const consoleOutput = OutputFormatter.format({
        ...baseConfig,
        format: OutputFormat.Console,
      });
      expect(consoleOutput).toBe("Hello, World!");

      const jsonOutput = OutputFormatter.format({
        ...baseConfig,
        format: OutputFormat.JSON,
      });
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const htmlOutput = OutputFormatter.format({
        ...baseConfig,
        format: OutputFormat.HTML,
      });
      expect(htmlOutput).toContain("<!DOCTYPE html>");
    });

    test("should throw error for unsupported format", () => {
      expect(() => {
        OutputFormatter.format({
          ...baseConfig,
          format: "invalid" as OutputFormat,
        });
      }).toThrow("Unsupported format");
    });
  });
});

describe("ConfigManager", () => {
  describe("validate", () => {
    test("should merge with defaults", () => {
      const config = ConfigManager.validate({});
      expect(config.name).toBe("World");
      expect(config.times).toBe(1);
      expect(config.language).toBe("en");
      expect(config.format).toBe(OutputFormat.Console);
      expect(config.verbose).toBe(false);
    });

    test("should override defaults with provided values", () => {
      const config = ConfigManager.validate({
        name: "Alice",
        times: 5,
        language: "zh",
        format: OutputFormat.JSON,
        verbose: true,
      });
      expect(config.name).toBe("Alice");
      expect(config.times).toBe(5);
      expect(config.language).toBe("zh");
      expect(config.format).toBe(OutputFormat.JSON);
      expect(config.verbose).toBe(true);
    });

    test("should throw error for times < 1", () => {
      expect(() => {
        ConfigManager.validate({ times: 0 });
      }).toThrow("Times must be at least 1");
    });

    test("should throw error for times > 100", () => {
      expect(() => {
        ConfigManager.validate({ times: 101 });
      }).toThrow("Times cannot exceed 100");
    });

    test("should throw error for invalid language", () => {
      expect(() => {
        ConfigManager.validate({ language: "invalid" });
      }).toThrow("Unsupported language");
    });

    test("should accept boundary values", () => {
      const config1 = ConfigManager.validate({ times: 1 });
      expect(config1.times).toBe(1);

      const config2 = ConfigManager.validate({ times: 100 });
      expect(config2.times).toBe(100);
    });
  });
});

describe("Integration Tests", () => {
  test("should complete full workflow for console output", () => {
    const rawConfig = {
      name: "Alice",
      times: 2,
      language: "es",
      format: OutputFormat.Console,
      verbose: false,
    };
    const config = ConfigManager.validate(rawConfig);
    const output = OutputFormatter.format(config);
    expect(output).toContain("Hola, Alice!");
  });

  test("should complete full workflow for JSON output", () => {
    const rawConfig = {
      name: "世界",
      times: 1,
      language: "zh",
      format: OutputFormat.JSON,
      verbose: false,
    };
    const config = ConfigManager.validate(rawConfig);
    const output = OutputFormatter.format(config);
    const parsed = JSON.parse(output);
    expect(parsed.greeting).toBe("你好");
    expect(parsed.target).toBe("世界");
  });

  test("should complete full workflow for HTML output", () => {
    const rawConfig = {
      name: "CorpCraft",
      times: 1,
      language: "en",
      format: OutputFormat.HTML,
      verbose: false,
    };
    const config = ConfigManager.validate(rawConfig);
    const output = OutputFormatter.format(config);
    expect(output).toContain("Hello, CorpCraft!");
    expect(output).toContain("<!DOCTYPE html>");
  });
});
