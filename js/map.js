/* 地图引擎:多服务商瓦片 + 坐标系适配 + 聚合标记 */
const PROVIDERS = {
  baidu: {
    label: '百度地图(道路)',
    desc: '免费无需 Key,中文标注',
    crs: 'baidu', convert: 'bd09',
    url: 'https://maponline{s}.bdimg.com/tile/?qt=vtile&x={x}&y={y}&z={z}&styles=pl&scaler=1&udt=20170908',
    subdomains: '0123', minZoom: 3, maxZoom: 18,
    attribution: '© 百度地图'
  },
  amap: {
    label: '高德地图(卫星影像)',
    desc: '免费无需 Key,卫星图无标注',
    crs: 'epsg3857', convert: 'gcj02',
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    subdomains: '1234', minZoom: 3, maxZoom: 18,
    attribution: '© 高德地图'
  },
  tencent: {
    label: '腾讯地图(道路)',
    desc: '免费无需 Key,中文标注',
    crs: 'epsg3857', convert: 'gcj02',
    url: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=1&version=117',
    subdomains: '0123', minZoom: 3, maxZoom: 18,
    attribution: '© 腾讯地图'
  },
  arcgis: {
    label: 'ArcGIS 街道图',
    desc: '免费无需 Key',
    crs: 'epsg3857', convert: 'wgs84',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: '', minZoom: 2, maxZoom: 18,
    attribution: '© Esri'
  },
  osm: {
    label: 'OpenStreetMap',
    desc: '免费无需 Key,国内访问可能较慢',
    crs: 'epsg3857', convert: 'wgs84',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc', minZoom: 2, maxZoom: 19,
    attribution: '© OpenStreetMap 贡献者'
  },
  tianditu: {
    label: '天地图',
    desc: '需在 tianditu.gov.cn 申请免费 Key',
    crs: 'epsg3857', convert: 'wgs84', needsKey: true,
    url: 'https://t{s}.tianditu.gov.cn/{layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER={layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={tk}',
    subdomains: '01234567', minZoom: 2, maxZoom: 18,
    attribution: '© 天地图'
  },
  custom: {
    label: '自定义瓦片',
    desc: '任意 XYZ 瓦片服务',
    crs: 'epsg3857', convert: 'wgs84',
    url: '', subdomains: '', minZoom: 2, maxZoom: 18,
    attribution: ''
  }
};

