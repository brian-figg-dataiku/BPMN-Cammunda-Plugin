<script type="module">
  // 1. Import everything from ESM.sh (automatically bundles for browser use)
  import BpmnModeler from 'https://esm.sh/bpmn-js@17.0.2/lib/Modeler?bundle';
  import { 
    BpmnPropertiesPanelModule, 
    BpmnPropertiesProviderModule, 
    CamundaPlatformPropertiesProviderModule 
  } from 'https://esm.sh/bpmn-js-properties-panel@5.18.0?bundle';
  import camundaModdleDescriptor from 'https://esm.sh/camunda-bpmn-moddle@7.0.1/resources/camunda.json' with { type: "json" };

  const bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
  <bpmn2:definitions 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
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

  // 2. Initialize the modeler with the imported modules
  const modeler = new BpmnModeler({
    container: '#canvas',
    propertiesPanel: {
      parent: '#properties-panel'
    },
    additionalModules: [
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      CamundaPlatformPropertiesProviderModule
    ],
    moddleExtensions: {
      camunda: camundaModdleDescriptor
    },
    keyboard: { bindTo: window }
  });

  // 3. Load logic
  window.addEventListener('load', async () => {
    try {
      const response = await fetch(getWebAppBackendUrl('/load'));
      if (response.ok) {
        const data = await response.json();
        await modeler.importXML(data.xml);
        console.log('Loaded from Dataiku!');
      } else {
        await modeler.importXML(bpmnXML);
        console.log('No existing diagram found. Started blank.');
      }
      modeler.get('canvas').zoom('fit-viewport');
    } catch (err) {
      console.error('Failed to load', err);
    }
  });

  // 4. Save logic
  document.getElementById('save-button').addEventListener('click', async () => {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      const response = await fetch(getWebAppBackendUrl('/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xml })
      });
      if (response.ok) alert('Diagram saved securely to Dataiku Managed Folder!');
    } catch (err) {
      console.error('Error saving', err);
      alert('Failed to save diagram.');
    }
  });
</script>