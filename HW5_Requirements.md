Objective
Extend Claude Code by building a custom skill for your P3 workflow and connecting an MCP server to enhance your development capabilities.

Part 1: Custom Skill (50%)
Create a custom Claude Code skill (.claude/skills/) for your P3 project:

Define a reusable workflow as a slash command (e.g., /fix-issue, /deploy, /add-feature, /review)
Skill must include clear instructions, constraints, and expected behavior
Test the skill on at least 2 real tasks
Iterate on the skill based on results (show v1 → v2 improvement)
Requirements: Skill file in .claude/skills/ with proper metadata (name, description). Clear instructions that Claude Code can follow. Evidence of v1 → v2 iteration (what changed and why). Screenshots or session logs showing skill execution on real tasks.

Part 2: MCP Integration (35%)
Connect at least one MCP server to your Claude Code workflow:

Choose a relevant server: database MCP, Playwright (browser testing), GitHub, Figma, or another
Configure with claude mcp add
Demonstrate a complete task that uses the MCP connection
Document the setup process and what it enables
Requirements: Working MCP server configuration. At least one demonstrated workflow using the MCP server. Setup documentation (how to reproduce).

Part 3: Retrospective (15%)
Write a 1-2 page retrospective answering:

How did the custom skill change your workflow? What tasks became easier?
What did MCP integration enable that wasn't possible before?
What would you build next (hooks, sub-agents, more skills)?
Deliverables
Your github repository including your .claude/skills/ directory with custom skill (v1 and v2 versions)
MCP server configuration and usage demonstration
Screenshots or session logs showing skill and MCP in action
Retrospective document (1-2 pages)
Rubric (50 points)
Criterion	Weight
Custom skill quality & iteration	50%
MCP integration & demonstration	35%
Retrospective	15%
Rubric
HW5: Custom Skill + MCP Integration Rubric
HW5: Custom Skill + MCP Integration Rubric
Criteria	Ratings	Pts
This criterion is linked to a Learning OutcomeCustom Skill Quality & Iteration
25 pts
Excellent
18.75 pts
Good
12.5 pts
Adequate
6.25 pts
Needs Improvement
0 pts
No Marks
25 pts
This criterion is linked to a Learning OutcomeMCP Integration & Demonstration
17.5 pts
Excellent
13.125 pts
Good
8.75 pts
Adequate
4.375 pts
Needs Improvement
0 pts
No Marks
17.5 pts
This criterion is linked to a Learning OutcomeRetrospective
7.5 pts
Excellent
5.625 pts
Good
3.75 pts
Adequate
1.875 pts
Needs Improvement
0 pts
No Marks
7.5 pts
Total Points: 50