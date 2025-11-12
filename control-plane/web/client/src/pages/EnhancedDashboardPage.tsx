import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cardVariants,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { MetricCard } from "@/components/ui/MetricCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { useEnhancedDashboardSimple } from "@/hooks/useEnhancedDashboard";
import type {
  EnhancedDashboardResponse,
  ExecutionTrendPoint,
  WorkflowStat,
  ActiveWorkflowRun,
  CompletedExecutionStat,
  IncidentItem,
} from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Activity,
  RefreshCw,
  Gauge,
  Users,
  Zap,
  AlertTriangle,
  Timer,
  GitCommit,
  Cpu,
  Server,
} from "@/components/ui/icon-bridge";
import type { IconComponent } from "@/components/ui/icon-bridge";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  Tooltip,
} from "recharts";

const numberFormatter = new Intl.NumberFormat("en-US");
const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatPercentage = (value: number | undefined, digits = 1) => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
};

const formatDuration = (value: number | undefined) => {
  if (!value || value <= 0) return "—";
  if (value < 1000) return `${value.toFixed(0)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;
  if (value < 3600000) return `${(value / 60000).toFixed(1)} m`;
  return `${(value / 3600000).toFixed(1)} h`;
};

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export function EnhancedDashboardPage() {
  const { data, loading, error, hasError, refresh, clearError, isRefreshing } =
    useEnhancedDashboardSimple();

  const reasonerStats = useMemo<ReasonerSummary[]>(() => {
    if (!data) {
      return [];
    }

    const agentMeta = new Map(
      data.agent_health.agents.map((agent) => [agent.id, agent])
    );

    const ensureEntry = (
      map: Map<string, ReasonerAccumulator>,
      reasonerId: string
    ) => {
      let entry = map.get(reasonerId);
      if (!entry) {
        entry = {
          reasonerId,
          activeRuns: 0,
          incidentCount: 0,
          agentIds: new Set<string>(),
        };
        map.set(reasonerId, entry);
      }
      return entry;
    };

    const accumulator = new Map<string, ReasonerAccumulator>();

    data.workflows.active_runs.forEach((run) => {
      if (!run.reasoner_id) {
        return;
      }
      const entry = ensureEntry(accumulator, run.reasoner_id);
      entry.activeRuns += 1;
      if (run.agent_node_id) {
        entry.agentIds.add(run.agent_node_id);
      }
    });

    data.incidents.forEach((incident) => {
      if (!incident.reasoner_id) {
        return;
      }
      const entry = ensureEntry(accumulator, incident.reasoner_id);
      entry.incidentCount += 1;
      if (incident.agent_node_id) {
        entry.agentIds.add(incident.agent_node_id);
      }
    });

    const summaries: ReasonerSummary[] = Array.from(accumulator.values()).map(
      (entry) => {
        const agentDetails = Array.from(entry.agentIds).map((agentId) => {
          const meta = agentMeta.get(agentId);
          return {
            id: agentId,
            status: meta ? meta.status : "unknown",
            lastHeartbeat: meta ? meta.last_heartbeat : undefined,
          };
        });

        const status =
          entry.activeRuns > 0
            ? "active"
            : entry.incidentCount > 0
              ? "attention"
              : "idle";

        return {
          reasonerId: entry.reasonerId,
          activeRuns: entry.activeRuns,
          incidentCount: entry.incidentCount,
          agents: agentDetails,
          status,
        } as ReasonerSummary;
      }
    );

    summaries.sort((a, b) => {
      if (a.status === b.status) {
        if (b.activeRuns === a.activeRuns) {
          return b.incidentCount - a.incidentCount;
        }
        return b.activeRuns - a.activeRuns;
      }
      const order = { active: 0, attention: 1, idle: 2 } as const;
      return order[a.status] - order[b.status];
    });

    return summaries;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Enhanced Dashboard"
          description="Real-time observability for distributed agent networks."
          aside={
            <div className="flex gap-4">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-40" />
            </div>
          }
        />

        <ResponsiveGrid variant="dashboard">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-32 rounded-xl border border-border/40"
            />
          ))}
        </ResponsiveGrid>

        <ResponsiveGrid columns={{ base: 1, xl: 3 }} gap="lg">
          <ResponsiveGrid.Item span={{ xl: 2 }}>
            <Skeleton className="h-80 rounded-xl border border-border/40" />
          </ResponsiveGrid.Item>
          <ResponsiveGrid.Item className="space-y-8">
            <Skeleton className="h-56 rounded-xl border border-border/40" />
            <Skeleton className="h-64 rounded-xl border border-border/40" />
          </ResponsiveGrid.Item>
        </ResponsiveGrid>
      </div>
    );
  }

  if (hasError && !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Enhanced Dashboard"
          description="Real-time observability for distributed agent networks."
          aside={
            <Link to="/dashboard">
              <Button variant="ghost">Switch to classic view</Button>
            </Link>
          }
        />

        <ErrorState
          title="Failed to load dashboard data"
          description="An unexpected error occurred while fetching the enhanced dashboard."
          error={error?.message}
          onRetry={refresh}
          onDismiss={clearError}
          retrying={isRefreshing}
          variant="card"
          severity="error"
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const generatedAt = formatTimestamp(data.generated_at);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Monitor agent health, workflow performance, and system throughput across your distributed cluster."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="pill" size="sm">
              {generatedAt}
            </Badge>
            <Button
              onClick={refresh}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("h-3 w-3", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        }
      />

      {hasError && (
        <ErrorState
          title="Unable to refresh data"
          description={`Showing cached data. ${error?.message}`}
          onDismiss={clearError}
          variant="banner"
          severity="warning"
        />
      )}

      <OverviewStrip
        overview={data.overview}
        trends={data.execution_trends.last_24h}
      />

      <ResponsiveGrid
        columns={{ base: 1, md: 6, lg: 12 }}
        flow="dense"
        className="auto-rows-[minmax(220px,auto)] md:auto-rows-[minmax(240px,auto)] lg:auto-rows-[minmax(260px,auto)]"
        gap="lg"
      >
        <ResponsiveGrid.Item span={{ md: 6, lg: 7, xl: 8, "2xl": 7 }}>
          <ExecutionTrendsCard
            trendPoints={data.execution_trends.last_7_days}
            windowMetrics={data.execution_trends.last_24h}
          />
        </ResponsiveGrid.Item>
        <ResponsiveGrid.Item span={{ md: 3, lg: 5, xl: 4, "2xl": 5 }}>
          <IncidentPanel incidents={data.incidents} />
        </ResponsiveGrid.Item>
        <ResponsiveGrid.Item span={{ md: 3, lg: 7, xl: 6, "2xl": 7 }}>
          <WorkflowInsightsPanel insights={data.workflows} />
        </ResponsiveGrid.Item>
        <ResponsiveGrid.Item span={{ md: 6, lg: 5, xl: 6, "2xl": 5 }}>
          <ReasonerActivityPanel
            reasoners={reasonerStats}
            agentSummary={data.agent_health}
          />
        </ResponsiveGrid.Item>
      </ResponsiveGrid>
    </div>
  );
}

interface OverviewStripProps {
  overview: EnhancedDashboardResponse["overview"];
  trends: EnhancedDashboardResponse["execution_trends"]["last_24h"];
}

type OverviewCard = {
  label: string;
  value: string;
  delta: string;
  icon: IconComponent;
};

function OverviewStrip({ overview, trends }: OverviewStripProps) {
  const cards: OverviewCard[] = useMemo(
    () => [
      {
        label: "Agents online",
        value: `${overview.active_agents}/${overview.total_agents}`,
        delta:
          overview.degraded_agents > 0
            ? `${overview.degraded_agents} degraded`
            : `${overview.offline_agents} offline`,
        icon: Users,
      },
      {
        label: "Executions (24h)",
        value: numberFormatter.format(overview.executions_last_24h),
        delta: `${decimalFormatter.format(trends.throughput_per_hour)} / hr`,
        icon: Activity,
      },
      {
        label: "Success rate",
        value: formatPercentage(overview.success_rate_24h),
        delta: `${numberFormatter.format(trends.succeeded)} succeeded`,
        icon: Gauge,
      },
      {
        label: "Avg duration (24h)",
        value: formatDuration(overview.average_duration_ms_24h),
        delta: `Median ${formatDuration(overview.median_duration_ms_24h)}`,
        icon: Timer,
      },
    ],
    [overview, trends]
  );

  return (
    <ResponsiveGrid variant="dashboard">
      {cards.map((card) => (
        <MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          delta={card.delta}
          icon={card.icon}
          size="md"
          variant="default"
        />
      ))}
    </ResponsiveGrid>
  );
}

interface ExecutionTrendsCardProps {
  trendPoints: ExecutionTrendPoint[];
  windowMetrics: EnhancedDashboardResponse["execution_trends"]["last_24h"];
}

function ExecutionTrendsCard({
  trendPoints,
  windowMetrics,
}: ExecutionTrendsCardProps) {
  const chartData = trendPoints.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card
      variant="surface"
      interactive={false}
      className="flex h-full flex-col"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Velocity & reliability
        </CardTitle>
        <Badge variant="pill">Last 7 days</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-8">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: 4 }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const datum = payload[0].payload as ExecutionTrendPoint & {
                    label: string;
                  };
                  return (
                    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium text-foreground">
                        {datum.label}
                      </p>
                      <p className="text-text-secondary">
                        Total: {datum.total}
                      </p>
                      <p className="text-emerald-500">
                        Succeeded: {datum.succeeded}
                      </p>
                      <p className="text-destructive">Failed: {datum.failed}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="none"
                fill="url(#areaGradient)"
              />
              <Line
                type="monotone"
                dataKey="succeeded"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke="var(--destructive)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ResponsiveGrid variant="metrics" align="start">
          <MetricTile
            label="Executions"
            value={numberFormatter.format(windowMetrics.total)}
            helper={`${decimalFormatter.format(windowMetrics.throughput_per_hour)} / hr`}
          />
          <MetricTile
            label="Success rate"
            value={formatPercentage(windowMetrics.success_rate)}
            helper={`${numberFormatter.format(windowMetrics.succeeded)} succeeded`}
          />
          <MetricTile
            label="Avg duration"
            value={formatDuration(windowMetrics.average_duration_ms)}
            helper={`${numberFormatter.format(windowMetrics.failed)} failed`}
          />
        </ResponsiveGrid>
      </CardContent>
    </Card>
  );
}

interface MetricTileProps {
  label: string;
  value: string;
  helper?: string;
}

function MetricTile({ label, value, helper }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-caption text-text-tertiary">{label}</p>
      <p className="mt-2 text-heading-2">{value}</p>
      {helper && (
        <p className="text-body-small text-text-secondary mt-1">{helper}</p>
      )}
    </div>
  );
}

interface WorkflowInsightsPanelProps {
  insights: EnhancedDashboardResponse["workflows"];
}

function WorkflowInsightsPanel({ insights }: WorkflowInsightsPanelProps) {
  return (
    <Card
      variant="surface"
      interactive={false}
      className="flex h-full flex-col"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4" /> Workflow intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col min-h-0">
        <ResponsiveGrid variant="detail" gap="lg" align="start" className="flex-1 min-h-0">
          <InsightsGroup
            title="Top workflows"
            empty="No executions recorded in the last 7 days."
            items={insights.top_workflows}
            render={(workflow: WorkflowStat) => (
              <Link
                to={`/workflows/${workflow.workflow_id}/enhanced`}
                className={cn(
                  "block transition-colors hover:border-border hover:bg-muted/30 min-w-0",
                  cardVariants({ variant: "muted", interactive: false }),
                  "px-3 py-3"
                )}
              >
                <div className="space-y-1 text-sm text-foreground min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {workflow.name || workflow.workflow_id}
                  </p>
                  <p className="text-body-small text-text-secondary">
                    {numberFormatter.format(workflow.total_executions)} runs ·{" "}
                    {formatPercentage(workflow.success_rate)} success
                  </p>
                </div>
                <div className="mt-2 min-w-0">
                  <Badge
                    variant="outline"
                    className="inline-flex justify-start rounded-full text-[10px] leading-4 text-left max-w-full"
                  >
                    <span className="truncate">
                      Last run {formatTimestamp(workflow.last_activity)}
                    </span>
                  </Badge>
                </div>
              </Link>
            )}
          />

          <div className="space-y-8">
            <InsightsGroup
              title="Active runs"
              empty="No workflows running right now."
              items={insights.active_runs}
              render={(run: ActiveWorkflowRun) => (
                <Link
                  to={`/executions/${run.execution_id}`}
                  className={cn(
                    "block transition-colors hover:border-border hover:bg-muted/20 min-w-0",
                    cardVariants({ variant: "muted", interactive: false }),
                    "px-3 py-2 text-xs"
                  )}
                >
                  <div className="flex items-center justify-between min-w-0 gap-2">
                    <p className="font-medium text-foreground truncate">
                      {run.name || run.workflow_id}
                    </p>
                    <span className="text-text-tertiary flex-shrink-0">
                      {formatDuration(run.elapsed_ms)}
                    </span>
                  </div>
                  <p className="mt-1 text-text-secondary truncate">
                    {run.execution_id} · {run.reasoner_id}
                  </p>
                </Link>
              )}
            />

            <InsightsGroup
              title="Longest recent runs"
              empty="Insufficient completed runs."
              items={insights.longest_executions}
              render={(execution: CompletedExecutionStat) => (
                <div
                  className={cn(
                    cardVariants({ variant: "muted", interactive: false }),
                    "px-3 py-2 text-xs min-w-0"
                  )}
                >
                  <p className="font-medium text-foreground truncate">
                    {execution.name || execution.workflow_id}
                  </p>
                  <p className="mt-1 text-text-secondary truncate">
                    {formatDuration(execution.duration_ms)} · Completed{" "}
                    {formatTimestamp(execution.completed_at)}
                  </p>
                </div>
              )}
            />

          </div>
        </ResponsiveGrid>
      </CardContent>
    </Card>
  );
}

interface InsightsGroupProps<T> {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactElement;
}

function InsightsGroup<T>({
  title,
  empty,
  items,
  render,
}: InsightsGroupProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-caption text-text-tertiary">
        <GitCommit className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-body-small text-text-secondary">{empty}</p>
        ) : (
          items.map((item, index) => <div key={index}>{render(item)}</div>)
        )}
      </div>
    </div>
  );
}

interface IncidentPanelProps {
  incidents: IncidentItem[];
}

function IncidentPanel({ incidents }: IncidentPanelProps) {
  return (
    <Card
      variant="surface"
      interactive={false}
      className="flex h-full flex-col"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Incident log
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between text-body">
          <span className="text-text-secondary">
            {incidents.length} issues in the last 7 days
          </span>
          {incidents.length > 0 && (
            <Badge
              variant="outline"
              className="rounded-full border-destructive/40 text-destructive bg-transparent"
            >
              Attention
            </Badge>
          )}
        </div>
        {incidents.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/10 p-4 text-center text-body-small">
            No failures or cancellations detected in the last 7 days.
          </div>
        ) : (
          <div className="h-[250px] overflow-hidden">
            <div className="max-h-[250px] space-y-4 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/70">
              {incidents.map((incident) => (
                <Link
                  key={incident.execution_id}
                  to={`/executions/${incident.execution_id}`}
                  className={cn(
                    "block transition-colors hover:border-border hover:bg-muted/20",
                    cardVariants({ variant: "muted", interactive: false }),
                    "px-3 py-3 text-xs"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive"></div>
                      <p className="font-medium text-foreground">
                        {incident.name || incident.workflow_id}
                      </p>
                    </div>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                      {incident.status}
                    </span>
                  </div>
                  <p className="ml-4 mt-1 text-text-secondary">
                    {incident.execution_id} · {incident.reasoner_id}
                  </p>
                  {incident.error && (
                    <p className="ml-4 mt-2 line-clamp-2 text-body-small text-destructive/80">
                      {incident.error}
                    </p>
                  )}
                  <p className="ml-4 mt-2 text-[10px] text-text-tertiary">
                    Started {formatTimestamp(incident.started_at)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReasonerSummary {
  reasonerId: string;
  activeRuns: number;
  incidentCount: number;
  agents: Array<{
    id: string;
    status: string;
    lastHeartbeat?: string;
  }>;
  status: "active" | "attention" | "idle";
}

interface ReasonerAccumulator {
  reasonerId: string;
  activeRuns: number;
  incidentCount: number;
  agentIds: Set<string>;
}

interface ReasonerActivityPanelProps {
  reasoners: ReasonerSummary[];
  agentSummary: EnhancedDashboardResponse["agent_health"];
}

function ReasonerActivityPanel({
  reasoners,
  agentSummary,
}: ReasonerActivityPanelProps) {
  return (
    <Card variant="surface" interactive={false} className="flex h-full flex-col">
      <CardHeader className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-4 w-4" /> Reasoner activity
        </CardTitle>
        <div className="grid grid-cols-3 gap-2 text-center text-body-small uppercase tracking-wide text-text-tertiary">
          <StatusCounter
            label="Active agents"
            value={agentSummary.active}
            tone="success"
          />
          <StatusCounter
            label="Degraded"
            value={agentSummary.degraded}
            tone="warning"
          />
          <StatusCounter
            label="Offline"
            value={agentSummary.offline}
            tone="destructive"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 min-h-0">
        {reasoners.length === 0 ? (
          <p className="text-body-small">
            No recent reasoner activity. Trigger a workflow or execution to
            populate this view.
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            {reasoners.map((reasoner) => (
              <ReasonerRow key={reasoner.reasonerId} reasoner={reasoner} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReasonerRow({ reasoner }: { reasoner: ReasonerSummary }) {
  return (
    <div
      className={cn(
        cardVariants({ variant: "muted", interactive: false }),
        "px-3 py-3 text-xs"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="metadata" className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {reasoner.reasonerId}
          </Badge>
          <StatusIndicator
            status={reasoner.status}
            label={
              reasoner.status === "active"
                ? "Active"
                : reasoner.status === "attention"
                  ? "Needs attention"
                  : "Idle"
            }
            size="sm"
            variant="subtle"
          />
        </div>
        <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
          <span>{reasoner.activeRuns} running</span>
          <span>{reasoner.incidentCount} incidents</span>
        </div>
      </div>

      {reasoner.agents.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {reasoner.agents.map((agent) => (
            <span
              key={agent.id}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[10px]"
            >
              <Server className="h-3 w-3" />
              {agent.id}
              {agent.lastHeartbeat && (
                <span className="text-[9px] text-text-tertiary">
                  · {formatTimestamp(agent.lastHeartbeat)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface StatusCounterProps {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive";
}

function StatusCounter({ label, value, tone }: StatusCounterProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
        : "text-destructive";

  return (
    <div className="rounded-xl border border-border/40 bg-muted/30 px-2 py-2">
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className={cn("mt-1 text-base font-semibold", toneClass)}>{value}</p>
    </div>
  );
}
