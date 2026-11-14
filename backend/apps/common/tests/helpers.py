import re
from io import BytesIO
from urllib.parse import parse_qs, urlparse

from PIL import Image


def link_in(message):
    """The first URL in an email body, as (url, query dict)."""
    url = re.search(r"https?://\S+", message.body).group(0)
    return url, {key: values[0] for key, values in parse_qs(urlparse(url).query).items()}


def code_in(message):
    """The 6-digit verification code in an email body (there is no link to parse for this one)."""
    return re.search(r"\b\d{6}\b", message.body).group(0)


def make_pdf(text="Hello resume"):
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


def make_docx(paragraphs=("Hello resume",), table_cells=()):
    from docx import Document

    document = Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    if table_cells:
        table = document.add_table(rows=1, cols=len(table_cells))
        for cell, text in zip(table.rows[0].cells, table_cells):
            cell.text = text
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_image(fmt="PNG", size=(10, 10)):
    buffer = BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, fmt)
    return buffer.getvalue()
