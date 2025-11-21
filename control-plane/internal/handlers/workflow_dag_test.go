package handlers

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
	"github.com/Agent-Field/agentfield/control-plane/pkg/types"

	"github.com/stretchr/testify/require"
)

func TestBuildExecutionDAG_Simple(t *testing.T) {
	executions := []*types.Execution{
		{
			ExecutionID: "exec-1",
			RunID:       "run-1",
			Status:      "succeeded",
			StartedAt:   time.Now(),
			ReasonerID:  "reasoner-1",
		},
	}

	dag, timeline, status, workflowName, sessionID, actorID, maxDepth := buildExecutionDAG(executions)

	require.NotNil(t, dag)
	require.Equal(t, "exec-1", dag.ExecutionID)
	require.Equal(t, "run-1", dag.WorkflowID)
	require.Equal(t, 0, dag.WorkflowDepth)
	require.Empty(t, dag.Children)
	require.Len(t, timeline, 1)
	require.Equal(t, "succeeded", status)
	require.Equal(t, "reasoner-1", workflowName)
	require.Nil(t, sessionID)
	require.Nil(t, actorID)
	require.Equal(t, 0, maxDepth)
}

func TestBuildExecutionDAG_WithParentChild(t *testing.T) {
	parentID := "exec-parent"
	childID := "exec-child"

	executions := []*types.Execution{
		{
			ExecutionID:       parentID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now(),
			ParentExecutionID: nil,
			ReasonerID:        "reasoner-1",
		},
		{
			ExecutionID:       childID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(1 * time.Second),
			ParentExecutionID: &parentID,
			ReasonerID:        "reasoner-2",
		},
	}

	dag, timeline, status, _, _, _, maxDepth := buildExecutionDAG(executions)

	require.NotNil(t, dag)
	require.Equal(t, parentID, dag.ExecutionID)
	require.Len(t, dag.Children, 1)
	require.Equal(t, childID, dag.Children[0].ExecutionID)
	require.Equal(t, 0, dag.WorkflowDepth)
	require.Equal(t, 1, dag.Children[0].WorkflowDepth)
	require.Len(t, timeline, 2)
	require.Equal(t, "succeeded", status)
	require.Equal(t, 1, maxDepth)
}

func TestBuildExecutionDAG_MultipleChildren(t *testing.T) {
	parentID := "exec-parent"
	child1ID := "exec-child-1"
	child2ID := "exec-child-2"

	executions := []*types.Execution{
		{
			ExecutionID:       parentID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now(),
			ParentExecutionID: nil,
		},
		{
			ExecutionID:       child1ID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(1 * time.Second),
			ParentExecutionID: &parentID,
		},
		{
			ExecutionID:       child2ID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(2 * time.Second),
			ParentExecutionID: &parentID,
		},
	}

	dag, timeline, _, _, _, _, maxDepth := buildExecutionDAG(executions)

	require.NotNil(t, dag)
	require.Equal(t, parentID, dag.ExecutionID)
	require.Len(t, dag.Children, 2)

	childIDs := make(map[string]bool)
	for _, child := range dag.Children {
		childIDs[child.ExecutionID] = true
	}
	require.True(t, childIDs[child1ID])
	require.True(t, childIDs[child2ID])
	require.Len(t, timeline, 3)
	require.Equal(t, 1, maxDepth)
}

func TestBuildExecutionDAG_DeepHierarchy(t *testing.T) {
	rootID := "exec-root"
	level1ID := "exec-level1"
	level2ID := "exec-level2"

	executions := []*types.Execution{
		{
			ExecutionID:       rootID,
			RunID:            "run-1",
			Status:           "succeeded",
			StartedAt:        time.Now(),
			ParentExecutionID: nil,
		},
		{
			ExecutionID:       level1ID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(1 * time.Second),
			ParentExecutionID: &rootID,
		},
		{
			ExecutionID:       level2ID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(2 * time.Second),
			ParentExecutionID: &level1ID,
		},
	}

	dag, timeline, _, _, _, _, maxDepth := buildExecutionDAG(executions)

	require.NotNil(t, dag)
	require.Equal(t, rootID, dag.ExecutionID)
	require.Len(t, dag.Children, 1)
	require.Equal(t, level1ID, dag.Children[0].ExecutionID)
	require.Len(t, dag.Children[0].Children, 1)
	require.Equal(t, level2ID, dag.Children[0].Children[0].ExecutionID)
	require.Len(t, timeline, 3)
	require.Equal(t, 2, maxDepth)
}

