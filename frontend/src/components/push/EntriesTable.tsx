import { Globe, User } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

export interface ParsedEntry {
  key: string;
  value: string;
  isShared: boolean;
}

interface EntriesTableProps {
  entries: ParsedEntry[];
  onToggle: (key: string) => void;
}

export function EntriesTable({ entries, onToggle }: EntriesTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
              <th className="px-4 py-2.5 w-28 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map(({ key, value, isShared }) => (
              <tr key={key} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono font-semibold text-foreground text-xs">{key}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs truncate max-w-[140px]">
                  {'•'.repeat(Math.min(value.length || 1, 18))}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => onToggle(key)} title="Toggle visibility">
                    {isShared ? (
                      <Badge variant="blue" className="gap-1 cursor-pointer text-[10px]">
                        <Globe className="h-2.5 w-2.5" /> shared
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 cursor-pointer text-[10px]">
                        <User className="h-2.5 w-2.5" /> personal
                      </Badge>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
