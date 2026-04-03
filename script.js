var diameter = 3000;
var margin = {top: 20, right: 120, bottom: 20, left: 120},
    width = diameter,
    height = diameter;

var i = 0,
    duration = 350,
    root;

var zoomBehavior;

var textOffset = 0;

var nodeRadius = 125;             // Radius of the main nodes
var iconRadius = nodeRadius/2.5;    // Radius of the icons showing which parts of the plant are edible

var branchLength = 600;
var firstBranchLength = 600;
var secondBranchLength = 600;
var iconBranchLength = nodeRadius + iconRadius + 20;
var iconSpreadAngle = 180;      // Angle for which the edible part-icons should be spread around, in degrees
var branchThickness = "6px"; // Thickness of the branches as default

var nLayers = 11;

var siblingSpacing = 5*nodeRadius;
var nonsiblingSpacing = 6*nodeRadius;
var spacingGrowExponent = 1;
var minSpaceBetweenNodes = 6*nodeRadius;
var minSpaceBetweenNodes_leaf = nodeRadius;

var zoomMin = 0.1;
var zoomMax = 0.1;
var currentZoom = 1; // Current zoom scale on the page - updates each time the zoom function is used

var hoverScaleConstant = 0.7;   // How much the node and font increases in size if currentZoom = 1 (no zoom in/out)
var hoverNodeDuration_on = 0;    // How long time to expand node hovered over?
var hoverNodeDuration_off = 0;    // How long time to shrink node no longer hovered over?
var hoverTextDuration_on = 0;    // How long time to shrink text in node hovered over? (greater than hoverNodeDuration_on, so as to not reach past node)
var hoverTextDuration_off = 0;    // How long time to shrink text in node no longer hovered over? (smaller than hoverNodeDuration_off, so as to not reach past node)


var lineBreakString = ' ';      // The string that indicates that the text in the node should switch line


var highlightColour = "orange";
var highlightBranchThickness = "12px";  // Thickness of the branches when highlighted



// Font size calculation settings
var maxFontSize = 48;   // Maximum font size
var baseFontSize = maxFontSize;  // Base font size for short names
var minFontSize = 18;    // Minimum font size
var charThreshold = 8; // Character count where scaling starts


// Interpolation function, so that an angle transition always goes the shortest way, even if it crosses 0/360 deg:
function shortestRotation(startAngle, endAngle) {
    var delta = ((endAngle - startAngle) % 360 + 540) % 360 - 180;
    return startAngle + delta;
}


function getNodeColor(d) {
    if (!d._children && !d.children) return "#fff";
    // console.log(d.name, "expanded:", d.expanded, "children:", d.children, "_children:", d._children);
    return d.expanded ? "#fff" : "lightsteelblue";
}



var tree = d3.layout.tree()
    .size([360, diameter / 2 - 80])
    .separation(function(a, b) { 
        // return Math.max((a.parent == b.parent ? siblingSpacing : nonsiblingSpacing)/(Math.pow(a.depth,spacingGrowExponent)),minSpaceBetweenNodes) 
            return minSpaceBetweenNodes; 
    });

var diagonal = d3.svg.diagonal.radial()
    .projection(function(d) { 
        return [d.y, d.x / 180 * Math.PI]; 
    });

// Create and store the zoom behavior
zoomBehavior = d3.behavior.zoom()
    .scaleExtent([0.1, 3])
    .on("zoom", zoom);

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoomBehavior)
    .append("g")
    .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

var g = svg;

root = pubs;
root.x0 = height / 2;
root.y0 = 0;

// Establish parent relationships for the entire tree
tree.nodes(root); 

// Assign stable IDs to all nodes
assignNodeIds(root);

root.children.forEach(collapse);
root.expanded = true;
update(root);

// Center and zoom the tree after initial render
// Calculate zoom to fit the tree in the viewport
var viewportWidth = window.innerWidth;
var viewportHeight = window.innerHeight;
var initialScale = 2*Math.min(viewportWidth / diameter, viewportHeight / diameter) * 0.9; // 0.9 for some padding

// Center on the root
var initialTranslate = [
    viewportWidth / 2 - (diameter / 2) * initialScale,
    viewportHeight / 2 - (diameter / 2) * initialScale
];

