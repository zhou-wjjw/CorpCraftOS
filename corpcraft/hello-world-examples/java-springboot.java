// Spring Boot Hello World - 需要添加 Spring Boot 依赖
package com.example.hello;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class HelloApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelloApplication.class, args);
    }
}

@RestController
@RequestMapping("/api")
class HelloController {

    // GET /api/hello
    @GetMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }

    // GET /api/greet/{name}
    @GetMapping("/greet/{name}")
    public String greet(@PathVariable String name) {
        return "Hello, " + name + "!";
    }

    // POST /api/greet
    @PostMapping("/greet")
    public GreetingResponse greet(@RequestBody GreetingRequest request) {
        return new GreetingResponse("Hello, " + request.getName() + "!");
    }

    // 模型类
    static class GreetingRequest {
        private String name;

        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    static class GreetingResponse {
        private String message;

        public GreetingResponse(String message) {
            this.message = message;
        }

        public String getMessage() { return message; }
    }
}

// 配置类示例
@Configuration
class AppConfig {

    @Bean
    public HelloWorldService helloWorldService() {
        return new HelloWorldServiceImpl();
    }
}

interface HelloWorldService {
    String getMessage();
}

class HelloWorldServiceImpl implements HelloWorldService {
    @Override
    public String getMessage() {
        return "Hello from Service!";
    }
}