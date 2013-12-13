(function(window, jQuery, undefined) {
    "use strict"
    var cache = {}, panZoom, mousePos, map, mapData, mapSlotSize, symbols, timer, isCityView = false;
    var $workspace, $form, $slider, $map, $sidebar, $notice, $toggleSymbols;

    function createMap() {
        // Stop auto-slide
        stopTimer();
        // Hides side bar
        $sidebar.addClass("hide");
        // Remove slot size to force data reload
        mapSlotSize = -1;
        // Show the right notice text
        $notice.removeClass("see-cities").addClass("see-countries");
        // Load the world map
        map.loadMap(window.__root__ + 'data/wor.svg', function(m) {
            // Resize the map to fit corectly to its parent
            resizeMap();
            // Set the map style/layers without lands layer
            defaultMapLayers(m);
            // Load the data once
            loadData();
            // Updates value using the slider
            $slider.off("valuesChanging").on("valuesChanging", loadData);
        });
    }

    function handleMousePosition(event) {
        var parentOffset = $(this).offset();
        event = event || window.event; // IE-ism
        mousePos = {
            x: event.pageX - parentOffset.left,
            y: event.pageY - parentOffset.top
        };
    }

    function getMousePosition() {
        return mousePos;
    }

    function loadData(callback) {

        var slotSize = getSlotSize();
        // Did the slot size change ?
        if(slotSize != mapSlotSize) {
            // Reset cache
            cache = {}
            // Enable loading mode
            $workspace.addClass("loading");

            mapSlotSize = slotSize;
            var params  = { slotSize: mapSlotSize };
            // Load the country
            $.getJSON(window.__root__ + "count/countries.json", params, function(countries) {
                // Load the cities
                $.getJSON(window.__root__ + "count/cities.json", params, function(cities) {
                    // Record the data
                    mapData = {
                        "countries": countries,
                        "cities":    cities
                    }
                    // Draw them on the map
                    updateMapSymbols();
                    // Callback function
                    if(typeof callback == "function") callback();
                });
            });

        // If not, just update the map
        } else {
            // Draw them on the map
            updateMapSymbols();
            // Callback function
            if(typeof callback == "function") callback();
        }
    }

    function loadCountrySidebar(place) {
        var country = place.iso2 || place.cy || place.lc || place;
        var slideValues = $slider.dateRangeSlider("values");
        // Creates the parameters object
        var params = {
            startYear : slideValues.min.getFullYear(),
            endYear   : slideValues.max.getFullYear(),
            country   : country
        };

        // Stop auto-slide
        stopTimer();

        // Save the country related to the sidebar
        $sidebar.data("country", country)

        // Load the sidebar html
        $.get(window.__root__ + "map/sidebar", params, function(data) {
            // Find the place to insert HTML
            $sidebar.find(".js-content").html(data)
            // Show the sidebar
            $sidebar.removeClass("hide");
        })
    }

    function getSlotSize() {

        var values = $slider.dateRangeSlider("values");
        var years = values.max.getFullYear() - values.min.getFullYear()

        return (years <= 0 ? 0 : years) + 1;
    }

    function createTooltip(meta) {

        if(meta.iso2) {
            var year = getMapYear()
            meta = _.findWhere(mapData[year], {lc: meta.iso2});
        }

        if(meta) {
            var city = meta.cy ? meta.lc + ", " : "",
            matches = "<br /><small>with <strong>%d</strong> occurrence(s)</small>".replace("%d", meta.ct);
            return city + meta.label + matches;
        } else {
            return false;
        }
    }

    function getMapYear() {
        return $slider.dateRangeSlider("values").min.getFullYear()
    }

    function getData(what, year) {
        var key = year + "-" + what;
        if(cache[key]) return cache[key];
        // Preload the next years
        if(year < 2010) getData(what, year+1);
        // Get the map mode (cities or countries)
        var what = getMapMode();
        // Choose the right dataset (countries or cities)
        var data = mapData[what];
        // Data we work with (with year)
        var rows = data[year] || {};

        var max = Math.max( _.max(rows, function(e) { return e.ct }).ct, 1)
        // Remove too tiny data according max value
        rows = _.filter(rows, function(e) { return e.ct > (max*0.01) })
        // Deduce the minimum value
        var min   = _.min(rows, function(e) { return e.ct }).ct
        var objs  = {}
        // Flatten this array
        _.each(rows, function(e) {
            objs[e.lc] = e
        })

        if(what == 'cities') {
            var scale = $K.scale.linear([min, max]).range([2, 40]);
        } else {
            var scale = new chroma.ColorScale({
                colors: ["#FFFFCC", "#A1DAB4", "#41B6C4", "#2C7FB8", "#253494",  "#3194AA"],
                limits: chroma.limits(objs, 'equal', 100, "ct")
            });
        }

        // Cache the value
        cache[key] = {
            min:        min,
            max:        max,
            rows:       objs,
            scale:      scale,
            what:       what
        }

        return cache[key]
    }

    function updateMapSymbols() {
        /**
         * Data strcuture:
         *     * dt := year
         *     * ct := count
         *     * lt := latitude
         *     * lg := longitude
         *     * lc := location (city or country)
         *     * cy := country (optional)
         */

        var data = getData( getMapMode(), getMapYear() );

        // Removes existing symbols
        if(symbols) {
            // Weird behavior : kartograph throw a warning when removing the symbols groups
            map.removeSymbols();
        }

        if(data.what == "cities") {

            symbols = map.addSymbols({
                type: $K.Bubble,
                data: data.rows,
                location: function(place) {
                    return [place.lg, place.lt];
                },
                radius: function(place) {
                    var r = data.scale(place.ct);
                    return isNaN(r) ? 0 : r;
                },
                sortBy: 'radius desc',
                style: function(place) {
                    return 'fill:#e09d8d; stroke: #fff; fill-opacity: 0.6;'
                },
                click: loadCountrySidebar,
                tooltip: createTooltip
            });


            map.getLayer('countries').style({
                fill: "#FFFFC6",
                stroke: "#FFFFC6"
            });

        } else {

            var fill = function(l, path) {
                var place = data.rows[l.iso2]
                return place ? data.scale.getColor(place["ct"]) : "#FFFFC6"
            };

            map.getLayer('countries').style({
                fill: fill,
                stroke: fill
            });
        }

        // Add tooltips
        map.getLayer('countries').tooltips(createTooltip).on('click', loadCountrySidebar);
        // Removes loading mode
        $workspace.removeClass("loading");
    }

    function defaultMapLayers(m) {

        // Checks that layers don't exist
        m.layer = m.layer || {};

        m.layer['lands'] || m.addLayer('countries', {
            name: 'lands',
            styles: {
                stroke: '#9FB3B7',
                fill: '#fff',
                'stroke-width': 2
            }
        });

        m.layer['countries'] || m.addLayer('countries', {
            name: 'countries',
            styles: {
                stroke: '#aaa',
                fill: '#fafafa',
                'stroke-width': 1
            }
        });



        panZoom = m.paper.panzoom();
        panZoom.enable();
    }

    function stopTimer() {
        timer.stop();
        $form.find(".btn-play").removeClass("pause");
    }

    function resizeMap() {

        // Do not resize the map until the disclaimer is close
        if( $map.find(".disclaimer").is(":visible") ) return;

        // var ratio = map.viewAB.width / map.viewAB.height;
        var ratio = 0.4, height = $map.width() * ratio;

        //var height = map.viewAB.height > $map.width() * 0.4 ? $map.width() * 0.4 : map.viewAB.height;
        $map.height(height);
        map.resize();
    }

    function closeDisclaimer() {
        // Avoid to recalculate the map size for nothing
        if( $map.find(".disclaimer").is(":visible") ) {

            $map.find(".disclaimer").addClass("hide");
            // Remove the spinner
            $workspace.removeClass("loading");
            // We must resize the map without the disclaimer
            resizeMap();
        }
    }

    function getMapMode() {
        return $toggleSymbols.is(":checked") ? "cities" : "countries"
    }

    function configure() {

        if(!Modernizr.svg) return;

            $workspace = $("#workspace");
                 $form = $workspace.find("form.toolbox");
               $slider = $form.find(".date-slider");
                  $map = $("#map");
              $sidebar = $("#sidebar");
               $notice = $(".notice");
        $toggleSymbols = $map.find(".js-toggle-symbols input");

        // Track mouse position
        $map.on("mousemove", handleMousePosition);

        // Update map mode
        $toggleSymbols.on("change", updateMapSymbols)

        // Configure the tooltips
        $.fn.qtip.defaults.style.classes = 'qtip-bootstrap';
        $.fn.qtip.defaults.style.def = false;

        // Loading mode on
        $workspace.addClass("loading");

        // Creates the slider
        $slider.dateRangeSlider({
            arrows:false,
            valueLabels:'hide',
            bounds: {
                min: new Date(1966,1,1),
                max: new Date(2010,1,1)
            },
            step: {
                years:1
            },
            defaultValues:{
                min: new Date(1966,1,1),
                max: new Date(1976,1,1)
            }
        });


        // Creates play timer
        timer = $.timer(function() {

            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 2);

            if( slideValues.max >= new Date(2010,1,1) ) {
                stopTimer();
            }

        }, 1000);

        map = $K.map( $map, $map.width(), $map.width()*0.4 );
        // Adds countries to the map
        createMap();

        // Right map resizing
        $(window).resize(resizeMap);

        // Launch the map animation
        $form.delegate(".btn-play", "click", function(evt) {

            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 1);

            // Ensure that the disclaimer is close
            closeDisclaimer();

            // Cursor at the end
            if( slideValues.max >= new Date(2010,1,1) ) {
                // Re-initialize the slider
                $slider.dateRangeSlider("values", new Date(1966,1,1), new Date(1965 + getSlotSize(),1,1));
            }

            timer.toggle();
            $form.find(".btn-play").toggleClass("pause", timer.isActive );
        });

        // Close the sidebar
        $sidebar.on("click", ".close-sidebar", function() {
            $sidebar.addClass("hide");
        });

        // Close the disclaimer
        $map.find(".disclaimer .btn").on("click", closeDisclaimer);
    }


    $(window).load(configure);

})(window, $);