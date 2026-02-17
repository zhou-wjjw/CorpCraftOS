# Makefile for Hello World Program

.PHONY: help run demo clean test docs

# Default target
help:
	@echo "Hello World Program - Available Targets:"
	@echo "  help      - Show this help message"
	@echo "  run       - Run the hello world program (default)"
	@echo "  demo      - Run demonstration examples"
	@echo "  test      - Run tests (if any)"
	@echo "  clean     - Clean output files"
	@echo "  docs      - Generate documentation"
	@echo ""
	@echo "Usage Examples:"
	@echo "  make run"
	@echo "  make run name=Alice language=zh"
	@echo "  make demo"

# Run the hello world program
run:
	@echo "Running Hello World Program..."
	python hello_world.py $(if $(name),--name $(name)) $(if $(language),--language $(language)) $(if $(format),--format $(format)) $(if $(times),--times $(times))

# Run demonstration
demo:
	@echo "Running demonstration..."
	python examples.py

# Clean output files
clean:
	@echo "Cleaning output files..."
	rm -f hello_output.html hello_multiple.html
	@echo "Clean completed!"

# Run tests (placeholder for future tests)
test:
	@echo "Running tests..."
	@echo "No tests implemented yet."

# Generate documentation
docs:
	@echo "Generating documentation..."
	@echo "Documentation is available in README_hello_world.md"

# Install dependencies (if any)
install:
	@echo "No external dependencies required."
	@echo "Python 3.6+ is required."