import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Secret {
  id: string;
  key: string;
  value: string;
  isShared: boolean;
  hasPersonalValue: boolean;
  version: number;
  updatedAt: string;
}

export interface VersionEntry {
  version: number;
  action: string;
  isShared: boolean;
  actor: { email: string; name: string } | null;
  createdAt: string;
  value: string | null;
}

export function useSecrets(projectId: string) {
  return useQuery({
    queryKey: ['secrets', projectId],
    queryFn: () =>
      api.get<{ secrets: Secret[] }>(`/sync/${projectId}/pull`).then(r => r.secrets),
  });
}

export function useSecretHistory(secretId: string) {
  return useQuery({
    queryKey: ['history', secretId],
    queryFn: () =>
      api.get<{ history: VersionEntry[] }>(`/secrets/${secretId}/history`).then(r => r.history),
  });
}

export function useSetPersonalValue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ secretId, value }: { secretId: string; value: string }) =>
      api.patch(`/secrets/${secretId}/value`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets', projectId] }),
  });
}

export function useSetSharedValue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ secretId, value }: { secretId: string; value: string }) =>
      api.patch(`/secrets/${secretId}/shared`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets', projectId] }),
  });
}

export function useDeleteSecret(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (secretId: string) => api.delete(`/secrets/${secretId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets', projectId] }),
  });
}

export function usePushSecrets(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (secrets: { key: string; value: string; isShared: boolean }[]) =>
      api.post<{ result: any }>(`/sync/${projectId}/push`, { secrets }).then(r => r.result),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets', projectId] }),
  });
}
