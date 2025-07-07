// Salesforce Flow DSL Transpiler
// Usage: node transpiler.js input.flow output.xml

const fs = require('fs');
const path = require('path');

class FlowTranspiler {
  constructor() {
    this.nodeId = 0;
    this.nodes = [];
    this.connections = [];
    this.variables = new Map();
    this.constants = new Map();
    this.currentNodeId = null;
    this.startNodeId = null;
  }

  // Generate unique node IDs
  generateNodeId() {
    return `node_${this.nodeId++}`;
  }

  // Parse DSL and generate flow structure
  transpile(dslCode) {
    const lines = dslCode.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      this.parseLine(line);
    }

    return this.generateFlowXML();
  }

  parseLine(line) {
    // Variable declarations
    if (line.match(/^(var|let|const)\s+\w+\s*=/)) {
      this.parseVariableDeclaration(line);
    }
    // If statements
    else if (line.startsWith('if (')) {
      this.parseIfStatement(line);
    }
    // Function calls
    else if (line.match(/^\w+\s*\(/)) {
      this.parseFunctionCall(line);
    }
    // Assignments
    else if (line.match(/^\w+\s*=/)) {
      this.parseAssignment(line);
    }
    // Flow control
    else if (line === 'START' || line === 'END') {
      this.parseFlowControl(line);
    }
  }

  parseVariableDeclaration(line) {
    const match = line.match(/^(var|let|const)\s+(\w+)\s*=\s*(.+);?$/);
    if (match) {
      const [, type, name, value] = match;
      const nodeId = this.generateNodeId();
      
      // Register variable
      this.variables.set(name, {
        name: name,
        type: this.inferType(value),
        value: value
      });

      // Create assignment node
      this.nodes.push({
        id: nodeId,
        type: 'Assignment',
        name: name,
        assignmentItems: [{
          assignToReference: name,
          operator: 'Assign',
          value: this.parseValue(value)
        }]
      });

      this.connectToPrevious(nodeId);
    }
  }

  parseIfStatement(line) {
    const conditionMatch = line.match(/^if\s*\((.+?)\)\s*{?$/);
    if (conditionMatch) {
      const condition = conditionMatch[1];
      const nodeId = this.generateNodeId();
      
      this.nodes.push({
        id: nodeId,
        type: 'Decision',
        name: 'Decision',
        rules: [{
          name: 'True',
          conditionLogic: 'and',
          conditions: [this.parseCondition(condition)]
        }],
        defaultConnector: {
          targetReference: null // Will be set later
        }
      });

      this.connectToPrevious(nodeId);
    }
  }

  parseFunctionCall(line) {
    const match = line.match(/^(\w+)\s*\(([^)]*)\)\s*;?$/);
    if (match) {
      const [, functionName, params] = match;
      const nodeId = this.generateNodeId();
      
      // Handle built-in functions
      if (functionName === 'updateRecord') {
        this.createUpdateRecordNode(nodeId, params);
      } else if (functionName === 'createRecord') {
        this.createCreateRecordNode(nodeId, params);
      } else if (functionName === 'sendEmail') {
        this.createEmailNode(nodeId, params);
      } else {
        // Custom function/subflow
        this.createSubflowNode(nodeId, functionName, params);
      }

      this.connectToPrevious(nodeId);
    }
  }

  parseAssignment(line) {
    const match = line.match(/^(\w+)\s*=\s*(.+);?$/);
    if (match) {
      const [, variable, value] = match;
      const nodeId = this.generateNodeId();
      
      this.nodes.push({
        id: nodeId,
        type: 'Assignment',
        name: `Assign_${variable}`,
        assignmentItems: [{
          assignToReference: variable,
          operator: 'Assign',
          value: this.parseValue(value)
        }]
      });

      this.connectToPrevious(nodeId);
    }
  }

  parseFlowControl(line) {
    if (line === 'START') {
      this.startNodeId = this.currentNodeId;
    }
    // END is handled automatically
  }

  parseCondition(condition) {
    // Parse conditions like: $Record.Status__c == 'Active'
    const operators = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'startsWith'];
    
    for (const op of operators) {
      if (condition.includes(op)) {
        const parts = condition.split(op).map(p => p.trim());
        return {
          leftValueReference: this.parseValue(parts[0]),
          operator: this.mapOperator(op),
          rightValue: this.parseValue(parts[1])
        };
      }
    }
    
    return {
      leftValueReference: this.parseValue(condition),
      operator: 'EqualTo',
      rightValue: { stringValue: 'true' }
    };
  }

  parseValue(value) {
    // Handle $Record references
    if (value.startsWith('$Record.')) {
      return {
        elementReference: value.replace('$Record.', '{!$Record.') + '}'
      };
    }
    
    // Handle variable references
    if (value.startsWith('$') || this.variables.has(value)) {
      return {
        elementReference: value.startsWith('$') ? `{!${value}}` : `{!${value}}`
      };
    }
    
    // Handle string literals
    if (value.startsWith('"') && value.endsWith('"')) {
      return {
        stringValue: value.slice(1, -1)
      };
    }
    
    // Handle numbers
    if (!isNaN(value)) {
      return {
        numberValue: parseFloat(value)
      };
    }
    
    // Handle boolean
    if (value === 'true' || value === 'false') {
      return {
        booleanValue: value === 'true'
      };
    }
    
    // Default to string
    return {
      stringValue: value
    };
  }

  mapOperator(op) {
    const operatorMap = {
      '==': 'EqualTo',
      '!=': 'NotEqualTo',
      '>': 'GreaterThan',
      '>=': 'GreaterThanOrEqualTo',
      '<': 'LessThan',
      '<=': 'LessThanOrEqualTo',
      'contains': 'Contains',
      'startsWith': 'StartsWith'
    };
    return operatorMap[op] || 'EqualTo';
  }

  inferType(value) {
    if (value.startsWith('"') && value.endsWith('"')) return 'String';
    if (!isNaN(value)) return 'Number';
    if (value === 'true' || value === 'false') return 'Boolean';
    return 'String';
  }

  createUpdateRecordNode(nodeId, params) {
    const paramList = this.parseParameters(params);
    this.nodes.push({
      id: nodeId,
      type: 'RecordUpdate',
      name: 'Update_Record',
      object: paramList.object || 'Account',
      inputReference: paramList.recordId || '{!$Record.Id}',
      inputAssignments: paramList.fields || []
    });
  }

  createCreateRecordNode(nodeId, params) {
    const paramList = this.parseParameters(params);
    this.nodes.push({
      id: nodeId,
      type: 'RecordCreate',
      name: 'Create_Record',
      object: paramList.object || 'Account',
      inputAssignments: paramList.fields || []
    });
  }

  createEmailNode(nodeId, params) {
    const paramList = this.parseParameters(params);
    this.nodes.push({
      id: nodeId,
      type: 'ActionCall',
      name: 'Send_Email',
      actionName: 'emailSimple',
      inputParameters: [
        {
          name: 'emailAddresses',
          value: this.parseValue(paramList.to || '""')
        },
        {
          name: 'emailSubject',
          value: this.parseValue(paramList.subject || '""')
        },
        {
          name: 'emailBody',
          value: this.parseValue(paramList.body || '""')
        }
      ]
    });
  }

  createSubflowNode(nodeId, functionName, params) {
    const paramList = this.parseParameters(params);
    this.nodes.push({
      id: nodeId,
      type: 'SubflowCall',
      name: functionName,
      flowName: functionName,
      inputAssignments: Object.entries(paramList).map(([key, value]) => ({
        name: key,
        value: this.parseValue(value)
      }))
    });
  }

  parseParameters(params) {
    const result = {};
    if (!params.trim()) return result;
    
    const paramPairs = params.split(',').map(p => p.trim());
    for (const pair of paramPairs) {
      const [key, value] = pair.split(':').map(p => p.trim());
      if (key && value) {
        result[key] = value;
      }
    }
    return result;
  }

  connectToPrevious(nodeId) {
    if (this.currentNodeId) {
      this.connections.push({
        source: this.currentNodeId,
        target: nodeId
      });
    } else {
      this.startNodeId = nodeId;
    }
    this.currentNodeId = nodeId;
  }

  generateFlowXML() {
    const flowElements = this.nodes.map(node => this.generateNodeXML(node)).join('\n    ');
    const variables = Array.from(this.variables.values())
      .map(v => this.generateVariableXML(v)).join('\n    ');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <interviewLabel>Generated Flow</interviewLabel>
    <label>Generated Flow</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>50</locationY>
        <connector>
            <targetReference>${this.startNodeId}</targetReference>
        </connector>
    </start>
    ${variables}
    ${flowElements}
</Flow>`;
  }

  generateNodeXML(node) {
    const baseLocation = `
        <locationX>${100 + (this.nodes.indexOf(node) * 200)}</locationX>
        <locationY>150</locationY>`;
    
    switch (node.type) {
      case 'Assignment':
        return `<assignments>
        <name>${node.name}</name>${baseLocation}
        <assignmentItems>
            <assignToReference>${node.assignmentItems[0].assignToReference}</assignToReference>
            <operator>${node.assignmentItems[0].operator}</operator>
            <value>${this.generateValueXML(node.assignmentItems[0].value)}</value>
        </assignmentItems>
    </assignments>`;
      
      case 'Decision':
        return `<decisions>
        <name>${node.name}</name>${baseLocation}
        <defaultConnector>
            <targetReference>${node.defaultConnector.targetReference || 'END'}</targetReference>
        </defaultConnector>
        <rules>
            <name>${node.rules[0].name}</name>
            <conditionLogic>${node.rules[0].conditionLogic}</conditionLogic>
            <conditions>
                <leftValueReference>${node.rules[0].conditions[0].leftValueReference}</leftValueReference>
                <operator>${node.rules[0].conditions[0].operator}</operator>
                <rightValue>${this.generateValueXML(node.rules[0].conditions[0].rightValue)}</rightValue>
            </conditions>
        </rules>
    </decisions>`;
      
      case 'RecordUpdate':
        return `<recordUpdates>
        <name>${node.name}</name>${baseLocation}
        <object>${node.object}</object>
        <inputReference>${node.inputReference}</inputReference>
    </recordUpdates>`;
      
      case 'RecordCreate':
        return `<recordCreates>
        <name>${node.name}</name>${baseLocation}
        <object>${node.object}</object>
    </recordCreates>`;
      
      case 'ActionCall':
        return `<actionCalls>
        <name>${node.name}</name>${baseLocation}
        <actionName>${node.actionName}</actionName>
        ${node.inputParameters.map(param => `
        <inputParameters>
            <name>${param.name}</name>
            <value>${this.generateValueXML(param.value)}</value>
        </inputParameters>`).join('')}
    </actionCalls>`;
      
      default:
        return `<!-- Unknown node type: ${node.type} -->`;
    }
  }

  generateVariableXML(variable) {
    return `<variables>
        <name>${variable.name}</name>
        <dataType>${variable.type}</dataType>
        <isCollection>false</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
    </variables>`;
  }

  generateValueXML(value) {
    if (value.stringValue !== undefined) {
      return `<stringValue>${value.stringValue}</stringValue>`;
    }
    if (value.numberValue !== undefined) {
      return `<numberValue>${value.numberValue}</numberValue>`;
    }
    if (value.booleanValue !== undefined) {
      return `<booleanValue>${value.booleanValue}</booleanValue>`;
    }
    if (value.elementReference !== undefined) {
      return `<elementReference>${value.elementReference}</elementReference>`;
    }
    return '<stringValue></stringValue>';
  }
}

// Example DSL usage
const exampleDSL = `
// Example Flow DSL
var accountName = $Record.Name;
var isActive = $Record.Status__c == "Active";

if (isActive) {
    var newName = accountName + " - Updated";
    updateRecord(object: "Account", recordId: $Record.Id, Name: newName);
}

if ($Record.Type == "Customer") {
    sendEmail(to: "admin@company.com", subject: "New Customer", body: "New customer created");
}
`;

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transpiler.js <input.flow> <output.xml>');
    console.log('\nExample DSL:');
    console.log(exampleDSL);
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1];

  try {
    const dslCode = fs.readFileSync(inputFile, 'utf8');
    const transpiler = new FlowTranspiler();
    const flowXML = transpiler.transpile(dslCode);
    
    fs.writeFileSync(outputFile, flowXML);
    console.log(`Flow XML generated successfully: ${outputFile}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = FlowTranspiler;
