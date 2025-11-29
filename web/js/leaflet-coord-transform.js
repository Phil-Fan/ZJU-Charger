/**
 * Leaflet 坐标转换库
 * 支持多种坐标系之间的转换：WGS-84、GCJ-02（火星坐标系）、BD-09（百度坐标系）
 * 解决国内地图坐标偏移问题
 * 
 * 参考: https://github.com/wandergis/leaflet-echarts
 * 参考: https://github.com/wandergis/coordtransform
 */

(function (window) {
    'use strict';

    // GCJ-02 坐标系定义
    L.CRS.GCJ02 = L.extend({}, L.CRS.Earth, {
        code: 'GCJ-02',
        projection: L.Projection.LonLat,
        transformation: new L.Transformation(1, 0, -1, 0),

        scale: function (zoom) {
            return 256 * Math.pow(2, zoom);
        }
    });

    // 高德地图瓦片图层
    L.TileLayer.Gaode = L.TileLayer.extend({
        options: {
            subdomains: ['1', '2', '3', '4'],
            attribution: '© 高德地图',
            maxZoom: 18,
            minZoom: 3
        },

        initialize: function (url, options) {
            options = L.setOptions(this, options);
            this._url = url;
        },

        getTileUrl: function (tilePoint) {
            this._url = this._url || 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
            var url = L.Util.template(this._url, L.extend({
                s: this._getSubdomain(tilePoint),
                x: tilePoint.x,
                y: tilePoint.y,
                z: this._getZoomForUrl()
            }, this.options));
            return url;
        }
    });

    L.tileLayer.gaode = function (url, options) {
        return new L.TileLayer.Gaode(url, options);
    };

    // WGS-84 转 GCJ-02 坐标转换函数
    // 参考: https://github.com/wandergis/coordtransform
    var PI = Math.PI;
    var a = 6378245.0; // 长半轴
    var ee = 0.00669342162296594323; // 偏心率平方

    function outOfChina(lng, lat) {
        // 判断是否在国内，不在国内不做偏移
        // 参考 Python 代码：return not (lng > 73.66 and lng < 135.05 and lat > 3.86 and lat < 53.55)
        return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
    }

    function transformLat(lng, lat) {
        var ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    function transformLng(lng, lat) {
        var ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
        return ret;
    }

    /**
     * WGS-84 转 GCJ-02
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.wgs84ToGcj02 = function (lng, lat) {
        if (outOfChina(lng, lat)) {
            return [lng, lat];
        }
        var dLat = transformLat(lng - 105.0, lat - 35.0);
        var dLng = transformLng(lng - 105.0, lat - 35.0);
        var radLat = lat / 180.0 * PI;
        var magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        var sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
        dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
        var mgLat = lat + dLat;
        var mgLng = lng + dLng;
        return [mgLng, mgLat];
    };

    /**
     * GCJ-02 转 WGS-84
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.gcj02ToWgs84 = function (lng, lat) {
        if (outOfChina(lng, lat)) {
            return [lng, lat];
        }
        var dLat = transformLat(lng - 105.0, lat - 35.0);
        var dLng = transformLng(lng - 105.0, lat - 35.0);
        var radLat = lat / 180.0 * PI;
        var magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        var sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
        dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
        var mgLat = lat + dLat;
        var mgLng = lng + dLng;
        return [lng * 2 - mgLng, lat * 2 - mgLat];
    };

    /**
     * BD-09 转 GCJ-02
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.bd09ToGcj02 = function (lng, lat) {
        var x = lng - 0.0065;
        var y = lat - 0.006;
        var z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * PI * 3000.0 / 180.0);
        var theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * PI * 3000.0 / 180.0);
        var gcjLng = z * Math.cos(theta);
        var gcjLat = z * Math.sin(theta);
        return [gcjLng, gcjLat];
    };

    /**
     * GCJ-02 转 BD-09
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.gcj02ToBd09 = function (lng, lat) {
        var z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * PI * 3000.0 / 180.0);
        var theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * PI * 3000.0 / 180.0);
        var bdLng = z * Math.cos(theta) + 0.0065;
        var bdLat = z * Math.sin(theta) + 0.006;
        return [bdLng, bdLat];
    };

    /**
     * BD-09 转 WGS-84（通过 GCJ-02）
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.bd09ToWgs84 = function (lng, lat) {
        var gcj02 = window.bd09ToGcj02(lng, lat);
        return window.gcj02ToWgs84(gcj02[0], gcj02[1]);
    };

    /**
     * WGS-84 转 BD-09（通过 GCJ-02）
     * @param {number} lng 经度
     * @param {number} lat 纬度
     * @returns {Array} [lng, lat]
     */
    window.wgs84ToBd09 = function (lng, lat) {
        var gcj02 = window.wgs84ToGcj02(lng, lat);
        return window.gcj02ToBd09(gcj02[0], gcj02[1]);
    };

})(window);
