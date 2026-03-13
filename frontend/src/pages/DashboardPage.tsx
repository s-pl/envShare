import { useState } from 'react';
import { FolderOpen, Key, Users, Upload, Plus, ArrowLeft } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Navbar } from '../components/layout/Navbar';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/Skeleton';
import { ProjectCard } from '../components/projects/ProjectCard';
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog';
import { SecretsPage } from './SecretsPage';
import { MembersPage } from './MembersPage';
import { PushPage } from './PushPage';
import { useProjects, type Project } from '../hooks/useProjects';
import { useAuthStore } from '../store/authStore';

type RoleBadgeVariant = 'default' | 'blue' | 'secondary';
const ROLE_BADGE: Record<string, RoleBadgeVariant> = {
  ADMIN: 'default',
  DEVELOPER: 'blue',
  VIEWER: 'secondary',
};

export function DashboardPage() {
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);
  const [selected, setSelected] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: projects = [], isLoading } = useProjects();

  const navCrumbs = selected
    ? [
        { label: 'Projects', onClick: () => setSelected(null) },
        { label: selected.name },
      ]
    : [{ label: 'Projects' }];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        user={user}
        onLogout={logout}
        crumbs={navCrumbs}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 animate-fade-in">

        {/* Projects list */}
        {!selected && (
          <div className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
                  {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
                </p>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Projects</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLoading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm shadow-primary/20">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Create your first project to start managing secrets with your team."
                action={{ label: 'Create first project', onClick: () => setCreateOpen(true) }}
              />
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Project detail */}
        {selected && (
          <div className="space-y-6 animate-fade-in">
            {/* Project header */}
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                className="h-8 w-8 text-muted-foreground mt-1 shrink-0"
                title="Back to projects"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{selected.name}</h1>
                  <Badge variant={ROLE_BADGE[selected.role] ?? 'secondary'}>
                    {selected.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-muted-foreground font-mono">{selected.slug}</p>
                  <span className="text-muted-foreground/30">·</span>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    {selected.secretCount ?? 0} secrets
                  </p>
                  <span className="text-muted-foreground/30">·</span>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {selected.memberCount ?? 0} members
                  </p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="secrets">
              <TabsList className="h-9">
                <TabsTrigger value="secrets" className="gap-1.5 text-xs">
                  <Key className="h-3.5 w-3.5" /> Secrets
                  {(selected.secretCount ?? 0) > 0 && (
                    <span className="ml-0.5 text-[10px] bg-muted rounded px-1 text-muted-foreground">
                      {selected.secretCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="push" className="gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Push .env
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" /> Members
                  {(selected.memberCount ?? 0) > 0 && (
                    <span className="ml-0.5 text-[10px] bg-muted rounded px-1 text-muted-foreground">
                      {selected.memberCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="secrets" className="mt-6 animate-fade-in">
                <SecretsPage projectId={selected.id} projectName={selected.name} />
              </TabsContent>
              <TabsContent value="push" className="mt-6 animate-fade-in">
                <PushPage projectId={selected.id} projectName={selected.name} />
              </TabsContent>
              <TabsContent value="members" className="mt-6 animate-fade-in">
                <MembersPage projectId={selected.id} projectName={selected.name} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
