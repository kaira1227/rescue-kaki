import RescueKakiApp from './pages/RescueKakiApp';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'IGNIS',
    path: '/',
    element: <RescueKakiApp />,
    public: true,
  },
];
