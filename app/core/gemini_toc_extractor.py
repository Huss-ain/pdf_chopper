import os
import json
import base64
from io import BytesIO
from typing import Dict, List, Optional, Tuple, Any
from PIL import Image
from pdf2image import convert_from_path, convert_from_bytes
from google.genai import types, Client
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class GeminiTOCExtractor:
    """
    Extracts Table of Contents using Google's Gemini vision model.
    """
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        
        # Configure Gemini API
        api_key = os.getenv('Gemini_llm_key')
        if not api_key:
            raise ValueError("Gemini API key not found in environment variables")
        
        self.client = Client(api_key=api_key)
        
        # Load the prompt template
        prompt_path = Path(__file__).parent.parent / "prompts" / "toc_extraction_prompt.txt"
        with open(prompt_path, 'r') as f:
            self.prompt_template = f.read()
    
    def extract_toc_pages_as_images(self, toc_start_page: int, toc_end_page: int) -> List[str]:
        """
        Extract specific PDF pages as base64-encoded images
        
        Args:
            toc_start_page: First page of TOC (1-indexed)
            toc_end_page: Last page of TOC (1-indexed)
            
        Returns:
            List of base64-encoded image strings
        """
        try:
            # Convert PDF pages to images using pdf2image
            # pdf2image uses 1-based indexing by default
            images = convert_from_path(
                self.pdf_path,
                first_page=toc_start_page,
                last_page=toc_end_page,
                dpi=300,  # High DPI for better text recognition
                fmt='PNG'
            )
            
            base64_images = []
            
            for img in images:
                # Convert PIL Image to base64
                buffer = BytesIO()
                img.save(buffer, format='PNG')
                img_data = buffer.getvalue()
                base64_img = base64.b64encode(img_data).decode('utf-8')
                base64_images.append(base64_img)
            
            return base64_images
        
        except Exception as e:
            print(f"Error extracting PDF pages: {e}")
            return []
    
    def extract_toc_with_gemini(self, toc_start_page: int, toc_end_page: int, content_start_page: int) -> Dict[str, Any]:
        """
        Extract TOC structure using Gemini vision model.
        
        Args:
            toc_start_page: First page of TOC in PDF (1-indexed)
            toc_end_page: Last page of TOC in PDF (1-indexed)
            content_start_page: Page where actual content starts (1-indexed)
            
        Returns:
            Dictionary containing structured TOC data
        """
        try:
            # Extract TOC pages as images
            toc_images = self.extract_toc_pages_as_images(toc_start_page, toc_end_page)
            
            if not toc_images:
                raise Exception("No TOC images extracted")
            
            # Prepare content for Gemini API using modern format
            content = []
            
            # Add the prompt first
            prompt = self.prompt_template
            if content_start_page > 1:
                prompt += f"\n\nNote: The actual content starts at page {content_start_page} in the PDF file. Adjust page numbers accordingly if needed."
            
            content.append(prompt)
            
            # Add images using the modern API format
            for i, img_base64 in enumerate(toc_images):
                image_bytes = base64.b64decode(img_base64)
                content.append(
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type='image/png'
                    )
                )
            
            # Call Gemini API using modern format
            response = self.client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=content
            )
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Clean up response (remove any markdown formatting if present)
            if response_text.startswith('```json'):
                response_text = response_text[7:]  # Remove ```json
            if response_text.endswith('```'):
                response_text = response_text[:-3]  # Remove ```
            
            response_text = response_text.strip()
            
            # Parse JSON
            toc_data = json.loads(response_text)
            
            # Validate structure
            if not isinstance(toc_data, dict) or 'chapters' not in toc_data:
                raise Exception("Invalid TOC structure returned by Gemini")
            
            # Wrap in expected envelope: provide both parsed toc and raw text
            return {"toc": toc_data, "raw_response": response_text}
            
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse Gemini response as JSON: {str(e)}")
        except Exception as e:
            raise Exception(f"Gemini TOC extraction failed: {str(e)}")
    
    def extract(self, toc_start_page: int, toc_end_page: int, content_start_page: int = 1) -> Dict[str, Any]:
        """Public wrapper with basic validation for Gemini TOC extraction.

        Args:
            toc_start_page: First TOC page (1-indexed, inclusive)
            toc_end_page: Last TOC page (1-indexed, inclusive)
            content_start_page: Page where main content begins (1-indexed)

        Returns:
            Dict containing: { 'toc': {...}, 'raw_response': str }
        """
        if toc_start_page < 1 or toc_end_page < toc_start_page:
            raise ValueError("Invalid TOC page range")
        if content_start_page < 1:
            raise ValueError("content_start_page must be >= 1")
        return self.extract_toc_with_gemini(toc_start_page, toc_end_page, content_start_page)
