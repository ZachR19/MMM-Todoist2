/* global Log */

/* Magic Mirror
 * Module: MMM-Todoist2 -- Shared display helpers
 *
 * The pieces shared by the list, kanban and calendar displays: priority
 * mapping, group accents, the icon set, task text extraction and date
 * formatting.
 *
 * MIT Licensed.
 */

const MMMTodoist2Display = {

	// Todoist priority 4 is p1 (urgent) and 1 is p4 (low)
	PRIORITY_KEYS: {
		4: "urgent",
		3: "high",
		2: "medium",
		1: "low"
	},

	PRIORITY_LABELS: {
		urgent: "Urgent",
		high: "High",
		medium: "Medium",
		low: "Low"
	},

	// Group accents, assigned in display order. Each key maps to a pair of
	// theme colours in MMM-Todoist2-display.css.
	ACCENT_KEYS: ["daily", "weekly", "bimonthly", "monthly", "quarterly"],

	/**
	 * The accent key for the group at a given position, cycling through
	 * ACCENT_KEYS.
	 *
	 * @param {number} index the group's position in display order
	 * @returns {string} the accent key
	 */
	accentKey: function (index) {
		return this.ACCENT_KEYS[index % this.ACCENT_KEYS.length];
	},

	// The date the module uses to mean "no due date"
	NO_DUE_DATE: "2100-12-31",

	ICONS: {
		calendar:
			"<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor'" +
			" stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
			"<rect x='3' y='4' width='18' height='18' rx='2' ry='2'/>" +
			"<line x1='16' y1='2' x2='16' y2='6'/>" +
			"<line x1='8' y1='2' x2='8' y2='6'/>" +
			"<line x1='3' y1='10' x2='21' y2='10'/></svg>",

		recurring:
			"<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor'" +
			" stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-label='Recurring task'>" +
			"<path d='M17 2l4 4-4 4'/>" +
			"<path d='M3 11V9a4 4 0 0 1 4-4h14'/>" +
			"<path d='M7 22l-4-4 4-4'/>" +
			"<path d='M21 13v2a4 4 0 0 1-4 4H3'/></svg>",

		// Smaller, heavier stroke so it stays legible at chip size
		recurringSmall:
			"<svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor'" +
			" stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' aria-label='Recurring task'>" +
			"<path d='M17 2l4 4-4 4'/>" +
			"<path d='M3 11V9a4 4 0 0 1 4-4h14'/>" +
			"<path d='M7 22l-4-4 4-4'/>" +
			"<path d='M21 13v2a4 4 0 0 1-4 4H3'/></svg>"
	},

	///////////////////////////////////////////////
	// TASK HELPERS
	///////////////////////////////////////////////

	/**
	 * The priority key for a task, ex. "urgent".
	 *
	 * @param {object} item a Todoist task
	 * @returns {string} the priority key
	 */
	priorityKey: function (item) {
		return this.PRIORITY_KEYS[item.priority] || "low";
	},

	/**
	 * The task title as plain text. The node helper renders task content to
	 * HTML through showdown; the displays show the text only, so markdown
	 * markup never reaches the DOM.
	 *
	 * @param {object} item a Todoist task
	 * @returns {string} the task title
	 */
	taskText: function (item) {
		if (!item.contentHtml)
			return item.content || "";

		var temp = document.createElement("div");
		temp.innerHTML = item.contentHtml;

		return (temp.textContent || "").trim();
	},

	/**
	 * The name of the Todoist section a task belongs to, if any.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {object} item a Todoist task
	 * @returns {string} the section name, or the configured fallback label
	 */
	sectionLabel: function (module, item) {
		if (item.section && item.section.name)
			return item.section.name;

		return module.config.unsectionedKanbanColumnLabel || "Other";
	},

	/**
	 * A section's position within its project, as Todoist orders them.
	 *
	 * @param {object} section a Todoist section
	 * @returns {number} the position, or Number.MAX_SAFE_INTEGER when unknown
	 */
	sectionOrder: function (section) {
		if (section && typeof section.section_order === "number")
			return section.section_order;

		return Number.MAX_SAFE_INTEGER;
	},

	/**
	 * Whether a task has a real due date, as opposed to the sentinel the
	 * module assigns to tasks without one.
	 *
	 * @param {object} item a Todoist task
	 * @returns {boolean} true when the task has a due date
	 */
	hasDueDate: function (item) {
		return !!(item.due && item.due.date && item.due.date !== this.NO_DUE_DATE);
	},

	/**
	 * A task's due date, with the time of day stripped, or null.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {object} item a Todoist task
	 * @returns {Date|null} midnight on the task's due date
	 */
	dueDay: function (module, item) {
		if (!this.hasDueDate(item))
			return null;

		var due = module.parseDueDate(item.due.date);

		return new Date(due.getFullYear(), due.getMonth(), due.getDate());
	},

	/**
	 * A stable key for a calendar day, ex. "2026-8-18".
	 *
	 * @param {Date} date any date
	 * @returns {string} the key
	 */
	dateKey: function (date) {
		return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
	},

	///////////////////////////////////////////////
	// DATE FORMATTING
	///////////////////////////////////////////////

	/**
	 * Format a due date as short, relative text ("Today", "Tue", "Mar 4").
	 *
	 * `status` is "overdue", "today" or "tomorrow" for tasks due in that
	 * window, and "" otherwise. `overdue` mirrors status === "overdue".
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {object} item a Todoist task
	 * @returns {object} { text, overdue, status }
	 */
	formatDueDate: function (module, item) {
		if (!this.hasDueDate(item))
			return { text: "", overdue: false, status: "" };

		var oneDay = 24 * 60 * 60 * 1000;
		var dueDateTime = module.parseDueDate(item.due.date);
		var dueDate = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth(), dueDateTime.getDate());
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var diffDays = Math.floor((dueDate - today) / oneDay);
		var diffMonths = (dueDate.getFullYear() * 12 + dueDate.getMonth()) - (now.getFullYear() * 12 + now.getMonth());
		var language = this.language();

		var text = "";
		var overdue = false;
		var status = "";

		if (diffDays < -1) {
			text = dueDate.toLocaleDateString(language, { "month": "short" }) + " " + dueDate.getDate();
			overdue = true;
		}
		else if (diffDays === -1) {
			text = module.translate("YESTERDAY");
			overdue = true;
		}
		else if (diffDays === 0) {
			text = module.translate("TODAY");
			overdue = !item.all_day && dueDateTime < now;
			status = overdue ? "" : "today";
		}
		else if (diffDays === 1) {
			text = module.translate("TOMORROW");
			status = "tomorrow";
		}
		else if (diffDays < 7) {
			text = dueDate.toLocaleDateString(language, { "weekday": "short" });
		}
		else if (diffMonths < 7 || dueDate.getFullYear() === now.getFullYear()) {
			text = dueDate.toLocaleDateString(language, { "month": "short" }) + " " + dueDate.getDate();
		}
		else {
			text = dueDate.toLocaleDateString(language, { "month": "short" }) + " " + dueDate.getDate() + " " + dueDate.getFullYear();
		}

		if (overdue)
			status = "overdue";

		// Keep the time on timed tasks
		if (text !== "" && !item.all_day)
			text += this.formatTime(dueDateTime);

		return { text: text, overdue: overdue, status: status };
	},

	formatTime: function (date) {
		function pad(n) {
			return (n < 10 ? "0" : "") + n;
		}

		var hours = date.getHours();
		var minutes = pad(date.getMinutes());

		if (this.timeFormat() == 12)
			return " " + (hours % 12 || 12) + ":" + minutes + (hours < 12 ? " AM" : " PM");

		return " " + hours + ":" + minutes;
	},

	/**
	 * The MagicMirror language, falling back to the browser default.
	 *
	 * @returns {string|undefined} a locale, or undefined
	 */
	language: function () {
		return (typeof config !== "undefined" && config.language) ? config.language : undefined;
	},

	/**
	 * The MagicMirror clock format.
	 *
	 * @returns {number} 12 or 24
	 */
	timeFormat: function () {
		return (typeof config !== "undefined" && config.timeFormat) ? config.timeFormat : 24;
	},

	///////////////////////////////////////////////
	// UI HELPERS
	///////////////////////////////////////////////

	createElement: function (tag, className, text) {
		var el = document.createElement(tag);

		if (className)
			el.className = className;

		if (text !== undefined && text !== null)
			el.textContent = text;

		return el;
	},

	/**
	 * The header shared by every display: a title, a subtitle and the
	 * priority legend.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {string} title the display title
	 * @param {string} subtitle a line under the title, or "" for none
	 * @param {boolean} showLegend whether to show the priority legend
	 * @returns {HTMLElement} the header element
	 */
	createHeader: function (module, title, subtitle, showLegend) {
		var self = this;

		var header = this.createElement("header", "t2-header");
		var titleBlock = this.createElement("div");

		titleBlock.appendChild(this.createElement("h1", "t2-title", title));

		if (subtitle)
			titleBlock.appendChild(this.createElement("p", "t2-subtitle", subtitle));

		header.appendChild(titleBlock);

		if (showLegend) {
			var legend = this.createElement("div", "t2-legend");

			["urgent", "high", "medium", "low"].forEach(function (priority) {
				var entry = self.createElement("div", "t2-legend-item");
				entry.appendChild(self.createElement("div", "t2-legend-dot t2-priority-" + priority));
				entry.appendChild(self.createElement("span", "t2-legend-label", self.PRIORITY_LABELS[priority]));
				legend.appendChild(entry);
			});

			header.appendChild(legend);
		}

		return header;
	},

	/**
	 * "1 task" / "5 tasks", for the various counts the displays show.
	 *
	 * @param {number} count how many tasks
	 * @returns {string} the pluralised phrase
	 */
	taskCount: function (count) {
		return count + (count === 1 ? " task" : " tasks");
	}
};
