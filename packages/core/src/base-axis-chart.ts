// D3 Imports
import {
	mouse,
	select,
	event
} from "d3-selection";
import { scaleBand, scaleLinear } from "d3-scale";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { min, max } from "d3-array";
import { drag } from "d3-drag";

import { BaseChart } from "./base-chart";

import * as Configuration from "./configuration";
import { Tools } from "./tools";

export class BaseAxisChart extends BaseChart {
	x: any;
	y: any;
	y2: any;
	thresholdDimensions: any;

	// Represents the rescale value obtained from sliders
	lowerScaleY = 1;
	upperScaleY = 1;
	scaleX = 1;

	options: any = Object.assign({}, Configuration.options.AXIS);

	constructor(holder: Element, configs: any) {
		super(holder, configs);

		if (configs.options) {
			this.options = Object.assign({}, this.options, configs.options);
			const { axis } = configs.options;
			if (axis) {
				this.x = axis.x;
				this.y = axis.y;
				this.y2 = axis.y2;
			}
		}
	}

	setSVG(): any {
		super.setSVG();

		this.container.classed("chart-axis", true);
		this.innerWrap.append("g")
			.attr("class", "x grid");
		this.innerWrap.append("g")
			.attr("class", "y grid");

		return this.svg;
	}

	initialDraw(data?: any) {
		if (data) {
			this.displayData = data;
		}

		// If an axis exists
		const xAxisRef = select(this.holder).select(".axis.x");
		if (!xAxisRef.node()) {
			this.setSVG();

			// Scale out the domains
			// Set the x & y axis as well as their labels
			this.setXScale();
			this.setXAxis();
			this.setYScale(false);
			this.setYAxis();

			// Draw the x & y grid
			this.drawXGrid();
			this.drawYGrid();

			// Create y axis slider
			this.createYSlider();

			this.addOrUpdateLegend();
		} else {
			const holderRef = select(this.holder);

			this.innerWrap = holderRef.select("g.inner-wrap");
			this.svg = holderRef.select("svg.chart-svg");
		}

		this.draw();

		this.addDataPointEventListener();
	}

	update() {
		this.displayData = this.updateDisplayData();

		this.updateXandYGrid();
		this.setXScale();
		this.setXAxis();
		this.setYScale(false);
		this.setYAxis();
		this.interpolateValues(this.displayData);
	}

	updateDisplayData() {
		const oldData = Tools.clone(this.data);
		const activeLegendItems = this.getActiveLegendItems();

		// Get new data by filtering the data based off of the legend
		const newDisplayData = Object.assign({}, oldData);
		if (this.getLegendType() === Configuration.legend.basedOn.SERIES) {
			newDisplayData.datasets = oldData.datasets.filter(dataset => {
				// If this datapoint is active on the legend
				const activeSeriesItemIndex = activeLegendItems.indexOf(dataset.label);

				return activeSeriesItemIndex !== -1;
			});
		} else {
			const dataIndeciesToRemove = [];
			newDisplayData.labels = oldData.labels.filter((label, index) => {
				// If this datapoint is active on the legend
				const activeSeriesItemIndex = activeLegendItems.indexOf(label);

				if (activeSeriesItemIndex === -1) {
					dataIndeciesToRemove.push(index);
				}

				return activeSeriesItemIndex !== -1;
			});

			if (dataIndeciesToRemove.length > 0) {
				newDisplayData.datasets = oldData.datasets.map(dataset => {
					dataset.data = dataset.data.filter((dataPoint, i) => {
						return dataIndeciesToRemove.indexOf(i) === -1;
					});

					return dataset;
				});
			}
		}

		return newDisplayData;
	}

	addLabelsToDataPoints(d, index) {
		const { datasets } = this.displayData;

		return datasets.map(dataset => ({
			label: d,
			datasetLabel: dataset.label,
			value: dataset.data[index]
		}));
	}

