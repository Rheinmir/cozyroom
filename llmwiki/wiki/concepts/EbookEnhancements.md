# Proposal: Ebook NSFW Tagging & PDF Cover Extraction

## 1. Request Summary
Implement a password-protected NSFW tagging system for ebooks that persists to the server, blurs the cover artwork in the UI, and adds support for extracting the first page of PDF files as a cover image.

## 2. Affected Files & Modules
- **Backend:**
    - `internal/domain/entity.go`: Add `IsNSFW bool` to `Ebook` struct.
    - `internal/db/db.go`: Database migration to add `is_nsfw` (BOOLEAN DEFAULT 0) to `ebooks` table.
    - `internal/repository/sqlite/ebook.go`: Update `List`, `GetByID`, and `Upsert` to include the `is_nsfw` field.
    - `internal/api/routes.go` & `internal/api/ebook.go`: Add `POST /api/ebooks/{id}/nsfw` endpoint.
    - `internal/library/ebook_scanner.go`: Implement PDF cover extraction using `ffmpeg` (extracting the first frame of the PDF).
    - `Dockerfile`: Install `poppler-utils` or ensure `ffmpeg` has PDF support.
- **Frontend:**
    - `src/pages/EbooksPage.tsx`:
        - Add a "Tag NSFW" button/context menu item.
        - Implement a password prompt modal (Password: `owner712002`).
        - Apply CSS filter `blur(20px)` to images where `is_nsfw` is true.
    - `src/index.css`: Add styling for `.nsfw-blurred` and the NSFW toggle UI.

## 3. Potential Side Effects
- **Performance:** Extracting covers from large PDFs during scanning will increase CPU usage and startup time.
- **Cache:** Browsers might cache the unblurred cover; we may need a cache-buster or ensure blurring is handled client-side via the `is_nsfw` flag.

## 4. Minimal Implementation Plan
1. **Schema & Domain:** Add `IsNSFW` to the Go entity and run an `ALTER TABLE` migration in the database initialization.
2. **PDF Extraction:** Enhance `ScanEbooks` to use `ffmpeg -i input.pdf -frames:v 1 output.jpg` for PDFs.
3. **NSFW API:** Create a handler that verifies the `owner712002` password and updates the `is_nsfw` column for the given ebook ID.
4. **Frontend Logic:**
    - Update the `EbookCard` to conditionally apply a blur class.
    - Add a toggle that triggers a `window.prompt` (or custom modal) for the password before sending the API request.

## 5. Success Criteria
- [ ] PDFs in the library display their first page as the cover image.
- [ ] Users can toggle NSFW status after entering the correct password.
- [ ] NSFW status is persistent across devices and sessions.
- [ ] Covers of NSFW-tagged books are visually blurred in the bookshelf view.