const MapView = {
  containerId: 'map',
  map: null,
  conf: null,
  cluster: null,
  markers: new Map(),
  overlay: null,

  init(containerId) {
    this.containerId = containerId || this.containerId;
  },

  buildConf(settings) {
    const m = settings.map || {};
    const base = PROVIDERS[m.provider] || PROVIDERS.baidu;
    const conf = Object.assign({}, base);
    if (m.provider === 'tianditu') {
      conf.tk = m.tiandituKey || '';
      conf.layer = m.tiandituLayer === 'img_cva' ? 'img' : (m.tiandituLayer || 'vec');
    }
    if (m.provider === 'custom') {
      conf.url = m.customUrl || '';
      conf.subdomains = m.customSubdomains || '';
      conf.convert = m.customCrs || 'wgs84';
      conf.maxZoom = m.customMaxZoom || 18;
      conf.attribution = m.customAttribution || '自定义瓦片';
    }
    return conf;
  },

  applySettings(settings) {
    const oldCenter = this.map ? this.map.getCenter() : null;
    const oldZoom = this.map ? this.map.getZoom() : null;
    if (this.map) { try { this.map.remove(); } catch (e) { /* noop */ } }
    this.markers.clear();

    const conf = this.buildConf(settings);
    this.conf = conf;
    const crs = conf.crs === 'baidu' ? L.CRS.Baidu : L.CRS.EPSG3857;

    this.map = L.map(this.containerId, {
      crs,
      zoomControl: true,
      attributionControl: true,
      minZoom: conf.minZoom || 3,
      maxZoom: conf.maxZoom || 18
    });

    // 必须先建立视图再添加图层,否则瓦片层 onAdd 时拿不到有效中心/缩放
    if (oldCenter && oldZoom) {
      this.map.setView(oldCenter, oldZoom, { animate: false });
    } else {
      this.setDefaultView(settings);
    }
    if (window.__SMOKE_DBG) {
      try {
        const c = this.map.getCenter();
        console.log('[DBG applySettings] size=', this.map.getSize(), 'zoom=', this.map.getZoom(),
          'center=', c.lat, c.lng, 'projCenter=', this.map.project(c, this.map.getZoom()));
      } catch (e) { console.log('[DBG applySettings] ERR', e.message); }
    }

    const baseOpts = {
      subdomains: conf.subdomains || 'abc',
      maxZoom: conf.maxZoom || 18,
      minZoom: conf.minZoom || 3,
      maxNativeZoom: conf.maxZoom || 18,
      attribution: conf.attribution || ''
    };
    if (!conf.subdomains) delete baseOpts.subdomains;
    if (conf.tk) baseOpts.tk = conf.tk;
    if (conf.layer) baseOpts.layer = conf.layer;
    if (conf.crs === 'baidu') {
      L.tileLayer.baidu(conf.url, baseOpts).addTo(this.map);
    } else if (conf.url) {
      L.tileLayer(conf.url, baseOpts).addTo(this.map);
    }

    // 天地图"影像+标注"叠加路网标注层
    if (settings.map && settings.map.provider === 'tianditu' &&
        settings.map.tiandituLayer === 'img_cva' && settings.map.tiandituKey) {
      this.overlay = L.tileLayer(conf.url, Object.assign({}, baseOpts, {
        layer: 'cva', attribution: ''
      })).addTo(this.map);
    }

    this.cluster = L.markerClusterGroup({
      maxClusterRadius: 64,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const size = n >= 100 ? 'lg' : (n >= 10 ? 'md' : 'sm');
        return L.divIcon({
          html: `<span class="cluster-badge ${size}">${n}</span>`,
          className: 'cluster-div',
          iconSize: L.point(0, 0)
        });
      }
    });
    this.map.addLayer(this.cluster);
  },

  setDefaultView(settings) {
    const v = (settings && settings.view) || { lat: 35.5, lng: 104.5, zoom: 5 };
    this.map.setView(this.toDisplay(v.lat, v.lng), v.zoom, { animate: false });
  },

  /* WGS84(存储) -> 显示坐标系 */
  toDisplay(lat, lng) {
    switch (this.conf && this.conf.convert) {
      case 'gcj02': {
        const p = CoordTransform.wgs2gcj(lng, lat);
        return L.latLng(p.lat, p.lng);
      }
      case 'bd09': {
        const p = CoordTransform.wgs2bd(lng, lat);
        return L.latLng(p.lat, p.lng);
      }
      default:
        return L.latLng(lat, lng);
    }
  },

  /* 显示坐标系 -> WGS84(存储) */
  toWgs(latlng) {
    switch (this.conf && this.conf.convert) {
      case 'gcj02': {
        const p = CoordTransform.gcj2wgs(latlng.lng, latlng.lat);
        return { lat: p.lat, lng: p.lng };
      }
      case 'bd09': {
        const p = CoordTransform.bd2wgs(latlng.lng, latlng.lat);
        return { lat: p.lat, lng: p.lng };
      }
      default:
        return { lat: latlng.lat, lng: latlng.lng };
    }
  },

  markerIcon(s, selected) {
    const colors = { '男': 'male', '女': 'female' };
    const cls = colors[s.gender] || 'na';
    return L.divIcon({
      html: `<span class="stu-pin ${cls}${selected ? ' sel' : ''}"><span class="pin-txt">${U.esc((s.name || '?').slice(0, 1))}</span></span>`,
      className: 'stu-pin-wrap',
      iconSize: [34, 40],
      iconAnchor: [17, 36],
      popupAnchor: [0, -36]
    });
  },

  render(students, selectedId, fit) {
    if (!this.map || !this.cluster) return;
    this.cluster.clearLayers();
    this.markers.clear();
    let count = 0;
    for (const s of students) {
      if (s.lat == null || s.lng == null || isNaN(s.lat) || isNaN(s.lng)) continue;
      const ll = this.toDisplay(s.lat, s.lng);
      const marker = L.marker(ll, { icon: this.markerIcon(s, s.id === selectedId) });
      marker.bindPopup(this.popupHtml(s), { maxWidth: 280, minWidth: 220 });
      marker.on('click', () => Bus.emit('select', s.id));
      this.markers.set(s.id, marker);
      this.cluster.addLayer(marker);
      count++;
    }
    if (fit) {
      if (count > 0) {
        const b = this.cluster.getBounds();
        if (b.isValid()) this.map.fitBounds(b, { padding: [48, 48], maxZoom: 15 });
      } else {
        this.setDefaultView(State.settings);
      }
    }
    return count;
  },

  popupHtml(s) {
    const loc = s.lat == null ? '未定位' : `${U.esc(s.province || '')}${U.esc(s.city || '')}`;
    return `
      <div class="pop">
        <div class="pop-name">${U.esc(s.name)}
          ${s.gender ? `<span class="pop-gender g-${s.gender === '男' ? 'm' : 'f'}">${U.esc(s.gender)}</span>` : ''}
        </div>
        <div class="pop-row">🏫 ${U.esc(s.university || '未填写大学')}</div>
        <div class="pop-row">📍 ${loc}</div>
        <div class="pop-row">🎓 ${U.esc(U.cohortText(s.cohort))} · ${U.esc(s.klass || '-')}</div>
        ${s.phone ? `<div class="pop-row">📱 ${U.esc(s.phone)}</div>` : ''}
        ${s.note ? `<div class="pop-note">${U.esc(s.note)}</div>` : ''}
      </div>`;
  },

  panTo(id) {
    const marker = this.markers.get(id);
    if (!marker || !this.map) return;
    this.cluster.zoomToShowLayer(marker, () => {
      setTimeout(() => { marker.openPopup(); }, 350);
    });
  },

  highlight(selectedId) {
    for (const [id, marker] of this.markers) {
      const s = findStudent(id);
      if (s) marker.setIcon(this.markerIcon(s, id === selectedId));
    }
  },

  invalidateSize() {
    if (this.map) setTimeout(() => this.map.invalidateSize(), 100);
  }
};
