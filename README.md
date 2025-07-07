# Salesforce Flow DSL - Examples and Documentation

## Overview

This DSL (Domain Specific Language) allows you to write Salesforce Flows using a simple, JavaScript-like syntax that transpiles to Salesforce Flow XML.

## Installation and Usage

```bash
# Save the transpiler as transpiler.js
node transpiler.js input.flow output.xml
```

## DSL Syntax Guide

### Variables and Collections
```javascript
// Simple variables
var accountName = $Record.Name;
var isActive = $Record.Status__c == "Active";
var count = 5;
var message = "Hello World";

// Collections
var accounts = getRecords(object: "Account", where: "Type = 'Customer'");
var opportunities = [];
var importantRecords = query(object: "Contact", fields: "Id,Name,Email");
```

### Loops

#### For Loops (Traditional)
```javascript
// Basic for loop
for (i = 0; i < 10; i++) {
    createRecord(object: "Task", Subject: "Task " + i);
}

// For loop with custom increment
for (count = 0; count < 100; count += 5) {
    // Process in increments of 5
}
```

#### ForEach Loops (Collection Iteration)
```javascript
// Iterate through collection
forEach (account in accounts) {
    updateRecord(object: "Account", recordId: account.Id, LastModifiedDate: $Flow.CurrentDateTime);
}

// Iterate through query results
forEach (contact in contacts) {
    if (contact.Email != null) {
        sendEmail(to: contact.Email, subject: "Newsletter", body: "Monthly update");
    }
}
```

### Collection Operations

#### Get Records
```javascript
// Get records with filters
var customers = getRecords(
    object: "Account", 
    where: "Type = 'Customer'", 
    fields: "Id,Name,AnnualRevenue",
    orderBy: "Name",
    into: "customerList"
);
```

#### Query Records
```javascript
// SOQL-style query
var highValueOpps = query(
    object: "Opportunity",
    where: "Amount > 100000",
    fields: "Id,Name,Amount,StageName",
    into: "opportunities"
);
```

#### Collection Manipulation
```javascript
// Add to collection
addToCollection(collection: myList, item: newRecord);

// Remove from collection
removeFromCollection(collection: myList, item: recordToRemove);

// Clear collection
clearCollection(collection: myList);
```

### Conditional Statements
```javascript
// If statements
if ($Record.Type == "Customer") {
    // actions here
}

if ($Record.Amount > 1000) {
    // actions here
}

// Supported operators: ==, !=, >, <, >=, <=, contains, startsWith
```

### Built-in Functions

#### Update Records
```javascript
updateRecord(object: "Account", recordId: $Record.Id, Name: "New Name");
```

#### Create Records
```javascript
createRecord(object: "Contact", FirstName: "John", LastName: "Doe");
```

#### Send Email
```javascript
sendEmail(to: "user@example.com", subject: "Subject", body: "Message body");
```

### $Record Parameter
The `$Record` parameter automatically translates to the current record context in Flow:
- `$Record.Id` → `{!$Record.Id}`
- `$Record.Name` → `{!$Record.Name}`
- `$Record.CustomField__c` → `{!$Record.CustomField__c}`

## Example DSL Files

### Example 1: Account Update Flow
```javascript
// account_update.flow
var accountName = $Record.Name;
var accountType = $Record.Type;

if (accountType == "Customer") {
    var newName = accountName + " - Premium Customer";
    updateRecord(object: "Account", recordId: $Record.Id, Name: newName);
    
    sendEmail(
        to: "sales@company.com",
        subject: "Premium Customer Alert",
        body: "Account " + accountName + " has been marked as premium"
    );
}
```

### Example 2: Opportunity Processing
```javascript
// opportunity_process.flow
var oppAmount = $Record.Amount;
var oppStage = $Record.StageName;

if (oppAmount > 50000) {
    if (oppStage == "Closed Won") {
        // Create follow-up task
        createRecord(
            object: "Task",
            Subject: "Follow up on large opportunity",
            OwnerId: $Record.OwnerId,
            WhatId: $Record.Id
        );
        
        // Send notification
        sendEmail(
            to: "management@company.com",
            subject: "Large Opportunity Closed",
            body: "Opportunity worth $" + oppAmount + " has been closed"
        );
    }
}
```

### Example 3: Case Escalation
```javascript
// case_escalation.flow
var caseStatus = $Record.Status;
var casePriority = $Record.Priority;
var caseAge = $Record.Age_in_Days__c;

if (caseAge > 7) {
    if (casePriority == "High") {
        updateRecord(
            object: "Case",
            recordId: $Record.Id,
            Status: "Escalated",
            Priority: "Critical"
        );
        
        sendEmail(
            to: "escalation@company.com",
            subject: "Case Escalation Required",
            body: "Case " + $Record.CaseNumber + " requires immediate attention"
        );
    }
}
```

## Generated XML Structure

The transpiler generates standard Salesforce Flow XML with:

- **Flow metadata** (API version, labels, process type)
- **Start element** pointing to the first node
- **Variables** for all declared variables
- **Flow elements** (assignments, decisions, record operations, actions)
- **Connectors** linking elements in sequence

## Advanced Features

### Variable Types
The transpiler automatically infers types:
- Strings: `"text"` → String
- Numbers: `42` → Number  
- Booleans: `true/false` → Boolean
- Record references: `$Record.Field` → Reference

### Operator Mapping
- `==` → EqualTo
- `!=` → NotEqualTo
- `>` → GreaterThan
- `>=` → GreaterThanOrEqualTo
- `<` → LessThan
- `<=` → LessThanOrEqualTo
- `contains` → Contains
- `startsWith` → StartsWith

### Node Positioning
The transpiler automatically positions nodes in the Flow Builder with appropriate spacing and connections.

## Deployment

1. **Transpile**: Convert your DSL to XML
   ```bash
   node transpiler.js my_flow.flow my_flow.xml
   ```

2. **Package**: Include in your package.xml
   ```xml
   <types>
       <members>My_Flow</members>
       <name>Flow</name>
   </types>
   ```

3. **Deploy**: Use SFDX or your preferred deployment tool
   ```bash
   sfdx force:source:deploy -p path/to/flows
   ```

## Benefits

- **Readability**: Clean, familiar syntax
- **Maintainability**: Version control friendly
- **Reusability**: Template flows with variables
- **Validation**: Compile-time error checking
- **Automation**: Integrate with CI/CD pipelines

## Limitations

- Currently supports basic flow elements
- No screen flows or user interaction elements
- Limited to auto-launched and record-triggered flows
- No advanced flow features like loops or collections yet

## Extensions

The transpiler can be extended to support:
- Screen flows with input/output variables
- Loop constructs
- Collection operations
- Custom actions and invocables
- More complex conditional logic
