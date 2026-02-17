// Java 基础 Hello World
public class HelloWorld {
    public static void main(String[] args) {
        // 基本输出
        System.out.println("Hello, World!");

        // 格式化输出
        String name = "World";
        System.out.printf("Hello, %s!%n", name);

        // 使用字符串格式化
        System.out.println(String.format("Hello, %s!", name));

        // 数组参数
        String[] names = {"World", "Everyone", "Java"};
        for (String n : names) {
            System.out.println("Hello, " + n + "!");
        }
    }
}

// 面向对象示例
class Greeter {
    private String name;

    public Greeter(String name) {
        this.name = name;
    }

    public String greet() {
        return "Hello, " + this.name + "!";
    }

    public static void main(String[] args) {
        Greeter greeter = new Greeter("World");
        System.out.println(greeter.greet());
    }
}