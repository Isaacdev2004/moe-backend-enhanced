import { SpecializedFileType, TestCase } from '../../types/specialized-parser.js';
import fs from 'fs';
import path from 'path';

export class TestFileGenerator {
  private testFilesDir = 'test-files';

  constructor() {
    this.ensureTestDirectory();
  }

  private ensureTestDirectory(): void {
    if (!fs.existsSync(this.testFilesDir)) {
      fs.mkdirSync(this.testFilesDir, { recursive: true });
    }
  }

  generateTestFiles(): TestCase[] {
    const testCases: TestCase[] = [];

    // Generate XML test files
    testCases.push(this.generateXMLTestCase());
    testCases.push(this.generateCABTestCase());
    testCases.push(this.generateCABXTestCase());
    testCases.push(this.generateMZBTestCase());

    return testCases;
  }

  private generateXMLTestCase(): TestCase {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<root version="1.2.0">
  <metadata>
    <author>Test Author</author>
    <created_date>2024-01-15T10:30:00Z</created_date>
    <description>Test XML file for specialized parser</description>
  </metadata>
  
  <parts>
    <part id="part_001" type="component" version="1.0.0">
      <name>Main Component</name>
      <description>Primary component for testing</description>
      <parameters>
        <parameter id="param_001" name="size" type="number" value="100" unit="mm" required="true">
          <description>Component size in millimeters</description>
          <validation>
            <rule type="min" value="10" message="Size must be at least 10mm"/>
            <rule type="max" value="1000" message="Size must not exceed 1000mm"/>
          </validation>
        </parameter>
        <parameter id="param_002" name="material" type="string" value="steel" required="true">
          <description>Component material</description>
          <validation>
            <rule type="enum" value="steel,aluminum,plastic" message="Material must be steel, aluminum, or plastic"/>
          </validation>
        </parameter>
        <parameter id="param_003" name="temperature" type="number" value="25" unit="celsius">
          <description>Operating temperature</description>
          <default_value>20</default_value>
        </parameter>
      </parameters>
      <constraints>
        <constraint id="constraint_001" name="size_material_constraint" type="custom" severity="error">
          <description>Size and material compatibility check</description>
          <condition>size > 500 AND material = 'plastic'</condition>
          <message>Large components cannot be made of plastic</message>
          <affected_parameters>param_001,param_002</affected_parameters>
        </constraint>
      </constraints>
    </part>
    
    <part id="part_002" type="subcomponent" version="1.1.0">
      <name>Sub Component</name>
      <description>Secondary component</description>
      <parameters>
        <parameter id="param_004" name="weight" type="number" value="5.5" unit="kg" required="true">
          <description>Component weight</description>
        </parameter>
      </parameters>
    </part>
  </parts>
  
  <dependencies>
    <dependency from="part_002" to="part_001" type="requires">
      <description>Sub component requires main component</description>
    </dependency>
  </dependencies>
</root>`;

    const filePath = path.join(this.testFilesDir, 'test_sample.xml');
    fs.writeFileSync(filePath, xmlContent);

    return {
      id: 'xml_test_001',
      name: 'XML Test Case - Complete Structure',
      description: 'Test XML file with parts, parameters, constraints, and dependencies',
      file_type: SpecializedFileType.XML,
      sample_file_path: filePath,
      expected_results: {
        parts_count: 2,
        parameters_count: 4,
        constraints_count: 1,
        broken_logic_count: 0,
        errors_count: 0
      },
      validation_rules: [],
      tags: ['xml', 'complete', 'valid']
    };
  }

  private generateCABTestCase(): TestCase {
    const cabContent = `CAB_MAIN_COMPONENT
name=Main Component
type=primary
version=1.0.0
description=Primary component for CAB testing

CAB_PARAMETER_SIZE
value=150
unit=mm
required=true
min_value=10
max_value=500

CAB_PARAMETER_MATERIAL
value=steel
required=true
allowed_values=steel,aluminum,plastic

CAB_PARAMETER_TEMPERATURE
value=25
unit=celsius
default_value=20

CONSTRAINT_SIZE_MATERIAL
type=custom
severity=error
condition=size > 300 AND material = plastic
message=Large components cannot be made of plastic
affected_parameters=size,material

CAB_SUB_COMPONENT
name=Sub Component
type=secondary
version=1.1.0

CAB_PARAMETER_WEIGHT
value=3.5
unit=kg
required=true

DEPENDENCY_SUB_TO_MAIN
type=requires
description=Sub component requires main component`;

    const filePath = path.join(this.testFilesDir, 'test_sample.cab');
    fs.writeFileSync(filePath, cabContent);

    return {
      id: 'cab_test_001',
      name: 'CAB Test Case - Component Structure',
      description: 'Test CAB file with components, parameters, and constraints',
      file_type: SpecializedFileType.CAB,
      sample_file_path: filePath,
      expected_results: {
        parts_count: 2,
        parameters_count: 4,
        constraints_count: 1,
        broken_logic_count: 0,
        errors_count: 0
      },
      validation_rules: [],
      tags: ['cab', 'components', 'valid']
    };
  }

  private generateCABXTestCase(): TestCase {
    const cabxContent = `CABX_EXTENDED_COMPONENT
name=Extended Component
type=advanced
version=2.0.0
description=Advanced component with extended features

CABX_PARAMETER_DIMENSIONS
length=200
width=150
height=100
unit=mm
required=true

CABX_PARAMETER_PROPERTIES
density=7.85
elastic_modulus=210000
unit_system=metric
required=true

CABX_PARAMETER_LOADING
max_load=5000
safety_factor=2.5
unit=N
required=true

CONSTRAINT_DIMENSION_LOAD
type=structural
severity=critical
condition=length * width * height * density > max_load
message=Component weight exceeds maximum load capacity
affected_parameters=dimensions,loading

CONSTRAINT_SAFETY_FACTOR
type=validation
severity=warning
condition=safety_factor < 1.5
message=Safety factor is below recommended minimum
affected_parameters=safety_factor

CABX_SUB_SYSTEM
name=Sub System
type=auxiliary
version=1.5.0

CABX_PARAMETER_EFFICIENCY
value=0.85
unit=percentage
required=true

DEPENDENCY_SUBSYSTEM_MAIN
type=supports
description=Sub system supports main component functionality`;

    const filePath = path.join(this.testFilesDir, 'test_sample.cabx');
    fs.writeFileSync(filePath, cabxContent);

    return {
      id: 'cabx_test_001',
      name: 'CABX Test Case - Extended Features',
      description: 'Test CABX file with extended component features and advanced constraints',
      file_type: SpecializedFileType.CABX,
      sample_file_path: filePath,
      expected_results: {
        parts_count: 2,
        parameters_count: 6,
        constraints_count: 2,
        broken_logic_count: 0,
        errors_count: 0
      },
      validation_rules: [],
      tags: ['cabx', 'extended', 'advanced']
    };
  }

  private generateMZBTestCase(): TestCase {
    const mzbContent = `MZB_MODEL_COMPONENT
name=Model Component
type=mathematical
version=1.0.0
description=Mathematical model component for MZB testing

MZB_PARAMETER_VARIABLES
x=10.5
y=20.3
z=15.7
unit=units
required=true

MZB_PARAMETER_CONSTANTS
pi=3.14159
e=2.71828
gravity=9.81
unit_system=SI
required=true

MZB_PARAMETER_BOUNDARIES
x_min=0
x_max=100
y_min=0
y_max=200
z_min=0
z_max=150
required=true

CONSTRAINT_BOUNDARY_CHECK
type=validation
severity=error
condition=x < x_min OR x > x_max OR y < y_min OR y > y_max OR z < z_min OR z > z_max
message=Variable values must be within specified boundaries
affected_parameters=x,y,z,boundaries

CONSTRAINT_MATHEMATICAL
type=equation
severity=warning
condition=x^2 + y^2 + z^2 > 1000
message=Combined squared values exceed threshold
affected_parameters=x,y,z

MZB_SUB_MODEL
name=Sub Model
type=auxiliary
version=1.1.0

MZB_PARAMETER_SCALE
value=1.5
unit=factor
required=true

DEPENDENCY_SUBMODEL_MAIN
type=calculates
description=Sub model calculates derived values for main model`;

    const filePath = path.join(this.testFilesDir, 'test_sample.mzb');
    fs.writeFileSync(filePath, mzbContent);

    return {
      id: 'mzb_test_001',
      name: 'MZB Test Case - Mathematical Model',
      description: 'Test MZB file with mathematical model components and constraints',
      file_type: SpecializedFileType.MZB,
      sample_file_path: filePath,
      expected_results: {
        parts_count: 2,
        parameters_count: 7,
        constraints_count: 2,
        broken_logic_count: 0,
        errors_count: 0
      },
      validation_rules: [],
      tags: ['mzb', 'mathematical', 'model']
    };
  }

  generateBrokenLogicTestCases(): TestCase[] {
    const brokenCases: TestCase[] = [];

    // XML with missing required parameter
    const brokenXML = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <part id="broken_part" type="component">
    <parameter id="missing_param" name="required_param" type="string" required="true">
      <description>This parameter is required but has no value</description>
    </parameter>
  </part>
</root>`;

    const brokenXMLPath = path.join(this.testFilesDir, 'test_broken.xml');
    fs.writeFileSync(brokenXMLPath, brokenXML);

    brokenCases.push({
      id: 'broken_xml_001',
      name: 'Broken XML - Missing Required Parameter',
      description: 'XML file with missing required parameter to test broken logic detection',
      file_type: SpecializedFileType.XML,
      sample_file_path: brokenXMLPath,
      expected_results: {
        parts_count: 1,
        parameters_count: 1,
        constraints_count: 0,
        broken_logic_count: 1,
        errors_count: 1
      },
      validation_rules: [],
      tags: ['xml', 'broken', 'missing_parameter']
    });

    // CAB with invalid constraint
    const brokenCAB = `CAB_BROKEN_COMPONENT
name=Broken Component

CAB_PARAMETER_SIZE
value=500

CONSTRAINT_INVALID
type=custom
severity=error
condition=
message=Invalid constraint with no condition
affected_parameters=size`;

    const brokenCABPath = path.join(this.testFilesDir, 'test_broken.cab');
    fs.writeFileSync(brokenCABPath, brokenCAB);

    brokenCases.push({
      id: 'broken_cab_001',
      name: 'Broken CAB - Invalid Constraint',
      description: 'CAB file with invalid constraint to test broken logic detection',
      file_type: SpecializedFileType.CAB,
      sample_file_path: brokenCABPath,
      expected_results: {
        parts_count: 1,
        parameters_count: 1,
        constraints_count: 1,
        broken_logic_count: 1,
        errors_count: 1
      },
      validation_rules: [],
      tags: ['cab', 'broken', 'invalid_constraint']
    });

    return brokenCases;
  }

  generateAllTestFiles(): TestCase[] {
    const validCases = this.generateTestFiles();
    const brokenCases = this.generateBrokenLogicTestCases();
    return [...validCases, ...brokenCases];
  }

  cleanupTestFiles(): void {
    if (fs.existsSync(this.testFilesDir)) {
      fs.rmSync(this.testFilesDir, { recursive: true, force: true });
    }
  }
} 