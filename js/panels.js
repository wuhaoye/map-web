/* 右侧面板:省份概况 + 同学详情 */
const Panels = {
  expandedProvince: null,

  init() {
    document.getElementById('panelTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      document.querySelectorAll('#panelTabs [data-tab]').forEach((t) => t.classList.toggle('active', t === tab));
      const show = tab.dataset.tab;
      document.getElementById('provincePanel').classList.toggle('hidden', show !== 'province');
      document.getElementById('detailPanel').classList.toggle('hidden', show !== 'detail');
      if (show === 'province') this.renderProvince();
      else this.renderDetail();
    });

    document.getElementById('provincePanel').addEventListener('click', (e) => {
      const expand = e.target.closest('[data-expand]');
      if (expand) {
        const p = expand.dataset.expand;
        this.expandedProvince = this.expandedProvince === p ? null : p;
        this.renderProvince();
        return;
      }
      const row = e.target.closest('[data-province]');
      if (row) {
        const p = row.dataset.province;
        State.filter.province = State.filter.province === p ? null : p;
        State.filter.cohort = null;
        State.filter.klass = null;
        Bus.emit('filter');
        // 移动端:点击省份筛选后收起抽屉,露出地图
        if (typeof Mobile !== 'undefined' && Mobile.isMobile()) Mobile.closeDrawers();
      }
    });

    document.getElementById('detailPanel').addEventListener('click', (e) => {
      // 定位按钮在 renderDetail 中直接绑定,这里无需其他操作
    });
  },

  /* ---------- 省份概况 ---------- */
  provinceStats() {
    const map = new Map();
    for (const s of State.students) {
      const p = (s.province || '').trim() || '未填写';
      if (!map.has(p)) map.set(p, { province: p, count: 0, unis: new Set(), cities: new Map() });
      const st = map.get(p);
      st.count++;
      if (s.university) st.unis.add(s.university);
      const city = (s.city || '').trim() || '未填写城市';
      const c = st.cities.get(city) || { count: 0, unis: new Set() };
      c.count++;
      if (s.university) c.unis.add(s.university);
      st.cities.set(city, c);
    }
    const list = [...map.values()]
      .map((st) => ({ ...st, cityCount: st.cities.size, uniCount: st.unis.size }))
      .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, 'zh-CN'));
    return list;
  },

  renderProvince() {
    const list = this.provinceStats();
    const located = State.students.filter((s) => s.lat != null).length;
    const unis = new Set(State.students.map((s) => s.university).filter(Boolean)).size;
    const max = list.length ? list[0].count : 1;

    let html = `
      <div class="pv-stats">
        <div class="pv-stat"><b>${State.students.length}</b><span>同学</span></div>
        <div class="pv-stat"><b>${located}</b><span>已定位</span></div>
        <div class="pv-stat"><b>${unis}</b><span>大学</span></div>
        <div class="pv-stat"><b>${list.length}</b><span>省份</span></div>
      </div>
      <div class="pv-title">省份分布 <span class="pv-sub">点击省份筛选地图</span></div>
      <div class="pv-list">`;

    for (const st of list) {
      const active = State.filter.province === st.province;
      const expanded = this.expandedProvince === st.province;
      html += `
        <div class="pv-row ${active ? 'active' : ''}" data-province="${U.esc(st.province)}">
          <div class="pv-bar-bg"><div class="pv-bar" style="width:${Math.max(2, Math.round((st.count / max) * 100))}%"></div></div>
          <span class="pv-name">${U.esc(st.province)}</span>
          <span class="pv-count">${st.count}</span>
          <span class="pv-extra">${st.uniCount} 校 / ${st.cityCount} 城</span>
          <button class="pv-expand" data-expand="${U.esc(st.province)}" title="查看城市明细">${expanded ? '▾' : '▸'}</button>
        </div>`;
      if (expanded) {
        const cities = [...st.cities.entries()].sort((a, b) => b[1].count - a[1].count);
        html += `<div class="pv-city-list">`;
        for (const [city, c] of cities) {
          html += `<div class="pv-city">
            <span class="pv-city-name">${U.esc(city)}</span>
            <span class="pv-city-count">${c.count} 人 · ${c.unis.size} 校</span>
          </div>`;
        }
        html += `</div>`;
      }
    }
    html += `</div>`;
    document.getElementById('provincePanel').innerHTML = html;
  },

  /* ---------- 同学详情 ---------- */
  renderDetail() {
    const el = document.getElementById('detailPanel');
    const s = findStudent(State.selectedId);
    if (!s) {
      el.innerHTML = `<div class="empty-hint">点击地图标记或左侧列表中的同学查看详情</div>`;
      return;
    }
    const rows = [
      ['姓名', s.name],
      ['性别', s.gender || '-'],
      ['届', U.cohortText(s.cohort)],
      ['班', s.klass || '-'],
      ['大学', s.university || '-'],
      ['城市', s.city || '-'],
      ['省份', s.province || '-'],
      ['地址', s.address || '-'],
      ['手机', s.phone || '-'],
      ['微信/QQ', s.wechat || '-'],
      ['邮箱', s.email || '-'],
      ['定位', s.lat != null ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : '未定位'],
      ['备注', s.note || '-'],
      ['更新时间', U.fmtDate(s.updatedAt)]
    ];
    el.innerHTML = `
      <div class="dt-head">
        <span class="stu-avatar big g-${s.gender === '男' ? 'm' : (s.gender === '女' ? 'f' : 'n')}">${U.esc((s.name || '?').slice(0, 1))}</span>
        <div>
          <div class="dt-name">${U.esc(s.name)}</div>
          <div class="dt-sub">${U.esc(s.university || '未填写大学')}</div>
        </div>
      </div>
      <div class="dt-actions">
        <button class="btn ghost" data-act="locate">📍 定位到地图</button>
      </div>
      <div class="dt-rows">
        ${rows.map(([k, v]) => `<div class="dt-row"><span class="dt-k">${U.esc(k)}</span><span class="dt-v">${U.esc(v)}</span></div>`).join('')}
      </div>`;
    // 定位按钮
    el.querySelector('[data-act="locate"]').onclick = () => {
      if (s.lat == null) { toast('该同学尚未设置坐标', 'warn'); return; }
      MapView.panTo(s.id);
    };
  },

  clearDetail() {
    State.selectedId = null;
    this.renderDetail();
  }
};
