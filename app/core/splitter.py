import logging
from pathlib import Path
from typing import Dict, Any
import pymupdf as fitz
from .pdf_loader import EnhancedPDFLoader

logger = logging.getLogger(__name__)

class PDFSplitter:
    """
    Splits a PDF into chapters and subchapters based on a hierarchical TOC structure.
    Organizes output into folders (one per chapter, subchapters as PDFs inside).
    """
    def __init__(self, pdf_path: str, toc_data: Dict[str, Any]):
        self.pdf_path = Path(pdf_path)
        self.toc_data = toc_data
        self.loader = EnhancedPDFLoader(pdf_path)

    def split(self, output_dir: str) -> bool:
        """
        Recursively splits the PDF into sections as per the TOC tree (all levels).
        Each node with a 'page' is saved as a separate PDF in a folder structure.
        """
        if not self.loader.load():
            logger.error("Failed to load PDF for splitting.")
            return False
        doc = self.loader.get_document()
        output_dir = Path(output_dir)
        book_dir = output_dir / self.pdf_path.stem
        book_dir.mkdir(parents=True, exist_ok=True)
        chapters = self.toc_data.get('chapters', [])

        def recursive_split(nodes, parent_dir, siblings, parent_end_page):
            for idx, node in enumerate(nodes):
                title = node['title']
                number = node.get('number', str(idx+1))
                start_page = node.get('page', 1)
                subtopics = node.get('subtopics', [])
                # Determine end page
                if idx < len(nodes) - 1:
                    end_page = (nodes[idx+1].get('page') or doc.page_count) - 1
                elif parent_end_page is not None:
                    end_page = parent_end_page - 1
                else:
                    end_page = doc.page_count
                # Normalize in case of invalid ordering
                if end_page < start_page:
                    logger.debug(f"Adjusting end_page {end_page} to start_page {start_page} for title '{title}' to avoid zero-page slice.")
                    end_page = start_page
                # Create folder for this node if it has subtopics
                safe_title = self._sanitize_filename(f"{number}_{title}")
                node_dir = parent_dir / safe_title if subtopics else parent_dir
                if subtopics:
                    node_dir.mkdir(parents=True, exist_ok=True)
                # Save this node as a PDF if it has a page
                if 'page' in node and node['page'] is not None:
                    output_file = node_dir / f"{safe_title}.pdf" if subtopics else parent_dir / f"{safe_title}.pdf"
                    self._extract_and_save(doc, start_page, end_page, output_file, title)
                # Recurse into subtopics
                if subtopics:
                    recursive_split(subtopics, node_dir, subtopics, end_page)

        recursive_split(chapters, book_dir, chapters, None)
        return True

    def _extract_and_save(self, doc, start_page: int, end_page: int, output_file: Path, title: str):
        """
        Extracts pages from start_page to end_page (inclusive) and saves as a new PDF.
        """
        try:
            new_doc = fitz.open()
            for page_num in range(start_page-1, end_page):
                if page_num < 0 or page_num >= doc.page_count:
                    break
                new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
            new_doc.save(str(output_file))
            new_doc.close()
            logger.info(f"Saved: {output_file} (pages {start_page} to {end_page})")
        except Exception as e:
            logger.error(f"Error saving '{title}' to {output_file}: {str(e)}")

    def _sanitize_filename(self, name: str) -> str:
        """Sanitize a string for use as a filename."""
        safe = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
        return safe.replace(' ', '_')
