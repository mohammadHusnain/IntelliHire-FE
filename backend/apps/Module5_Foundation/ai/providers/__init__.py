from ..errors import AIConfigurationError
from .fake import FakeProvider
from .openai_provider import OpenAIProvider

_INSTANCES = {}


def get_provider(name):
    """The provider object for `name` ("fake" or "openai"). One instance per name."""
    if name not in _INSTANCES:
        if name == "fake":
            _INSTANCES[name] = FakeProvider()
        elif name == "openai":
            _INSTANCES[name] = OpenAIProvider()
        else:
            raise AIConfigurationError(f"Unknown AI provider: {name!r}.")
    return _INSTANCES[name]
