# Current-State Visual Representation

## Goal

Provide a complete current-state view of:

- Delivery flow (`PR -> merge -> main checks -> security/deploy signals`)
- Runtime flow (`Widget -> Edge Functions -> Retrieval -> Observability/Feedback`)

## Scope Captured

- Delivery workflows:
  - `.github/workflows/ci.yml`
  - `.github/workflows/codeql.yml`
- Runtime paths:
  - `apps/eigen-widget/widget.js`
  - `supabase/functions/eigen-widget-chat/index.ts`
  - `supabase/functions/eigen-chat-public/index.ts`
  - `supabase/functions/eigen-widget-feedback/index.ts`
  - `supabase/functions/_shared/conversation-turn.ts`
  - `supabase/migrations/202604180003_conversation_turn_observability.sql`
  - `supabase/migrations/202604180004_conversation_turn_idempotency_keys.sql`

## Unified Current-State Diagram (High-Level)

```mermaid
flowchart TD
  subgraph deliveryFlow [DeliveryFlow]
    dev[DeveloperPushOrPR] --> prChecks[PRChecks]
    prChecks --> ciPr[CITypecheckTestGuardsPR]
    prChecks --> depReview[DependencyReviewPR]
    prChecks --> codeqlPr[CodeQLAnalyzePR]
    prChecks --> reviewBots[ReviewBotsCodeRabbitDevin]
    ciPr --> mergeGate[MergeGate]
    depReview --> mergeGate
    codeqlPr --> mergeGate
    reviewBots --> mergeGate
    mergeGate --> mergeMain[MergeToMain]
    mergeMain --> ciMain[CIOnMainWithSupabaseRemoteChecks]
    mergeMain --> codeqlMain[CodeQLOnMain]
    mergeMain --> deploySignals[DeploySignalsCloudflareAndSupabasePreview]
  end

  subgraph runtimeFlow [RuntimeFlow]
    user[EndUserInEmbeddedWidget] --> widgetUI[WidgetUIwidgetjs]
    widgetUI --> sessionFn[eigen-widget-session]
    sessionFn --> modeBranch{PublicOrEigenX}
    modeBranch -->|Public| publicChat[eigen-chat-public]
    modeBranch -->|EigenXOrMixed| widgetChat[eigen-widget-chat]
    publicChat --> retrieve[eigen-retrieve-core]
    widgetChat --> retrieve
    retrieve --> llm[LLMStreamOrJSON]
    llm --> sseFinal[SSEDeltaFinalOrJSONFallback]
    sseFinal --> widgetUI
    sseFinal --> obsWrite[conversation_turnWrite]
    widgetUI --> feedbackFn[eigen-widget-feedback]
    feedbackFn --> feedbackWrite[conversation_turn_feedbackWrite]
    feedbackFn --> turnSummaryUpdate[conversation_turnSummaryUpdate]
  end

  obsWrite --> db[(SupabasePostgres)]
  feedbackWrite --> db
  turnSummaryUpdate --> db
```

## Technical-Depth Diagram

