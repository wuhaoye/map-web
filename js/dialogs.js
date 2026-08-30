/* 弹窗:通用 modal + 设置(地图服务/导出)
 * 静态站点为只读展示,无添加/编辑/删除/导入功能。
 */
let modalCleanups = [];

function openModal(html, opts = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const width = opts.width || 680;
  overlay.innerHTML = `<div class="modal" style="max-width:${width}px">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay && !opts.sticky) closeModal();
  });
  document.addEventListener('keydown', escHandler);
  return overlay.querySelector('.modal');
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  document.removeEventListener('keydown', escHandler);
  for (const fn of modalCleanups) { try { fn(); } catch (e) { /* noop */ } }
  modalCleanups = [];
  document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
}

/* ================= 设置 ================= */
function openSettingsDialog() {
  const st = State.settings;
  const m = st.map;
  const providerRadios = Object.entries(PROVIDERS).map(([key, p]) => `
    <label class="prov-card ${m.provider === key ? 'checked' : ''}">
      <input type="radio" name="mapProvider" value="${key}" ${m.provider === key ? 'checked' : ''}>
      <span class="prov-label">${U.esc(p.label)}</span>
      <span class="prov-desc">${U.esc(p.desc)}</span>
    </label>`).join('');

  const modal = openModal(`
    <div class="modal-head"><h3>设置</h3><button class="icon-btn" id="stClose">✕</button></div>
    <div class="modal-body settings-body">
      <section>
        <h4>🗺 地图服务</h4>
        <div class="prov-grid">${providerRadios}</div>
        <div class="cond" data-cond="tianditu" ${m.provider === 'tianditu' ? '' : 'style="display:none"'}>
          <label>天地图 Key <input id="st_tdKey" value="${U.esc(m.tiandituKey)}" placeholder="tk= 后面的字符串"></label>
          <label>图层
            <select id="st_tdLayer">
              <option value="vec"${m.tiandituLayer === 'vec' ? ' selected' : ''}>矢量(道路标注)</option>
              <option value="img"${m.tiandituLayer === 'img' ? ' selected' : ''}>影像</option>
              <option value="img_cva"${m.tiandituLayer === 'img_cva' ? ' selected' : ''}>影像+道路标注</option>
            </select>
          </label>
        </div>
        <div class="cond" data-cond="custom" ${m.provider === 'custom' ? '' : 'style="display:none"'}>
          <label class="span2">瓦片 URL 模板 <input id="st_cUrl" value="${U.esc(m.customUrl)}" placeholder="https://host/{z}/{x}/{y}.png  ({s} 表示子域名)"></label>
          <label>子域名 <input id="st_cSub" value="${U.esc(m.customSubdomains)}" placeholder="如 abc 或 0123"></label>
          <label>坐标系
            <select id="st_cCrs">
              <option value="wgs84"${m.customCrs === 'wgs84' ? ' selected' : ''}>WGS84(OSM 类)</option>
              <option value="gcj02"${m.customCrs === 'gcj02' ? ' selected' : ''}>GCJ02(高德/腾讯类)</option>
              <option value="bd09"${m.customCrs === 'bd09' ? ' selected' : ''}>BD09(百度类)</option>
            </select>
          </label>
          <label>最大缩放 <input id="st_cMax" type="number" min="3" max="20" value="${m.customMaxZoom || 18}"></label>
        </div>
        <div class="hint-line">提示: 天地图 Key 可在 <b>tianditu.gov.cn</b> 免费申请(个人开发者可用);百度/高德/腾讯图源无需 Key 即可显示。地图服务选择仅在本次浏览中生效。</div>
      </section>

      <section class="danger-zone">
        <h4>📤 数据导出</h4>
        <div class="dz-actions">
          <button class="btn ghost" id="stExportCsv">导出 CSV</button>
          <button class="btn ghost" id="stExportJson">导出 JSON 备份</button>
        </div>
        <div class="hint-line">数据由 data.csv 生成并硬编码在站点中,导出仅用于本地留存/分享。</div>
      </section>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="stCancel">取消</button>
      <button class="btn primary" id="stSave">保存设置</button>
    </div>`, { width: 720 });

  modal.querySelector('#stClose').onclick = closeModal;
  modal.querySelector('#stCancel').onclick = closeModal;

  modal.querySelectorAll('input[name="mapProvider"]').forEach((r) => {
    r.addEventListener('change', () => {
      modal.querySelectorAll('.prov-card').forEach((c) => c.classList.toggle('checked', c.querySelector('input').checked));
      modal.querySelectorAll('.cond').forEach((c) => {
        c.style.display = c.dataset.cond === r.value ? '' : 'none';
      });
    });
  });

  modal.querySelector('#stExportCsv').onclick = () => { closeModal(); App.exportCsv(); };
  modal.querySelector('#stExportJson').onclick = () => { closeModal(); exportJsonBackup(); };

  modal.querySelector('#stSave').onclick = async () => {
    const provider = modal.querySelector('input[name="mapProvider"]:checked').value;
    const customUrl = modal.querySelector('#st_cUrl').value.trim();
    if (provider === 'custom' && !customUrl) {
      toast('自定义瓦片需要填写 URL 模板', 'warn');
      return;
    }
    if (provider === 'tianditu' && !modal.querySelector('#st_tdKey').value.trim()) {
      toast('天地图需要填写 Key(可到 tianditu.gov.cn 免费申请)', 'warn');
      return;
    }
    State.settings = {
      map: {
        provider,
        tiandituKey: modal.querySelector('#st_tdKey').value.trim(),
        tiandituLayer: modal.querySelector('#st_tdLayer').value,
        customUrl,
        customSubdomains: modal.querySelector('#st_cSub').value.trim(),
        customCrs: modal.querySelector('#st_cCrs').value,
        customMaxZoom: parseInt(modal.querySelector('#st_cMax').value, 10) || 18,
        customAttribution: ''
      },
      view: State.settings.view
    };
    await api.saveSettings(State.settings);
    closeModal();
    Bus.emit('settings');
    toast('地图服务已切换(本次浏览有效)');
  };
}
