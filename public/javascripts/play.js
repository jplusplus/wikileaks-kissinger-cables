(function(window, jQuery, undefined) {
    "use strict"
    var map, data, symbols, timer;
    var $workspace, $form, $slider, $map;

    function createCountriesMap() {      

        map.loadMap('/data/world.svg', function(m) {
            // Set the map style/layers
            defaultMapLayers(m);
            // Load the data once
            loadCountriesData();
            // Updates value using the slider
            $slider.off("valuesChanged").on("valuesChanged", loadCountriesData);
        });
    }

    function createRegionsMap(data, path) {
           
        // City selected, temporary back to the world map
        if(data.cy) return createCountriesMap();

        var place = data.iso2 || data.lc;  

        map.loadMap("/region/" + place + ".svg", function(m) {
            // Set the map style/layers
            defaultMapLayers(m);
            // Load the data once
            loadRegionsData(place);
            // Updates value using the slider
            $slider.off("valuesChanged").on("valuesChanged", function() {
                // Load the data passing the place
                loadRegionsData(place)
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

    function loadRegionsData(place) {

        var slideValues = $slider.dateRangeSlider("values");
        var params = {
            start: slideValues.min.toISOString(), 
            end: slideValues.max.toISOString(),
            regionFrom: place
        };
        
        $.getJSON("/count/cities.json", params, updateMapSymbols);
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
        if(d) data = d

        // Removes existing symbols
        if(symbols) symbols.remove();
        
        // The following assetion determines the mode:
        // is the country in a separate field (city view) ? 
        var isBublleMode = !! data[0].cy;

        // Use bubble mode
        if(isBublleMode) {

            var scale = $K.scale.sqrt(data, 'ct').range([0, 20]);

            symbols = map.addSymbols({
                type: $K.Bubble,
                data: data,
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
                click: createRegionsMap
            });

        } else {

            var colorscale = new chroma.ColorScale({
                colors: ["#fff", "#3E6284"],
                limits: chroma.limits(data, 'k-means', 10, "ct")
            });

            map.getLayer('countries').style({
                fill: function(l) {
                    var place = _.find(data, function(p) {                    
                        return p.lc === l.iso2;
                    });              
                    return place ? colorscale.getColor(place["ct"]) : "white"
                }
            });
        }
    

        $workspace.find(".spinner").addClass("hide");
    }

    function defaultMapLayers(m) {

        m.addLayer('lands', {
            name: 'lands',
            styles: {
                stroke: '#aaaaaa',
                fill: '#dadada',
                'stroke-width': 1,
                'stroke-linejoin': 'round'
            }
        });    

        m.addLayer('countries', {
            name: 'bg',
            styles: {
                fill: '#f4f4f4',
                stroke: '#f4f4f4',
                'stroke-width': 10,
                'stroke-linejoin': 'round'
            }
        });

        m.addLayer('countries', {
            name: 'countries',
            styles: {
                stroke: '#aaa',
                fill: '#fff',
                'stroke-width': 1
            },        
            click: createRegionsMap
        })
    }

    $(window).load(function() {      
        
        $workspace = $("#workspace"),
             $form = $workspace.find("form.toolbox"),
           $slider = $form.find(".date-slider"),
              $map = $("#map");

        // Creates the slider
        $slider.dateRangeSlider({
            arrows:false,
            valueLabels:'hide',
            bounds: {
                min: new Date(1973,1,1), 
                max: new Date(1976,1,1)
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
                max: new Date(1973,2,1)
            }
        });

        map = $K.map( $map, $map.width(), 600 );  
        // Adds countries to the map
        createCountriesMap();

        // Creates play timer
        timer = $.timer(function() {
            
            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 1);

            if( slideValues.max >= new Date(1975,12,1) ) {
                timer.stop();
                $form.find(".btn-play").removeClass("pause");
            }

        }, 500);

        $form.delegate(".btn-play", "click", function(evt) {     

            var slideValues = $slider.dateRangeSlider("values");
            $slider.dateRangeSlider('scrollRight', 1);

            // Cursor at the end
            if( slideValues.max >= new Date(1975,12,1) ) {
                // Re-initialize the slider
                $slider.dateRangeSlider("values", new Date(1973,1,1), new Date(1973,2,1));
            }
         
            timer.toggle();
            $form.find(".btn-play").toggleClass("pause", timer.isActive );                  
        });

    });

})(window, $);