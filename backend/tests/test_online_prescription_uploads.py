import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from online_patient_identity import IdentityRuleError, _validate_prescription_upload


@pytest.mark.parametrize("mime,filename,content", [
    ("application/pdf", "receta.pdf", b"%PDF-1.7\n"),
    ("image/jpeg", "receta.jpg", b"\xff\xd8\xff\xe0"),
    ("image/png", "receta.png", b"\x89PNG\r\n\x1a\n"),
    ("image/webp", "receta.webp", b"RIFF1234WEBP"),
])
def test_prescription_upload_accepts_supported_signatures(mime, filename, content):
    assert _validate_prescription_upload(mime, filename, content) == (mime, filename)


def test_prescription_upload_rejects_bad_signature():
    with pytest.raises(IdentityRuleError) as error:
        _validate_prescription_upload("application/pdf", "recipe.pdf", b"not a pdf")
    assert error.value.status == 415


def test_prescription_upload_rejects_oversize():
    with pytest.raises(IdentityRuleError) as error:
        _validate_prescription_upload("application/pdf", "recipe.pdf", b"%PDF-" + b"x" * (10 * 1024 * 1024))
    assert error.value.status == 413
