/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


if (typeof window === 'undefined') {
   isBrowser = false;
} else {
   isBrowser = true;
}

var work = require('webworkify');
var aStarFinderWorker = work(require('./AStarFinder.js'));
require('es6-promise').polyfill();

var isBrowser;

// represents how the node attributes
// are encoded in the array buffer
// values represent bits
var dataViewNodeLUT = {
   'bitOrder': [4, 2, 1, 1, 8],
   'props': ['terrainType', 'roadClass', 'visible', 'visibilityCalc', 'height']
};

var loadArrayBuffer = null;

function toArrayBuffer(buffer) {
   var ab = new ArrayBuffer(buffer.length);
   var view = new Uint8Array(ab);
   for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
   }
   return ab;
}

function DimdalPathfinder(options) {
   if (isBrowser) {
      var xhr = new XMLHttpRequest();

      loadArrayBuffer = new Promise(function(resolve, reject) {
         xhr.responseType = "arraybuffer";
         xhr.open("GET", options.memInit, true);
         xhr.send();

         xhr.onload = function(e) {
            resolve(this.response);
         };

         //resolve;
         xhr.onerror = reject;
      });
   } else {
      loadArrayBuffer = new Promise(function(resolve, reject) {
         var fs = require("fs");
         var buffer = fs.readFileSync(options.memInit);

         resolve(toArrayBuffer(buffer));
      });
   }

   dataViewNodeLUT.heightScaleFactor = options.heightScaleFactor;
   dataViewNodeLUT.maxHeightDiff = options.maxHeightDiff;
   dataViewNodeLUT.roadCost = options.roadLUT.cost;
   dataViewNodeLUT.terrainCost = options.terrainLUT.cost;
}

DimdalPathfinder.prototype.findPath = function(startCoord, endCoord) {
   return new Promise(function(resolve, reject) {
      aStarFinderWorker.postMessage({
         start: [startCoord[0], startCoord[1]],
         end: [endCoord[0], endCoord[1]]
      });

      loadArrayBuffer.then(function(response) {
         // copy ArrayBuffer metadata
         aStarFinderWorker.postMessage(dataViewNodeLUT);
         // transfer ArrayBuffer ownership
         aStarFinderWorker.postMessage(response, [response]);

      }, function(e) {
         reject(e);
      });

      aStarFinderWorker.addEventListener('message', function(e) {
         // check any error or no path found from worker
         resolve(e.data);
      });
   });
};

module.exports = DimdalPathfinder;
