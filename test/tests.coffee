expect = require('expect.js')
WGS84RasterUtil = require('wgs84-raster-util')
DimdalPathfinder = require('../')
config = require('./config.json')
bounds = require('./data/bolinas-lagoon-bounds.json')

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

corner =
   SW: 0
   NW: 1
   NE: 2
   SE: 3

boundsNWCornerCoord =
   "type": "Point"
   "coordinates": bounds.geometry.coordinates[0][corner.NW]

boundsSWCornerCoord =
   "type": "Point"
   "coordinates": bounds.geometry.coordinates[0][corner.SW]

boundsExtent = [bounds.geometry.coordinates[0][corner.SW][0], bounds.geometry.coordinates[0][corner.SW][1],
                bounds.geometry.coordinates[0][corner.NE][0], bounds.geometry.coordinates[0][corner.NE][1]]

pathfinder = null
start = null
end = null

describe 'DimdalPathfinder', ->

  beforeEach ->
    pathfinder = new DimdalPathfinder(config)
    start = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, OceanPkwy)
    end = WGS84RasterUtil.pointCell(boundsExtent, bounds.properties, MesaRd)

  it 'should instantiate with given config', ->
    expect(pathfinder).to.be.an(DimdalPathfinder)

  it 'should find a path between 2 points within the bounds', (done) ->
    pathfinder.findPath(start.coordinates, end.coordinates).then (coordinates) ->
      done()
      expect(coordinates.length).to.have.length.above(0)

  it 'should have start.coordinates as the first coordinate', (done) ->
    pathfinder.findPath(start.coordinates, end.coordinates).then (coordinates) ->
      done()
      expect(coordinates[0][0]).to.equal(start.coordinates[0][0])
      expect(coordinates[0][1]).to.equal(start.coordinates[0][1])

  it 'should have end.coordinates as the last coordinate', (done) ->
    pathfinder.findPath(start.coordinates, end.coordinates).then (coordinates) ->
      done()
      lastIndex = coordinates.length - 1
      expect(coordinates[lastIndex][0]).to.equal(end.coordinates[0][0])
      expect(coordinates[lastIndex][1]).to.equal(end.coordinates[0][1])