	/*setYSliderHeight(height){
		let line = this.svg.selectAll(`#${this.chartContainerID}-slider-line`)
		let upperCircle = this.svg.selectAll(`#${this.chartContainerID}-slider-circle-top`)

		line.attr("y2", height - radius);
		upperCircle.attr("cy", height);
		upperCircle.datum({"y": sliderBottom});


	}*/

	createYSlider() {
		const margins = Configuration.charts.margin;
		const width = this.getChartSize().width + margins.left;
		const radius = Configuration.sliders.handles.radius;
		const diameter = 2 * radius;

		// The max height of the upper handle
		const maxHeight = 0;

		// The minimum height of the lower handle
		//const minHeight = Configuration.sliders.height;
		const chartSize = this.getChartSize();
		const minHeight = chartSize.height - this.innerWrap.select(".x.axis").node().getBBox().height;

		const dragAreaLength = minHeight - maxHeight;

		const clipboxWidth = this.getChartSize().width;
		const clipBoxHeight = this.getChartSize().height - margins.bottom - margins.top + Configuration.sliders.bottomPadding;

		// Slider is intially fit to the top and bottom of the axis
		let sliderTop = maxHeight;
		let sliderBottom = minHeight;
		let sliderLength = Math.abs(sliderTop - sliderBottom);

		// Slider components
		let lowerCircle: any;
		let upperCircle: any;
		let line: any;

		// Represents the grab point location on the slider
		let cursorLocationOnSlider: any;

		// When a mousedown action is detected on the slider, calculate the cursor's relative position on the slider
		// to be used as a grab point for dragging
		const setGrabPoint = d => {
			const minClickValue = this.svg.select(`#${this.chartContainerID}-slider-circle-bottom`).node().getBoundingClientRect().bottom;
			const maxClickValue = this.svg.select(`#${this.chartContainerID}-slider-circle-top`).node().getBoundingClientRect().top;
			const maxClickRange = Math.abs(maxClickValue - minClickValue);
			sliderLength = Math.abs(maxClickValue - minClickValue);
			cursorLocationOnSlider = (Math.abs(event.y - minClickValue) / maxClickRange);
			const sliderRelativePosition = maxHeight + Math.abs(maxHeight - minHeight) * cursorLocationOnSlider;
		};

		const dragSlider = d => {

			// Get the cursor's y location.
			let y = event.y;

			// y must be between the two ends of the line.
			if (y < maxHeight) {
				y = maxHeight;
			} else {
				if (y > minHeight) {
					y = minHeight;
				}
			}

			const newTopHandleLocation = y + ((sliderTop - sliderBottom) * cursorLocationOnSlider);
			const newBottomHandleLocation = y - ((sliderTop - sliderBottom) * (1 - cursorLocationOnSlider));

			// Move the slider
			if (newTopHandleLocation + radius > maxHeight && newBottomHandleLocation - radius < minHeight) {

				// Scale the min and max axis values
				this.upperScaleY = 1 - (newTopHandleLocation - maxHeight) / dragAreaLength;
				this.lowerScaleY = (newBottomHandleLocation - maxHeight) / dragAreaLength;

				sliderTop = newTopHandleLocation;
				sliderBottom = newBottomHandleLocation;

				// This assignment is necessary for multiple drag gestures.
				// It makes the drag.origin function yield the correct value.
				// Set slider top/bottom attributes
				d.y1 = sliderTop;
				d.y2 = sliderBottom;

				line.attr("y1", sliderTop + radius);
				upperCircle.attr("cy", sliderTop);
				upperCircle.datum({"y": sliderTop});

				line.attr("y2", sliderBottom - radius);
				lowerCircle.attr("cy", sliderBottom);
				lowerCircle.datum({"y": sliderBottom});
			}

			this.displayData = this.updateDisplayData();

			this.updateXandYGrid();
			this.setYScale(true);
			this.setYAxis();
			this.interpolateValues(this.displayData);
		};

		const upperDragged = d => {

			//let line = this.svg.select(`#${this.chartContainerID}-slider-line`)
			//let upperCircle = this.svg.select(`#${this.chartContainerID}-slider-circle-top`)

			// Get the cursor's y location.
			let y = event.y;

			// y must be between the two ends of the line.
			if (y < maxHeight) {
				y = maxHeight;
			} else {
				if (y > sliderBottom - diameter) {
					y = sliderBottom - diameter;
				}
			}

			// This assignment is necessary for multiple drag gestures.
			// It makes the drag.origin function yield the correct value.
			// Set upper handle position
			d.y = y;

			// Update axis range
			this.upperScaleY = 1 - ((y - maxHeight) / dragAreaLength);
			sliderTop = y;

			// Update the handle location on the slider
			upperCircle.attr("cy", sliderTop);
			line.attr("y1", sliderTop + radius);
			line.datum({"y1": sliderTop + radius});

			this.displayData = this.updateDisplayData();

			this.updateXandYGrid();
			this.setYScale(true);
			this.setYAxis();
			this.interpolateValues(this.displayData);
		};

		const lowerDragged = d => {

			//let line = this.svg.select(`#${this.chartContainerID}-slider-line`).data([1])
			//let lowerCircle = this.svg.select(`#${this.chartContainerID}-slider-circle-top`)

			//lowerCircle.enter().append("line").attr("cy", 1000)

			//console.log(lowerCircle.attr("cy"))

			// Get the cursor's y location.
			let y = event.y;

			// y must be between the two ends of the line.
			if (y < (sliderTop + diameter)) {
				y = (sliderTop + diameter);
			} else {
				if (y > minHeight) {
					y = minHeight;
				}
			}

			// This assignment is necessary for multiple drag gestures.
			// It makes the drag.origin function yield the correct value.
			// Set lower handle position
			d.y = y;

			// Update axis range
			this.lowerScaleY = (y - maxHeight) / dragAreaLength;

			sliderBottom = y;

			// Update the circle location on the slider
			lowerCircle.attr("cy", sliderBottom);
			line.attr("y2", sliderBottom - radius);
			line.datum({"y2": sliderBottom - radius});
			
			this.displayData = this.updateDisplayData();

			this.updateXandYGrid();
			this.setYScale(true);
			this.setYAxis();
			this.interpolateValues(this.displayData);
		};

		// Insert the slider element into the action bar. A slider consists of a line and a two circles
		line = this.innerWrap.append("line")
			.attr("id", `${this.chartContainerID}-slider-line`)
			.attr("x1", Configuration.sliders.margin.left)
			.attr("x2", Configuration.sliders.margin.left)
			.attr("y1", sliderTop + radius)
			.attr("y2", sliderBottom - radius)
			.style("stroke", Configuration.sliders.colour)
			.style("opacity", Configuration.sliders.line.opacity)
			.style("stroke-linecap", "round")
			.style("stroke-width", radius)
			.style("cursor", "grab")
			.on("mousedown", setGrabPoint)
			.datum({
				y1: sliderTop,
				y2: sliderBottom
			}).call(drag()
			.on("drag", dragSlider));

		// Make handles draggable
		lowerCircle = this.innerWrap.append("circle")
			.attr("width", width)
			//.attr("height", Configuration.sliders.height)
			.attr("height", minHeight)
			.datum({
				x: Configuration.sliders.margin.left,
				y: sliderBottom
			}).call(drag()
			.on("drag", lowerDragged))
			.attr("id", `${this.chartContainerID}-slider-circle-top`)
			.attr("r", radius)
			.attr("cy", d => d.y)
			.attr("cx", d => d.x)
			.style("fill", Configuration.sliders.colour)
			.style("cursor", "ns-resize");

		upperCircle = this.innerWrap.append("circle")
			.attr("width", width)
			//.attr("height", Configuration.sliders.height)
			.attr("height", minHeight)
			.datum({
				x: Configuration.sliders.margin.left,
				y: sliderTop
			}).call(drag()
			.on("drag", upperDragged))
			.attr("id", `${this.chartContainerID}-slider-circle-bottom`)
			.attr("r", radius)
			.attr("cy", d => d.y)
			.attr("cx", d => d.x)
			.style("fill", Configuration.sliders.colour)
			.style("cursor", "ns-resize");

		// Keep chart data elements within the boundaires of the chart
		const svg = this.innerWrap.append("clipPath")
			.attr("id", `${this.chartContainerID}-clip`)
			.append("rect")
			.attr("width", clipboxWidth)
			.attr("height", clipBoxHeight);
	}

