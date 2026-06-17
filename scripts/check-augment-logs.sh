#!/usr/bin/env bash

# Quick check Augment BYOK + CodeRecall logs trong VS Code Output

echo "🔍 Checking Augment BYOK + CodeRecall Integration Logs"
echo "════════════════════════════════════════════════════════"
echo ""

# Check config file
CONFIG_FILE="$HOME/.augment/byok-config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Config file exists: $CONFIG_FILE"
    echo "   CodeRecall enabled: $(grep -o '"enabled":\s*true' "$CONFIG_FILE" | wc -l)"
    echo ""
else
    echo "❌ Config file NOT found: $CONFIG_FILE"
    echo "   Run: node scripts/generate-augment-config.cjs"
    echo ""
fi

# Check CodeRecall MCP server
CODERECALL_DIST="dist/index.js"
if [ -f "$CODERECALL_DIST" ]; then
    echo "✅ CodeRecall MCP server exists: $CODERECALL_DIST"
    echo ""
else
    echo "❌ CodeRecall NOT built: $CODERECALL_DIST"
    echo "   Run: pnpm build"
    echo ""
fi

# Instructions for viewing logs
echo "📋 How to view logs in VS Code:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. Open VS Code"
echo "2. Press: Ctrl+Shift+U (Windows/Linux) or Cmd+Shift+U (Mac)"
echo "3. In Output panel, select dropdown: 'Augment'"
echo "4. Look for these logs:"
echo ""
echo "   ✅ [INFO] BYOK enabled"
echo "   ✅ [INFO] CodeRecall: Connecting to MCP server"
echo "   ✅ [INFO] CodeRecall: Connected successfully"
echo "   ✅ [INFO] CodeRecall: Searching codebase"
echo "   ✅ [INFO] CodeRecall: Injecting context { chunks: N }"
echo ""
echo "5. If you see errors:"
echo "   ❌ [ERROR] spawn ... ENOENT → Check mcpServerPath in config"
echo "   ❌ [WARN] CodeRecall search failed → Check workspace path"
echo ""

# Check recent CodeRecall logs (if LOG_LEVEL=debug)
CODERECALL_LOG_DIR="$HOME/.coderecall/logs"
if [ -d "$CODERECALL_LOG_DIR" ]; then
    LATEST_LOG=$(ls -t "$CODERECALL_LOG_DIR"/app.*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
        echo "📄 Latest CodeRecall log file:"
        echo "   $LATEST_LOG"
        echo ""
        echo "   Last 10 lines:"
        tail -10 "$LATEST_LOG" | sed 's/^/   /'
        echo ""
    fi
fi

echo "════════════════════════════════════════════════════════"
echo "💡 Tips:"
echo "   • No logs? Make sure Augment extension is installed"
echo "   • Wrong channel? Select 'Augment' from dropdown (not 'Extension Host')"
echo "   • No CodeRecall logs? Check config: enabled: true, injectContext: true"
echo "   • Test manually: node dist/index.js mcp"
echo ""
