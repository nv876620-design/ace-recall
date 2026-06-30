# Augment-BYOK Indexing Loop - Complete Fix Guide

## 📋 Danh sách Documents

1. **[AUGMENT_FIX_QUICK.md](./AUGMENT_FIX_QUICK.md)** - TL;DR fix nhanh nhất (đọc này trước)
2. **[AUGMENT_CONTEXT_INDEXING_EXPLAINED.md](./AUGMENT_CONTEXT_INDEXING_EXPLAINED.md)** - Giải thích chi tiết Cloud vs Local mode
3. **[AUGMENT_FIX_INDEXING_LOOP.md](./AUGMENT_FIX_INDEXING_LOOP.md)** - Hướng dẫn đầy đủ 5 cách fix

## 🔧 Scripts

1. **`scripts/fix-augment-config.js`** - Tự động xóa apiToken trong config (Node.js)
2. **`scripts/fix-augment-indexing-loop.bat`** - Xóa cache Augment (Windows, phải đóng VSCode)
3. **`scripts/fix-augment-indexing-loop.sh`** - Xóa cache Augment (Linux/Mac, phải đóng VSCode)

## 🚀 Quick Start

### Step 1: Fix config (tự động)

```bash
node D:\MCP\ACE\scripts\fix-augment-config.cjs
```

Restart VSCode sau khi chạy.

### Step 2: Xóa cache (nếu vẫn loop)

**Đóng TẤT CẢ VSCode trước!** Sau đó:

```cmd
D:\MCP\ACE\scripts\fix-augment-indexing-loop.bat
```

### Step 3: Xác minh

Mở VSCode, đợi 10 phút. Nếu không thấy timeout log → Fix thành công!

## ❓ FAQs

**Q: Augment có upload code lên cloud không?**
- **Cloud mode** (có apiToken): CÓ, upload embeddings + snippets (max 128KB/file)
- **Pure BYOK** (không token): KHÔNG, tất cả local

**Q: File lớn có gây vấn đề không?**
- KHÔNG. Augment tự động skip content >128KB, chỉ track metadata. Vấn đề thực sự là auth error.

**Q: .gitignore có đủ không?**
- ĐỦ để block file trong traverse, KHÔNG đủ để skip đọc metadata. Dùng "Disable Syncing" nếu muốn skip hoàn toàn.

**Q: Tại sao không dùng `.augmentignore`?**
- Extension chưa hỗ trợ. Chỉ có thể revoke sync permission per-workspace.

## 📊 Vấn đề phát hiện từ Log

```
[WorkspaceManager[Orchids-2api]]: Source folder sync timed out after 300s 
  with 288 items still in flight

File metrics:
  - paths accepted: 288
  - large files: 3
  - files read: 289
  - blobs uploaded: 0  ← AUTH ERROR: Không upload được
  
[VSCodeAuthTokenProvider]: Failed to extract tenant ID from URL: 
  http://localhost:3000/
```

**Root cause**: Config có `apiToken` + localhost URL → Extension nghĩ là Cloud Mode → Cố upload → Auth fail → Retry loop.

## 🎯 Giải pháp

Xóa `apiToken` → Extension chuyển sang **Pure Local Mode**:
- ✅ Index workspace LOCAL
- ✅ Context search LOCAL
- ❌ KHÔNG upload cloud
- ❌ KHÔNG sync across machines

Perfect cho BYOK use case!
