/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var _ = require('lodash');
var Canvas = require('canvas-browserify');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var Color = require("color");
var getOSMTags = require('./get-osm-tags.js');
var terrainKey = 'natural';
var roadKey = 'highway';
/* jshint -W079 */
var Image = Canvas.Image;
var args = process.argv.slice(2);
var config = require(path.join(process.cwd(), args[0]));
var configRelative = path.relative(process.cwd(), path.dirname(args[0]));
var cwdPath = path.join(process.cwd(), configRelative);
var bounds = require(path.join(cwdPath, config.bounds));
var terrainClassLUT = config.terrainLUT;
var roadClassLUT = config.roadLUT;
var terrainColorLUT = config.terrainColorLUT;
var roadColorLUT = config.roadColorLUT;
var heightmap = new Image();
var arrayBuffer;
var cells;
var cellSize = 2; // each cell uses 2 bytes
var bytesPerPixel = 4;
var cellCount;
var canvas;
var context;
var img;

function toBuffer(ab) {
   var buffer = new Buffer(ab.byteLength);
   var view = new Uint8Array(ab);
   for (var i = 0; i < buffer.length; ++i) {
      buffer[i] = view[i];
   }

   return buffer;
}

function drawPixel(canvas, rgba, coordinates) {
   var color = Color(rgba).rgb();
   var context = canvas.getContext('2d');
   var imageData = context.createImageData(1, 1);

   imageData.data[0] = color.r;
   imageData.data[1] = color.g;
   imageData.data[2] = color.b;
   imageData.data[3] = color.a;

   // copy the image data back onto the canvas
   context.putImageData(imageData, coordinates[0], coordinates[1]);
}

function drawClassColor(classArray, classColorLUT, canvas) {
   var size = Math.sqrt(classArray.length);
   var layer = canvas || new Canvas(size, size);
   var context = layer.getContext('2d');
   var imageData = (canvas) ? context.getImageData(0, 0, size, size) : context.createImageData(size, size);
   var color;
   var rgb;
   var dataIndex;

   for (var c = 0; c < classArray.length; c++) {
      dataIndex = c * 4;
      rgb = classColorLUT.color[classArray[c]];

      if (!rgb.length) {
         continue;
      }

      color = Color(rgb).rgb();
      imageData.data[dataIndex] = color.r;
      imageData.data[dataIndex + 1] = color.g;
      imageData.data[dataIndex + 2] = color.b;
      imageData.data[dataIndex + 3] = 255;
   }

   // copy the image data back onto the canvas
   context.putImageData(imageData, 0, 0);

   return layer;
}

function writeCanvas(canvas, filename) {
   var out = fs.createWriteStream(path.join(cwdPath, filename));
   canvas.pngStream().pipe(out);
}

function initHeightmap(data) {
   heightmap.src = data;
}

function getRoadClass(tagIndex) {
   var tagName = roadClassLUT.class[tagIndex];
   var tagClassIndex = 3;

   if (roadClassLUT.small.indexOf(tagName) !== -1) {
      tagClassIndex = 0;
   } else if (roadClassLUT.medium.indexOf(tagName) !== -1) {
      tagClassIndex = 1;
   } else if (roadClassLUT.large.indexOf(tagName) !== -1) {
      tagClassIndex = 2;
   }
   return tagClassIndex;
}

function getPixelIndex(byteIndex, imgWidth) {
   return (byteIndex % imgWidth + byteIndex) / cellSize;
}

function generateMemInit(terrainClass, roadTag) {
   var buffer;
   // terrain class validation
   //writeCanvas(drawClassColor(terrainClass, terrainColorLUT), './data/terrain-class.png');
   // road class validation
   //writeCanvas(drawClassColor(roadTag, roadColorLUT), './data/road-class.png');
   // combined
   writeCanvas(drawClassColor(roadTag, roadColorLUT, drawClassColor(terrainClass, terrainColorLUT)), './data/features.png');

   roadTag = roadTag.map(getRoadClass);
   canvas = new Canvas(heightmap.width, heightmap.height);
   context = canvas.getContext('2d');
   context.drawImage(heightmap, 0, 0);
   img = context.getImageData(0, 0, heightmap.width, heightmap.height);

   cellCount = heightmap.width * heightmap.height;
   arrayBuffer = new ArrayBuffer(cellCount * cellSize);
   cells = new DataView(arrayBuffer);

   var firstByte = 0;
   //var pixelIndex = img.data.length / bytesPerPixel;
   var byteIndex;

   // foreach pixel in the heightmap
   for (var c = 0; c < img.data.length / bytesPerPixel; c++) {
      byteIndex = c * cellSize;
      //pixelIndex = getPixelIndex(byteIndex, heightmap.width);
      //   4 bits Terrain class
      firstByte = terrainClass[c];
      //   2 bits Road class
      firstByte |= (roadTag[c] << 4);

      //   1 bit Visible
      //firstByte |= ??? | 64;
      //   1 bit HaveVisCalc
      //firstByte |= ??? | 128;

      // write first byte of cell
      cells.setUint8(byteIndex, firstByte);
      // write last byte of cell
      cells.setUint8(byteIndex + 1, img.data[c * bytesPerPixel]);
   }

   buffer = toBuffer(arrayBuffer);

   fs.write(fs.openSync(path.join(cwdPath, config.memInit), 'w'), buffer, 0, buffer.length, 0, function(error) {
      if (error) {
         console.log(error);
         throw error;
      }
      console.log('Memory initialization file generated.');
   });
}

function getTags() {
   return getOSMTags({
         queryKey: terrainKey,
         bounds: bounds,
         tagList: terrainClassLUT.class,
         tagWeight: terrainClassLUT.cost,
         rasterDimensions: {
            width: heightmap.width,
            height: heightmap.height
         }
      })
      .then(function(terrainTagIndices) {
         return getOSMTags({
               queryKey: roadKey,
               bounds: bounds,
               tagList: roadClassLUT.class,
               tagWeight: roadClassLUT.weight,
               rasterDimensions: {
                  width: heightmap.width,
                  height: heightmap.height
               }
            })
            .then(function(roadTagIndices) {
               return [terrainTagIndices, roadTagIndices];
            });
      });
}

Q.nfcall(fs.readFile, path.join(cwdPath, config.heightmap)).done(function(data) {
   initHeightmap(data);

   getTags().spread(generateMemInit);
});