	draw() {
		console.warn("You should implement your own `draw()` function.");
	}

	interpolateValues(newData: any) {
		console.warn("You should implement your own `interpolateValues()` function.");
	}

	/**************************************
	 *  Computations/Calculations         *
	 *************************************/
	// TODO - Refactor
	getChartSize(container = this.container) {
		let ratio, marginForLegendTop;
		if (container.node().clientWidth > Configuration.charts.widthBreak) {
			ratio = Configuration.charts.magicRatio;
			marginForLegendTop = 0;
		} else {
			marginForLegendTop = Configuration.charts.marginForLegendTop;
			ratio = 1;
		}

		// Store computed actual size, to be considered for change if chart does not support axis
		const marginsToExclude = Configuration.charts.margin.left + Configuration.charts.margin.right;
		const computedChartSize = {
			height: container.node().clientHeight - marginForLegendTop,
			width: (container.node().clientWidth - marginsToExclude) * ratio
		};

		return {
			height: Math.max(computedChartSize.height, Configuration.charts.axisCharts.minHeight),
			width: Math.max(computedChartSize.width, Configuration.charts.axisCharts.minWidth)
		};
	}

	resizeChart() {
		// Reposition the legend
		this.positionLegend();

		if (this.innerWrap.select(".axis-label.x").nodes().length > 0 || this.options.scales.x.title) {
			this.repositionXAxisTitle();
		}

		if (this.innerWrap.select(".axis-label.y").nodes().length > 0 || this.options.scales.y.title) {
			this.repositionYAxisTitle();
		}

		this.dispatchEvent("resize");
	}

