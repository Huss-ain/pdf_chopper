import fitz  # PyMuPDF
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pdf_loader.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedPDFLoader:
    def __init__(self, pdf_path: str):
        """
        Initialize the PDF loader with enhanced features
        Args:
            pdf_path: Path to the PDF file
        """
        self.pdf_path = Path(pdf_path)
        self.doc = None
        self.metadata = None
        self._validate_path()
    
    def _validate_path(self) -> None:
        """Validate the PDF path exists and is accessible"""
        if not self.pdf_path.exists():
            logger.error(f"PDF file not found: {self.pdf_path}")
            raise FileNotFoundError(f"PDF file not found: {self.pdf_path}")
        
        if not self.pdf_path.suffix.lower() == '.pdf':
            logger.error(f"File is not a PDF: {self.pdf_path}")
            raise ValueError(f"File must be a PDF: {self.pdf_path}")
    
    def load(self) -> bool:
        """
        Load the PDF document with error handling
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        try:
            self.doc = fitz.open(self.pdf_path)
            self.metadata = self._extract_metadata()
            logger.info(f"Successfully loaded PDF: {self.pdf_path.name}")
            return True
        
        except fitz.FileDataError as e:
            logger.error(f"Invalid or corrupted PDF file: {e}")
            return False
        
        except fitz.EmptyFileError:
            logger.error("PDF file is empty")
            return False
        
        except Exception as e:
            logger.error(f"Error loading PDF: {str(e)}")
            return False
    
    def _extract_metadata(self) -> Dict[str, Any]:
        """Extract and enhance PDF metadata"""
        if not self.doc:
            return {}
        
        try:
            metadata = {
                'title': self.doc.metadata.get('title', 'Unknown'),
                'author': self.doc.metadata.get('author', 'Unknown'),
                'subject': self.doc.metadata.get('subject', ''),
                'keywords': self.doc.metadata.get('keywords', ''),
                'page_count': len(self.doc),
                'file_size': self.pdf_path.stat().st_size,
                'creation_date': self.doc.metadata.get('creationDate', ''),
                'modified_date': self.doc.metadata.get('modDate', ''),
                'is_encrypted': self.doc.is_encrypted,
                'permissions': self._get_permissions(),
                'loaded_at': datetime.now().isoformat()
            }
            return metadata
        
        except Exception as e:
            logger.error(f"Error extracting metadata: {str(e)}")
            return {}
    
    def _get_permissions(self) -> Dict[str, bool]:
        """Get PDF permissions"""
        if not self.doc:
            return {}
        
        try:
            perm = self.doc.permissions
            if isinstance(perm, int):
                return {
                    'print': bool(perm & fitz.PDF_PERM_PRINT),
                    'copy': bool(perm & fitz.PDF_PERM_COPY),
                    'modify': bool(perm & fitz.PDF_PERM_MODIFY),
                    'annotate': bool(perm & fitz.PDF_PERM_ANNOTATE)
                }
            else:
                return {
                    'print': bool(perm.get('print', False)),
                    'copy': bool(perm.get('copy', False)),
                    'modify': bool(perm.get('modify', False)),
                    'annotate': bool(perm.get('annotate', False))
                }
        except Exception as e:
            logger.warning(f"Could not get permissions: {str(e)}")
            return {
                'print': False,
                'copy': False,
                'modify': False,
                'annotate': False
            }
    
    def get_page_count(self) -> int:
        """Get the total number of pages"""
        return len(self.doc) if self.doc else 0
    
    def get_page_text(self, page_number: int) -> Optional[str]:
        """
        Get text content from a specific page
        Args:
            page_number: 0-based page number
        Returns:
            str: Page text content or None if error
        """
        try:
            if not self.doc or page_number < 0 or page_number >= len(self.doc):
                return None
            return self.doc[page_number].get_text()
        except Exception as e:
            logger.error(f"Error extracting text from page {page_number}: {str(e)}")
            return None
    
    def get_page_dimensions(self, page_number: int) -> Optional[Tuple[float, float]]:
        """Get page dimensions (width, height)"""
        try:
            if not self.doc or page_number < 0 or page_number >= len(self.doc):
                return None
            rect = self.doc[page_number].rect
            return (rect.width, rect.height)
        except Exception as e:
            logger.error(f"Error getting page dimensions: {str(e)}")
            return None
    
    def is_valid(self) -> bool:
        """Check if PDF is valid and accessible"""
        return self.doc is not None and not self.doc.is_closed
    
    def get_document(self) -> Optional[fitz.Document]:
        """Get the PyMuPDF document object"""
        return self.doc if self.is_valid() else None
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get the extracted metadata"""
        return self.metadata or {}
    
    def close(self) -> None:
        """Safely close the PDF document"""
        try:
            if self.doc and not self.doc.is_closed:
                self.doc.close()
                logger.debug("PDF document closed successfully")
        except Exception as e:
            logger.error(f"Error closing PDF: {str(e)}")
