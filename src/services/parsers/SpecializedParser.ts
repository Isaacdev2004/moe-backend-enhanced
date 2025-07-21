import { BaseParser } from './BaseParser.js';
import { FileType, FileMetadata, ParseResult } from '../../types/file-parser.js';
import { 
  SpecializedFileType, 
  SpecializedParseResult, 
  Part, 
  Parameter, 
  Constraint, 
  VersionMetadata, 
  BrokenLogicDetection,
  FileStructure,
  ParseStatistics,
  SpecializedParserConfig
} from '../../types/specialized-parser.js';
import { v4 as uuidv4 } from 'uuid';
import * as xml2js from 'xml2js';

export class SpecializedParser extends BaseParser {
  private config: SpecializedParserConfig;

  constructor() {
    super([FileType.XML]); // Base support for XML
    this.config = {
      enable_version_detection: true,
      enable_broken_logic_detection: true,
      enable_dependency_analysis: true,
      strict_mode: false,
      max_file_size: 50 * 1024 * 1024, // 50MB
      allowed_file_types: [SpecializedFileType.CAB, SpecializedFileType.CABX, SpecializedFileType.MZB, SpecializedFileType.XML],
      validation_rules: []
    };
  }

  async parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult> {
    try {
      const specializedResult = await this.parseSpecialized(file, metadata);
      
      return {
        content: specializedResult.file_structure.sections.map(s => s.content).join('\n'),
        metadata: await this.extractMetadata(file),
        sections: this.convertToDocumentSections(specializedResult.file_structure.sections),
        tables: [],
        images: [],
        links: [],
        errors: specializedResult.errors
      };
    } catch (error) {
      return {
        content: '',
        metadata,
        sections: [],
        tables: [],
        images: [],
        links: [],
        errors: [this.createParseError('parsing', `Failed to parse specialized file: ${error}`)]
      };
    }
  }

  async parseSpecialized(file: Buffer, metadata: FileMetadata): Promise<SpecializedParseResult> {
    const startTime = Date.now();
    const content = await this.extractText(file);
    const fileType = this.detectFileType(metadata.filename, content);
    
    let parts: Part[] = [];
    let parameters: Parameter[] = [];
    let constraints: Constraint[] = [];
    let versionMetadata: VersionMetadata;
    let brokenLogic: BrokenLogicDetection[] = [];
    let fileStructure: FileStructure;
    let errors: ParseError[] = [];
    let warnings: ParseError[] = [];

    try {
      switch (fileType) {
        case SpecializedFileType.XML:
          const xmlResult = await this.parseXML(content);
          parts = xmlResult.parts;
          parameters = xmlResult.parameters;
          constraints = xmlResult.constraints;
          fileStructure = xmlResult.fileStructure;
          break;
        case SpecializedFileType.CAB:
        case SpecializedFileType.CABX:
          const cabResult = await this.parseCAB(content, fileType);
          parts = cabResult.parts;
          parameters = cabResult.parameters;
          constraints = cabResult.constraints;
          fileStructure = cabResult.fileStructure;
          break;
        case SpecializedFileType.MZB:
          const mzbResult = await this.parseMZB(content);
          parts = mzbResult.parts;
          parameters = mzbResult.parameters;
          constraints = mzbResult.constraints;
          fileStructure = mzbResult.fileStructure;
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Extract version metadata
      versionMetadata = this.extractVersionMetadata(content, fileType);

      // Detect broken logic
      if (this.config.enable_broken_logic_detection) {
        brokenLogic = this.detectBrokenLogic(parts, parameters, constraints);
      }

      // Analyze dependencies
      if (this.config.enable_dependency_analysis) {
        fileStructure.dependencies = this.analyzeDependencies(parts, parameters, constraints);
      }

    } catch (error) {
      errors.push(this.createParseError('parsing', `Parsing failed: ${error}`));
    }

    const processingTime = Date.now() - startTime;
    const statistics: ParseStatistics = {
      total_parts: parts.length,
      total_parameters: parameters.length,
      total_constraints: constraints.length,
      broken_logic_count: brokenLogic.length,
      error_count: errors.length,
      warning_count: warnings.length,
      processing_time: processingTime,
      file_size: file.length,
      complexity_score: this.calculateComplexityScore(parts, parameters, constraints)
    };

    return {
      file_type: fileType,
      parts,
      parameters,
      constraints,
      version_metadata: versionMetadata,
      broken_logic: brokenLogic,
      file_structure: fileStructure,
      statistics,
      errors,
      warnings
    };
  }

  private detectFileType(filename: string, content: string): SpecializedFileType {
    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'xml':
        return SpecializedFileType.XML;
      case 'cab':
        return SpecializedFileType.CAB;
      case 'cabx':
        return SpecializedFileType.CABX;
      case 'mzb':
        return SpecializedFileType.MZB;
      default:
        // Try to detect from content
        if (content.includes('<?xml') || content.includes('<root>')) {
          return SpecializedFileType.XML;
        }
        if (content.includes('CAB_') || content.includes('cab_')) {
          return SpecializedFileType.CAB;
        }
        if (content.includes('MZB_') || content.includes('mzb_')) {
          return SpecializedFileType.MZB;
        }
        return SpecializedFileType.XML; // Default fallback
    }
  }