// Apply the initial transform
currentZoom = initialScale;
svg.attr("transform", 
    "translate(" + initialTranslate + ")" + 
    " scale(" + initialScale + ")" + 
    " translate(" + diameter / 2 + "," + diameter / 2 + ")"
);

// Update the zoom behavior to match the initial state
zoomBehavior.scale(initialScale);
zoomBehavior.translate(initialTranslate);

d3.select(self.frameElement).style("height", "800px");

// Function to calculate font size based on character count
function calculateFontSize(lines) {
    var longestLine = Math.max.apply(null, lines.map(function(line) {
        return line.length;
    }));
    
    if (longestLine <= charThreshold) {
        return baseFontSize;
    }
    
    var scale = charThreshold / longestLine;
    var fontSize = baseFontSize * scale;
    return Math.max(minFontSize, Math.min(maxFontSize, fontSize));
}

function update(source) {

    
    // First, get a temporary node list just to count depths
    var tempNodes = tree.nodes(root);
    
    // Count nodes at each depth
    var depthCounts = {};
    tempNodes.forEach(function(d) {
        // Only count non-leaf nodes
        if (d.children || d._children){
            depthCounts[d.depth] = (depthCounts[d.depth] || 0) + 1;
        }
        // Don't add anything for leaf nodes - just skip them
    });

    // Calculate cumulative radii
    var minSpacePerNode = nodeRadius * 2 + minSpaceBetweenNodes;

    var sortedDepths = Object.keys(depthCounts)
        .map(Number)
        .sort(function(a, b) { return a - b; });

    var cumulativeRadius = {};
    cumulativeRadius[0] = 0;

sortedDepths.forEach(function(depth) {
    if (depth === 0) return;
    
    // Check if all nodes at this depth are leaf nodes
    var nodesAtDepth = tempNodes.filter(function(n) { return n.depth === depth; });
    var allLeaves = nodesAtDepth.every(function(n) { return !n.children && !n._children; });
    
    var nodeCount = depthCounts[depth];

        // console.log("Depth count: " + nodeCount);


    var circumferenceNeeded = nodeCount * minSpacePerNode;

        // console.log("Circumference needed: " + circumferenceNeeded);

    var radiusNeeded = circumferenceNeeded / (2 * Math.PI);

    var prevRadius = cumulativeRadius[depth - 1];
    if (depth == 1){
        var additionalRadiusNeeded = firstBranchLength;
    } else if (depth == 2){
        var additionalRadiusNeeded = secondBranchLength;
    } else if (allLeaves) {
        var additionalRadiusNeeded = iconBranchLength;
    } else {
        var additionalRadiusNeeded = Math.max(branchLength, radiusNeeded - prevRadius);
    }
    
    cumulativeRadius[depth] = prevRadius + additionalRadiusNeeded;
});

    // Find the worst-case depth (most degrees needed)
    var maxDegreesNeeded = 0;
    sortedDepths.forEach(function(depth) {
        if (depth === 0) return;
        var nodeCount = depthCounts[depth];
        var radius = cumulativeRadius[depth];
        var circumference = 2 * Math.PI * radius;
        var degreesNeeded = (nodeCount * minSpacePerNode / circumference) * 360;
        // console.log("Degrees needed: " + degreesNeeded + "deg")
        maxDegreesNeeded = Math.max(maxDegreesNeeded, degreesNeeded);
    });

    var actualDegrees = Math.min(360, maxDegreesNeeded);
    
    //console.log("Max degrees needed:", maxDegreesNeeded, "Using:", actualDegrees);
    
    // NOW update tree size BEFORE getting final node positions
    tree.size([actualDegrees, diameter / 2 - 80]);
    
    // Use 360 for tree layout (we'll override x values afterward)
    tree.size([360, diameter / 2 - 80]);
    
    var nodes = tree.nodes(root);
    var links = tree.links(nodes);


    

    // Calculate total angular size needed for the entire tree
    var totalTreeSize = 0;
    if (root.children) {
        root.children.forEach(function(child) {
            totalTreeSize += calculateSubtreeAngularSize(child, 1, 20, cumulativeRadius, minSpacePerNode);
        });
    }
    
    // Use the minimum of 360° or what's actually needed
    var actualSpread = Math.min(360, totalTreeSize);
    
    console.log("Total tree angular size needed:", totalTreeSize, "Using:", actualSpread);
    
    // Assign angular positions recursively, starting from 0° and spreading across actualSpread
    root.x = actualSpread / 2; // Center the root
    
    if (root.children) {
        var childSizes = root.children.map(function(child) {
            return calculateSubtreeAngularSize(child, 1, 20, cumulativeRadius, minSpacePerNode);
        });
        
        var totalChildSize = childSizes.reduce(function(sum, size) { return sum + size; }, 0);
        var currentAngle = 0;
        
        root.children.forEach(function(child, i) {
            var childProportion = childSizes[i] / totalChildSize;
            var childAngleSize = actualSpread * childProportion;
            var childEndAngle = currentAngle + childAngleSize;
            
            assignAngularPositions(child, currentAngle, childEndAngle, cumulativeRadius, minSpacePerNode);
            
            currentAngle = childEndAngle;
        });
    }
    
    // Override radii with custom cumulative values
    nodes.forEach(function(d) {
        d.y = cumulativeRadius[d.depth] || 0;
    });

 // Position leaf nodes (icons) around their parent nodes
nodes.forEach(function(d) {
    if (!d.children && !d._children && d.parent) {
        // This is a leaf node - position it around its parent
        var parent = d.parent;
        var siblings = parent.children || [];
        var numSiblings = siblings.length;
        var myIndex = siblings.indexOf(d);
        
        // Convert parent's polar coordinates to Cartesian
        var parentAngleRad = parent.x * Math.PI / 180;
        var parentCartesianX = parent.y * Math.cos(parentAngleRad);
        var parentCartesianY = parent.y * Math.sin(parentAngleRad);
        
        // Define Cartesian offset from parent
        var iconDistance = nodeRadius + 50; // Distance from parent center
        var spreadAngle = 360*(2*iconRadius*numSiblings/(2*Math.PI*iconBranchLength));
        var angleStep = numSiblings > 1 ? spreadAngle / (numSiblings - 1) : 0;
        var localAngle = numSiblings > 1 ? (myIndex * angleStep - spreadAngle / 2) : 0;
        
        // Calculate icon's Cartesian position relative to parent
        var localAngleRad = (parent.x + localAngle) * Math.PI / 180;
        var iconCartesianX = parentCartesianX + iconDistance * Math.cos(localAngleRad);
        var iconCartesianY = parentCartesianY + iconDistance * Math.sin(localAngleRad);
        
        // Convert back to polar coordinates for D3
        d.y = Math.sqrt(iconCartesianX * iconCartesianX + iconCartesianY * iconCartesianY);
        d.x = Math.atan2(iconCartesianY, iconCartesianX) * 180 / Math.PI;
        
        // Normalize angle to 0-360
        if (d.x < 0) d.x += 360;
    }
});

    //console.log("Nodes at each position:");
    nodes.forEach(function(d) {
        //if (d.depth <= 2) console.log("  ", d.name || "icon node", "depth:", d.depth, "x:", d.x, "y:", d.y);
    });


    // console.log("Depth counts:", depthCounts);
    // console.log("Branch lengths per depth:", depthBranchLengths);
    // console.log("Cumulative radii:", cumulativeRadius);

var node = svg.selectAll("g.node")
    .data(nodes, function(d) { 
        return d.id;  // Use the pre-assigned ID
    });

// Detect if this is a touch device
var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

var nodeEnter = node.enter().append("g")
    .attr("class", function(d){
        // If leaf-node without a url-code, there's nothing to click on, 
        // so icon-node turns cursor to "default" in css:
        if (!d.children && !d._children && !d.url){
            return "node icon-node"
        }else{
            return "node"
        }
    });

// Add click/touch handlers
if (isTouchDevice) {
    // Touch devices: only touchend, no mouse events at all
    nodeEnter.on("touchend", function(d) {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        click(d);
    });
} else {
    // Desktop: click + hover effects
    nodeEnter.on("click", click)
        .on("mousemove", function(d) {

            // Set the shrinkback radius to either the nodeRadius or the iconRadius:
            var baseRadius = (!d.children && !d._children) ? iconRadius : nodeRadius;

            // Get mouse position relative to node center
            var mouse = d3.mouse(this);
            var distance = Math.sqrt(mouse[0] * mouse[0] + mouse[1] * mouse[1]);
            
            // If within original node radius, expand
            if (distance <= baseRadius && (d.children || d._children)) {
                // Bring to front
                this.parentNode.appendChild(this);
                
                var hoverScale = Math.max(hoverScaleConstant / currentZoom, 1);
                
                d3.select(this).select("circle")
                    .transition()
                    .duration(hoverNodeDuration_on)
                    .attr("r", baseRadius * hoverScale);
                
                    if (d.name){
                        var lines = d.name.split(lineBreakString);
                        var fontSize = calculateFontSize(lines) * hoverScale;
                        d3.select(this).select("text")
                            .selectAll("tspan")
                            .transition()
                            .duration(hoverTextDuration_on)
                            .style("font-size", fontSize + "px");
                    }
            } else {
                

                // Outside original radius, shrink back
                d3.select(this).select("circle")
                    .transition()
                    .duration(hoverNodeDuration_off)
                    .attr("r", baseRadius);
                
                    if (d.name){
                        var lines = d.name.split(lineBreakString);
                        var fontSize = calculateFontSize(lines);
                        d3.select(this).select("text")
                            .selectAll("tspan")
                            .transition()
                            .duration(hoverTextDuration_off)
                            .style("font-size", fontSize + "px");
                    }
            }
        })
        .on("mouseout", function(d) {

            // Set the shrinkback radius to either the nodeRadius or the iconRadius:
            var baseRadius = (!d.children && !d._children) ? iconRadius : nodeRadius;

            // Always shrink when mouse leaves node entirely
            d3.select(this).select("circle")
                .transition()
                .duration(hoverNodeDuration_off)
                .attr("r", baseRadius);
            
                if (d.name){
                    var lines = d.name.split(lineBreakString);
                    var fontSize = calculateFontSize(lines);
                    d3.select(this).select("text")
                        .selectAll("tspan")
                        .transition()
                        .duration(hoverNodeDuration_off)
                        .style("font-size", fontSize + "px");
                }
        });
}

        

nodeEnter.append("circle")
    .attr("r", 1e-6)
    .style("fill", function(d) { return getNodeColor(d); });

    // Add images for leaf nodes with icon URLs
nodeEnter.each(function(d) {
    if (!d.children && !d._children && d.icon ) {
        //console.log("Creating image for node with icon:", d.icon);
        // This is a leaf node with an image icon
        d3.select(this).append("image")
            .attr("xlink:href", d.icon)
            .attr("x", -iconRadius * 1)  // Center the image
            .attr("y", -iconRadius * 1)
            .attr("width", iconRadius * 1.4)
            .attr("height", iconRadius * 1.4)
            .style("opacity", 0);
    }
});

nodeEnter.append("text")
    .attr("x", textOffset)
    .attr("text-anchor", "middle")

    // Keeps the text horisontal:
    .attr("transform", function(d) { 
        var startAngle = d.parent ? d.parent.x : d.x;
        return "rotate(" + (90 - startAngle) + ")";  
    })

    .each(function(d) {
        // Skip adding text if this node has an image icon
        if (!d.children && !d._children && d.icon) {
            return; // Image already added above
        }
        
        var text = d3.select(this);
        var lines = d.name.split(lineBreakString);
        var lineHeight = 1.2; // ems
        var fontSize = calculateFontSize(lines);
        
        // Calculate vertical offset to center the text block
        // Move up by half the total height of all lines except the first
        var baselineCorrection = 0.35; // Compensates for SVG text baseline offset
        var startDy = -((lines.length - 1) / 2) * lineHeight + baselineCorrection;
        
        lines.forEach(function(line, i) {
            text.append("tspan")
                .attr("x", textOffset)
                .attr("dy", i === 0 ? startDy + "em" : lineHeight + "em")
                .text(line)
                .style("font-size", fontSize + "px");
        });
    })
    .style("fill-opacity", 1e-6);

var nodeUpdate = node.transition()
    .duration(duration)
    .attrTween("transform", function(d) {
        var currentTransform = this.getAttribute("transform") || "rotate(0)translate(0)";
        var currentAngle = parseFloat(currentTransform.match(/rotate\(([^)]+)\)/) ? 
            currentTransform.match(/rotate\(([^)]+)\)/)[1] : 0);
        var targetAngle = d.x - 90;
        var finalAngle = shortestRotation(currentAngle, targetAngle);
        
        return d3.interpolateString(
            "rotate(" + currentAngle + ")translate(" + d.y + ")",
            "rotate(" + finalAngle + ")translate(" + d.y + ")"
        );
    });


