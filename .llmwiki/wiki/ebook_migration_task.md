# Ebook Migration Continuation

## Status
- **Source**: `F:\calibre\extracthere\calibre.zip`
- **Destination**: `F:\ebooks`
- **Migration Script**: `c:\Users\olive\home-spotify\scratch\migrate_ebooks.ps1`
- **Progress**: 
    - Total books estimated in ZIP: **324**
    - Books moved so far: **~142**
    - Books pending extraction/migration: **~182**

## Changes Made
1. **Backend**: Modified `backend/internal/library/ebook_scanner.go` to automatically set the `collection` field from the parent folder name if it's currently empty.
2. **Scripting**: Created a PowerShell script to move books into genre-based folders (`F:\ebooks\[Genre]`) based on tags found in `metadata.opf`.

## Next Steps
1. **Run Migration**: Execute the following command periodically until all books are moved:
   ```powershell
   powershell -File c:\Users\olive\home-spotify\scratch\migrate_ebooks.ps1
   ```
2. **Trigger Scan**: Once migration is complete, trigger a library scan:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/scan"
   ```
3. **Verify**: Check the `F:\ebooks` directory and the app's UI to ensure all books are correctly categorized.
4. **Cleanup**: After verification, delete the `F:\calibre\extracthere` directory.

## Notes
- **Lọc trùng thông minh**: Script hiện đã sử dụng mã băm nội dung (MD5 hash). Nếu một cuốn sách có nội dung giống hệt cuốn đã có trong `F:\ebooks`, nó sẽ bị bỏ qua ngay cả khi tên file khác nhau.
- **Xử lý trùng tên**: Nếu hai cuốn sách có nội dung khác nhau nhưng trùng tên file, script sẽ tự động thêm một đoạn mã băm ngắn vào tên file mới để tránh ghi đè.
- Script tự động loại bỏ các file rác của Mac (`._*`) và `__MACOSX`.
- Nếu sách không có tag trong `metadata.opf`, nó sẽ vào mục `Uncategorized`.

## Origin
- legacy backfill (harness-update) — commit gần nhất: 7c8f2f4 2026-05-28
