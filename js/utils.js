/* 通用工具 */
const U = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  // 取字符串中首个四位年份,用于"届"排序
  yearOf(s) {
    const m = String(s || '').match(/(?:19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : 0;
  },

  // 届的规范化:去掉末尾"届"字
  normCohort(s) {
    return String(s || '').trim().replace(/届$/, '');
  },

  // 届的显示文本
  cohortText(s) {
    const c = U.normCohort(s);
    return c ? c + '届' : '-';
  },

  // 取首个数字(含中文数字),用于"班"排序
  numOf(s) {
    const m = String(s || '').match(/\d+|[零一二两三四五六七八九十]/);
    if (!m) return Infinity;
    const CN = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    return CN[m[0]] != null ? CN[m[0]] : parseInt(m[0], 10);
  },

  fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  buildCsv(rows) {
    return rows.map((r) => r.map((v) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }
};

/* 导入导出字段定义 */
const FIELDS = [
  { key: 'name', label: '姓名', aliases: ['姓名', 'name', '名字'] },
  { key: 'gender', label: '性别', aliases: ['性别', 'gender', 'sex'] },
  { key: 'cohort', label: '届', aliases: ['届', 'cohort', '年级', '毕业届', '毕业年份'] },
  { key: 'klass', label: '班', aliases: ['班', '班级', 'class', 'klass'] },
  { key: 'university', label: '大学', aliases: ['大学', '学校', 'university', 'school', '院校'] },
  { key: 'city', label: '城市', aliases: ['城市', 'city', '所在城市'] },
  { key: 'province', label: '省份', aliases: ['省份', '省', 'province'] },
  { key: 'address', label: '详细地址', aliases: ['地址', '详细地址', 'address'] },
  { key: 'lng', label: '经度', aliases: ['经度', 'lng', 'lon', 'longitude'] },
  { key: 'lat', label: '纬度', aliases: ['纬度', 'lat', 'latitude'] },
  { key: 'phone', label: '手机', aliases: ['手机', '电话', 'phone', 'tel', '手机号'] },
  { key: 'wechat', label: '微信/QQ', aliases: ['微信', 'wechat', 'qq', '微信号'] },
  { key: 'email', label: '邮箱', aliases: ['邮箱', 'email', 'mail'] },
  { key: 'note', label: '备注', aliases: ['备注', 'note', 'remark', '说明'] }
];

function studentToRow(s) {
  return FIELDS.map((f) => (f.key === 'lat' || f.key === 'lng')
    ? (s[f.key] == null ? '' : Number(s[f.key]).toFixed(6))
    : (s[f.key] ?? ''));
}