nodeUpdate.select("circle")
    .attr("r", function(d) {
        return (!d.children && !d._children) ? iconRadius : nodeRadius;
    })
    .style("fill", function(d) { return getNodeColor(d); })
    .attr("class", function(d) {

        if (!d.children && !d._children && !d.url) {
            return "icon-node";  // Class for icon nodes
        } else if (!d.children && !d._children && d.url) {
            return "linked-node"; // Class for all of the other nodes
        } else {
           return "";
        }
            
    })
    ;

nodeUpdate.select("image")
    .style("opacity", 1)
    .attr("width", iconRadius * 2)
    .attr("height", iconRadius * 2)
    
    // Make sure the image is rotated correctly:
    .attrTween("transform", function(d) {
        var currentTransform = this.getAttribute("transform") || "rotate(0)";
        var currentAngle = parseFloat(currentTransform.match(/rotate\(([^)]+)\)/) ? 
            currentTransform.match(/rotate\(([^)]+)\)/)[1] : 0);
        var targetAngle = 90 - d.x;
        var finalAngle = shortestRotation(currentAngle, targetAngle);
        
        return d3.interpolateString(
            "rotate(" + currentAngle + ")",
            "rotate(" + finalAngle + ")"
        );
    })

nodeUpdate.select("text")
    .style("fill-opacity", 1)

    // Make sure the text is rotated correctly:
    .attrTween("transform", function(d) {
        var currentTransform = this.getAttribute("transform") || "rotate(0)";
        var currentAngle = parseFloat(currentTransform.match(/rotate\(([^)]+)\)/) ? 
            currentTransform.match(/rotate\(([^)]+)\)/)[1] : 0);
        var targetAngle = 90 - d.x;
        var finalAngle = shortestRotation(currentAngle, targetAngle);
        
        return d3.interpolateString(
            "rotate(" + currentAngle + ")",
            "rotate(" + finalAngle + ")"
        );
    })
    .each(function(d) {

        if (d.name){
            var lines = d.name.split(lineBreakString); 
            d3.select(this).selectAll("tspan")
                .style("font-size", calculateFontSize(lines) + "px");
        }
    });

    svg.selectAll("g.node").select("circle")
    .style("fill", function(d) { 
        if (d.inSearchPath) return highlightColour;  // Highlight search path
        return getNodeColor(d); });

    var nodeExit = node.exit().transition()
        .duration(duration)
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    var link = svg.selectAll("path.link")
        .data(links, function(d) { 
            return d.target.id; 
        });

  link.enter().insert("path", "g")
    .attr("class", "link")
    .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
    })
    .style("stroke", function(d) {
        return (d.target.inSearchPath && d.source.inSearchPath) ? highlightColour : "#ccc";
    })
    .style("stroke-width", function(d) {
        return (d.target.inSearchPath && d.source.inSearchPath) ? highlightBranchThickness : branchThickness;
    })
    .style("opacity", function(d) {
        return (!d.target.children && !d.target._children) ? 0 : 1;
    });

