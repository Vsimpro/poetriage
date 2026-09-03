# Poetriage API

This directory contains the Flask API and bundled frontend for Poetriage.

It handles the web-facing parts of the project: authentication, uploads, analysis queueing, report access, admin user management, and Pi model settings. The API is served from `api/app.py`, with endpoint groups split across `api/endpoints/`.

## LLM Assistance Note

This part of the project was built with heavy assistance from LLMs.

Some files are marked with `#slop` or comments like “this file has been slopped”. That is intentional: this directory should be treated as LLM-assisted application code, not as a hand-polished security boundary.

LLMs are useful for moving fast through glue code. They are also very good at producing glue code that looks more obvious than it really is. Read accordingly.