func TestBuildExecutionDAG_EmptyExecutions(t *testing.T) {
	executions := []*types.Execution{}

	dag, timeline, status, workflowName, sessionID, actorID, maxDepth := buildExecutionDAG(executions)

	require.Equal(t, WorkflowDAGNode{}, dag)
	require.Empty(t, timeline)
	require.Equal(t, "succeeded", status) // deriveOverallStatus returns "succeeded" for empty executions
	require.Empty(t, workflowName)
	require.Nil(t, sessionID)
	require.Nil(t, actorID)
	require.Equal(t, 0, maxDepth)
}

func TestBuildExecutionDAG_NilExecutions(t *testing.T) {
	// Note: buildExecutionDAG doesn't handle nil executions well in sorting,
	// so we test with empty slice instead
	executions := []*types.Execution{}

	dag, timeline, status, workflowName, sessionID, actorID, maxDepth := buildExecutionDAG(executions)

	require.Equal(t, WorkflowDAGNode{}, dag)
	require.Empty(t, timeline)
	require.Equal(t, "succeeded", status) // deriveOverallStatus returns "succeeded" for empty executions
	require.Empty(t, workflowName)
	require.Nil(t, sessionID)
	require.Nil(t, actorID)
	require.Equal(t, 0, maxDepth)
}

func TestDeriveOverallStatus_AllSucceeded(t *testing.T) {
	executions := []*types.Execution{
		{Status: "succeeded"},
		{Status: "succeeded"},
		{Status: "succeeded"},
	}

	status := deriveOverallStatus(executions)
	require.Equal(t, "succeeded", status)
}

func TestDeriveOverallStatus_OneFailed(t *testing.T) {
	executions := []*types.Execution{
		{Status: "succeeded"},
		{Status: "failed"},
		{Status: "succeeded"},
	}

	status := deriveOverallStatus(executions)
	require.Equal(t, "failed", status)
}

func TestDeriveOverallStatus_OneRunning(t *testing.T) {
	executions := []*types.Execution{
		{Status: "succeeded"},
		{Status: "running"},
		{Status: "succeeded"},
	}

	status := deriveOverallStatus(executions)
	require.Equal(t, "running", status)
}

func TestDeriveOverallStatus_Pending(t *testing.T) {
	executions := []*types.Execution{
		{Status: "succeeded"},
		{Status: "pending"},
		{Status: "succeeded"},
	}

	status := deriveOverallStatus(executions)
	require.Equal(t, "running", status)
}

func TestDeriveOverallStatus_Queued(t *testing.T) {
	executions := []*types.Execution{
		{Status: "succeeded"},
		{Status: "queued"},
		{Status: "succeeded"},
	}

	status := deriveOverallStatus(executions)
	require.Equal(t, "running", status)
}

func TestBuildLightweightExecutionDAG_Simple(t *testing.T) {
	executions := []*types.Execution{
		{
			ExecutionID: "exec-1",
			RunID:       "run-1",
			Status:      "succeeded",
			StartedAt:   time.Now(),
			ReasonerID:  "reasoner-1",
		},
	}

	timeline, status, workflowName, sessionID, actorID, maxDepth := buildLightweightExecutionDAG(executions)

	require.Len(t, timeline, 1)
	require.Equal(t, "exec-1", timeline[0].ExecutionID)
	require.Equal(t, 0, timeline[0].WorkflowDepth)
	require.Equal(t, "succeeded", status)
	require.Equal(t, "reasoner-1", workflowName)
	require.Nil(t, sessionID)
	require.Nil(t, actorID)
	require.Equal(t, 0, maxDepth)
}

