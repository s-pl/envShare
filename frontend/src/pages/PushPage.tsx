import { useState } from 'react';
import { Button } from '../components/ui/button';
import { DropZone } from '../components/push/DropZone';
import { EntriesTable, type ParsedEntry } from '../components/push/EntriesTable';
import { PushResult, type PushResultData } from '../components/push/PushResult';
import { usePushSecrets } from '../hooks/useSecrets';
import toast from 'react-hot-toast';

function parseDotenv(content: string): ParsedEntry[] {
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const key = l.slice(0, idx).trim();
      const rest = l.slice(idx + 1);
      const commentIdx = rest.indexOf('#');
      let value = (commentIdx >= 0 ? rest.slice(0, commentIdx) : rest).trim();
      const comment = commentIdx >= 0 ? rest.slice(commentIdx + 1).trim() : '';
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return { key, value, isShared: /\bv\d+\b/.test(comment) ? false : comment.includes('@shared') };
    })
    .filter(e => e.key);
}

interface PushPageProps {
  projectId: string;
  projectName: string;
}

export function PushPage({ projectId, projectName }: PushPageProps) {
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<PushResultData | null>(null);
  const push = usePushSecrets(projectId);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => setEntries(parseDotenv(e.target?.result as string));
    reader.readAsText(file);
  }

  function toggleShared(key: string) {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, isShared: !e.isShared } : e));
  }

  async function handlePush() {
    try {
      const result = await push.mutateAsync({ secrets: entries });
      setResult(result);
      setEntries([]);
      setFileName('');
      toast.success('Secrets pushed successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Push failed');
    }
  }

  if (result) {
    return <PushResult result={result} onReset={() => setResult(null)} />;
  }

  if (!entries.length) {
    return <DropZone onFile={handleFile} />;
  }

  const sharedCount = entries.filter(e => e.isShared).length;
  const personalCount = entries.length - sharedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{fileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} variables · {sharedCount} shared · {personalCount} personal
          </p>
        </div>
        <button
          onClick={() => { setEntries([]); setFileName(''); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Click the badge to toggle each variable between <strong>shared</strong> (same for everyone) and <strong>personal</strong> (each teammate sets their own).
      </p>

      <EntriesTable entries={entries} onToggle={toggleShared} />

      <Button
        onClick={handlePush}
        disabled={push.isPending}
        className="w-full"
        size="lg"
      >
        {push.isPending
          ? 'Pushing…'
          : `Push ${entries.length} secret${entries.length !== 1 ? 's' : ''} to ${projectName}`}
      </Button>
    </div>
  );
}
