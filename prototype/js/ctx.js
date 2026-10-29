// Late-bound hooks so page modules can ask the shell to re-render or navigate
// without importing app.js (which would create an import cycle).

export const ctx = {
  rerender: () => {},
  navigate: (id) => {
    location.hash = `#/${id}`;
  },
  openAssistant: () => {},
  /** Route parameter after the page id, e.g. 'p1' in '#/projects/p1'. */
  param: null,
  /** One-shot request for the next page, e.g. 'generate-plan'. */
  pending: null,
};
