DimdalPathfinder = require('../')
WGS84RasterUtil = require('wgs84-raster-util')
config = require('./config.json')
bounds = require('./data/bolinas-lagoon-bounds.json')
id = 'canvas'
canvas  = document.getElementById(id)
context = canvas.getContext('2d')
imageData = null

corner =
   SW: 0
   NW: 1
   NE: 2
   SE: 3

boundsExtent = [bounds.geometry.coordinates[0][corner.SW][0], bounds.geometry.coordinates[0][corner.SW][1],
                bounds.geometry.coordinates[0][corner.NE][0], bounds.geometry.coordinates[0][corner.NE][1]]

MesaRd =
   "type": "Point"
   "coordinates": [
      -122.712953, 37.918198
   ]

OceanPkwy =
   "type": "Point"
   "coordinates": [
      -122.70844, 37.89680
   ]

imageLoaded = (event) ->
   scale = 3
   image = event.target
   context.scale(scale, scale)
   context.drawImage(image, 0, 0)

   imageData = context.getImageData(0, 0, 1, 1);

   pathfinder = new DimdalPathfinder(config)

   start = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, OceanPkwy)
   end = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, MesaRd)

   pathfinder.findPath(start.coordinates, end.coordinates).then (coordinates) ->
      for coord in coordinates
         imageData.data[0] = 0
         imageData.data[1] = 0
         imageData.data[2] = 0
         imageData.data[3] = 255
         # copy the image data back onto the canvas
         context.putImageData(imageData, coord[0] * scale, coord[1] * scale)

image = new Image()
image.src = './data/features-bolinas-lagoon.png'
image.onload = imageLoaded