```mermaid
flowchart TD
  subgraph clientLayer [ClientLayer]
    embedHost[IframeHostApp] --> widgetJs[apps-eigen-widget-widget-js]
    widgetJs --> sessionReq["POST /eigen-widget-session"]
    widgetJs --> chatReq["POST /eigen-widget-chat"]
    widgetJs --> feedbackReq["POST /eigen-widget-feedback"]
  end

  subgraph edgeLayer [EdgeFunctionLayer]
    sessionReq --> sessionFn[eigen-widget-session]
    chatReq --> widgetChatFn[eigen-widget-chat]
    chatReq --> publicChatFn[eigen-chat-public]
    feedbackReq --> feedbackFn[eigen-widget-feedback]
  end

  subgraph authGuards [AuthAndGuards]
    widgetChatFn --> idemChat[requireIdempotencyKey]
    publicChatFn --> idemPublic[requireIdempotencyKey]
    feedbackFn --> idemFeedback[requireIdempotencyKey]
    feedbackFn --> tokenVerify[verifyWidgetSessionToken]
    feedbackFn --> eigenxGuard["guardAuth when mode is eigenx"]
    feedbackFn --> originCheck[originMatchCheck]
  end

  subgraph retrievalSynthesis [RetrievalAndSynthesis]
    widgetChatFn --> retrieveExec[executeEigenRetrieve]
    publicChatFn --> retrieveExec
    retrieveExec --> citations[buildCitationsEvidenceTier]
    retrieveExec --> confidence[buildCompositeConfidence]
    retrieveExec --> retrievalPlan[buildRetrievalPlanShared]
    widgetChatFn --> streamPathWidget["stream true or accept includes text-event-stream"]
    publicChatFn --> streamPathPublic["stream true or accept includes text-event-stream"]
    streamPathWidget --> sseWidget[streamLlmChatDeltas]
    streamPathPublic --> ssePublic[streamLlmChatDeltas]
    sseWidget --> sseEmitWidget["emit delta final error"]
    ssePublic --> sseEmitPublic["emit delta final error"]
    widgetChatFn --> jsonWidget[completeLlmChatPath]
    publicChatFn --> jsonPublic[completeLlmChatPath]
  end

  subgraph observabilityLayer [ObservabilityAndIdempotency]
    sseEmitWidget --> turnInsertShared[insertConversationTurnShared]
    sseEmitPublic --> turnInsertShared
    jsonWidget --> turnInsertShared
    jsonPublic --> turnInsertShared
    turnInsertShared --> turnLookup["lookup by mode site user idempotency key"]
    turnInsertShared --> turnWrite["insert conversation_turn"]
    feedbackFn --> feedbackLookup["lookup by turn id and idempotency key"]
    feedbackFn --> feedbackInsert["insert conversation_turn_feedback"]
    feedbackFn --> feedbackRepair["update conversation_turn feedback fields"]
  end

  subgraph dbLayer [DatabaseLayer]
    turnWrite --> turnTable[(conversation_turn)]
    feedbackInsert --> feedbackTable[(conversation_turn_feedback)]
    feedbackRepair --> turnTable
    turnTable --> idxTurn["unique index scoped idempotency key"]
    feedbackTable --> idxFeedback["unique index turn_id plus idempotency_key"]
  end

  subgraph ciLayer [CIAndSecurityLayer]
    prEvent[PROrMainPush] --> ciWorkflow[ci-yml]
    prEvent --> codeqlWorkflow[codeql-yml]
    ciWorkflow --> qualityGate[typecheckTestImportsMigrationsDriftTypegen]
    qualityGate --> supabaseSecrets["SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN"]
    codeqlWorkflow --> codeScanning[GitHubCodeScanning]
  end
```

## What This Means Today

- Merges are protected by PR rules and validated again on `main`.
- CodeQL runs on PRs and `main`, and uploads code scanning results.
- Widget runtime supports SSE streaming and JSON fallback.
- Observability writes are centralized through shared conversation-turn helpers.
- Idempotency keys are enforced for write paths to reduce duplicate rows on retries.

## How To Use This Representation

1. Start with the high-level diagram to orient around delivery versus runtime.
2. Use the technical-depth diagram to trace one request end-to-end:
   - widget request entry,
   - auth/idempotency guard,
   - retrieval/synthesis path,
   - observability write path,
   - feedback write/repair path.
3. Use CI/security lane to validate release readiness:
   - `CI` run on `main` green,
   - `CodeQL` run on `main` green,
   - Supabase remote drift/type checks green.
4. For incident triage:
   - request issue: inspect runtime and guard lanes,
   - data mismatch issue: inspect observability and feedback repair lanes,
   - release issue: inspect delivery and CI/security lanes.

## Demo Walkthrough

### Demo A: Delivery Pipeline

1. Open a recent PR.
2. Show required checks (CI, dependency review, CodeQL, review bots).
3. Merge to `main`.
4. Show post-merge `main` runs for CI and CodeQL.

### Demo B: Runtime Request

1. Open widget in public mode.
2. Submit a prompt.
3. Show streaming response behavior and fallback compatibility.
4. Show citations and retrieval-plan disclosure rendering.

### Demo C: Feedback + Idempotency

1. Submit feedback for a completed turn.
2. Repeat submission with same idempotency key (retry simulation).
3. Show dedupe behavior (no duplicate feedback row) and summary-field repair on turn row.