	/**************************************
	 *  Axis & Grids                      *
	 *************************************/

	setXScale(xScale?: any) {
		if (xScale) {
			this.x = xScale;
		} else {
			const { bar: margins } = Configuration.charts.margin;
			const { scales } = this.options;

			const chartSize = this.getChartSize();
			const width = chartSize.width - margins.left - margins.right;

			this.x = scaleBand().rangeRound([0, width]).padding(Configuration.scales.x.padding);
			this.x.domain(this.displayData.labels);
		}
	}

	setXAxis(noAnimation?: boolean) {
		const { bar: margins } = Configuration.charts.margin;
		const chartSize = this.getChartSize();
		const height = chartSize.height - margins.top - margins.bottom;

		const t = noAnimation ? this.getInstantTransition() : this.getDefaultTransition();

		const xAxis = axisBottom(this.x)
			.tickSize(0)
			.tickSizeOuter(0);
		let xAxisRef = this.svg.select("g.x.axis");

		// If the <g class="x axis"> exists in the chart SVG, just update it
		if (xAxisRef.nodes().length > 0) {
			xAxisRef = this.svg.select("g.x.axis")
				.transition(t)
				.attr("transform", `translate(0, ${height})`)
				// Casting to any because d3 does not offer appropriate typings for the .call() function
				.call(xAxis);
		} else {
			xAxisRef = this.innerWrap.append("g")
				.attr("class", "x axis");

			xAxisRef.call(xAxis);
		}

		// Update the position of the pieces of text inside x-axis
		xAxisRef.selectAll("g.tick text")
			.attr("y", Configuration.scales.magicY1)
			.attr("x", Configuration.scales.magicX1)
			.attr("dy", ".35em")
			.attr("transform", `rotate(${Configuration.scales.xAxisAngle})`)
			.style("text-anchor", "end")
			.call(text => this.wrapTick(text));

		// get the tickHeight after the ticks have been wrapped
		const tickHeight = this.getLargestTickHeight(xAxisRef.selectAll(".tick")) + Configuration.scales.tick.heightAddition;
		// Add x-axis title
		if (this.innerWrap.select(".axis-label.x").nodes().length === 0 && this.options.scales.x.title) {
			xAxisRef.append("text")
				.attr("class", "x axis-label")
				.attr("text-anchor", "middle")
				.attr("transform", `translate(${xAxisRef.node().getBBox().width / 2}, ${tickHeight})`)
				.text(this.options.scales.x.title);
		}

		// get the yHeight after the height of the axis has settled
		const yHeight = this.getChartSize().height - this.svg.select(".x.axis").node().getBBox().height;
		xAxisRef.attr("transform", `translate(0, ${yHeight})`);
	}

