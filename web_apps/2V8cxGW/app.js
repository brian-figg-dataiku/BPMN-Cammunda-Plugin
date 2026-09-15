// A blank BPMN 2.0 diagram to start with
const bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="sample-diagram" targetNamespace="http://bpmn.io/schema/bpmn" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">
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

// Initialize the BpmnJS modeler
const modeler = new BpmnJS({
  container: '#canvas',
  keyboard: {
    bindTo: window
  }
});

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

document.getElementById('save-button').addEventListener('click', async () => {
  try {
    // Extract the XML from the modeler
    const { xml } = await modeler.saveXML({ format: true });
    
    // Create a downloadable blob
    const blob = new Blob([xml], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'process.bpmn';
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (err) {
    console.error('Error saving diagram', err);
    alert('Failed to save diagram.');
  }
});


document.getElementById('upload-input').addEventListener('change', function(event) {
  const file = event.target.files[0];
  
  // Stop if no file was selected
  if (!file) return; 

  const reader = new FileReader();
  
  // What to do when the file finishes loading
  reader.onload = async function(e) {
    const uploadedXML = e.target.result;
    
    try {
      // Load the new XML into the modeler
      await modeler.importXML(uploadedXML);
      
      // Re-center the canvas on the newly uploaded diagram
      modeler.get('canvas').zoom('fit-viewport');
      console.log('Diagram uploaded successfully!');
      
    } catch (err) {
      console.error('Error rendering uploaded diagram', err);
      alert('Failed to load the BPMN file. Ensure it is a valid BPMN 2.0 XML.');
    }
    
    // Reset the input so the same file can be uploaded again if needed
    event.target.value = ''; 
  };
  
  // Read the file as text
  reader.readAsText(file);
});