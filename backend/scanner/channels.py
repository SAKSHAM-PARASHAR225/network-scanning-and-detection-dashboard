"""Channel / frequency / band helpers.

These are the published 802.11 channel plans, not guesses. Band is taken from
the adapter's own report whenever it provides one; these functions only fill
in what the adapter left out.
"""


def channel_to_frequency(channel, band_hint=None):
    """Return the centre frequency in MHz for a channel, or None if unknown."""
    if channel is None:
        return None

    band = (band_hint or "").strip()

    if band.startswith("6"):
        return 5950 + 5 * channel
    if band.startswith("5"):
        return 5000 + 5 * channel
    if band.startswith("2"):
        return 2484 if channel == 14 else 2407 + 5 * channel

    # No usable hint - fall back to the unambiguous parts of the channel plan.
    if 1 <= channel <= 13:
        return 2407 + 5 * channel
    if channel == 14:
        return 2484
    if 32 <= channel <= 177:
        return 5000 + 5 * channel
    return None


def frequency_to_band(frequency):
    """Return '2.4 GHz' / '5 GHz' / '6 GHz' for a frequency in MHz."""
    if frequency is None:
        return None
    if 2400 <= frequency <= 2500:
        return "2.4 GHz"
    if 4900 <= frequency < 5925:
        return "5 GHz"
    if 5925 <= frequency <= 7125:
        return "6 GHz"
    return None


def normalize_band(band):
    """Normalise adapter-reported band strings to '2.4 GHz' / '5 GHz' / '6 GHz'."""
    if not band:
        return None
    text = band.strip().lower().replace("ghz", "").replace("_", ".").strip()
    if text.startswith("2"):
        return "2.4 GHz"
    if text.startswith("6"):
        return "6 GHz"
    if text.startswith("5"):
        return "5 GHz"
    return band.strip()
