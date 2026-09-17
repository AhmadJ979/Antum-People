<!-- managed:linked-repos -->
## Linked Repositories
- AhmadJ979/probable-octo-sniffle
<!-- /managed:linked-repos -->

# Antum Team Workflow

## Development Process
1.  **Branching:** All new features and fixes should be developed on feature branches.
2.  **Pull Requests:** Once work is complete, create a pull request (PR) to the `main` branch.
3.  **Review:** The lead (agent-lead) will review the PR.
4.  **Merge:** After approval, the lead will merge the PR using `gh pr merge`.

## Task Management
-   Use `create_task` and `assign_task` to manage the kanban board.
-   Always call `finish_task` when work is ready for review.
-   Include a detailed summary in the `result` field when finishing a task.

## Communication
-   Use `send_message` for follow-up questions or status updates.
-   Keep the lead informed of any blockers.

## Quality Standards
-   Maintain bilingual support (EN/AR) for all user-facing interfaces.
-   Ensure compliance with UAE and KSA PDPL and Labor Laws.
-   All code changes must be reflected in the relevant documentation.
