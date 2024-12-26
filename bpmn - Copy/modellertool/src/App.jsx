import React, { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";

// Import additional BPMN-JS modules
import minimapModule from "diagram-js-minimap";
import alignToOriginModule from "@bpmn-io/align-to-origin";
import gridModule from "diagram-js-grid";
import lintModule from "bpmn-js-bpmnlint";
import tokenSimulationModule from "bpmn-js-token-simulation";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import "diagram-js-minimap/assets/diagram-js-minimap.css";
import "bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css";
import {
  CreateAppendAnythingModule,
} from "bpmn-js-create-append-anything";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';
import "bpmn-js-properties-panel/dist/assets/properties-panel.css";
import "bpmn-js-properties-panel/dist/assets/element-templates.css";

// Import Zeebe moddle extension
import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';


import "./App.css";

// Custom User Task Provider
// First create a Base Provider that will handle the dragging functionality
class BaseCustomProvider {
  constructor(eventBus) {
    eventBus.on("drag.init", function (event) {
      event.stopPropagation();
    });
  }
}

BaseCustomProvider.$inject = ["eventBus"];

// Updated Custom User Task Provider
class CustomTaskProvider {
  constructor(
    palette,
    create,
    elementFactory,
    bpmnFactory,
    contextPad,
    modeling,
    connect
  ) {
    this.palette = palette;
    this.create = create;
    this.elementFactory = elementFactory;
    this.bpmnFactory = bpmnFactory;
    this.contextPad = contextPad;
    this.modeling = modeling;
    this.connect = connect;

    palette.registerProvider(this);
    contextPad.registerProvider(this);
  }

  getPaletteEntries(element) {
    return (entries) => {
      const keysToDelete = [
        "create.group",
        "create.task",
        "hand-tool",
        "create.data-object",
        "create.participant-expanded",
        "create.data-store",
        "lasso-tool",
        "space-tool",
        "global-connect-tool",
        "create.subprocess-expanded",
        "create.intermediate-event",
      ];

      // Iterate over the keys and delete them from entries
      keysToDelete.forEach((key) => {
        delete entries[key];
      });

      // Add your custom entries here
      entries["create.user-task"] = {
        group: "activity",
        className: "bpmn-icon-user-task",
        title: "Create User Task",
        action: {
          dragstart: (event) => this.createUserTask(event),
          click: (event) => this.createUserTask(event),
        },
      };

      entries["create.script-task"] = {
        group: "activity",
        className: "bpmn-icon-script-task",
        title: "Create Script Task",
        action: {
          dragstart: (event) => this.createScriptTask(event),
          click: (event) => this.createScriptTask(event),
        },
      };

      entries["create.exclusive-gateway"] = {
        group: "gateway",
        className: "bpmn-icon-gateway-xor",
        title: "Create Exclusive Gateway",
        action: {
          dragstart: (event) => this.createExclusiveGateway(event),
          click: (event) => this.createExclusiveGateway(event),
        },
      };

      entries["create.parallel-gateway"] = {
        group: "gateway",
        className: "bpmn-icon-gateway-parallel",
        title: "Create Parallel Gateway",
        action: {
          dragstart: (event) => this.createParallelGateway(event),
          click: (event) => this.createParallelGateway(event),
        },
      };

      entries["create.inclusive-gateway"] = {
        group: "gateway",
        className: "bpmn-icon-gateway-or",
        title: "Create Inclusive Gateway",
        action: {
          dragstart: (event) => this.createInclusiveGateway(event),
          click: (event) => this.createInclusiveGateway(event),
        },
      };

      entries["create.manual-task"] = {
        group: "activity",
        className: "bpmn-icon-manual-task",
        title: "Create Manual Task",
        action: {
          dragstart: (event) => this.createManualTask(event),
          click: (event) => this.createManualTask(event),
        },
      };

      entries["create.call-activity"] = {
        group: "activity",
        className: "bpmn-icon-call-activity",
        title: "Create Call Activity",
        action: {
          dragstart: (event) => this.createCallActivity(event),
          click: (event) => this.createCallActivity(event),
        },
      };

      entries["create.intermediate-signal"] = {
        group: "events",
        className: "bpmn-icon-intermediate-event-catch-signal",
        title: "Create Intermediate Signal Event",
        action: {
          dragstart: (event) => this.createIntermediateSignalCatchEvent(event),
          click: (event) => this.createIntermediateSignalCatchEvent(event),
        },
      };
      entries["create.intermediate-signal-throw"] = {
        group: "events",
        className: "bpmn-icon-intermediate-event-throw-signal",
        title: "Create Signal Throw Event",
        action: {
          dragstart: (event) => this.createIntermediateSignalThrow(event),
          click: (event) => this.createIntermediateSignalThrow(event),
        },
      };

      return entries;
    };
  }
  getContextPadEntries(element) {
    return {
      "append.user-task": {
        group: "model",
        className: "bpmn-icon-user-task",
        title: "Append User Task",
        action: {
          click: (event, element) => {
            const shape = this.createShape("bpmn:UserTask", "User Task");
            const position = {
              x: element.x + element.width + 100,
              y: element.y,
            };

            this.appendShape(element, shape, position);
          },
        },
      },
      "append.service-task": {
        group: "model",
        className: "bpmn-icon-service-task",
        title: "Append Service Task",
        action: {
          click: (event, element) => {
            const shape = this.createShape("bpmn:ServiceTask", "Service Task");
            const position = {
              x: element.x + element.width + 100,
              y: element.y,
            };

            this.appendShape(element, shape, position);
          },
        },
      },
    };
  }

  createShape(type, name) {
    const businessObject = this.bpmnFactory.create(type, {
      name: name,
    });

    return this.elementFactory.createShape({
      type: type,
      businessObject: businessObject,
      width: 70,
      height: 70,
    });
  }

  appendShape(source, shape, position) {
    this.modeling.appendShape(source, shape, position);
  }

  createUserTask(event) {
    const shape = this.createShape("bpmn:UserTask", "User Task");
    this.create.start(event, shape);
  }

  createServiceTask(event) {
    const shape = this.createShape("bpmn:ServiceTask", "Service Task");
    this.create.start(event, shape);
  }
  createScriptTask(event) {
    const shape = this.createShape("bpmn:ScriptTask", "Script Task");
    this.create.start(event, shape);
  }

  createExclusiveGateway(event) {
    const shape = this.createShape(
      "bpmn:ExclusiveGateway",
      "Exclusive Gateway"
    );
    this.create.start(event, shape);
  }

  createParallelGateway(event) {
    const shape = this.createShape("bpmn:ParallelGateway", "Parallel Gateway");
    this.create.start(event, shape);
  }

  createInclusiveGateway(event) {
    const shape = this.createShape(
      "bpmn:InclusiveGateway",
      "Inclusive Gateway"
    );
    this.create.start(event, shape);
  }

  createManualTask(event) {
    const shape = this.createShape("bpmn:ManualTask", "Manual Task");
    this.create.start(event, shape);
  }

  createCallActivity(event) {
    const shape = this.createShape("bpmn:CallActivity", "Call Activity");
    this.create.start(event, shape);
  }

  createIntermediateSignalCatchEvent(event) {
    const signalEventDefinition = this.bpmnFactory.create(
      "bpmn:SignalEventDefinition"
    );
    const businessObject = this.bpmnFactory.create(
      "bpmn:IntermediateCatchEvent",
      {
        name: "Signal Catch Event",
        eventDefinitions: [signalEventDefinition],
      }
    );
    const shape = this.elementFactory.createShape({
      type: "bpmn:IntermediateCatchEvent",
      businessObject: businessObject,
      width: 36,
      height: 36,
    });
    this.create.start(event, shape);
  }

  createIntermediateSignalThrow(event) {
    // Create the signal event definition
    const signalEventDefinition = this.bpmnFactory.create(
      "bpmn:SignalEventDefinition"
    );

    // Create the intermediate throw event with the signal definition
    const businessObject = this.bpmnFactory.create(
      "bpmn:IntermediateThrowEvent",
      {
        name: "Signal Throw Event",
        eventDefinitions: [signalEventDefinition],
      }
    );

    const shape = this.elementFactory.createShape({
      type: "bpmn:IntermediateThrowEvent",
      businessObject: businessObject,
      width: 36,
      height: 36,
    });

    this.create.start(event, shape);
  }
}

CustomTaskProvider.$inject = [
  "palette",
  "create",
  "elementFactory",
  "bpmnFactory",
  "contextPad",
  "modeling",
  "connect",
];

// Create a complete custom module

const customModule = {
  __init__: ["customTaskProvider", "baseCustomProvider"],
  baseCustomProvider: ["type", BaseCustomProvider],
  customTaskProvider: ["type", CustomTaskProvider],
};

// Main Modeller Component
const Modeller = () => {
  const [modeler, setModeler] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const containerRef = useRef(null);
    const propertiesPanelRef = useRef(null); // Initialize the ref here


  const initialDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="sample-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds height="36.0" width="36.0" x="412.0" y="240.0"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

useEffect(() => {
  if (!containerRef.current || !propertiesPanelRef.current) return;

  const bpmnModeler = new BpmnModeler({
    container: containerRef.current,
    propertiesPanel: {
      parent: propertiesPanelRef.current
    },
    additionalModules: [
      minimapModule,
      alignToOriginModule,
      gridModule,
      lintModule,
      tokenSimulationModule,
      customModule,
      CreateAppendAnythingModule,
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      ZeebePropertiesProviderModule
    ],
    moddleExtensions: {
      zeebe: ZeebeModdle
    },
    keyboard: {
      bindTo: document
    },
    grid: {
      visible: true
    },
    minimap: {
      open: true
    },
    linting: {
      active: true
    }
  });
  const setupModeler = async () => {
    try {
      const result = await bpmnModeler.importXML(initialDiagram);

      if (result.warnings.length) {
        console.warn("Warnings while importing BPMN diagram:", result.warnings);
      }

      const canvas = bpmnModeler.get("canvas");
      if (!canvas) {
        throw new Error("Canvas not found");
      }

      canvas.zoom("fit-viewport");

      bpmnModeler.on("selection.changed", ({ newSelection }) => {
        setSelectedElement(newSelection[0] || null);
      });

      bpmnModeler.on("element.changed", (event) => {
        if (event.element === selectedElement) {
          setSelectedElement({ ...event.element });
        }
      });

      setModeler(bpmnModeler);
    } catch (error) {
      console.error("Error setting up BPMN modeler:", error);
    }
  };

  setupModeler();

  return () => {
    if (bpmnModeler) {
      bpmnModeler.destroy();
    }
  };
}, []);

 
  const handleSave = async () => {
    if (!modeler) return;

    try {
      const { xml } = await modeler.saveXML({ format: true });
      const blob = new Blob([xml], { type: "text/xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "diagram.bpmn";
      link.click();
      URL.revokeObjectURL(link.href);
      console.log("Diagram saved successfully.");
    } catch (error) {
      console.error("Error saving diagram:", error);
    }
  };

  return (
    <div className="app-container">
      <div className="toolbar">
        <div className="toolbar-group">
          <button onClick={handleSave}>Save Diagram</button>
        </div>
      </div>
      <div className="main-content">
        <div className="modeler-container" ref={containerRef}></div>
        <div className="properties-panel" ref={propertiesPanelRef}></div>
      </div>
    </div>
  );
};

export default Modeller;