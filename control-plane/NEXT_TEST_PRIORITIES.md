# Next Test Coverage Priorities

## Current Status
- **Overall Coverage**: 11.6%
- **Test Files Added**: 7 new test files with 120+ test cases
- **Focus Areas Completed**: VC/DID (security-critical), Infrastructure services

## Priority 1: Core Services (0% coverage) - CRITICAL

### `internal/core/services/agent_service.go` (0% coverage)
**Functions needing tests:**
- `NewAgentService` - Service initialization
- `RunAgent` - Agent lifecycle start
- `StopAgent` - Agent lifecycle stop
- `GetAgentStatus` - Status retrieval
- `reconcileProcessState` - State reconciliation
- `ListRunningAgents` - Agent listing
- `waitForAgentNode` - Agent node waiting
- `updateRuntimeInfo` - Runtime information updates
- `buildProcessConfig` - Process configuration
- `findAgentInRegistry` - Registry lookups

**Test Strategy:**
- Mock process manager
- Test agent lifecycle (start, stop, status)
- Test error handling and edge cases
- Test registry operations

### `internal/core/services/dev_service.go` (0% coverage)
**Functions needing tests:**
- `NewDevService` - Service initialization
- `RunInDevMode` - Dev mode startup
- `StopDevMode` - Dev mode shutdown
- `GetDevStatus` - Status retrieval
- `getFreePort` - Port allocation
- `isPortAvailable` - Port checking
- `startDevProcess` - Process startup
- `discoverAgentPort` - Port discovery
- `waitForAgent` - Agent waiting

**Test Strategy:**
- Mock port operations
- Test dev mode lifecycle
- Test port allocation and conflicts
- Test process management

### `internal/core/services/package_service.go` (0% coverage)
**Functions needing tests:**
- `NewPackageService` - Service initialization
- `InstallPackage` - Package installation
- `UninstallPackage` - Package removal
- `installLocalPackage` - Local package handling
- `stopAgentNode` - Agent node stopping

**Test Strategy:**
- Mock file system operations
- Test package installation/removal
- Test error handling
- Test dependency management

## Priority 2: Storage Layer (4.7% coverage) - HIGH

### `internal/storage/local.go` - SQLite Implementation
**Critical areas:**
- Execution storage operations
- Workflow storage operations
- Webhook storage operations
- DID/VC storage operations
- Transaction handling
- Error recovery
- Concurrency handling

**Test Strategy:**
- Integration tests with real SQLite
- Test transaction rollback scenarios
- Test concurrent access
- Test error handling and recovery
- Test migration scenarios

### Execution Webhook Storage
- `StoreExecutionWebhookEvent`
- `ListExecutionWebhookEvents`
- `ListExecutionWebhookEventsBatch`
- Webhook state management

### Vector Store Operations
- Vector storage and retrieval
- Similarity search
- Index management

### Distributed Lock Operations
- `AcquireLock`
- `ReleaseLock`
- `RenewLock`
- `GetLockStatus`
- Lock expiration handling

## Priority 3: Handlers - MEDIUM

### `internal/handlers/execute.go`
**Expand existing tests:**
- Async execution handling
- Status update flows
- Error handling
- Webhook triggering
- Event publishing

### UI Handlers
- Package handlers
- Lifecycle handlers
- Config handlers
- Execution handlers
- Dashboard handlers

### Server Routes
- Route registration
- Middleware testing
- Error handling
- Authentication/authorization

## Priority 4: Infrastructure - MEDIUM

### Process Management
- Process lifecycle
- Signal handling
- Process monitoring

### Communication Layer
- HTTP client operations
- gRPC operations
- Message queuing

### Configuration Management
- Config loading
- Config validation
- Config updates

## Priority 5: Remaining Services - LOWER

### `internal/services/ui_service.go`
- UI service operations
- Template rendering
- Data aggregation

### `internal/services/keystore_service.go`
- Key generation
- Key storage
- Key retrieval
- Key rotation

### `internal/services/executions_ui_service.go`
- Execution aggregation
- UI data formatting
- Performance metrics

## Test Coverage Goals

### Short-term (Next Sprint)
- Core services: >50% coverage
- Storage layer: >30% coverage
- Critical handlers: >40% coverage

### Medium-term
- Overall coverage: >25%
- Security-critical paths: >80% coverage
- Infrastructure services: >50% coverage

### Long-term
- Overall coverage: >50%
- All critical paths: >80% coverage
- Comprehensive integration test suite

## Implementation Notes

1. **Use table-driven tests** where appropriate
2. **Mock external dependencies** (file system, network, processes)
3. **Test error paths** extensively
4. **Test concurrent operations** for storage and services
5. **Use integration tests** for storage layer
6. **Focus on security-critical paths** first
7. **Document test coverage** as we go
