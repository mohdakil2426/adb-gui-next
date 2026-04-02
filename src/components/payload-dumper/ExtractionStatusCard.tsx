import { CheckCircle2, XCircle, FileDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ExtractionStatusCardProps {
  status: 'success' | 'error';
  extractedFiles: string[];
  outputDir: string;
  errorMessage: string;
  onOpenOutputFolder: () => void;
}

/**
 * Post-extraction status card showing success or error state.
 * On success: displays output directory and extracted file list.
 * On error: displays error message.
 */
export function ExtractionStatusCard({
  status,
  extractedFiles,
  outputDir,
  errorMessage,
  onOpenOutputFolder,
}: ExtractionStatusCardProps) {
  if (extractedFiles.length === 0) return null;

  return (
    <Card
      className={cn(
        'border-2 min-w-0',
        status === 'success'
          ? 'border-success/50 bg-success/5'
          : 'border-destructive/50 bg-destructive/5',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            'flex items-center gap-2 text-lg',
            status === 'success' ? 'text-success' : 'text-destructive',
          )}
        >
          {status === 'success' ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Extraction Complete
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5" />
              Extraction Failed
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'success' && (
          <div className="flex flex-col gap-3">
            {outputDir && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground font-medium">Saved to:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <code
                    className="text-xs bg-muted px-3 py-2 rounded flex-1 min-w-0 truncate font-mono border select-all"
                    title={outputDir}
                  >
                    {outputDir}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onOpenOutputFolder}
                        className="h-9 w-9 shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Open in File Explorer</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            {extractedFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Extracted {extractedFiles.length} partition(s):
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {extractedFiles.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <FileDown className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {status === 'error' && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