link.transition()
    .duration(duration)
    .attr("d", diagonal)
    .style("stroke", function(d) {
        return (d.target.inSearchPath && d.source.inSearchPath) ? highlightColour : "#ccc";
    })
    .style("stroke-width", function(d) {
        return (d.target.inSearchPath && d.source.inSearchPath) ? highlightBranchThickness : branchThickness;
    })
    .style("opacity", function(d) {
        return (!d.target.children && !d.target._children) ? 0 : 1;
    });

    link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
            var o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
        })
        .remove();

    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

function click(d) {
    // If it's a leaf node with a URL, open the URL
    if (!d.children && !d._children && d.url) {
        window.open(d.url, '_blank'); // Opens in new tab
        return; // Don't expand/collapse
    }
    
    // Otherwise, expand/collapse as normal
    if (d.children) {
        d._children = d.children;
        d.children = null;
        d.expanded = false;
    } else {
        d.children = d._children;
        d._children = null;
        d.expanded = true;
    }
    update(d);
}

function collapse(d) {
    if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
        d.expanded = false;
    }
}


// Zoom in and out in the family tree: ////

function zoom() {
    currentZoom = d3.event.scale; //Stores how much zoomed in/out the page is at the moment
    svg.attr("transform", 
        "translate(" + d3.event.translate + ")" + 
        " scale(" + d3.event.scale + ")" + 
        " translate(" + diameter / 2 + "," + diameter / 2 + ")"
    );
}
///////////////////////////////////////////