	repositionXAxisTitle() {
		const xAxisRef = this.svg.select("g.x.axis");
		const tickHeight = this.getLargestTickHeight(xAxisRef.selectAll(".tick")) + Configuration.scales.tick.heightAddition;

		const xAxisTitleRef = this.svg.select("g.x.axis text.x.axis-label");
		xAxisTitleRef.attr("class", "x axis-label")
			.attr("text-anchor", "middle")
			.attr("transform", `translate(${xAxisRef.node().getBBox().width / 2}, ${tickHeight})`)
			.text(this.options.scales.x.title);
	}

	repositionYAxisTitle() {
		const yAxisRef = this.svg.select("g.y.axis");
		const tickHeight = this.getLargestTickHeight(yAxisRef.selectAll(".tick"));

		const yAxisTitleRef = this.svg.select("g.y.axis text.y.axis-label");

		const yAxisCenter = yAxisRef.node().getBBox().height / 2;
		const yAxisLabelWidth = this.innerWrap.select(".axis-label.y").node().getBBox().width;

		const yAxisTitleTranslate = {
			x: - yAxisCenter + yAxisLabelWidth / 2,
			y: - (tickHeight + Configuration.scales.tick.heightAddition)
		};

		// Align y axis title with y axis
		yAxisTitleRef.attr("class", "y axis-label")
		.attr("text-align", "center")
		.attr("transform", `rotate(-90) translate(${yAxisTitleTranslate.x}, ${yAxisTitleTranslate.y})`)
		.text(this.options.scales.y.title);
	}

	getYMax() {
		const { datasets } = this.displayData;
		const { scales } = this.options;
		let axisRange, yMin, yMax;

		if (datasets.length === 1) {
			yMin = min(datasets[0].data);
			yMax = max(datasets[0].data);
		} else {
			yMin = min(datasets, (d: any) => (min(d.data)));
			yMax = max(datasets, (d: any) => (max(d.data)));
		}

		if (scales.y.yMaxAdjuster) {
			yMax = scales.y.yMaxAdjuster(yMax);
		}

		if (yMin < 0) {
			axisRange = yMax - Math.min(yMin, 0);
			return yMin + axisRange * this.upperScaleY;
		} else {
			axisRange = yMax - Math.min(yMin, 0);
			return axisRange * this.upperScaleY;
		}
	}

	getYMin() {
		const { datasets } = this.displayData;
		const { scales } = this.options;
		let axisRange, yMin, yMax;

		if (datasets.length === 1) {
			yMin = min(datasets[0].data);
			yMax = max(datasets[0].data);
		} else {
			yMin = min(datasets, (d: any) => (min(d.data)));
			yMax = max(datasets, (d: any) => (max(d.data)));
		}

		if (scales.y.yMinAdjuster) {
			yMin = scales.y.yMinAdjuster(yMin);
		}

		if (yMin < 0) {
			axisRange = ((yMax - yMin));
			return yMin + axisRange * (1 - this.lowerScaleY);
		} else {
			axisRange = (yMax - 0);
			return axisRange * (1 - this.lowerScaleY);
		}
	}

