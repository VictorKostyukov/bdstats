// Copyright 2018 - drvcoin - All Rights Reserved

var Utils = {

  FormatSize : function(value) {
    if (typeof(value) == "undefined") {
      return "";
    } else if (typeof(value) == "string") {
      return value;
    }

    const sizeKB = 1024;
    const sizeMB = sizeKB * 1024;
    const sizeGB = sizeMB * 1024;
    const sizeTB = sizeGB * 1024;
    const sizePB = sizeTB * 1024;

    if (value <= 0) {
      return "0";
    } else if (value < sizeKB) {
      return value + "B";
    } else if (value < sizeMB) {
      return Math.round(value / sizeKB * 10) / 10 + "KB";
    } else if (value < sizeGB) {
      return Math.round(value / sizeMB * 10) / 10 + "MB";
    } else if (value < sizeTB) {
      return Math.round(value / sizeGB * 10) / 10 + "GB";
    } else if (value < sizePB) {
      return Math.round(value / sizeTB * 10) / 10 + "TB";
    } else {
      return Math.round(value / sizePB * 10) / 10 + "PB";
    }
  },


  CallApi : function(url, params, onComplete, onError) {
    var hasQuery = url.indexOf("?") >= 0;
    for (var key in params) {
      url += hasQuery ? "&" : "?";
      url += key + "=" + encodeURIComponent(params[key]);
      hasQuery = true;
    }

    $.ajax({
      url : url
    }).done(function(data) {
      if (typeof(data) != "string") {
        onComplete(data);
      } else {
        onComplete(JSON.parse(data));
      }
    }).fail(function(jqxhr, textStatus, error) {
      console.error(textStatus);
      if (onError) {
        onError(textStatus, error);
      } else {
        onComplete();
      }
    });
  },


  HtmlEscape : function(value) {
    return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};


function Dashboard() {
  this.stats = [];
  this.hosts = [];
  this.hostCount = 0;
  this.page = 1;
  this.query = null;

  this.pageSize = 20;
}


Dashboard.prototype.Init = function() {
  this.Render();

  var _this = this;

  var search = function(query) {
    if (typeof(query) == "string") {
      query = query.trim();
    }
    if (query === "") {
      query = null;
    }

    _this.query = query;
    _this.LoadHosts(query, 0, function() {
      _this.__RenderHosts();
      _this.__RenderPagination();
    });
  };

  $("#data-search-btn").click(function() {
    search($("#data-search").val());
  });

  $("#data-search").bind("enterKey", function() {
    search($("#data-search").val());
  });

  $("#data-search").keyup(function(e) {
    if (e.keyCode === 13) {
      $(this).trigger("enterKey");
    }
  });
};


Dashboard.prototype.LoadStatistics = function(onComplete) {
  var _this = this;
  Utils.CallApi("/api/stats/Hosts/GetStatistics", null, function(result) {
    if (result) {
      _this.stats = result;
    }

    onComplete();
  });
};


Dashboard.prototype.LoadHosts = function(query, offset, onComplete) {
  var args = {};

  if (query && query != "") {
    args.query = query;
  }

  var _this = this;
  _this.hosts = [];
  _this.hostCount = 0;
  _this.page = 1;
  Utils.CallApi("/api/stats/Hosts/GetHostCount", args, function(result) {
    if (result) {
      _this.hostCount = result;
    }

    if (offset) {
      args.offset = offset;
      _this.page = Math.ceil((offset + 1) / _this.pageSize);
    } else {
      offset = 0;
    }

    args.limit = _this.pageSize;

    Utils.CallApi("/api/stats/Hosts/SearchHosts", args, function(result) {
      if (result) {
        _this.hosts = result;
      }

      onComplete();
    });
  });
};


Dashboard.prototype.Render = function() {
  var _this = this;

  _this.LoadStatistics(function() {
    _this.__RenderCurrent();
    _this.__RenderStatistics();

    _this.LoadHosts(null, 0, function() {
      _this.__RenderHosts();
      _this.__RenderPagination();
    });
  });
};


Dashboard.prototype.__RenderCurrent = function() {
  var used = "";
  var total = "";
  if (this.stats && this.stats.length > 0) {
    var data = this.stats[0];
    if (this.stats.length > 1) {
      // Use the second latest data if possible because the latest data may not contain a full day yet
      data = this.stats[1];
    }
    used = Utils.FormatSize(data.reservedSize);
    total = Utils.FormatSize(data.totalSize);
  }

  $("#data-current-used").html(used);
  $("#data-current-total").html(total);
};


Dashboard.prototype.__RenderHosts = function() {
  var html = "";
  if (this.hosts) {
    for (let idx = 0; idx < this.hosts.length; ++idx) {
      html += "<tr";
      if (this.hosts[idx].ts < (Date.now() / 1000 - 24 * 60 * 60)) {
        html += ' class="text-muted"';
      }
      html += ">"
      html += "<td>" + Utils.HtmlEscape(this.hosts[idx].name) + "</td>";
      html += "<td>" + Utils.HtmlEscape(this.hosts[idx].endpoint) + "</td>";
      html += "<td>" + Utils.FormatSize(this.hosts[idx].availableSize) + "</td>";
      html += "<td>" + Utils.FormatSize(this.hosts[idx].totalSize) + "</td>";
      html += "<td>" + new Date(this.hosts[idx].ts * 1000).toLocaleString() + "</td>";
      html += "</tr>";
    }
  }

  $("#data-host-list").html(html);
  $("#data-host-count").html("" + this.hostCount);
};


Dashboard.prototype.__RenderStatistics = function() {
  if (!this.stats) {
    return;
  }

  var used = [];
  var total = [];
  var ts = [];

  for (let idx = this.stats.length - 1; idx > 0; --idx) {
    ts.push(this.stats[idx].ts * 1000);
    total.push(this.stats[idx].totalSize);
    used.push(this.stats[idx].reservedSize);
  }

  const colors = {
    blue: "rgb(54, 162, 235)",
    green: "rgb(75, 192, 192)",
    grey: "rgb(201, 203, 207)",
    orange: "rgb(255, 159, 64)",
    purple: "rgb(153, 102, 255)",
    red: "rgb(255, 99, 132)",
    yellow: "rgb(255, 205, 86)"
  };

  var ctx = document.getElementById("myChart");
  var myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ts,
      datasets: [{
        label: "Total",
        backgroundColor: colors.blue,
        borderColor: colors.blue,
        fill: false,
        data: total
      }, {
        label: "Used",
        backgroundColor: colors.red,
        borderColor: colors.red,
        fill: false,
        data: used
      }]
    },
    options: {
      responsive: true,
      scales: {
        xAxes: [{
          display: true,
          type: "time",
          position: "bottom",
          time: {
            displayFormats: {
              "day": "DD/MM"
            },
            tooltipFormat: "DD/MM",
            unit: "day"
          }
        }],
        yAxes: [{
          ticks: {
            beginAtZero: false,
            userCallback: function(value, index, values) {
              return Utils.FormatSize(value);
            }
          }
        }]
      },
      legend: {
        display: true
      },
      tooltips: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function(tooltipItem, chart) {
            var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || "";
            return datasetLabel + ": " + Utils.FormatSize(tooltipItem.yLabel);
          }
        }
      }
    }
  });
};


