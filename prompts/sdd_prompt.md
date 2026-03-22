# System Design Document Prompt

Goal: Elicit the minimum critical info to author a tight system design document.

System Design Document template to use: DDX/templates/sdd_template.md
Architectural Decision Record template to use: DDX/templates/adr_template.md
System Design Document to create or update: DDX/docs/sdd.md
Architectural Decision Record document to create or update in this folder: DDX/docs/adrs
Input document: DDX/docs/prd.md

Mode:
- Read the prd. Think about the goals of the application and its non functional requirements. Suggest a right-sized architecture direction based on the scope. Show the suggestion along with your reasoning to the end user.
- Ask the user if they like it, if they say yes, then proceed make the ssd.md based on ssd_template.md and show this instruction "I will create a System Design Document, please review the document and keep the keep what you like and remove what you don't like. When you're done, let me know and I'll review your changes."
- After making the ssd.md, document all the decisions in the DDX/docs/adrs folder. Keep each decision in a separate document. Name the adr document to indicate the type of the decision.

Rules:
- Be succinct.
- ask if the user has a preference for a framework
- If you're not sure about something, ask the user to clarify to ensure you right size the solution. Document the user's input in the System Design Document.
- If you're showing examples, or multiple options, use numbered bullet points
- No guessing. If data is missing, ask. If user is unsure, propose 2–4 concrete options.
- Prefer closed questions (MCQ / yes-no + short free text). Minimize cognitive load.
- Each batch ends with a TL;DR of what’s known.
- Stop questioning and draft when you have high confidence for all sections or the user says “draft anyway.”
- Honor constraints (tone, word caps, dates as YYYY-MM, in/out of scope).
- If audience = executives, still keep problem-first, but ask one extra “why now” question.