	setYScale(zoom:any, yScale?: any) {
		const chartSize = this.getChartSize();
		const height = chartSize.height - this.innerWrap.select(".x.axis").node().getBBox().height;

		const { scales } = this.options;

		const yMin = this.getYMin();
		const yMax = this.getYMax();
		if (yScale) {
			this.y = yScale;
		} else {
			this.y = scaleLinear().range([height, 0]);

			if (this.lowerScaleY === 1) {
				this.y.domain([Math.min(yMin, 0), yMax]);
			} else {
				this.y.domain([yMin, yMax]);
			}
		}

		if (scales.y2 && scales.y2.ticks.max) {
			this.y2 = scaleLinear().rangeRound([height, 0]);
			this.y2.domain([scales.y2.ticks.min, scales.y2.ticks.max]);
		}

		const radius = Configuration.sliders.handles.radius;
		let sliderTop = 0;
		let sliderBottom = height;
		let sliderLength = Math.abs(sliderTop - sliderBottom);

		if (zoom === false){
			let line = this.svg.select(`#${this.chartContainerID}-slider-line`)
			let upperCircle = this.svg.select(`#${this.chartContainerID}-slider-circle-top`)
			let clipBox = this.svg.select(`#${this.chartContainerID}-clip`).selectAll("rect")

			const margins = Configuration.charts.margin;
			const clipboxWidth = this.getChartSize().width;
			const clipBoxHeight = this.getChartSize().height - margins.top - margins.bottom;
	
			line.attr("y2", sliderBottom - radius);
			upperCircle.attr("cy", sliderBottom);
			upperCircle.datum({"y": sliderBottom});
			clipBox.attr("width", clipboxWidth);
			clipBox.attr("height", clipBoxHeight);

			console.log(clipBoxHeight)
		}
	}

	setYAxis(noAnimation?: boolean) {
		const chartSize = this.getChartSize();

		const { scales } = this.options;
		const t = noAnimation ? this.getInstantTransition() : this.getDefaultTransition();

		const yAxis = axisLeft(this.y)
			.ticks(scales.y.numberOfTicks || Configuration.scales.y.numberOfTicks)
			.tickSize(0)
			.tickFormat(scales.y.formatter);

		let yAxisRef = this.svg.select("g.y.axis");
		const horizontalLine = this.svg.select("line.domain");

		horizontalLine.attr("clip-path", `url(#${this.chartContainerID}-clip)`)

		this.svg.select("g.x.axis path.domain")
			.remove();

		// If the <g class="y axis"> exists in the chart SVG, just update it
		if (yAxisRef.nodes().length > 0) {
			yAxisRef.transition(t)
				// Casting to any because d3 does not offer appropriate typings for the .call() function
				.call(yAxis as any);

			horizontalLine.transition(t)
				.attr("y1", this.y(0))
				.attr("y2", this.y(0))
				.attr("x1", 0)
				.attr("x2", chartSize.width);
		} else {
			yAxisRef = this.innerWrap.append("g")
				.attr("class", "y axis yAxes");

			yAxisRef.call(yAxis);

			yAxisRef.append("line")
				.classed("domain", true)
				.attr("y1", this.y(0))
				.attr("y2", this.y(0))
				.attr("x1", 0)
				.attr("x2", chartSize.width)
				.attr("stroke", Configuration.scales.domain.color)
				.attr("fill", Configuration.scales.domain.color)
				.attr("stroke-width", Configuration.scales.domain.strokeWidth);
		}

		const tickHeight = this.getLargestTickHeight(yAxisRef.selectAll(".tick"));

		// Add y-axis title
		if (this.innerWrap.select(".axis-label.y").nodes().length === 0 && this.options.scales.y.title) {
			yAxisRef.append("text")
				.attr("class", "y axis-label")
				.text(this.options.scales.y.title);

			const yAxisCenter = yAxisRef.node().getBBox().height / 2;
			const yAxisLabelWidth = this.innerWrap.select(".axis-label.y").node().getBBox().width;

			const yAxisTitleTranslate = {
				x: - yAxisCenter + yAxisLabelWidth / 2,
				y: - (tickHeight + Configuration.scales.tick.heightAddition)
			};

			// Align y axis title on the y axis
			this.innerWrap.select(".axis-label.y")
				.attr("transform", `rotate(-90) translate(${yAxisTitleTranslate.x}, ${yAxisTitleTranslate.y})`);
		}

		Tools.moveToFront(horizontalLine);

		if (scales.y2 && scales.y2.ticks.max) {
			const secondaryYAxis = axisRight(this.y2)
				.ticks(scales.y2.numberOfTicks || Configuration.scales.y2.numberOfTicks)
				.tickSize(0)
				.tickFormat(scales.y2.formatter);

			const secondaryYAxisRef = this.svg.select("g.y2.axis");
			// If the <g class="y axis"> exists in the chart SVG, just update it
			if (secondaryYAxisRef.nodes().length > 0) {
				secondaryYAxisRef.transition(t)
					.attr("transform", `translate(${this.getChartSize().width}, 0)`)
					// Being cast to any because d3 does not offer appropriate typings for the .call() function
					.call(secondaryYAxis as any);
			} else {
				this.innerWrap.append("g")
					.attr("class", "y2 axis yAxes")
					.attr("transform", `translate(${this.getChartSize().width}, 0)`)
					.call(secondaryYAxis);
			}
		}
	}

