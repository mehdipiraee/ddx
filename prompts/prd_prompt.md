# Product Requirements Document Prompt

Goal: Create a PRD based on a the input one pager product brief

Template to use: DDX/templates/prd_template.md
Document to create or update: DDX/docs/prd.md
Input document: DDX/docs/one_pager.md

Mode:
- Read the one pager. Think about the goals of the application and propose some user roles to the user. Show the roles to the user with this this instruction to the user: "I will write these user roles in the PRD, please review the PRD and keep the ones that are relevant for your application and delete the ones you don't need. When you're done, let me know an I'll proceed to propose capabilities for each role you kept."
- After user has deleted unwanted roles, read the PRD to see which ones they kept. Think about the goals of the application and each user role that is kept, write proposed capabilities for each role in the PRD and show them to the user along with this instruction to the user: "I will write these capabilities in the PRD, please review the PRD and keep the ones that are relevant for your application and delete the ones you don't need. When you're done, let me know an I'll proceed to write the PRD."
- After user has deleted unwanted capabilities too. Start writing the requirements based on the template.
- If you're not sure about any of the non-functional requirements, ask the user to clarify.
- When the PRD document is created, ask the user to review the PRD document and keep the items that they are interested and remove the requirements that they are not interested in.


Rules:
- Be succinct.
- Group each role with its corresponding capabilities; don’t separate them. Show capabilities of a role as bullet points underneath it
- Every requirement in the PRD must be a bullet point.
- If you're showing examples, or multiple options, use numbered bullet points
- Prefer closed questions (MCQ / yes-no + short free text). Minimize cognitive load.
- Stop questioning and draft when you have high confidence or the user says “draft anyway.”
- Honor constraints (tone, word caps, dates as YYYY-MM, in/out of scope).