// Find a node by name, searching the entire tree
function findNode(name, node) {
    // Check if this node matches (case insensitive)
    // Skip nodes without names (leaf/icon nodes)
    if (node.name && node.name.toLowerCase() === name.toLowerCase()) {
        return node;
    }
    
    // Search in both visible and hidden children
    var children = (node.children || []).concat(node._children || []);
    for (var i = 0; i < children.length; i++) {
        var result = findNode(name, children[i]);
        if (result) return result;
    }
    
    return null; // Not found
}

// Expand all ancestors of a node so it becomes visible
function expandToNode(targetNode) {
    // Clear any previous path highlighting:
    tree.nodes(root).forEach(function(d) {
        d.inSearchPath = false;
    });


    // Build the path from root to the target node
    var path = [];
    var current = targetNode;

    // Mark the target node itself
    targetNode.inSearchPath = true;

    while (current.parent) {
        path.unshift(current.parent);
        current.parent.inSearchPath = true; // Mark the node as being along the search path
        current = current.parent;
    }
    
    // Expand each ancestor in order
    path.forEach(function(ancestor) {
        //console.log("foreEach(function(ancestor)) initiated.")
        if (ancestor._children) {
            ancestor.children = ancestor._children;
            ancestor._children = null;
            ancestor.expanded = true;
            //console.log("if(ancestor._children) initiated.")
        }
    });
}

