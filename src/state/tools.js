// Pure tool dispatch (spec/06 §Tool layer contract). No chrome.*, no DOM.
// Callers provide the tree and snapshot store; dispatch is a switch.

import { getNodeByPath, listCases, listDataPages } from './clipboard.js';
import { diffTrees } from './snapshot.js';
import { buildIndex, runSearch, SCOPE } from './search.js';
import { getFieldBinding } from './binding.js';

/**
 * @param {{ tree: object, store: object }} ctx
 * @param {string} name
 * @param {object} args
 */
export function dispatchTool(ctx, name, args = {}) {
  const { tree, store } = ctx;
  switch (name) {
    case 'get_tree':          return tree;
    case 'get_node':          return getNodeByPath(tree, args.path);
    case 'list_cases':        return listCases(tree);
    case 'list_data_pages':   return listDataPages(tree);
    case 'get_operator':      return tree.children.find((n) => n.id === 'Operator') || null;
    case 'get_current_view': {
      const cv = tree.children.find((n) => n.id === 'CurrentView');
      // Empty CurrentView zone has no children yet; return null so callers can
      // distinguish "not identified" from "identified but no bindings".
      if (!cv || !cv.children || cv.children.length === 0) return null;
      return cv;
    }
    case 'list_snapshots':    return store.list();
    case 'get_snapshot':      return store.get(args.id);
    case 'diff_snapshots': {
      const a = store.get(args.a);
      const b = store.get(args.b);
      if (!a || !b) throw new Error('snapshot not found');
      return {
        a: { id: a.id, label: a.label },
        b: { id: b.id, label: b.label },
        ...diffTrees(a.tree, b.tree)
      };
    }
    case 'search_clipboard': {
      const ix = buildIndex(tree);
      const scope = args.scope || SCOPE.ALL;
      return runSearch(ix, args.query || '', { scope, currentCaseId: args.currentCaseId });
    }
    case 'get_field_binding':
      return getFieldBinding(tree, args.fieldName, { caseId: args.caseId });
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
