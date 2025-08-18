import re
import logging
import os
from pathlib import Path
from typing import List, Dict, Optional, Any
from .pdf_loader import EnhancedPDFLoader

logger = logging.getLogger(__name__)

class TOCExtractor:
    """
    Extracts the Table of Contents (TOC) from a PDF using both built-in and text-based methods.
    Returns a hierarchical structure of chapters and subchapters with page numbers.
    """
    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.loader = EnhancedPDFLoader(pdf_path)
        self.doc = None
        # Allow disabling the built-in generic fallback heuristic via env var for debugging
        self.disable_generic_fallback = os.getenv("DISABLE_GENERIC_TOC_FALLBACK", "0") == "1"

    def extract(self) -> Optional[Dict[str, Any]]:
        """Simplified extraction: built-in bookmarks only, otherwise single-chapter fallback.
        Returns structure {'chapters': [...]} or None on load failure.
        """
        if not self.loader.load():
            logger.error("Failed to load PDF for TOC extraction.")
            return None
        self.doc = self.loader.get_document()
        toc = self.doc.get_toc() if self.doc else []
        if toc:
            logger.info("Using built-in PDF TOC.")
            return self._parse_builtin_toc(toc)
        # Fallback single chapter covering whole document
        try:
            page_count = self.doc.page_count if self.doc else 1
        except Exception:
            page_count = 1
        logger.info("No built-in TOC found; returning single-chapter fallback.")
        return { 'chapters': [ { 'title': 'Document', 'number': '1', 'page': 1, 'subtopics': [], 'end_page': page_count } ] }

    def extract_built_in(self) -> Optional[Dict[str, Any]]:
        """
        Extract the TOC using only the built-in PDF bookmarks.
        """
        if not self.loader.load():
            logger.error("Failed to load PDF for built-in TOC extraction.")
            return None
        self.doc = self.loader.get_document()
        toc = self.doc.get_toc() if self.doc else []
        if toc:
            return self._parse_builtin_toc(toc)
        return None

    # Removed text-based & merge methods per simplification request.

    def _parse_builtin_toc(self, toc: List[List[Any]]) -> Dict[str, Any]:
        """Parse the built-in TOC (bookmarks) to hierarchical structure.
        Adds sequential numbering per level if none detected to improve downstream naming.
        """
        root: List[Dict[str, Any]] = []
        stack: List[tuple] = []  # (level, node, sibling_count)
        # Track counters per depth to assign numbers like 1, 1.1, 1.2, 2, ...
        counters: Dict[int, int] = {}
        for entry in toc:
            if len(entry) < 3:
                continue
            level, title, page = entry
            title_clean = title.strip()
            # Update counter for this level
            counters[level] = counters.get(level, 0) + 1
            # Reset deeper level counters
            deeper_levels = [l for l in list(counters.keys()) if l > level]
            for dl in deeper_levels:
                counters.pop(dl, None)
            # Compose number string
            number_parts = [str(counters[l]) for l in sorted(counters.keys()) if l <= level]
            number = ".".join(number_parts)
            node = {
                'title': title_clean,
                'number': number,
                'page': page,
                'subtopics': []
            }
            # Adjust stack to current level (PyMuPDF levels start at 1)
            while stack and stack[-1][0] >= level:
                stack.pop()
            if stack:
                stack[-1][1]['subtopics'].append(node)
            else:
                root.append(node)
            stack.append((level, node, counters[level]))
        return {'chapters': root}

    def _extract_chapter_number(self, title: str) -> str:
        """Extract chapter number from a title string."""
        # Try to match 'Chapter 1', '1. Title', etc.
        match = re.match(r'(?i)chapter\s+(\d+)', title)
        if match:
            return match.group(1)
        match = re.match(r'^(\d+)\.', title)
        if match:
            return match.group(1)
        return ''

    def _extract_subtopic_number(self, title: str) -> str:
        """Extract subtopic number from a title string."""
        match = re.match(r'^(\d+\.\d+)', title)
        if match:
            return match.group(1)
        return ''

    # Removed text-based parsing implementation.

    # Removed TOC page locator (text-based heuristic).

    # Removed text-based parsing utilities.