	drawXGrid() {
		const yHeight = this.getChartSize().height - this.getBBox(".x.axis").height;
		const xGrid = axisBottom(this.x)
			.tickSizeInner(-yHeight)
			.tickSizeOuter(0);

		const g = this.innerWrap.select(".x.grid")
			.attr("transform", `translate(0, ${yHeight})`)
			.call(xGrid);

		this.cleanGrid(g);
	}

	drawYGrid() {
		const { scales } = this.options;
		const { thresholds } = this.options.scales.y;
		const yHeight = this.getChartSize().height - this.getBBox(".x.axis").height;

		const yGrid = axisLeft(this.y)
			.tickSizeInner(-this.getChartSize().width)
			.tickSizeOuter(0);

		yGrid.ticks(scales.y.numberOfTicks || Configuration.scales.y.numberOfTicks);

		const g = this.innerWrap.select(".y.grid")
			.attr("transform", "translate(0, 0)")
			.call(yGrid);

		this.cleanGrid(g);

		if (thresholds && thresholds.length > 0) {
			this.addOrUpdateThresholds(g, false);
		}
	}

	addOrUpdateThresholds(yGrid, animate?) {
		const t = animate === false ? this.getInstantTransition() : this.getDefaultTransition();

		const width = this.getChartSize().width;
		const { thresholds } = this.options.scales.y;

		// Check if the thresholds container <g> exists
		const thresholdContainerExists = this.innerWrap.select("g.thresholds").nodes().length > 0;
		const thresholdRects = thresholdContainerExists
			? this.innerWrap.selectAll("g.thresholds rect")
			: this.innerWrap.append("g").classed("thresholds", true).selectAll("rect").data(thresholds);

		const calculateYPosition = d => {
			return Math.max(0, this.y(d.range[1]));
		};

		const calculateHeight = d => {
			const height = Math.abs(this.y(d.range[1]) - this.y(d.range[0]));
			const yMax = this.y(this.y.domain()[0]);

			// If the threshold is getting cropped because it is extending beyond
			// the top of the chart, update its height to reflect the crop
			if (this.y(d.range[1]) < 0) {
				return Math.max(0, height + this.y(d.range[1]));
			} else if (this.y(d.range[1]) + height > yMax) {
				// If the threshold is getting cropped because it is extending beyond
				// the bottom of the chart, update its height to reflect the crop
				return Math.max(0, yMax - calculateYPosition(d));
			}

			return Math.max(0, height);
		};

		const calculateOpacity = d => {
			const height = Math.abs(this.y(d.range[1]) - this.y(d.range[0]));

			// If the threshold is to be shown anywhere
			// outside of the top edge of the chart, hide it
			if (this.y(d.range[1]) + height <= 0) {
				return 0;
			}

			return 1;
		};

		// Applies to thresholds being added
		thresholdRects.enter()
			.append("rect")
			.classed("threshold-bar", true)
			.attr("x", 0)
			.attr("y", d => calculateYPosition(d))
			.attr("width", width)
			.attr("height", d => calculateHeight(d))
			.attr("fill", d => Configuration.scales.y.thresholds.colors[d.theme])
			.style("opacity", 0)
			.transition(t)
			.style("opacity", d => calculateOpacity(d));

		// Update thresholds
		thresholdRects
			.transition(t)
			.attr("x", 0)
			.attr("y", d => calculateYPosition(d))
			.attr("width", width)
			.attr("height", d => calculateHeight(d))
			.style("opacity", d => calculateOpacity(d))
			.attr("fill", d => Configuration.scales.y.thresholds.colors[d.theme]);

		// Applies to thresholds getting removed
		thresholdRects.exit()
			.transition(t)
			.style("opacity", 0)
			.remove();
	}

