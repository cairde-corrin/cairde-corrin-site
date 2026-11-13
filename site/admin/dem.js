// The height of a position, from the elevation grid tools/dem_clip.py cuts from Copernicus
// GLO-30 (site/admin/dem/copernicus-od.bin and .json): metres above Malin Head OD,
// bilinear between the four nearest cells, given to the nearest 5 m as every height on
// the site is. One copy, used by the build (a new stop's height, site/_includes/blocks.js)
// and by the editor (a photo's caption, site/admin/editor.js).
(function () {
  // meta: the .json; bytes: the .bin as an ArrayBuffer or Buffer
  function grid(meta, bytes) {
    var view = new DataView(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength);
    var at = function (r, c) { return view.getInt16((r * meta.cols + c) * 2, true) * meta.scale; };
    return {
      // metres above Malin Head OD, or null outside the grid
      height: function (lat, lon) {
        var x = (lon - meta.west) / meta.dx, y = (meta.north - lat) / meta.dy;
        if (!(x >= 0 && y >= 0 && x <= meta.cols - 1 && y <= meta.rows - 1)) return null;
        var x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, meta.cols - 1), y1 = Math.min(y0 + 1, meta.rows - 1);
        var fx = x - x0, fy = y - y0;
        return (at(y0, x0) * (1 - fx) + at(y0, x1) * fx) * (1 - fy) + (at(y1, x0) * (1 - fx) + at(y1, x1) * fx) * fy;
      },
      method: meta.method,
    };
  }
  function nearest5(m) { return 5 * Math.round(m / 5); }

  var api = { grid: grid, nearest5: nearest5 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CairdeDem = api;
})();