// Handle the search
function search() {
    var query = document.getElementById("search-input").value.trim();
    var resultDiv = document.getElementById("search-result");
    
    if (!query) {
        resultDiv.textContent = "Please enter a search term.";
        return;
    }
    
    // Find the node
    var targetNode = findNode(query, root);
    
    if (!targetNode) {
        resultDiv.textContent = "\"" + query + "\" hittades inte.";
        return;
    }
    
    resultDiv.textContent = targetNode.name;
    
    // Expand all ancestors so the node is visible, but first collapse previous search:
    root.children.forEach(collapse);
    expandToNode(targetNode);
    
    // Update the tree
    update(root);
    
    // After the tree updates, zoom to fit the path
    setTimeout(function() {
        // Get all nodes in the search path
        var pathNodes = [];
        var current = targetNode;
        while (current) {
            pathNodes.push(current);
            current = current.parent;
        }
        
        // Convert polar coordinates (angle, radius) to Cartesian (x, y)
        var pathPositions = pathNodes.map(function(d) {
            var angle = (d.x - 90) * Math.PI / 180; // Convert to radians, adjust for rotation
            return {
                x: d.y * Math.cos(angle),
                y: d.y * Math.sin(angle)
            };
        });
        
        // Find bounding box
        var minX = Math.min.apply(null, pathPositions.map(function(p) { return p.x; }));
        var maxX = Math.max.apply(null, pathPositions.map(function(p) { return p.x; }));
        var minY = Math.min.apply(null, pathPositions.map(function(p) { return p.y; }));
        var maxY = Math.max.apply(null, pathPositions.map(function(p) { return p.y; }));
        
        // Add padding (in tree coordinates)
        var padding = 200;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
        
        // Calculate dimensions
        var pathWidth = maxX - minX;
        var pathHeight = maxY - minY;
        var pathCenterX = (minX + maxX) / 2;
        var pathCenterY = (minY + maxY) / 2;
        
        // Calculate scale to fit in viewport
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var scaleX = viewportWidth / pathWidth;
        var scaleY = viewportHeight / pathHeight;
        var scale = Math.min(scaleX, scaleY, 3) * 0.9; // Cap at max zoom of 3, with 10% margin
        
        // Calculate translation to center the path
        var translateX = viewportWidth / 2 - (diameter / 2 + pathCenterX) * scale;
        var translateY = viewportHeight / 2 - (diameter / 2 + pathCenterY) * scale;
        
        // Update the global zoom behavior state
        zoomBehavior.scale(scale);
        zoomBehavior.translate([translateX, translateY]);

        // Animate the transform
        currentZoom = scale;
        svg.transition()
            .duration(750)
            .attr("transform", 
                "translate(" + translateX + "," + translateY + ")" + 
                " scale(" + scale + ")" + 
                " translate(" + diameter / 2 + "," + diameter / 2 + ")"
            );
        
        // Highlight the found node after zoom completes
        setTimeout(function() {
            svg.selectAll("g.node")
                .filter(function(d) { return d === targetNode; })
                .select("circle")
                .style("fill", highlightColour)
                .transition()
                .duration(1000)
                .style("fill", getNodeColor(targetNode));
        }, 750);
        
    }, duration + 50); // Wait for tree update animation to finish
}




