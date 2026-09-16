const bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn" 
  id="sample-diagram" 
  targetNamespace="http://bpmn.io/schema/bpmn" 
  xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="192" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
// The CDN bundle exposes CamundaPlatformModeler on the window object
const ModelerClass = window.CamundaPlatformModeler || window.BpmnJS;

const modeler = new ModelerClass({
  container: '#canvas',
  keyboard: {
    bindTo: window
  },
  propertiesPanel: {
    parent: '#properties-panel' // Mounts the panel UI inside our new div
  }
});

// The rest of your Dataiku endpoints logic (load/save) remains exactly the same

// Render the diagram
modeler.importXML(bpmnXML)
  .then(() => {
    console.log('BPMN modeler rendered successfully!');
    // Fit the diagram to the viewport
    modeler.get('canvas').zoom('fit-viewport');
  })
  .catch((err) => {
    console.error('Error rendering BPMN diagram', err);
  });
// 1. Auto-load the diagram from Dataiku when the webapp starts
window.addEventListener('load', async () => {
    try {
        const response = await fetch(getWebAppBackendUrl('/load'));
        if (response.ok) {
            const data = await response.json();
            await modeler.importXML(data.xml);
            modeler.get('canvas').zoom('fit-viewport');
            console.log('Loaded from Dataiku folder!');
        } else {
            console.log('No existing diagram found. Starting blank.');
        }
    } catch (err) {
        console.error('Failed to load from backend', err);
    }
});

// 2. Change the save button to push to Dataiku
document.getElementById('save-button').addEventListener('click', async () => {
    try {
        const { xml } = await modeler.saveXML({ format: true });
        
        const response = await fetch(getWebAppBackendUrl('/save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xml: xml })
        });

        if (response.ok) {
            alert('Diagram saved securely to Dataiku Managed Folder!');
        }
    } catch (err) {
        console.error('Error saving to backend', err);
        alert('Failed to save diagram.');
    }
});