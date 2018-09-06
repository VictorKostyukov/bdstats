#! /usr/bin/env node

(function() {

  function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  function ip() {
    function part() {
      return Math.floor(Math.random() * 1000) % 256;
    }
    return part() + "." + part() + "." + part() + "." + part();
  }

  function getActivityLog(response, startTime, endTime) {
    var result = [];

    var uuids = [];
    var ips = [];
    var sizes = [];

    const sizeGB = 1024 * 1024 * 1024;

    for (var idx = 0; idx < 100; ++idx) {
      uuids.push(guid());
      ips.push(ip());
      sizes.push(Math.floor(Math.random() * 1000 * sizeGB));
    }

    var uuidIdx = 0;
    for (var t = startTime; t < endTime; t += Math.floor(24 * 60 * 60 / uuids.length)) {
      if (uuidIdx >= uuids.length) {
        uuidIdx = 0;
      }

      result.push({
        ts : t,
        name : uuids[uuidIdx],
        type : "storage",
        totalSize : sizes[uuidIdx],
        reservedSize : Math.floor(Math.random() * 1000 * sizeGB) % sizes[uuidIdx],
        address : ips[uuidIdx]
      });

      ++uuidIdx;
    }

    response.json(result);
  };

  module.exports.handler = function(response, action, args) {
    switch (action) {
      case "GetActivityLog":
        getActivityLog(response, parseInt(args.startTime), parseInt(args.endTime));
        break;

      default:
        response.status(500).send("Action '" + action + "' not supported.");
    }
  };

}());

