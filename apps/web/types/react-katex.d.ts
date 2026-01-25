declare module 'react-katex' {
  import { ComponentType, ReactNode } from 'react';

  interface MathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
    settings?: any;
  }

  export const BlockMath: ComponentType<MathProps>;
  export const InlineMath: ComponentType<MathProps>;
}

