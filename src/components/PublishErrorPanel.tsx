import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CloudUpload, Copy, RefreshCw, X } from 'lucide-react';

const DISMISSED_KEY = 'spiderleague:publish-error-panel-dismissed';
const STORED_ERROR_KEY = 'spiderleague:publish-error';

const isR2TimeoutError = (value: string | null) => {
  if (!value) return false;
  const normalized = decodeURIComponent(value).toLowerCase();
  return (
    normalized.includes('r2') &&
    (normalized.includes('temp-access-credentials') || normalized.includes('temp credentials')) &&
    (normalized.includes('timeout') || normalized.includes('request canceled'))
  );
};

const PublishErrorPanel = () => {
  const publishError = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const errorFromUrl = params.get('publish_error') ?? params.get('publishError') ?? params.get('error');
    const errorFromStorage = window.sessionStorage.getItem(STORED_ERROR_KEY);

    return isR2TimeoutError(errorFromUrl) || errorFromUrl === 'r2_timeout'
      ? errorFromUrl
      : isR2TimeoutError(errorFromStorage) || errorFromStorage === 'r2_timeout'
        ? errorFromStorage
        : null;
  }, []);

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(publishError) && window.sessionStorage.getItem(DISMISSED_KEY) !== 'true';
  });

  if (!publishError || !isVisible) return null;

  const handleDismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(
      'dist upload failed at Cloudflare R2 temp credential request. Action: retry Publish → Update; if repeated, wait briefly and retry or contact Lovable support.'
    );
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 pt-4">
      <Alert className="border-destructive/40 bg-destructive/10 text-foreground shadow-lg">
        <CloudUpload className="h-4 w-4 text-destructive" />
        <div className="pr-8">
          <AlertTitle className="text-base">Publish upload timed out</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>
              The build finished, but the <strong>Cloudflare R2 upload</strong> failed while requesting temporary credentials.
            </p>
            <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs sm:text-sm">
              <div className="font-semibold text-foreground">Failed step</div>
              <div className="mt-1 text-muted-foreground">dist upload → generate R2 credentials → temp-access-credentials timeout</div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4" />
                Retry after reopening Publish
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                Copy support note
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If it happens again, wait a minute and retry Publish → Update. Persistent failures usually need Lovable support because this step runs outside the app code.
            </p>
          </AlertDescription>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss publish error panel"
        >
          <X className="h-4 w-4" />
        </button>
      </Alert>
    </div>
  );
};

export default PublishErrorPanel;