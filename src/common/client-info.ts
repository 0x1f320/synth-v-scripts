export function getClientInfoFactory(name: string): () => SVClientInfo {
  return () => ({
    name,
    category: "0x1F956",
    author: "0x1F320",
    versionNumber: 1,
    minEditorVersion: 0,
  });
}
