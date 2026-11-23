import type { TaskCreatedEvent, TaskStepInput } from "./model.ts";

export type TaskPlanIssue =
	| {
			target: "task";
			field: "title" | "objective" | "planSteps";
			message: string;
	  }
	| {
			target: "task";
			field: "acceptanceCriteria";
			index?: number;
			message: string;
	  }
	| {
			target: "step";
			index: number;
			field: "text" | "expectedOutput" | "reason" | "criterionIds";
			message: string;
	  };

export function collectTaskPlanIssues(
	event: TaskCreatedEvent,
): TaskPlanIssue[] {
	const issues: TaskPlanIssue[] = [];
	if (!event.title.trim())
		issues.push({
			target: "task",
			field: "title",
			message: "Task title is required",
		});
	if (!event.objective.trim())
		issues.push({
			target: "task",
			field: "objective",
			message: "Task objective is required",
		});
	if (event.acceptanceCriteria.length === 0) {
		issues.push({
			target: "task",
			field: "acceptanceCriteria",
			message: "At least one acceptance criterion is required",
		});
	}
	for (const [index, criterion] of event.acceptanceCriteria.entries()) {
		if (!criterion.trim())
			issues.push({
				target: "task",
				field: "acceptanceCriteria",
				index,
				message: `Acceptance criterion ${index + 1} cannot be blank`,
			});
	}
	if (event.planSteps) {
		if (event.planSteps.length === 0) {
			issues.push({
				target: "task",
				field: "planSteps",
				message: "At least one ordered plan step is required",
			});
		} else {
			issues.push(
				...collectPlanStepIssues(
					event.planSteps,
					criterionIds(event.taskId, event.acceptanceCriteria.length),
				),
			);
		}
	} else if ((event.initialSteps ?? []).length === 0) {
		issues.push({
			target: "task",
			field: "planSteps",
			message: "At least one ordered plan step is required",
		});
	} else {
		issues.push(...collectInitialStepIssues(event.initialSteps ?? []));
	}
	return issues;
}

export function collectPlanStepIssues(
	steps: readonly TaskStepInput[],
	availableCriterionIds: readonly string[],
): TaskPlanIssue[] {
	return steps.flatMap((step, index) => {
		const issues: TaskPlanIssue[] = [];
		if (!step.text.trim())
			issues.push(requiredStepField(index, "text", "text"));
		if (!step.expectedOutput.trim())
			issues.push(
				requiredStepField(index, "expectedOutput", "expected output"),
			);
		if (step.granularityCheck && !step.granularityCheck.reason.trim())
			issues.push(requiredStepField(index, "reason", "granularity reason"));
		const invalidIds = (step.criterionIds ?? []).filter(
			(id) => !availableCriterionIds.includes(id),
		);
		if (invalidIds.length > 0) {
			issues.push({
				target: "step",
				index,
				field: "criterionIds",
				message: `Plan step ${index + 1} references unknown criterion IDs: ${invalidIds.join(", ")}`,
			});
		}
		return issues;
	});
}

function collectInitialStepIssues(steps: readonly string[]): TaskPlanIssue[] {
	return steps.flatMap((text, index) =>
		text.trim() ? [] : [requiredStepField(index, "text", "text")],
	);
}

function requiredStepField(
	index: number,
	field: "text" | "expectedOutput" | "reason",
	label: string,
): TaskPlanIssue {
	return {
		target: "step",
		index,
		field,
		message: `Plan step ${index + 1} ${label} is required`,
	};
}

export function buildTaskPlanRetryEvent(
	event: TaskCreatedEvent,
	issues: readonly TaskPlanIssue[],
): TaskCreatedEvent {
	const fallback = taskFallback(event);
	const acceptanceCriteria = repairCriteria(event, issues, fallback);
	const retryEvent: TaskCreatedEvent = {
		...event,
		title: event.title.trim() ? event.title : (fallback ?? event.title),
		objective: event.objective.trim()
			? event.objective
			: (fallback ?? event.objective),
		acceptanceCriteria,
	};
	if (event.planSteps) {
		const steps: TaskStepInput[] =
			event.planSteps.length > 0
				? [...event.planSteps]
				: (event.initialSteps ?? [])
						.filter((text) => text.trim())
						.map((text) => ({
							text,
							expectedOutput: `Verified output for: ${text}`,
							criterionIds: criterionIds(
								event.taskId,
								acceptanceCriteria.length,
							),
						}));
		if (steps.length === 0 && fallback) {
			steps.push({
				text: `Verify ${fallback}`,
				expectedOutput: `Result of: ${fallback}`,
				criterionIds: criterionIds(event.taskId, acceptanceCriteria.length),
			});
		}
		retryEvent.planSteps = repairPlanSteps(
			event,
			steps,
			issues,
			acceptanceCriteria,
			fallback,
		);
	} else if (event.initialSteps) {
		retryEvent.initialSteps =
			event.initialSteps.length > 0
				? repairInitialSteps(event.initialSteps, issues, fallback)
				: fallback
					? [`Verify ${fallback}`]
					: event.initialSteps;
	}
	return retryEvent;
}

