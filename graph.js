// graph.js
// Material flow graph generation and rendering
import { productsData } from './data.js';

export function displayMaterialFlowGraph(result, container) {
    let nodeCounter = 0;
    const nodeMap = new Map();
    const edgesAdded = new Set();
    let mermaidCode = 'graph TD\n';
    const nodeId = (name, quantity) => {
        const key = `${name}_${quantity}`;
        if (!nodeMap.has(key)) {
            nodeMap.set(key, `N${nodeCounter++}`);
        }
        return nodeMap.get(key);
    };
    function traverseResult(node) {
        const nId = nodeId(node.productName, node.requestedQuantity);
        mermaidCode += `    ${nId}["${node.productName}<br/>${node.requestedQuantity} units"]\n`;
        if (node.dependencies && Object.keys(node.dependencies).length > 0) {
            Object.entries(node.dependencies).forEach(([depId, dep]) => {
                if (dep.result) {
                    const depNodeId = nodeId(dep.result.productName, dep.quantity);
                    mermaidCode += `    ${depNodeId}["${dep.result.productName}<br/>${dep.quantity} units"]\n`;
                    const edgeKey = `${nId}-->${depNodeId}`;
                    if (!edgesAdded.has(edgeKey)) {
                        mermaidCode += `    ${nId} -->|uses| ${depNodeId}\n`;
                        edgesAdded.add(edgeKey);
                    }
                    traverseResult(dep.result);
                }
            });
        }
    }
    traverseResult(result);
    mermaidCode += '    classDef product fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff\n';
    container.innerHTML = `
        <div class="graph-link-section">
            <button class="graph-open-btn" id="openGraphButton" title="Open Material Flow Diagram in New Tab">
                📊 View Material Flow Diagram
            </button>
        </div>
    `;
    document.getElementById('openGraphButton')?.addEventListener('click', () => {
        openGraphFullscreen(mermaidCode);
    });
}

export function openGraphFullscreen(mermaidCode) {
    // ...existing code from your previous openGraphFullscreen implementation...
}
