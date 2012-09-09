/* Copyright (c) 2012 Daniel Richman. GNU GPL 3 */

/* The stuff below is messy in places. It's only temporary anyway ;-).
 * In particlar, avoid the later arguments to the data() function. */

var kill = true;
var loading = false;
var flight = false;
var page = 0;
var db = null;

function reset_ui() {
    $("#intro").hide();
    $("#flightlist").hide();
    $("#flightlist").empty();
    $("#graph").hide();
    $("#pie").hide();
    $("#daily").hide();
    $("#daily_timeranges").hide();
    $("#pie_list_container").hide();
    $("#pie_list").empty();
    $("#loading").hide();
    $("#error").hide();
    set_flightname(false);
    set_flightid("*");
    // Leave menu showing
}

function set_flightname(name) {
    for (var i = 1; i <= 4; i++) {
        if (name)
            $("#flightname" + i).text("for flight \"" + name + "\"");
        else
            $("#flightname" + i).text("");
    }

    if (!name) {
        $("#menu_pie").hide();
    } else {
        $("#menu_pie").show();
    }
}

function set_flightid(id) {
    $("#flight_id").text("ID: " + id);
}

function recent_flights() {
    if (kill || loading) return;

    reset_ui();
    $("#loading").show();
    loading = true;
    flight = false;

    db.view("payload_telemetry_stats/launch_time", {
        success: got_flights,
        error: error
    });
}

function all_pie() {
    if (kill || loading) return;
    data("receiver", true, got_pie, false, "all");
}

function pie(f) {
    if (kill || loading) return;
    data("flight_receiver", true, got_pie, f, "normal");
}

function daily(max_td) {
    if (kill || loading) return;
    data("time_uploaded_day", true, got_daily, false, max_td);
}

function flight_pie() {
    if (kill || loading) return;
    reset_ui();
    $("#loading").show();
    loading = true;
    db.view("payload_telemetry_stats/launch_time", {
        success: function (flight_data) {
            data("flight_receiver", 1, got_pie, false, flight_data);
        },
        error: error
    });
}

/* view: view name.
 * glvl: true for group=true, or group_level value.
 * func: func to call when data loaded.
 * _f: flight - if set, calls set_flightname/id and restricts startkey/endkey
 * arg: argument to pass to func */
function data(view, glvl, func, _f, arg) {
    reset_ui();
    $("#loading").show();
    loading = true;
    flight = _f;

    var opts = {error: error, reduce: true};
    opts.success = function(data) {
        func(data, arg);
    }

    if (glvl === true)
        opts.group = true;
    else
        opts.group_level = glvl;

    if (flight) {
        set_flightname(flight.name);
        set_flightid(flight._id);
        opts.startkey = [flight._id, null];
        opts.endkey = [flight._id, {}];
    }

    if (view === "time_uploaded_day" && arg !== null) {
        var t = Math.floor((new Date()).getTime() / (1000 * 3600 * 24));
        opts.startkey = t - arg;
    }

    db.view("payload_telemetry_stats/" + view, opts);
}

function got_flights(flight_data) {
    if (kill) return;
    loading = false;
    $("#loading").hide();

    var flights = {};

    var now = Math.round((new Date()).getTime() / 1000);

    for (var i = 0; i < flight_data.rows.length; i++) {
        var f = flight_data.rows[i].value;
        f._id = flight_data.rows[i].id;

        var elem = $("<div class='list_item' />");
        var info_elem = $("<div class='list_info' />");

        var name_elem = $("<div class='list_label' />");
        var extra_elem = $("<div class='list_extra' />");
        var id_elem = $("<span class='list_id' />");
        var td_elem = $("<span class='list_launchtime' />");

        var buttons_elem = $("<div class='list_buttons' />");
        var pie_elem = $("<div class='list_go'>Callsign pie</div>");

        name_elem.text(f.name);
        id_elem.text(f._id);
        td_elem.text(f.launch.time);

        (function (f) {
            pie_elem.click(function () {
                pie(f);
            });
        })(f);

        info_elem.append(name_elem);
        info_elem.append(extra_elem);
        extra_elem.append(id_elem);
        extra_elem.append(" ");
        extra_elem.append(td_elem);
        elem.append(info_elem);

        buttons_elem.append(pie_elem);
        elem.append(buttons_elem);

        $("#flightlist").append(elem);
    }

    $("#flightlist").show();
}

/* type is either "all", "normal" or an object: the result of a
 * launch_times (i.e., flights) view; in which case it's unpacked and then
 * type becomes "flight" */
