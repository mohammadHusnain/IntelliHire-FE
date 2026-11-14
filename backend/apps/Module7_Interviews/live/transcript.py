"""Turning a live call's transcript into the question/answer turns the rest of the engine expects.

Gemini transcribes both sides in streaming fragments. `Transcript` merges consecutive fragments from
one speaker into whole utterances (this is the reference app's own class); `to_turns` then pairs each
interviewer utterance with the candidate's reply, which is what `InterviewTurn` stores.
"""

INTERVIEWER = "interviewer"
CANDIDATE = "candidate"


class Transcript:
    """Merges streaming transcription fragments into whole speaker turns."""

    def __init__(self):
        self.entries = []

    def add(self, role, text):
        if not text:
            return
        if self.entries and self.entries[-1]["role"] == role:
            self.entries[-1]["text"] += text
        else:
            self.entries.append({"role": role, "text": text})

    def cleaned(self):
        """Whole utterances with the whitespace tidied, empties dropped."""
        return [{"role": e["role"], "text": " ".join(e["text"].split())} for e in self.entries if e["text"].strip()]


def to_turns(entries):
    """Pair interviewer utterances with the answer that follows.

    The greeting before the first answer is folded into the first question, and anything the
    candidate says before the interviewer speaks is kept as an answer to an empty question rather
    than being thrown away. Consecutive answers are joined: a pause is not a new question.
    """
    turns = []
    question = ""
    for entry in entries:
        text = " ".join(str(entry.get("text") or "").split())
        if not text:
            continue
        if entry.get("role") == INTERVIEWER:
            if turns and not turns[-1]["answer_text"]:
                # the interviewer spoke twice before any answer: treat it as one longer question
                turns[-1]["question_text"] = f"{turns[-1]['question_text']} {text}".strip()
                continue
            question = f"{question} {text}".strip() if not turns or turns[-1]["answer_text"] else text
            turns.append({"question_text": question, "answer_text": ""})
            question = ""
        else:
            if not turns:
                turns.append({"question_text": "", "answer_text": ""})
            turns[-1]["answer_text"] = f"{turns[-1]['answer_text']} {text}".strip()
    # A closing remark with no reply is not a question to score.
    return [t for t in turns if t["answer_text"]]
