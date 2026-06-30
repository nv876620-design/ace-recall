# TL;DR: Fix Augment Indexing Loop

## Vấn đề
Augment-BYOK lặp indexing workspace `Orchids-2api` mỗi 5-10 phút, timeout 300s, 0 files uploaded.

## Nguyên nhân
Extension có `apiToken` trong config → Nghĩ đang ở Cloud Mode → Cố upload context → Auth URL sai → Fail → Retry loop.

**KHÔNG phải do file lớn!** Augment tự động skip content >128KB, nhưng vẫn track metadata.

## Fix nhanh nhất

### 1. Chạy script tự động (Khuyến nghị)

```bash
node D:\MCP\ACE\scripts\fix-augment-config.cjs
```

Script sẽ tự động:
- Backup config hiện tại
- Xóa `apiToken` → Chuyển sang Pure Local Mode
- Hiển thị kết quả

**Hoặc** edit thủ công `C:\Users\ndnvi\AppData\Roaming\Code\User\globalStorage\augment.vscode-augment\byok-config.json`:

```json
{
  "official": {
    "completionUrl": "http://localhost:3000",
    "apiToken": ""  // ← XÓA token này
  }
}
```

Restart VSCode → Extension chuyển sang Pure Local Mode → Không upload gì cả.

### 2. Xóa cache cũ

Sau đó **đóng VSCode**, chạy:
```cmd
D:\MCP\ACE\scripts\fix-augment-indexing-loop.bat
```

## Hoặc

**Close workspace `Orchids-2api`** trong VSCode nếu không cần.

## Xem thêm
- [Giải thích chi tiết](./AUGMENT_CONTEXT_INDEXING_EXPLAINED.md) - Cơ chế Cloud vs Local mode
- [Hướng dẫn đầy đủ](./AUGMENT_FIX_INDEXING_LOOP.md) - 5 cách fix khác nhau