  private async parseXML(content: string): Promise<{
    parts: Part[];
    parameters: Parameter[];
    constraints: Constraint[];
    fileStructure: FileStructure;
  }> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(content);
    
    const parts: Part[] = [];
    const parameters: Parameter[] = [];
    const constraints: Constraint[] = [];
    const sections: FileSection[] = [];

    // Parse XML structure
    this.parseXMLNode(result, parts, parameters, constraints, sections);

    const fileStructure: FileStructure = {
      sections,
      hierarchy: this.buildHierarchy(sections),
      dependencies: []
    };

    return { parts, parameters, constraints, fileStructure };
  }

  private parseXMLNode(
    node: any, 
    parts: Part[], 
    parameters: Parameter[], 
    constraints: Constraint[], 
    sections: FileSection[],
    parentPath: string = ''
  ) {
    for (const [key, value] of Object.entries(node)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        // Check if this is a part
        if (this.isPartNode(key, value)) {
          parts.push(this.createPart(key, value, currentPath));
        }
        
        // Check if this is a parameter
        if (this.isParameterNode(key, value)) {
          parameters.push(this.createParameter(key, value, currentPath));
        }
        
        // Check if this is a constraint
        if (this.isConstraintNode(key, value)) {
          constraints.push(this.createConstraint(key, value, currentPath));
        }

        // Create section
        sections.push(this.createFileSection(key, value, currentPath));
        
        // Recursively parse child nodes
        this.parseXMLNode(value, parts, parameters, constraints, sections, currentPath);
      }
    }
  }

  private isPartNode(key: string, value: any): boolean {
    return key.toLowerCase().includes('part') || 
           key.toLowerCase().includes('component') ||
           (value && typeof value === 'object' && (value.type || value.id));
  }

  private isParameterNode(key: string, value: any): boolean {
    return key.toLowerCase().includes('param') || 
           key.toLowerCase().includes('attribute') ||
           (value && typeof value === 'object' && (value.value !== undefined || value.type));
  }

  private isConstraintNode(key: string, value: any): boolean {
    return key.toLowerCase().includes('constraint') || 
           key.toLowerCase().includes('rule') ||
           (value && typeof value === 'object' && (value.condition || value.rule));
  }

  private createPart(key: string, value: any, path: string): Part {
    return {
      id: value.id || uuidv4(),
      name: key,
      type: value.type || 'unknown',
      parameters: [],
      constraints: [],
      metadata: {
        version: value.version || '1.0.0',
        created_date: value.created_date || new Date().toISOString(),
        modified_date: value.modified_date || new Date().toISOString(),
        author: value.author,
        description: value.description
      },
      position: { start: 0, end: 0 },
      status: 'valid',
      errors: []
    };
  }

  private createParameter(key: string, value: any, path: string): Parameter {
    return {
      id: value.id || uuidv4(),
      name: key,
      value: value.value || value,
      type: this.detectParameterType(value.value || value),
      unit: value.unit,
      description: value.description,
      required: value.required || false,
      default_value: value.default_value,
      validation_rules: value.validation_rules || [],
      position: { start: 0, end: 0 }
    };
  }

  private createConstraint(key: string, value: any, path: string): Constraint {
    return {
      id: value.id || uuidv4(),
      name: key,
      type: value.type || 'custom',
      value: value.value || value.condition,
      description: value.description,
      severity: value.severity || 'error',
      affected_parameters: value.affected_parameters || [],
      position: { start: 0, end: 0 }
    };
  }

  private createFileSection(key: string, value: any, path: string): FileSection {
    return {
      id: uuidv4(),
      name: key,
      type: 'content',
      content: typeof value === 'string' ? value : JSON.stringify(value),
      position: { start: 0, end: 0 },
      subsections: []
    };
  }

  private detectParameterType(value: any): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  private async parseCAB(content: string, fileType: SpecializedFileType): Promise<{
    parts: Part[];
    parameters: Parameter[];
    constraints: Constraint[];
    fileStructure: FileStructure;
  }> {
    // CAB/CABX specific parsing logic
    const lines = content.split('\n');
    const parts: Part[] = [];
    const parameters: Parameter[] = [];
    const constraints: Constraint[] = [];
    const sections: FileSection[] = [];

    let currentSection = '';
    let currentPart: Part | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('CAB_') || trimmedLine.startsWith('cab_')) {
        // New part definition
        if (currentPart) {
          parts.push(currentPart);
        }
        currentPart = this.parseCABPart(trimmedLine);
      } else if (currentPart && trimmedLine.includes('=')) {
        // Parameter definition
        const param = this.parseCABParameter(trimmedLine);
        if (param) {
          parameters.push(param);
          currentPart.parameters.push(param);
        }
      } else if (trimmedLine.startsWith('CONSTRAINT_')) {
        // Constraint definition
        const constraint = this.parseCABConstraint(trimmedLine);
        if (constraint) {
          constraints.push(constraint);
          currentPart?.constraints.push(constraint);
        }
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    const fileStructure: FileStructure = {
      sections,
      hierarchy: this.buildHierarchy(sections),
      dependencies: []
    };

    return { parts, parameters, constraints, fileStructure };
  }

  private parseCABPart(line: string): Part {
    const match = line.match(/CAB_(\w+)/);
    return {
      id: uuidv4(),
      name: match ? match[1] : 'unknown',
      type: 'cab_component',
      parameters: [],
      constraints: [],
      metadata: {
        version: '1.0.0',
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString()
      },
      position: { start: 0, end: 0 },
      status: 'valid',
      errors: []
    };
  }

  private parseCABParameter(line: string): Parameter | null {
    const match = line.match(/(\w+)\s*=\s*(.+)/);
    if (!match) return null;

    return {
      id: uuidv4(),
      name: match[1],
      value: match[2].trim(),
      type: 'string',
      required: false,
      position: { start: 0, end: 0 }
    };
  }

  private parseCABConstraint(line: string): Constraint | null {
    const match = line.match(/CONSTRAINT_(\w+)\s*:\s*(.+)/);
    if (!match) return null;

    return {
      id: uuidv4(),
      name: match[1],
      type: 'custom',
      value: match[2].trim(),
      severity: 'error',
      affected_parameters: [],
      position: { start: 0, end: 0 }
    };
  }

  private async parseMZB(content: string): Promise<{
    parts: Part[];
    parameters: Parameter[];
    constraints: Constraint[];
    fileStructure: FileStructure;
  }> {
    // MZB specific parsing logic (similar to CAB but with MZB prefixes)
    const lines = content.split('\n');
    const parts: Part[] = [];
    const parameters: Parameter[] = [];
    const constraints: Constraint[] = [];
    const sections: FileSection[] = [];

    let currentPart: Part | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('MZB_') || trimmedLine.startsWith('mzb_')) {
        if (currentPart) {
          parts.push(currentPart);
        }
        currentPart = this.parseMZBPart(trimmedLine);
      } else if (currentPart && trimmedLine.includes('=')) {
        const param = this.parseMZBParameter(trimmedLine);
        if (param) {
          parameters.push(param);
          currentPart.parameters.push(param);
        }
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    const fileStructure: FileStructure = {
      sections,
      hierarchy: this.buildHierarchy(sections),
      dependencies: []
    };

    return { parts, parameters, constraints, fileStructure };
  }

  private parseMZBPart(line: string): Part {
    const match = line.match(/MZB_(\w+)/);
    return {
      id: uuidv4(),
      name: match ? match[1] : 'unknown',
      type: 'mzb_component',
      parameters: [],
      constraints: [],
      metadata: {
        version: '1.0.0',
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString()
      },
      position: { start: 0, end: 0 },
      status: 'valid',
      errors: []
    };
  }

  private parseMZBParameter(line: string): Parameter | null {
    const match = line.match(/(\w+)\s*=\s*(.+)/);
    if (!match) return null;

    return {
      id: uuidv4(),
      name: match[1],
      value: match[2].trim(),
      type: 'string',
      required: false,
      position: { start: 0, end: 0 }
    };
  }

  private extractVersionMetadata(content: string, fileType: SpecializedFileType): VersionMetadata {
    // Extract version information from content
    const versionMatch = content.match(/version["\s]*[:=]["\s]*([\d.]+)/i);
    const version = versionMatch ? versionMatch[1] : '1.0.0';
    
    const [major, minor, patch] = version.split('.').map(Number);
    
    return {
      version,
      major: major || 1,
      minor: minor || 0,
      patch: patch || 0,
      compatibility: [],
      changes: []
    };
  }

  private detectBrokenLogic(parts: Part[], parameters: Parameter[], constraints: Constraint[]): BrokenLogicDetection[] {
    const issues: BrokenLogicDetection[] = [];

    // Check for missing required parameters
    for (const part of parts) {
      for (const param of part.parameters) {
        if (param.required && !param.value && param.default_value === undefined) {
          issues.push({
            part_id: part.id,
            issue_type: 'missing_parameter',
            severity: 'high',
            description: `Required parameter '${param.name}' is missing in part '${part.name}'`,
            suggested_fix: `Add a value for parameter '${param.name}'`,
            position: { start: 0, end: 0 }
          });
        }
      }
    }

    // Check for invalid constraints
    for (const constraint of constraints) {
      if (!constraint.value || constraint.value === '') {
        issues.push({
          part_id: constraint.affected_parameters[0] || 'unknown',
          issue_type: 'invalid_constraint',
          severity: 'medium',
          description: `Constraint '${constraint.name}' has no value`,
          suggested_fix: 'Add a valid value for the constraint',
          position: { start: 0, end: 0 }
        });
      }
    }

    return issues;
  }

  private analyzeDependencies(parts: Part[], parameters: Parameter[], constraints: Constraint[]): Dependency[] {
    const dependencies: Dependency[] = [];

    // Analyze parameter dependencies
    for (const param of parameters) {
      if (param.value && typeof param.value === 'string') {
        const refMatch = param.value.match(/\{(\w+)\}/);
        if (refMatch) {
          dependencies.push({
            from: param.id,
            to: refMatch[1],
            type: 'references',
            description: `Parameter '${param.name}' references '${refMatch[1]}'`
          });
        }
      }
    }

    return dependencies;
  }

  private buildHierarchy(sections: FileSection[]): HierarchyNode[] {
    const hierarchy: HierarchyNode[] = [];
    
    for (const section of sections) {
      hierarchy.push({
        id: section.id,
        name: section.name,
        type: section.type,
        level: 0,
        children: section.subsections.map(s => s.id),
        metadata: {}
      });
    }

    return hierarchy;
  }

  private calculateComplexityScore(parts: Part[], parameters: Parameter[], constraints: Constraint[]): number {
    let score = 0;
    score += parts.length * 10;
    score += parameters.length * 2;
    score += constraints.length * 5;
    return Math.min(score, 100);
  }

  async extractText(file: Buffer): Promise<string> {
    return file.toString('utf8');
  }

  async extractMetadata(file: Buffer): Promise<FileMetadata> {
    const content = await this.extractText(file);
    const fileType = this.detectFileType('unknown', content);
    
    return {
      filename: 'specialized_file',
      file_type: FileType.XML,
      file_size: file.length,
      mime_type: 'application/xml',
      language: 'en',
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString()
    };
  }

  async validateFile(file: Buffer): Promise<boolean> {
    try {
      const content = await this.extractText(file);
      const fileType = this.detectFileType('unknown', content);
      return this.config.allowed_file_types.includes(fileType);
    } catch (error) {
      return false;
    }
  }
} 