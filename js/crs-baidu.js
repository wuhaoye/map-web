/* 百度地图 CRS + 瓦片层
 * 百度瓦片:墨卡托 y_m 从赤道向北递增(椭球 a=6378206),服务器行号 = floor(y_m/(256*res)),行 0 = 赤道。
 * 关键:若用 YMAX(πa)做翻转锚点,由于 YMAX 不是瓦片跨度 2^(26-z) 的整数倍,像素网格与服务器网格会错位;
 * 取 K = 3*2^23 = 25165824(对 z>=3 的所有瓦片跨度整除),投影 y' = K - y_m,
 * 则 Leaflet 行 r 与服务器行 K/span - 1 - r 逐像素精确对齐(z>=3)。
 * 已用百度官方逆地理接口(qt=rgc)与全列瓦片内容分布双重验证。
 */
(function () {
  if (typeof L === 'undefined') return;

  const A = 6378206;
  const B = 6356584.314245179;
  const E = Math.sqrt(1 - (B * B) / (A * A));
  const K = 25165824; // 3 * 2^23,与百度瓦片网格对齐的投影锚点
  const XMAX = Math.PI * A;
  const PI = Math.PI;

  function mercY(latDeg) {
    const lat = (latDeg * PI) / 180;
    const eSin = E * Math.sin(lat);
    return A * Math.log(Math.tan(PI / 4 + lat / 2) * Math.pow((1 - eSin) / (1 + eSin), E / 2));
  }

  function invMercY(y) {
    const t = Math.exp(y / A);
    let lat = 2 * Math.atan(t) - PI / 2;
    for (let i = 0; i < 6; i++) {
      const eSin = E * Math.sin(lat);
      lat = 2 * Math.atan(t * Math.pow((1 + eSin) / (1 - eSin), E / 2)) - PI / 2;
    }
    return (lat * 180) / PI;
  }

  const projection = {
    project(latlng) {
      const x = (A * latlng.lng * PI) / 180;
      return new L.Point(x, K - mercY(latlng.lat));
    },
    unproject(point) {
      const lng = (point.x * 180) / (A * PI);
      return new L.LatLng(invMercY(K - point.y), lng);
    },
    bounds: L.bounds([0, 0], [XMAX, K])
  };

  L.CRS.Baidu = L.extend({}, L.CRS, {
    code: 'EPSG:900913',
    projection: projection,
    transformation: new L.Transformation(1, 0, 1, 0),
    scale: function (zoom) { return Math.pow(2, zoom - 18); },
    zoom: function (scale) { return Math.log(scale) / Math.LN2 + 18; },
    infinite: false,
    // 注意:必须为 falsy。Leaflet GridLayer 会检查 wrapLng 真值并按 wrapLng[0]/[1] 计算环绕边界,
    // 空数组 [] 是真值,会导致 project([0, undefined]) 崩溃。
    wrapLng: false,
    wrapLat: false,
    // 基础实现会按 wrapLng 取模,必须恒等
    wrapLatLng: function (latlng) { return latlng; },
    distance: L.CRS.Earth.distance,
    R: A
  });

  L.TileLayer.Baidu = L.TileLayer.extend({
    getTileUrl: function (coords) {
      const z = this._getZoomForUrl();
      const rows = K / (256 * Math.pow(2, 18 - z)); // = 3 * 2^(z-3),整数
      const y = rows - 1 - coords.y;
      const data = { s: this._getSubdomain(coords), x: coords.x, y: y, z: z };
      return L.Util.template(this._url, L.extend(data, this.options));
    }
  });

  L.tileLayer.baidu = function (url, options) {
    return new L.TileLayer.Baidu(url, options);
  };
})();
