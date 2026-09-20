export type UiReviewState = 'filled';
export type UiReviewViewport = 'desktop' | 'mobile';

export interface UiReviewRoute {
  name: string;
  path: string;
  states: UiReviewState[];
  viewports?: UiReviewViewport[];
  expectedTitle?: string;
  /** Optional list of CSS selectors for focused notice-area captures (e.g. ["#comparison", "#method"]). */
  elements?: string[];
}

export const uiReviewConfig = {
  outputDir: 'test-results/ui-screenshots',
  routes: [
    {
      name: 'home-light',
      path: '/',
      states: ['filled'],
      expectedTitle: 'Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT',
      elements: ['#comparison', '#method'],
    },
    {
      name: 'home-dark',
      path: '/?theme=dark',
      states: ['filled'],
      expectedTitle: 'Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT',
      elements: ['#comparison', '#method'],
    },
    {
      name: 'home-german',
      path: '/?lang=de',
      states: ['filled'],
      expectedTitle: 'Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT',
      elements: ['#comparison', '#method'],
    },
    {
      name: 'home-all-models',
      path: '/?match=0',
      states: ['filled'],
      expectedTitle: 'Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT',
      elements: ['#comparison', '#method'],
    },
  ],
};

export const routes = uiReviewConfig.routes;
