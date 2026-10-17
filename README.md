# Study Grove — Adaptive AI Tutor

A retro-inspired, forest-green and sage-green adaptive tutor for the **18-question machine-learning question bank** in `Adaptive_AI_Tutor.ipynb`.

The visual direction is a clean vintage study journal: warm paper, ruled notes, botanical green accents, serif editorial headings, small mono labels, and restrained borders rather than a glossy dashboard aesthetic.

## Features

- Adaptive questions across Overfitting, Classification, Regression, Cross Validation, Underfitting, and KNN.
- Easy / Medium / Hard selection using the same mastery thresholds as the notebook.
- Browser-based semantic answer scoring with `Xenova/all-MiniLM-L6-v2` through Hugging Face Transformers.js. The model downloads the first time it is used and is cached by the browser where supported.
- Clearly labelled keyword-overlap fallback if model loading/inference is unavailable.
- Same answer labels as the notebook: score >= 70 = Correct, >= 45 = Partially Correct, otherwise Incorrect.
- Same mastery adjustments: +10 / +3 / -10, clipped to 0–100.
- 10-question sessions, concept mastery dashboard, weak-concept priorities, and recent attempt history.
- Local browser persistence with JSON and CSV export, no account required.
- Static-first Vercel deployment: **no Python Function is needed for the website**, which avoids serverless startup and static-file routing issues.

## Important scoring note

This follows the notebook's approach: cosine similarity between the student's answer and the reference answer, multiplied by 100. That similarity is a heuristic, not a calibrated probability or a definitive judgement of learning. The fallback score is content-word F1 and is explicitly labelled. If a model load fails, ask learners to compare their answer with the reference answer instead of treating the score as authoritative.

## Run locally

You can use a simple local HTTP server (a secure/served origin is required for modules and browser model loading):

```bash
python -m http.server 8000 --directory public
```

Then visit `http://localhost:8000`.

## Deploy to Vercel

1. Download and extract the project ZIP.
2. Create an empty GitHub repository, for example `adaptive-ai-tutor`.
3. Push the **contents** of this folder to the repository root. The root should contain `vercel.json`, `public/`, `notebooks/`, and this README.
4. Import the repository at [Vercel](https://vercel.com/new).
5. Keep **Root Directory** pointed at the folder containing `vercel.json`.
6. This is a static site: leave custom Build Command and Install Command blank. `vercel.json` sets `outputDirectory` to `public`.
7. Deploy. Vercel should serve `public/index.html` as `/`, with `/style.css`, `/app.js`, `/favicon.svg`, and `/data/question_bank.json` at their root URL paths.

There is deliberately no `app.py` or serverless API required for the primary deployment. The complete tutor runs in the browser, so Vercel won't need to start a Python function. The Sentence Transformers model is downloaded from Hugging Face through a CDN, which means the semantic engine requires an internet connection the first time it is used.

## Data storage and privacy

Progress is stored in `localStorage` in the current browser on the current device. It is not a cloud student account or a multi-device database. Clearing browser data, switching browsers/devices, or using private mode may reset it. Export JSON/CSV to keep a backup. Student-written text and progress are not sent to a project backend; model inference runs in the browser after the model download.

## Colab notebook

- `notebooks/Adaptive_AI_Tutor.ipynb` is a copy of the uploaded notebook.
- `notebooks/Adaptive_AI_Tutor_web_deploy.ipynb` is a copy with an additional export cell that writes the question bank and scoring configuration to JSON and packages them for download.

The added export cell is self-contained. Open the deployment notebook in Colab and run only the final export cell if you want to regenerate the JSON data; you do not need to run the interactive `input()` tutoring session. If the original `questions` list is already defined in the notebook runtime, it uses that list; otherwise it uses an embedded copy of the original question bank.

## Project structure

```text
adaptive-ai-tutor-retro/
├── vercel.json
├── README.md
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── favicon.svg
│   └── data/
│       ├── question_bank.json
│       └── model_config.json
└── notebooks/
    ├── Adaptive_AI_Tutor.ipynb
    └── Adaptive_AI_Tutor_web_deploy.ipynb
```

## Credits / model

The tutor's question bank and mastery rules are taken from the uploaded `Adaptive_AI_Tutor.ipynb`. The browser uses the ONNX-compatible `Xenova/all-MiniLM-L6-v2` model with Transformers.js to mirror the notebook's Sentence Transformers approach. See the [Transformers.js pipelines documentation](https://huggingface.co/docs/transformers.js/en/pipelines) for model loading and feature-extraction behavior.
