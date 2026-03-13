import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: ['members', projectId],
    queryFn: () =>
      api.get<{ members: Member[] }>(`/projects/${projectId}/members`).then(r => r.members),
  });
}

export function useInviteMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api.post(`/projects/${projectId}/members`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', projectId] }),
  });
}

export function useRemoveMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', projectId] }),
  });
}
