import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Environment {
  id: string;
  name: string;
  filePath: string;
  description: string | null;
  secretCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: ['environments', projectId],
    queryFn: () =>
      api.get<{ environments: Environment[] }>(`/projects/${projectId}/environments`)
        .then(r => r.environments),
  });
}

export function useCreateEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; filePath: string; description?: string }) =>
      api.post<{ environment: Environment }>(`/projects/${projectId}/environments`, data)
        .then(r => r.environment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments', projectId] }),
  });
}

export function useDeleteEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envId: string) =>
      api.delete<{ ok: boolean }>(`/projects/${projectId}/environments/${envId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments', projectId] }),
  });
}
