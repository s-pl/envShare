import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Project {
  id: string;
  name: string;
  slug: string;
  role: string;
  secretCount: number;
  memberCount: number;
  createdAt: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ projects: Project[] }>('/projects').then(r => r.projects),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      api.post<{ project: Project }>('/projects', data).then(r => r.project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
