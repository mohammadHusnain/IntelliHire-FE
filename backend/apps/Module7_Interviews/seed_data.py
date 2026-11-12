"""The starter question bank. Kept as plain data so the migration and the tests read the same list."""

# (kind, role_category, competency, difficulty, skills, text)
SCREENING_GENERAL = {
    "interest": [
        "What attracted you to this role, and why do you want to work with this company?",
        "What are you hoping to achieve in your next position?",
        "Which part of this job description excites you most, and why?",
        "How does this role fit into your longer-term career goals?",
        "What would make you choose this role over other opportunities you are considering?",
        "What kind of team and working environment helps you do your best work?",
    ],
    "familiarity": [
        "In your own words, what do you think this role involves from day to day?",
        "Which responsibilities of this role do you already feel ready for, and which would you need to learn?",
        "What do you know about our company and the work we do?",
        "Which skills do you think matter most for success in this position?",
        "What do you expect the biggest challenges of this role to be?",
        "How would you describe what makes this role different from similar roles you have seen?",
    ],
    "experience": [
        "Tell us about a project or piece of work that best prepares you for this role.",
        "Describe a time you had to learn something new quickly to get a job done.",
        "Tell us about a time you worked with a team to deliver something. What was your part?",
        "Describe a difficult problem you solved at work or in your studies and how you approached it.",
        "Which of your past achievements are you most proud of, and why?",
        "Tell us about a time something went wrong in your work and what you did about it.",
    ],
}

SCREENING_BY_ROLE = {
    "software_engineer": {
        "interest": ["What kind of engineering problems do you enjoy working on most, and why?"],
        "familiarity": ["Which languages, frameworks and tools have you used most, and for what kind of work?"],
        "experience": [
            "Describe a system or feature you built end to end. Which decisions did you make and why?",
            "How do you make sure the code you write is tested and easy for others to maintain?",
        ],
    },
    "data_analyst": {
        "interest": ["What draws you to working with data, and what kind of questions do you like answering?"],
        "familiarity": ["Which tools do you use to analyse and present data, and how comfortable are you with each?"],
        "experience": [
            "Describe an analysis that changed a decision. What did you find and what happened next?",
            "How do you check that data is clean and reliable before you draw conclusions from it?",
        ],
    },
    "product_manager": {
        "interest": ["What do you enjoy most about shaping a product, and what draws you to this one?"],
        "familiarity": ["How would you describe the product manager's role in a team of designers and engineers?"],
        "experience": [
            "Tell us about a product decision you made with incomplete information. How did you decide?",
            "How do you decide what to build next when everyone wants something different?",
        ],
    },
}

