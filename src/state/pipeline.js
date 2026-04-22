// Integration pipeline (spec/08 §Testing — headless end-to-end).
// Mirrors the service worker's event-ingestion path but is pure: it takes an
// array of CaptureEvents and folds them through the same classify + merge +
// stats primitives, returning handles the tests can assert on.

import {
  emptyTree,
  mergeCaseReplace,
  mergeCasePatch,
  mergeAssignment,
  mergeDataPage,
  mergeOperator
} from './clipboard.js';
import { classify, extractOperator } from './classify.js';
import { createStore } from './snapshot.js';
import { createStats } from './stats.js';
import { measureTree } from './footprint.js';
import { pickCurrentView, mergeCurrentView } from './current-view.js';

/**
 * Fold one CaptureEvent into tree + stats. Mirrors pushEventLive() in the
 * service worker; kept DRY via shared classify/merge primitives.
 */
export function ingestEvent(tree, event, statsRecorder) {
  if (event && event.kind === 'dx_response') {
    const c = classify(event);
    const body = event.responseBody;
    const source = event.url;
    switch (c.kind) {
      case 'case':
        if (c.isPatch) mergeCasePatch(tree, c.caseId, body, source);
        else           mergeCaseReplace(tree, c.caseId, c.className, body, source);
        break;
      case 'assignment':
        mergeAssignment(tree, c.assignmentId, body, source);
        break;
      case 'data_view':
        mergeDataPage(tree, c.dataPageName, c.paramHash, body, source);
        break;
      case 'view': /* handled below via pickCurrentView */ break;
    }
    const op = extractOperator(body);
    if (op) mergeOperator(tree, op, source);
    const view = pickCurrentView(event);
    if (view) mergeCurrentView(tree, view);
  }
  if (statsRecorder) statsRecorder.record(event);
  return tree;
}

/**
 * Create a fresh per-tab pipeline context. Matches what the SW holds per tab.
 * footprint() is a convenience for spec/07 §"Show captured data footprint".
 */
export function createPipeline({ clock, snapshotCap } = {}) {
  const tree = emptyTree();
  const store = createStore(snapshotCap ? { cap: snapshotCap } : undefined);
  const stats = createStats(clock ? { now: clock } : undefined);
  return {
    tree, store, stats,
    footprint() { return measureTree(this.tree); }
  };
}

/**
 * Replay a whole event stream.
 */
export function ingestAll(pipeline, events) {
  for (const ev of events) ingestEvent(pipeline.tree, ev, pipeline.stats);
  return pipeline;
}