function got_pie(data, type) {
    if (kill) return;
    loading = false;
    $("#loading").hide();

    var flight_names = {};
    if (type !== "all" && type !== "normal") {
        for (var i = 0; i < type.rows.length; i++) {
            var row = type.rows[i];
            flight_names[row.id] = row.value.name;
        }

        type = "flight";
    }

    data.rows.sort(function (a, b) {
        return (b.value - a.value);
    });

    var serieses = [];
    var real_labels = {};

    var te = $("<tr class='pie_list_title' />");
    te.append($("<td class='pie_list_label'>Callsign</td>"));
    te.append($("<td class='pie_list_number'>Lines</td>"));
    $("#pie_list").append(te);

    for (var i = 0; i < data.rows.length; i++) {
        var row = data.rows[i];
        var name;

        if (type === "all")
            name = row.key;
        else if (type === "normal")
            name = row.key[row.key.length - 1];
        else if (type === "flight") {
            var flight_id = row.key[0];
            if (!flight_names[flight_id])
                continue;
            name = flight_names[flight_id].name;
        }

        serieses.push({label: i, data: row.value,
                       color: serieses.length % 5});
        real_labels[i] = name;

        var e = $("<tr />");
        var a = $("<td class='pie_list_label' />");
        a.text(name);
        var b = $("<td class='pie_list_number' />");
        b.text(row.value);
        e.append(a);
        e.append(b);
        $("#pie_list").append(e);
    }

    $("#graph").show();
    $("#pie").show();
    $("#pie_list_container").show();

    var settings = {
        series: {
            pie: {
                show: true,
                radius: 1,
                label: {
                    show: true,
                    radius: 1,
                    formatter: function(label, series) {
                        var e = $("<div class='pie_label " +
                                  "pie_label_select' />");

                        var t = $("<div class='pie_label_name' />");
                        t.text(real_labels[label]);
                        if (real_labels[label].length > 10)
                            t.addClass("pie_label_smaller");
                        e.append(t);

                        var i = $("<div class='pie_label_info' />");
                        var p = Math.round(series.percent) + "%";
                        i.text(series.data[0][1] + " (" + p + ")");
                        e.append(i);

                        e.prop("id", "pie_label_" + label);
                        return $("<div />").append(e).html();
                    }
                }
            }
        },
        legend: {
            show: false
        },
        grid: {
            hoverable: true
        }
    };

    var p = $.plot($("#flot"), serieses, settings);
    // Get flot's updated objects with .percent, etc.
    serieses = p.getData();

    // Hide after plotting: flot needs them visible to positions them 
    for (var i = 0; i < serieses.length; i++) {
        var e = $("#pie_label_" + serieses[i].label);
        e.removeClass("pie_label_select");
        if (serieses[i].percent < 2)
            e.hide();
    }

    var hover_series = null;
    var hover_elem = null;
    var was_visible = false;
    $("#flot").bind("plothover", function (event, pos, item) {
        var change = (item && item.series.label !== hover_series);
        var remove = !item;

        if ((change || remove) && hover_series !== null) {
            hover_series = null;
            hover_elem.parent().css({"z-index": 0});
            hover_elem.removeClass("pie_label_select");
            if (!was_visible)
                hover_elem.hide();
        }

        if (change) {
            hover_series = item.series.label;
            hover_elem = $("#pie_label_" + item.series.label);

            was_visible = hover_elem.is(":visible");
            hover_elem.show();
            hover_elem.parent().css({"z-index": 1});
            hover_elem.addClass("pie_label_select");
        }
    });
}

function got_daily(data, arg) {
    if (kill) return;
    loading = false;
    $("#loading").hide();

    var series = [];

    for (var i = 0; i < data.rows.length; i++) {
        var row = data.rows[i];
        var time = row.key * 3600 * 24 * 1000;
        series.push([time, row.value]);
    }

    var settings =  {
        bars: {
            show: true,
            barWidth: 3600 * 24 * 1000
        },
        xaxis: {
            mode: "time"
        },
        legend: {
            show: false
        }
    };

    $("#graph").show();
    $("#daily").show();
    $("#daily_timeranges").show();

    var p = $.plot($("#flot"), [{data:series, color:3}], settings);
}

function show_intro(data) {
    if (kill) return;
    loading = false;
    $("#loading").hide();

    var count = data.rows[0].value;
    $("#totallines").text(count);

    $("#intro").show();
    $("#menu").show();
}

function error(msg) {
    reset_ui();
    kill = true;
    $("#menu").hide();
    $("#error").show();
    $("#error_info").text(msg);
}

$(document).ready(function () {
    var old_error = window.onerror;
    window.onerror = function (msg, url, line) {
        error(msg);
        if (old_error)
            old_error(msg, url, line);
    }

    $("#menu_list").click(recent_flights);
    $("#menu_all_pie").click(all_pie);
    $("#menu_flight_pie").click(flight_pie);
    $("#menu_pie").click(function () {
        pie(flight);
    });

    function daily_button(id, len) {
        $(id).click(function () {
            daily(len);
        });
    }
    daily_button("#menu_daily", 31 * 4);
    daily_button("#daily_week", 7);
    daily_button("#daily_month", 31);
    daily_button("#daily_fourm", 31 * 4);
    daily_button("#daily_year", 366);
    daily_button("#daily_all", null);

    kill = false;
    reset_ui();
    $("#menu").hide();
    $("#loading").show();
    loading = true;

    db = $.couch.db("habitat");

    db.view("payload_telemetry_stats/receiver", {
        reduce: true,
        group: false,
        error: error,
        success: show_intro
    });
});
