import pytest

from apps.Module5_Foundation.redact import redact_pii


@pytest.mark.parametrize("text", ["Mail me at sara.malik+jobs@example.co.uk now", "SARA@EXAMPLE.COM"])
def test_emails_are_removed(text):
    assert "[EMAIL]" in redact_pii(text) and "@" not in redact_pii(text)


@pytest.mark.parametrize("phone", ["+92 300 1234567", "0300-1234567", "(555) 123-4567", "+1 (415) 555-2671", "03001234567", "+44 20 7946 0958"])
def test_phone_numbers_are_removed(phone):
    assert redact_pii(f"Call {phone} today") == "Call [PHONE] today"


@pytest.mark.parametrize("text", ["Worked 2019-2023 at Acme", "10 years of experience", "GPA 3.85 out of 4.0", "Revenue grew 1200000 units", "2019 - 2023", "Version 1.2.3", "Room 1234"])
def test_years_ranges_and_ordinary_numbers_are_kept(text):
    assert redact_pii(text) == text


@pytest.mark.parametrize(
    "link",
    ["https://www.linkedin.com/in/sara-malik", "linkedin.com/in/sara", "www.github.com/saramalik", "https://github.com/sara/project", "http://twitter.com/sara", "x.com/sara", "https://medium.com/@sara"],
)
def test_social_links_are_removed(link):
    assert redact_pii(f"Profile: {link} ok") == "Profile: [LINK] ok"


def test_lookalike_domains_and_ordinary_links_are_kept():
    assert redact_pii("see mygithub.example for more") == "see mygithub.example for more"
    assert redact_pii("portfolio at https://sara.dev") == "portfolio at https://sara.dev"


def test_the_full_name_and_each_part_are_removed_case_insensitively():
    text = "SARA MALIK is a developer. Sara worked with malik & sons. Ms Malik leads."
    assert redact_pii(text, ["Sara Malik"]) == "[NAME] is a developer. [NAME] worked with [NAME] & sons. Ms [NAME] leads."


def test_name_parts_are_whole_words_only():
    assert redact_pii("Hannah works at Annabelle Corp with Anna", ["Anna Lopez"]) == "Hannah works at Annabelle Corp with [NAME]"


def test_short_name_parts_are_ignored_so_ordinary_words_survive():
    assert redact_pii("Al works in Alabama", ["Al Rashid"]) == "Al works in Alabama"


def test_names_with_punctuation_do_not_break_the_pattern():
    assert redact_pii("Contact D'Souza (Jr.) today", ["D'Souza (Jr.)"]) == "Contact [NAME] today"
    assert redact_pii("Zoë Müller", ["Zoë Müller"]) == "[NAME]"
    assert redact_pii("Dr Müller here", ["Zoë Müller"]) == "Dr [NAME] here"


@pytest.mark.parametrize("value", [None, "", 0, b"x"])
def test_anything_that_is_not_text_gives_an_empty_string(value):
    assert redact_pii(value) == ""


def test_missing_or_blank_names_are_fine():
    assert redact_pii("Hello there", None) == "Hello there"
    assert redact_pii("Hello there", ["", None, "  "]) == "Hello there"


def test_a_cv_with_everything():
    cv = "Sara Malik | sara@x.com | +92 300 1234567 | linkedin.com/in/sara\nPython developer 2019-2023"
    out = redact_pii(cv, ["Sara Malik"])
    assert out == "[NAME] | [EMAIL] | [PHONE] | [LINK]\nPython developer 2019-2023"
