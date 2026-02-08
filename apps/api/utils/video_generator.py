"""
Video generator utilities for creating placeholder reels without actual video files.
Generates pastel color backgrounds for video-less reels.
"""

import random
import colorsys


def generate_pastel_color() -> str:
    """
    Generate a random pastel color in hex format.
    
    Pastel colors have:
    - Random hue (0-360 degrees)
    - Low saturation (25-40%)
    - High lightness (75-85%)
    
    Returns:
        str: Hex color code (e.g., "#FFE5E5")
    """
    # Random hue
    h = random.random()
    # Pastel: low saturation (0.25-0.4), high lightness (0.75-0.85)
    s = random.uniform(0.25, 0.4)
    l = random.uniform(0.75, 0.85)
    
    # Convert HLS to RGB
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    
    # Convert to hex
    return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"


def get_pastel_palette() -> list[str]:
    """
    Get a predefined list of pleasant pastel colors.
    
    Returns:
        list[str]: List of hex color codes
    """
    return [
        "#FFE5E5",  # Light pink
        "#E5F3FF",  # Light blue
        "#FFF5E5",  # Light peach
        "#E5FFE5",  # Light green
        "#F5E5FF",  # Light purple
        "#FFFFE5",  # Light yellow
        "#E5FFFF",  # Light cyan
        "#FFE5F5",  # Light magenta
    ]


def choose_random_pastel() -> str:
    """
    Choose a random color from the predefined pastel palette.
    
    Returns:
        str: Hex color code
    """
    return random.choice(get_pastel_palette())
