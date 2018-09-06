#! /usr/bin/env node

var express = require("express");
var app = express();

app.all("/", function(request, response) {
  response.set("Content-Type", "text/html");
  response.sendFile("views/index.html", { root : __dirname });
});

app.use(express.static("public"));

var registerHandler = function(path, file) {
  app.get(path + "*", function(request, response) {
    var handlers = require(file);
    var action = request.path.substr(path.length);
    handlers.handler(response, action, request.query);
  });
};

registerHandler("/api/stats/Hosts/", "./handlers/Hosts.js");

// Fake server
registerHandler("/api/host/Kademlia/", "./handlers/Kademlia.js");

app.listen(7900, function() {
  console.log("Server started.\n");
});
