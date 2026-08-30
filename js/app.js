/* 应用入口与全局装配 */
window.addEventListener('error', (e) => {
  try {
    console.error('[RE] ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || '') +
      ' STACK=' + (e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 5).join(' <- ') : 'none'));
  } catch (x) { /* noop */ }
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    console.error('[RJ] ' + ((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)));
  } catch (x) { /* noop */ }
});

const App = {
  booting: false,

  async boot() {
    if (this.booting) return;
    this.booting = true;

    try {
      const [students, settings] = await Promise.all([api.loadData(), api.loadSettings()]);
      State.students = Array.isArray(students) ? students : [];
      State.settings = settings || null;
    } catch (e) {
      console.error(e);
      toast('数据加载失败: ' + e.message, 'error');
      State.students = [];
      State.settings = { map: { provider: 'baidu' }, geocode: {}, view: { lat: 35.5, lng: 104.5, zoom: 5 } };
    }

    // 静态站点:纯展示,数据来自硬编码 SITE_DATA,不载入内置数据、不落盘
    MapView.init('map');
    window.__SMOKE_DBG = new URLSearchParams(location.search).has('smoke');
    MapView.applySettings(State.settings);
    Sidebar.init();
    Panels.init();
    this.wireEvents();

    document.getElementById('totalCount').textContent = `${State.students.length} 位同学`;
    Sidebar.render();
    Panels.renderProvince();
    Panels.clearDetail();
    MapView.render(filteredStudents(), null, true);

    api.onMenu((cmd) => this.handleMenu(cmd));
    if (typeof api.smokeReady === 'function' && new URLSearchParams(location.search).has('smoke')) {
      setTimeout(() => {
        api.smokeReady({
          provider: State.settings && State.settings.map ? State.settings.map.provider : '?',
          students: State.students.length,
          mapReady: !!MapView.map,
          baiduCRS: !!(window.L && L.CRS.Baidu && L.TileLayer.Baidu),
          coord: typeof CoordTransform !== 'undefined',
          markers: MapView.markers.size,
          treeItems: document.querySelectorAll('#tree .tree-item').length,
          provinceRows: document.querySelectorAll('#provincePanel .pv-row').length,
          listRows: document.querySelectorAll('#stuList .stu-row').length,
          staticMode: !!window.__CM_STATIC__
        });
      }, 6000);
    }
  },

  wireEvents() {
    Bus.on('data', () => {
      document.getElementById('totalCount').textContent = `${State.students.length} 位同学`;
      Sidebar.render();
      Panels.renderProvince();
      if (State.selectedId && !findStudent(State.selectedId)) {
        State.selectedId = null;
        Panels.clearDetail();
      }
      MapView.render(filteredStudents(), State.selectedId, false);
    });

    Bus.on('filter', () => {
      Sidebar.render();
      Panels.renderProvince();
      MapView.render(filteredStudents(), State.selectedId, true);
    });

    Bus.on('select', (id) => {
      State.selectedId = id;
      const s = findStudent(id);
      if (!s) return;
      MapView.highlight(id);
      Panels.renderDetail();
      // 移动端:选中后打开详情抽屉
      if (typeof Mobile !== 'undefined' && Mobile.isMobile()) Mobile.openDetail();
      if (s.lat != null) MapView.panTo(id);
    });

    Bus.on('settings', () => {
      MapView.applySettings(State.settings);
      MapView.render(filteredStudents(), State.selectedId, true);
      this.hookViewSave();
    });

    this.hookViewSave();
  },

  hookViewSave() {
    const save = U.debounce(async () => {
      if (!MapView.map || !State.settings) return;
      const c = MapView.map.getCenter();
      const wgs = MapView.toWgs(c);
      State.settings.view = { lat: wgs.lat, lng: wgs.lng, zoom: MapView.map.getZoom() };
      try { await api.saveSettings(State.settings); } catch (e) { /* 静默 */ }
    }, 1200);
    if (MapView.map) MapView.map.on('moveend zoomend', save);
  },

  handleMenu(cmd) {
    switch (cmd) {
      case 'search': document.getElementById('searchInput').focus(); break;
      case 'export': this.exportCsv(); break;
      case 'export-json': exportJsonBackup(); break;
      case 'settings': openSettingsDialog(); break;
      case 'open-data-dir': api.openDataDir(); break;
      case 'reset-view':
        if (MapView.map) {
          MapView.setDefaultView(State.settings);
          MapView.render(filteredStudents(), State.selectedId, true);
        }
        break;
    }
  },

  async exportCsv() {
    if (State.students.length === 0) { toast('暂无数据可导出', 'warn'); return; }
    const rows = [FIELDS.map((f) => f.label)];
    for (const s of State.students) rows.push(studentToRow(s));
    const csv = U.buildCsv(rows);
    const r = await api.exportCsv(`同学录-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    if (r && !r.canceled && r.path) {
      const isStatic = window.__CM_MODE__ === 'static';
      toast(isStatic
        ? '已生成导出内容,请在弹窗中下载或复制'
        : `已导出 ${State.students.length} 条到 ${r.path}`, 'info');
    } else if (r && r.error) toast('导出失败: ' + r.error, 'error');
  }
};

async function exportJsonBackup() {
  if (State.students.length === 0) { toast('暂无数据可导出', 'warn'); return; }
  const payload = JSON.stringify({
    app: 'classmates-map',
    version: 1,
    exportedAt: new Date().toISOString(),
    students: State.students
  }, null, 2);
  const r = await api.exportJson(payload);
  if (r && !r.canceled && r.path) {
    const isStatic = window.__CM_MODE__ === 'static';
    toast(isStatic ? 'JSON 备份内容已生成,请在弹窗中下载或复制' : 'JSON 备份已保存: ' + r.path, 'info');
  } else if (r && r.error) toast('导出失败: ' + r.error, 'error');
}

/* ---------- 轻提示 ---------- */
let toastTimer = null;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

/* ---------- 工具栏 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnExport').addEventListener('click', () => App.exportCsv());
  document.getElementById('btnSettings').addEventListener('click', () => openSettingsDialog());
  document.getElementById('btnResetView').addEventListener('click', () => {
    if (MapView.map) {
      MapView.setDefaultView(State.settings);
      MapView.render(filteredStudents(), State.selectedId, true);
    }
  });

  App.boot();
});
