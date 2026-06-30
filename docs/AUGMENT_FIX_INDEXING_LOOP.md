# Hướng dẫn Fix Augment-BYOK Indexing Loop

## Vấn đề

Extension Augment-BYOK (v0.876.0-byok) bị lặp indexing workspace `d:\MCP\Orchids-2api` không dừng, với các triệu chứng:

- **Sync timeout 300s** mỗi 5-10 phút
- **288 files** còn "in flight", **0 files uploaded**
- **282MB cache** trong `checkpoint-documents` với `server.exe` đã bị xóa khỏi workspace
- **Auth error lặp lại**: `Failed to extract tenant ID from URL: http://localhost:3000/`

## Nguyên nhân

1. **Config sai mode**: Extension có `apiToken` → nghĩ là Cloud Mode → cố upload context lên cloud
2. **Auth URL sai format**: `http://localhost:3000` không phải URL Augment cloud hợp lệ → auth fail
3. **Empty mtime-cache**: Cache timestamp rỗng → extension luôn nghĩ cần re-index
4. **Cache lỗi thời**: Augment đã cache `server.exe` (281MB JSON checkpoint), nhưng file này đã bị xóa → không verify được

**Lưu ý**: Vấn đề KHÔNG phải do file lớn. Augment đọc 289 files (3 files >128KB chỉ skip upload content), nhưng `blobs uploaded: 0` vì auth error → KHÔNG FILE NÀO upload được.

## Giải pháp

### Cách 1: Xóa cache Augment (Khuyến nghị)

**Bắt buộc: Đóng TẤT CẢ VSCode trước khi chạy**

#### Windows:
```cmd
D:\MCP\ACE\scripts\fix-augment-indexing-loop.bat
```

#### Linux/Mac:
```bash
bash D:/MCP/ACE/scripts/fix-augment-indexing-loop.sh
```

Script sẽ:
- Backup workspace storage hiện tại
- Xóa `checkpoint-documents` (281MB)
- Xóa `mtime-cache.json` lỗi thời
- Sau đó khởi động lại VSCode

### Cách 2: Disable syncing cho workspace này

1. Mở workspace `Orchids-2api` trong VSCode
2. Ctrl+Shift+P → `Augment: Disable Syncing for This Folder`
3. Hoặc thêm vào `.vscode/settings.json`:

```json
{
  "augment.folders.syncingPermission": {
    "d:\\MCP\\Orchids-2api": null
  }
}
```

### Cách 3: Xóa apiToken để chuyển Pure Local Mode (Khuyến nghị nhất)

Sửa `C:\Users\ndnvi\AppData\Roaming\Code\User\globalStorage\augment.vscode-augment\byok-config.json`:

```json
{
  "official": {
    "completionUrl": "http://localhost:3000",
    "apiToken": ""  // XÓA token → Pure BYOK, không upload cloud
  }
}
```

### Cách 4: Fix auth URL (Nếu cần dùng remote backend)

Sửa file `~/.vscode/extensions/augment.vscode-augment-*/byok-config.json`:

```json
{
  "official": {
    "completionUrl": "http://localhost:3000/v1",  // Thêm /v1
    "apiToken": "local-ace-bypass"
  }
}
```

Hoặc trong `C:\Users\ndnvi\AppData\Roaming\Code\User\globalStorage\augment.vscode-augment\byok-config.json`

### Cách 5: Close workspace Orchids-2api

Nếu không cần workspace này, đơn giản:
- File → Close Folder (hoặc Close Window nếu chỉ mở 1 folder)

## Xác minh đã fix

Sau khi áp dụng giải pháp, kiểm tra log:

```bash
# Mở VSCode, đợi 5 phút, export logs lại
grep "Source folder sync timed out" ~/.vscode/logs/*/Augment.log
```

Nếu không thấy dòng này → đã fix thành công!

## Ngăn chặn vấn đề tương tự

Thêm vào `.gitignore` của project:

```gitignore
# Large binaries that Augment shouldn't index
*.exe
*.dll
*.so
*.dylib
*.bin
*.dat
```

Augment sẽ skip những file này trong lần indexing tiếp theo.

## Tham khảo Log

Các log file quan trọng:
- **Sidecar logs**: `~/.vscode/extensions/augment.vscode-augment-*/sidecar-logs/augment-*.log`
- **Extension logs**: VSCode Output → Augment
- **Workspace storage**: `~/AppData/Roaming/Code/User/workspaceStorage/*/Augment.vscode-augment/`

Grep pattern để debug:
```bash
# Tìm sync timeout
grep "sync timed out" <log-file>

# Tìm auth error
grep "Failed to extract tenant ID" <log-file>

# Tìm file metrics
grep "File metrics" <log-file>
```
