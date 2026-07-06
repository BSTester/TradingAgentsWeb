import unittest
from datetime import datetime
from types import SimpleNamespace

from web.backend.services.report_formatter import report_pdf_bytes


class ReportPdfExportTests(unittest.TestCase):
    def test_report_pdf_bytes_returns_real_pdf_binary(self):
        record = SimpleNamespace(
            analysis_id="report-1",
            ticker="AAPL",
            company_name="Apple",
            market="US",
            status="completed",
            created_at=datetime(2026, 7, 6, 12, 0, 0),
            updated_at=datetime(2026, 7, 6, 12, 5, 0),
            trading_decision="buy",
            final_summary="Apple remains resilient.",
            final_state={
                "structured_report": {
                    "rating": 4,
                    "summary": "Apple remains resilient.",
                    "sections": {
                        "market_technical": {"summary": "Trend is constructive.", "details": "Price momentum improved."},
                        "fundamentals": {"summary": "Cash flow is solid.", "details": "Margins remain healthy."},
                        "sentiment": {"summary": "Sentiment is neutral.", "details": "Social tone is balanced."},
                        "news_macro": {"summary": "Macro is mixed.", "details": "Rates remain a watch item."},
                        "risk": {"summary": "Valuation risk.", "details": "Multiple compression is possible."},
                    },
                    "grounded_evidence": [],
                    "stage_log": [],
                    "reflection": {},
                }
            },
        )

        pdf = report_pdf_bytes(record)

        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertIn(b"%%EOF", pdf[-32:])
        self.assertNotIn(b"pending M6 implementation", pdf)


if __name__ == "__main__":
    unittest.main()
