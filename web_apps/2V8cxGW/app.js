
  // the diagram you are going to display
  const bpmnXML;

  // BpmnJS is the BPMN viewer instance
  const viewer = new BpmnJS({ container: '#canvas' });

  // import a BPMN 2.0 diagram
  try {
    // we did well!
    await viewer.importXML(bpmnXML);
    viewer.get('canvas').zoom('fit-viewport');

  } catch (err) {
    // import failed :-(
  }
