(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var FibonacciHeap = require('fibonacciheap');
var CellRef = require('./cellref.js');
var Grid = require('./grid.js');

var NODE_STATUS = {
   retired: 0,
   notvisited: 1
};

var NUMEDGEDIRECTIONS = 8;
var AXISMOD = 1.0;
var DIAGMOD = Math.sqrt(2);

var walkEdgeDelta = [
[0, -1], // north 4
[1, -1], // northeast 5
[1, 0], // east 6
[1, 1], // southeast 7
[0, 1], // south 0
[-1, 1], // southwest 1
[-1, 0], // west 2
[-1, -1]]; // northwest 3

// index: edge
// value: opposite of index
var oppositeEdge = [
   4, 5, 6, 7, 0, 1, 2, 3
];

var ab = null;
var grid = null;
var dataViewNodeLUT = null;
var crBeg = null;
var crEnd = null;
var noroad;

// To walk an edge, with direction ed, all we then have to do
// is ‘add’ crWalkEdgeDelta[ed] to the source cell's CellRef.
function walkEdge(cellRef, edgeDirection) {
   var delta = walkEdgeDelta[edgeDirection];
   return new CellRef(cellRef.getX() + delta[0], cellRef.getY() + delta[1]);
}

function walkEdges(cellRef, edges) {
   var directions = [];

   for (var c = 0; c < edges.length; c++) {
      directions.push([cellRef.getX(), cellRef.getY()]);
      cellRef = walkEdge(cellRef, edges[c]);
   }

   return directions;
}

function heuristic(dx, dy) {
   return (DIAGMOD * Math.min(dx, dy)) + (AXISMOD * Math.abs(dx - dy));
}

function edgeCost(crSrcDst, edgeDir) {
   var cost, crDst;
   var crSrc = crSrcDst.crSrc;
   // walk to the destination cell index
   crSrcDst.crDst = crDst = walkEdge(crSrc, edgeDir);
   // border cell modifier, return infinity if outside out graph
   if (!crDst.isValid()) {
      return Infinity;
   }

   var srcNode = grid.getNodeAt(crSrc.getX(), crSrc.getY());
   var dstNode = grid.getNodeAt(crDst.getX(), crDst.getY());
   var srcNodeGroundCost = srcNode.roadClass !== noroad ? dataViewNodeLUT.roadCost[srcNode.roadClass] : dataViewNodeLUT.terrainCost[srcNode.terrainType];
   var dstNodeGroundCost = dstNode.roadClass !== noroad ? dataViewNodeLUT.roadCost[dstNode.roadClass] : dataViewNodeLUT.terrainCost[dstNode.terrainType];
   // scale height
   srcNode.height *= dataViewNodeLUT.heightScaleFactor;
   dstNode.height *= dataViewNodeLUT.heightScaleFactor;
   // apply road modifier
   /* if the source and the destination both have
    * road raster pixels differing from the noroad value,
    * then it is assumed that there is a
    * road connecting them. */
   if ((srcNode.roadClass !== noroad) && (dstNode.roadClass !== noroad)) {
      cost = dataViewNodeLUT.roadCost[srcNode.roadClass];
   } else if ((srcNodeGroundCost === "Infinity") || (dstNodeGroundCost === "Infinity")) {
      return Infinity;
      //} else if (Math.abs(srcNode.height - dstNode.height) > dataViewNodeLUT.maxHeightDiff) {
      // apply slope modifier
      //   return Infinity;
   } else {
      // road costs for the cell take precedence over terrain costs
      cost = srcNodeGroundCost + dstNodeGroundCost;
   }

   // apply visibility

   return cost;
}

function findPath(crBeg, crEnd) {
   var edgeDirection = [];
   var edges = [];
   var edgeIndex = 0;
   var nodes = [];
   var U;
   var crU = new CellRef();
   var crV;
   var V = new FibonacciHeap.Node();
   var crSrcDst = {};
   var PQ = new FibonacciHeap();
   var iV;
   var cost;
   var h;

   // set all nodes to notvisited
   for (var c = 0; c < grid.getSize(); c++) {
      nodes[c] = NODE_STATUS.notvisited;
   }

   V.value = {
      "cellRef": new CellRef()
   };

   // ‘heuristic’ estimate of the movement cost from the vertex to the Goal.
   h = heuristic(Math.abs(crBeg.getX() - crEnd.getX()), Math.abs(crBeg.getY() - crEnd.getY()));

   // function(key, value)
   U = PQ.insert(h, {
      "cellRef": crBeg,
      "g": 0
   });

   nodes[grid.indexOf(crBeg.getX(), crBeg.getY())] = U;

   // while there are still nodes to visit
   while (true) {
      U = PQ.extractMinimum();
      if (!U) {
         break;
      }

      crU = U.value.cellRef;
      crSrcDst.crSrc = crU;
      // if we're at the destination, then exit the while loop
      if (crU.equals(crEnd)) {
         cost = U.value.g;
         break;
      }

      // examine possible paths from U to its neighbors
      for (var edgeDir = 0; edgeDir < NUMEDGEDIRECTIONS; edgeDir++) {
         // compute new least cost path candidate
         cost = U.value.g + edgeCost(crSrcDst, edgeDir);
         crV = crSrcDst.crDst;

         // if it's off limits (e.g. outside the map), then skip it
         if (cost >= Infinity) {
            continue;
         }

         iV = grid.indexOf(crV.getX(), crV.getY());
         V = nodes[iV];

         if (V === NODE_STATUS.retired) {
            continue; // Can't improve it!
         }

         // first time,add to queue
         if (V === NODE_STATUS.notvisited) {
            edgeDirection[iV] = edgeDir;
            h = heuristic(Math.abs(crV.getX() - crEnd.getX()), Math.abs(crV.getY() - crEnd.getY()));
            // function(key, value)
            V = PQ.insert(cost, {
               "cellRef": crV,
               "g": cost
            });
            nodes[iV] = V;
            // can be improved!?
         } else if (cost <= V.value.g) {
            if (cost === V.value.g) {
               // To avoid biasing...
               if (Math.random() <= 0.5) {
                  edgeDirection[iV] = edgeDir;
               }

               continue;
            }

            edgeDirection[iV] = edgeDir;
            V.value.g = cost;
            // function(node, newKey)
            PQ.decreaseKey(V, cost);
         }
      }
   }

   if (crU.equals(crEnd)) {
      // construct the edge path by backtracking & reversing...
      crU = new CellRef(crEnd.getX(), crEnd.getY());

      while (true) {
         edges[edgeIndex] = edgeDirection[grid.indexOf(crU.getX(), crU.getY())];
         crU = walkEdge(crU, oppositeEdge[edges[edgeIndex]]);
         edgeIndex++;
         if (crU.equals(crBeg)) {
            break;
         }
      }
   }

   return walkEdges(crBeg, edges.reverse());
}

module.exports = function(self) {
   self.addEventListener('message', function(e) {
      var isArrayBuffer = e.data instanceof ArrayBuffer;
      if (e.data instanceof Object && !isArrayBuffer) {
         if (e.data.start && e.data.end) {
            crBeg = new CellRef(e.data.start[0], e.data.start[1]);
            crEnd = new CellRef(e.data.end[0], e.data.end[1]);
         }

         if (e.data.bitOrder && e.data.props) {
            dataViewNodeLUT = {};
            dataViewNodeLUT.bitOrder = e.data.bitOrder;
            dataViewNodeLUT.props = e.data.props;
            dataViewNodeLUT.heightScaleFactor = e.data.heightScaleFactor;
            dataViewNodeLUT.maxHeightDiff = e.data.maxHeightDiff;
            dataViewNodeLUT.roadCost = e.data.roadCost;
            dataViewNodeLUT.terrainCost = e.data.terrainCost;
            noroad = Math.pow(dataViewNodeLUT.bitOrder[dataViewNodeLUT.props.indexOf("roadClass")], 2) - 1;
         }
      } else if (isArrayBuffer) {
         ab = e.data;
      }
      // wait for ArrayBuffer, metadata, and start/end points
      if (ab && dataViewNodeLUT && crBeg && crEnd) {
         grid = new Grid(new DataView(ab), dataViewNodeLUT);
         self.postMessage(findPath(crBeg, crEnd));
      }

   }, false);
};

},{"./cellref.js":2,"./grid.js":3,"fibonacciheap":8}],2:[function(require,module,exports){
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function CellRef(xIn, yIn) {
   this.x = xIn;
   this.y = yIn;
}

CellRef.prototype.getX = function() {
   return this.x;
};

CellRef.prototype.getY = function() {
   return this.y;
};

CellRef.prototype.isValid = function() {
   return (this.x > 0) && (this.y > 0);
};

CellRef.prototype.equals = function(cellRef) {
   return (this.x === cellRef.x) && (this.y === cellRef.y);
};

CellRef.prototype.add = function(xIn, yIn) {
   this.x += xIn;
   this.y += yIn;
};

module.exports = CellRef;

},{}],3:[function(require,module,exports){
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function Grid(dataView, nodeAttributesLUT) {
   var bitsPerNode = 0;
   this.cells = dataView;
   this.nodeAttributes = nodeAttributesLUT;

   for (var c = 0; c < this.nodeAttributes.bitOrder.length; c++) {
      bitsPerNode += this.nodeAttributes.bitOrder[c];
   }

   this.bytesPerNode = bitsPerNode / 8;
   this.size = this.cells.byteLength / this.bytesPerNode;
   this.width = Math.sqrt(this.size);
}

Grid.prototype.extractNode = function(bytes) {
   var node = {};
   var bitPosition = 0;
   var bitWidth = 0;
   var bitmask;
   var byteMask = '11111111';

   for (var index = 0; index < this.nodeAttributes.props.length; index++) {
      bitWidth = this.nodeAttributes.bitOrder[index];
      bitmask = parseInt(byteMask.slice(0, bitWidth), 2);

      // zero-fill right shift to extract the property value
      node[this.nodeAttributes.props[index]] = bytes[Math.floor(bitPosition / 8)] >>> bitPosition & bitmask;

      bitPosition += bitWidth;
   }

   return node;
};

Grid.prototype.getSize = function() {
   return this.size;
};

Grid.prototype.getWidth = function() {
   return this.width;
};

Grid.prototype.getHeight = function() {
   return this.width;
};

Grid.prototype.indexOf = function(x, y) {
   return y * this.width + x;
};

Grid.prototype.indexOfByte = function(x, y) {
   return this.indexOf(x, y) * this.bytesPerNode;
};

Grid.prototype.getNodeAt = function(x, y) {
   var bytes = [];
   var startingByte = this.indexOfByte(x, y);

   // read each byte for this node into bytes
   for (var byte = 0; byte < this.bytesPerNode; byte++) {
      bytes[byte] = this.cells.getUint8(startingByte + byte);
   }

   return this.extractNode(bytes);
};

module.exports = Grid;

},{}],4:[function(require,module,exports){
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

},{"./AStarFinder.js":1,"es6-promise":7,"fs":5,"webworkify":9}],5:[function(require,module,exports){

},{}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   2.3.0
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$toString = {}.toString;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      var nextTick = process.nextTick;
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // setImmediate should be used instead instead
      var version = process.versions.node.match(/^(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)$/);
      if (Array.isArray(version) && version[1] === '0' && version[2] === '10') {
        nextTick = setImmediate;
      }
      return function() {
        nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertex() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertex();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFullfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = lib$es6$promise$$internal$$getThen(maybeThenable);

        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFullfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value);
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      var enumerator = this;

      enumerator._instanceConstructor = Constructor;
      enumerator.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (enumerator._validateInput(input)) {
        enumerator._input     = input;
        enumerator.length     = input.length;
        enumerator._remaining = input.length;

        enumerator._init();

        if (enumerator.length === 0) {
          lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
        } else {
          enumerator.length = enumerator.length || 0;
          enumerator._enumerate();
          if (enumerator._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(enumerator.promise, enumerator._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return lib$es6$promise$utils$$isArray(input);
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var enumerator = this;

      var length  = enumerator.length;
      var promise = enumerator.promise;
      var input   = enumerator._input;

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        enumerator._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var enumerator = this;
      var c = enumerator._instanceConstructor;

      if (lib$es6$promise$utils$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== lib$es6$promise$$internal$$PENDING) {
          entry._onerror = null;
          enumerator._settledAt(entry._state, i, entry._result);
        } else {
          enumerator._willSettleAt(c.resolve(entry), i);
        }
      } else {
        enumerator._remaining--;
        enumerator._result[i] = entry;
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var enumerator = this;
      var promise = enumerator.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        enumerator._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          enumerator._result[i] = value;
        }
      }

      if (enumerator._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, enumerator._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        if (!lib$es6$promise$utils$$isFunction(resolver)) {
          lib$es6$promise$promise$$needsResolver();
        }

        if (!(this instanceof lib$es6$promise$promise$$Promise)) {
          lib$es6$promise$promise$$needsNew();
        }

        lib$es6$promise$$internal$$initializePromise(this, resolver);
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection) {
        var parent = this;
        var state = parent._state;

        if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
          return this;
        }

        var child = new this.constructor(lib$es6$promise$$internal$$noop);
        var result = parent._result;

        if (state) {
          var callback = arguments[state - 1];
          lib$es6$promise$asap$$asap(function(){
            lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":6}],8:[function(require,module,exports){
/**
 * @license
 * js-data-structures <http://github.com/Tyriar/js-data-structures>
 * Copyright 2014 Daniel Imms <http://www.growingwiththeweb.com>
 * Released under the MIT license <http://github.com/Tyriar/js-data-structures/blob/master/LICENSE>
 */
'use strict';

/**
 * Creates a Fibonacci heap.
 *
 * @constructor
 * @param {function} customCompare An optional custom node comparison
 * function.
 */
var FibonacciHeap = function(customCompare) {
   this.minNode = undefined;
   this.nodeCount = 0;

   if (customCompare) {
      this.compare = customCompare;
   }
};

/**
 * Clears the heap's data, making it an empty heap.
 */
FibonacciHeap.prototype.clear = function() {
   this.minNode = undefined;
   this.nodeCount = 0;
};

FibonacciHeap.prototype.decreaseKey = function(node, newKey) {
   if (typeof node === 'undefined') {
      throw 'Cannot decrease key of non-existent node';
   }
   if (this.compare({
         key: newKey
      }, {
         key: node.key
      }) > 0) {
      throw 'New key is larger than old key';
   }

   node.key = newKey;
   var parent = node.parent;
   if (parent && this.compare(node, parent) < 0) {
      cut(node, parent, this.minNode, this.compare);
      cascadingCut(parent, this.minNode, this.compare);
   }
   if (this.compare(node, this.minNode) < 0) {
      this.minNode = node;
   }
};

FibonacciHeap.prototype.delete = function(node) {
   // This is a special implementation of decreaseKey that sets the
   // argument to the minimum value. This is necessary to make generic keys
   // work, since there is no MIN_VALUE constant for generic types.
   node.isMinimum = true;
   var parent = node.parent;
   if (parent) {
      cut(node, parent, this.minNode, this.compare);
      cascadingCut(parent, this.minNode, this.compare);
   }
   this.minNode = node;

   this.extractMinimum();
};

FibonacciHeap.prototype.extractMinimum = function() {
   var extractedMin = this.minNode;
   if (extractedMin) {
      // Set parent to undefined for the minimum's children
      if (extractedMin.child) {
         var child = extractedMin.child;
         do {
            child.parent = undefined;
            child = child.next;
         } while (child !== extractedMin.child);
      }

      var nextInRootList;
      if (this.minNode.next !== this.minNode) {
         nextInRootList = this.minNode.next;
      }
      // Remove min from root list
      removeNodeFromList(extractedMin);
      this.nodeCount--;

      // Merge the children of the minimum node with the root list
      this.minNode = mergeLists(nextInRootList, extractedMin.child,
         this.compare);
      if (nextInRootList) {
         this.minNode = nextInRootList;
         this.minNode = consolidate(this.minNode, this.compare);
      }
   }
   return extractedMin;
};

FibonacciHeap.prototype.findMinimum = function() {
   return this.minNode;
};


/**
 * Inserts a new key-value pair into the heap.
 *
 * @param {Object} key The key to insert.
 * @param {Object} value The value to insert.
 * @return {Node} node The inserted node.
 */
FibonacciHeap.prototype.insert = function(key, value) {
   var node = new Node(key, value);
   this.minNode = mergeLists(this.minNode, node, this.compare);
   this.nodeCount++;
   return node;
};

FibonacciHeap.prototype.isEmpty = function() {
   return this.minNode === undefined;
};

FibonacciHeap.prototype.size = function() {
   if (this.isEmpty()) {
      return 0;
   }
   return getNodeListSize(this.minNode);
};

// Union another fibonacci heap with this one
FibonacciHeap.prototype.union = function(other) {
   this.minNode = mergeLists(this.minNode, other.minNode, this.compare);
   this.nodeCount += other.nodeCount;
};

FibonacciHeap.prototype.compare = function(a, b) {
   if (a.key > b.key) {
      return 1;
   }
   if (a.key < b.key) {
      return -1;
   }
   return 0;
};

function cut(node, parent, minNode, compare) {
   removeNodeFromList(node);
   parent.degree--;
   if (node.next === node) {
      parent.child = undefined;
   } else {
      parent.child = node.next;
   }
   minNode = mergeLists(minNode, node, compare);
   node.isMarked = false;
   return minNode;
}

function cascadingCut(node, minNode, compare) {
   var parent = node.parent;
   if (parent) {
      if (node.isMarked) {
         minNode = cut(node, parent, minNode, compare);
         minNode = cascadingCut(parent, minNode, compare);
      } else {
         node.isMarked = true;
      }
   }
   return minNode;
}

function consolidate(minNode, compare) {
   var aux = [];
   var it = new NodeListIterator(minNode);
   while (it.hasNext()) {
      var current = it.next();

      // If there exists another node with the same degree, merge them
      while (aux[current.degree]) {
         if (compare(current, aux[current.degree]) > 0) {
            var temp = current;
            current = aux[current.degree];
            aux[current.degree] = temp;
         }
         linkHeaps(aux[current.degree], current, compare);
         aux[current.degree] = undefined;
         current.degree++;
      }

      aux[current.degree] = current;
   }

   minNode = undefined;
   for (var i = 0; i < aux.length; i++) {
      if (aux[i]) {
         // Remove siblings before merging
         aux[i].next = aux[i];
         aux[i].prev = aux[i];
         minNode = mergeLists(minNode, aux[i], compare);
      }
   }
   return minNode;
}

function removeNodeFromList(node) {
   var prev = node.prev;
   var next = node.next;
   prev.next = next;
   next.prev = prev;

   node.next = node;
   node.prev = node;
}

function linkHeaps(max, min, compare) {
   removeNodeFromList(max);
   min.child = mergeLists(max, min.child, compare);
   max.parent = min;
   max.isMarked = false;
}

// Merges two lists and returns the minimum node
function mergeLists(a, b, compare) {
   if (!a && !b) {
      return undefined;
   }
   if (!a) {
      return b;
   }
   if (!b) {
      return a;
   }

   var temp = a.next;
   a.next = b.next;
   a.next.prev = a;
   b.next = temp;
   b.next.prev = b;

   return compare(a, b) < 0 ? a : b;
}

function getNodeListSize(node) {
   var count = 0;
   var current = node;

   do {
      count++;
      if (current.child) {
         count += getNodeListSize(current.child);
      }
      current = current.next;
   } while (current !== node);

   return count;
}

function Node(key, value) {
   this.key = key;
   this.value = value;
   this.prev = this;
   this.next = this;
   this.degree = 0;

   this.parent = undefined;
   this.child = undefined;
   this.isMarked = undefined;
   this.isMinimum = undefined;
}

FibonacciHeap.Node = Node;

// This Iterator is used to simplify the consolidate() method. It works by
// gathering a list of the nodes in the list in the constructor since the
// nodes can change during consolidation.
var NodeListIterator = function(start) {
   if (!start) {
      return;
   }

   this.items = [];
   var current = start;
   do {
      this.items.push(current);
      current = current.next;
   } while (start !== current);
};

NodeListIterator.prototype.hasNext = function() {
   return this.items.length > 0;
};

NodeListIterator.prototype.next = function() {
   return this.items.shift();
};

module.exports = FibonacciHeap;

},{}],9:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    
    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}]},{},[4]);
