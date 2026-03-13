import { Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar } from '../common/Avatar';
import { type Member } from '../../hooks/useMembers';

type RoleBadgeVariant = 'default' | 'blue' | 'secondary';
const ROLE_BADGE: Record<string, RoleBadgeVariant> = {
  ADMIN: 'default',
  DEVELOPER: 'blue',
  VIEWER: 'secondary',
};

interface MemberRowProps {
  member: Member;
  isCurrentUser: boolean;
  onRemove: () => void;
}

export function MemberRow({ member, isCurrentUser, onRemove }: MemberRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 group">
      <Avatar name={member.user.name} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">
          {member.user.name}
          {isCurrentUser && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">(you)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
      </div>

      <Badge variant={ROLE_BADGE[member.role] ?? 'secondary'}>
        {member.role}
      </Badge>

      {!isCurrentUser && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive"
          title="Remove member"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
