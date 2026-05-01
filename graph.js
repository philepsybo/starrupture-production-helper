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
    // Escape HTML special characters for safe embedding in <textarea>
    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');
    }
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Material Flow Graph</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #f9f9f9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .fullscreen-container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .fullscreen-controls {
            background: white;
            padding: 12px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .fullscreen-btn {
            padding: 8px 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
        }
        .fullscreen-btn:hover {
            background: #764ba2;
        }
        .graph-wrapper {
            flex: 1;
            overflow: hidden;
            position: relative;
        }
        .graph-wrapper svg {
            width: 100%;
            height: 100%;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="fullscreen-container">
        <div class="fullscreen-controls">
            <button class="fullscreen-btn" onclick="zoomIn()">🔍+ Zoom In</button>
            <button class="fullscreen-btn" onclick="zoomOut()">🔍− Zoom Out</button>
            <button class="fullscreen-btn" onclick="resetZoom()">⟲ Reset</button>
            <button class="fullscreen-btn" onclick="window.close()">✕ Close</button>
        </div>
        <div class="graph-wrapper">
            <div class="mermaid" id="mermaidGraph"></div>
            <textarea id="mermaidSource" style="display:none">${escapeHtml(mermaidCode)}</textarea>
        </div>
    </div>
    <script>
        let zoom = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        function renderMermaid() {
            var mermaidDiv = document.getElementById('mermaidGraph');
            var code = document.getElementById('mermaidSource').value;
            mermaidDiv.textContent = code;
            mermaid.init(undefined, mermaidDiv);
            setTimeout(() => {
                const svg = document.querySelector('svg');
                const g = svg && svg.querySelector('g');
                if (g) {
                    g.setAttribute('data-transformable', 'true');
                    const updateTransform = () => {
                        g.setAttribute('transform', \`translate(\${panX}, \${panY}) scale(\${zoom})\`);
                    };
                    window.zoomIn = () => {
                        zoom = Math.min(zoom + 0.2, 3);
                        updateTransform();
                    };
                    window.zoomOut = () => {
                        zoom = Math.max(zoom - 0.2, 0.5);
                        updateTransform();
                    };
                    window.resetZoom = () => {
                        zoom = 1; panX = 0; panY = 0;
                        updateTransform();
                    };
                    let dragging = false;
                    svg.addEventListener('mousedown', e => {
                        if (e.button !== 0) return;
                        dragging = true;
                        startX = e.clientX - panX;
                        startY = e.clientY - panY;
                    });
                    svg.addEventListener('mousemove', e => {
                        if (!dragging) return;
                        panX = e.clientX - startX;
                        panY = e.clientY - startY;
                        updateTransform();
                    });
                    svg.addEventListener('mouseup', () => { dragging = false; });
                    svg.addEventListener('mouseleave', () => { dragging = false; });
                }
            }, 500);
        }
        window.addEventListener('DOMContentLoaded', renderMermaid);
    </script>
</body>
</html>
`;
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        alert('Popup blocked! Please allow popups for this site to view the diagram.');
    }
}
