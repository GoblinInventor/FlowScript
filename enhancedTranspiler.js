// Enhanced FlowScript Transpiler with Screen Flow Support
// This extends the original transpiler to handle screen flows

const { FlowScriptScreenParser } = require('./flowScriptScreenParser');

class EnhancedFlowScriptTranspiler {
    constructor() {
        this.screenParser = new FlowScriptScreenParser();
        this.flowElements = [];
        this.variables = new Map();
        this.decisions = [];
        this.assignments = [];
        this.recordCreates = [];
        this.recordUpdates = [];
        this.recordGets = [];
        this.emailAlerts = [];
        this.connectors = [];
        this.flowType = 'autolaunched'; // Default, will be changed if screens detected
        this.elementCounter = 0;
    }

    transpile(flowScriptCode) {
        // First, detect if this is a screen flow
        const hasScreens = flowScriptCode.includes('screen(');
        if (hasScreens) {
            this.flowType = 'screen';
            return this.transpileScreenFlow(flowScriptCode);
        } else {
            return this.transpileRegularFlow(flowScriptCode);
        }
    }

    transpileScreenFlow(code) {
        // Parse screens first
        this.screenParser.parseScreenFlow(code);
        
        // Extract non-screen code (flow logic after screens)
        const nonScreenCode = this.extractNonScreenCode(code);
        
        // Parse the remaining flow logic
        this.parseFlowLogic(nonScreenCode);
        
        // Generate complete XML
        return this.generateScreenFlowXML();
    }

    extractNonScreenCode(code) {
        const lines = code.split('\n');
        let nonScreenLines = [];
        let inScreen = false;
        let braceLevel = 0;
        let inNavigate = false;

        for (let line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('screen(')) {
                inScreen = true;
                braceLevel = 0;
                continue;
            }
            
            if (trimmed.startsWith('navigate(')) {
                inNavigate = true;
                continue;
            }
            
            if (inNavigate && trimmed.endsWith(';')) {
                inNavigate = false;
                continue;
            }
            
            if (inScreen) {
                if (trimmed.includes('{')) braceLevel++;
                if (trimmed.includes('}')) braceLevel--;
                
                if (braceLevel < 0) {
                    inScreen = false;
                    braceLevel = 0;
                }
                continue;
            }
            
            if (!inScreen && !inNavigate) {
                nonScreenLines.push(line);
            }
        }

