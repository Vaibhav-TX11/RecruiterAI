from datetime import datetime, timezone, timedelta

def get_utc_now():
    """Returns the current time in UTC."""
    return datetime.now(timezone.utc)

def get_ist_now():
    """Returns the current time in India Standard Time (IST, UTC+5:30)."""
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(india_timezone)
