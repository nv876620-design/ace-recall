# Augment-BYOK Context Indexing - Giải thích & Giải pháp

## Hiểu vấn đề thực sự

### Augment làm gì với context?

Augment extension có **2 chế độ hoạt động**:

1. **Official Cloud Mode** (mặc định):
   - Index workspace → Upload lên Augment cloud
   - Khi chat → Cloud tìm kiếm context relevant → Gửi xuống
   - **YÊU CẦU**: Auth token hợp lệ, URL đúng format tenant

2. **Pure BYOK Mode**:
   - Index workspace → Lưu LOCAL (không upload)
   - Khi chat → Tìm kiếm LOCAL → Inject vào prompt
   - **KHÔNG CẦN** cloud upload

### Vấn đề của bạn

Config hiện tại là **HYBRID SAI**:
```json
{
  "official": {
    "completionUrl": "http://localhost:3000",  // Local model
    "apiToken": "local-coderecall-bypass"      // Fake token
  },
  "coderecall": {
    "enabled": false,  // CodeRecall MCP tắt
    ...
  }
}
```

Extension nhận thấy `official.apiToken` tồn tại → Nghĩ là Cloud Mode → Cố upload context → Nhưng URL sai format tenant → **Auth error loop**.

## Augment có respect .gitignore không?

**CÓ**, nhưng **KHÔNG HOÀN TOÀN**:

1. ✅ **Tự động skip**: `.git/`, `node_modules/`, `*.exe`, `*.dll`, etc. (hardcoded)
2. ✅ **Respect .gitignore** khi traverse files
3. ❌ **KHÔNG skip file > 128KB**: Đọc và track, nhưng không upload (set flag "large files")
4. ❌ **KHÔNG hỗ trợ `.augmentignore`** tùy chỉnh

### Tại sao log hiện "large files: 3" nhưng vẫn timeout?

```
- large files: 3
- files read: 289
- blobs uploaded: 0
```

- **289 files đọc**: Include cả large files (để tính hash/metadata)
- **3 large files**: `>128KB` → Không upload content, chỉ track metadata
- **0 uploaded**: Vì auth error → KHÔNG FILE NÀO upload được (không chỉ large files)

Timeout không phải do large files, mà do **extension retry upload mãi không thành công**.

## Giải pháp

### Option 1: Tắt Cloud Sync (Khuyến nghị)

**A. Xóa apiToken để chuyển sang pure local mode:**

Edit `C:\Users\ndnvi\AppData\Roaming\Code\User\globalStorage\augment.vscode-augment\byok-config.json`:

```json
{
  "version": 1,
  "official": {
    "completionUrl": "http://localhost:3000",
    "apiToken": ""  // XÓA token → Pure BYOK
  },
  "coderecall": {
    "enabled": false,
    ...
  }
}
```

**B. Hoặc revoke sync permission cho workspace:**

VSCode Command Palette → `Augment: Disable Syncing for This Folder`

### Option 2: Fix Auth URL (Nếu muốn dùng cloud)

Nếu bạn có Augment Pro account và muốn upload lên cloud:

```json
{
  "official": {
    "completionUrl": "https://api.augmentcode.com/v1",  // URL cloud chính thức
    "apiToken": "your_real_augment_api_token"
  }
}
```

### Option 3: Enable CodeRecall MCP thay thế

Thay vì dùng Augment cloud, dùng CodeRecall local:

```json
{
  "official": {
    "apiToken": ""  // Tắt cloud
  },
  "coderecall": {
    "enabled": true,
    "replaceOfficialRetrieval": true,  // Thay thế Augment retrieval
    "mcpServerPath": "coderecall",
    "mcpServerArgs": ["mcp"],
    "autoIndex": true,
    "injectContext": true,
    "workspacePath": "D:\\MCP\\Orchids-2api"
  }
}
```

## Làm sạch cache cũ

Sau khi chọn giải pháp, xóa cache để reset:

```cmd
# ĐÓNG VSCode trước!
D:\MCP\CodeRecall\scripts\fix-augment-indexing-loop.bat
```

## FAQs

### Q: Augment có upload code lên cloud không?

**A**: Phụ thuộc mode:
- **Cloud mode** (`apiToken` hợp lệ): CÓ, upload embeddings + snippets (max 128KB/file)
- **Pure BYOK** (không token): KHÔNG, tất cả local

### Q: .gitignore có đủ để block file lớn không?

**A**: ĐỦ cho traverse, KHÔNG ĐỦ để skip đọc metadata. Augment vẫn đọc file để tính hash, chỉ không upload content nếu `>128KB`.

### Q: Tại sao không dùng `.augmentignore`?

**A**: Extension chưa hỗ trợ. Chỉ có thể:
1. Dùng `.gitignore` (partial respect)
2. Revoke sync permission per-workspace
3. Disable cloud mode

### Q: File binary có upload không?

**A**: KHÔNG. Augment filter theo:
- Extension whitelist (`.js`, `.ts`, `.py`, `.go`, etc.)
- Size limit (`>128KB` → skip content)
- Binary detection (encoding error → skip)

File `*.exe`, `*.dll`, `*.bin` đã trong blacklist hardcoded.

## Kết luận

**Vấn đề KHÔNG phải do file lớn**, mà do **config sai mode**:
- Augment nghĩ là Cloud Mode → Cố upload
- Auth URL sai → Upload fail → Retry loop

**Giải pháp đơn giản nhất**: Xóa `apiToken` → Pure local mode → Không upload gì cả.
