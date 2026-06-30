# Root Cause Analysis: Augment Indexing Loop

## Phát hiện từ logs mới (2026-06-15 03:32:38)

### 1. Config đã fix nhưng vẫn loop

**Config hiện tại** (sau khi chạy script):
```json
{
  "apiToken": "",  // ✅ Đã xóa
  "enableUpload": true  // ❌ VẪN BẬT!
}
```

**Log evidence**:
```
"enableUpload":true
"mcpServers":[]  // Không có MCP server nào
```

→ Extension vẫn cố upload content (dù không có apiToken).

### 2. Mtime cache KHÔNG BAO GIỜ HIT

**Every single sync attempt**:
```
- mtime cache hits: 0     ← LUÔN LUÔN 0
- mtime cache misses: 288  ← Đọc lại 288 files
- blobs uploaded: 0        ← Không upload được
```

**Why**: Cache chỉ được commit SAU KHI upload thành công. Vì `blobs uploaded: 0` → Cache không bao giờ được ghi → Lần sau quét lại từ đầu.

### 3. Sync permission KHÔNG BỊ REVOKE

**Log evidence**:
```
'SyncingPermissionTracker': Permission to sync folder 
  d:\MCP\Orchids-2api granted at 6/14/2026, 7:51:26 PM; 
  type = implicit
```

Permission được granted "implicit" (tự động) vào 6/14 19:51 và **KHÔNG BAO GIỜ bị revoke**.

Permission lưu trong:
- LevelDB: `workspaceStorage/.../augment-kv-store/` (locked khi VSCode chạy)
- Hoặc global state (không rõ format)

### 4. Workspace storage KHÔNG BỊ DỌN

**Checkpoints vẫn tồn tại**:
```
workspaceStorage/a072ce2d5477b04276f60d17498b663f/
  Augment.vscode-augment/
    augment-user-assets/checkpoint-documents/
      - document-...server.exe-0-... (187MB)
      - document-...server.exe-1-... (94MB)
```

Total: **281MB** checkpoint của file đã bị xóa.

## Root Causes (theo thứ tự ưu tiên)

### #1: Sync Permission không bị revoke
- Permission granted "implicit" → Extension tự động sync
- Không có mechanism để auto-revoke khi upload fail liên tục
- User PHẢI manual revoke qua Command Palette hoặc xóa workspace storage

### #2: enableUpload vẫn true
- Dù xóa `apiToken`, `enableUpload` vẫn true
- Extension vẫn đọc files, probe blobs, cố upload (nhưng skip vì no token)
- Waste CPU/IO mỗi 5-10 phút

### #3: Mtime cache không commit
- Upload fail → Cache transaction rollback
- Lần sau lại quét từ đầu → Infinite loop

### #4: Checkpoint cache lỗi thời
- 281MB checkpoint của `server.exe` đã xóa
- Extension không tự cleanup orphaned checkpoints
- Waste disk space

## Giải pháp đúng

### Option 1: Revoke permission + Clear storage (Khuyến nghị)

**Windows**:
```cmd
D:\MCP\ACE\scripts\revoke-augment-sync-orchids.bat
```

**Linux/Mac**:
```bash
bash D:/MCP/ACE/scripts/revoke-augment-sync-orchids.sh
```

Script sẽ:
1. Backup workspace storage
2. XÓA TOÀN BỘ workspace storage → Permission cleared
3. Khi mở VSCode lại → Augment hỏi lại "Sync folder?"
4. Chọn **"NOT NOW"** hoặc **"Don't ask again"**

### Option 2: Disable enableUpload (Experimental)

VSCode settings.json:
```json
{
  "augment.enableUpload": false  // Có thể không hoạt động
}
```

**⚠️ Không chắc chắn hoạt động** - config này có thể bị override bởi server.

### Option 3: Close workspace Orchids-2api

Nếu không cần workspace này → Đóng hoàn toàn.

## Timeline của vấn đề

1. **6/14 19:51** - User grant sync permission cho Orchids-2api (implicit)
2. **6/14 19:51 - 6/15 07:58** - Loop 1-15: Timeout mỗi 5-10 phút, auth error
3. **6/15 10:26** - User chạy `fix-augment-config.cjs` → Xóa apiToken
4. **6/15 10:28+** - Loop tiếp tục, KHÔNG còn auth error
5. **Hiện tại** - Loop vẫn tiếp diễn vì:
   - Sync permission chưa revoke
   - enableUpload vẫn true
   - Cache không commit

## Lesson Learned

**Xóa apiToken KHÔNG ĐỦ để dừng sync!**

Cần:
1. Revoke sync permission (manual hoặc xóa workspace storage)
2. Hoặc close workspace
3. Hoặc set `enableUpload: false` (nếu config cho phép)
