import { Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { MemberRow } from '../components/members/MemberRow';
import { InviteForm } from '../components/members/InviteForm';
import { useMembers, useRemoveMember } from '../hooks/useMembers';
import { useAuthStore } from '../store/authStore';

interface MembersPageProps {
  projectId: string;
  projectName: string;
}

export function MembersPage({ projectId, projectName }: MembersPageProps) {
  const user = useAuthStore(s => s.user);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: members = [], isLoading } = useMembers(projectId);
  const removeMember = useRemoveMember(projectId);

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget.id);
      toast.success(`${removeTarget.name} removed`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to remove member');
    } finally {
      setRemoveTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-foreground mb-3">Invite a teammate</p>
          <InviteForm projectId={projectId} />
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Invite teammates using their email above."
          />
        ) : (
          <Card>
            <CardContent className="py-2">
              {members.map((member, i) => (
                <div key={member.id}>
                  {i > 0 && <Separator />}
                  <MemberRow
                    member={member}
                    isCurrentUser={member.user.id === user?.id}
                    onRemove={() => setRemoveTarget({ id: member.user.id, name: member.user.name })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title={`Remove ${removeTarget?.name}?`}
        description="They will lose access to all secrets in this project."
        confirmLabel="Remove"
        loading={removeMember.isPending}
      />
    </div>
  );
}
