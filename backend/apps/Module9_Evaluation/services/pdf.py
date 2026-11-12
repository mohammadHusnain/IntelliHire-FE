"""The one-to-two page evaluation PDF (UC-10 A3): scores, report text, decision history, disclaimer and generation time.
Built on request with reportlab and never stored."""
import io
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .report import DISCLAIMER


def _p(text, style):
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)


def _score(value):
    return "n/a" if value is None else f"{float(value):.1f}"


def build_pdf(application, evaluation, decisions):
    """Returns the PDF as bytes."""
    styles = getSampleStyleSheet()
    body, small, h1, h2 = styles["BodyText"], styles["Italic"], styles["Title"], styles["Heading3"]
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title="Candidate evaluation")
    job = application.job
    story = [
        _p("Candidate evaluation", h1),
        _p(f"{application.full_name} ({application.reference}) for {job.title} at {job.company.name}", body),
        Spacer(1, 6),
    ]
    table = Table(
        [
            ["CV match", "Screening", "Technical", "Composite"],
            [_score(evaluation.cv_score), _score(evaluation.screening_score), _score(evaluation.technical_score), _score(evaluation.composite_score)],
        ],
        colWidths=[40 * mm] * 4,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f7")), ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c5ccd6")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))  # fmt: skip
    story.append(table)
    if evaluation.is_partial:
        story += [Spacer(1, 4), _p("Partial evaluation. Missing stage(s): " + ", ".join(evaluation.missing_stages) + f" (policy: {evaluation.weights_used.get('policy', '')}).", small)]
    report = evaluation.report or {}
    story += [Spacer(1, 8), _p("Report", h2)]
    if report:
        story += [_p(f"Recommendation: {str(report.get('recommendation', '')).replace('_', ' ')}", body), _p(report.get("summary", ""), body)]
        for title, key in (("Strengths", "strengths"), ("Weaknesses", "weaknesses")):
            if report.get(key):
                story += [_p(title, h2)] + [_p(f"- {item}", body) for item in report[key]]
    else:
        story.append(_p("Report not available yet." if evaluation.report_status != "failed" else "Report generation failed; manual review needed.", body))
    story += [Spacer(1, 8), _p("Decision history", h2)]
    if decisions:
        rows = [["When", "Decision", "By", "AI said", "Overrode AI"]] + [
            [d.decided_at.strftime("%Y-%m-%d %H:%M"), d.decision, d.decided_by.full_name, (d.ai_recommendation or "-").replace("_", " "), "yes" if d.overrode_ai else "no"]
            for d in decisions
        ]
        history = Table(rows, colWidths=[34 * mm, 28 * mm, 42 * mm, 30 * mm, 26 * mm])
        history.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c5ccd6")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f7")), ("FONTSIZE", (0, 0), (-1, -1), 8)]))
        story.append(history)
    else:
        story.append(_p("No decision recorded yet.", body))
    story += [Spacer(1, 12), _p(DISCLAIMER, small), _p(f"Generated {timezone.now().strftime('%Y-%m-%d %H:%M UTC')}", small)]
    doc.build(story)
    return buffer.getvalue()
