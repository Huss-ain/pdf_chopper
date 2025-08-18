# PDF Book Breakdown (Backend)

Backend service for ingesting textbook / course PDFs, extracting or reconstructing a Table of Contents (TOC), editing it (via a future UI), then splitting the source PDF into organized chapter & subchapter PDFs with downloadable archives.

## ⚡ At a Glance
Core flow: Upload PDF → Extract TOC (built‑in + text-based heuristics) → (Optional) Edit TOC → Background split → Download ZIP of structured outputs.

## 📁 Directory Structure
```
PDF_Book_Breakdown/
├── app/
│   ├── api/                 # FastAPI application & routes
│   └── core/                # PDF loading, TOC extraction, splitting, archiving utilities
├── frontend/                # (Planned / separate UI project scaffold)
├── uploads/                 # Incoming uploaded PDFs (transient)
├── outputs/                 # Per‑job extracted folder trees + zip archives
├── pdf_loader.log           # Combined log output
├── requirements.txt         # Python dependencies
└── README.md                # This document
```
Missing (future): `tests/`, persistent storage layer, config module, auth, queue.

## ✅ Features
* PDF upload with UUID tracking
* Dual TOC strategies:
	* Built‑in bookmarks (if meaningful)
	* Text-based heuristic reconstruction (regex over detected TOC pages)
* Automatic merge / fallback logic
* In‑memory TOC editing endpoint
* Hierarchical splitting (multi-level) into per-section PDFs
* Output archiving (zip) for single-click download
* CORS enabled for local frontend integration
* Modular, easily extended core components

## 🛠 Tech Stack
* Python 3.12+ (tested) / FastAPI / Uvicorn
* PyMuPDF (fitz) for PDF parsing
* Standard library only beyond the above

## 📦 Requirements
Install system libs (macOS usually fine). For Linux you may need MuPDF dependencies.

Python deps (see `requirements.txt`):
```
fastapi
uvicorn[standard]
PyMuPDF
pydantic
python-multipart
```

## 🚀 Quick Start
```bash
git clone <repo-url>
cd PDF_Book_Breakdown
python -m venv .env
source .env/bin/activate  # or: source .env/bin/activate.fish
pip install -r requirements.txt
uvicorn app.api.routes:app --reload
```
Navigate to: http://127.0.0.1:8000/docs for interactive Swagger UI.

## 🔗 API Reference (Summary)
| Method | Path | Purpose | Key Params |
|--------|------|---------|------------|
| POST   | /upload     | Upload a PDF | multipart file
| GET    | /toc        | Get TOC(s)   | file_id, force_text_toc (bool)
| POST   | /toc/edit   | Store edited TOC | file_id, JSON body
| POST   | /split      | Start split job | file_id
| GET    | /progress   | Check job status | job_id
| GET    | /download   | Download zip | job_id

### Example: Upload
```bash
curl -F file=@book.pdf http://127.0.0.1:8000/upload
```
Response:
```json
{"file_id": "<uuid>", "file_path": "uploads/<uuid>.pdf"}
```

### Example: Get TOC
```bash
curl "http://127.0.0.1:8000/toc?file_id=<uuid>"
```
Response shape:
```json
{
	"built_in": {"chapters": [...]},
	"text_based": {"chapters": [...]},
	"merged": {"chapters": [...]}
}
```

### Example: Edited TOC Submit
```bash
curl -X POST "http://127.0.0.1:8000/toc/edit?file_id=<uuid>" \
	-H "Content-Type: application/json" \
	-d '{"chapters": [{"title": "Intro","number":"1","page":1,"subtopics":[]}]}'
```

### Example: Start Split
```bash
curl -X POST "http://127.0.0.1:8000/split?file_id=<uuid>"
```
Returns `{ "job_id": "<uuid>" }`

### Example: Poll Progress
```bash
curl "http://127.0.0.1:8000/progress?job_id=<job>"
```
Progress response:
```json
{"status": "in_progress", "progress": 80}
```

### Example: Download
```bash
curl -L -o output.zip "http://127.0.0.1:8000/download?job_id=<job>"
```

