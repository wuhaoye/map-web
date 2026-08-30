/* 坐标系转换工具 (UMD:渲染器走 window.CoordTransform,主进程走 require)
 * WGS84 <-> GCJ02(火星坐标) <-> BD09(百度坐标)
 * 存储统一使用 WGS84;高德/腾讯瓦片用 GCJ02,百度瓦片用 BD09。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CoordTransform = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PI = Math.PI;
  const A = 6378245.0;              // 克拉索夫斯基椭球长半轴
  const EE = 0.00669342162296594323; // 偏心率平方
  const X_PI = (PI * 3000.0) / 180.0;

  function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }

  function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
    return ret;
  }

  function wgs2gcj(lng, lat) {
    if (outOfChina(lng, lat)) return { lng, lat };
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
    return { lng: lng + dLng, lat: lat + dLat };
  }

  function gcj2wgs(lng, lat) {
    if (outOfChina(lng, lat)) return { lng, lat };
    // 迭代近似,精度足够
    const g = wgs2gcj(lng, lat);
    let wgsLng = lng * 2 - g.lng;
    let wgsLat = lat * 2 - g.lat;
    for (let i = 0; i < 3; i++) {
      const t = wgs2gcj(wgsLng, wgsLat);
      wgsLng += lng - t.lng;
      wgsLat += lat - t.lat;
    }
    return { lng: wgsLng, lat: wgsLat };
  }

  function gcj2bd(lng, lat) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
    return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 };
  }

  function bd2gcj(lng, lat) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) };
  }

  function wgs2bd(lng, lat) {
    return gcj2bd(wgs2gcj(lng, lat).lng, wgs2gcj(lng, lat).lat);
  }

  function bd2wgs(lng, lat) {
    return gcj2wgs(bd2gcj(lng, lat).lng, bd2gcj(lng, lat).lat);
  }

  return { outOfChina, wgs2gcj, gcj2wgs, gcj2bd, bd2gcj, wgs2bd, bd2wgs };
});
