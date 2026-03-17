import { CheckCircle, RefreshCw, Globe, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';

export interface PushResultData {
  created: string[];
  updated: string[];
  sharedUpdated: string[];
}

interface PushResultProps {
  result: PushResultData;
  onReset: () => void;
}

export function PushResult({ result, onReset }: PushResultProps) {
  const total = result.created.length + result.updated.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle className="h-4 w-4" />
        {total} secret{total !== 1 ? 's' : ''} synced successfully
      </div>

      {result.created.length > 0 && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 font-medium text-foreground mb-1.5 text-sm">
              <CheckCircle className="h-4 w-4" />
              New secrets ({result.created.length})
            </div>
            <p className="text-sm text-muted-foreground font-mono">{result.created.join(', ')}</p>
          </CardContent>
        </Card>
      )}

      {result.updated.length > 0 && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 font-medium text-foreground mb-1.5 text-sm">
              <RefreshCw className="h-4 w-4" />
              Updated ({result.updated.length})
            </div>
            <p className="text-sm text-muted-foreground font-mono">{result.updated.join(', ')}</p>
          </CardContent>
        </Card>
      )}

      {result.sharedUpdated.length > 0 && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 font-medium text-foreground mb-1.5 text-sm">
              <Globe className="h-4 w-4" />
              Shared — visible to all ({result.sharedUpdated.length})
            </div>
            <p className="text-sm text-muted-foreground font-mono">{result.sharedUpdated.join(', ')}</p>
          </CardContent>
        </Card>
      )}

      <Separator />
      <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 px-0 text-muted-foreground">
        <RotateCcw className="h-3.5 w-3.5" />
        Push another file
      </Button>
    </div>
  );
}
