# SSE Client Testing Guide

## Prerequisites

```bash
# Install dependencies (Node.js)
npm install eventsource

# Or with pnpm
pnpm add eventsource
```

## Setup

### 1. Start the HTTP server

```bash
# Default port 3000
ace mcp-http

# Custom port
ace mcp-http --port 8080 --host 0.0.0.0
```

### 2. Create an API token

```bash
# Create a new token for user 'alice'
ace token create alice --description "Development token" --expires-in 30

# Output:
# ━━━━ Token Created ━━━━
#
# Token ID: abc123...
# User ID:  alice
# Token:    ace_xxxxxxxxxxxx...
#
# ⚠️  Save this token securely - it will not be shown again!
```

### 3. Test the connection

```bash
# Health check (no auth required)
curl http://localhost:3000/health

# Create session (requires auth)
curl -X POST http://localhost:3000/mcp/session \
  -H "Authorization: Bearer ace_xxxxxxxxxxxx" \
  -H "Content-Type: application/json"

# Response:
# {
#   "sessionId": "sess_yyyyyyy",
#   "userId": "alice",
#   "createdAt": 1234567890,
#   "sseEndpoint": "/mcp/sse?sessionId=sess_yyyyyyy",
#   "mcpEndpoint": "/mcp"
# }
```

## Using the Client (Node.js)

```typescript
import { ACEMCPClient } from './src/mcp/sseClient.js';

async function main() {
  const client = new ACEMCPClient(
    'http://localhost:3000',
    'ace_your_token_here'
  );

  try {
    // 1. Create session
    const sessionId = await client.createSession();
    console.log('✓ Session created:', sessionId);

    // 2. Setup event handlers
    client.on('heartbeat', (data) => {
      console.log('💓 Heartbeat:', new Date(data.timestamp));
    });

    client.on('notification', (data) => {
      console.log('📬 Notification:', data);
    });

    client.on('close', (data) => {
      console.log('❌ Connection closed:', data.reason);
    });

    // 3. Connect SSE stream
    await client.connectSSE();
    console.log('✓ SSE connected');

    // 4. Search codebase
    const result = await client.searchCodebase(
      '/path/to/your/repo',
      'how authentication works',
      ['login', 'auth', 'session']
    );
    
    console.log('✓ Search result:', result);

    // 5. List sessions
    const sessions = await client.listSessions();
    console.log('✓ Active sessions:', sessions);

    // 6. Get stats
    const stats = await client.getStats();
    console.log('✓ Server stats:', stats);

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 7. Cleanup
    await client.disconnect();
    console.log('✓ Disconnected');

  } catch (err) {
    console.error('Error:', err);
    await client.disconnect();
    process.exit(1);
  }
}

main();
```

## API Endpoints

### Authentication

All MCP endpoints require `Authorization: Bearer <token>` header.

### Session Management

#### POST /mcp/session
Create a new MCP session.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "sessionId": "sess_xxxxx",
  "userId": "alice",
  "createdAt": 1234567890,
  "sseEndpoint": "/mcp/sse?sessionId=sess_xxxxx",
  "mcpEndpoint": "/mcp"
}
```

#### GET /mcp/sse?sessionId=xxx
Open SSE connection for real-time events.

**Headers:**
```
Authorization: Bearer <token>
```

**Events:**
- `connected` - Initial connection established
- `heartbeat` - Keep-alive ping (every 30s)
- `notification` - Server notifications
- `close` - Connection closed by server
- `reconnect` - Reconnection requested

#### DELETE /mcp/session/:sessionId
Destroy an active session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

#### GET /mcp/sessions
List all active sessions for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "sess_xxxxx",
      "userId": "alice",
      "createdAt": 1234567890,
      "lastActivity": 1234567890,
      "isConnected": true
    }
  ]
}
```

#### GET /mcp/stats
Get server statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalSessions": 5,
  "activeSessions": 3,
  "connectedSessions": 2
}
```

### MCP JSON-RPC

#### POST /mcp
Send MCP JSON-RPC requests.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
X-Session-Id: sess_xxxxx (optional, updates session activity)
```

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "codebase-retrieval",
    "arguments": {
      "repo_path": "/path/to/repo",
      "information_request": "authentication logic",
      "technical_terms": ["login", "password"]
    }
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "... retrieved code chunks ..."
      }
    ]
  },
  "id": 1
}
```

## Token Management

### Create Token

```bash
ace token create <userId> [options]

Options:
  --description <desc>    Token description
  --expires-in <days>     Expiration time in days
```

### List Tokens

```bash
ace token list <userId>
```

### Revoke Token

```bash
ace token revoke <tokenId>
```

### Cleanup Expired Tokens

```bash
ace token cleanup
```

## Session Lifecycle

1. **Create session** - POST /mcp/session
2. **Connect SSE** - GET /mcp/sse?sessionId=xxx
3. **Send requests** - POST /mcp (with X-Session-Id header)
4. **Receive events** - via SSE stream
5. **Heartbeat** - automatic every 30s
6. **Cleanup** - DELETE /mcp/session/:sessionId or automatic after 30min inactivity

## Security Notes

- **Always use HTTPS in production** - tokens are sensitive
- **Store tokens securely** - never commit to git
- **Set appropriate expiration** - short-lived tokens are safer
- **Monitor active sessions** - use /mcp/stats endpoint
- **Revoke compromised tokens** - immediately revoke if leaked
- **Rate limiting** - consider adding rate limits in production
- **Session timeout** - default 30 minutes, configurable in sessionManager.ts

## Troubleshooting

### "Unauthorized" error
- Check token is valid: `ace token list <userId>`
- Verify Authorization header format: `Bearer <token>`
- Check token hasn't expired

### SSE connection fails
- Verify session exists: `GET /mcp/sessions`
- Check sessionId in URL matches session
- Ensure Bearer token is valid
- For Node.js, install `eventsource` package

### Session timeout
- Default timeout is 30 minutes
- Activity resets timer: send requests with X-Session-Id header
- Reconnect if session expires

### No heartbeat received
- Check SSE connection is active
- Verify server is running
- Check firewall/proxy settings
- Default heartbeat interval: 30 seconds