        return nonScreenLines.join('\n');
    }

    parseFlowLogic(code) {
        // Parse the existing FlowScript logic (variables, conditions, records, etc.)
        const lines = code.split('\n');
        
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            
            if (trimmed.startsWith('var ')) {
                this.parseVariable(trimmed);
            } else if (trimmed.startsWith('if ')) {
                this.parseIfStatement(trimmed);
            } else if (trimmed.includes('createRecord(')) {
                this.parseCreateRecord(trimmed);
            } else if (trimmed.includes('updateRecord(')) {
                this.parseUpdateRecord(trimmed);
            } else if (trimmed.includes('getRecords(')) {
                this.parseGetRecords(trimmed);
            } else if (trimmed.includes('sendEmail(')) {
                this.parseSendEmail(trimmed);
            }
        }
    }

    parseVariable(line) {
        const match = line.match(/var\s+(\w+)\s*=\s*(.+);/);
        if (match) {
            const name = match[1];
            const value = match[2];
            const type = this.inferType(value);
            
            this.variables.set(name, {
                name: name,
                type: type,
                value: value
            });
        }
    }

    parseIfStatement(line) {
        const match = line.match(/if\s*\((.+)\)\s*\{/);
        if (match) {
            const condition = match[1];
            const decisionId = `Decision_${this.elementCounter++}`;
            
            this.decisions.push({
                id: decisionId,
                condition: condition,
                trueConnector: null,
                falseConnector: null
            });
        }
    }

    parseCreateRecord(line) {
        const match = line.match(/createRecord\((.+)\);/);
        if (match) {
            const params = this.parseParameters(match[1]);
            const recordCreateId = `RecordCreate_${this.elementCounter++}`;
            
            this.recordCreates.push({
                id: recordCreateId,
                object: params.object,
                fields: params,
                assignRecordIdToReference: params.assignRecordIdToReference || null
            });
        }
    }

    parseUpdateRecord(line) {
        const match = line.match(/updateRecord\((.+)\);/);
        if (match) {
            const params = this.parseParameters(match[1]);
            const recordUpdateId = `RecordUpdate_${this.elementCounter++}`;
            
            this.recordUpdates.push({
                id: recordUpdateId,
                object: params.object,
                recordId: params.recordId,
                fields: params
            });
        }
    }

    parseGetRecords(line) {
        const match = line.match(/getRecords\((.+)\);/);
        if (match) {
            const params = this.parseParameters(match[1]);
            const recordGetId = `RecordGet_${this.elementCounter++}`;
            
            this.recordGets.push({
                id: recordGetId,
                object: params.object,
                conditions: params.where,
                fields: params.fields,
                storeOutputAutomatically: true,
                assignNullValuesIfNoRecordsFound: false
            });
        }
    }

    parseSendEmail(line) {
        const match = line.match(/sendEmail\((.+)\);/);
        if (match) {
            const params = this.parseParameters(match[1]);
            const emailId = `Email_${this.elementCounter++}`;
            
            this.emailAlerts.push({
                id: emailId,
                to: params.to,
                subject: params.subject,
                body: params.body
            });
        }
    }

    parseParameters(paramString) {
        const params = {};
        const paramPairs = paramString.split(/,(?=\s*\w+:)/);
        
        for (let pair of paramPairs) {
            const match = pair.trim().match(/(\w+):\s*(.+)/);
            if (match) {
                const key = match[1];
                let value = match[2].trim();
                
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                
                params[key] = value;
            }
        }
        
        return params;
    }

    inferType(value) {
        if (value.startsWith('"') && value.endsWith('"')) {
            return 'String';
        } else if (!isNaN(value)) {
            return 'Number';
        } else if (value === 'true' || value === 'false') {
            return 'Boolean';
        } else if (value.startsWith('$Record.')) {
            return 'String'; // Field references are typically strings
        } else {
            return 'String'; // Default
        }
    }

    generateScreenFlowXML() {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <description>Generated by FlowScript with Screen Flow Extension</description>
    <label>FlowScript Generated Screen Flow</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value>
            <stringValue>AUTO_LAYOUT_CANVAS</stringValue>
        </value>
    </processMetadataValues>
    <processType>Flow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>${this.screenParser.screens[0]?.name || 'End'}</targetReference>
        </connector>
    </start>
`;

        // Add screen variables from screen parser
        this.screenParser.flowVariables.forEach((variable, name) => {
            xml += this.generateVariableXML(name, variable);
        });

        // Add other variables
        this.variables.forEach((variable, name) => {
            xml += this.generateVariableXML(name, variable);
        });

        // Add screens
        xml += this.screenParser.generateScreenXML();

        // Add navigation connectors between screens
        xml += this.generateNavigationConnectors();

        // Add flow logic elements
        xml += this.generateFlowElements();

        xml += `</Flow>`;
        return xml;
    }

    generateVariableXML(name, variable) {
        return `
    <variables>
        <name>${name}</name>
        <dataType>${variable.type}</dataType>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
        ${variable.value ? `<value><stringValue>${variable.value}</stringValue></value>` : ''}
    </variables>`;
    }

    generateNavigationConnectors() {
        let xml = '';
        
        // Generate connectors between screens based on navigation rules
        this.screenParser.screens.forEach((screen, index) => {
            const navigationRules = this.screenParser.navigationRules.filter(rule => 
                this.findScreenIndex(rule.targetScreen) > index
            );
            
            if (navigationRules.length > 0) {
                navigationRules.forEach(rule => {
                    xml += `
    <decisions>
        <name>Navigate_${screen.name}_${rule.targetScreen}</name>
        <label>Navigate from ${screen.name} to ${rule.targetScreen}</label>
        <locationX>200</locationX>
        <locationY>${200 + index * 150}</locationY>
        <defaultConnector>
            <targetReference>${this.getNextElement(screen.name)}</targetReference>
        </defaultConnector>
        <rules>
            <name>NavigationRule_${screen.name}_${rule.targetScreen}</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>${this.parseConditionToReference(rule.condition)}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <booleanValue>true</booleanValue>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>${rule.targetScreen}</targetReference>
            </connector>
            <label>Navigate to ${rule.targetScreen}</label>
        </rules>
    </decisions>`;
                });
            }
        });

        return xml;
    }

    generateFlowElements() {
        let xml = '';

        // Generate record creates
        this.recordCreates.forEach(recordCreate => {
            xml += `
    <recordCreates>
        <name>${recordCreate.id}</name>
        <label>Create ${recordCreate.object}</label>
        <locationX>400</locationX>
        <locationY>200</locationY>
        <inputAssignments>
            ${Object.entries(recordCreate.fields)
                .filter(([key]) => key !== 'object')
                .map(([field, value]) => `
            <field>${field}</field>
            <value>
                <elementReference>${this.convertValueToReference(value)}</elementReference>
            </value>`)
                .join('')}
        </inputAssignments>
        <object>${recordCreate.object}</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordCreates>`;
        });

        // Generate record updates
        this.recordUpdates.forEach(recordUpdate => {
            xml += `
    <recordUpdates>
        <name>${recordUpdate.id}</name>
        <label>Update ${recordUpdate.object}</label>
        <locationX>400</locationX>
        <locationY>300</locationY>
        <inputAssignments>
            ${Object.entries(recordUpdate.fields)
                .filter(([key]) => !['object', 'recordId'].includes(key))
                .map(([field, value]) => `
            <field>${field}</field>
            <value>
                <elementReference>${this.convertValueToReference(value)}</elementReference>
            </value>`)
                .join('')}
        </inputAssignments>
        <inputReference>${this.convertValueToReference(recordUpdate.recordId)}</inputReference>
    </recordUpdates>`;
        });

        // Generate email alerts
        this.emailAlerts.forEach(email => {
            xml += `
    <actionCalls>
        <name>${email.id}</name>
        <label>Send Email</label>
        <locationX>400</locationX>
        <locationY>400</locationY>
        <actionName>emailSimple</actionName>
        <actionType>emailSimple</actionType>
        <inputParameters>
            <name>emailAddresses</name>
            <value>
                <elementReference>${this.convertValueToReference(email.to)}</elementReference>
            </value>
        </inputParameters>
        <inputParameters>
            <name>emailSubject</name>
            <value>
                <elementReference>${this.convertValueToReference(email.subject)}</elementReference>
            </value>
        </inputParameters>
        <inputParameters>
            <name>emailBody</name>
            <value>
                <elementReference>${this.convertValueToReference(email.body)}</elementReference>
            </value>
        </inputParameters>
    </actionCalls>`;
        });

        return xml;
    }

    findScreenIndex(screenName) {
        return this.screenParser.screens.findIndex(screen => screen.name === screenName);
    }

    getNextElement(currentScreenName) {
        const currentIndex = this.findScreenIndex(currentScreenName);
        const nextScreen = this.screenParser.screens[currentIndex + 1];
        
        if (nextScreen) {
            return nextScreen.name;
        } else {
            // If no next screen, go to flow logic or end
            return this.recordCreates[0]?.id || this.recordUpdates[0]?.id || this.emailAlerts[0]?.id || 'End';
        }
    }

    parseConditionToReference(condition) {
        // Simple condition parsing - can be enhanced
        const match = condition.match(/(\w+)\s*==\s*(.+)/);
        if (match) {
            return match[1];
        }
        return condition;
    }

    convertValueToReference(value) {
        if (typeof value === 'string') {
            if (value.startsWith('$Record.')) {
                return value.replace('$Record.', '$Record.');
            } else if (this.variables.has(value) || this.screenParser.flowVariables.has(value)) {
                return value;
            } else {
                // It's a literal value, create a text template
                return `Literal_${value.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
        }
        return value;
    }

    transpileRegularFlow(code) {
        // Original transpiler logic for non-screen flows
        this.parseFlowLogic(code);
        return this.generateRegularFlowXML();
    }

    generateRegularFlowXML() {
        // Generate XML for regular flows without screens
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <description>Generated by FlowScript</description>
    <label>FlowScript Generated Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>${this.getFirstElement()}</targetReference>
        </connector>
    </start>
`;

        // Add variables
        this.variables.forEach((variable, name) => {
            xml += this.generateVariableXML(name, variable);
        });

        // Add flow elements
        xml += this.generateFlowElements();

        xml += `</Flow>`;
        return xml;
    }

    getFirstElement() {
        return this.recordCreates[0]?.id || this.recordUpdates[0]?.id || this.emailAlerts[0]?.id || 'End';
    }
}

// Usage example
const fs = require('fs');

function main() {
    const transpiler = new EnhancedFlowScriptTranspiler();
    
    // Read FlowScript file
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];
    
    if (!inputFile || !outputFile) {
        console.log('Usage: node enhanced-transpiler.js input.flow output.xml');
        return;
    }
    
    const flowScriptCode = fs.readFileSync(inputFile, 'utf8');
    const flowXML = transpiler.transpile(flowScriptCode);
    
    fs.writeFileSync(outputFile, flowXML);
    console.log(`Screen flow successfully transpiled to ${outputFile}`);
}

// Export for use as module
module.exports = { EnhancedFlowScriptTranspiler };

// Run if called directly
if (require.main === module) {
    main();
}
