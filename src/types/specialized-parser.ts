// Specialized Parser Types for .cab, .cabx, .mzb, .xml files

export enum SpecializedFileType {
  CAB = 'cab',
  CABX = 'cabx', 
  MZB = 'mzb',
  XML = 'xml'
}

export interface Part {
  id: string;
  name: string;
  type: string;
  parameters: Parameter[];
  constraints: Constraint[];
  metadata: {
    version: string;
    created_date: string;
    modified_date: string;
    author?: string;
    description?: string;
  };
  position: {
    start: number;
    end: number;
  };
  status: 'valid' | 'broken' | 'warning';
  errors: ParseError[];
}

export interface Parameter {
  id: string;
  name: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  unit?: string;
  description?: string;
  required: boolean;
  default_value?: any;
  validation_rules?: ValidationRule[];
  position: {
    start: number;
    end: number;
  };
}

export interface Constraint {
  id: string;
  name: string;
  type: 'range' | 'enum' | 'regex' | 'custom';
  value: any;
  description?: string;
  severity: 'error' | 'warning' | 'info';
  affected_parameters: string[]; // Parameter IDs
  position: {
    start: number;
    end: number;
  };
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'required' | 'custom';
  value: any;
  message: string;
}

export interface VersionMetadata {
  version: string;
  major: number;
  minor: number;
  patch: number;
  build?: string;
  release_date?: string;
  compatibility: string[];
  changes: ChangeLog[];
}

export interface ChangeLog {
  version: string;
  date: string;
  type: 'feature' | 'bugfix' | 'breaking' | 'deprecation';
  description: string;
  affected_parts: string[];
}

export interface BrokenLogicDetection {
  part_id: string;
  issue_type: 'missing_parameter' | 'invalid_constraint' | 'version_mismatch' | 'circular_dependency' | 'unused_parameter';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggested_fix?: string;
  line_number?: number;
  position: {
    start: number;
    end: number;
  };
}

export interface SpecializedParseResult {
  file_type: SpecializedFileType;
  parts: Part[];
  parameters: Parameter[];
  constraints: Constraint[];
  version_metadata: VersionMetadata;
  broken_logic: BrokenLogicDetection[];
  file_structure: FileStructure;
  statistics: ParseStatistics;
  errors: ParseError[];
  warnings: ParseError[];
}

export interface FileStructure {
  sections: FileSection[];
  hierarchy: HierarchyNode[];
  dependencies: Dependency[];
}

export interface FileSection {
  id: string;
  name: string;
  type: 'header' | 'body' | 'footer' | 'metadata' | 'content';
  content: string;
  position: {
    start: number;
    end: number;
  };
  subsections: FileSection[];
}

export interface HierarchyNode {
  id: string;
  name: string;
  type: string;
  level: number;
  parent_id?: string;
  children: string[];
  metadata: Record<string, any>;
}

export interface Dependency {
  from: string;
  to: string;
  type: 'requires' | 'includes' | 'references' | 'extends';
  description?: string;
}

export interface ParseStatistics {
  total_parts: number;
  total_parameters: number;
  total_constraints: number;
  broken_logic_count: number;
  error_count: number;
  warning_count: number;
  processing_time: number;
  file_size: number;
  complexity_score: number;
}

export interface ParseError {
  type: 'parsing' | 'validation' | 'structure' | 'logic';
  message: string;
  severity: 'error' | 'warning' | 'info';
  line_number?: number;
  position: {
    start: number;
    end: number;
  };
  context?: string;
  suggested_fix?: string;
}

// Parser Configuration
export interface SpecializedParserConfig {
  enable_version_detection: boolean;
  enable_broken_logic_detection: boolean;
  enable_dependency_analysis: boolean;
  strict_mode: boolean;
  max_file_size: number;
  allowed_file_types: SpecializedFileType[];
  validation_rules: ValidationRule[];
}

// Test Case Structure
export interface TestCase {
  id: string;
  name: string;
  description: string;
  file_type: SpecializedFileType;
  sample_file_path: string;
  expected_results: {
    parts_count: number;
    parameters_count: number;
    constraints_count: number;
    broken_logic_count: number;
    errors_count: number;
  };
  validation_rules: ValidationRule[];
  tags: string[];
} 