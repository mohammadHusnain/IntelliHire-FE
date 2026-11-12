"""The starter role catalog (FR-09), kept as plain data so the migration and the tests read the same list."""

# (slug, title, category, description, focus skills)
ROLES = [
    ("software-engineer", "Software Engineer", "Engineering", "Designs, builds and maintains software.", ["Algorithms", "System design", "Testing"]),
    ("frontend-developer", "Frontend Developer", "Engineering", "Builds the part of a product people see and use.", ["JavaScript", "React", "CSS"]),
    ("backend-developer", "Backend Developer", "Engineering", "Builds the services and APIs behind a product.", ["Python", "APIs", "Databases"]),
    ("full-stack-developer", "Full Stack Developer", "Engineering", "Works across the interface, the services and the data.", ["JavaScript", "APIs", "SQL"]),
    ("mobile-app-developer", "Mobile App Developer", "Engineering", "Builds apps for phones and tablets.", ["Mobile UI", "APIs", "Performance"]),
    ("devops-engineer", "DevOps Engineer", "Engineering", "Keeps software delivered, reliable and observable.", ["CI/CD", "Cloud", "Monitoring"]),
    ("qa-engineer", "QA Engineer", "Engineering", "Makes sure software works before people rely on it.", ["Test design", "Automation", "Bug reporting"]),
    ("data-analyst", "Data Analyst", "Data", "Turns data into answers people can act on.", ["SQL", "Spreadsheets", "Visualisation"]),
    ("data-scientist", "Data Scientist", "Data", "Builds models and experiments to answer hard questions.", ["Statistics", "Python", "Modelling"]),
    ("data-engineer", "Data Engineer", "Data", "Builds the pipelines that make data usable.", ["SQL", "ETL", "Data modelling"]),
    ("machine-learning-engineer", "Machine Learning Engineer", "Data", "Puts machine learning models into real products.", ["Python", "ML systems", "Evaluation"]),
    ("business-intelligence-analyst", "Business Intelligence Analyst", "Data", "Builds the reports and dashboards a business runs on.", ["SQL", "Dashboards", "Metrics"]),
    ("product-manager", "Product Manager", "Product", "Decides what to build and why.", ["Prioritisation", "Customer research", "Roadmaps"]),
    ("project-manager", "Project Manager", "Product", "Keeps work on time, on budget and on track.", ["Planning", "Risk", "Stakeholders"]),
    ("business-analyst", "Business Analyst", "Product", "Bridges what the business needs and what gets built.", ["Requirements", "Process mapping", "Analysis"]),
    ("ux-designer", "UX Designer", "Design", "Designs how a product works for the people using it.", ["User research", "Wireframes", "Usability"]),
    ("ui-designer", "UI Designer", "Design", "Designs how a product looks and feels.", ["Visual design", "Design systems", "Prototyping"]),
    ("graphic-designer", "Graphic Designer", "Design", "Creates visual material that communicates.", ["Layout", "Branding", "Typography"]),
    ("digital-marketing-specialist", "Digital Marketing Specialist", "Marketing", "Plans and runs online campaigns.", ["Campaigns", "Analytics", "Social media"]),
    ("content-writer", "Content Writer", "Marketing", "Writes clear content for a defined audience.", ["Writing", "Research", "Editing"]),
    ("seo-specialist", "SEO Specialist", "Marketing", "Helps people find a business through search.", ["Keyword research", "Analytics", "Technical SEO"]),
    ("sales-executive", "Sales Executive", "Business", "Finds customers and closes deals.", ["Prospecting", "Negotiation", "CRM"]),
    ("hr-executive", "HR Executive", "Business", "Hires, supports and looks after people at work.", ["Recruitment", "Employee relations", "Policies"]),
    ("customer-support-specialist", "Customer Support Specialist", "Business", "Helps customers solve problems.", ["Communication", "Problem solving", "Empathy"]),
    ("accountant", "Accountant", "Business", "Keeps financial records accurate and compliant.", ["Bookkeeping", "Reporting", "Tax"]),
    ("operations-manager", "Operations Manager", "Business", "Keeps the day-to-day work of a business running.", ["Process improvement", "Planning", "Teams"]),
]


def rows():
    return [
        {"slug": slug, "title": title, "category": category, "description": description, "focus_skills": skills, "sort_order": index}
        for index, (slug, title, category, description, skills) in enumerate(ROLES, start=1)
    ]
