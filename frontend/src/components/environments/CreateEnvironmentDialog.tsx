import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useCreateEnvironment } from "../../hooks/useEnvironments";
import toast from "react-hot-toast";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function CreateEnvironmentDialog({ projectId, open, onClose }: Props) {
  const create = useCreateEnvironment(projectId);
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setName("");
    setFilePath("");
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ name, filePath, description: description || undefined });
      toast.success("Environment created");
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create environment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New environment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="env-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input
              id="env-name"
              placeholder="staging"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={64}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-path" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File path
            </Label>
            <Input
              id="env-path"
              placeholder=".env.staging"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              required
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Relative path where the CLI will write the file, e.g.{" "}
              <code className="font-mono bg-muted px-1 rounded">.env.staging</code>{" "}
              or{" "}
              <code className="font-mono bg-muted px-1 rounded">apps/api/.env</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description <span className="font-normal normal-case">(optional)</span>
            </Label>
            <Input
              id="env-desc"
              placeholder="Staging environment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
