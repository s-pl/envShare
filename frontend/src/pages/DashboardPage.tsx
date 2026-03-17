import { useState, useMemo } from "react";
import {
  FolderOpen,
  Key,
  Users,
  Upload,
  Plus,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Trash2,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Navbar } from "../components/layout/Navbar";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonCard } from "../components/common/Skeleton";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ProjectCard } from "../components/projects/ProjectCard";
import { CreateProjectDialog } from "../components/projects/CreateProjectDialog";
import { EnvironmentList } from "../components/environments/EnvironmentList";
import { SecretsPage } from "./SecretsPage";
import { MembersPage } from "./MembersPage";
import { PushPage } from "./PushPage";
import { useProjects, useDeleteProject, type Project } from "../hooks/useProjects";
import { useAuthStore } from "../store/authStore";

type RoleBadgeVariant = "default" | "blue" | "secondary";
const ROLE_BADGE: Record<string, RoleBadgeVariant> = {
  ADMIN: "default",
  DEVELOPER: "blue",
  VIEWER: "secondary",
};

function greeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(" ")[0];
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 18) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium leading-none mb-1">{label}</p>
        <p className="text-lg font-bold text-foreground tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  const stats = useMemo(
    () => ({
      projects: projects.length,
      secrets: projects.reduce((s, p) => s + (p.secretCount ?? 0), 0),
      members: projects.reduce((s, p) => s + (p.memberCount ?? 0), 0),
    }),
    [projects],
  );

  const navCrumbs = selected
    ? [
        { label: "Projects", onClick: () => setSelected(null) },
        { label: selected.name },
      ]
    : [{ label: "Projects" }];

  async function handleDeleteProject() {
    if (!selected) return;
    try {
      await deleteProject.mutateAsync(selected.id);
      toast.success(`Project "${selected.name}" deleted`);
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleteOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user} onLogout={logout} crumbs={navCrumbs} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 animate-fade-in">
        {/* Projects list */}
        {!selected && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                {user?.name && (
                  <p className="text-xs font-semibold text-muted-foreground/60 mb-1 tracking-wide">
                    {greeting(user.name)}
                  </p>
                )}
                <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  Projects
                  {!isLoading && projects.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({projects.length})
                    </span>
                  )}
                </h1>
              </div>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </div>

            {!isLoading && projects.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={FolderOpen} label="Projects" value={stats.projects} />
                <StatCard icon={Key} label="Total secrets" value={stats.secrets} sub="AES-256-GCM" />
                <StatCard icon={Users} label="Team members" value={stats.members} />
              </div>
            )}

            {!isLoading && stats.secrets > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border/60 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  All <strong className="text-foreground">{stats.secrets}</strong> secrets
                  are encrypted at rest with AES-256-GCM. The master key never touches the database.
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No projects yet"
                description="Create your first project to start managing secrets with your team."
                action={{ label: "Create first project", onClick: () => setCreateOpen(true) }}
              />
            ) : (
              <div className="space-y-2.5">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Project detail */}
        {selected && (
          <div className="space-y-6 animate-fade-in">
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
                  <Badge variant={ROLE_BADGE[selected.role] ?? "secondary"}>
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

              {selected.role === "ADMIN" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive mt-1 shrink-0"
                  title="Delete project"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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
                <TabsTrigger value="environments" className="gap-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5" /> Environments
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
              <TabsContent value="environments" className="mt-6 animate-fade-in">
                <EnvironmentList projectId={selected.id} userRole={selected.role} />
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

      <ConfirmDialog
        open={deleteOpen}
        title="Delete project"
        description={
          selected
            ? `Permanently delete "${selected.name}"? All secrets, environments and members will be removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete project"
        loading={deleteProject.isPending}
        onConfirm={handleDeleteProject}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
