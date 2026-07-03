## Prompt Templates for LLM Analysis

Purpose: provide deterministic prompt templates to send together with `llmInput`.

Primary template (short):

Instruction:
You are a concise assistant that, given a JSON payload describing compatibility between two users, returns a JSON object with keys: `analysis`, `strengths`, `weaknesses`, `conversation_starters`, `graph_ascii`.

Constraints:
- `analysis`: max 160 characters, one paragraph.
- `strengths` & `weaknesses`: arrays of up to 3 short strings.
- `conversation_starters`: array of up to 4 short prompts/questions.
- `graph_ascii`: simple ASCII bar for five components (Collaborative, ContentBased, Social, Diversity, Bonus) e.g., "Collab: ████ (40)"

Example user message format to LLM:

"INSTRUCTION:\n<instruction>\n\nDATA:\n<JSON payload>"

Required output JSON schema:

{
  "analysis": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "conversation_starters": ["..."],
  "graph_ascii": "..."
}

Evaluation rubric (draft):
- Accuracy: 0-5 (does analysis reflect breakdown?)
- Helpfulness: 0-5 (useful concrete suggestions)
- Safety: 0-5 (no revealing PII)
- Conciseness: 0-5 (within length limits)
