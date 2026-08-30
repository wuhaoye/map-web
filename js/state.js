/* 全局状态与事件总线 */
const State = {
  students: [],
  settings: null,
  filter: { cohort: null, klass: null, province: null, search: '' },
  selectedId: null
};

const Bus = (() => {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
    },
    off(evt, fn) {
      if (map.has(evt)) map.get(evt).delete(fn);
    },
    emit(evt, data) {
      if (!map.has(evt)) return;
      for (const fn of [...map.get(evt)]) {
        try { fn(data); } catch (e) { console.error('[Bus]', evt, e); }
      }
    }
  };
})();

function filteredStudents() {
  const { cohort, klass, province, search } = State.filter;
  const q = (search || '').trim().toLowerCase();
  return State.students.filter((s) => {
    if (cohort !== null && s.cohort !== cohort) return false;
    if (klass !== null && s.klass !== klass) return false;
    if (province !== null && s.province !== province) return false;
    if (q) {
      const hay = [s.name, s.university, s.city, s.province, s.klass, s.cohort, s.phone, s.wechat, s.note]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function cohortGroups() {
  const groups = new Map();
  for (const s of State.students) {
    const c = U.normCohort(s.cohort) || '未填写届';
    if (!groups.has(c)) groups.set(c, new Map());
    const cls = groups.get(c);
    const k = (s.klass || '').trim() || '未填写班';
    cls.set(k, (cls.get(k) || 0) + 1);
  }
  const cohorts = [...groups.keys()].sort((a, b) => {
    const ya = U.yearOf(a), yb = U.yearOf(b);
    if (ya && yb && ya !== yb) return ya - yb;
    return a.localeCompare(b, 'zh-CN');
  });
  return cohorts.map((c) => {
    const classes = [...groups.get(c).keys()].sort((a, b) => {
      const na = U.numOf(a), nb = U.numOf(b);
      if (na !== nb) return na - nb;
      return a.localeCompare(b, 'zh-CN');
    }).map((k) => ({ name: k, count: groups.get(c).get(k) }));
    return { name: c, count: [...classes].reduce((s, x) => s + x.count, 0), classes };
  });
}

function findStudent(id) {
  return State.students.find((s) => s.id === id) || null;
}
