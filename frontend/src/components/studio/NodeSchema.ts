export type UIComponentType = 'text' | 'number' | 'toggle' | 'select' | 'code' | 'json';

export interface SchemaField {
    key: string;
    label: string;
    type: UIComponentType;
    defaultValue: any;
    options?: { label: string; value: string }[]; // For select components
    description?: string;
    required?: boolean;
}

export interface NodeSchema {
    nodeType: string;
    title: string;
    description: string;
    fields: SchemaField[];
}

export const NodeSchemaRegistry: Record<string, NodeSchema> = {
    triggerNode: {
        nodeType: 'triggerNode',
        title: 'Trigger Payload',
        description: 'Manual Execution Setup',
        fields: [
            { key: 'triggerType', label: 'Trigger Type', type: 'select', defaultValue: 'manual', options: [{ label: 'Manual', value: 'manual' }, { label: 'Webhook', value: 'webhook' }] },
            { key: 'payloadTemplate', label: 'Payload Template', type: 'json', defaultValue: '{\n  "applicant_name": ""\n}' }
        ]
    },
    integrationNode: {
        nodeType: 'integrationNode',
        title: 'Equifax Commercial API',
        description: 'Fetch bureau data',
        fields: [
            { key: 'label', label: 'Integration Name', type: 'text', defaultValue: 'Equifax Commercial' },
            { key: 'connection', label: 'Connection Profile', type: 'select', defaultValue: 'Risk API Gateway', options: [{ label: 'Risk API Gateway', value: 'Risk API Gateway' }, { label: 'Direct Integration', value: 'Direct Integration' }] },
            { key: 'fieldAssignment', label: 'Output Map To', type: 'text', defaultValue: 'data.credit_report' },
            { key: 'requestBody', label: 'Request Body Template', type: 'code', defaultValue: '{\n  "company": "{{ input.applicant_name }}"\n}' }
        ]
    },
    gstReconciliationNode: {
        nodeType: 'gstReconciliationNode',
        title: 'GST Reconciliation',
        description: 'Cross-check GST returns with Bank Statements',
        fields: [
            { key: 'gstSource', label: 'GST Data Source', type: 'text', defaultValue: 'data.gst_returns' },
            { key: 'bankSource', label: 'Bank Data Source', type: 'text', defaultValue: 'data.bank_statements' },
            { key: 'tolerancePercentage', label: 'Variance Tolerance (%)', type: 'number', defaultValue: 5 },
            { key: 'flagAnomalies', label: 'Halt on Variance', type: 'toggle', defaultValue: true }
        ]
    },
    documentClassificationNode: {
        nodeType: 'documentClassificationNode',
        title: 'Groq LLM Extractor',
        description: 'Extract entities via Groq fast inference',
        fields: [
            { key: 'label', label: 'Extractor Name', type: 'text', defaultValue: 'Databricks Document Parse' },
            { key: 'model', label: 'LLM Model', type: 'select', defaultValue: 'llama3-70b-8192', options: [{ label: 'llama3-70b-8192', value: 'llama3-70b-8192' }, { label: 'mixtral-8x7b', value: 'mixtral-8x7b' }] },
            { key: 'promptTemplate', label: 'Extraction Prompt', type: 'code', defaultValue: 'Extract the financials from the following document...' },
            { key: 'confidenceThreshold', label: 'Confidence Threshold', type: 'number', defaultValue: 90 }
        ]
    },
    conditionNode: {
        nodeType: 'conditionNode',
        title: 'Routing Logic',
        description: 'Conditionally route workflow execution',
        fields: [
            { key: 'label', label: 'Condition Name', type: 'text', defaultValue: 'Risk Score Check' },
            { key: 'expression', label: 'Evaluation Expression', type: 'code', defaultValue: '{{ nodes.integrationNode.credit_report.riskScore }} > 700' },
            { key: 'targetField', label: 'Assignment Target', type: 'text', defaultValue: 'data.credit_decision' },
            { key: 'defaultValue', label: 'Default Value', type: 'text', defaultValue: 'REVIEW' }
        ]
    },
    explainableAINode: {
        nodeType: 'explainableAINode',
        title: 'TreeSHAP Attributions',
        description: 'Generate model explainability metrics',
        fields: [
            { key: 'modelReference', label: 'Target Model', type: 'text', defaultValue: 'models/pd_gradient_boost_v2' },
            { key: 'topK', label: 'Top Drivers Count', type: 'number', defaultValue: 5 },
            { key: 'baselineDataset', label: 'SHAP Baseline Data', type: 'text', defaultValue: 'training/baseline_2000.csv' }
        ]
    },
    mcaFilingSyncNode: {
        nodeType: 'mcaFilingSyncNode',
        title: 'MCA Compliance Check',
        description: 'Fetch Corporate Filings via Signzy',
        fields: [
            { key: 'cinTarget', label: 'Target CIN Variable', type: 'text', defaultValue: 'data.cin' },
            { key: 'syncDirectors', label: 'Fetch Director List', type: 'toggle', defaultValue: true },
            { key: 'syncFinancials', label: 'Fetch Authorized/Paid Capital', type: 'toggle', defaultValue: true }
        ]
    },
    epfoAnomalyNode: {
        nodeType: 'epfoAnomalyNode',
        title: 'EPFO Anomaly Alert',
        description: 'Detect missing employee provident fund payments',
        fields: [
            { key: 'employerIdTarget', label: 'Employer Target Variable', type: 'text', defaultValue: 'data.epfo_id' },
            { key: 'toleranceMonths', label: 'Missed Payments Tolerance (Months)', type: 'number', defaultValue: 3 }
        ]
    }
};

export const getSchemaForNodeType = (nodeType: string): NodeSchema | undefined => {
    return NodeSchemaRegistry[nodeType];
};
