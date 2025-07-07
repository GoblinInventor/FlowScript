// FlowScript Screen Flow Extension
// Extends the existing FlowScript DSL to support screen flows and user interaction

class FlowScriptScreenParser {
    constructor() {
        this.screens = [];
        this.currentScreen = null;
        this.flowVariables = new Map();
        this.navigationRules = [];
    }

    // Parse screen flow syntax
    parseScreenFlow(code) {
        const lines = code.split('\n');
        let currentContext = 'flow';
        let braceLevel = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('screen(')) {
                currentContext = 'screen';
                this.parseScreenDefinition(line);
            } else if (line.startsWith('navigate(')) {
                this.parseNavigation(line);
            } else if (currentContext === 'screen' && line.includes('{')) {
                braceLevel++;
            } else if (currentContext === 'screen' && line.includes('}')) {
                braceLevel--;
                if (braceLevel === 0) {
                    currentContext = 'flow';
                }
            } else if (currentContext === 'screen') {
                this.parseScreenElement(line);
            }
        }
    }

    parseScreenDefinition(line) {
        // Extract screen name and properties
        const match = line.match(/screen\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?\s*\)/);
        if (match) {
            this.currentScreen = {
                name: match[1],
                label: match[2] || match[1],
                elements: [],
                helpText: null,
                allowBack: true,
                allowFinish: true,
                allowPause: false
            };
            this.screens.push(this.currentScreen);
        }
    }

    parseScreenElement(line) {
        if (!this.currentScreen) return;

        // Parse different screen element types
        if (line.includes('displayText(')) {
            this.parseDisplayText(line);
        } else if (line.includes('inputText(')) {
            this.parseInputText(line);
        } else if (line.includes('inputNumber(')) {
            this.parseInputNumber(line);
        } else if (line.includes('inputDate(')) {
            this.parseInputDate(line);
        } else if (line.includes('inputCheckbox(')) {
            this.parseInputCheckbox(line);
        } else if (line.includes('inputPicklist(')) {
            this.parseInputPicklist(line);
        } else if (line.includes('inputLookup(')) {
            this.parseInputLookup(line);
        } else if (line.includes('displayTable(')) {
            this.parseDisplayTable(line);
        } else if (line.includes('inputTable(')) {
            this.parseInputTable(line);
        }
    }

    parseDisplayText(line) {
        const match = line.match(/displayText\(\s*text:\s*"([^"]+)"(?:,\s*name:\s*"([^"]+)")?\s*\)/);
        if (match) {
            this.currentScreen.elements.push({
                type: 'displayText',
                name: match[2] || 'DisplayText_' + Date.now(),
                text: match[1]
            });
        }
    }

    parseInputText(line) {
        const match = line.match(/inputText\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*required:\s*(true|false))?(?:,\s*defaultValue:\s*"([^"]+)")?\s*\)/);
        if (match) {
            const element = {
                type: 'inputText',
                name: match[1],
                label: match[2] || match[1],
                required: match[3] === 'true',
                defaultValue: match[4] || null
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'String', value: match[4] || null });
        }
    }

    parseInputNumber(line) {
        const match = line.match(/inputNumber\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*required:\s*(true|false))?(?:,\s*defaultValue:\s*(\d+))?\s*\)/);
        if (match) {
            const element = {
                type: 'inputNumber',
                name: match[1],
                label: match[2] || match[1],
                required: match[3] === 'true',
                defaultValue: match[4] ? parseInt(match[4]) : null
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'Number', value: element.defaultValue });
        }
    }

    parseInputDate(line) {
        const match = line.match(/inputDate\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*required:\s*(true|false))?\s*\)/);
        if (match) {
            const element = {
                type: 'inputDate',
                name: match[1],
                label: match[2] || match[1],
                required: match[3] === 'true'
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'Date', value: null });
        }
    }

    parseInputCheckbox(line) {
        const match = line.match(/inputCheckbox\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*defaultValue:\s*(true|false))?\s*\)/);
        if (match) {
            const element = {
                type: 'inputCheckbox',
                name: match[1],
                label: match[2] || match[1],
                defaultValue: match[3] === 'true'
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'Boolean', value: element.defaultValue || false });
        }
    }

    parseInputPicklist(line) {
        const match = line.match(/inputPicklist\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*options:\s*\[([^\]]+)\])?\s*\)/);
        if (match) {
            const options = match[3] ? match[3].split(',').map(opt => opt.trim().replace(/"/g, '')) : [];
            const element = {
                type: 'inputPicklist',
                name: match[1],
                label: match[2] || match[1],
                options: options
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'String', value: null });
        }
    }

    parseInputLookup(line) {
        const match = line.match(/inputLookup\(\s*name:\s*"([^"]+)"(?:,\s*label:\s*"([^"]+)")?(?:,\s*object:\s*"([^"]+)")?(?:,\s*displayField:\s*"([^"]+)")?\s*\)/);
        if (match) {
            const element = {
                type: 'inputLookup',
                name: match[1],
                label: match[2] || match[1],
                object: match[3] || 'Account',
                displayField: match[4] || 'Name'
            };
            this.currentScreen.elements.push(element);
            this.flowVariables.set(match[1], { type: 'String', value: null });
        }
    }

    parseDisplayTable(line) {
        const match = line.match(/displayTable\(\s*name:\s*"([^"]+)"(?:,\s*collection:\s*"([^"]+)")?(?:,\s*columns:\s*\[([^\]]+)\])?\s*\)/);
        if (match) {
            const columns = match[3] ? match[3].split(',').map(col => col.trim().replace(/"/g, '')) : [];
            const element = {
                type: 'displayTable',
                name: match[1],
                collection: match[2],
                columns: columns
            };
            this.currentScreen.elements.push(element);
        }
    }

    parseInputTable(line) {
        const match = line.match(/inputTable\(\s*name:\s*"([^"]+)"(?:,\s*collection:\s*"([^"]+)")?(?:,\s*columns:\s*\[([^\]]+)\])?\s*\)/);
        if (match) {
            const columns = match[3] ? match[3].split(',').map(col => col.trim().replace(/"/g, '')) : [];
            const element = {
                type: 'inputTable',
                name: match[1],
                collection: match[2],
                columns: columns,
                allowAdd: true,
                allowEdit: true,
                allowDelete: true
            };
            this.currentScreen.elements.push(element);
        }
    }

    parseNavigation(line) {
        const match = line.match(/navigate\(\s*to:\s*"([^"]+)"(?:,\s*when:\s*"([^"]+)")?\s*\)/);
        if (match) {
            this.navigationRules.push({
                targetScreen: match[1],
                condition: match[2] || null
            });
        }
    }

    // Generate Salesforce Flow XML for screens
    generateScreenXML() {
        let xml = '';
        
        // Generate screen elements
        this.screens.forEach(screen => {
            xml += this.generateScreenElement(screen);
        });

        // Generate variables
        this.flowVariables.forEach((variable, name) => {
            xml += this.generateVariableXML(name, variable);
        });

        return xml;
    }

    generateScreenElement(screen) {
        return `
    <screens>
        <name>${screen.name}</name>
        <label>${screen.label}</label>
        <locationX>176</locationX>
        <locationY>158</locationY>
        <allowBack>${screen.allowBack}</allowBack>
        <allowFinish>${screen.allowFinish}</allowFinish>
        <allowPause>${screen.allowPause}</allowPause>
        <fields>
            ${screen.elements.map(element => this.generateFieldXML(element)).join('')}
        </fields>
    </screens>`;
    }

    generateFieldXML(element) {
        switch (element.type) {
            case 'displayText':
                return `
            <name>${element.name}</name>
            <fieldText>${element.text}</fieldText>
            <fieldType>DisplayText</fieldType>`;
            
            case 'inputText':
                return `
            <name>${element.name}</name>
            <fieldText>${element.label}</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>${element.required}</isRequired>
            <outputReference>${element.name}</outputReference>`;
            
            case 'inputNumber':
                return `
            <name>${element.name}</name>
            <fieldText>${element.label}</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>${element.required}</isRequired>
            <outputReference>${element.name}</outputReference>`;
            
            case 'inputDate':
                return `
            <name>${element.name}</name>
            <fieldText>${element.label}</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>${element.required}</isRequired>
            <outputReference>${element.name}</outputReference>`;
            
            case 'inputCheckbox':
                return `
            <name>${element.name}</name>
            <fieldText>${element.label}</fieldText>
            <fieldType>InputField</fieldType>
            <outputReference>${element.name}</outputReference>`;
            
            case 'inputPicklist':
                return `
            <name>${element.name}</name>
            <choiceReferences>${element.options.map(opt => opt.replace(/\s+/g, '_')).join('</choiceReferences><choiceReferences>')}</choiceReferences>
            <fieldText>${element.label}</fieldText>
            <fieldType>DropdownBox</fieldType>
            <outputReference>${element.name}</outputReference>`;
            
            case 'inputLookup':
                return `
            <name>${element.name}</name>
            <fieldText>${element.label}</fieldText>
            <fieldType>LookupField</fieldType>
            <outputReference>${element.name}</outputReference>`;
            
            case 'displayTable':
                return `
            <name>${element.name}</name>
            <fieldText>${element.name}</fieldText>
            <fieldType>ComponentInstance</fieldType>
            <inputReference>${element.collection}</inputReference>`;
            
            case 'inputTable':
                return `
            <name>${element.name}</name>
            <fieldText>${element.name}</fieldText>
            <fieldType>ComponentInstance</fieldType>
            <inputReference>${element.collection}</inputReference>
            <outputReference>${element.name}</outputReference>`;
            
            default:
                return '';
        }
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
}

