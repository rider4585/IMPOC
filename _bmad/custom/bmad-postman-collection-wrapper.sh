#!/bin/bash

# BMad Skill Wrapper: Postman Collection Generator
# This wrapper allows the skill to be called from Claude or CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🚀 BMad Postman Collection Generator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the collection generator
node "$SCRIPT_DIR/bmad-postman-collection.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Collection generation complete!"
echo ""
echo "📥 Next steps:"
echo "  1. Open Postman"
echo "  2. File → Import → Select: $PROJECT_ROOT/postman/postman-collection.json"
echo "  3. Set environment variables (baseUrl, accessToken, etc.)"
echo "  4. Run collection tests"
echo ""
