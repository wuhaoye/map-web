/* 移动端交互:抽屉面板/工具栏切换(桌面端这些按钮默认隐藏,布局不受影响) */
const Mobile = {
  isMobile() {
    return window.innerWidth < 900;
  },

  init() {
    const btnMenu = document.getElementById('btnMenu');
    const btnPanel = document.getElementById('btnPanel');
    const backdrop = document.getElementById('mobileBackdrop');
    if (btnMenu) {
      btnMenu.addEventListener('click', () => {
        document.body.classList.toggle('sb-open');
        document.body.classList.remove('rp-open');
      });
    }
    if (btnPanel) {
      btnPanel.addEventListener('click', () => {
        document.body.classList.toggle('rp-open');
        document.body.classList.remove('sb-open');
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.body.classList.remove('sb-open', 'rp-open');
      });
    }
    window.addEventListener('resize', U.debounce(() => {
      if (!this.isMobile()) document.body.classList.remove('sb-open', 'rp-open');
    }, 150));
  },

  closeDrawers() {
    document.body.classList.remove('sb-open', 'rp-open');
  },

  /* 打开右侧抽屉并切到"同学详情"页签 */
  openDetail() {
    document.body.classList.remove('sb-open');
    document.body.classList.add('rp-open');
    const tab = document.querySelector('#panelTabs [data-tab="detail"]');
    if (tab) tab.click();
  }
};

document.addEventListener('DOMContentLoaded', () => Mobile.init());
