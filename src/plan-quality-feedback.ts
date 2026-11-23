import type { TaskStepInput } from "./model.ts";

interface PlanQualityGuidance {
	rule: string;
	rewrite: Partial<TaskStepInput>;
}

const TEXT_REWRITE = { text: "Read the task plan schema" };
const OUTPUT_REWRITE = { expectedOutput: "Task plan schema is valid" };
const ACTIONS_REWRITE = { allowedActions: ["read the task plan schema"] };

const EXACT_GUIDANCE = new Map<string, PlanQualityGuidance>([
	[
		"step text is too short",
		{
			rule: "Use at least 8 characters and name one concrete action.",
			rewrite: TEXT_REWRITE,
		},
	],
	[
		"expected output is too short",
		{
			rule: "Use at least 12 characters and describe one observable result.",
			rewrite: OUTPUT_REWRITE,
		},
	],
	[
		"evidenceRequired must be true",
		{
			rule: "Require evidence for every executable plan step.",
			rewrite: { evidenceRequired: true },
		},
	],
	[
		"atomic step has failing granularity flags",
		{
			rule: "Use needs_breakdown when the granularity flags do not prove atomic work.",
			rewrite: { decompositionStatus: "needs_breakdown" },
		},
	],
	[
		"granularityCheck.reason is required",
		{
			rule: "Give a reason for the granularity classification.",
			rewrite: {
				granularityCheck: {
					isAtomic: true,
					reason: "One action with one output and one verification.",
					canBeDoneInOneAgentAction: true,
					hasSingleObservableOutput: true,
					hasSingleVerificationMethod: true,
					hasNoHiddenSubtasks: true,
				},
			},
		},
	],
]);

const PREFIX_GUIDANCE: ReadonlyArray<readonly [string, PlanQualityGuidance]> = [
	[
		"step text uses vague or broad wording",
		{
			rule: "Name a concrete action and object instead of a broad verb.",
			rewrite: TEXT_REWRITE,
		},
	],
	[
		"expected output uses vague or broad wording",
		{
			rule: "Describe the observable result instead of a broad promise.",
			rewrite: OUTPUT_REWRITE,
		},
	],
	[
		"allowedActions are too broad",
		{
			rule: "Limit allowedActions to three or fewer actions.",
			rewrite: ACTIONS_REWRITE,
		},
	],
	[
		"allowedActions contain vague actions",
		{
			rule: "Replace broad allowed actions with specific operations.",
			rewrite: ACTIONS_REWRITE,
		},
	],
	[
		"allowedActions must each be a single action",
		{
			rule: "Make each allowedActions entry one action.",
			rewrite: ACTIONS_REWRITE,
		},
	],
	[
		"step text appears to contain multiple actions",
		{
			rule: "Keep the step text to one action.",
			rewrite: TEXT_REWRITE,
		},
	],
];

export function getPlanQualityFeedback(
	issue: string,
	availableCriterionIds: readonly string[] = [],
): { message: string; rewrite: Partial<TaskStepInput> } {
	const guidance = getPlanQualityGuidance(issue, availableCriterionIds);
	return {
		message: `${issue}. Rule: ${guidance.rule} Example rewrite: ${JSON.stringify(guidance.rewrite)}`,
		rewrite: guidance.rewrite,
	};
}

export function formatPlanQualityIssue(
	issue: string,
	availableCriterionIds: readonly string[] = [],
): string {
	return getPlanQualityFeedback(issue, availableCriterionIds).message;
}

function getPlanQualityGuidance(
	issue: string,
	availableCriterionIds: readonly string[],
): PlanQualityGuidance {
	if (issue.startsWith("criterionIds includes unknown ID")) {
		return {
			rule: "Use generated acceptance-criterion IDs or omit criterionIds to auto-link them.",
			rewrite:
				availableCriterionIds.length > 0
					? { criterionIds: [...availableCriterionIds] }
					: {},
		};
	}
	if (issue.startsWith("expected output appears to contain multiple outputs")) {
		const separator = issue.match(/\((.+)\)$/)?.[1] ?? "unknown";
		return {
			rule: `Keep one observable result; separator ${separator} triggered this rule.`,
			rewrite: OUTPUT_REWRITE,
		};
	}
	if (issue === "at least one criterion link is required") {
		return {
			rule: "Link at least one generated acceptance criterion.",
			rewrite: {
				criterionIds: [availableCriterionIds[0] ?? "T1-AC1"],
			},
		};
	}
	return (
		EXACT_GUIDANCE.get(issue) ??
		PREFIX_GUIDANCE.find(([prefix]) => issue.startsWith(prefix))?.[1] ?? {
			rule: "Rewrite the plan field so it satisfies the named check.",
			rewrite: TEXT_REWRITE,
		}
	);
}
