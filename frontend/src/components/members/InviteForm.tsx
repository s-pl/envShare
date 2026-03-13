import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useInviteMember } from '../../hooks/useMembers';

interface InviteFormProps {
  projectId: string;
}

export function InviteForm({ projectId }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const invite = useInviteMember(projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role });
      toast.success(`Invited ${email.trim()}`);
      setEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Failed to invite');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        placeholder="teammate@company.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1"
      />
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DEVELOPER">Developer</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="VIEWER">Viewer</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={!email || invite.isPending} className="gap-1.5 shrink-0">
        <UserPlus className="h-4 w-4" />
        {invite.isPending ? 'Inviting…' : 'Invite'}
      </Button>
    </form>
  );
}
