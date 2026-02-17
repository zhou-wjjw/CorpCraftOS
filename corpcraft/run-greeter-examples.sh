#!/bin/bash
# Example scripts demonstrating the Modern Multi-Language Greeter usage
# Run this script to see all the features in action

set -e

echo "========================================"
echo "Modern Multi-Language Greeter Examples"
echo "========================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run example
run_example() {
    local description=$1
    local command=$2

    echo -e "${BLUE}Example:${NC} $description"
    echo -e "${YELLOW}Command:${NC} $command"
    echo ""
    eval "$command"
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Check if greeter.js exists
if [ ! -f "greeter.js" ]; then
    echo "Error: greeter.js not found!"
    echo "Please run this script from the directory containing greeter.js"
    exit 1
fi

# Basic usage examples
echo "========================================  "
echo "BASIC USAGE EXAMPLES"
echo "========================================"
echo ""

run_example "Default greeting" \
    "node greeter.js"

run_example "Personalized greeting" \
    "node greeter.js --name Alice"

run_example "Multiple greetings" \
    "node greeter.js --name Bob --times 3"

run_example "Chinese greeting" \
    "node greeter.js --language zh"

run_example "Japanese greeting with custom name" \
    "node greeter.js -l ja -n 太郎"

# Output format examples
echo "========================================"
echo "OUTPUT FORMAT EXAMPLES"
echo "========================================"
echo ""

run_example "JSON format output" \
    "node greeter.js --name Carlos --language es --format json"

run_example "HTML format output" \
    "node greeter.js --name \"CorpCraft\" --language zh --times 2 --format html"

run_example "Verbose mode with JSON" \
    "node greeter.js --name Test --format json --verbose"

# Language demonstrations
echo "========================================"
echo "MULTI-LANGUAGE DEMONSTRATIONS"
echo "========================================"
echo ""

run_example "Spanish" \
    "node greeter.js -l es -n María"

run_example "French" \
    "node greeter.js -l fr -n Pierre"

run_example "German" \
    "node greeter.js -l de -n Hans"

run_example "Italian" \
    "node greeter.js -l it -n Marco"

run_example "Portuguese" \
    "node greeter.js -l pt -n João"

run_example "Russian" \
    "node greeter.js -l ru -n Иван"

run_example "Korean" \
    "node greeter.js -l ko -n 김철수"

run_example "Hindi" \
    "node greeter.js -l hi -n राहुल"

# Short option examples
echo "========================================"
echo "SHORT OPTION EXAMPLES"
echo "========================================"
echo ""

run_example "Using short options" \
    "node greeter.js -n 'Alice' -t 2 -l zh"

run_example "Complex example with short options" \
    "node greeter.js -n 'World' -t 1 -l en -f json"

# Create HTML output file
echo "========================================"
echo "GENERATING HTML OUTPUT FILE"
echo "========================================"
echo ""

echo "Creating hello.html with Chinese greeting..."
node greeter.js --name "CorpCraft" --language zh --times 2 --format html > hello.html

if [ -f "hello.html" ]; then
    echo -e "${GREEN}✓ HTML file created successfully!${NC}"
    echo "File: hello.html"
    echo "Size: $(wc -c < hello.html) bytes"
    echo ""
    echo "You can open it in your browser:"
    echo "  open hello.html          # macOS"
    echo "  xdg-open hello.html      # Linux"
    echo "  start hello.html        # Windows"
else
    echo "Error: Failed to create HTML file"
fi

echo ""
echo "========================================"
echo "All examples completed!"
echo "========================================"
echo ""
echo "Tip: You can run the greeter with --help to see all options:"
echo "  node greeter.js --help"
echo ""
