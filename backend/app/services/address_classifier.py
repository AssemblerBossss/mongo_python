from __future__ import annotations

import ipaddress
import re

MAC_PATTERN = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")
BASE_STATION_PATTERN = re.compile(r"^\d+(?: \d+){3}$")


def normalize_address(address: str) -> str:
    return " ".join(address.split())


def classify_address(address: str) -> str:
    """Определяет тип адреса: 'ip', 'mac', 'base_station' (4 числа через пробел) или 'domain' (всё остальное)."""
    try:
        ipaddress.ip_address(address)
        return "ip"
    except ValueError:
        pass
    if MAC_PATTERN.match(address):
        return "mac"
    if BASE_STATION_PATTERN.match(address):
        return "base_station"
    return "domain"