// Assign unique IDs to every node in the tree
function assignNodeIds(node, counter) {
    counter = counter || {value: 0};
    node.id = counter.value++;
    
    if (node.children) {
        node.children.forEach(function(child) {
            assignNodeIds(child, counter);
        });
    }
    if (node._children) {
        node._children.forEach(function(child) {
            assignNodeIds(child, counter);
        });
    }
    
    return node;
}


// Calculate how much angular space each node's entire subtree needs
function calculateSubtreeAngularSize(node, depth, maxDepth, cumulativeRadius, minSpacePerNode) {
    // Check both children and _children to determine if truly a leaf
    if (!node.children && !node._children) {
        // TRUE leaf node - needs NO space in global layout
        //console.log("True leaf node found:", node.icon || "no icon", "- returning 0 degrees");
        //console.log("Leaf node?");
        //return 0;

        var radius = cumulativeRadius[depth] || 1;
        var circumference = 2 * Math.PI * radius;
        var ownSize = (minSpacePerNode / circumference) * 360;
        ownSize = ownSize/5000; // Reduce separation size since it's the icon nodes
        console.log("Not leaf node?");
        return ownSize;

    }
    
    // Only process VISIBLE children (node.children), not collapsed ones (_children)
    if (!node.children || node.children.length === 0) {
        // Node is collapsed or has no visible children - treat as endpoint for angular calculation
        var radius = cumulativeRadius[depth] || 1;
        var circumference = 2 * Math.PI * radius;
        var ownSize = (minSpacePerNode / circumference) * 360;
        console.log("Not leaf node?");
        return ownSize;
    }
    
    // For each VISIBLE child, recursively calculate its subtree size
    var childSizes = node.children.map(function(child) {
        return calculateSubtreeAngularSize(child, depth + 1, maxDepth, cumulativeRadius, minSpacePerNode);
    });
    
    // The subtree size is the sum of all children's sizes
    var totalChildSize = childSizes.reduce(function(sum, size) { return sum + size; }, 0);
    
    // Also check if THIS node itself needs space at its own depth
    var radius = cumulativeRadius[depth] || 1;
    var circumference = 2 * Math.PI * radius;
    var ownSize = (minSpacePerNode / circumference) * 360;
    
    // Return the maximum of own size vs total child size
    return Math.max(ownSize, totalChildSize);
}



