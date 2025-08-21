from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional
from pathlib import Path
import uuid
import sys
from fastapi.middleware.cors import CORSMiddleware
sys.path.append(str(Path(__file__).resolve().parent.parent))
from core.toc_extractor import TOCExtractor
from core.gemini_toc_extractor import GeminiTOCExtractor
from core.splitter import PDFSplitter
from core.file_organizer import archive_output, sanitize_filename
import time
# Correct PyMuPDF import (library installs as 'fitz')
import fitz

app = FastAPI(title="PDF Book Breakdown API")

# CORS middleware for frontend-backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["http://localhost:5174"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores for demo purposes (replace with DB or persistent storage in production)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)
JOBS = {}
EDITED_TOCS = {}

@app.post("/upload")
def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file. Returns a file ID for further processing.
    """
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return {"file_id": file_id, "file_path": str(file_path)}

@app.get("/toc")
def get_toc(file_id: str):
    """
    Extract and return TOC structure using rules-based method.
    Returns built-in PDF bookmarks or fallback single-chapter structure.
    """
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    try:
        extractor = TOCExtractor(str(file_path))
        toc_data = extractor.extract()
        
        if not toc_data or not toc_data.get('chapters'):
            # If extraction fails, return a basic fallback
            return {
                'toc': {
                    'chapters': [
                        {
                            'title': 'Document', 
                            'number': '1', 
                            'page': 1, 
                            'subtopics': [], 
                            'end_page': 1
                        }
                    ]
                }, 
                'source': 'fallback'
            }
        
        return {
            'toc': toc_data,
            'source': 'rules_based'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rules-based TOC extraction failed: {str(e)}")

@app.post("/toc/gemini")
def extract_toc_with_gemini(request: dict = Body(...)):
    """Extract TOC pages with Gemini and return raw JSON + structured toc.

    Frontend expects an unmodified JSON so we pass through both the parsed structure
    (under 'toc') and the original cleaned response text for inspection.
    """
    # Extract values from request body
    file_id = request.get("file_id")
    toc_start_page = request.get("toc_start_page")
    toc_end_page = request.get("toc_end_page") 
    content_start_page = request.get("content_start_page", 1)
    
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")
    if toc_start_page is None:
        raise HTTPException(status_code=400, detail="toc_start_page is required")
    if toc_end_page is None:
        raise HTTPException(status_code=400, detail="toc_end_page is required")
    
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    try:
        gemini_extractor = GeminiTOCExtractor(str(file_path))
        result = gemini_extractor.extract(toc_start_page, toc_end_page, content_start_page)
        if not result or not result.get("toc"):
            raise HTTPException(status_code=500, detail="Failed to extract TOC with Gemini")
        return {
            **result,
            "source": "gemini",
            "pages_processed": f"{toc_start_page}-{toc_end_page}",
            "content_start_page": content_start_page,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": "Gemini TOC extraction error",
            "message": str(e)
        })

@app.post("/toc/edit")
def edit_toc(file_id: str, toc: dict):
    """
    Accept an edited TOC structure from the UI and store it in memory.
    """
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")
    EDITED_TOCS[file_id] = toc
    return {"status": "success", "toc": toc}

@app.post("/split")
def split_pdf(file_id: str, background_tasks: BackgroundTasks, toc: Optional[dict] = Body(default=None)):
    """Start splitting using provided TOC body, edited TOC (if previously saved),
    or freshly extracted built-in/fallback TOC. Returns job id."""
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")
    toc_data = toc or EDITED_TOCS.get(file_id)
    if not toc_data:
        extractor = TOCExtractor(str(file_path))
        toc_data = extractor.extract()
    if not toc_data or not toc_data.get('chapters'):
        raise HTTPException(status_code=422, detail="No TOC available for splitting.")
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "in_progress", "progress": 0}
    background_tasks.add_task(run_split_job, file_path, toc_data, job_id)
    return {"job_id": job_id}

def run_split_job(file_path: Path, toc_data: dict, job_id: str):
    """
    Background task: splits the PDF, archives the output, updates job status/progress.
    """
    try:
        JOBS[job_id] = {"status": "in_progress", "progress": 10}
        # Prepare output directory for this job
        book_name = file_path.stem
        output_dir = OUTPUT_DIR / sanitize_filename(book_name)
        output_dir.mkdir(parents=True, exist_ok=True)
        # Split the PDF
        splitter = PDFSplitter(str(file_path), toc_data)
        success = splitter.split(str(output_dir))
        if not success:
            JOBS[job_id] = {"status": "failed", "progress": 100, "error": "Splitting failed"}
            return
        JOBS[job_id] = {"status": "in_progress", "progress": 80}
        # Archive the output
        zip_path = archive_output(output_dir, archive_name=f"{job_id}.zip")
        JOBS[job_id] = {"status": "completed", "progress": 100, "zip_path": str(zip_path)}
    except Exception as e:
        JOBS[job_id] = {"status": "failed", "progress": 100, "error": str(e)}

@app.get("/progress")
def get_progress(job_id: str):
    """
    Returns the status/progress of a split job.
    """
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/download")
def download_output(job_id: str):
    """
    Download the zipped output for a completed split job.
    """
    job = JOBS.get(job_id)
    if not job or job.get("status") != "completed" or "zip_path" not in job:
        raise HTTPException(status_code=404, detail="Output not found or job not completed")
    zip_path = Path(job["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Zip file not found")
    return FileResponse(zip_path, filename=f"output_{job_id}.zip")

@app.get("/pdf")
def stream_pdf(file_id: str):
    """Serve the uploaded PDF inline for browser viewing."""
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")
    headers = {"Content-Disposition": f"inline; filename={file_id}.pdf"}
    return FileResponse(file_path, media_type="application/pdf", headers=headers)

@app.get("/pdf/info")
def pdf_info(file_id: str):
    """Return simple metadata about the PDF (currently only page count)."""
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")
    try:
        with fitz.open(str(file_path)) as doc:
            return {"pages": doc.page_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF info: {e}")