Dashboard.prototype.__RenderPagination = function() {
  var pageCount = Math.ceil(this.hostCount / this.pageSize);
  if (pageCount <= 1) {
    $("#data-host-list-pagination").html("");
    return;
  }

  var visibleCount = 5;

  var renderLink = function(idx, current, total, text) {
    var content = '';
    if (idx <= 0 || idx > total) {
      content += '<li class="page-item disabled">';
      content += '<span class="page-link">' + text + '</span>';
      content += '</li>';
    } else if (idx == current) {
      content += '<li class="page-item active">';
      content += '<span class="page-link">' + text;
      content += '<span class="sr-only">(current)</span>';
      content += '</span>';
      content += '</li>';
    } else {
      content += '<li class="page-item">';
      content += '<a class="page-link" href="javascript:void(0)" data="' + idx + '">' + text + '</a>';
      content += '</li>';
    }

    return content;
  };

  var html = "";
  html += renderLink(this.page - 1, this.page, pageCount, "&lt;");

  var startIndex = this.page - Math.floor(visibleCount / 2);
  var endIndex = this.page + Math.floor(visibleCount / 2);
  if (startIndex <= 0) {
    endIndex += (1 - startIndex);
    startIndex = 1;
  }
  if (endIndex > pageCount) {
    startIndex = Math.max(startIndex - (endIndex - pageCount), 1);
    endIndex = pageCount;
  }

  for (var i = startIndex; i <= endIndex; ++i) {
    html += renderLink(i, this.page, pageCount, i);
  }

  html += renderLink(this.page + 1, this.page, pageCount, "&gt;");

  $("#data-host-list-pagination").html(html);

  var _this = this;

  $(document).off("click", "#data-host-list-pagination a.page-link");
  $(document).on("click", "#data-host-list-pagination a.page-link", function() {
    var idx = parseInt($(this).attr("data"));
    _this.LoadHosts(_this.query, (idx - 1) * _this.pageSize, function() {
      _this.__RenderHosts();
      _this.__RenderPagination();
    });
  });
};