// Assign angular positions recursively, allocating slices to each subtree
function assignAngularPositions(node, startAngle, endAngle, cumulativeRadius, minSpacePerNode) {
    var angleRange = endAngle - startAngle;
    
    // Position this node at the center of its allocated slice
    node.x = startAngle + (angleRange / 2);
    
    // Normalize to 0-360
    while (node.x < 0) node.x += 360;
    while (node.x >= 360) node.x -= 360;
    
    // If this node has children, divide the slice among them
    if (node.children && node.children.length > 0) {
        var depth = node.depth + 1;
        
        // Calculate how much space each child's subtree needs
        var childSizes = node.children.map(function(child) {
            return calculateSubtreeAngularSize(child, depth, 20, cumulativeRadius, minSpacePerNode);
        });
        
        var totalChildSize = childSizes.reduce(function(sum, size) { return sum + size; }, 0);
        
        // Allocate slices proportionally to each child
        var currentAngle = startAngle;
        node.children.forEach(function(child, i) {
            var childProportion = childSizes[i] / totalChildSize;
            var childAngleSize = angleRange * childProportion;
            var childEndAngle = currentAngle + childAngleSize;
            
            assignAngularPositions(child, currentAngle, childEndAngle, cumulativeRadius, minSpacePerNode);
            
            currentAngle = childEndAngle;
        });
    }
}



// Get all node names from the tree for autocomplete
function getAllNodeNames(node, names) {
    names = names || [];

    // Only add non-leaf nodes to the search list
    if (node.children || node._children) {
        names.push(node.name);
    }
    
    var children = (node.children || []).concat(node._children || []);
    children.forEach(function(child) {
        getAllNodeNames(child, names);
    });
    
    return names;
}




// Update autocomplete suggestions based on input
function updateSuggestions() {
    var input = document.getElementById("search-input").value.toLowerCase();
    var datalist = document.getElementById("plant-suggestions");
    
    // Clear existing suggestions
    datalist.innerHTML = "";
    
    if (input.length < 2) return; // Only show suggestions after 2 characters
    
    // Get all node names and filter by input
    var allNames = getAllNodeNames(root);
    var matches = allNames.filter(function(name) {
        return name.toLowerCase().indexOf(input) === 0; // Starts with input
    });
    
    // Sort alphabetically and limit to 10 suggestions
    matches.sort();
    matches.slice(0, 10).forEach(function(name) {
        var option = document.createElement("option");
        option.value = name;
        datalist.appendChild(option);
    });
}


// Reset the highlight and collapse the tree
function resetHighlight() {
    // Clear all search path markers
    tree.nodes(root).forEach(function(d) {
        d.inSearchPath = false;
    });
    
    // Collapse the tree back to initial state
    root.children.forEach(collapse);
    root.expanded = true;
    
    // Clear the search input and result
    document.getElementById("search-input").value = "";
    document.getElementById("search-result").textContent = "";
    
    // Update the tree
    update(root);
    
    // Zoom back to initial view after update completes
    setTimeout(function() {
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var initialScale = 2*Math.min(viewportWidth / diameter, viewportHeight / diameter) * 0.9;
        
        var initialTranslate = [
            viewportWidth / 2 - (diameter / 2) * initialScale,
            viewportHeight / 2 - (diameter / 2) * initialScale
        ];
        
        // Update the global zoom behavior state
        zoomBehavior.scale(initialScale);
        zoomBehavior.translate(initialTranslate);

        // Animate the transform
        currentZoom = initialScale;
        svg.transition()
            .duration(750)
            .attr("transform", 
                "translate(" + initialTranslate + ")" + 
                " scale(" + initialScale + ")" + 
                " translate(" + diameter / 2 + "," + diameter / 2 + ")"
            );
    }, duration + 50); // Wait for tree update animation

}





// Hook up the button and allow pressing Enter in the input field
document.getElementById("search-button").addEventListener("click", search);
document.getElementById("search-input").addEventListener("keydown", function(event) {
    if (event.key === "Enter") search();
});


// Hook up the reset button
document.getElementById("reset-button").addEventListener("click", resetHighlight);

// Global Escape key listener (works even when search input doesn't have focus)
document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") resetHighlight();
});


// Add autocomplete
document.getElementById("search-input").addEventListener("input", updateSuggestions);