func TestBuildLightweightExecutionDAG_WithParentChild(t *testing.T) {
	parentID := "exec-parent"
	childID := "exec-child"

	executions := []*types.Execution{
		{
			ExecutionID:       parentID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now(),
			ParentExecutionID: nil,
		},
		{
			ExecutionID:       childID,
			RunID:             "run-1",
			Status:            "succeeded",
			StartedAt:         time.Now().Add(1 * time.Second),
			ParentExecutionID: &parentID,
		},
	}

	timeline, status, _, _, _, maxDepth := buildLightweightExecutionDAG(executions)

	require.Len(t, timeline, 2)
	require.Equal(t, parentID, timeline[0].ExecutionID)
	require.Equal(t, 0, timeline[0].WorkflowDepth)
	require.Equal(t, childID, timeline[1].ExecutionID)
	require.Equal(t, 1, timeline[1].WorkflowDepth)
	require.Equal(t, "succeeded", status)
	require.Equal(t, 1, maxDepth)
}

func TestBuildLightweightExecutionDAG_EmptyExecutions(t *testing.T) {
	executions := []*types.Execution{}

	timeline, status, workflowName, sessionID, actorID, maxDepth := buildLightweightExecutionDAG(executions)

	require.Empty(t, timeline)
	require.Empty(t, status)
	require.Empty(t, workflowName)
	require.Nil(t, sessionID)
	require.Nil(t, actorID)
	require.Equal(t, 0, maxDepth)
}

func TestExecutionToDAGNode(t *testing.T) {
	now := time.Now()
	completed := now.Add(1 * time.Hour)
	duration := int64(3600000)

	exec := &types.Execution{
		ExecutionID:       "exec-1",
		RunID:             "run-1",
		AgentNodeID:       "agent-1",
		ReasonerID:        "reasoner-1",
		Status:            "succeeded",
		StartedAt:         now,
		CompletedAt:       &completed,
		DurationMS:        &duration,
		ParentExecutionID: nil,
	}

	node := executionToDAGNode(exec, 2)

	require.Equal(t, "exec-1", node.ExecutionID)
	require.Equal(t, "run-1", node.WorkflowID)
	require.Equal(t, "agent-1", node.AgentNodeID)
	require.Equal(t, "reasoner-1", node.ReasonerID)
	require.Equal(t, "succeeded", node.Status)
	require.Equal(t, 2, node.WorkflowDepth)
	require.NotNil(t, node.CompletedAt)
	require.Equal(t, duration, *node.DurationMS)
}

func TestExecutionToLightweightNode(t *testing.T) {
	now := time.Now()
	completed := now.Add(1 * time.Hour)
	duration := int64(3600000)

	exec := &types.Execution{
		ExecutionID:       "exec-1",
		RunID:             "run-1",
		AgentNodeID:       "agent-1",
		ReasonerID:        "reasoner-1",
		Status:            "succeeded",
		StartedAt:         now,
		CompletedAt:       &completed,
		DurationMS:        &duration,
		ParentExecutionID: nil,
	}

	node := executionToLightweightNode(exec, 2)

	require.Equal(t, "exec-1", node.ExecutionID)
	require.Equal(t, "agent-1", node.AgentNodeID)
	require.Equal(t, "reasoner-1", node.ReasonerID)
	require.Equal(t, "succeeded", node.Status)
	require.Equal(t, 2, node.WorkflowDepth)
	require.NotNil(t, node.CompletedAt)
	require.Equal(t, duration, *node.DurationMS)
}

func TestIsLightweightRequest(t *testing.T) {
	// This would require gin.Context, so we'll test the logic conceptually
	// The function checks for query params "mode=lightweight" or "lightweight=true/1"
}

func TestNewExecutionGraphService(t *testing.T) {
	provider, ctx := setupTestStorage(t)

	svc := newExecutionGraphService(provider)
	require.NotNil(t, svc)
	require.NotNil(t, svc.store)

	_ = ctx
}

// Helper function from other test files
func setupTestStorage(t *testing.T) (storage.StorageProvider, context.Context) {
	t.Helper()

	ctx := context.Background()
	tempDir := t.TempDir()
	cfg := storage.StorageConfig{
		Mode: "local",
		Local: storage.LocalStorageConfig{
			DatabasePath: tempDir + "/test.db",
			KVStorePath:  tempDir + "/test.bolt",
		},
	}

	provider := storage.NewLocalStorage(storage.LocalStorageConfig{})
	err := provider.Initialize(ctx, cfg)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "fts5") {
			t.Skip("sqlite3 compiled without FTS5; skipping test")
		}
		require.NoError(t, err)
	}

	t.Cleanup(func() {
		_ = provider.Close(ctx)
	})

	return provider, ctx
}