// Example usage and syntax demonstration
const exampleScreenFlow = `
// Screen Flow Example - Customer Onboarding
screen(name: "Welcome", label: "Customer Onboarding") {
    displayText(text: "Welcome to our customer onboarding process!");
    inputText(name: "customerName", label: "Customer Name", required: true);
    inputText(name: "customerEmail", label: "Email Address", required: true);
    inputPicklist(name: "customerType", label: "Customer Type", options: ["Individual", "Business", "Enterprise"]);
    inputCheckbox(name: "agreeToTerms", label: "I agree to the terms and conditions");
}

navigate(to: "ContactInfo", when: "agreeToTerms == true");

screen(name: "ContactInfo", label: "Contact Information") {
    displayText(text: "Please provide your contact information:");
    inputText(name: "phoneNumber", label: "Phone Number");
    inputText(name: "address", label: "Address");
    inputText(name: "city", label: "City");
    inputText(name: "state", label: "State");
    inputText(name: "zipCode", label: "ZIP Code");
    inputDate(name: "preferredContactDate", label: "Preferred Contact Date");
}

navigate(to: "Preferences", when: "customerType == 'Business'");
navigate(to: "Summary", when: "customerType == 'Individual'");

screen(name: "Preferences", label: "Business Preferences") {
    displayText(text: "Business customer preferences:");
    inputNumber(name: "employeeCount", label: "Number of Employees");
    inputPicklist(name: "industry", label: "Industry", options: ["Technology", "Healthcare", "Finance", "Manufacturing", "Other"]);
    inputLookup(name: "parentAccount", label: "Parent Account", object: "Account", displayField: "Name");
}

navigate(to: "Summary");

screen(name: "Summary", label: "Summary") {
    displayText(text: "Please review your information:");
    displayText(text: "Name: " + customerName);
    displayText(text: "Email: " + customerEmail);
    displayText(text: "Type: " + customerType);
    displayText(text: "Phone: " + phoneNumber);
}

// After screens, continue with flow logic
if (agreeToTerms == true) {
    createRecord(
        object: "Account",
        Name: customerName,
        Email__c: customerEmail,
        Type: customerType,
        Phone: phoneNumber
    );
    
    sendEmail(
        to: customerEmail,
        subject: "Welcome to Our Company",
        body: "Thank you for joining us, " + customerName + "!"
    );
}
`;

// Export the parser for use in the main transpiler
module.exports = { FlowScriptScreenParser, exampleScreenFlow };
