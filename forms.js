export const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
export const post = (action, content, attrs = "") => `<form method="post" action="${action}" ${attrs}>${content}</form>`;
export const button = text => `<button type="submit">${text}</button>`;
export const label = (text, content) => `<label><span>${esc(text)}</span>${content}</label>`;
export const textarea = (name, limit, value = "", required = false) =>
  `<textarea name="${name}" maxlength="${limit}" rows="2" ${required ? "required" : ""}>${esc(value)}</textarea>`;
