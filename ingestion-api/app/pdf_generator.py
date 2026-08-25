"""Zero-dependency, compliant PDF-1.4 generator for compliance audit exports."""

from datetime import datetime, timezone
from typing import Any


def _escape_pdf_text(text: str) -> str:
    """Escape special characters in PDF string literals."""
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def generate_audit_pdf(org_id: str, records: list[dict[str, Any]], from_date: str | None = None, to_date: str | None = None) -> bytes:
    """Generate a clean, professional multi-page PDF audit report."""
    page_width = 612   # Standard Letter width (points)
    page_height = 792  # Standard Letter height (points)
    margin = 40
    line_height = 14
    rows_per_page = 38

    # Split records into chunks per page
    chunks = [records[i:i + rows_per_page] for i in range(0, max(len(records), 1), rows_per_page)]
    total_pages = len(chunks)

    # We will build PDF objects dynamically
    # obj 1: Catalog
    # obj 2: Pages root
    # obj 3.. (pages, content streams, fonts)
    
    font_bold_obj_id = None
    font_regular_obj_id = None
    font_mono_obj_id = None
    
    objects: list[bytes] = []
    
    def add_object(content: str | bytes) -> int:
        if isinstance(content, str):
            content = content.encode("latin1", errors="replace")
        objects.append(content)
        return len(objects)

    # Placeholders for catalog and pages root
    add_object(b"") # 1: Catalog placeholder
    add_object(b"") # 2: Pages placeholder

    # Font objects
    font_bold_obj_id = add_object(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    )
    font_regular_obj_id = add_object(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )
    font_mono_obj_id = add_object(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"
    )

    page_obj_ids: list[int] = []

    for page_idx, chunk in enumerate(chunks):
        page_num = page_idx + 1
        stream_cmds: list[str] = []
        
        # Background / Title Header
        stream_cmds.append("q")
        # Header banner bar
        stream_cmds.append("0.08 0.12 0.22 rg")  # Dark blue-slate
        stream_cmds.append(f"{margin} {page_height - 65} {page_width - 2 * margin} 35 re f")
        stream_cmds.append("Q")

        # Header text
        stream_cmds.append("BT")
        stream_cmds.append("/F1 14 Tf")
        stream_cmds.append("1 1 1 rg")  # White
        stream_cmds.append(f"{margin + 10} {page_height - 48} Td")
        stream_cmds.append(f"({_escape_pdf_text('AGENTWATCH — COMPLIANCE AUDIT EXPORT')}) Tj")
        stream_cmds.append("ET")

        # Metadata subtitle
        stream_cmds.append("BT")
        stream_cmds.append("/F2 9 Tf")
        stream_cmds.append("0.3 0.35 0.4 rg")
        stream_cmds.append(f"{margin} {page_height - 80} Td")
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        date_range_str = f"Range: {from_date or 'Beginning'} to {to_date or 'Present'}"
        stream_cmds.append(f"({_escape_pdf_text(f'Organization: {org_id}   |   {date_range_str}   |   Generated: {generated_at}')}) Tj")
        stream_cmds.append("ET")

        # Table Header
        y = page_height - 105
        stream_cmds.append("q")
        stream_cmds.append("0.93 0.95 0.98 rg") # Light header background
        stream_cmds.append(f"{margin} {y - 4} {page_width - 2 * margin} 16 re f")
        stream_cmds.append("0.75 0.8 0.88 RG 0.5 w")
        stream_cmds.append(f"{margin} {y - 4} {page_width - 2 * margin} 16 re S")
        stream_cmds.append("Q")

        stream_cmds.append("BT")
        stream_cmds.append("/F1 8 Tf")
        stream_cmds.append("0.1 0.15 0.25 rg")
        stream_cmds.append(f"{margin + 5} {y} Td ({_escape_pdf_text('TIMESTAMP (UTC)')}) Tj")
        stream_cmds.append(f"120 0 Td ({_escape_pdf_text('ACTION')}) Tj")
        stream_cmds.append(f"90 0 Td ({_escape_pdf_text('API KEY HASH')}) Tj")
        stream_cmds.append(f"140 0 Td ({_escape_pdf_text('RESOURCE / SPAN ID')}) Tj")
        stream_cmds.append("ET")

        y -= 18

        # Table Rows
        for row_idx, r in enumerate(chunk):
            # Alternating row background
            if row_idx % 2 == 1:
                stream_cmds.append("q")
                stream_cmds.append("0.97 0.98 1.0 rg")
                stream_cmds.append(f"{margin} {y - 3} {page_width - 2 * margin} 14 re f")
                stream_cmds.append("Q")

            created_str = str(r.get("created_at", ""))[:19]
            action = str(r.get("action", ""))
            key_hash = str(r.get("api_key_hash", ""))[:14] + ("..." if len(str(r.get("api_key_hash", ""))) > 14 else "")
            span_or_res = str(r.get("span_id") or r.get("resource_id") or "-")[:20]

            stream_cmds.append("BT")
            stream_cmds.append("/F2 8 Tf")
            stream_cmds.append("0.2 0.25 0.3 rg")
            stream_cmds.append(f"{margin + 5} {y} Td ({_escape_pdf_text(created_str)}) Tj")
            
            # Action bold
            stream_cmds.append("/F1 8 Tf")
            if action in ("unmask", "api_key_revoke"):
                stream_cmds.append("0.7 0.1 0.1 rg") # Reddish for sensitive actions
            else:
                stream_cmds.append("0.1 0.4 0.2 rg") # Greenish
            stream_cmds.append(f"120 0 Td ({_escape_pdf_text(action)}) Tj")

            # Key Hash monospace
            stream_cmds.append("/F3 7 Tf")
            stream_cmds.append("0.3 0.3 0.35 rg")
            stream_cmds.append(f"90 0 Td ({_escape_pdf_text(key_hash)}) Tj")

            # Span / Resource ID
            stream_cmds.append("/F3 7 Tf")
            stream_cmds.append(f"140 0 Td ({_escape_pdf_text(span_or_res)}) Tj")
            stream_cmds.append("ET")

            y -= 14

        # Footer
        stream_cmds.append("BT")
        stream_cmds.append("/F2 8 Tf")
        stream_cmds.append("0.5 0.55 0.6 rg")
        stream_cmds.append(f"{margin} 25 Td ({_escape_pdf_text('Confidential — Digital Personal Data Protection (DPDP) Audit Trail')}) Tj")
        stream_cmds.append(f"{page_width - margin - 60} 0 Td ({_escape_pdf_text(f'Page {page_num} of {total_pages}')}) Tj")
        stream_cmds.append("ET")

        stream_body = "\n".join(stream_cmds).encode("latin1", errors="replace")
        stream_obj = f"<< /Length {len(stream_body)} >>\nstream\n".encode("latin1") + stream_body + b"\nendstream"
        stream_obj_id = add_object(stream_obj)

        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Contents {stream_obj_id} 0 R "
            f"/Resources << /Font << /F1 {font_bold_obj_id} 0 R /F2 {font_regular_obj_id} 0 R /F3 {font_mono_obj_id} 0 R >> >> >>"
        )
        page_obj_id = add_object(page_obj)
        page_obj_ids.append(page_obj_id)

    # Overwrite Catalog (obj 1) and Pages (obj 2)
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    kids_str = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    objects[1] = f"<< /Type /Pages /Kids [{kids_str}] /Count {len(page_obj_ids)} >>".encode("latin1")

    # Assemble complete PDF file
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []

    for idx, obj in enumerate(objects):
        offsets.append(len(output))
        obj_num = idx + 1
        output.extend(f"{obj_num} 0 obj\n".encode("latin1"))
        output.extend(obj)
        output.extend(b"\nendobj\n")

    xref_offset = len(output)
    total_objects = len(objects) + 1
    output.extend(f"xref\n0 {total_objects}\n0000000000 65535 f \n".encode("latin1"))
    for offset in offsets:
        output.extend(f"{offset:010d} 00000 n \n".encode("latin1"))

    trailer = (
        f"trailer\n<< /Size {total_objects} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )
    output.extend(trailer.encode("latin1"))
    return bytes(output)
