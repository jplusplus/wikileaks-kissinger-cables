(function(window, jQuery, undefined) {
    "use strict"
    var map, mapData, mapDataKey, mapSlotSize, symbols, timer;
    var $workspace, $form, $slider, $map, $sidebar, $backToWorld;

    function createCountriesMap() {      
        
        // Stop auto-slide
        stopTimer();
        // Hides side bar
        $sidebar.addClass("hide");
        // Hides back button
        $backToWorld.addClass("hide");
        // Remove slot size to force data reload
        mapSlotSize = -1;

        map.loadMap('/data/wor.svg', function(m) {                          
            // Resize the map to fit corectly to its parent
            resizeMap();  
            // Set the map style/layers without lands layer
            defaultMapLayers(m, false);
            // Load the data once
            loadCountriesData();
            // Updates value using the slider
            $slider.off("valuesChanged").on("valuesChanged", loadCountriesData);            
        });
    }

    function createRegionsMap(data, path) {    
            
        // Stop auto-slide
        stopTimer();
        // Remove existing qtips
        $(".qtip").remove();

        // shows back button
        $backToWorld.removeClass("hide");        
        // Loading mode
        $workspace.addClass("loading");
        // Remove slot size to force data reload
        mapSlotSize = -1;

        // Get the country
        var country = data.iso2 || data.lc;     
        // Nothing to do
        if(!country) return     

        map.loadMap("/region/" + country + ".svg", function(m) {              
            // Resize the map to fit corectly to its parent
            resizeMap();      
            // Set the map style/layers with lands layer
            defaultMapLayers(m, true);
            // Load the data once
            loadRegionsData(country);            
            // Updates value using the slider
            $slider.off("valuesChanged").on("valuesChanged", function() {                
                // Load the data passing the country
                loadRegionsData(country)
                // Disable loading mode
                $workspace.removeClass("loading");
            });
        });
    }

    function loadCountriesData() {

        // Hides the sidebar
        $sidebar.addClass("hide");

        var slotSize = getSlotSize();    
        // Did the slot size change ?
        if(slotSize != mapSlotSize) {

            mapSlotSize = slotSize;
            var params = { slotSize: mapSlotSize };   
            
            $.getJSON("/count/countries.json", params, updateMapSymbols);         

        // If not, just update the map
        } else {
            updateMapSymbols();
        }
    }

    function loadRegionsData(country) {

        var slotSize = getSlotSize();        
        // Did the slot size change ?
        if(slotSize != mapSlotSize) {

            mapSlotSize = slotSize;
            var params = { 
                slotSize: mapSlotSize,
                regionFrom: country
            };   
            
            $.getJSON("/count/cities.json", params, updateMapSymbols);         

        // If not, just update the map
        } else {
            updateMapSymbols();
        }
    }

    function loadCountrySidebar(place) {      
        var country = place.cy || place.lc || place;        
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
        $.get("/play/sidebar", params, function(data) {
            // Find the place to insert HTML
            $sidebar.find(".js-content").html(data)
            // Show the sidebar
            $sidebar.removeClass("hide");
        })
    }

    function getSlotSize() {

        var values = $slider.dateRangeSlider("values");        
        var months = (values.max.getFullYear() - values.min.getFullYear()) * 12;
           months -= values.min.getMonth() + 1;
           months += values.max.getMonth();

        return (months <= 0 ? 0 : months) + 1;
    }

    function createTooltip(meta) {
        
        if(meta.iso2) {
            meta = _.findWhere(mapData[mapDataKey], {lc: meta.iso2});                         
        }

        if(meta) {
            var city = meta.cy ? meta.lc + ", " : "",   
            matches = "<br /><small>with <strong>%d</strong> occurences</small>".replace("%d", meta.ct);
            return city + meta.label + matches; 
        } else {
            return false;
        }
    }

    function updateMapSymbols(d) {

        /**
         * Data strcuture:
         *     * dt := date
         *     * ct := count
         *     * lt := latitude
         *     * lg := longitude
         *     * lc := location (city or country)
         *     * cy := country (optional)
         */
        
        // Records data
        if(d) mapData = d;
    

        var values = $slider.dateRangeSlider("values");
        mapDataKey = values.min.getFullYear()+""+values.min.getMonth();  

        // Data we work with
        var data = mapData[mapDataKey] || [];
        if(data.length == 0) return $workspace.removeClass("loading");        
        
        // The following assetion determines the mode:
        // is the country in a separate field (city view) ?         
        if(!! data[0].cy ) {

            var scale = $K.scale.sqrt(data, 'ct').range([4, 30]);

            // Removes existing symbols
            if(symbols) {
                // Weird behavior : kartograph throw a warning when removing the symbols groups
                map.removeSymbols();
            }

            symbols = map.addSymbols({
                type: $K.Bubble,
                data: data,
                location: function(place) {
                    return [place.lg, place.lt];
                },
                radius: function(place) {
                    var r = scale(place.ct);
                    return isNaN(r) ? 0 : r;
                },
                sortBy: 'radius desc',
                style: function(place) {                    
                    return 'fill:#3194AA; stroke: #fff; fill-opacity: 0.6;'
                },
                click: loadCountrySidebar,
                tooltip: createTooltip
            });

        } else {  

            var colorscale = new chroma.ColorScale({
                colors: ["#fafafa", "#3194AA"],
                limits: chroma.limits(data, 'k-means', 10, "ct")
            });

            map.getLayer('countries').style({
                fill: function(l, path) {

                    var place = _.find(data, function(p) {      
                        return p.lc === l.iso2;
                    });     
                    return place ? colorscale.getColor(place["ct"]) : "white"
                }
            })
            // Add tooltips
            .tooltips(createTooltip)
            // Add click event
            .on('click', createRegionsMap);
        }
    
        // Keep the spinner until the disclaimer is close
        if( ! $map.find(".disclaimer").is(":visible") ) {            
            // Removes loading mode
            $workspace.removeClass("loading");
        }
    }

    function defaultMapLayers(m, widthLands) {

        // Checks that layers don't exist
        m.layer = m.layer || {};

        if(widthLands) {            
            m.layer['lands'] || m.addLayer('lands', {
                name: 'lands',
                styles: {
                    stroke: '#aaaaaa',
                    fill: '#dadada',
                    'stroke-width': 1,
                    'stroke-linejoin': 'round'
                }
            }); 
        }


         m.layer['countries'] || m.addLayer('countries', {
            name: 'countries',
            styles: {
                stroke: '#aaa',
                fill: '#fafafa',
                'stroke-width': 1
            }
        });
    }

    function stopTimer() {
        timer.stop();
        $form.find(".btn-play").removeClass("pause");
    }

    function resizeMap() {

        // Do not resize the map until the disclaimer is close
        if( $map.find(".disclaimer").is(":visible") ) return;

        // var ratio = map.viewAB.width / map.viewAB.height;        
        var ratio = 0.4,
           height = $map.width() * ratio;
        
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

    function configure() { 

        if(!Modernizr.svg) return;
        
          $workspace = $("#workspace");
               $form = $workspace.find("form.toolbox");
             $slider = $form.find(".date-slider");
                $map = $("#map");
            $sidebar = $("#sidebar");
        $backToWorld = $map.find(".js-back-to-world");

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
                min: new Date(1972,12,1), 
                max: new Date(1976,12,1)
            },
            step: {
                months:1
            },
            defaultValues:{
                min: new Date(1972,12,1), 
                max: new Date(1973,3,1)
            }
        });


        // Creates play timer
        timer = $.timer(function() {
            
            var slideValues = $slider.dateRangeSlider("values");            
            $slider.dateRangeSlider('scrollRight', 1);

            if( slideValues.max >= new Date(1976,12,1) ) {
                stopTimer();
            }

        }, 1000);

        map = $K.map( $map, $map.width(), $map.width()*0.4 );  
        // Adds countries to the map
        createCountriesMap();

        // Right map resizing
        $(window).resize(resizeMap);

        // Launch the map animation
        $form.delegate(".btn-play", "click", function(evt) {     

            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 1);

            // Ensure that the disclaimer is close
            closeDisclaimer();

            // Cursor at the end
            if( slideValues.max >= new Date(1976,12,1) ) {
                // Re-initialize the slider
                $slider.dateRangeSlider("values", new Date(1972,12,1), new Date(1973,2,1));
            }
         
            timer.toggle();
            $form.find(".btn-play").toggleClass("pause", timer.isActive );                  
        });

        // Close the sidebar
        $sidebar.on("click", ".close-sidebar", function() {
            $sidebar.addClass("hide");            
        });

        // Click on the "go to map" button
        $map.on("click", ".js-back-to-world", createCountriesMap);

        // Close the disclaimer
        $map.find(".disclaimer .btn").on("click", closeDisclaimer);
    }


    $(window).load(configure);

})(window, $);