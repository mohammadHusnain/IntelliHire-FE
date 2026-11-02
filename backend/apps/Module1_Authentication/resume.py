import logging
import re
import zipfile

from docx import Document
from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = 15_000
MAX_PDF_PAGES = 30
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


def _pdf_text(upload):
    reader = PdfReader(upload)
    if reader.is_encrypted:
        return ""
    parts, size = [], 0
    for page in reader.pages[:MAX_PDF_PAGES]:
        text = page.extract_text() or ""
        parts.append(text)
        size += len(text)
        if size >= MAX_TEXT_CHARS:
            break
    return "\n".join(parts)


def _docx_text(upload):
    with zipfile.ZipFile(upload) as archive:
        if sum(info.file_size for info in archive.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
            return ""
    upload.seek(0)
    document = Document(upload)
    parts = [paragraph.text for paragraph in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            parts.extend(cell.text for cell in row.cells)
    return "\n".join(parts)


def _clean(text):
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text[:MAX_TEXT_CHARS]


def extract_resume_text(upload, extension):
    """Plain text from a PDF or DOCX, or "" when it cannot be read.

    The parsers handle untrusted files, so any failure is treated as "no text"
    and logged by exception type only; the upload itself is never rejected here.
    """
    upload.seek(0)
    try:
        text = _pdf_text(upload) if extension == ".pdf" else _docx_text(upload)
    except Exception as exc:
        logger.warning("Resume text extraction failed (%s)", type(exc).__name__)
        text = ""
    finally:
        upload.seek(0)
    return _clean(text)
