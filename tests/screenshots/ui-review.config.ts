export type UiReviewState = 'filled';
export type UiReviewViewport = 'desktop' | 'mobile';

export interface UiReviewRoute {
  name: string;
  path: string;
  states: UiReviewState[];
  viewports?: UiReviewViewport[];
  expectedTitle?: string;
}

export const uiReviewConfig = {
  outputDir: 'test-results/ui-screenshots',
  routes: [
    {
      name: 'home-light',
      path: '/',
      states: ['filled'],
      expectedTitle: 'AI plans at $10',
    },
    {
      name: 'home-dark',
      path: '/?theme=dark',
      states: ['filled'],
      expectedTitle: 'AI plans at $10',
    },
    {
      name: 'home-german',
      path: '/?lang=de',
      states: ['filled'],
      expectedTitle: 'AI plans at $10',
    },
    {
      name: 'home-all-models',
      path: '/?match=0',
      states: ['filled'],
      expectedTitle: 'AI plans at $10',
    },
  ],
};

export const routes = uiReviewConfig.routes;
