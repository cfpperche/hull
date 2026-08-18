import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "./LocaleProvider";

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
      return <Crashed message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

/**
 * Split out because a class component cannot call a hook, and the boundary has
 * to stay a class — `getDerivedStateFromError` has no function equivalent.
 */
function Crashed({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-lg px-8 py-16">
      <h1 className="text-xl font-semibold tracking-tight">{t("app.broke")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{message}</p>
    </div>
  );
}
