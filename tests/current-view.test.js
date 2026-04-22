import { t, eq, ok, report } from './_harness.js';
import { emptyTree, getNodeByPath, __setNowForTests } from '../src/state/clipboard.js';
import { pickCurrentView, mergeCurrentView } from '../src/state/current-view.js';

__setNowForTests(() => 1);

// ---- pickCurrentView --------------------------------------------------------

t('pickCurrentView: URL /views/<id> wins over everything', () => {
  const info = pickCurrentView({
    url: 'https://x/prweb/api/application/v2/cases/W-1/views/Perform',
    responseBody: { uiResources: { root: { config: { name: 'Review' } } } }
  });
  eq(info.viewId, 'Perform');
  ok(info.source.endsWith('/views/Perform'));
});

t('pickCurrentView: uiResources.root.config resolves view when URL is generic', () => {
  const info = pickCurrentView({
    url: 'https://x/prweb/api/application/v2/cases/W-1',
    responseBody: {
      uiResources: {
        root: {
          config: { name: 'Review', classID: 'MyCo-Work' },
          children: [
            { config: { value: '@P .Customer.Name' } },
            { config: { value: '.Customer.Email' } }
          ]
        }
      }
    }
  });
  eq(info.viewId, 'Review');
  eq(info.className, 'MyCo-Work');
  eq(info.bindings, ['Customer.Name', 'Customer.Email']);
});

t('pickCurrentView: data.uiResources alt placement', () => {
  const info = pickCurrentView({
    url: 'https://x/prweb/api/application/v2/assignments/A-1',
    responseBody: { data: { uiResources: { root: { config: { name: 'Approve' } } } } }
  });
  eq(info.viewId, 'Approve');
});

t('pickCurrentView: single-leaf resources.views fallback', () => {
  const info = pickCurrentView({
    url: 'https://x/prweb/api/application/v2/cases/W-1',
    responseBody: {
      uiResources: {
        resources: { views: { 'MyCo-Work': { 'Detail': {} } } }
      }
    }
  });
  eq(info.viewId, 'Detail');
  eq(info.className, 'MyCo-Work');
});

t('pickCurrentView: ambiguous resources.views → no pick', () => {
  const info = pickCurrentView({
    url: 'https://x',
    responseBody: { uiResources: { resources: { views: { A: { X: {}, Y: {} } } } } }
  });
  eq(info, null);
});

t('pickCurrentView: query-string viewID fallback', () => {
  const info = pickCurrentView({ url: 'https://x/prweb/api/application/v2/anything?viewID=Perform' });
  eq(info.viewId, 'Perform');
});

t('pickCurrentView: no signal → null', () => {
  eq(pickCurrentView({ url: 'https://google.com', responseBody: { foo: 1 } }), null);
  eq(pickCurrentView(null), null);
});

// ---- mergeCurrentView -------------------------------------------------------

t('mergeCurrentView: populates CurrentView subtree', () => {
  const tree = emptyTree();
  const info = {
    viewId: 'Perform',
    className: 'MyCo-Work',
    viewName: 'Perform',
    bindings: ['Customer.Name', 'Customer.Email'],
    source: 'https://x/prweb/api/application/v2/cases/W-1/views/Perform'
  };
  mergeCurrentView(tree, info);
  eq(getNodeByPath(tree, 'CurrentView.viewId').value, 'Perform');
  eq(getNodeByPath(tree, 'CurrentView.className').value, 'MyCo-Work');
  eq(getNodeByPath(tree, 'CurrentView.bindings(1)').value, 'Customer.Name');
  eq(getNodeByPath(tree, 'CurrentView.bindings(2)').value, 'Customer.Email');
});

t('mergeCurrentView: last-write-wins replaces previous view', () => {
  const tree = emptyTree();
  mergeCurrentView(tree, { viewId: 'First', bindings: ['a'], source: 'u1' });
  mergeCurrentView(tree, { viewId: 'Second', bindings: ['b', 'c'], source: 'u2' });
  eq(getNodeByPath(tree, 'CurrentView.viewId').value, 'Second');
  eq(getNodeByPath(tree, 'CurrentView.bindings(1)').value, 'b');
  eq(getNodeByPath(tree, 'CurrentView.bindings(2)').value, 'c');
  // First view's data is gone.
  eq(getNodeByPath(tree, 'CurrentView.bindings(3)'), null);
});

t('mergeCurrentView: no-op on missing tree or info', () => {
  eq(mergeCurrentView(null, { viewId: 'x' }), null);
  const tree = emptyTree();
  eq(mergeCurrentView(tree, null), null);
});

report('current-view');