# competency -> (difficulty, skills, text)
TECHNICAL = [
    ("technical_accuracy", "easy", ["Python"], "What is the difference between a list and a tuple in Python, and when would you use each?"),
    ("depth_of_understanding", "medium", ["Python"], "How do Python generators work, and what problem do they solve compared with building a full list?"),
    ("problem_solving", "hard", ["Python"], "How would you find and fix a memory leak in a long-running Python service?"),
    ("technical_accuracy", "easy", ["Django"], "What happens between a request arriving at a Django project and the response leaving it?"),
    ("depth_of_understanding", "medium", ["Django"], "How does the Django ORM avoid the N+1 query problem, and how would you spot one?"),
    ("problem_solving", "hard", ["Django", "PostgreSQL"], "A Django list endpoint has become slow as the table grew. How would you investigate and fix it?"),
    ("technical_accuracy", "easy", ["React"], "What is the difference between state and props in React?"),
    ("depth_of_understanding", "medium", ["React"], "Explain how React decides when to re-render a component and how you would prevent needless renders."),
    ("problem_solving", "hard", ["React", "JavaScript"], "A React page feels slow when a large list is shown. How would you find the cause and improve it?"),
    ("technical_accuracy", "easy", ["SQL"], "What is the difference between an INNER JOIN and a LEFT JOIN? Give an example of each."),
    ("depth_of_understanding", "medium", ["SQL", "PostgreSQL"], "What is an index, how does it speed up a query, and what does it cost?"),
    ("problem_solving", "hard", ["SQL"], "How would you find duplicate rows in a large table and remove all but one of each?"),
    ("technical_accuracy", "easy", ["JavaScript"], "Explain the difference between let, const and var in JavaScript."),
    ("depth_of_understanding", "medium", ["JavaScript"], "How does the JavaScript event loop work, and why does it matter for asynchronous code?"),
    ("technical_accuracy", "medium", ["REST", "API"], "What makes an API RESTful, and how would you design the endpoints for a simple job board?"),
    ("problem_solving", "medium", ["REST", "API"], "How would you add pagination, filtering and rate limiting to a public API without breaking existing clients?"),
    ("technical_accuracy", "easy", ["Git"], "What is the difference between merging and rebasing, and when would you choose each?"),
    ("depth_of_understanding", "medium", ["Docker"], "What problem does Docker solve, and how is a container different from a virtual machine?"),
    ("technical_accuracy", "medium", ["Testing"], "What makes a good unit test, and how is it different from an integration test?"),
    ("problem_solving", "hard", ["Testing"], "A test passes on your machine but fails now and then in CI. How would you track the cause down?"),
]

MOCK_GENERAL = {
    "communication": [
        "Introduce yourself as you would to an interviewer, in about a minute.",
        "Explain a topic from your field to someone who knows nothing about it.",
        "Tell me about a time you had to explain something difficult to a colleague or a client.",
        "How do you handle a disagreement with a teammate?",
    ],
    "confidence": [
        "What is the strongest skill you would bring to a new team, and what is your evidence for it?",
        "Tell me about a time you took the lead without being asked.",
        "How do you handle a question you do not know the answer to in a meeting?",
        "Describe a decision you made that you were not sure about. What did you do?",
    ],
    "technical_relevance": [
        "Which skills or tools from your background are most relevant to the role you are aiming for?",
        "Describe a project that shows you can do the work this role requires.",
        "What do you still need to learn to be fully ready for this role?",
        "How do you keep your skills up to date?",
    ],
    "structure": [
        "Walk me through a project from the first idea to the final result.",
        "Describe a time you had several deadlines at once. How did you organise your work?",
        "Tell me about a mistake you made, using the situation, what you did and the result.",
        "How would you plan your first thirty days in a new role?",
    ],
}

MOCK_BY_ROLE = {
    "software_engineer": {"technical_relevance": ["Describe a technical problem you solved and the trade-offs you weighed."]},
    "data_analyst": {"technical_relevance": ["Describe an analysis you are proud of and how you explained the result."]},
    "product_manager": {"technical_relevance": ["Describe how you would measure whether a new feature succeeded."]},
}


def rows():
    """Every seed row as a dict of InterviewQuestionBank fields."""
    out = []
    for competency, texts in SCREENING_GENERAL.items():
        out += [dict(kind="screening", role_category="", competency=competency, difficulty="medium", skills=[], text=t) for t in texts]
    for category, by_area in SCREENING_BY_ROLE.items():
        for competency, texts in by_area.items():
            out += [dict(kind="screening", role_category=category, competency=competency, difficulty="medium", skills=[], text=t) for t in texts]
    out += [dict(kind="technical", role_category="", competency=c, difficulty=d, skills=s, text=t) for c, d, s, t in TECHNICAL]
    for competency, texts in MOCK_GENERAL.items():
        out += [dict(kind="mock", role_category="", competency=competency, difficulty="medium", skills=[], text=t) for t in texts]
    for category, by_area in MOCK_BY_ROLE.items():
        for competency, texts in by_area.items():
            out += [dict(kind="mock", role_category=category, competency=competency, difficulty="medium", skills=[], text=t) for t in texts]
    return out
