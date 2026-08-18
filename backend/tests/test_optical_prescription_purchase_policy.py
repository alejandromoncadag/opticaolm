import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from online_optical_drafts import PURCHASABLE_PRESCRIPTION_STATUSES


def test_saved_prescription_can_purchase():
    assert "provided" in PURCHASABLE_PRESCRIPTION_STATUSES


def test_uploaded_prescription_can_purchase_while_pending_validation():
    assert "received_pending_validation" in PURCHASABLE_PRESCRIPTION_STATUSES


def test_send_later_can_purchase():
    assert "pending" in PURCHASABLE_PRESCRIPTION_STATUSES


def test_exam_request_can_purchase():
    assert "exam_requested" in PURCHASABLE_PRESCRIPTION_STATUSES
