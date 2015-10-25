(function() {
  var DimdalPathfinder, MesaRd, OceanPkwy, WGS84RasterUtil, bounds, boundsExtent, canvas, config, context, corner, id, image, imageData, imageLoaded;

  DimdalPathfinder = require('../');

  WGS84RasterUtil = require('wgs84-raster-util');

  config = require('./config.json');

  bounds = require('./data/bolinas-lagoon-bounds.json');

  id = 'canvas';

  canvas = document.getElementById(id);

  context = canvas.getContext('2d');

  imageData = null;

  corner = {
    SW: 0,
    NW: 1,
    NE: 2,
    SE: 3
  };

  boundsExtent = [bounds.geometry.coordinates[0][corner.SW][0], bounds.geometry.coordinates[0][corner.SW][1], bounds.geometry.coordinates[0][corner.NE][0], bounds.geometry.coordinates[0][corner.NE][1]];

  MesaRd = {
    "type": "Point",
    "coordinates": [-122.712953, 37.918198]
  };

  OceanPkwy = {
    "type": "Point",
    "coordinates": [-122.70844, 37.89680]
  };

  imageLoaded = function(event) {
    var end, image, pathfinder, scale, start;
    scale = 3;
    image = event.target;
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    imageData = context.getImageData(0, 0, 1, 1);
    pathfinder = new DimdalPathfinder(config);
    start = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, OceanPkwy);
    end = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, MesaRd);
    return pathfinder.findPath(start.coordinates, end.coordinates).then(function(coordinates) {
      var coord, i, len, results;
      results = [];
      for (i = 0, len = coordinates.length; i < len; i++) {
        coord = coordinates[i];
        imageData.data[0] = 0;
        imageData.data[1] = 0;
        imageData.data[2] = 0;
        imageData.data[3] = 255;
        results.push(context.putImageData(imageData, coord[0] * scale, coord[1] * scale));
      }
      return results;
    });
  };

  image = new Image();

  image.src = './data/features-bolinas-lagoon.png';

  image.onload = imageLoaded;

}).call(this);
