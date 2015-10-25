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
