import math


def cosine_similarity(a, b):
    """Cosine of the angle between two vectors; 0.0 when either is empty or all zeros."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0
