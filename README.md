# my-simple-health
Health education and health promotion resources for practical, evidence-informed everyday health.

## Local development

The My Health prototype includes serverless API handlers and must not be run with Python SimpleHTTP when testing Hello.

1. Copy `.env.example` to `.env.local`.
2. Add your server-side `OPENAI_API_KEY` to `.env.local`. Do not commit that file.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:43127/hello.html?from=workspace`.

The local development server serves the prototype and executes the existing `api/hello.js` handler at `POST /api/hello`. It reports whether required configuration was detected without printing secret values.
