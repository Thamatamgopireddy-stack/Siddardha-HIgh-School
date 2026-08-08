---
name: excel-student-import
description: Guides the agent on how to import student excel files that contain multiple sheets with different classes and sections, mapping them automatically to respective classes (6th to 10th) and sections (A, B, G).
---

# Excel Student Import Agent Skill

Use this skill when you are importing student roster datasets from Excel or CSV files in the school management system.

## Setup & Capabilities

- **Seeded Configuration**: The system seeds Classes 6, 7, 8, 9, and 10. For each class, three sections are available: `A`, `B`, and `G` (representing general/girls sections e.g., `6G`, `10A`, etc.).
- **Auto-detection**: If no class or section ID is passed to the import request, the import parser will automatically analyze each row or worksheet name to identify the class (6-10) and section (A, B, G) dynamically.
- **Interception**: Works seamlessly in both live production (with PostgreSQL/FastAPI) and in-browser mockup/offline testing (via the Axios `mockAdapter` in `mockDb.ts`).

## Rules for Importing Data

When managing or assisting the user with data entry via Excel:

1. **Naming Worksheets**: Ensure Excel sheets are named matching the format `<ClassNum><SectionLetter>` (e.g. `6A`, `6B`, `6G`, `7A`, `7B`, `7G`, `8A`, `8B`, `8G`, `9A`, `9B`, `9G`, `10A`, `10B`, `10G`).
2. **Dynamic Columns**: If sheet names are generic (e.g., `Sheet1`), include columns named `Class` (or `Grade`, `Standard`) and `Section` (or `Sec`).
3. **Empty Class/Section Selection**: To trigger the auto-detect "agent" logic, leave the Class and Section selectors on the import UI unselected.
4. **Resets**: Use the "Reset DB" button in the application header during browser demo mode to clear and re-seed the mock database at any time.
