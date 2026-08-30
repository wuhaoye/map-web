/* 左侧栏:按届/班分组树 + 同学列表 + 搜索 */
const Sidebar = {
  init() {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', U.debounce(() => {
      State.filter.search = input.value;
      Bus.emit('filter');
    }, 200));

    document.getElementById('tree').addEventListener('click', (e) => {
      const item = e.target.closest('[data-cohort]');
      if (!item) return;
      if (e.target.closest('.tree-arrow')) {
        item.classList.toggle('collapsed');
        return;
      }
      if (e.target.closest('[data-klass]')) {
        const klass = e.target.closest('[data-klass]').dataset.klass;
        State.filter.cohort = item.dataset.cohort;
        State.filter.klass = klass;
      } else {
        State.filter.cohort = item.dataset.cohort === '' ? null : item.dataset.cohort;
        State.filter.klass = null;
      }
      Bus.emit('filter');
      // 移动端:点击分组后收起抽屉,露出地图
      if (typeof Mobile !== 'undefined' && Mobile.isMobile()) Mobile.closeDrawers();
    });

    document.getElementById('stuList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-id]');
      if (row) Bus.emit('select', row.dataset.id);
    });
  },

  render() {
    const { cohort, klass, province, search } = State.filter;
    const hasFilter = cohort !== null || klass !== null || province !== null || (search || '').trim() !== '';

    // ---- 分组树 ----
    const groups = cohortGroups();
    let tree = `
      <div class="tree-item all ${cohort === null && klass === null ? 'active' : ''}" data-cohort="">
        <span class="tree-label">🗂 全部同学 <em>${State.students.length}</em></span>
      </div>`;
    for (const g of groups) {
      const active = cohort === g.name;
      tree += `
        <div class="tree-item cohort ${active ? 'active' : ''}" data-cohort="${U.esc(g.name)}">
          <span class="tree-arrow">▸</span>
          <span class="tree-label">🎓 ${U.esc(U.cohortText(g.name))} <em>${g.count}</em></span>
        </div>
        <div class="tree-classes">
          ${g.classes.map((c) => `
            <div class="tree-item klass ${active && klass === c.name ? 'active' : ''}"
                 data-cohort="${U.esc(g.name)}" data-klass="${U.esc(c.name)}">
              <span class="tree-label">· ${U.esc(c.name)} <em>${c.count}</em></span>
            </div>`).join('')}
        </div>`;
    }
    document.getElementById('tree').innerHTML = tree;

    // ---- 筛选提示 ----
    const chip = document.getElementById('filterChip');
    const parts = [];
    if (cohort !== null) parts.push(U.cohortText(cohort));
    if (klass !== null) parts.push(klass);
    if (province !== null) parts.push(province);
    if ((search || '').trim()) parts.push(`“${search.trim()}”`);
    if (hasFilter) {
      chip.style.display = 'flex';
      chip.innerHTML = `<span>筛选: ${U.esc(parts.join(' / '))}</span><button id="clearFilterBtn" class="btn mini">清除</button>`;
      document.getElementById('clearFilterBtn').onclick = () => {
        State.filter = { cohort: null, klass: null, province: null, search: '' };
        document.getElementById('searchInput').value = '';
        Bus.emit('filter');
      };
    } else {
      chip.style.display = 'none';
    }

    // ---- 同学列表 ----
    const list = filteredStudents();
    document.getElementById('listCount').textContent = list.length;
    const rows = list.map((s) => {
      const noLoc = s.lat == null;
      return `
        <div class="stu-row ${s.id === State.selectedId ? 'active' : ''}" data-id="${U.esc(s.id)}">
          <span class="stu-avatar g-${s.gender === '男' ? 'm' : (s.gender === '女' ? 'f' : 'n')}">${U.esc((s.name || '?').slice(0, 1))}</span>
          <span class="stu-info">
            <span class="stu-name">${U.esc(s.name)}${noLoc ? ' <i class="no-loc" title="未定位">未定位</i>' : ''}</span>
            <span class="stu-sub">${U.esc(s.university || '')}${s.city ? ' · ' + U.esc(s.city) : ''}</span>
          </span>
        </div>`;
    }).join('');
    document.getElementById('stuList').innerHTML =
      rows || `<div class="empty-hint">${State.students.length ? '没有符合条件的同学' : '暂无数据,请检查 data.csv'}</div>`;
  }
};
