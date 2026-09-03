## Tool-output efficiency

Do not change your normal investigation strategy because of these instructions.
Gather whatever evidence is needed to solve the task correctly.

Optimize only the amount of unnecessary tool output added to model context.

- Avoid emitting clearly irrelevant bulk output such as entire lockfiles, generated
  files, large JSON responses, or long logs when only a small portion is needed.

- When a command may produce large output, keep the complete output in a temporary
  file and initially show the relevant portion. Inspect more of the saved output
  whenever needed; do not sacrifice evidence or accuracy to reduce output.

- When searching code, use search results and targeted ranges when they provide the
  same information as reading a much larger file. Read the full file when necessary.

- When querying structured data, select relevant fields when those fields are already
  known. Do not discard potentially relevant information merely to make output small.

- For long test, build, compiler, or diagnostic output, preserve the complete output
  and surface the failure summary and relevant error regions first. Expand as needed.

- Never summarize or truncate exact source code, diffs, errors, or data when their
  precise contents are required for the task.

- Do not perform additional tool calls merely to optimize, summarize, batch, or
  compress tool usage.

- There is no requirement to batch tool calls, minimize the number of tool calls,
  limit files inspected, or stop investigation early.