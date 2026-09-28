export function setMessage(node, text) {
  if (!node) return;
  node.textContent = text;
}

export function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

export function showPanel(panel, visible) {
  if (!panel) return;
  panel.classList.toggle('hidden', !visible);
}

export function clearNode(node) {
  if (!node) return;
  node.innerHTML = '';
}
