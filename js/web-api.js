/* 静态站点 API:数据硬编码(来自 docs/js/site-data.js),只读,无落盘。
 * 站点为纯展示模式:没有添加/编辑/删除/导入,仅提供导出。
 */
(function () {
  if (window.api) {
    window.__CM_MODE__ = 'electron'; // 兼容旧环境,实际站点不会走到这里
    return;
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* 导出:弹窗展示全文 + 复制/下载 */
  function exportText(title, name, text, mime) {
    const modal = openModal(`
      <div class="modal-head"><h3>${U.esc(title)}</h3><button class="icon-btn" id="exClose">✕</button></div>
      <div class="modal-body">
        <div class="hint-line">下方为导出内容(${text.length} 字符),可全选复制后粘贴到微信/文件。</div>
        <textarea readonly style="width:100%;height:300px;margin-top:8px;padding:10px;border:1px solid #e3e8ef;border-radius:8px;font-size:12px;font-family:Consolas,monospace;resize:none">${U.esc(text)}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="exDl">📥 下载文件</button>
        <button class="btn primary" id="exCopy">📋 复制全部</button>
      </div>`, { width: 680, sticky: true });
    modal.querySelector('#exClose').onclick = closeModal;
    modal.querySelector('#exCopy').onclick = async () => {
      try {
        await copyText(text);
        toast('已复制到剪贴板', 'info');
      } catch (e) {
        toast('复制失败,请长按文本框手动全选', 'warn');
      }
    };
    modal.querySelector('#exDl').onclick = async () => {
      download(name, text, mime);
      toast('已开始下载', 'info');
    };
    return Promise.resolve({ canceled: false, path: name });
  }

  window.api = {
    loadData: () => Promise.resolve(JSON.parse(JSON.stringify(window.SITE_DATA || []))),
    saveData: () => Promise.resolve({ ok: true }), // 数据硬编码,只读
    loadSettings: () => Promise.resolve({
      map: { provider: 'baidu', tiandituKey: '', tiandituLayer: 'vec', customUrl: '', customSubdomains: '', customCrs: 'wgs84', customMaxZoom: 18, customAttribution: '' },
      view: { lat: 35.5, lng: 104.5, zoom: 5 }
    }),
    saveSettings: () => Promise.resolve({ ok: true }),
    exportCsv: (name, text) => exportText('导出 CSV', name, '\ufeff' + text, 'text/csv;charset=utf-8'),
    exportJson: (text) => exportText('导出 JSON 备份', '同学录备份.json', text, 'application/json'),
    openDataDir: () => { if (typeof toast === 'function') toast('数据硬编码在站点文件中', 'warn'); },
    appInfo: () => Promise.resolve({ ok: true, mode: 'static' }),
    smokeReady: (info) => console.log('[SMOKE-READY] ' + JSON.stringify(info)),
    onMenu: () => {}
  };
  window.__CM_MODE__ = 'static';
})();
