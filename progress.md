# Project Progress Log

Date: 2025-08-18 (Updated)

This file tracks what has been completed so far. Recent simplifications appended.

## Completed Items

### Backend
- Implemented FastAPI endpoints: /upload, /toc, /toc/edit, /split, /progress, /download.
- Core PDF processing modules in `app/core/`: `pdf_loader.py`, `toc_extractor.py`, `splitter.py`, `file_organizer.py`.
- Table of Contents extraction (initially: built-in + text-based + merged) NOW SIMPLIFIED to built-in only with automatic single-chapter fallback.
- Background splitting job with simple in-memory job tracking & zip archiving.
- Logging configured (writes to `pdf_loader.log`).
- README fully overhauled: comprehensive setup, API usage examples, data model, limitations, roadmap.

### Frontend (Refactor & UX Simplification)
- Replaced multi-page manual workflow with a single guided stepper (`WorkflowStepper` component).
- Added centralized state management via `WorkflowContext` (upload → TOC → split → download lifecycle).
- Auto-advancing steps remove need for manual UUID copy/paste.
- Introduced dark/light theme toggle and modern theme styling (custom palette, radii, Inter-like typography).
- Removed obsolete routed pages (`UploadPage`, `TOCEditorPage`, `ProgressPage`, `DownloadPage`, etc.).
- (Removed) TOC variant selector (Built-in / Text / Merged) after deciding text/merged provided little value.
- (Removed) Force Text TOC re-extraction action.
- Simplified layout: removed Vite template centering; full-width root lets MUI Container manage layout.
 - Added global toast notification system (`ToastContext`).
 - Graceful handling for PDFs with no detectable TOC: automatic backend fallback OR user-created simple single chapter.
	- Manual TOC builder removed; simple fallback retained.
	- Inline PDF preview (iframe) + page navigation + total pages via /pdf & /pdf/info.
	- Automatic numbering fallback display for chapters/subtopics.

### UI / Styling Adjustments
- Eliminated legacy `#root` max-width & flex centering causing awkward middle-left alignment.
- Body layout reset to allow natural app growth and consistent theming.

## Files Added
- `progress.md`
- `frontend/src/state/WorkflowContext.tsx`
- `frontend/src/components/WorkflowStepper.tsx`
- `frontend/src/state/ToastContext.tsx`

## Files Updated
- `README.md` (completely rewritten)
- `frontend/src/App.tsx` (simplified to stepper + theme)
- `frontend/src/App.css` & `frontend/src/index.css` (layout adjustments)
 - `frontend/src/state/WorkflowContext.tsx` (added saveEditedTOC)
 - `frontend/src/components/WorkflowStepper.tsx` (fallback simple TOC flow)
 - `app/api/routes.py` (/split validation & clearer error message)
 - (Removed manual TOC builder related code & metadata endpoint.)
 - `app/api/routes.py` (/pdf streaming endpoint)
 - `frontend/src/components/PDFPreview.tsx` (PDF inline preview)
 - `frontend/src/components/WorkflowStepper.tsx` (now single TOC mode; removed variant toggles & force text)
 - (Removed) `frontend/src/components/PDFReader.tsx` (reverted to simpler preview)
 - (Removed) text-based & merged TOC logic in `toc_extractor.py`; endpoint `/toc` simplified.

## Recent Simplifications (2025-08-18)
- Removed unreliable text-based TOC heuristic and merged union.
- Backend `/toc` now returns only built-in TOC or a generated fallback chapter.
- Frontend cleaned: removed toggle buttons and force text button; single Extract TOC action.
- Ensures user always has a TOC path to proceed (no blocking errors for extraction failures).
- Removed redundant "Create Simple TOC" button (fallback now automatic; manual creation unnecessary).

### Patch: Splitting Reliability Fix (2025-08-18)
- Fixed issue where clicking Start Split only showed a toast but produced no output.
- Cause: `/split` endpoint depended on edited or legacy extracted TOC logic referencing removed text-based path; could yield None and silently short-circuit real splitting.
- Changes:
	- Simplified `TOCExtractor.extract()` to only return built-in or single-chapter fallback (removed stale text-based references).
	- Updated `/split` to accept TOC in request body (preferred), else edited, else live extract.
	- Frontend `startSplit()` now POSTs current TOC in body ensuring backend uses exactly what user saw.
	- Adjusted toast copy to: "Split job started" for clarity.
- Result: Split job now launches; progress advances (`/progress` reports in_progress → completed) and archive downloads correctly.

### Incremental UI Feedback Improvements (2025-08-18)
- Stepper no longer auto-advances to Download on mere job creation; waits for `status=completed`.
- Split step now shows determinate progress when numeric percentage available; otherwise indeterminate.
- Immediate navigation into Split step on job start for clearer feedback.
- Added progress percentage text alongside status.

### Viewer Persistence Fix (2025-08-18)
- PDF preview disappeared after upload because UI stopped passing local File once fileId existed.
- Updated `WorkflowStepper` to always pass `file` to `PageNumberIframeViewer`.
- Viewer now prefers local `objectURL` while available; falls back to server stream when no local file.
- Result: Continuous preview before and after upload.

### Viewer Reliability Upgrade (2025-08-18)
- Added Browser vs Canvas toggle in `PageNumberIframeViewer`.
- Canvas fallback renders current page using pdf.js for environments where iframe plugin fails / disappears.
- Removed hash page anchor for blob URLs to avoid blank display in some browsers after object URL changes.
- Keeps page navigation functional across both modes.

### Viewer Simplification (2025-08-18)
- Removed unreliable iframe/browser mode entirely; canvas (pdf.js render) now sole implementation.
- Eliminates blank display edge cases and mode toggle UI clutter.
- Future enhancement (optional): add lazy multi-page render or thumbnail strip.

Next minor candidates:
	- Show live progress percent (derive from chapter count processed) instead of static bar.
	- Add per-chapter logging surface in UI.
	- Optionally stream list of produced files before zipping.

---
(End of current progress log. Future changes will append new dated sections above or below as preferred.)
