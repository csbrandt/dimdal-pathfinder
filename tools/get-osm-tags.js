/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var request = require('request');
var Q = require('q');
var osmtogeojson = require('osmtogeojson');
var buildQuery = require('osm-build-query');
var discretize = require('osm-discretize');

module.exports = function(options) {
   var deferred = Q.defer();

   var handleResponse = function(error, response, body) {
      var geojsonResult;

      if (!error && response.statusCode === 200) {
         console.log("Processing \"" + options.queryKey + "\" data...");
         geojsonResult = osmtogeojson(JSON.parse(body));
         deferred.resolve(discretize({
            rasterDimensions: options.rasterDimensions,
            bounds: options.bounds,
            tagList: options.tagList,
            tagWeight: options.tagWeight
         }, geojsonResult));
      } else if (error) {
         console.log(error);
         deferred.reject(new Error(error));
      } else if (response) {
         console.log(response);
         deferred.reject(new Error(response));
      } else {
         deferred.reject(new Error('Unknown error'));
      }
   };

   console.log("Requesting OSM data for \"" + options.queryKey + "\" key");

   request.post({
      url: 'http://overpass-api.de/api/interpreter',
      form: buildQuery(options.queryKey, options.bounds)
   }, handleResponse);

   return deferred.promise;
};
