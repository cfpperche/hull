import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-8 py-16">
          <h1 className="text-xl font-semibold tracking-tight">Something broke</h1>
          <p className="text-muted-foreground mt-2 text-sm">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
