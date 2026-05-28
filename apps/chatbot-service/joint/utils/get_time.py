from __future__ import annotations

from datetime import datetime

import pytz


def get_vietnam_time():
    # Define the Vietnam timezone
    viet_nam_tz = pytz.timezone('Asia/Ho_Chi_Minh')

    # Get the current time in Vietnam timezone
    viet_nam_time = datetime.now(viet_nam_tz)

    # Format the date, time, and weekday into a single string
    formatted_time = viet_nam_time.strftime(
        '%Y-%m-%d %H:%M:%S',
    ) + ' (' + viet_nam_time.strftime('%A') + ')'

    # Return the combined string
    return formatted_time


print(get_vietnam_time())
