import pytest

from app.services.address_classifier import classify_address, normalize_address


@pytest.mark.parametrize(
    ("address", "expected"),
    [
        ("1.2.3.4", "ip"),
        ("::1", "ip"),
        ("aa:bb:cc:dd:ee:ff", "mac"),
        ("260 2 13459 26540", "base_station"),
        ("example.com", "domain"),
        ("260 2 13459", "domain"),
        ("260 2 13459 26540 1", "domain"),
        ("260 2 abc 26540", "domain"),
    ],
)
def test_classify_address(address: str, expected: str) -> None:
    assert classify_address(address) == expected


def test_normalize_address_collapses_whitespace() -> None:
    assert normalize_address("  260  2\t13459 26540 ") == "260 2 13459 26540"
    assert classify_address(normalize_address("260  2 13459 26540")) == "base_station"
