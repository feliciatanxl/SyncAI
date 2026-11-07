# SyncAI client

The React frontend for SyncAI, the Smart Work Planner for EMS problem statement 12i. It will hold the officer and supervisor dashboards and talk to the Node.js + Express API in `../server` over HTTPS. See [docs/architecture.md](../docs/architecture.md) for the proposed design.

Built with React and Vite. It is currently the Vite starter; screens will be rebuilt from the interactive prototype in [`../prototype`](../prototype/), reusing its layouts, data model and rules rather than copying its code wholesale.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
