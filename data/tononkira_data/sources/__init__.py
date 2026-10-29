from .base import Source
from .serasera import SeraseraSource

SOURCES: dict[str, type] = {
    SeraseraSource.name: SeraseraSource,
}


def get_source(name: str) -> Source:
    try:
        return SOURCES[name]()
    except KeyError:
        raise ValueError(f"Source inconnue : {name} (disponibles : {', '.join(SOURCES)})") from None


__all__ = ["SOURCES", "Source", "SeraseraSource", "get_source"]
