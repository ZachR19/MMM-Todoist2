/* global MMMTodoist2Display */

/* Magic Mirror
 * Module: MMM-Todoist2 -- List display
 *
 * The default task list renderer, used when the module config sets
 * `displayMode: "list"` (or leaves it unset). It shares its shell, header,
 * priority rings and group accents with the kanban and calendar displays, so
 * all three look like one design.
 *
 * Tasks can optionally be grouped by project, by section, or both (sections
 * nested inside their project). The list renders whatever the module has
 * already fetched, filtered and sorted -- it never mutates tasks and never
 * calls back to Todoist.
 *
 * Shared design tokens and helpers live in MMM-Todoist2-display.{css,js}.
 *
 * MIT Licensed.
 */

const MMMTodoist2List = {

	///////////////////////////////////////////////
	// ENTRY POINT
	///////////////////////////////////////////////

	/**
	 * Build the whole list.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {HTMLElement} the list element
	 */
	render: function (module, items) {
		var self = this;
		var shared = MMMTodoist2Display;
		var config = module.config;

		items = items || [];

		var root = shared.createElement("div", "mmm-todoist2-display mmm-todoist2-list");
		var groups = this.buildGroups(module, items);

		if (config.showListHeader) {
			var subtitle = shared.taskCount(items.length);

			if (groups.length > 0 && groups[0].label !== null) {
				var noun = config.groupByProject ? "project" : "section";
				subtitle += " across " + groups.length + " " + noun + (groups.length === 1 ? "" : "s");
			}

			root.appendChild(shared.createHeader(
				module,
				config.listTitle || module.data.header || "My Tasks",
				subtitle,
				config.showListLegend));
		}

		var body = shared.createElement("div", "ls-body");

		if (items.length === 0)
			body.appendChild(shared.createElement("div", "ls-empty", "No tasks"));

		groups.forEach(function (group, index) {
			body.appendChild(self.createGroup(module, group, index));
		});

		root.appendChild(body);

		if (config.fade && config.fadePoint < 1)
			this.applyFade(root, config);

		return root;
	},

	///////////////////////////////////////////////
	// DATA SHAPING
	///////////////////////////////////////////////

	/**
	 * Group the tasks for display.
	 *
	 * - Neither groupByProject nor groupBySection: one unlabelled group.
	 * - groupByProject: one group per project, in Todoist's project order.
	 * - groupBySection: one group per section, in Todoist's section order.
	 *   Sections sharing a name across projects are merged, and tasks outside
	 *   any section form a final group labelled unsectionedListGroupLabel.
	 * - Both: project groups, each holding its tasks split by section. Tasks
	 *   outside any section come first with no subheading, as in Todoist.
	 *
	 * Tasks keep the module's sortOrder within each group.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {Array} items the already filtered and sorted tasks
	 * @returns {Array} groups of { key, label, tasks, sections }
	 */
	buildGroups: function (module, items) {
		var self = this;
		var config = module.config;

		if (items.length === 0)
			return [];

		if (config.groupByProject) {
			var projects = this.groupBy(items,
				item => this.projectGroupKey(item),
				item => ({
					label: item.project ? item.project.name : "",
					order: item.project && typeof item.project.child_order === "number"
						? item.project.child_order
						: Number.MAX_SAFE_INTEGER,
					last: false
				}));

			if (config.groupBySection) {
				projects.forEach(function (project) {
					project.sections = self.groupBy(project.tasks,
						item => item.section ? "section:" + item.section.id : "unsectioned",
						item => ({
							label: item.section ? item.section.name : null,
							order: item.section ? MMMTodoist2Display.sectionOrder(item.section) : -1,
							last: false
						}));
				});
			}

			return projects;
		}

		if (config.groupBySection) {
			return this.groupBy(items,
				item => item.section ? "name:" + String(item.section.name).toLowerCase() : "unsectioned",
				item => ({
					label: item.section ? item.section.name : (config.unsectionedListGroupLabel || "Other"),
					order: item.section ? MMMTodoist2Display.sectionOrder(item.section) : Number.MAX_SAFE_INTEGER,
					last: !item.section
				}));
		}

		return [{ key: "all", label: null, tasks: items.slice() }];
	},

	projectGroupKey: function (item) {
		return "project:" + (item.project ? item.project.id : item.project_id);
	},

	/**
	 * Split tasks into groups, keeping task order within each group, then
	 * order the groups: `last` groups at the end, then by `order` (the lowest
	 * seen, so merged groups sort sanely), then by first appearance.
	 *
	 * @param {Array} items tasks, already sorted
	 * @param {Function} keyOf task -> group key
	 * @param {Function} describe task -> { label, order, last } for a new group
	 * @returns {Array} groups of { key, label, tasks }
	 */
	groupBy: function (items, keyOf, describe) {
		var groups = {};
		var list = [];

		items.forEach(function (item) {
			var key = keyOf(item);
			var info = describe(item);

			if (!groups[key]) {
				groups[key] = {
					key: key,
					label: info.label,
					order: info.order,
					last: info.last,
					firstSeen: list.length,
					tasks: []
				};
				list.push(groups[key]);
			}

			groups[key].order = Math.min(groups[key].order, info.order);
			groups[key].tasks.push(item);
		});

		return list.sort(function (a, b) {
			if (a.last !== b.last)
				return a.last ? 1 : -1;

			if (a.order !== b.order)
				return a.order - b.order;

			return a.firstSeen - b.firstSeen;
		});
	},

	///////////////////////////////////////////////
	// UI METHODS BELOW
	///////////////////////////////////////////////

	createGroup: function (module, group, index) {
		var self = this;
		var shared = MMMTodoist2Display;
		var config = module.config;

		// An unlabelled group is the plain, ungrouped list
		if (group.label === null) {
			var plain = shared.createElement("div", "ls-tasks");
			group.tasks.forEach(task => plain.appendChild(self.createTask(module, task)));
			return plain;
		}

		var groupEl = shared.createElement("section", "ls-group");
		groupEl.dataset.color = shared.accentKey(index);

		var header = shared.createElement("div", "ls-group-header");
		var heading = shared.createElement("div", "ls-group-heading");

		heading.appendChild(shared.createElement("div", "ls-group-dot"));

		var label = shared.createElement("span", "ls-group-label", group.label);
		label.title = group.label;
		heading.appendChild(label);

		header.appendChild(heading);

		// Create the count display
		var countEl = shared.createElement("span", "ls-group-count");
		countEl.textContent = this.formatGroupCount(group);
		header.appendChild(countEl);
		groupEl.appendChild(header);

		var tasksEl = shared.createElement("div", "ls-tasks");

		if (group.sections) {
			group.sections.forEach(function (section) {
				if (section.label !== null) {
					var sub = shared.createElement("div", "ls-subheader");
					sub.appendChild(shared.createElement("span", "ls-subheader-label", section.label));

					// Format section count with limit
					var limit = config.maximumEntriesPerSectionGroup;
					var visible = (typeof limit === "number" && limit > 0) ? Math.min(section.tasks.length, limit) : section.tasks.length;
					var hidden = section.tasks.length - visible;
					var countText = visible + (hidden > 0 ? " (" + hidden + " hidden)" : "");

					sub.appendChild(shared.createElement("span", "ls-subheader-count", countText));
					tasksEl.appendChild(sub);
				}

				// Show limited tasks for section
				var limit = config.maximumEntriesPerSectionGroup;
				var visibleTasks = (typeof limit === "number" && limit > 0)
					? section.tasks.slice(0, limit)
					: section.tasks;

				visibleTasks.forEach(task => tasksEl.appendChild(self.createTask(module, task)));
			});
		}
		else {
			// Apply limit when grouping by project (but not section)
			var limit = config.groupByProject ? config.maximumEntriesPerProjectGroup : null;
			var visibleTasks = (typeof limit === "number" && limit > 0)
				? group.tasks.slice(0, limit)
				: group.tasks;

			visibleTasks.forEach(task => tasksEl.appendChild(self.createTask(module, task)));

			// Show "+N more" if tasks are hidden in this group
			var hidden = group.tasks.length - visibleTasks.length;
			if (hidden > 0) {
				tasksEl.appendChild(shared.createElement("div", "t2-more ls-more", "+" + hidden + " more"));
			}
		}

		groupEl.appendChild(tasksEl);

		return groupEl;
	},

	formatGroupCount: function (group) {
		var total = group.tasks.length;

		// If this group has sections, count tasks across all sections
		if (group.sections) {
			total = group.sections.reduce(function (sum, section) {
				return sum + section.tasks.length;
			}, 0);
		}

		return total.toString();
	},

	createTask: function (module, item) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		// Subtasks sit under their parent only when sorted in Todoist order
		var indent = item.parent_id && this.sortsByTodoist(config);
		var row = shared.createElement("div", "ls-task" + (indent ? " ls-subtask" : ""));

		var priorityKey = shared.priorityKey(item);
		var priority = shared.createElement("div", "ls-priority-dot t2-priority-" + priorityKey);
		priority.title = shared.PRIORITY_LABELS[priorityKey] + " priority";
		row.appendChild(priority);

		// Title, with the project underneath when it is not already a group
		var main = shared.createElement("div", "ls-task-main");
		main.appendChild(this.createTitle(module, item));

		if (config.showProject && !config.groupByProject && item.project)
			main.appendChild(shared.createElement("div", "ls-task-project", item.project.name));

		row.appendChild(main);

		// Due date and recurring marker
		var due = shared.formatDueDate(module, item);
		var isRecurring = item.due && item.due.is_recurring;

		if (due.text !== "" || isRecurring) {
			var meta = shared.createElement("div", "ls-task-meta");

			if (due.text !== "")
				meta.appendChild(shared.createElement("span",
					"ls-due" + (due.status ? " ls-due-" + due.status : ""), due.text));

			if (isRecurring) {
				var recurring = shared.createElement("span", "ls-recurring");
				recurring.title = "Recurring task";
				recurring.innerHTML = shared.ICONS.recurringSmall;
				meta.appendChild(recurring);
			}

			row.appendChild(meta);
		}

		return row;
	},

	/**
	 * The task title, honouring maxTitleLength and wrapEvents. The text is
	 * added as text nodes, so task content never reaches the DOM as markup.
	 *
	 * @param {object} module the MMM-Todoist2 module instance
	 * @param {object} item a Todoist task
	 * @returns {HTMLElement} the title element
	 */
	createTitle: function (module, item) {
		var shared = MMMTodoist2Display;
		var config = module.config;

		var title = shared.createElement("div", "ls-task-title" + (config.wrapEvents ? " ls-task-title-wrap" : ""));
		var text = module.shorten(shared.taskText(item), config.maxTitleLength, config.wrapEvents);

		text.replace(/&hellip;/g, "…").split("<br>").forEach(function (line, index) {
			if (index > 0)
				title.appendChild(document.createElement("br"));

			title.appendChild(document.createTextNode(line));
		});

		title.title = shared.taskText(item);

		return title;
	},

	sortsByTodoist: function (config) {
		var sortOrder = Array.isArray(config.sortOrder) ? config.sortOrder : [config.sortOrder];
		return sortOrder.indexOf("todoist") > -1;
	},

	/**
	 * Fade the rows (and group headings) toward the bottom of the list,
	 * starting at fadePoint and ending at fadeMinimumOpacity.
	 *
	 * @param {HTMLElement} root the list element
	 * @param {object} config the module config
	 */
	applyFade: function (root, config) {
		var rows = root.querySelectorAll(".ls-group-header, .ls-subheader, .ls-task");
		var count = rows.length;

		rows.forEach(function (row, i) {
			var position = (i + 1) / count;
			var progress = (position - config.fadePoint) / (1 - config.fadePoint);
			var opacity = 1 - progress * (1 - config.fadeMinimumOpacity);

			row.style.opacity = Math.max(0, Math.min(opacity, 1));
		});
	}
};
