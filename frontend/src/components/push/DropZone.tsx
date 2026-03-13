import { useState } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-200 ${
        dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-muted/20'
      }`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-colors ${dragging ? 'bg-primary/10' : 'bg-muted'}`}>
        <Upload className={`h-7 w-7 transition-colors ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <p className="font-semibold text-foreground">Drop your .env file here</p>
      <p className="text-sm text-muted-foreground mt-1">
        Variables with{' '}
        <code className="bg-muted px-1 rounded text-xs font-mono"># @shared</code>
        {' '}sync to the whole team
      </p>
      <p className="text-xs text-muted-foreground/60 mt-3">or click to browse files</p>
      <input
        type="file"
        className="hidden"
        accept=".env,.txt"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}
