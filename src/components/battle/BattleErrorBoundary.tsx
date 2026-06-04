import { Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class BattleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("Battle arena crashed:", error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/40">
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">The battle arena crashed</h2>
              <p className="text-sm text-muted-foreground">
                Something went wrong loading this battle. Your progress is safe — try again or head home.
              </p>
            </div>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground bg-muted rounded p-2 break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCw className="h-4 w-4 mr-1" /> Try again
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                Reload page
              </Button>
              <Button asChild variant="ghost">
                <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}