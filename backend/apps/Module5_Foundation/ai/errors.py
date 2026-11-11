class AIError(Exception):
    """Base class for every failure of an AI call."""


class AIUnavailable(AIError):
    """A temporary failure (timeout, rate limit, provider outage). Worth retrying."""

    def __init__(self, message="The AI service is temporarily unavailable.", retry_after=None):
        super().__init__(message)
        self.retry_after = retry_after


class AIPolicyBlocked(AIError):
    """The provider refused the content. Retrying the same request will not help."""


class AIInvalidOutput(AIError):
    """The provider answered, but not with JSON that matches the template's schema."""


class AIConfigurationError(AIError):
    """A setup problem (missing key, unknown provider, wrong credentials). Not retried."""


class PromptError(AIError):
    """No active template, or the variables do not match its placeholders."""


class TranscriptionFailed(AIError):
    """Speech could not be turned into text. The caller asks the person to type instead."""
