/* global MMMTodoist2Display */

/* Magic Mirror
 * Module: MMM-Todoist2 -- Calendar display
 *
 * Read-only month calendar renderer. This file is only loaded when the module
 * config sets `displayMode: "calendar"`; the list display in MMM-Todoist2.js
 * does not depend on anything here.
 *
 * Shared design tokens and helpers live in MMM-Todoist2-display.{css,js}.
 *
 * MIT Licensed.
 */

const MMMTodoist2Calendar = {

	DAYS_PER_WEEK: 7,
	WEEKS_SHOWN: 6,

	///////////////////////////////////////////////
	// ENTRY POINT
	///////////////////////////////////////////////

	/**
	 * Build the whole calendar.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {HTMLElement} the calendar element
	 */
	render: function (module, items) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		var root = shared.createElement("div", "mmm-todoist2-display mmm-todoist2-calendar");

		var tasksByDate = this.groupByDate(module, items);
		var month = this.monthInView(config);
		var cells = this.buildCells(config, month);

		if (config.showCalendarHeader) {
			root.appendChild(shared.createHeader(
				module,
				config.calendarTitle || module.data.header || "My Tasks",
				"",
				config.showCalendarLegend));
		}

		root.appendChild(this.createMonthRow(module, month, cells, tasksByDate));
		root.appendChild(this.createGrid(module, cells, tasksByDate));

		return root;
	},

	///////////////////////////////////////////////
	// DATA SHAPING
	///////////////////////////////////////////////

	/**
	 * Bucket the tasks by the day they are due. Tasks without a due date
	 * cannot be placed on a calendar, so they are left out.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {object} a map of date key to tasks, in their sorted order
	 */
	groupByDate: function (module, items) {
		var shared = MMMTodoist2Display;
		var byDate = {};

		(items || []).forEach(function (item) {
			var day = shared.dueDay(module, item);

			if (!day)
				return;

			var key = shared.dateKey(day);

			if (!byDate[key])
				byDate[key] = [];

			byDate[key].push(item);
		});

		return byDate;
	},

	/**
	 * The first of the month the calendar shows: this month, shifted by
	 * calendarMonthOffset.
	 *
	 * @param {object} config the module config
	 * @returns {Date} the first day of the month in view
	 */
	monthInView: function (config) {
		var offset = typeof config.calendarMonthOffset === "number" ? config.calendarMonthOffset : 0;
		var now = new Date();

		return new Date(now.getFullYear(), now.getMonth() + offset, 1);
	},

	/**
	 * Build the grid of day cells, padded with the tail of the previous month
	 * and the head of the next so that every row is full.
	 *
	 * @param {object} config the module config
	 * @param {Date} month the first day of the month in view
	 * @returns {Array} the cells, in grid order
	 */
	buildCells: function (config, month) {
		var year = month.getFullYear();
		var monthIndex = month.getMonth();
		var weekStart = this.weekStart(config);

		// How many days of the previous month lead the first row
		var leading = (month.getDay() - weekStart + this.DAYS_PER_WEEK) % this.DAYS_PER_WEEK;
		var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

		var cells = [];

		for (var lead = leading; lead > 0; lead--)
			cells.push({ date: new Date(year, monthIndex, 1 - lead), isCurrentMonth: false });

		for (var day = 1; day <= daysInMonth; day++)
			cells.push({ date: new Date(year, monthIndex, day), isCurrentMonth: true });

		// Fill the last row, and pad to a fixed six rows when asked so that the
		// calendar does not change height from month to month
		var rows = config.calendarAlwaysSixWeeks
			? this.WEEKS_SHOWN
			: Math.ceil(cells.length / this.DAYS_PER_WEEK);

		var total = rows * this.DAYS_PER_WEEK;

		for (var trail = 1; cells.length < total; trail++)
			cells.push({ date: new Date(year, monthIndex + 1, trail), isCurrentMonth: false });

		return cells;
	},

	/**
	 * The day of the week the grid starts on, 0 being Sunday.
	 *
	 * @param {object} config the module config
	 * @returns {number} 0 to 6
	 */
	weekStart: function (config) {
		var start = Number(config.calendarWeekStartsOn);

		return (Number.isInteger(start) && start >= 0 && start <= 6) ? start : 0;
	},

	///////////////////////////////////////////////
	// UI METHODS BELOW
	///////////////////////////////////////////////

	createMonthRow: function (module, month, cells, tasksByDate) {
		var shared = MMMTodoist2Display;

		var row = shared.createElement("div", "cal-month-row");
		var block = shared.createElement("div");

		var heading = shared.createElement("h2", "cal-month",
			month.toLocaleDateString(shared.language(), { month: "long", year: "numeric" }));
		block.appendChild(heading);

		// Only the days of the month in view count towards the total
		var due = cells.reduce(function (sum, cell) {
			if (!cell.isCurrentMonth)
				return sum;

			var tasks = tasksByDate[shared.dateKey(cell.date)];

			return sum + (tasks ? tasks.length : 0);
		}, 0);

		if (due > 0)
			block.appendChild(shared.createElement("p", "cal-month-count", shared.taskCount(due) + " due this month"));

		row.appendChild(block);

		return row;
	},

	createGrid: function (module, cells, tasksByDate) {
		var self = this;
		var shared = MMMTodoist2Display;
		var config = module.config;

		var grid = shared.createElement("div", "cal-grid");

		// Weekday headings, named in the mirror's language
		var headings = shared.createElement("div", "cal-weekdays");
		var weekStart = this.weekStart(config);

		// Any week in the past works as a source of weekday names; this one
		// starts on a Sunday
		var reference = new Date(2024, 0, 7);

		for (var day = 0; day < this.DAYS_PER_WEEK; day++) {
			var named = new Date(reference.getFullYear(), reference.getMonth(),
				reference.getDate() + ((weekStart + day) % this.DAYS_PER_WEEK));

			headings.appendChild(shared.createElement("div", "cal-weekday",
				named.toLocaleDateString(shared.language(), { weekday: "short" })));
		}

		grid.appendChild(headings);

		var days = shared.createElement("div", "cal-days");
		var now = new Date();
		var todayKey = shared.dateKey(now);

		cells.forEach(function (cell) {
			var isToday = config.highlightTodayInCalendar && shared.dateKey(cell.date) === todayKey;

			days.appendChild(self.createDayCell(module, cell, tasksByDate[shared.dateKey(cell.date)] || [], isToday));
		});

		grid.appendChild(days);

		return grid;
	},

	createDayCell: function (module, cell, tasks, isToday) {
		var self = this;
		var shared = MMMTodoist2Display;
		var config = module.config;

		var className = "cal-day";

		if (isToday)
			className += " cal-day-today";

		if (!cell.isCurrentMonth)
			className += " cal-day-outside";

		var dayEl = shared.createElement("div", className);

		// Day number, plus how many tasks fall on it
		var head = shared.createElement("div", "cal-day-head");
		head.appendChild(shared.createElement("span", "cal-day-number", cell.date.getDate()));

		if (tasks.length > 0 && config.showCalendarDayTaskCounts)
			head.appendChild(shared.createElement("span", "cal-day-count", shared.taskCount(tasks.length)));

		dayEl.appendChild(head);

		var limit = config.maximumEntriesPerCalendarDay;
		var visible = (typeof limit === "number" && limit > 0) ? tasks.slice(0, limit) : tasks;

		visible.forEach(task => dayEl.appendChild(self.createChip(module, task)));

		var hidden = tasks.length - visible.length;

		if (hidden > 0)
			dayEl.appendChild(shared.createElement("span", "t2-more cal-more", "+" + hidden + " more"));

		return dayEl;
	},

	createChip: function (module, item) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		var chip = shared.createElement("div", "cal-chip");
		var priorityKey = shared.priorityKey(item);
		var title = shared.taskText(item);

		// Cells are too small for the meta a kanban card shows, so the full
		// detail goes in the tooltip instead
		chip.title = title + " · " + shared.PRIORITY_LABELS[priorityKey] +
			" · " + shared.sectionLabel(module, item);

		chip.appendChild(shared.createElement("div", "cal-chip-dot t2-priority-" + priorityKey));
		var titleEl = shared.createElement("span", "cal-chip-title");
		var text = module.shorten(title, config.maxTitleLength, config.wrapEvents);
		text.replace(/&hellip;/g, "…").split("<br>").forEach(function (line, index) {
			if (index > 0)
				titleEl.appendChild(document.createElement("br"));
			titleEl.appendChild(document.createTextNode(line));
		});
		chip.appendChild(titleEl);

		if (item.due && item.due.is_recurring) {
			var recurring = shared.createElement("span", "cal-chip-recurring");
			recurring.innerHTML = shared.ICONS.recurringSmall;
			chip.appendChild(recurring);
		}

		return chip;
	}
};
