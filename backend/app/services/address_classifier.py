from __future__ import annotations

import ipaddress
import re

MAC_PATTERN = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")


def classify_address(address: str) -> str:
    """Определяет тип адреса: 'ip', 'mac' или 'domain' (всё, что не ip/mac)."""
    try:
        ipaddress.ip_address(address)
        return "ip"
    except ValueError:
        pass
    if MAC_PATTERN.match(address):
        return "mac"
    return "domain"
