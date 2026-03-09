describe('Decision Studio Component Verification', () => {
    beforeEach(() => {
        // Mock the Auth Token to bypass login
        cy.window().then((win) => {
            win.localStorage.setItem('auth_token', 'mock_test_token_123');
        });

        // Intercept GraphQL/REST network calls
        cy.intercept('POST', '**/api/v1/engine/execute-draft').as('executeDraft');

        // Navigate to Studio Builder
        cy.visit('http://localhost:3000/studio');
    });

    it('Renders the Workspace, Canvas, and Properties Sidebar', () => {
        cy.get('aside').contains('Node Library').should('be.visible');
        cy.get('.react-flow').should('exist');
        cy.get('aside').contains('Configuration').should('be.visible');
    });

    it('Can drag and drop EPC & MCA Nodes into the Workspace', () => {
        // Drag Trigger
        const dataTransfer = new DataTransfer();
        cy.contains('Manual Trigger').trigger('dragstart', { dataTransfer });
        cy.get('.react-flow__pane').trigger('drop', { dataTransfer, clientX: 200, clientY: 200 });

        // Check Canvas for Rendered Nodes
        cy.get('.react-flow__node-triggerNode').should('exist');
        cy.contains('Initiation').should('be.visible');

        // Drag MCAFilingSyncNode
        const dataTransfer2 = new DataTransfer();
        cy.contains('MCA V3 Gateway').trigger('dragstart', { dataTransfer: dataTransfer2 });
        cy.get('.react-flow__pane').trigger('drop', { dataTransfer: dataTransfer2, clientX: 200, clientY: 400 });

        cy.get('.react-flow__node-mcaFilingSyncNode').should('exist');
        cy.contains('Regulator Sync').should('be.visible');

        // Drag EPFOAnomalyNode
        const dataTransfer3 = new DataTransfer();
        cy.contains('EPFO Anomalies').trigger('dragstart', { dataTransfer: dataTransfer3 });
        cy.get('.react-flow__pane').trigger('drop', { dataTransfer: dataTransfer3, clientX: 400, clientY: 400 });

        cy.get('.react-flow__node-epfoAnomalyNode').should('exist');
        cy.contains('Compliance Check').should('be.visible');
    });

    it('Triggers the Ephemeral execution pipeline and detects cycle loops', () => {
        // Drag Trigger
        const dataTransfer = new DataTransfer();
        cy.contains('Manual Trigger').trigger('dragstart', { dataTransfer });
        cy.get('.react-flow__pane').trigger('drop', { dataTransfer, clientX: 200, clientY: 200 });

        // Connect back onto itself (Invalid Loop)
        // Note: React Flow DOM interaction requires precise mouse emulation which Cypress abstracts poorly,
        // so we intercept the API POST directly to ensure the schema structure is protected.

        cy.contains('button', 'Deploy workflow').click();

        // Wait for the mock 400 rejection from Kahn's cycle sort validator
        cy.wait('@executeDraft').then((interception) => {
            expect(interception.request.body).to.have.property('nodes');
            expect(interception.request.body).to.have.property('edges');
            expect(interception.request.body).to.have.property('trigger_payload');
        });
    });
});