## 🧱 TOC Data Model (Merged / Edited)
```json
{
	"chapters": [
		{
			"title": "Chapter Title",
			"number": "1",
			"page": 5,
			"subtopics": [
				{"title": "1.1 Subtopic", "number": "1", "page": 7, "subtopics": []}
			]
		}
	]
}
```
Notes:
* `page` values are 1-based page indices (as returned by PyMuPDF TOC entries).
* Numbers in nested nodes currently reflect only the final segment (e.g. `1` for `1.1`).

## 🔄 Processing Workflow
1. Upload stored in `uploads/UUID.pdf`.
2. `/toc` loads PDF lazily; extracts built-in bookmarks; if sparse, runs text heuristic.
3. User may send edited merged structure.
4. `/split` spawns background task: builds folder tree → extracts section page ranges → writes PDFs → zips.
5. Client polls `/progress` until `status == completed`, then calls `/download`.

## 📂 Output Layout Example
```
outputs/
	<sanitized-book-name>/
		<job-id>.zip (created after split)
		Original_Book_Name/
			1_Introduction.pdf
			2_Background/               # (directory because it has subtopics)
				2_Background.pdf          # full chapter
				2.1_Context.pdf
				2.2_History.pdf
```

## 🧩 Core Components
| Component | Responsibility |
|-----------|----------------|
| `EnhancedPDFLoader` | Safe open, metadata, page utilities |
| `TOCExtractor` | Built-in & text-based TOC strategies + merging |
| `PDFSplitter` | Hierarchical page-range extraction & saving |
| `file_organizer` | Naming, archiving, basic structure helpers |

## ⚠️ Error & Status Semantics
| Scenario | HTTP | Notes |
|----------|------|-------|
| Missing file_id/job_id | 404 | Not found in in‑memory stores |
| Corrupt / unreadable PDF | 500/422 | Loader returns failure |
| TOC extraction failure | 422 | No usable TOC candidates |
| Split failure | 200 progress endpoint shows `status: failed` with `error` |

## 📝 Logging
Unified logging goes to `pdf_loader.log` + stdout. Adjust `logging.basicConfig` in `pdf_loader.py` for log level, rotation, etc.

## 🔒 Security & Safety Considerations
Current minimal safeguards:
* Filename sanitization for outputs.
* No execution of embedded content.
Recommended next steps:
* File size limits & upload validation.
* MIME sniffing + magic number checks.
* Auth & rate limiting if public.

## 🚧 Limitations
* In-memory storage (TOCs, jobs) – lost on restart.
* Text-based TOC heuristic may mis-group complex academic outlines.
* Page end boundaries inferred heuristically from next start page.
* No streaming progress events (polling only).
* No resume/partial retry logic.

## 🗺 Roadmap Ideas
* Persistent DB (SQLite / Postgres) for jobs & TOCs.
* Structured config (`pydantic-settings`).
* WebSocket push progress updates.
* Advanced TOC ML / LLM refinement pass.
* Multi-file batch processing & bundling.
* User accounts & auth.
* Parallel splitting optimizations (careful with I/O & memory).
* Tests & CI pipeline.

## 🧪 Testing (Planned)
Suggested structure:
```
tests/
	test_toc_extractor.py
	test_splitter.py
	test_api_endpoints.py
```
Use `pytest` + sample fixture PDFs (small, synthetic).

## 📈 Performance Notes
* PyMuPDF is fast; bottlenecks will be disk write & repeated open() calls.
* Consider caching loaded document across steps (currently each extractor/splitter loads separately).
* For very large PDFs, memory spikes if many page objects are materialized; current approach processes sequentially.

## 🤝 Contribution
1. Fork & branch (`feat/<topic>`)
2. Add/adjust tests
3. Ensure lint & type check (add tooling later)
4. Submit PR with concise description

## 📄 License
Add a LICENSE file (e.g., MIT) and reference it here. (Currently not specified.)

## ❓ FAQ
**Q: Pages off by one?**  Ensure the `page` fields map to PyMuPDF 1-based indexing; internal extraction subtracts 1 when iterating.

**Q: Why are some chapters empty?**  TOC heuristic may create placeholder parents when sub-levels appear without explicit parent lines.

**Q: Can I force text-based TOC?**  Yes: `/toc?file_id=...&force_text_toc=true`.

## 🧾 Changelog
Will be started once first tagged release is cut (e.g., `v0.1.0`).

---
This document reflects the current implementation state (no persistent storage + heuristic TOC). Updates welcome.