	updateXandYGrid(noAnimation?: boolean) {
		const { thresholds } = this.options.scales.y;

		// setTimeout is needed here, to take into account the new position of bars
		// Right after transitions are initiated for the
		setTimeout(() => {
			const t = noAnimation ? this.getInstantTransition() : this.getDefaultTransition();

			// Update X Grid
			const chartSize = this.getChartSize();
			const yHeight = chartSize.height - this.getBBox(".x.axis").height;
			const xGrid = axisBottom(this.x)
				.tickSizeInner(-yHeight)
				.tickSizeOuter(0);

			const g_xGrid = this.innerWrap.select(".x.grid")
				.transition(t)
				.attr("transform", `translate(0, ${yHeight})`)
				.call(xGrid);

			this.cleanGrid(g_xGrid);

			// Update Y Grid
			const yGrid = axisLeft(this.y)
				.tickSizeInner(-chartSize.width)
				.tickSizeOuter(0)
				.tickFormat("" as any);

			const g_yGrid = this.innerWrap.select(".y.grid")
				.transition(t)
				.attr("transform", `translate(0, 0)`)
				.call(yGrid);

			g_yGrid.transition(t);

			this.cleanGrid(g_yGrid);

			if (thresholds && thresholds.length > 0) {
				this.addOrUpdateThresholds(g_yGrid, !noAnimation);
			}
		}, 0);
	}

	cleanGrid(g) {
		g.selectAll("line")
			.attr("stroke", Configuration.grid.strokeColor);
		g.selectAll("text").style("display", "none").remove();
		g.select(".domain").style("stroke", "none");
	}

	// TODO - Refactor
	wrapTick(ticks) {
		const self = this;
		const letNum = Configuration.scales.tick.maxLetNum;
		ticks.each(function(t) {
			if (t && t.length > letNum / 2) {
				const tick = select(this);
				const y = tick.attr("y");
				tick.text("");
				const tspan1 = tick.append("tspan")
					.attr("x", 0).attr("y", y).attr("dx", Configuration.scales.dx).attr("dy", `-${Configuration.scales.tick.dy}`);
				const tspan2 = tick.append("tspan")
					.attr("x", 0).attr("y", y).attr("dx", Configuration.scales.dx).attr("dy", Configuration.scales.tick.dy);
				if (t.length < letNum - 3) {
					tspan1.text(t.substring(0, t.length / 2));
					tspan2.text(t.substring(t.length / 2 + 1, t.length));
				} else {
					tspan1.text(t.substring(0, letNum / 2));
					tspan2.text(t.substring(letNum / 2, letNum - 3) + "...");
					tick.on("click", dd => {
						self.showLabelTooltip(dd, true);
					});
				}
			}
		});
	}

	// TODO - Refactor
	getLargestTickHeight(ticks) {
		let largestHeight = 0;
		ticks.each(function() {
			let tickLength = 0;
			try {
				tickLength = this.getBBox().height;
			} catch (e) {
				console.log(e);
			}
			if (tickLength > largestHeight) {
				largestHeight = tickLength;
			}

		});
		return largestHeight;
	}

	/**************************************
	 *  Events & User interactions        *
	 *************************************/
	addDataPointEventListener() {
		console.warn("You should implement your own `addDataPointEventListener()` function.");
	}
}
