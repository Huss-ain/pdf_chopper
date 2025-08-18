import os
from pathlib import Path
from typing import List, Dict
import shutil
import zipfile


def sanitize_filename(name: str) -> str:
    """
    Sanitize a string for use as a filename (cross-platform safe).
    """
    safe = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
    return safe.replace(' ', '_')


def create_output_structure(base_dir: Path, book_name: str, chapters: List[Dict]) -> Dict[str, Path]:
    """
    Create output folders for the book and its chapters.
    Returns a dict mapping chapter titles to their folder paths.
    """
    book_dir = base_dir / sanitize_filename(book_name)
    book_dir.mkdir(parents=True, exist_ok=True)
    chapter_dirs = {}
    for chapter in chapters:
        chapter_title = chapter.get('title', 'Chapter')
        chapter_number = chapter.get('number', '')
        safe_chapter = sanitize_filename(f"Chapter_{chapter_number}_{chapter_title}")
        chapter_dir = book_dir / safe_chapter
        chapter_dir.mkdir(parents=True, exist_ok=True)
        chapter_dirs[chapter_title] = chapter_dir
    return {'book_dir': book_dir, 'chapter_dirs': chapter_dirs}


def archive_output(output_dir: Path, archive_name: str = 'output.zip') -> Path:
    """
    Zip the output directory for easy download/sharing.
    Returns the path to the zip file.
    """
    archive_path = output_dir.parent / archive_name
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(output_dir):
            for file in files:
                file_path = Path(root) / file
                zipf.write(file_path, file_path.relative_to(output_dir.parent))
    return archive_path


def cleanup_temp_files(temp_dir: Path):
    """
    Remove temporary files or folders after processing.
    """
    if temp_dir.exists() and temp_dir.is_dir():
        shutil.rmtree(temp_dir)
