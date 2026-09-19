/* global MMMTodoist2Display */

/* Magic Mirror
 * Module: MMM-Todoist2 -- Kanban display
 *
 * Read-only kanban taskboard renderer. This file is only loaded when the
 * module config sets `displayMode: "kanban"`; the list display in
 * MMM-Todoist2.js does not depend on anything here.
 *
 * Shared design tokens and helpers live in MMM-Todoist2-display.{css,js}.
 *
 * MIT Licensed.
 */

const MMMTodoist2Kanban = {

	///////////////////////////////////////////////
	// ENTRY POINT
	///////////////////////////////////////////////

	/**
	 * Build the whole board.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {HTMLElement} the board element
	 */
	render: function (module, items) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		var board = shared.createElement("div", "mmm-todoist2-display mmm-todoist2-kanban");

		var columns = this.buildColumns(module, items);

		if (config.showKanbanHeader) {
			// Count what is actually on the board, not what was fetched
			var shown = columns.reduce((sum, column) => sum + column.tasks.length, 0);
			var subtitle = shared.taskCount(shown) + " across " +
				columns.length + (columns.length === 1 ? " section" : " sections");

			board.appendChild(shared.createHeader(
				module,
				config.kanbanTitle || module.data.header || "My Tasks",
				subtitle,
				config.showKanbanLegend));
		}

		var main = shared.createElement("div", "kb-board");
		var columnsEl = shared.createElement("div", "kb-columns");

		columns.forEach(column => columnsEl.appendChild(this.createColumn(module, column)));

		main.appendChild(columnsEl);
		board.appendChild(main);

		return board;
	},

	///////////////////////////////////////////////
	// DATA SHAPING
	///////////////////////////////////////////////

	/**
	 * Group the tasks into columns, one per Todoist section.
	 *
	 * Sections sharing a name across projects are merged into a single column
	 * unless mergeKanbanColumnsByName is false. Column order follows
	 * kanbanColumnOrder first, then the section order reported by Todoist.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {Array} the columns, in display order
	 */
	buildColumns: function (module, items) {
		var config = module.config;
		var columns = {};
		var order = [];

		var explicitOrder = Array.isArray(config.kanbanColumnOrder)
			? config.kanbanColumnOrder.map(name => String(name).toLowerCase())
			: [];

		// Seed the columns named in kanbanColumnOrder so they keep their
		// configured order and can be shown even when they hold no tasks.
		// Only possible when columns are keyed by name -- otherwise a seeded
		// column could never be matched to a section and would sit empty.
		if (config.mergeKanbanColumnsByName) {
			explicitOrder.forEach(function (name, index) {
				var key = "name:" + name;

				columns[key] = {
					key: key,
					label: config.kanbanColumnOrder[index],
					tasks: [],
					explicitIndex: index,
					sectionOrder: Number.MAX_SAFE_INTEGER,
					unsectioned: false
				};
				order.push(key);
			});
		}

		(items || []).forEach(function (item) {
			var section = item.section;

			if (!section && !config.showUnsectionedKanbanColumn)
				return;

			var label = section ? section.name : config.unsectionedKanbanColumnLabel;
			var key;

			if (!section)
				key = "unsectioned";
			else if (config.mergeKanbanColumnsByName)
				key = "name:" + String(label).toLowerCase();
			else
				key = "section:" + section.id;

			if (!columns[key]) {
				var explicitIndex = explicitOrder.indexOf(String(label).toLowerCase());

				columns[key] = {
					key: key,
					label: label,
					tasks: [],
					explicitIndex: explicitIndex,
					sectionOrder: Number.MAX_SAFE_INTEGER,
					unsectioned: !section
				};
				order.push(key);
			}

			// Keep the lowest section order seen, so merged columns sort sanely
			if (section)
				columns[key].sectionOrder = Math.min(columns[key].sectionOrder, MMMTodoist2Display.sectionOrder(section));

			columns[key].tasks.push(item);
		});

		var list = order.map(key => columns[key]);

		list.sort(function (a, b) {
			// The unsectioned bucket always goes last
			if (a.unsectioned !== b.unsectioned)
				return a.unsectioned ? 1 : -1;

			// Columns named in kanbanColumnOrder come first, in that order
			var aExplicit = a.explicitIndex > -1;
			var bExplicit = b.explicitIndex > -1;

			if (aExplicit !== bExplicit)
				return aExplicit ? -1 : 1;

			if (aExplicit && bExplicit)
				return a.explicitIndex - b.explicitIndex;

			if (a.sectionOrder !== b.sectionOrder)
				return a.sectionOrder - b.sectionOrder;

			return String(a.label).localeCompare(String(b.label));
		});

		if (config.hideEmptyKanbanColumns)
			list = list.filter(column => column.tasks.length > 0);

		// Assign the group accent colours in board order
		list.forEach(function (column, index) {
			column.colorKey = MMMTodoist2Display.accentKey(index);
		});

		return list;
	},

	///////////////////////////////////////////////
	// UI METHODS BELOW
	///////////////////////////////////////////////

	createColumn: function (module, column) {
		var self = this;
		var shared = MMMTodoist2Display;
		var config = module.config;

		var columnEl = shared.createElement("div", "kb-column");
		columnEl.dataset.color = column.colorKey;

		// Column header
		var headerEl = shared.createElement("div", "kb-column-header");
		var heading = shared.createElement("div", "kb-column-heading");

		heading.appendChild(shared.createElement("div", "kb-column-dot"));

		var label = shared.createElement("span", "kb-column-label", column.label);
		label.title = column.label;
		heading.appendChild(label);

		headerEl.appendChild(heading);

		// The count is the full number of tasks in the section, including any
		// hidden by the per-column cap
		headerEl.appendChild(shared.createElement("span", "kb-column-count", column.tasks.length));
		columnEl.appendChild(headerEl);

		// Task list
		var tasksEl = shared.createElement("div", "kb-tasks");

		var limit = config.maximumEntriesPerKanbanColumn;
		var visible = (typeof limit === "number" && limit > 0)
			? column.tasks.slice(0, limit)
			: column.tasks;

		visible.forEach(task => tasksEl.appendChild(self.createCard(module, task)));

		var hidden = column.tasks.length - visible.length;

		if (hidden > 0)
			tasksEl.appendChild(shared.createElement("div", "t2-more kb-more", "+" + hidden + " more"));

		columnEl.appendChild(tasksEl);

		return columnEl;
	},

	createCard: function (module, item) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		var card = shared.createElement("div", "kb-card" + (item.parent_id ? " kb-subtask" : ""));

		// Title row: priority circle plus the task text
		var titleRow = shared.createElement("div", "kb-card-title-row");
		var priorityKey = shared.priorityKey(item);

		var priority = shared.createElement("div", "kb-priority-dot t2-priority-" + priorityKey);
		priority.title = shared.PRIORITY_LABELS[priorityKey] + " priority";
		titleRow.appendChild(priority);

		var titleEl = shared.createElement("span", "kb-card-title");
		var text = module.shorten(shared.taskText(item), config.maxTitleLength, config.wrapEvents);
		text.replace(/&hellip;/g, "…").split("<br>").forEach(function (line, index) {
			if (index > 0)
				titleEl.appendChild(document.createElement("br"));
			titleEl.appendChild(document.createTextNode(line));
		});
		titleEl.title = shared.taskText(item);
		titleRow.appendChild(titleEl);
		card.appendChild(titleRow);

		// Meta row: due date and the recurring marker
		var meta = shared.createElement("div", "kb-card-meta");
		var due = shared.formatDueDate(module, item);

		var dueEl = shared.createElement("div", "kb-due" +
			(due.overdue && config.highlightOverdueKanbanTasks ? " kb-due-overdue" : ""));

		if (due.text !== "") {
			dueEl.innerHTML = shared.ICONS.calendar;
			dueEl.appendChild(shared.createElement("span", "kb-due-text", due.text));
		}

		meta.appendChild(dueEl);

		if (item.due && item.due.is_recurring) {
			var recurring = shared.createElement("div", "kb-recurring");
			recurring.title = "Recurring task";
			recurring.innerHTML = shared.ICONS.recurring;
			meta.appendChild(recurring);
		}

		card.appendChild(meta);

		return card;
	}
};