function taskFallback(event: TaskCreatedEvent): string | undefined {
	return (
		(event.objective.trim() ? event.objective : undefined) ??
		(event.title.trim() ? event.title : undefined) ??
		event.acceptanceCriteria.find((criterion) => criterion.trim()) ??
		event.planSteps?.find((step) => step.text.trim())?.text ??
		event.planSteps?.find((step) => step.expectedOutput.trim())
			?.expectedOutput ??
		event.initialSteps?.find((step) => step.trim())
	);
}

function repairCriteria(
	event: TaskCreatedEvent,
	issues: readonly TaskPlanIssue[],
	fallback: string | undefined,
): string[] {
	const criteria = [...event.acceptanceCriteria];
	if (criteria.length === 0 && fallback) criteria.push(fallback);
	for (const issue of issues) {
		if (
			issue.target === "task" &&
			issue.field === "acceptanceCriteria" &&
			issue.index !== undefined &&
			fallback
		)
			criteria[issue.index] = fallback;
	}
	return criteria;
}

function repairPlanSteps(
	event: TaskCreatedEvent,
	steps: readonly TaskStepInput[],
	issues: readonly TaskPlanIssue[],
	criteria: readonly string[],
	fallback: string | undefined,
): TaskStepInput[] {
	const ids = criterionIds(event.taskId, criteria.length);
	return steps.map((step, index) => {
		const stepIssues = issues.filter(
			(issue): issue is Extract<TaskPlanIssue, { target: "step" }> =>
				issue.target === "step" && issue.index === index,
		);
		return repairStep(
			step,
			stepIssues,
			ids,
			stepSource(step, ids, criteria, fallback),
		);
	});
}

function repairStep(
	step: TaskStepInput,
	issues: readonly Extract<TaskPlanIssue, { target: "step" }>[],
	availableIds: readonly string[],
	source: string | undefined,
): TaskStepInput {
	if (issues.length === 0) return step;
	const repaired = { ...step };
	for (const issue of issues) {
		if (issue.field === "text" && source) repaired.text = `Verify ${source}`;
		if (issue.field === "expectedOutput" && source)
			repaired.expectedOutput = `Result of: ${source}`;
		if (issue.field === "reason" && source && step.granularityCheck)
			repaired.granularityCheck = {
				...step.granularityCheck,
				reason: `One action for ${source} has one verifiable result.`,
			};
		if (issue.field === "criterionIds")
			repaired.criterionIds = repairCriterionIds(
				step.criterionIds ?? [],
				availableIds,
			);
	}
	return repaired;
}

function stepSource(
	step: TaskStepInput,
	availableIds: readonly string[],
	criteria: readonly string[],
	fallback: string | undefined,
): string | undefined {
	const requested = step.criterionIds?.length
		? step.criterionIds
		: availableIds;
	const linked = requested
		.filter((id) => availableIds.includes(id))
		.map((id) => criteria[availableIds.indexOf(id)])
		.find((text) => text?.trim());
	return (
		(step.expectedOutput.trim() ? step.expectedOutput : undefined) ??
		(step.text.trim() ? step.text : undefined) ??
		linked ??
		fallback
	);
}

function repairCriterionIds(
	requested: readonly string[],
	availableIds: readonly string[],
): string[] {
	const used = new Set<string>();
	return requested.map((id) => {
		if (availableIds.includes(id)) {
			used.add(id);
			return id;
		}
		const replacement =
			availableIds.find((candidate) => !used.has(candidate)) ?? availableIds[0];
		if (replacement) used.add(replacement);
		return replacement ?? id;
	});
}

function repairInitialSteps(
	steps: readonly string[],
	issues: readonly TaskPlanIssue[],
	fallback: string | undefined,
): string[] {
	return steps.map((text, index) => {
		const missing = issues.some(
			(issue) =>
				issue.target === "step" &&
				issue.index === index &&
				issue.field === "text",
		);
		return missing && fallback ? `Verify ${text.trim() || fallback}` : text;
	});
}

function criterionIds(taskId: string, count: number): string[] {
	return Array.from(
		{ length: count },
		(_unused, index) => `${taskId}-AC${index + 1}`,
	);
}

export function formatTaskPlanIssues(issues: readonly TaskPlanIssue[]): string {
	return `Plan validation failed:\n- ${issues.map((issue) => issue.message).join("\n- ")}`;
}
