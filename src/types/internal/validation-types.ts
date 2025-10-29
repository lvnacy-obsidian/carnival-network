/**
 * ============================================================================
 * VALIDATION
 * ============================================================================
 * 
 * Index of exports:
 * - ValidationResult - structure for validation result
 * - ValidationRule - structure for validation rule
 */

import { ValidationError } from "./error-types";

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationRule {
	field: string;
	required?: boolean;
	type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	pattern?: RegExp;
	custom?: (value: unknown) => boolean;
}