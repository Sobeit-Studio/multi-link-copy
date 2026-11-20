// Show the UI when the plugin starts
figma.showUI(__html__, { width: 300, height: 400 });

// Define a persistent variable for fileKey
let fileKey: string | null = null;

// UI state management
function showUI(state: string) {
  console.log(`Switching UI state to: ${state}`);  // Log the UI state change
  if (state === 'enter-url') {
    figma.ui.postMessage({ type: 'show-enter-url' });
  } else if (state === 'select-nodes') {
    figma.ui.postMessage({ type: 'show-select-nodes' });
  } else if (state === 'copy-links') {
    figma.ui.postMessage({ type: 'show-copy-links' });
  }
}

// Display the URL input UI initially
showUI('enter-url');

// Function to validate Figma URLs
function validateFigmaURL(url: string): { valid: boolean; fileKey: string | null } {
  const regex = /^https:\/\/www\.figma\.com\/(file|proto|design)\/([a-zA-Z0-9]+)\//;
  const match = url.match(regex);
  if (match) {
    console.log("Valid URL, fileKey found:", match[2]);  // Log valid URL and fileKey
    return { valid: true, fileKey: match[2] };
  } else {
    console.log("Invalid URL format");  // Log if URL is invalid
    return { valid: false, fileKey: null };
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'submit-url') {
    const url = msg.url;
    const validationResult = validateFigmaURL(url);

    if (validationResult.valid) {
      fileKey = validationResult.fileKey;
      figma.notify('Select frames or components to copy your links');
      showUI('select-nodes');
    } else {
      figma.notify('Please enter a valid Figma file URL.');
    }
  }

  if (msg.type === 'copy-links' && fileKey) {
    console.log("Received 'copy-links' message");

    const selection = figma.currentPage.selection;
    console.log("Current selection:", selection);  // Log the selection

    if (selection.length === 0) {
      figma.notify('Please select at least one frame or component.');
    } else {
      // Recursive function to gather all selected nodes in order
      function getAllNodes(nodes: readonly SceneNode[]): SceneNode[] {
        let allNodes: SceneNode[] = [];
        nodes.forEach(node => {
          allNodes.push(node);
          if ('children' in node) {
            allNodes = allNodes.concat(getAllNodes(node.children));
          }
        });
        return allNodes;
      }

      // Get all nodes in the current page in order, including nested nodes
      const allLayers = getAllNodes(figma.currentPage.children);

      // Filter and sort the selection to match the order of layers in Figma, including nested layers
      const sortedSelection = allLayers.filter(node => selection.some(selectedNode => selectedNode.id === node.id));

      // Generate links for the sorted selection
      const links = sortedSelection.map(node => {
        const nodeId = encodeURIComponent(node.id);
        const url = `https://www.figma.com/file/${fileKey}/?node-id=${nodeId}`;
        console.log(`Generated URL for node ${node.id}:`, url);  // Log each generated URL
        return url;
      });

      const linksString = links.join('\n');
      console.log("All links:", linksString);  // Log all the generated links

      // Send the links to the UI to be copied
      figma.ui.postMessage({ type: 'copy-to-clipboard', text: linksString });

      // Show Figma notification for success
      figma.notify(`Copied ${links.length} link(s) to clipboard!`);
    }
  }
};