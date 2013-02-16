(function(window, jQuery, undefined) {
    "use strict"
    var map, mapData, symbols, timer;
    var $workspace, $form, $slider, $map, $sidebar, $backToWorld;

    function createCountriesMap() {      

        // Hides side bar
        $sidebar.addClass("hide");
        // Hides back button
        $backToWorld.addClass("hide");

        map.loadMap('/data/wor.svg', function(m) {                          
            // Resize the map to fit corectly to its parent
            resizeMap();  
            // Set the map style/layers
            defaultMapLayers(m);
            // Load the data once
            loadCountriesData();
            // Updates value using the slider
            $slider.off("valuesChanged").on("valuesChanged", loadCountriesData);            
        });
    }

    function createRegionsMap(data, path) {    
        
        // shows back button
        $backToWorld.removeClass("hide");
        
        // Loading mode
        $workspace.addClass("loading");

        // City selected, temporary back to the world map
        if(data.cy) return createCountriesMap();        

        var country = data.iso2 || data.lc;     

        // Nothing to do
        if(!country) return     

        map.loadMap("/region/" + country + ".svg", function(m) {              
            // Resize the map to fit corectly to its parent
            resizeMap();      
            // Set the map style/layers
            defaultMapLayers(m);
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

        var slideValues = $slider.dateRangeSlider("values");
        var params = {
            start: slideValues.min.toISOString(), 
            end: slideValues.max.toISOString()
        };   
        
        $.getJSON("/count/countries.json", params, updateMapSymbols);
    }

    function loadRegionsData(country) {

        var slideValues = $slider.dateRangeSlider("values");
        var params = {
            start: slideValues.min.toISOString(), 
            end: slideValues.max.toISOString(),
            regionFrom: country
        };

        if( ! $sidebar.hasClass("hide") ) loadCountrySidebar( $sidebar.data("country") );

        $.getJSON("/count/cities.json", params, updateMapSymbols);
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

    function createTooltip(data) {
        
        if(data.iso2) {
            data = _.findWhere(mapData, { lc: data.iso2 });
        }

        if(data) {
            var city = data.cy ? data.lc + ", " : "",
             matches = "<br /><small>with <strong>%d</strong> matches</small>".replace("%d", data.ct);
            return city + data.label + matches; 
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
        if(d) mapData = d

        // Removes existing symbols
        if(symbols) symbols.remove();
        
        // The following assetion determines the mode:
        // is the country in a separate field (city view) ? 
        var isItCity = !! mapData[0].cy;

        // Use bubble mode
        if(isItCity) {

            var scale = $K.scale.sqrt(mapData, 'ct').range([4, 30]);            
            symbols = map.addSymbols({
                type: $K.Bubble,
                data: mapData,
                location: function(place) {
                    return [place.lg, place.lt];
                },
                radius: function(place) {
                    return scale(place.ct);
                },
                sortBy: 'radius desc',
                style: function(place) {
                    // Different color for city or country
                    var fill = place.cy ? "fill:#B4131D;" : "fill:#3E6284;";
                    return fill + 'stroke: #fff; fill-opacity: 0.6;'
                },
                click: function(data, path) {      
                    // Stop auto-slide
                    if(data.cy) loadCountrySidebar(data)
                    else createRegionsMap(data)
                },
                tooltip: createTooltip
            });

            // Change the region if you click in an other country
            map.getLayer("lands").on('click', createRegionsMap);

        } else {

            var colorscale = new chroma.ColorScale({
                colors: ["#fafafa", "#3E6284"],
                limits: chroma.limits(mapData, 'k-means', 10, "ct")
            });
       
            map.getLayer('countries').style({
                fill: function(l, path) {
                    var place = _.find(mapData, function(p) {      
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
    
        // Removes loading mode
        $workspace.removeClass("loading");
    }

    function defaultMapLayers(m) {

        // Checks that layers don't exist
        m.layer = m.layer || {};

        m.layer['lands'] || m.addLayer('lands', {
            name: 'lands',
            styles: {
                stroke: '#aaaaaa',
                fill: '#dadada',
                'stroke-width': 1,
                'stroke-linejoin': 'round'
            }
        });    

        m.layer['bg'] || m.addLayer('countries', {
            name: 'bg',
            styles: {
                fill: '#f4f4f4',
                stroke: '#f4f4f4',
                'stroke-width': 10,
                'stroke-linejoin': 'round'
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
    }

    function stopTimer() {
        timer.stop();
        $form.find(".btn-play").removeClass("pause");
    }

    function resizeMap() {
        // var ratio = map.viewAB.width / map.viewAB.height;
        var ratio = 0.4;
        $map.height( $map.width() * ratio );
        map.resize();
    }

    function configure() {      
        
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
                min: new Date(1973,1,1), 
                max: new Date(1977,1,1)
            },
            formatter:function(val){
                var month = val.getMonth(),
                year = val.getYear();
                return year + "/" + month;
            },
            step: {
                months:1
            },
            defaultValues:{
                min: new Date(1973,1,1), 
                max: new Date(1973,3,1)
            }
        });

        map = $K.map( $map, $map.width(), $map.width()*0.4 );  
        // Adds countries to the map
        createCountriesMap();

        // Creates play timer
        timer = $.timer(function() {
            
            var slideValues = $slider.dateRangeSlider("values");            
            $slider.dateRangeSlider('scrollRight', 1);

            if( slideValues.max >= new Date(1976,12,1) ) {
                stopTimer();
            }

        }, 1000);

        // Right map resizing
        $(window).resize(resizeMap);

        // Launch the map animation
        $form.delegate(".btn-play", "click", function(evt) {     

            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 1);

            // Cursor at the end
            if( slideValues.max >= new Date(1976,12,1) ) {
                // Re-initialize the slider
                $slider.dateRangeSlider("values", new Date(1973,1,1), new Date(1973,2,1));
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


    }


    $(window).load(configure);

})(window, $);